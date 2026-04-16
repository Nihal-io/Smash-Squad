import { rankVolunteers, scoreVolunteer } from '@/lib/assignment/matcher';
import type { VolunteerForScoring, TaskForScoring } from '@/lib/assignment/types';

export async function GET() {
  const task: TaskForScoring = {
    id: 't1',
    name: 'Stage Setup',
    slot_start: '2026-04-18T14:00:00+05:30',
    slot_end: '2026-04-18T16:00:00+05:30',
    skills_required: ['electrical', 'logistics'],
  };

  const volunteers: VolunteerForScoring[] = [
    {
      id: 'v1',
      profile_id: 'p1',
      skills: ['electrical', 'logistics', 'photography'],
      status: 'approved',
      active_assignment_count: 0,
    },
    {
      id: 'v2',
      profile_id: 'p2',
      skills: ['electrical'],
      status: 'approved',
      active_assignment_count: 1,
    },
    {
      id: 'v3',
      profile_id: 'p3',
      skills: ['hospitality'],
      status: 'approved',
      active_assignment_count: 0,
    },
    {
      id: 'v4',
      profile_id: 'p4',
      skills: ['electrical', 'logistics'],
      status: 'pending',
      active_assignment_count: 0,
    },
    {
      id: 'v5',
      profile_id: 'p5',
      skills: ['electrical', 'logistics'],
      status: 'approved',
      active_assignment_count: 3,
    },
  ];

  const ranked = rankVolunteers(volunteers, task);

  // Sanity expectations:
  // - v1 (both skills, approved, no load) should be top
  // - v5 (both skills, approved, heavy load) should beat v2 (one skill, approved, light load)
  // - v3 (no skill match, approved, no load) should be near bottom but above rejected cases
  // - v4 (both skills, pending) should score higher on skills but lose the approved bonus

  return Response.json({
    ranked: ranked.map((r) => ({
      id: r.volunteer.id,
      skills: r.volunteer.skills,
      status: r.volunteer.status,
      load: r.volunteer.active_assignment_count,
      score: r.score,
      breakdown: r.breakdown,
    })),
  });
}
