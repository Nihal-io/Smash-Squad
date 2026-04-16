import { z } from 'zod';
import { requireRole } from '@/lib/rbac/guard';
import { createClient } from '@/lib/supabase/server';
import { reconcileTask } from '@/lib/assignment/engine';
import { getNotifier } from '@/lib/notifications';
import { taskCancelledNotification } from '@/lib/notifications/templates';
import type { Notification } from '@/lib/notifications/types';

const ExecuteSchema = z.object({
  intent: z.string(),
  params: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const guard = await requireRole(request, 'ai.command');
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const parsed = ExecuteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid payload' }, { status: 400 });
  }

  const { intent, params } = parsed.data;
  const supabase = await createClient();

  if (intent === 'create_task') {
    const p = params as {
      name: string;
      slot_start_iso: string;
      slot_end_iso: string;
      volunteers_needed: number;
      skills_required: string[];
    };

    const { data: task, error: tErr } = await supabase
      .from('tasks')
      .insert({
        name: p.name,
        slot_start: p.slot_start_iso,
        slot_end: p.slot_end_iso,
        volunteers_needed: p.volunteers_needed,
        skills_required: p.skills_required,
      })
      .select('id, name')
      .single();

    if (tErr || !task) {
      return Response.json({ error: 'failed to create task', detail: tErr?.message }, { status: 500 });
    }

    const result = await reconcileTask(task.id, supabase);
    if (result.notifications.length > 0) {
      await getNotifier().send(result.notifications);
    }

    return Response.json({
      ok: true,
      action: 'task_created',
      summary: `Created "${task.name}" — ${result.filled} volunteers assigned, ${result.still_short} still needed.`,
      task_id: task.id,
      reconcile: result,
    });
  }

  if (intent === 'drop_assignment') {
    const p = params as {
      volunteer_name_or_email: string;
      task_hint: string;
      drop_all_tasks: boolean;
      reason: string;
    };

    // Find the volunteer by name (case-insensitive partial match)
    const searchTerm = p.volunteer_name_or_email.toLowerCase();

    const { data: volunteers } = await supabase
      .from('volunteers')
      .select('id, profiles:profile_id(full_name, email)')
      .eq('status', 'approved');

    const matched = (volunteers ?? []).filter((v) => {
      const profile = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
      if (!profile) return false;
      return (
        profile.full_name.toLowerCase().includes(searchTerm) ||
        profile.email.toLowerCase().includes(searchTerm)
      );
    });

    if (matched.length === 0) {
      return Response.json({
        ok: false,
        action: 'drop_failed',
        summary: `No volunteer found matching "${p.volunteer_name_or_email}".`,
      });
    }

    if (matched.length > 1) {
      const names = matched.map((v) => {
        const profile = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
        return profile?.full_name ?? 'Unknown';
      });
      return Response.json({
        ok: false,
        action: 'drop_ambiguous',
        summary: `Multiple volunteers match "${p.volunteer_name_or_email}": ${names.join(', ')}. Be more specific.`,
      });
    }

    const volunteerId = matched[0].id;
    const volunteerProfile = Array.isArray(matched[0].profiles)
      ? matched[0].profiles[0]
      : matched[0].profiles;

    // Find their active assignments
    const assignmentQuery = supabase
      .from('assignments')
      .select('id, task_id, status, tasks:task_id(id, name, slot_start, slot_end, skills_required)')
      .eq('volunteer_id', volunteerId)
      .eq('status', 'assigned');

    const { data: activeAssignments } = await assignmentQuery;

    let toDrop = activeAssignments ?? [];

    // Filter by task hint if not dropping all
    if (!p.drop_all_tasks && p.task_hint) {
      const hint = p.task_hint.toLowerCase();
      toDrop = toDrop.filter((a) => {
        const task = Array.isArray(a.tasks) ? a.tasks[0] : a.tasks;
        return task?.name?.toLowerCase().includes(hint);
      });
    }

    if (toDrop.length === 0) {
      return Response.json({
        ok: false,
        action: 'drop_failed',
        summary: `${volunteerProfile?.full_name ?? 'Volunteer'} has no active assignments${p.task_hint ? ` matching "${p.task_hint}"` : ''}.`,
      });
    }

    // Drop each assignment and reconcile
    const notifications: Notification[] = [];
    const droppedTasks: string[] = [];

    for (const a of toDrop) {
      const { error: upErr } = await supabase
        .from('assignments')
        .update({
          status: 'dropped',
          dropped_at: new Date().toISOString(),
          drop_reason: p.reason || null,
        })
        .eq('id', a.id);

      if (upErr) continue;

      const task = Array.isArray(a.tasks) ? a.tasks[0] : a.tasks;
      if (task && volunteerProfile) {
        droppedTasks.push(task.name);
        notifications.push(
          taskCancelledNotification(
            { full_name: volunteerProfile.full_name, email: volunteerProfile.email },
            {
              name: task.name,
              slot_start: task.slot_start,
              slot_end: task.slot_end,
              skills_required: task.skills_required ?? [],
            }
          )
        );

        // Reconcile to refill from waitlist
        const result = await reconcileTask(task.id, supabase, { isDropoutRefill: true });
        notifications.push(...result.notifications);
      }
    }

    if (notifications.length > 0) {
      await getNotifier().send(notifications);
    }

    const name = volunteerProfile?.full_name ?? 'Volunteer';
    return Response.json({
      ok: true,
      action: 'volunteers_dropped',
      summary: `Dropped ${name} from ${droppedTasks.length} task(s): ${droppedTasks.join(', ')}. ${p.reason ? `Reason: ${p.reason}.` : ''} Waitlist candidates promoted where available.`,
      dropped_count: droppedTasks.length,
      dropped_tasks: droppedTasks,
    });
  }

  if (intent === 'query_volunteers') {
    const p = params as {
      required_skills: string[];
      status_filter: string;
      availability_window_start_iso: string | null;
      availability_window_end_iso: string | null;
    };

    let query = supabase
      .from('volunteers')
      .select('id, skills, status, availability, profiles:profile_id(full_name, email)');

    if (p.status_filter !== 'any') {
      query = query.eq('status', p.status_filter);
    }

    const { data: volunteers } = await query;

    let results = volunteers ?? [];

    // Filter by skills
    if (p.required_skills.length > 0) {
      const needed = p.required_skills.map((s) => s.toLowerCase());
      results = results.filter((v) => {
        const skills = (v.skills ?? []).map((s: string) => s.toLowerCase());
        return needed.some((n) => skills.includes(n));
      });
    }

    const formatted = results.map((v) => {
      const profile = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
      return {
        name: profile?.full_name ?? 'Unknown',
        email: profile?.email ?? '',
        skills: v.skills ?? [],
        status: v.status,
      };
    });

    return Response.json({
      ok: true,
      action: 'query_result',
      summary: `Found ${formatted.length} volunteer(s) matching criteria.`,
      volunteers: formatted,
    });
  }

  return Response.json({
    ok: false,
    action: 'unsupported',
    summary: `Intent "${intent}" is not yet supported for auto-execution.`,
  });
}
