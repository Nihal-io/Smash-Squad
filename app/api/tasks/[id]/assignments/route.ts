import { requireRole } from '@/lib/rbac/guard';
import { createClient } from '@/lib/supabase/server';
import { explainAssignment } from '@/lib/ai/explain-assignment';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(request, 'tasks.view');
  if (guard) return guard;

  const { id } = await params;
  const supabase = await createClient();

  // Fetch task for context
  const { data: task } = await supabase
    .from('tasks')
    .select('name, slot_start, slot_end, skills_required')
    .eq('id', id)
    .single();

  // Fetch assignments with volunteer details
  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, status, assigned_at, volunteers:volunteer_id(id, skills, profiles:profile_id(full_name))'
    )
    .eq('task_id', id)
    .order('status', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Count active assignments for load calculation
  const { data: allActive } = await supabase
    .from('assignments')
    .select('volunteer_id')
    .eq('status', 'assigned');

  const loadByVolunteer = new Map<string, number>();
  for (const a of allActive ?? []) {
    loadByVolunteer.set(a.volunteer_id, (loadByVolunteer.get(a.volunteer_id) ?? 0) + 1);
  }

  const wantExplanations = request.headers.get('x-want-explanations') !== 'false';

  const assignments = await Promise.all(
    (data ?? []).map(async (a) => {
      const vol = Array.isArray(a.volunteers) ? a.volunteers[0] : a.volunteers;
      const profile = vol && (Array.isArray(vol.profiles) ? vol.profiles[0] : vol.profiles);
      const volunteerName = profile?.full_name ?? 'Unknown';
      const volunteerSkills: string[] = vol?.skills ?? [];
      const volunteerId: string = vol?.id ?? '';

      let explanation: string | null = null;

      if (wantExplanations && task && a.status === 'assigned') {
        try {
          const taskSkills: string[] = task.skills_required ?? [];
          const skillOverlap = volunteerSkills.filter((s) =>
            taskSkills.map((r) => r.toLowerCase()).includes(s.toLowerCase())
          ).length;

          explanation = await explainAssignment({
            volunteer: {
              name: volunteerName,
              skills: volunteerSkills,
              activeAssignmentCount: loadByVolunteer.get(volunteerId) ?? 0,
            },
            task: {
              name: task.name,
              skillsRequired: taskSkills,
              slotStart: task.slot_start,
              slotEnd: task.slot_end,
            },
            scoringBreakdown: {
              skillOverlap,
              loadPenalty: (loadByVolunteer.get(volunteerId) ?? 0) * 2,
              totalScore: skillOverlap * 10 + 5 - (loadByVolunteer.get(volunteerId) ?? 0) * 2,
            },
            alternativesConsidered: (data?.length ?? 1) - 1,
          });
        } catch {
          // Silently skip — explanation is optional
        }
      }

      return {
        id: a.id,
        status: a.status,
        assigned_at: a.assigned_at,
        volunteer_name: volunteerName,
        volunteer_skills: volunteerSkills,
        explanation,
      };
    })
  );

  return Response.json({ ok: true, assignments });
}
