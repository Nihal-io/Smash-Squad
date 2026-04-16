import { z } from 'zod';
import { requireRole } from '@/lib/rbac/guard';
import { createClient } from '@/lib/supabase/server';
import { reconcileTask } from '@/lib/assignment/engine';
import { getNotifier } from '@/lib/notifications';
import { taskCancelledNotification } from '@/lib/notifications/templates';
import type { Notification } from '@/lib/notifications/types';

const DropSchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(request, 'tasks.edit');
  if (guard) return guard;

  const { id } = await params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // empty body fine
  }

  const parsed = DropSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation failed', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select(
      'id, task_id, volunteer_id, status, tasks:task_id(id, name, slot_start, slot_end, skills_required), volunteers:volunteer_id(profiles:profile_id(full_name, email))'
    )
    .eq('id', id)
    .single();

  if (aErr || !assignment) {
    return Response.json({ error: 'assignment not found' }, { status: 404 });
  }

  if (assignment.status === 'dropped') {
    return Response.json({ ok: true, already: 'dropped' });
  }

  if (assignment.status !== 'assigned') {
    return Response.json(
      { error: `cannot drop an assignment with status '${assignment.status}'` },
      { status: 400 }
    );
  }

  const { error: upErr } = await supabase
    .from('assignments')
    .update({
      status: 'dropped',
      dropped_at: new Date().toISOString(),
      drop_reason: parsed.data.reason ?? null,
    })
    .eq('id', id);

  if (upErr) {
    return Response.json(
      { error: 'failed to drop assignment', detail: upErr.message },
      { status: 500 }
    );
  }

  const notifications: Notification[] = [];

  const task = Array.isArray(assignment.tasks) ? assignment.tasks[0] : assignment.tasks;
  const vol = Array.isArray(assignment.volunteers)
    ? assignment.volunteers[0]
    : assignment.volunteers;
  const profile = vol && (Array.isArray(vol.profiles) ? vol.profiles[0] : vol.profiles);

  if (task && profile) {
    notifications.push(
      taskCancelledNotification(
        { full_name: profile.full_name, email: profile.email },
        {
          name: task.name,
          slot_start: task.slot_start,
          slot_end: task.slot_end,
          skills_required: task.skills_required ?? [],
        }
      )
    );
  }

  if (task) {
    const result = await reconcileTask(task.id, supabase, { isDropoutRefill: true });
    notifications.push(...result.notifications);
  }

  if (notifications.length > 0) {
    await getNotifier().send(notifications);
  }

  return Response.json({
    ok: true,
    assignment_id: id,
    status: 'dropped',
    refilled: notifications.filter((n) => n.kind === 'dropout_reassignment').length,
  });
}
