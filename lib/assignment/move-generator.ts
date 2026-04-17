import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type SB = SupabaseClient<Database>;

interface AvailabilityWindow {
  start: string;
  end: string;
}

export interface CandidateMove {
  id: number;
  type: 'reassign' | 'partial_match' | 'time_shift';
  description: string;
  volunteer_id?: string;
  volunteer_name?: string;
  source_task_id?: string;
  source_task_name?: string;
  new_slot_start?: string;
  new_slot_end?: string;
  impact: string;
  skill_gap?: string[];
}

const MAX_MOVES = 8;

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

function normSkills(skills: string[] | null | undefined): string[] {
  return (skills ?? []).map((s) => s.toLowerCase());
}

function hasAtLeastOneRequired(volSkills: string[], required: string[]): boolean {
  if (required.length === 0) return true;
  const vs = new Set(volSkills);
  return required.some((r) => vs.has(r));
}

function hasAllRequired(volSkills: string[], required: string[]): boolean {
  if (required.length === 0) return true;
  const vs = new Set(volSkills);
  return required.every((r) => vs.has(r));
}

function missingSkills(volSkills: string[], required: string[]): string[] {
  if (required.length === 0) return [];
  const vs = new Set(volSkills);
  return required.filter((r) => !vs.has(r));
}

