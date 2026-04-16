export interface VolunteerForScoring {
  id: string;
  profile_id: string;
  skills: string[];
  status: 'pending' | 'approved' | 'rejected';
  active_assignment_count: number; // how many 'assigned' rows they currently have
}

export interface TaskForScoring {
  id: string;
  name: string;
  slot_start: string; // ISO 8601
  slot_end: string;
  skills_required: string[];
}

export interface ScoreBreakdown {
  total: number;
  skill_overlap_count: number;
  skill_match_bonus: number;  // skill_overlap_count * SKILL_WEIGHT
  approved_bonus: number;     // flat bonus for approved status
  load_penalty: number;       // negative: penalizes over-assigned volunteers
}

export interface ScoredVolunteer {
  volunteer: VolunteerForScoring;
  score: number;
  breakdown: ScoreBreakdown;
}
