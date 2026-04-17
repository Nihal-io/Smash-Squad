import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { requireRole } from '@/lib/rbac/guard';
import { createClient } from '@/lib/supabase/server';
import { reconcileTask } from '@/lib/assignment/engine';
import { generateMovePool, type CandidateMove } from '@/lib/assignment/move-generator';
import { getNotifier } from '@/lib/notifications';
import type { Notification } from '@/lib/notifications/types';
import {
  assignmentNotification,
  type TemplateTask,
  type TemplateVolunteer,
} from '@/lib/notifications/templates';

type SB = SupabaseClient<Database>;

const ApplySchema = z.object({
  task_id: z.string().uuid(),
  apply_move_ids: z.array(z.number()).min(1),
});

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

async function fetchVolunteerForNotify(
  supabase: SB,
  volunteerId: string
): Promise<TemplateVolunteer | null> {
  const { data } = await supabase
    .from('volunteers')
    .select('profiles:profile_id(full_name, email)')
    .eq('id', volunteerId)
    .single();
  const raw = data?.profiles;
  const profile = Array.isArray(raw) ? raw[0] : raw;
  if (!profile?.full_name || !profile?.email) return null;
  return { full_name: profile.full_name, email: profile.email };
}

async function fetchTaskTemplate(supabase: SB, taskId: string): Promise<TemplateTask | null> {
  const { data } = await supabase
    .from('tasks')
    .select('name, slot_start, slot_end, skills_required')
    .eq('id', taskId)
    .single();
  if (!data) return null;
  return {
    name: data.name,
    slot_start: data.slot_start,
    slot_end: data.slot_end,
    skills_required: data.skills_required ?? [],
  };
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

  const options = moves.map((move, idx) => ({
    // UI-consumed shape
    selected_move_ids: [move.id],
    title: move.type,
    tradeoff: move.impact,
    confidence: 'medium' as const,
    recommended: idx === 0,
    // Extra deterministic fields requested for clarity
    description: move.description,
    impact: move.impact,
    move_ids: [move.id],
  }));

  const resolutions = {
    options,
    assessment: `Task needs ${needs} volunteers, has ${has}. Found ${moves.length} possible moves.`,
  };

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

      const { data: src } = await supabase
        .from('assignments')
        .select('id')
        .eq('task_id', move.source_task_id)
        .eq('volunteer_id', move.volunteer_id)
        .eq('status', 'assigned')
        .maybeSingle();

      if (!src) {
        summary.push(
          `Could not find an active assignment for ${move.volunteer_name ?? 'volunteer'} on the source task.`
        );
        continue;
      }

      const { error: dropErr } = await supabase
        .from('assignments')
        .update({
          status: 'dropped',
          dropped_at: new Date().toISOString(),
          drop_reason: 'Reassigned by coordinator to resolve staffing shortage',
        })
        .eq('id', src.id);

      if (dropErr) {
        summary.push(`Failed to drop source assignment: ${dropErr.message}`);
        continue;
      }

      const { error: insErr } = await supabase.from('assignments').insert({
        task_id,
        volunteer_id: move.volunteer_id,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      });

      if (insErr) {
        summary.push(`Failed to assign to target task: ${insErr.message}`);
        continue;
      }

      summary.push(
        `Moved ${move.volunteer_name ?? 'volunteer'} from "${move.source_task_name ?? 'source'}" to this task.`
      );

      const vol = await fetchVolunteerForNotify(supabase, move.volunteer_id);
      const taskT = await fetchTaskTemplate(supabase, task_id);
      if (vol && taskT) {
        notifications.push(assignmentNotification(vol, taskT));
      }

      const rSource = await reconcileTask(move.source_task_id, supabase);
      const rTarget = await reconcileTask(task_id, supabase);
      notifications.push(...rSource.notifications, ...rTarget.notifications);
    } else if (move.type === 'partial_match') {
      if (!move.volunteer_id) continue;

      const { error: insErr } = await supabase.from('assignments').insert({
        task_id,
        volunteer_id: move.volunteer_id,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      });

      if (insErr) {
        summary.push(`Failed to assign to target task: ${insErr.message}`);
        continue;
      }

      summary.push(`Assigned ${move.volunteer_name ?? 'volunteer'} (partial skill match).`);

      const vol = await fetchVolunteerForNotify(supabase, move.volunteer_id);
      const taskT = await fetchTaskTemplate(supabase, task_id);
      if (vol && taskT) {
        notifications.push(assignmentNotification(vol, taskT));
      }

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