export async function generateMovePool(taskId: string, supabase: SB): Promise<CandidateMove[]> {
  const moves: CandidateMove[] = [];

  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .select('id, name, slot_start, slot_end, volunteers_needed, skills_required')
    .eq('id', taskId)
    .single();

  if (taskErr || !task) return [];

  const required = normSkills(task.skills_required ?? []);

  const { data: targetAssignments } = await supabase
    .from('assignments')
    .select('volunteer_id, status')
    .eq('task_id', taskId);

  const ta = targetAssignments ?? [];
  const assignedCount = ta.filter((a) => a.status === 'assigned').length;
  const gap = task.volunteers_needed - assignedCount;
  if (gap <= 0) return [];

  const excludedOnTarget = new Set(
    ta.filter((a) => a.status === 'assigned' || a.status === 'dropped' || a.status === 'waitlist').map((a) => a.volunteer_id)
  );

  const { data: allAssignedRows } = await supabase
    .from('assignments')
    .select(
      'volunteer_id, task_id, status, tasks:task_id(id, name, slot_start, slot_end, volunteers_needed)'
    )
    .eq('status', 'assigned');

  const assignmentsByVolunteer = new Map<
    string,
    Array<{ task_id: string; slot_start: string; slot_end: string; volunteers_needed: number; name: string }>
  >();

  for (const row of allAssignedRows ?? []) {
    const t = row.tasks as
      | { id: string; name: string; slot_start: string; slot_end: string; volunteers_needed: number }
      | null;
    if (!t || row.task_id === taskId) continue;
    const list = assignmentsByVolunteer.get(row.volunteer_id) ?? [];
    list.push({
      task_id: row.task_id,
      slot_start: t.slot_start,
      slot_end: t.slot_end,
      volunteers_needed: t.volunteers_needed,
      name: t.name,
    });
    assignmentsByVolunteer.set(row.volunteer_id, list);
  }

  const { data: volunteers } = await supabase
    .from('volunteers')
    .select('id, profile_id, skills, status, availability, profiles:profile_id(full_name)')
    .eq('status', 'approved');

  const volById = new Map(
    (volunteers ?? []).map((v) => {
      const prof = v.profiles as { full_name: string | null } | { full_name: string | null }[] | null;
      const name = Array.isArray(prof) ? prof[0]?.full_name : prof?.full_name;
      return [v.id, { ...v, display_name: name ?? 'Volunteer' }] as const;
    })
  );

  const countAssignedOnTask = async (tid: string): Promise<number> => {
    const { count } = await supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', tid)
      .eq('status', 'assigned');
    return count ?? 0;
  };

  // --- Strategy 1: reassign from overlapping other tasks ---
  for (const row of allAssignedRows ?? []) {
    if (moves.length >= MAX_MOVES) break;
    if (row.task_id === taskId) continue;
    const st = row.tasks as
      | { id: string; name: string; slot_start: string; slot_end: string; volunteers_needed: number }
      | null;
    if (!st || row.status !== 'assigned') continue;

    if (
      !slotsOverlap(task.slot_start, task.slot_end, st.slot_start, st.slot_end)
    ) {
      continue;
    }

    const vol = volById.get(row.volunteer_id);
    if (!vol) continue;
    const vSkills = normSkills(vol.skills);
    if (!hasAtLeastOneRequired(vSkills, required)) continue;

    const sourceAssigned = await countAssignedOnTask(st.id);
    const sourceNeed = st.volunteers_needed;
    if (sourceAssigned - 1 < sourceNeed) continue;

    const otherSlots = (assignmentsByVolunteer.get(row.volunteer_id) ?? []).filter(
      (o) => o.task_id !== st.id
    );
    const conflictsTarget = otherSlots.some((o) =>
      slotsOverlap(task.slot_start, task.slot_end, o.slot_start, o.slot_end)
    );
    if (conflictsTarget) continue;

    moves.push({
      id: moves.length,
      type: 'reassign',
      description: `Move ${vol.display_name} from "${st.name}" to "${task.name}" (overlapping shift).`,
      volunteer_id: vol.id,
      volunteer_name: vol.display_name,
      source_task_id: st.id,
      source_task_name: st.name,
      impact: `Frees one slot on "${st.name}" (still meets staffing). Adds coverage on "${task.name}".`,
    });
  }

  const claimedVolunteers = new Set(
    moves.map((m) => m.volunteer_id).filter((id): id is string => Boolean(id))
  );

  // --- Strategy 2: partial skill match ---
  for (const v of volunteers ?? []) {
    if (moves.length >= MAX_MOVES) break;
    if (required.length === 0) break;

    const vol = volById.get(v.id);
    if (!vol) continue;
    if (claimedVolunteers.has(v.id)) continue;
    if (excludedOnTarget.has(v.id)) continue;

    const availability = (v.availability as unknown as AvailabilityWindow[]) ?? [];
    if (!slotFitsAvailability(task.slot_start, task.slot_end, availability)) continue;

    const vSkills = normSkills(v.skills);
    if (hasAllRequired(vSkills, required)) continue;
    if (!hasAtLeastOneRequired(vSkills, required)) continue;

    const others = assignmentsByVolunteer.get(v.id) ?? [];
    const conflict = others.some((o) =>
      slotsOverlap(task.slot_start, task.slot_end, o.slot_start, o.slot_end)
    );
    if (conflict) continue;

    const gapSkills = missingSkills(vSkills, required);
    claimedVolunteers.add(v.id);
    moves.push({
      id: moves.length,
      type: 'partial_match',
      description: `Assign ${vol.display_name} despite missing: ${gapSkills.join(', ')}.`,
      volunteer_id: v.id,
      volunteer_name: vol.display_name,
      impact: `Fills a seat quickly; coordinator accepts skill gap risk for: ${gapSkills.join(', ')}.`,
      skill_gap: gapSkills,
    });
  }

  // --- Strategy 3: time shift ±60m ---
  const shifts: { label: string; start: string; end: string }[] = [];
  const dur =
    new Date(task.slot_end).getTime() - new Date(task.slot_start).getTime();
  const startMs = new Date(task.slot_start).getTime();
  const endMs = new Date(task.slot_end).getTime();

  shifts.push({
    label: '60 min earlier',
    start: new Date(startMs - 60 * 60 * 1000).toISOString(),
    end: new Date(endMs - 60 * 60 * 1000).toISOString(),
  });
  shifts.push({
    label: '60 min later',
    start: new Date(startMs + 60 * 60 * 1000).toISOString(),
    end: new Date(endMs + 60 * 60 * 1000).toISOString(),
  });

  for (const sh of shifts) {
    if (moves.length >= MAX_MOVES) break;

    let extra = 0;
    for (const v of volunteers ?? []) {
      if (excludedOnTarget.has(v.id)) continue;
      const availability = (v.availability as unknown as AvailabilityWindow[]) ?? [];
      const fitOld = slotFitsAvailability(task.slot_start, task.slot_end, availability);
      const fitNew = slotFitsAvailability(sh.start, sh.end, availability);
      if (fitNew && !fitOld) {
        const vSkills = normSkills(v.skills);
        if (!hasAtLeastOneRequired(vSkills, required)) continue;
        const others = assignmentsByVolunteer.get(v.id) ?? [];
        const conflict = others.some((o) =>
          slotsOverlap(sh.start, sh.end, o.slot_start, o.slot_end)
        );
        if (!conflict) extra++;
      }
    }

    if (extra > 0) {
      moves.push({
        id: moves.length,
        type: 'time_shift',
        description: `Shift "${task.name}" ${sh.label} to align more volunteer availability windows.`,
        new_slot_start: sh.start,
        new_slot_end: sh.end,
        impact: `~${extra} additional volunteer(s) could cover the slot; confirm venue timing is flexible.`,
      });
    }
  }

  return moves.slice(0, MAX_MOVES).map((m, i) => ({ ...m, id: i }));
}
