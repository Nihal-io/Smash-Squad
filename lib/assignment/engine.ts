import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { rankVolunteers } from './matcher';
import type { VolunteerForScoring, TaskForScoring } from './types';
import {
  assignmentNotification,
  dropoutReassignmentNotification,
  type TemplateVolunteer,
  type TemplateTask,
} from '@/lib/notifications/templates';
import type { Notification } from '@/lib/notifications/types';

// How many extra volunteers to keep on waitlist beyond the strict gap.
// Waitlist depth means dropouts get instant refills without a requery.
const WAITLIST_BUFFER = 3;

export interface ReconcileResult {
  task_id: string;
  filled: number;       // how many new 'assigned' rows were created this run
  waitlisted: number;   // how many new 'waitlist' rows were created
  already_assigned: number; // pre-existing assigned count
  still_short: number;  // gap that couldn't be filled (needed - total assigned)
  notifications: Notification[];
  skipped_reason?: string; // if the engine bailed out
}

interface AvailabilityWindow {
  start: string;
  end: string;
}

function slotFitsAvailability(
  taskStart: string,
  taskEnd: string,
  availability: AvailabilityWindow[]
): boolean {
  const ts = new Date(taskStart).getTime();
  const te = new Date(taskEnd).getTime();
  return availability.some((w) => {
    const ws = new Date(w.start).getTime();
    const we = new Date(w.end).getTime();
    return ws <= ts && we >= te;
  });
}

function slotsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && bs < ae;
}

type SB = SupabaseClient<Database>;

