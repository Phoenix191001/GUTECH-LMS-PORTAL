# LMS Backend (Supabase)

Postgres schema, Row Level Security, storage policies, quiz engine and ops scripts for the Internal LMS.
The Next.js app in `../Frontend` talks to this project through `@supabase/ssr`; all server actions live there.

## Layout

```
supabase/
  config.toml                      local CLI config (sign-ups disabled)
  migrations/
    0001_schema.sql                tables, enums, indexes, RLS switched on
    0002_rls.sql                   helpers, policies, column grants, integrity triggers
    0003_features.sql              unread tracking, grade audit, gradebook view, rate limits, realtime
    0004_storage.sql               private buckets + storage policies
    0005_quiz_functions.sql        server-clock quiz engine (hides is_correct, scores atomically)
    0006_course_people.sql         People tab: teacher + classmates without e-mail leaks
    0007_quiz_builder.sql          atomic reorder/duplicate/copy + results helpers (security invoker)
    0008_chat_realtime_fix.sql     lets Realtime filter chat UPDATEs by course_id (trigger keeps other columns immutable)
  templates/recovery.html          password-reset e-mail template (token_hash flow)
  tests/rls_smoke.sql              permission checks, run after seeding
scripts/
  bootstrap-admin.mjs              creates the first admin
  seed.mjs                         1 admin, 2 teachers, 5 students, 2 courses (dev only)
```

## Setup (one time)

1. Create a Supabase project. In **Authentication -> Providers -> Email** turn **off** "Allow new users to sign up".
2. Copy `.env.example` to `.env` and fill `SUPABASE_URL`, `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   (Project Settings -> API). The service-role key is server-only: never put it in `NEXT_PUBLIC_*`.
3. Apply the migrations, in order:
   - `npm run migrate` (uses `DATABASE_URL` from `.env`; safe to re-run, applied files are skipped), or
   - CLI: `supabase link --project-ref <ref>` then `supabase db push`, or
   - paste each file from `supabase/migrations/` into the SQL editor, 0001 -> 0008.
4. `npm install`, then `npm run bootstrap-admin` (creates the first admin from `ADMIN_*`).
5. Optional dev data: `npm run seed`, then run `supabase/tests/rls_smoke.sql` in the SQL editor.
6. **Authentication -> URL Configuration**: set Site URL and add `<site>/auth/confirm` to the redirect allow list.
7. **Authentication -> Email Templates -> Reset Password**: paste `supabase/templates/recovery.html`.
8. Configure a custom SMTP provider (the default sender is heavily rate limited).
9. **Database -> Replication**: confirm `chat_messages` and `announcements` are in the `supabase_realtime` publication
   (migration 0003 does this automatically).
10. Enable nightly backups (Project Settings -> Database).
11. Generate types for the frontend: `supabase gen types typescript --project-id <ref> > ../Frontend/src/types/database.ts`.

## Design notes

- **RLS everywhere.** Every table has RLS enabled in the migration that creates it. The `anon` role has no table access.
- **Server clock only.** Assignment deadlines (`submissions_guard`) and quiz timers (`attempt_deadline`) use `now()` in Postgres.
- **Quiz answers never leak.** Students cannot select `quiz_questions`/`quiz_options`. They call
  `get_attempt_questions` (no `is_correct`) and `get_attempt_review` (only after the quiz closes).
- **Column privileges** narrow `profiles` updates to `full_name`/`avatar_url` and chat updates to `deleted_at`.
- **No email leaks.** Classmates are exposed through `profile_directory` (name, avatar, roll no.), never `profiles`.
- **Auth-gate RPCs** (`login_locked`, `record_login_failure`, `reset_email_allowed`) are executable by the service role only,
  so nobody can use the public anon key to probe which e-mails exist.
- **Users are never deleted**, only `is_active = false`, so marks and chat history survive.
- `profile_directory` is a definer-rights view on purpose (it filters by `auth.uid()` itself).
  Supabase's linter will flag it; that is expected.
