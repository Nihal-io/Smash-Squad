-- Permissive RLS for dev. TODO(rls): tighten before production (Commit C20+).

alter table profiles enable row level security;
alter table volunteers enable row level security;
alter table events enable row level security;
alter table tasks enable row level security;
alter table assignments enable row level security;

create policy "dev_all_profiles" on profiles for all using (true) with check (true);
create policy "dev_all_volunteers" on volunteers for all using (true) with check (true);
create policy "dev_all_events" on events for all using (true) with check (true);
create policy "dev_all_tasks" on tasks for all using (true) with check (true);
create policy "dev_all_assignments" on assignments for all using (true) with check (true);
