# FestFlow — Demo Guide

## Setup before demo

Run 10 minutes before demo:

```bash
# 1. Reset database (Supabase dashboard → SQL editor):
# truncate profiles, volunteers, tasks, assignments, events cascade;

# 2. Seed demo data
npm run seed

# 3. Start dev server
npm run dev

# 4. Open two browser windows:
#    Window A (incognito): http://localhost:3000 — Coordinator view
#    Window B (incognito): http://localhost:3000/volunteer/register — registration

# 5. Have terminal visible so judges see console notifications fire
```

## The 3-minute demo script

### Minute 1: problem + volunteer registration (45 seconds)

**Say:** "College fest volunteer coordination happens over WhatsApp. Volunteers drop out last minute, coordinators firefight instead of running events. FestFlow replaces that with a system where an agent matches volunteers to tasks and reshuffles when things change."

**Show:**
1. Window B: fill volunteer registration
2. Submit → toast appears
3. Window A: `/coordinator/volunteers` → refresh → new pending volunteer
4. Click Approve → terminal shows approval notification

### Minute 2: natural language task creation (75 seconds)

**Say:** "The coordinator doesn't fill forms. They speak intent. The LLM translates that into a structured operation; the engine handles assignment."

**Show:**
1. Navigate to `/coordinator/tasks`
2. Command bar: type **"need 3 people for stage setup tomorrow 2-4pm, must know electrical work"**
3. Preview card shows parsed intent
4. Click Confirm → toast "Task created, 3 volunteers assigned"
5. Task appears in table; switch to calendar tab, show it there too
6. Terminal: 3 assignment notifications fired
7. Expand task row → show assigned volunteers with one-sentence AI explanation

**Say:** "The engine picks deterministically — solved optimization problem. The LLM explains the decision in human terms."

### Minute 3: the dropout scenario (60 seconds)

**Say:** "Here's where most systems fall over. Someone drops out."

**Show:**
1. Click drop on an assigned volunteer
2. Within a second: waitlisted volunteer promoted to assigned
3. Terminal: TWO notifications fired
4. UI updates without page reload

**Say:** "No human decided who replaces the dropout. The engine re-ran matching, picked the best waitlist candidate, notified both. That's the agent: observe state change, decide, act."

**Optional if Option D shipped:**
1. Create task requiring rare skill
2. Resolution panel with trade-off options
3. Show one option

### Closer (15 seconds)

**Say:** "Three things made this work in 36 hours. The LLM only produces intents, never writes to the database. New features are additive — new role is one line in the permissions matrix, new notification channel is one interface implementation. The engine is the single authority for assignments, so state stays consistent."

## Talking points for Q&A

### "Where's the AI?"
Three places. Command parser (language → action). Explanation layer (scoring → rationale). Conflict resolver (move pool → ranked options). Deliberately kept out of the matching loop — that's a solved optimization problem where LLMs would be slower and less reliable.

### "Why not email?"
Swap away — ConsoleNotifier becomes ResendNotifier in one line. Skipped because Resend needs domain verification; the interesting architecture is the pipeline.

### "How does it scale?"
Engine is SQL + scoring, scales with DB. LLM calls happen on intent (rare) and explanation (batched). A 500-volunteer fest: one LLM call per task creation, handful of SQL queries.

### "What if the LLM fails?"
Every LLM call has a deterministic fallback. Command parser failure → manual form. Explanation failure → templated sentence. Resolver failure → raw move pool.

### "Why not Airtable?"
Can store data. Can't run a reassignment engine, parse natural language, generate explanations. Value is the logic, not storage.

### "What's next?"
[Show TODO.md Future Features section]

## Backup plan

- **WiFi dies:** pre-recorded screen capture on laptop
- **LLM times out:** 5-second timeout, falls back to manual form
- **Supabase down:** local Supabase on port 54321 as backup
- **Dev server crashes:** second terminal with `npm run dev` ready

## Don't demo
- Login page (intentionally minimal)
- Admin dashboard (stub)
- Anything not fully working

## Known issues to acknowledge if asked
- No email yet (intentional, console shown)
- Auth minimal (intentional, prioritized core logic)
- Single-event assumption (schema change deferred)
- No real-time cross-window updates (would need Supabase Realtime)
