import type {
  VolunteerForScoring,
  TaskForScoring,
  ScoreBreakdown,
  ScoredVolunteer,
} from './types';

// Scoring weights — tuned so skill match dominates, approval is a floor,
// and load spreads assignments across the volunteer pool.
const SKILL_WEIGHT = 10;
const APPROVED_BONUS = 5;
const LOAD_PENALTY_PER_TASK = 2;

export function scoreVolunteer(
  volunteer: VolunteerForScoring,
  task: TaskForScoring
): ScoreBreakdown {
  const volunteerSkills = new Set(volunteer.skills.map((s) => s.toLowerCase()));
  const requiredSkills = task.skills_required.map((s) => s.toLowerCase());

  const skillOverlapCount = requiredSkills.filter((s) => volunteerSkills.has(s))
    .length;

  const skillMatchBonus = skillOverlapCount * SKILL_WEIGHT;
  const approvedBonus = volunteer.status === 'approved' ? APPROVED_BONUS : 0;
  const loadPenalty = volunteer.active_assignment_count * LOAD_PENALTY_PER_TASK;

  const total = skillMatchBonus + approvedBonus - loadPenalty;

  return {
    total,
    skill_overlap_count: skillOverlapCount,
    skill_match_bonus: skillMatchBonus,
    approved_bonus: approvedBonus,
    load_penalty: loadPenalty,
  };
}

export function rankVolunteers(
  volunteers: VolunteerForScoring[],
  task: TaskForScoring
): ScoredVolunteer[] {
  return volunteers
    .map((volunteer) => {
      const breakdown = scoreVolunteer(volunteer, task);
      return { volunteer, score: breakdown.total, breakdown };
    })
    .sort((a, b) => b.score - a.score);
}
