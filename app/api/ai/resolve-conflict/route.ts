import { z } from 'zod';
import { requireRole } from '@/lib/rbac/guard';
import { createClient } from '@/lib/supabase/server';
import { reconcileTask } from '@/lib/assignment/engine';
import { generateMovePool, type CandidateMove } from '@/lib/assignment/move-generator';
import { proposeResolutions, type ResolutionResult } from '@/lib/ai/propose-resolutions';
import { getNotifier } from '@/lib/notifications';
import type { Notification } from '@/lib/notifications/types';

const ApplySchema = z.object({
  task_id: z.string().uuid(),
  apply_move_ids: z.array(z.number()).min(1),
});

function buildFallbackResolutions(moves: CandidateMove[]): ResolutionResult {
  const n = Math.min(3, moves.length);
  const options = moves.slice(0, n).map((m, i) => ({
    selected_move_ids: [m.id],
    title: m.type === 'time_shift' ? 'Shift time window' : m.type === 'reassign' ? 'Reassign volunteer' : 'Partial skill match',
    tradeoff: m.impact.slice(0, 120),
    confidence: 'medium' as const,
    recommended: i === 0,
  }));

  if (options.length === 0) {
    return {
      options: [
        {
          selected_move_ids: [],
          title: 'No automated options',
          tradeoff: 'Add volunteers manually or edit the task.',
          confidence: 'low',
          recommended: true,
        },
      ],
      assessment: 'No candidate moves were available to rank.',
    };
  }

  return {
    options,
    assessment: 'LLM ranking unavailable — showing raw candidate moves one per option.',
  };
}

export async function POST(request: Request) {
  const guard = await requireRole(request, 'tasks.edit');
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const applyParsed = ApplySchema.safeParse(body);
  if (applyParsed.success) {
    return executeApply(applyParsed.data);
  }

  const genParsed = z.object({ task_id: z.string().uuid() }).safeParse(body);
  if (!genParsed.success) {
    return Response.json(
      { error: 'validation failed', issues: genParsed.error.flatten() },
      { status: 400 }
    );
  }

  return generateOptions(genParsed.data.task_id);
}

async function generateOptions(taskId: string) {
  const supabase = await createClient();

  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('id, name, slot_start, slot_end, volunteers_needed, skills_required')
    .eq('id', taskId)
    .single();

  if (tErr || !task) {
    return Response.json({ ok: false, reason: 'task not found' }, { status: 404 });
  }

  const { count: assignedCount } = await supabase
    .from('assignments')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', taskId)
    .eq('status', 'assigned');

  const has = assignedCount ?? 0;
  const needs = task.volunteers_needed;
  if (has >= needs) {
    return Response.json({ ok: false, reason: 'task is fully staffed' });
  }

  const moves = await generateMovePool(taskId, supabase);
  if (moves.length === 0) {
    return Response.json({ ok: false, reason: 'no resolution options' });
  }

  const failingTask = {
    name: task.name,
    needs,
    has,
    skills: task.skills_required ?? [],
  };

  let resolutions: ResolutionResult;
  try {
    resolutions = await proposeResolutions(failingTask, moves);
    const moveIds = new Set(moves.map((m) => m.id));
    resolutions = {
      ...resolutions,
      options: resolutions.options
        .map((opt) => ({
          ...opt,
          selected_move_ids: opt.selected_move_ids.filter((id) => moveIds.has(id)),
        }))
        .filter((opt) => opt.selected_move_ids.length > 0),
    };
    if (resolutions.options.length === 0) {
      resolutions = buildFallbackResolutions(moves);
    } else {
      const recCount = resolutions.options.filter((o) => o.recommended).length;
      if (recCount !== 1) {
        resolutions = {
          ...resolutions,
          options: resolutions.options.map((o, i) => ({
            ...o,
            recommended: i === 0,
          })),
        };
      }
    }
  } catch (err) {
    console.error('[resolve-conflict] LLM failed:', err);
    resolutions = buildFallbackResolutions(moves);
  }

  return Response.json({
    ok: true,
    task: {
      id: task.id,
      name: task.name,
      slot_start: task.slot_start,
      slot_end: task.slot_end,
      volunteers_needed: needs,
      skills_required: task.skills_required ?? [],
      assigned: has,
    },
    moves,
    resolutions,
  });
}

async function executeApply(data: z.infer<typeof ApplySchema>) {
  const supabase = await createClient();
  const { task_id, apply_move_ids } = data;

  const pool = await generateMovePool(task_id, supabase);
  const selected = apply_move_ids
    .map((id) => pool.find((m) => m.id === id))
    .filter((m): m is CandidateMove => m != null);

  if (selected.length === 0) {
    return Response.json({ ok: false, reason: 'no matching moves for given ids' }, { status: 400 });
  }

  const order = ['time_shift', 'reassign', 'partial_match'] as const;
  selected.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  const notifications: Notification[] = [];
  const summary: string[] = [];
  let timeShiftApplied = false;

  for (const move of selected) {
    if (move.type === 'time_shift') {
      if (timeShiftApplied) continue;
      if (!move.new_slot_start || !move.new_slot_end) continue;
      const { error: upErr } = await supabase
        .from('tasks')
        .update({ slot_start: move.new_slot_start, slot_end: move.new_slot_end })
        .eq('id', task_id);
      if (upErr) {
        summary.push(`Time shift failed: ${upErr.message}`);
        continue;
      }
      timeShiftApplied = true;
      summary.push('Task time window updated.');
      const r = await reconcileTask(task_id, supabase);
      notifications.push(...r.notifications);
    } else if (move.type === 'reassign') {
      if (!move.volunteer_id || !move.source_task_id) continue;

      await supabase
        .from('assignments')
        .delete()
        .eq('task_id', move.source_task_id)
        .eq('volunteer_id', move.volunteer_id)
        .eq('status', 'assigned');

      await supabase.from('assignments').insert({
        task_id,
        volunteer_id: move.volunteer_id,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      });

      summary.push(
        `Moved ${move.volunteer_name ?? 'volunteer'} from "${move.source_task_name ?? 'source'}" to this task.`
      );

      const rSource = await reconcileTask(move.source_task_id, supabase);
      const rTarget = await reconcileTask(task_id, supabase);
      notifications.push(...rSource.notifications, ...rTarget.notifications);
    } else if (move.type === 'partial_match') {
      if (!move.volunteer_id) continue;

      await supabase.from('assignments').insert({
        task_id,
        volunteer_id: move.volunteer_id,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      });

      summary.push(`Assigned ${move.volunteer_name ?? 'volunteer'} (partial skill match).`);
      const r = await reconcileTask(task_id, supabase);
      notifications.push(...r.notifications);
    }
  }

  if (notifications.length > 0) {
    await getNotifier().send(notifications);
  }

  return Response.json({
    ok: true,
    applied: selected.map((m) => ({ type: m.type, id: m.id })),
    summary: summary.join(' '),
  });
}
