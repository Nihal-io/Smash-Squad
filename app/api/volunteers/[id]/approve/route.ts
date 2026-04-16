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

  const volunteerSkills = (volunteer.skills ?? []).map((s: string) =>
    s.toLowerCase()
  );

  const { data: candidateTasks } = await supabase
    .from('tasks')
    .select('id, skills_required, volunteers_needed');

  const tasksToReconcile: string[] = [];
  if (candidateTasks) {
    for (const t of candidateTasks) {
      const required = (t.skills_required ?? []).map((s: string) =>
        s.toLowerCase()
      );
      const overlap =
        required.length === 0 ||
        required.some((s: string) => volunteerSkills.includes(s));
      if (!overlap) continue;

      const { count } = await supabase
        .from('assignments')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', t.id)
        .eq('status', 'assigned');

      if ((count ?? 0) < t.volunteers_needed) {
        tasksToReconcile.push(t.id);
      }
    }
  }

  const reconcileResults = [];
  for (const taskId of tasksToReconcile) {
    const result = await reconcileTask(taskId, supabase);
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
