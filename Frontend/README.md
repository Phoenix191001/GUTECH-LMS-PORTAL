# Lumen LMS: Frontend

Next.js 16 (App Router) + TypeScript (strict) + Tailwind v4 + Supabase (`@supabase/ssr`).
Server Components by default; Server Actions for every mutation. The database lives in `../Backend`.

## Run it

```bash
cd Frontend
npm install                 # .npmrc sets legacy-peer-deps (an optional peer of @hookform/resolvers)
# put your Supabase values in .env.local (see below)
npm run dev                 # http://localhost:3000
npm run typecheck && npm test && npm run build
```

`.env.local` (already created with placeholders; `.env.example` documents it):

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only.** Admin user creation + login/reset rate-limit gates |
| `NEXT_PUBLIC_SITE_URL` | used in reset-password links; add it and `/auth/confirm` to the Supabase redirect allow list |

Until real values are set, every page redirects to `/login`, which shows a setup banner.

## Architecture

```
src/
  proxy.ts                    session refresh + route protection (Next 16 name for middleware.ts)
  app/(auth)/                 login, forgot-password, reset-password
  app/(app)/                  authenticated shell: dashboard, courses/[courseId]/{resources,assignments,quizzes,
                              announcements,chat,marks,people}, announcements, complaints, profile, admin/*
  app/auth/confirm            recovery-link handler (verifyOtp)
  features/<feature>/         schemas.ts (zod, shared client+server) · actions.ts ('use server') · queries.ts · components/
  lib/actions.ts              authedAction(): auth + role re-check + zod parse + logging -> { ok, data | error }
  lib/supabase/               client.ts · server.ts · admin.ts (service role, server-only) · middleware.ts
  components/ui, shared       design system primitives and shared widgets
```

Principles: RLS is the source of truth and every action re-checks the role; the server clock decides
deadlines and quiz timers; files are private and served by 60-minute signed URLs; dates are stored in UTC
and shown in the viewer's time zone; every list has loading, empty and error states.

## Design

"Ember & Ink": warm ivory paper, deep ink-navy chrome and a single terracotta-ember accent, a serif display face
for headings over the system sans stack, light/dark themes (OS default + manual toggle in the user menu and
Profile). Mobile first: 360 px minimum, bottom navigation + drawer on phones, tables become stacked cards,
16 px inputs (no iOS zoom), safe-area padding, 44 px touch targets, `prefers-reduced-motion` respected.

## Tests

`npm test` runs Vitest unit tests for the zod schemas (password policy, quiz, complaint flow), gradebook
rules, quiz publish validation and state, chat grouping/linkify. Scoring itself runs in Postgres
(`finalize_attempt`) and is covered by `../Backend/supabase/tests`. Playwright end-to-end tests need a live
Supabase project and are not included yet.

## Deviations from the spec (deliberate)

- `middleware.ts` is `proxy.ts` (Next.js 16 rename).
- Added `/announcements` (combined feed) so the sidebar's unread badge has a destination.
- Quiz questions are reordered with up/down buttons (accessible, no extra library) instead of drag and drop.
- Questions of a quiz that has any attempts are locked even after unpublishing (use "Create a copy"): safer for fair marking.
- Gradebook PDF export (optional in the spec) is not built; CSV is.
