-- Run these in the Supabase SQL Editor (Dashboard → SQL).
-- Order matters: create table and policies before adding to publication.

-- ---------------------------------------------------------------------------
-- 1) Realtime: assignments + notifications (required for live UI updates)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.assignments;
alter publication supabase_realtime add table public.notifications;

-- If a table was already added, you may see an error — safe to ignore.

-- ---------------------------------------------------------------------------
-- 2) Notifications table (if not created yet)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  subject text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_read_idx
  on public.notifications (recipient_id, read);

alter table public.notifications enable row level security;

-- Optional policies (tighten "users read own" in production):
-- drop policy if exists "users read own" on public.notifications;
-- drop policy if exists "service insert" on public.notifications;

create policy "users read own"
  on public.notifications
  for select
  using (true);

create policy "service insert"
  on public.notifications
  for insert
  with check (true);

-- Mark-as-read from the app (authenticated user = profile id):
create policy "users update own read flag"
  on public.notifications
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- For production, replace the select policy with:
-- using (recipient_id = auth.uid());
-- Inserts should be service-role only; remove broad insert policy and rely on service role.
