import { requireRole } from '@/lib/rbac/guard';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(request, 'tasks.view');
  if (guard) return guard;

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, status, assigned_at, volunteers:volunteer_id(skills, profiles:profile_id(full_name))'
    )
    .eq('task_id', id)
    .order('status', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const assignments = (data ?? []).map((a) => {
    const vol = Array.isArray(a.volunteers) ? a.volunteers[0] : a.volunteers;
    const profile = vol && (Array.isArray(vol.profiles) ? vol.profiles[0] : vol.profiles);
    return {
      id: a.id,
      status: a.status,
      assigned_at: a.assigned_at,
      volunteer_name: profile?.full_name ?? 'Unknown',
      volunteer_skills: vol?.skills ?? [],
    };
  });

  return Response.json({ ok: true, assignments });
}
