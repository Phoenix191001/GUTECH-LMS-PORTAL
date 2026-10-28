-- 0003_features.sql
-- Supporting tables (unread tracking, audit, rate limits), the gradebook view,
-- small RPC helpers and Realtime. Added after 0001/0002 as the spec requires
-- ("if a feature section needs another column, add it in a new migration").

-- ---------------------------------------------------------------------------
-- New tables (RLS enabled in this migration)
-- ---------------------------------------------------------------------------
create table announcement_reads (
    id uuid primary key default gen_random_uuid(),
    announcement_id uuid not null references announcements(id) on delete cascade,
    user_id uuid not null references profiles(id) on delete cascade,
    read_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (announcement_id, user_id)
);
create index on announcement_reads (user_id);
alter table announcement_reads enable row level security;
create policy announcement_reads_select on announcement_reads for select using (user_id = auth.uid());
create policy announcement_reads_insert on announcement_reads for insert with check (
    user_id = auth.uid()
    and exists (select 1 from announcements a where a.id = announcement_id));   -- visible to me (RLS)

create table chat_last_read (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references courses(id) on delete cascade,
    user_id uuid not null references profiles(id) on delete cascade,
    last_read_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (course_id, user_id)
);
alter table chat_last_read enable row level security;
create policy chat_last_read_own on chat_last_read for all
    using (user_id = auth.uid()) with check (user_id = auth.uid() and can_access_course(course_id));

create table grade_audit (
    id uuid primary key default gen_random_uuid(),
    submission_id uuid references submissions(id) on delete cascade,
    quiz_attempt_id uuid references quiz_attempts(id) on delete cascade,
    changed_by uuid references profiles(id),
    old_marks numeric(6,2),
    new_marks numeric(6,2),
    changed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    check (num_nonnulls(submission_id, quiz_attempt_id) = 1)
);
create index on grade_audit (submission_id);
create index on grade_audit (quiz_attempt_id);
alter table grade_audit enable row level security;
create policy grade_audit_read on grade_audit for select using (
    is_admin()
    or teaches_course(case when submission_id is not null
        then assignment_course((select assignment_id from submissions s where s.id = submission_id))
        else attempt_course(quiz_attempt_id) end));
revoke insert, update, delete on grade_audit from authenticated;   -- written by trigger only

-- Complaint notification dot: "has anything changed since I last looked?"
alter table complaints add column updated_at timestamptz not null default now();
create function complaints_touch() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
create trigger complaints_touch before update on complaints
    for each row execute function complaints_touch();

create table complaint_seen (
    user_id uuid primary key references profiles(id) on delete cascade,
    seen_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);
alter table complaint_seen enable row level security;
create policy complaint_seen_own on complaint_seen for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Rate limiting for the auth gates (login lockout, reset emails). Service role only.
create table auth_attempts (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    kind text not null check (kind in ('login_fail', 'reset')),
    created_at timestamptz not null default now()
);
create index on auth_attempts (email, kind, created_at desc);
alter table auth_attempts enable row level security;   -- no policies: nobody but service_role

-- ---------------------------------------------------------------------------
-- Grade audit trigger (spec Feature 7, requirement 8)
-- ---------------------------------------------------------------------------
create function audit_grade_change() returns trigger
    language plpgsql security definer set search_path = public as
$$
begin
    if tg_table_name = 'submissions' then
        if tg_op = 'INSERT' then
            if new.marks_obtained is not null then
                insert into grade_audit (submission_id, changed_by, old_marks, new_marks)
                values (new.id, auth.uid(), null, new.marks_obtained);
            end if;
        elsif new.marks_obtained is distinct from old.marks_obtained then
            insert into grade_audit (submission_id, changed_by, old_marks, new_marks)
            values (new.id, auth.uid(), old.marks_obtained, new.marks_obtained);
        end if;
    else
        -- auto-scoring (in_progress -> submitted/graded) is not a grading edit
        if new.score is distinct from old.score and old.status <> 'in_progress'
           and auth_role() in ('admin', 'teacher') then
            insert into grade_audit (quiz_attempt_id, changed_by, old_marks, new_marks)
            values (new.id, auth.uid(), old.score, new.score);
        end if;
    end if;
    return new;
end $$;

create trigger submissions_audit after insert or update on submissions
    for each row execute function audit_grade_change();
create trigger attempts_audit after update on quiz_attempts
    for each row execute function audit_grade_change();

-- ---------------------------------------------------------------------------
-- Gradebook (spec Section 4 + Feature 7 req. 6: best quiz attempt counts)
-- ---------------------------------------------------------------------------
create function quiz_max_marks(qid uuid) returns numeric
    language sql stable security definer set search_path = public as
$$ select coalesce(sum(marks), 0) from quiz_questions where quiz_id = qid $$;

create view gradebook with (security_invoker = true) as
    select s.student_id, a.course_id, 'assignment'::text as item_type, a.id as item_id,
           a.title, s.marks_obtained as marks, a.max_marks as max_marks, s.graded_at as recorded_at
    from submissions s join assignments a on a.id = s.assignment_id
    where s.marks_obtained is not null
    union all
    select qa.student_id, q.course_id, 'quiz'::text, q.id, q.title,
           max(qa.score), quiz_max_marks(q.id), max(qa.submitted_at)
    from quiz_attempts qa join quizzes q on q.id = qa.quiz_id
    where qa.status = 'graded'
    group by qa.student_id, q.course_id, q.id, q.title;
