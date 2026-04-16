import { requireRole } from '@/lib/rbac/guard';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const guard = await requireRole(request, 'volunteers.viewAll');
  if (guard) return guard;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('volunteers')
    .select(
      'id, profile_id, status, skills, availability, profiles:profile_id(full_name, email)'
    )
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, volunteers: data });
}
