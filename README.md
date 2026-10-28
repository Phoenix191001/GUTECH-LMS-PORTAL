# GUTECH Portal

A student/faculty portal: courses, resources, assignments, quizzes, marks, announcements, realtime course chat and
complaints, with three roles (admin, teacher, student). Closed system: accounts are created by an administrator.

| Layer | Technology |
| --- | --- |
| Frontend | React 19 via Next.js 16 (App Router), TypeScript, Tailwind v4 |
| Backend | Node.js: Next.js Server Actions / route handlers + Node ops scripts (`Backend/scripts`) |
| Database + Auth + Storage + Realtime | Supabase (Postgres, Row Level Security, private buckets) |
| Deployment | Vercel (Frontend) + Supabase cloud |

## Repository layout

| Folder | What it is |
| --- | --- |
| `Frontend/` | Next.js app: UI, server actions, Supabase clients. See `Frontend/README.md` |
| `Backend/` | Supabase SQL migrations (schema, RLS, storage, quiz engine), seed + admin scripts, DB tests. See `Backend/README.md` |

## Features (CRUD end to end)

- **Auth**: email/password login, password reset by e-mail, role-based route protection, login rate limiting.
- **Users** (admin): create, edit, deactivate, bulk CSV import, reset password.
- **Courses** (admin): create/edit, enrol teachers and students.
- **Resources, assignments, quizzes** (teacher): create/edit/delete; students submit, take timed quizzes (server clock).
- **Marks**: gradebook with CSV export.
- **Announcements, complaints, course chat** (realtime).

## Environment setup

1. Create a Supabase project. **Authentication -> Providers -> Email**: turn off "Allow new users to sign up".
2. `Backend/.env` (copy `Backend/.env.example`):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `SUPABASE_PROJECT_ID`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
3. `Frontend/.env.local` (copy `Frontend/.env.example`):

   | Variable | Notes |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | **server only**, never expose to the browser |
   | `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally, the Vercel URL in production |

4. In Supabase **Authentication -> URL Configuration**: set Site URL and add `<site>/auth/confirm` to the redirect allow list.
   Paste `Backend/supabase/templates/recovery.html` as the Reset Password email template.

Never commit `.env` files.

## Run locally

```bash
cd Backend && npm install
npm run migrate            # applies migrations 0001..0008 (safe to re-run)
npm run bootstrap-admin    # first admin from ADMIN_* values
npm run seed               # optional demo data (1 admin, 2 teachers, 5 students, 2 courses)

cd ../Frontend && npm install
npm run dev                # http://localhost:3000
npm run typecheck && npm test && npm run build
```

## Deploy (Vercel + Supabase)

1. Push this repo to GitHub (public).
2. Vercel -> New Project -> import the repo, set **Root Directory** to `Frontend`.
3. Add the four `Frontend/.env.local` variables as Vercel environment variables, with `NEXT_PUBLIC_SITE_URL` set to the production URL.
4. Deploy, then add `<production-url>` and `<production-url>/auth/confirm` to Supabase's redirect allow list.

## Architecture notes

- RLS on every table; the `anon` role has no table access; quiz answers never reach students (server-side scoring).
- Deadlines and quiz timers use the Postgres clock, not the client's.
- Every mutation is a Server Action wrapped by `authedAction()` (auth + role re-check + zod validation).

## AI-assisted workflow

Built with Claude Code from `Internal LMS AI Build Spec (Next.js + Supabase).pdf`: schema and RLS first, then the
feature slices, then a design pass ("Prism" theme).
