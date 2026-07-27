

# FestFlow

AI-assisted volunteer coordination for college fests. Coordinators post tasks, an engine auto-assigns from an approved volunteer pool, and the system reshuffles automatically when someone drops out.

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS)
- Zod + react-hook-form
- react-big-calendar
- LLM (Claude / Gemini / OpenAI — runtime-selected)

## Setup

1. Install: `npm install`
2. Copy env: `cp .env.example .env.local` and fill in Supabase + one LLM key
3. Run migrations: paste SQL from `supabase/migrations/` into Supabase dashboard SQL editor
4. Generate types: `npx supabase gen types typescript --project-id <id> > types/database.ts`
5. Seed: `npm run seed`
6. Dev server: `npm run dev`

## Modularity swap points
- **Notifications**: edit `lib/notifications/index.ts` to swap ConsoleNotifier for Resend
- **LLM provider**: set a different env key, no code change
- **Permissions**: add entries to `lib/rbac/permissions.ts`, everything else filters automatically
- **Scoring**: edit `lib/assignment/matcher.ts` without touching the engine loop

## Build progress
See `TODO.md` for commit-by-commit plan. See `DEMO.md` for presentation script.

## Deferred features
See "Future features" section of `TODO.md`.
