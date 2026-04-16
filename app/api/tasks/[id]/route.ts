import { z } from 'zod';
import { requireRole } from '@/lib/rbac/guard';
import { createClient } from '@/lib/supabase/server';
import { reconcileTask } from '@/lib/assignment/engine';
import { getNotifier } from '@/lib/notifications';
import { taskCancelledNotification } from '@/lib/notifications/templates';
import type { Notification } from '@/lib/notifications/types';

const PatchTaskSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    slot_start: z.string().datetime({ offset: true }).optional(),
    slot_end: z.string().datetime({ offset: true }).optional(),
    volunteers_needed: z.number().int().positive().max(500).optional(),
    skills_required: z.array(z.string().min(1)).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'at least one field must be provided',
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(request, 'tasks.edit');
  if (guard) return guard;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const parsed = PatchTaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation failed', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from('tasks')
    .select('id, slot_start, slot_end')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return Response.json({ error: 'task not found' }, { status: 404 });
  }

  const newStart = parsed.data.slot_start ?? existing.slot_start;
  const newEnd = parsed.data.slot_end ?? existing.slot_end;
  if (new Date(newEnd) <= new Date(newStart)) {
    return Response.json(
      { error: 'slot_end must be after slot_start' },
      { status: 400 }
    );
  }

  const { data: updated, error: upErr } = await supabase
    .from('tasks')
    .update(parsed.data)
    .eq('id', id)
    .select('id, name, slot_start, slot_end, volunteers_needed, skills_required')
    .single();

  if (upErr || !updated) {
    return Response.json(
      { error: 'failed to update task', detail: upErr?.message },
      { status: 500 }
    );
  }

  const result = await reconcileTask(id, supabase);
  if (result.notifications.length > 0) {
    await getNotifier().send(result.notifications);
  }

  return Response.json({
    ok: true,
    task: updated,
    reconcile: {
      filled: result.filled,
      waitlisted: result.waitlisted,
      still_short: result.still_short,
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(request, 'tasks.delete');
  if (guard) return guard;

  const { id } = await params;
  const supabase = await createClient();

  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('id, name, slot_start, slot_end, skills_required')
    .eq('id', id)
    .single();

  if (tErr || !task) {
    return Response.json({ error: 'task not found' }, { status: 404 });
  }

  const { data: affected } = await supabase
    .from('assignments')
    .select('volunteer_id, status, volunteers:volunteer_id(profiles:profile_id(full_name, email))')
    .eq('task_id', id)
    .eq('status', 'assigned');

  const notifications: Notification[] = [];
  for (const a of affected ?? []) {
    const vol = Array.isArray(a.volunteers) ? a.volunteers[0] : a.volunteers;
    const profile = vol && (Array.isArray(vol.profiles) ? vol.profiles[0] : vol.profiles);
    if (!profile) continue;
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

  const { error: delErr } = await supabase.from('tasks').delete().eq('id', id);

  if (delErr) {
    return Response.json(
      { error: 'failed to delete task', detail: delErr.message },
      { status: 500 }
    );
  }

  if (notifications.length > 0) {
    await getNotifier().send(notifications);
  }

  return Response.json({
    ok: true,
    task_id: id,
    notified: notifications.length,
  });
}
