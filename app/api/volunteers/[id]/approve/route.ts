import { requireRole } from '@/lib/rbac/guard';
import { createClient } from '@/lib/supabase/server';
import { reconcileTask } from '@/lib/assignment/engine';
import { getNotifier } from '@/lib/notifications';
import { approvalNotification } from '@/lib/notifications/templates';
import type { Notification } from '@/lib/notifications/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(request, 'volunteers.approve');
  if (guard) return guard;

  const { id } = await params;
  const supabase = await createClient();

  const { data: volunteer, error: vErr } = await supabase
    .from('volunteers')
    .select('id, status, skills, profiles:profile_id(full_name, email)')
    .eq('id', id)
    .single();

  if (vErr || !volunteer) {
    return Response.json({ error: 'volunteer not found' }, { status: 404 });
  }

  if (volunteer.status === 'approved') {
    return Response.json({ ok: true, already: 'approved' });
  }

  const { error: upErr } = await supabase
    .from('volunteers')
    .update({ status: 'approved' })
    .eq('id', id);

  if (upErr) {
    return Response.json(
      { error: 'failed to update status', detail: upErr.message },
      { status: 500 }
    );
  }

  const profile = Array.isArray(volunteer.profiles)
    ? volunteer.profiles[0]
    : volunteer.profiles;

  if (!profile) {
    return Response.json({ ok: true, warning: 'approved but profile missing' });
  }

  const notifications: Notification[] = [
    approvalNotification({ full_name: profile.full_name, email: profile.email }),
  ];

  const { data: candidateTasks } = await supabase
    .from('tasks')
    .select('id, name, volunteers_needed');

  const tasksToReconcile: { id: string; name: string }[] = [];

  if (candidateTasks) {
    for (const t of candidateTasks) {
      const { count } = await supabase
        .from('assignments')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', t.id)
        .eq('status', 'assigned');

      if ((count ?? 0) < t.volunteers_needed) {
        tasksToReconcile.push({ id: t.id, name: t.name });
      }
    }
  }

  console.log(
    '[approve] reconciling understaffed tasks:',
    tasksToReconcile.map((x) => `${x.name} (${x.id})`).join(', ') || '(none)'
  );

  const reconcileResults = [];
  for (const task of tasksToReconcile) {
    const result = await reconcileTask(task.id, supabase);
    reconcileResults.push(result);
    notifications.push(...result.notifications);
  }

  if (notifications.length > 0) {
    await getNotifier().send(notifications);
  }

  return Response.json({
    ok: true,
    volunteer_id: id,
    status: 'approved',
    tasks_reconciled: tasksToReconcile.length,
    new_assignments: reconcileResults.reduce((sum, r) => sum + r.filled, 0),
  });
}