export async function reconcileTask(
  taskId: string,
  supabase: SB,
  options?: { isDropoutRefill?: boolean }
): Promise<ReconcileResult> {
  const isDropoutRefill = options?.isDropoutRefill ?? false;

  // 1. Fetch task
  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .select('id, name, slot_start, slot_end, volunteers_needed, skills_required')
    .eq('id', taskId)
    .single();

  if (taskErr || !task) {
    return {
      task_id: taskId,
      filled: 0,
      waitlisted: 0,
      already_assigned: 0,
      still_short: 0,
      notifications: [],
      skipped_reason: `task not found: ${taskErr?.message ?? 'unknown'}`,
    };
  }

  // 2. Fetch existing assignments for this task
  const { data: existingAssignments, error: exErr } = await supabase
    .from('assignments')
    .select('volunteer_id, status')
    .eq('task_id', taskId);

  if (exErr) {
    return {
      task_id: taskId,
      filled: 0,
      waitlisted: 0,
      already_assigned: 0,
      still_short: 0,
      notifications: [],
      skipped_reason: `failed to fetch assignments: ${exErr.message}`,
    };
  }

  const existing = existingAssignments ?? [];
  const alreadyAssignedIds = new Set(
    existing.filter((a) => a.status === 'assigned').map((a) => a.volunteer_id)
  );
  const alreadyWaitlistedIds = new Set(
    existing.filter((a) => a.status === 'waitlist').map((a) => a.volunteer_id)
  );
  // Exclude volunteers already assigned or previously dropped from this task.
// Waitlisted volunteers ARE eligible — they're candidates for promotion.
const excludedIds = new Set(
  existing
    .filter((a) => a.status === 'assigned' || a.status === 'dropped')
    .map((a) => a.volunteer_id)
);

  const alreadyAssignedCount = alreadyAssignedIds.size;
  const gap = task.volunteers_needed - alreadyAssignedCount;

  if (gap <= 0) {
    return {
      task_id: taskId,
      filled: 0,
      waitlisted: 0,
      already_assigned: alreadyAssignedCount,
      still_short: 0,
      notifications: [],
      skipped_reason: 'task already fully staffed',
    };
  }

  // 3. Fetch approved volunteers with their profiles
  const { data: approvedVolunteers, error: vErr } = await supabase
    .from('volunteers')
    .select(
      'id, profile_id, skills, status, availability, profiles:profile_id(full_name, email)'
    )
    .eq('status', 'approved');

  if (vErr || !approvedVolunteers) {
    return {
      task_id: taskId,
      filled: 0,
      waitlisted: 0,
      already_assigned: alreadyAssignedCount,
      still_short: gap,
      notifications: [],
      skipped_reason: `failed to fetch volunteers: ${vErr?.message ?? 'unknown'}`,
    };
  }

  // 4. Fetch all 'assigned' rows across the system to compute overlap + load
  const { data: allActiveAssignments, error: aaErr } = await supabase
    .from('assignments')
    .select('volunteer_id, task_id, status, tasks:task_id(slot_start, slot_end)')
    .eq('status', 'assigned');

  if (aaErr) {
    return {
      task_id: taskId,
      filled: 0,
      waitlisted: 0,
      already_assigned: alreadyAssignedCount,
      still_short: gap,
      notifications: [],
      skipped_reason: `failed to fetch active assignments: ${aaErr.message}`,
    };
  }

  const assignmentsByVolunteer = new Map<
    string,
    Array<{ task_id: string; slot_start: string; slot_end: string }>
>();
  for (const a of allActiveAssignments ?? []) {
    const slotInfo = a.tasks as { slot_start: string; slot_end: string } | null;
    if (!slotInfo) continue;
    const list = assignmentsByVolunteer.get(a.volunteer_id) ?? [];
    list.push({
      task_id: a.task_id,
      slot_start: slotInfo.slot_start,
      slot_end: slotInfo.slot_end,
    });
    assignmentsByVolunteer.set(a.volunteer_id, list);
  }

  // 5. Filter volunteers: not already on this task, availability fits, no overlap
  const eligibleForScoring: Array<{
    scoring: VolunteerForScoring;
    profile: { full_name: string; email: string };
  }> = [];

  for (const v of approvedVolunteers) {
    if (excludedIds.has(v.id)) continue; // already assigned/dropped/waitlisted here

    const availability = (v.availability as unknown as AvailabilityWindow[]) ?? [];
    if (!slotFitsAvailability(task.slot_start, task.slot_end, availability)) {
      continue;
    }

    const conflicts = (assignmentsByVolunteer.get(v.id) ?? []).some((other) =>
      slotsOverlap(
        task.slot_start,
        task.slot_end,
        other.slot_start,
        other.slot_end
      )
    );
    if (conflicts) continue;

    const profile = v.profiles as { full_name: string; email: string } | null;
    if (!profile) continue;

    eligibleForScoring.push({
      scoring: {
        id: v.id,
        profile_id: v.profile_id,
        skills: v.skills ?? [],
        status: 'approved',
        active_assignment_count: (assignmentsByVolunteer.get(v.id) ?? []).length,
      },
      profile: { full_name: profile.full_name, email: profile.email },
    });
  }

  // 6. Score and rank
  const scoringInput: TaskForScoring = {
    id: task.id,
    name: task.name,
    slot_start: task.slot_start,
    slot_end: task.slot_end,
    skills_required: task.skills_required ?? [],
  };

  const ranked = rankVolunteers(
    eligibleForScoring.map((e) => e.scoring),
    scoringInput
  );

  const profileById = new Map(
    eligibleForScoring.map((e) => [e.scoring.id, e.profile])
  );

  // 7. Promote existing waitlist first (if this is a dropout refill)
  const waitlistIds = existing
    .filter((a) => a.status === 'waitlist')
    .map((a) => a.volunteer_id);

  const waitlistedInRanked = ranked.filter((r) =>
    waitlistIds.includes(r.volunteer.id)
  );
  const freshCandidates = ranked.filter(
    (r) => !waitlistIds.includes(r.volunteer.id)
  );

  const toAssign = [...waitlistedInRanked, ...freshCandidates].slice(0, gap);
  const toWaitlist = freshCandidates
    .filter((r) => !toAssign.some((a) => a.volunteer.id === r.volunteer.id))
    .slice(0, WAITLIST_BUFFER);

  const notifications: Notification[] = [];

  // 8a. Promote waitlist rows for volunteers being assigned who were waitlisted
  const promotingFromWaitlist = toAssign.filter((a) =>
    alreadyWaitlistedIds.has(a.volunteer.id)
  );

  for (const r of promotingFromWaitlist) {
    const { error: updErr } = await supabase
      .from('assignments')
      .update({ status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('task_id', taskId)
      .eq('volunteer_id', r.volunteer.id);

    if (updErr) continue;

    const profile = profileById.get(r.volunteer.id);
    if (!profile) continue;

    const templateVolunteer: TemplateVolunteer = {
      full_name: profile.full_name,
      email: profile.email,
    };
    const templateTask: TemplateTask = {
      name: task.name,
      slot_start: task.slot_start,
      slot_end: task.slot_end,
      skills_required: task.skills_required ?? [],
    };

    notifications.push(
      dropoutReassignmentNotification(templateVolunteer, templateTask)
    );
  }

  // 8b. Insert new 'assigned' rows for volunteers not previously on this task
  const toInsertAssigned = toAssign.filter(
    (a) => !alreadyWaitlistedIds.has(a.volunteer.id)
  );

  if (toInsertAssigned.length > 0) {
    const rows = toInsertAssigned.map((r) => ({
      task_id: taskId,
      volunteer_id: r.volunteer.id,
      status: 'assigned' as const,
    }));
    const { error: insErr } = await supabase.from('assignments').insert(rows);
    if (!insErr) {
      for (const r of toInsertAssigned) {
        const profile = profileById.get(r.volunteer.id);
        if (!profile) continue;
        const templateVolunteer: TemplateVolunteer = {
          full_name: profile.full_name,
          email: profile.email,
        };
        const templateTask: TemplateTask = {
          name: task.name,
          slot_start: task.slot_start,
          slot_end: task.slot_end,
          skills_required: task.skills_required ?? [],
        };
        notifications.push(
          isDropoutRefill
            ? dropoutReassignmentNotification(templateVolunteer, templateTask)
            : assignmentNotification(templateVolunteer, templateTask)
        );
      }
    }
  }

  // 9. Insert waitlist rows
  if (toWaitlist.length > 0) {
    const rows = toWaitlist.map((r) => ({
      task_id: taskId,
      volunteer_id: r.volunteer.id,
      status: 'waitlist' as const,
    }));
    await supabase.from('assignments').insert(rows);
  }

  const totalAssignedNow = alreadyAssignedCount + toAssign.length;
  const stillShort = Math.max(0, task.volunteers_needed - totalAssignedNow);

  return {
    task_id: taskId,
    filled: toAssign.length,
    waitlisted: toWaitlist.length,
    already_assigned: alreadyAssignedCount,
    still_short: stillShort,
    notifications,
  };
}
