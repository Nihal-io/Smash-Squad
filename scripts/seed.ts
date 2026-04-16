import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = 'festflow123';

function daysFromNow(days: number, hour: number, minute: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dayAvailability(dayOffset: number) {
  return { start: daysFromNow(dayOffset, 7), end: daysFromNow(dayOffset, 22) };
}

interface SeedUser {
  full_name: string;
  email: string;
  role: string;
  phone: string;
}

const USERS: SeedUser[] = [
  { full_name: 'Coordinator Admin', email: 'coord@festflow.dev', role: 'coordinator', phone: '+91-9876500000' },
  { full_name: 'Priya Shah', email: 'priya@festflow.dev', role: 'volunteer', phone: '+91-9876500001' },
  { full_name: 'Arjun Rao', email: 'arjun@festflow.dev', role: 'volunteer', phone: '+91-9876500002' },
  { full_name: 'Meera Iyer', email: 'meera@festflow.dev', role: 'volunteer', phone: '+91-9876500003' },
  { full_name: 'Rohit Kumar', email: 'rohit@festflow.dev', role: 'volunteer', phone: '+91-9876500004' },
  { full_name: 'Sneha Das', email: 'sneha@festflow.dev', role: 'volunteer', phone: '+91-9876500005' },
  { full_name: 'Vikram Patel', email: 'vikram@festflow.dev', role: 'volunteer', phone: '+91-9876500006' },
  { full_name: 'Ananya Reddy', email: 'ananya@festflow.dev', role: 'volunteer', phone: '+91-9876500007' },
  { full_name: 'Karthik Nair', email: 'karthik@festflow.dev', role: 'volunteer', phone: '+91-9876500008' },
  { full_name: 'Deepa Menon', email: 'deepa@festflow.dev', role: 'volunteer', phone: '+91-9876500009' },
  { full_name: 'Rahul Sharma', email: 'rahul@festflow.dev', role: 'volunteer', phone: '+91-9876500010' },
];

const VOLUNTEER_DATA = [
  { email: 'priya@festflow.dev', skills: ['electrical', 'logistics'], status: 'approved' },
  { email: 'arjun@festflow.dev', skills: ['electrical', 'tech'], status: 'approved' },
  { email: 'meera@festflow.dev', skills: ['logistics', 'photography'], status: 'approved' },
  { email: 'rohit@festflow.dev', skills: ['hospitality', 'registration'], status: 'approved' },
  { email: 'sneha@festflow.dev', skills: ['electrical', 'logistics', 'photography'], status: 'approved' },
  { email: 'vikram@festflow.dev', skills: ['tech', 'logistics'], status: 'approved' },
  { email: 'ananya@festflow.dev', skills: ['hospitality', 'first-aid'], status: 'approved' },
  { email: 'karthik@festflow.dev', skills: ['tech', 'photography', 'electrical'], status: 'approved' },
  { email: 'deepa@festflow.dev', skills: ['logistics', 'hospitality', 'registration'], status: 'pending' },
  { email: 'rahul@festflow.dev', skills: ['electrical', 'tech', 'first-aid'], status: 'pending' },
];

async function cleanAll() {
  console.log('🧹 Cleaning...');
  await supabase.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('volunteers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Delete existing auth users
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  for (const u of existingUsers?.users ?? []) {
    await supabase.auth.admin.deleteUser(u.id);
  }
  console.log('✅ Clean');
}

async function seed() {
  console.log('🌱 Seeding FestFlow...\n');

  // Create auth users + profiles
  const profileIds = new Map<string, string>(); // email → user id

  for (const user of USERS) {
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: user.email,
      password: SEED_PASSWORD,
      email_confirm: true, // skip email verification
    });

    if (authErr || !authUser.user) {
      console.error(`Failed to create auth user ${user.email}:`, authErr?.message);
      continue;
    }

    const userId = authUser.user.id;
    profileIds.set(user.email, userId);

    const { error: profErr } = await supabase.from('profiles').insert({
      id: userId,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    });

    if (profErr) {
      console.error(`Profile insert failed for ${user.email}:`, profErr.message);
    }
  }
  console.log(`👤 ${profileIds.size} users created`);

  // Create volunteers
  const volunteerInserts = VOLUNTEER_DATA.map((v) => ({
    profile_id: profileIds.get(v.email)!,
    skills: v.skills,
    availability: [dayAvailability(1), dayAvailability(2)],
    status: v.status,
  })).filter((v) => v.profile_id);

  const { data: volunteers, error: volErr } = await supabase
    .from('volunteers')
    .insert(volunteerInserts)
    .select('id, profile_id');

  if (volErr || !volunteers) {
    console.error('Volunteer insert failed:', volErr?.message);
    return;
  }
  console.log(`🙋 ${volunteers.length} volunteers (8 approved, 2 pending)`);

  // Create event
  const coordId = profileIds.get('coord@festflow.dev')!;
  const { data: event, error: evErr } = await supabase
    .from('events')
    .insert({
      name: 'TechFest 2026',
      starts_at: daysFromNow(1, 8),
      ends_at: daysFromNow(2, 22),
      created_by: coordId,
    })
    .select('id')
    .single();

  if (evErr || !event) {
    console.error('Event failed:', evErr?.message);
    return;
  }
  console.log('🎪 TechFest 2026 created');

  // Create tasks
  const taskRows = [
    { event_id: event.id, name: 'Stage Setup', slot_start: daysFromNow(1, 9), slot_end: daysFromNow(1, 11), volunteers_needed: 3, skills_required: ['electrical', 'logistics'], created_by: coordId },
    { event_id: event.id, name: 'Registration Desk', slot_start: daysFromNow(1, 10), slot_end: daysFromNow(1, 14), volunteers_needed: 2, skills_required: ['hospitality', 'registration'], created_by: coordId },
    { event_id: event.id, name: 'Tech Workshop Setup', slot_start: daysFromNow(1, 13), slot_end: daysFromNow(1, 15), volunteers_needed: 2, skills_required: ['tech'], created_by: coordId },
    { event_id: event.id, name: 'Photography Coverage', slot_start: daysFromNow(1, 9), slot_end: daysFromNow(1, 18), volunteers_needed: 2, skills_required: ['photography'], created_by: coordId },
  ];

  const { data: tasks, error: taskErr } = await supabase
    .from('tasks')
    .insert(taskRows)
    .select('id, name, volunteers_needed');

  if (taskErr || !tasks) {
    console.error('Task failed:', taskErr?.message);
    return;
  }
  console.log(`📋 ${tasks.length} tasks\n`);

  // Assign volunteers (simplified engine)
  const volMap = new Map(volunteers.map((v) => [v.profile_id, v.id]));

  for (const task of tasks) {
    const taskDef = taskRows.find((t) => t.name === task.name)!;
    const eligible = volunteerInserts
      .filter((v) => {
        if (v.status !== 'approved') return false;
        const vSkills = v.skills.map((s) => s.toLowerCase());
        return taskDef.skills_required.some((r) => vSkills.includes(r.toLowerCase()));
      })
      .map((v) => volMap.get(v.profile_id)!)
      .filter(Boolean);

    const toAssign = eligible.slice(0, task.volunteers_needed);
    const toWaitlist = eligible.slice(task.volunteers_needed, task.volunteers_needed + 3);

    if (toAssign.length > 0) {
      await supabase.from('assignments').insert(
        toAssign.map((vid) => ({ task_id: task.id, volunteer_id: vid, status: 'assigned' as const }))
      );
    }
    if (toWaitlist.length > 0) {
      await supabase.from('assignments').insert(
        toWaitlist.map((vid) => ({ task_id: task.id, volunteer_id: vid, status: 'waitlist' as const }))
      );
    }

    console.log(`  ${task.name}: ${toAssign.length}/${task.volunteers_needed} assigned, ${toWaitlist.length} waitlisted`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Login credentials (password: festflow123):');
  console.log('   Coordinator: coord@festflow.dev');
  console.log('   Volunteer:   priya@festflow.dev');
  console.log('   Pending:     deepa@festflow.dev / rahul@festflow.dev');
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