revoke all on gradebook from anon;
grant select on gradebook to authenticated;

-- ---------------------------------------------------------------------------
-- RPC helpers
-- ---------------------------------------------------------------------------
-- A user clears their own forced-password-change flag (after updateUser succeeds).
create function clear_must_change_password() returns void
    language sql security definer set search_path = public as
$$ update profiles set must_change_password = false where id = auth.uid() $$;

create function withdraw_complaint(p_id uuid) returns void
    language plpgsql security definer set search_path = public as
$$
begin
    update complaints set status = 'rejected', admin_response = 'Withdrawn by user'
    where id = p_id and submitted_by = auth.uid() and status = 'open';
    if not found then raise exception 'Only your own open complaints can be withdrawn.'; end if;
end $$;

create function mark_complaints_seen() returns void
    language sql security definer set search_path = public as
$$ insert into complaint_seen (user_id, seen_at) values (auth.uid(), now())
   on conflict (user_id) do update set seen_at = now() $$;

create function has_complaint_update() returns boolean
    language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from complaints c
     where c.submitted_by = auth.uid()
       and c.status <> 'open'
       and c.updated_at > coalesce((select seen_at from complaint_seen where user_id = auth.uid()), c.created_at)
   ) $$;

create function unread_announcement_count() returns int
    language sql stable set search_path = public as
$$ select count(*)::int from announcements a
   where not exists (select 1 from announcement_reads r where r.announcement_id = a.id and r.user_id = auth.uid()) $$;

create function unread_chat_counts() returns table (course_id uuid, unread bigint)
    language sql stable set search_path = public as
$$ select m.course_id, count(*)
   from chat_messages m
   where m.sender_id <> auth.uid() and m.deleted_at is null
     and m.created_at > coalesce(
           (select r.last_read_at from chat_last_read r where r.course_id = m.course_id and r.user_id = auth.uid()),
           now() - interval '7 days')
   group by m.course_id $$;

create function mark_chat_read(p_course uuid) returns void
    language plpgsql security definer set search_path = public as
$$
begin
    if not can_access_course(p_course) then raise exception 'Course not found.'; end if;
    insert into chat_last_read (course_id, user_id, last_read_at) values (p_course, auth.uid(), now())
    on conflict (course_id, user_id) do update set last_read_at = now();
end $$;

-- Course cards: pending assignments / open quizzes / enrolled count.
create function course_overview() returns table (
    course_id uuid, pending_assignments bigint, open_quizzes bigint, student_count bigint)
    language sql stable set search_path = public as
$$ select c.id,
     (select count(*) from assignments a
       where a.course_id = c.id and a.is_published and a.due_at > now()
         and (auth_role() <> 'student'
              or not exists (select 1 from submissions s where s.assignment_id = a.id and s.student_id = auth.uid()))),
     (select count(*) from quizzes q
       where q.course_id = c.id and q.is_published and now() between q.opens_at and q.closes_at),
     (select count(*) from enrollments e where e.course_id = c.id)
   from courses c $$;

-- Auth-gate rate limits. Callable by the service role only (never by anon: that
-- would let anyone probe which e-mails exist).
create function login_locked(p_email text) returns boolean
    language sql stable security definer set search_path = public as
$$ select count(*) >= 5 from auth_attempts
   where email = lower(p_email) and kind = 'login_fail' and created_at > now() - interval '10 minutes' $$;

create function record_login_failure(p_email text) returns void
    language plpgsql security definer set search_path = public as
$$
begin
    delete from auth_attempts where created_at < now() - interval '1 day';
    insert into auth_attempts (email, kind) values (lower(p_email), 'login_fail');
end $$;

create function clear_login_failures(p_email text) returns void
    language sql security definer set search_path = public as
$$ delete from auth_attempts where email = lower(p_email) and kind = 'login_fail' $$;

-- Returns true when a reset e-mail should actually be sent (account exists, is
-- active, and fewer than 3 requests in the last hour). Always records the request.
create function reset_email_allowed(p_email text) returns boolean
    language plpgsql security definer set search_path = public as
$$
declare recent int; ok boolean;
begin
    select count(*) into recent from auth_attempts
      where email = lower(p_email) and kind = 'reset' and created_at > now() - interval '1 hour';
    insert into auth_attempts (email, kind) values (lower(p_email), 'reset');
    select exists (select 1 from profiles where lower(email) = lower(p_email) and is_active) into ok;
    return ok and recent < 3;
end $$;

revoke execute on function login_locked(text), record_login_failure(text),
    clear_login_failures(text), reset_email_allowed(text) from public, anon, authenticated;
grant execute on function login_locked(text), record_login_failure(text),
    clear_login_failures(text), reset_email_allowed(text) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime (RLS applies to Realtime, so members only receive their own rows)
-- ---------------------------------------------------------------------------
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        alter publication supabase_realtime add table chat_messages;
        alter publication supabase_realtime add table announcements;
    end if;
end $$;
