# FestFlow — Build TODO

36-hour hackathon build. Work through commits in order. Tick boxes as you go and include the tick in the same commit that completes the work.

## Status
- **Current commit:** C3 (database schema migration)
- **Started:** [fill in when you start]
- **Deadline:** [start + 36 hours]

## Phase 0 — Foundation (hours 0–2)
- [x] **C1** `chore: scaffold next.js app with core deps`
- [x] **C2** `chore: set up folder structure and permissions matrix`

## Phase 1 — Database & types (hours 2–4)
- [X] **C3** `feat(db): initial schema migration`
  - Run 001_init.sql in Supabase dashboard
  - Verify tables in Supabase dashboard
- [X] **C4** `feat(db): RLS policies (permissive dev mode)`
  - Run 002_rls.sql in Supabase dashboard
- [x] **C5** `feat: typed database + supabase clients`
  - Generate types via `supabase gen types`
  - Implement three clients: browser, server, middleware
  - Wire root middleware.ts

## Phase 2 — RBAC & dev mode (hours 4–6)
- [x] **C6** `feat(rbac): role guard helper`
  - Implement guard.ts with requireRole()
- [x] **C7** `feat(dev): role switcher for pre-auth development`
  - useDevRole() hook (localStorage)
  - getRoleServer() reading x-dev-role header
  - Floating RoleSwitcher component (dev only)

## Phase 3 — Notifications (hours 6–7)
- [x] **C8** `feat(notifications): notification templates`
  - Template builder functions (pure)

## Phase 4 — Agent core (hours 7–11)
- [x] **C9** `feat(engine): volunteer scoring function`
  - scoreVolunteer() pure function
  - Types in types.ts
- [ ] **C10** `feat(engine): reconcileTask reassignment engine`
  - Full flow, returns notifications

## Phase 5 — API routes (hours 11–16)
- [ ] **C11** `feat(api): volunteer registration and approval routes`
- [ ] **C12** `feat(api): task CRUD and assignment routes`
- [ ] **C12.5** `feat(ai): provider-agnostic LLM client implementation`
  - Implement provider matching env key
  - Hello-world test

## Phase 6 — Volunteer UI (hours 16–18)
- [ ] **C13** `feat(ui): volunteer registration form`

## Phase 7 — Coordinator UI (hours 18–24)
- [ ] **C14** `feat(ui): dashboard layout with role-gated sidebar`
- [ ] **C15** `feat(ui): volunteer list with approval actions`
- [ ] **C16a** `feat(ui): task table with create dialog`
- [ ] **C16b** `feat(ui): calendar view for tasks`
  - react-big-calendar, week view, color-coded
- [ ] **C16.5** `feat(ai): natural language command parser`
- [ ] **C16.6** `feat(ui): coordinator command bar`
- [ ] **C17** `feat(ui): manual drop and visual status feedback`
- [ ] **C17.5** `feat(ai): reassignment explanation layer`

## Phase 8 — Polish & stubs (hours 24–28)
- [ ] **C18** `feat: stub routes for deferred features`
- [ ] **C19** `feat(dev): seed script`

## Phase 9 — AI reach goal (hours 28–32, HARD TIMEBOX)
⚠️ If not working cleanly by hour 31, `git revert` and move on.
- [ ] **C18.5** `feat(ai): move pool generator`
- [ ] **C18.6** `feat(ai): LLM conflict resolver + UI`

## Phase 10 — Real auth (hours 32–35)
- [ ] **C20** `feat(auth): supabase auth integration`

## Phase 11 — Ship it (hours 35–36)
- [ ] **C21** `docs: readme and demo script`

---

# Future features (post-hackathon)

Deliberately deferred. Architecture supports them.

## Admin role expansion
- [ ] Admin dashboard with system-wide stats
- [ ] Event CRUD
- [ ] Bulk approve/reject volunteers
- [ ] Scrutiny panel for document verification
- [ ] User management (role promotion)

## Participant flow
- [ ] Participant registration for events
- [ ] Passes page with QR codes
- [ ] My registrations view
- [ ] Certificate generation + download

## Attendance
- [ ] QR code generation
- [ ] QR scanner page
- [ ] Manual attendance table
- [ ] Attendance stats charts

## Analytics
- [ ] Registrations over time
- [ ] Category breakdown
- [ ] Attendance rate
- [ ] AI insights panel

## Post-event AI summary
- [ ] Feedback form after event
- [ ] LLM narrative report
- [ ] PDF export

## Email integration
- [ ] Verify domain with Resend
- [ ] react-email templates
- [ ] Email preference settings

## Venue management
- [ ] Venues table + venue_id FK
- [ ] Engine constraint: no double-booking
- [ ] Venues tab

## Timeline view
- [ ] Horizontal swim-lane per venue

## Engine improvements
- [ ] LLM-based scoring
- [ ] Preference matching
- [ ] Skill tiers
- [ ] History-based reliability

## Notifications v2
- [ ] In-app notification bell
- [ ] User preferences
- [ ] Digest mode
