-- profiles extends auth.users with app-level metadata
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  email text unique not null,
  role text not null check (role in ('admin','coordinator','volunteer','participant')) default 'volunteer',
  phone text,
  created_at timestamptz default now()
);

-- volunteer-specific data
create table volunteers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  skills text[] default '{}',
  availability jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  notes text,
  created_at timestamptz default now(),
  unique(profile_id)
);

-- parent container for tasks (future multi-event support)
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- what coordinators post
create table tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  name text not null,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  volunteers_needed int not null check (volunteers_needed > 0),
  skills_required text[] default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- the many-to-many with state
create table assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  status text not null default 'assigned'
    check (status in ('assigned','dropped','completed','waitlist')),
  assigned_at timestamptz default now(),
  dropped_at timestamptz,
  dropped_by uuid references profiles(id),
  drop_reason text,
  unique(task_id, volunteer_id)
);

create index on assignments(task_id, status);
create index on assignments(volunteer_id, status);
create index on tasks(slot_start, slot_end);
create index on volunteers(status);
