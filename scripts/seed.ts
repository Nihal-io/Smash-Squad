import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanAll() {
  console.log('🧹 Cleaning existing data...');
  // Delete in order respecting FKs (assignments → tasks/volunteers → events → profiles)
  await supabase.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('volunteers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✅ Clean');
}

// Helper to generate dates relative to today
function daysFromNow(days: number, hour: number, minute: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// Full day availability for a given day offset
function dayAvailability(dayOffset: number): { start: string; end: string } {
  return {
    start: daysFromNow(dayOffset, 7), // 7am
    end: daysFromNow(dayOffset, 22), // 10pm
  };
}

async function seed() {
  console.log('🌱 Seeding FestFlow demo data...\n');

  // ── Profiles ──

  const profileRows = [
    { id: crypto.randomUUID(), full_name: 'Coordinator Admin', email: 'coord@festflow.dev', role: 'coordinator', phone: '+91-9876500000' },
    { id: crypto.randomUUID(), full_name: 'Priya Shah', email: 'priya@festflow.dev', role: 'volunteer', phone: '+91-9876500001' },
    { id: crypto.randomUUID(), full_name: 'Arjun Rao', email: 'arjun@festflow.dev', role: 'volunteer', phone: '+91-9876500002' },
    { id: crypto.randomUUID(), full_name: 'Meera Iyer', email: 'meera@festflow.dev', role: 'volunteer', phone: '+91-9876500003' },
    { id: crypto.randomUUID(), full_name: 'Rohit Kumar', email: 'rohit@festflow.dev', role: 'volunteer', phone: '+91-9876500004' },
    { id: crypto.randomUUID(), full_name: 'Sneha Das', email: 'sneha@festflow.dev', role: 'volunteer', phone: '+91-9876500005' },
    { id: crypto.randomUUID(), full_name: 'Vikram Patel', email: 'vikram@festflow.dev', role: 'volunteer', phone: '+91-9876500006' },
    { id: crypto.randomUUID(), full_name: 'Ananya Reddy', email: 'ananya@festflow.dev', role: 'volunteer', phone: '+91-9876500007' },
    { id: crypto.randomUUID(), full_name: 'Karthik Nair', email: 'karthik@festflow.dev', role: 'volunteer', phone: '+91-9876500008' },
    { id: crypto.randomUUID(), full_name: 'Deepa Menon', email: 'deepa@festflow.dev', role: 'volunteer', phone: '+91-9876500009' },
    { id: crypto.randomUUID(), full_name: 'Rahul Sharma', email: 'rahul@festflow.dev', role: 'volunteer', phone: '+91-9876500010' },
  ];

  const { error: profErr } = await supabase.from('profiles').insert(profileRows);
  if (profErr) {
    console.error('Profile insert failed:', profErr.message);
    return;
  }
  console.log(`👤 ${profileRows.length} profiles created`);

  // ── Volunteers ──
  // 8 approved, 2 pending (Deepa and Rahul) for demo of approve/reject flow

  const volunteerRows = [
    { profile_id: profileRows[1].id, skills: ['electrical', 'logistics'], availability: [dayAvailability(1), dayAvailability(2)], status: 'approved' },
    { profile_id: profileRows[2].id, skills: ['electrical', 'tech'], availability: [dayAvailability(1), dayAvailability(2)], status: 'approved' },
    { profile_id: profileRows[3].id, skills: ['logistics', 'photography'], availability: [dayAvailability(1), dayAvailability(2)], status: 'approved' },
    { profile_id: profileRows[4].id, skills: ['hospitality', 'registration'], availability: [dayAvailability(1)], status: 'approved' },
    { profile_id: profileRows[5].id, skills: ['electrical', 'logistics', 'photography'], availability: [dayAvailability(1), dayAvailability(2)], status: 'approved' },
    { profile_id: profileRows[6].id, skills: ['tech', 'logistics'], availability: [dayAvailability(1), dayAvailability(2)], status: 'approved' },
    { profile_id: profileRows[7].id, skills: ['hospitality', 'first-aid'], availability: [dayAvailability(1), dayAvailability(2)], status: 'approved' },
    { profile_id: profileRows[8].id, skills: ['tech', 'photography', 'electrical'], availability: [dayAvailability(1), dayAvailability(2)], status: 'approved' },
    { profile_id: profileRows[9].id, skills: ['logistics', 'hospitality', 'registration'], availability: [dayAvailability(1), dayAvailability(2)], status: 'pending' },
    { profile_id: profileRows[10].id, skills: ['electrical', 'tech', 'first-aid'], availability: [dayAvailability(1), dayAvailability(2)], status: 'pending' },
  ];

  const { data: volunteers, error: volErr } = await supabase
    .from('volunteers')
    .insert(volunteerRows)
    .select('id, profile_id');

  if (volErr || !volunteers) {
    console.error('Volunteer insert failed:', volErr?.message);
    return;
  }
  console.log(`🙋 ${volunteers.length} volunteers created (8 approved, 2 pending)`);

  // ── Event ──

  const { data: event, error: evErr } = await supabase
    .from('events')
    .insert({
      name: 'TechFest 2026',
      starts_at: daysFromNow(1, 8),
      ends_at: daysFromNow(2, 22),
      created_by: profileRows[0].id,
    })
    .select('id')
    .single();

  if (evErr || !event) {
    console.error('Event insert failed:', evErr?.message);
    return;
  }
  console.log(`🎪 Event created: TechFest 2026`);

  // ── Tasks ──
  // 4 tasks with different skill requirements and staffing targets
  // Spread across tomorrow (day+1) to showcase calendar

  const taskRows = [
    {
      event_id: event.id,
      name: 'Stage Setup',
      slot_start: daysFromNow(1, 9),
      slot_end: daysFromNow(1, 11),
      volunteers_needed: 3,
      skills_required: ['electrical', 'logistics'],
      created_by: profileRows[0].id,
    },
    {
      event_id: event.id,
      name: 'Registration Desk',
      slot_start: daysFromNow(1, 10),
      slot_end: daysFromNow(1, 14),
      volunteers_needed: 2,
      skills_required: ['hospitality', 'registration'],
      created_by: profileRows[0].id,
    },
    {
      event_id: event.id,
      name: 'Tech Workshop Setup',
      slot_start: daysFromNow(1, 13),
      slot_end: daysFromNow(1, 15),
      volunteers_needed: 2,
      skills_required: ['tech'],
      created_by: profileRows[0].id,
    },
    {
      event_id: event.id,
      name: 'Photography Coverage',
      slot_start: daysFromNow(1, 9),
      slot_end: daysFromNow(1, 18),
      volunteers_needed: 2,
      skills_required: ['photography'],
      created_by: profileRows[0].id,
    },
  ];

  const { data: tasks, error: taskErr } = await supabase
    .from('tasks')
    .insert(taskRows)
    .select('id, name, volunteers_needed');

  if (taskErr || !tasks) {
    console.error('Task insert failed:', taskErr?.message);
    return;
  }
  console.log(`📋 ${tasks.length} tasks created\n`);

  // ── Run the engine on each task ──

  // We can't import the Next.js engine directly in a standalone script,
  // so we do manual assignment logic here that mirrors the engine.

  const volMap = new Map(volunteers.map((v) => [v.profile_id, v.id]));
  const profileMap = new Map(profileRows.map((p) => [p.id, p]));

  // Skill matching helper
  function getApprovedWithSkills(requiredSkills: string[], excludeIds: Set<string>): string[] {
    return volunteerRows
      .filter((vr) => {
        if (vr.status !== 'approved') return false;
        const vid = volMap.get(vr.profile_id);
        if (!vid || excludeIds.has(vid)) return false;
        const vSkills = vr.skills.map((s) => s.toLowerCase());
        const rSkills = requiredSkills.map((s) => s.toLowerCase());
        return rSkills.some((rs) => vSkills.includes(rs));
      })
      .map((vr) => volMap.get(vr.profile_id)!)
      .filter(Boolean);
  }

  const globalAssigned = new Set<string>(); // track overlapping slots

  for (const task of tasks) {
    const taskDef = taskRows.find((t) => t.name === task.name)!;
    const eligible = getApprovedWithSkills(taskDef.skills_required, new Set());

    // Don't assign same volunteer to overlapping time slots
    const available = eligible.filter((vid) => !globalAssigned.has(`${vid}:${taskDef.slot_start}`));

    const toAssign = available.slice(0, task.volunteers_needed);
    const toWaitlist = available.slice(task.volunteers_needed, task.volunteers_needed + 3);

    if (toAssign.length > 0) {
      const assignRows = toAssign.map((vid) => ({
        task_id: task.id,
        volunteer_id: vid,
        status: 'assigned' as const,
      }));
      await supabase.from('assignments').insert(assignRows);
    }

    if (toWaitlist.length > 0) {
      const waitlistRows = toWaitlist.map((vid) => ({
        task_id: task.id,
        volunteer_id: vid,
        status: 'waitlist' as const,
      }));
      await supabase.from('assignments').insert(waitlistRows);
    }

    // Track assigned volunteers
    toAssign.forEach((vid) => globalAssigned.add(`${vid}:${taskDef.slot_start}`));

    const names = toAssign.map((vid) => {
      const vol = volunteers.find((v) => v.id === vid);
      if (!vol) return '?';
      const prof = profileMap.get(vol.profile_id);
      return prof?.full_name ?? '?';
    });

    console.log(`  ${task.name}: ${toAssign.length}/${task.volunteers_needed} assigned [${names.join(', ')}], ${toWaitlist.length} waitlisted`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\nDemo-ready state:');
  console.log('  • 1 coordinator (coord@festflow.dev)');
  console.log('  • 8 approved volunteers with varied skills');
  console.log('  • 2 pending volunteers (Deepa, Rahul) — ready for approve/reject demo');
  console.log('  • 4 tasks with assignments and waitlists');
  console.log('  • Calendar dots should show green/yellow/red across tomorrow');
  console.log('\nRun: npm run dev → http://localhost:3000');
}

async function main() {
  try {
    await cleanAll();
    await seed();
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

main();
