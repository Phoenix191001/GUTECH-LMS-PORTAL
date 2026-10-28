
-- ===================== 0001_schema.sql =====================
-- 0001_schema.sql
-- Source of truth for the LMS data model (spec Section 4).
-- RLS is enabled in 0002_rls.sql; run the migrations in order.

-- ENUMS
create type user_role as enum ('admin','teacher','student');
create type resource_kind as enum ('file','link');
create type question_type as enum ('mcq_single','mcq_multi','true_false','short_answer');
create type attempt_status as enum ('in_progress','submitted','graded');
create type complaint_status as enum ('open','in_review','resolved','rejected');
create type complaint_category as enum ('academic','teacher','facility','technical','other');

-- PROFILES (1:1 with auth.users)
create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    email text not null unique,
    role user_role not null default 'student',
    roll_no text unique,                         -- students only
    avatar_url text,
    is_active boolean not null default true,
    must_change_password boolean not null default true,
    created_at timestamptz not null default now()
);

-- COURSES AND ENROLMENT (Feature 3)
create table courses (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,                   -- e.g. CS-101
    title text not null,
    description text,
    teacher_id uuid not null references profiles(id),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    check (code = upper(code))
);

create table enrollments (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references courses(id) on delete cascade,
    student_id uuid not null references profiles(id) on delete cascade,
    enrolled_at timestamptz not null default now(),
    unique (course_id, student_id)
);

-- RESOURCES (Feature 2)
create table resources (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references courses(id) on delete cascade,
    uploaded_by uuid not null references profiles(id),
    title text not null,
    description text,
    kind resource_kind not null default 'file',
    storage_path text,                           -- bucket 'resources'
    file_name text,
    file_size bigint,
    mime_type text,
    external_url text,
    created_at timestamptz not null default now(),
    check ((kind = 'file' and storage_path is not null) or (kind = 'link' and external_url is not null))
);

create table resource_views (
    id uuid primary key default gen_random_uuid(),
    resource_id uuid not null references resources(id) on delete cascade,
    student_id uuid not null references profiles(id) on delete cascade,
    seen_at timestamptz not null default now(),
    unique (resource_id, student_id)
);

-- ASSIGNMENTS (Feature 4)
create table assignments (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references courses(id) on delete cascade,
    created_by uuid not null references profiles(id),
    title text not null,
    instructions text,
    attachment_path text,                        -- optional, bucket 'resources'
    attachment_name text,
    due_at timestamptz not null,
    max_marks numeric(6,2) not null check (max_marks > 0),
    allow_late boolean not null default false,
    is_published boolean not null default false,
    created_at timestamptz not null default now()
);

create table submissions (
    id uuid primary key default gen_random_uuid(),
    assignment_id uuid not null references assignments(id) on delete cascade,
    student_id uuid not null references profiles(id) on delete cascade,
    text_answer text,
    file_path text,                              -- bucket 'submissions'
    file_name text,
    submitted_at timestamptz not null default now(),
    is_late boolean not null default false,
    marks_obtained numeric(6,2),
    feedback text,
    graded_by uuid references profiles(id),
    graded_at timestamptz,
    unique (assignment_id, student_id)
);

-- QUIZZES (Feature 5)
create table quizzes (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references courses(id) on delete cascade,
    created_by uuid not null references profiles(id),
    title text not null,
    description text,
    duration_minutes int not null check (duration_minutes > 0),
    opens_at timestamptz not null,
    closes_at timestamptz not null,
    max_attempts int not null default 1 check (max_attempts > 0),
    shuffle_questions boolean not null default false,
    show_answers_after_close boolean not null default true,
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    check (closes_at > opens_at)
);

create table quiz_questions (
    id uuid primary key default gen_random_uuid(),
    quiz_id uuid not null references quizzes(id) on delete cascade,
    position int not null,
    type question_type not null,
    prompt text not null,
    marks numeric(5,2) not null default 1 check (marks >= 0),
    unique (quiz_id, position) deferrable initially deferred
);

create table quiz_options (
    id uuid primary key default gen_random_uuid(),
    question_id uuid not null references quiz_questions(id) on delete cascade,
    position int not null,
    text text not null,
    is_correct boolean not null default false
);

create table quiz_attempts (
    id uuid primary key default gen_random_uuid(),
    quiz_id uuid not null references quizzes(id) on delete cascade,
    student_id uuid not null references profiles(id) on delete cascade,
    started_at timestamptz not null default now(),
    submitted_at timestamptz,
    status attempt_status not null default 'in_progress',
    score numeric(6,2)
);

create table quiz_answers (
    id uuid primary key default gen_random_uuid(),
    attempt_id uuid not null references quiz_attempts(id) on delete cascade,
    question_id uuid not null references quiz_questions(id) on delete cascade,
    selected_option_ids uuid[] not null default '{}',
    text_answer text,
    marks_awarded numeric(5,2),
    unique (attempt_id, question_id)
);

-- ANNOUNCEMENTS (Feature 6)
create table announcements (
    id uuid primary key default gen_random_uuid(),
    course_id uuid references courses(id) on delete cascade,   -- null = global (admin only)
    author_id uuid not null references profiles(id),
    title text not null check (char_length(title) between 1 and 120),
    body text not null check (char_length(body) between 1 and 5000),
    is_pinned boolean not null default false,
    created_at timestamptz not null default now()
);

-- CHAT (Feature 8)
create table chat_messages (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references courses(id) on delete cascade,
    sender_id uuid not null references profiles(id),
    body text not null check (char_length(body) between 1 and 2000),
    created_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- COMPLAINTS (Feature 9)
create table complaints (
    id uuid primary key default gen_random_uuid(),
    submitted_by uuid not null references profiles(id),
    course_id uuid references courses(id),
    category complaint_category not null,
    subject text not null check (char_length(subject) between 1 and 150),
    description text not null check (char_length(description) between 1 and 3000),
    status complaint_status not null default 'open',
    admin_response text,
    resolved_by uuid references profiles(id),
    resolved_at timestamptz,
    created_at timestamptz not null default now()
);

-- INDEXES
create index on courses (teacher_id);
create index on enrollments (student_id);
create index on resources (course_id, created_at desc);
create index on resource_views (student_id);
create index on assignments (course_id, due_at);
create index on submissions (student_id);
create index on quizzes (course_id, opens_at);
create index on quiz_questions (quiz_id, position);
create index on quiz_options (question_id, position);
create index on quiz_attempts (quiz_id, student_id);
create index on quiz_answers (question_id);
create index on announcements (course_id, created_at desc);
create index on chat_messages (course_id, created_at desc);
create index on complaints (submitted_by, status);
create index on complaints (status, created_at desc);

-- Never delete users; deactivate them instead (is_active = false).
-- The gradebook view is created in 0003_features.sql (needs quiz_max_marks()).

-- RLS is switched on here (same migration as the tables, spec rule 3).
-- Policies are written in 0002_rls.sql; until then every table denies all access.
alter table profiles enable row level security;
alter table courses enable row level security;
alter table enrollments enable row level security;
alter table resources enable row level security;
alter table resource_views enable row level security;
alter table assignments enable row level security;
alter table submissions enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_options enable row level security;
alter table quiz_attempts enable row level security;
alter table quiz_answers enable row level security;
alter table announcements enable row level security;
alter table chat_messages enable row level security;
alter table complaints enable row level security;

-- ===================== 0002_rls.sql =====================
-- 0002_rls.sql
-- Helpers, Row Level Security policies, column privileges and integrity triggers.
-- Matrix: spec Sections 3 and 5. Everything here is enforced by Postgres, not by the UI.
-- User-facing error messages are raised with the default SQLSTATE P0001 so the
-- application can show them as-is.

-- ---------------------------------------------------------------------------
-- Closed system: the anon role gets nothing by default.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------------
-- HELPERS (security definer so policies do not recurse)
-- ---------------------------------------------------------------------------
create function auth_role() returns user_role
    language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and is_active $$;

create function is_admin() returns boolean
    language sql stable security definer set search_path = public as
$$ select coalesce(auth_role() = 'admin', false) $$;

create function teaches_course(cid uuid) returns boolean
    language sql stable security definer set search_path = public as
$$ select auth_role() is not null
      and exists (select 1 from courses where id = cid and teacher_id = auth.uid() and is_active) $$;

create function enrolled_in(cid uuid) returns boolean
    language sql stable security definer set search_path = public as
$$ select auth_role() is not null
      and exists (select 1 from enrollments e join courses c on c.id = e.course_id
                  where e.course_id = cid and e.student_id = auth.uid() and c.is_active) $$;

create function can_access_course(cid uuid) returns boolean
    language sql stable security definer set search_path = public as
$$ select is_admin() or teaches_course(cid) or enrolled_in(cid) $$;

-- Parent lookups (avoid cross-table RLS recursion inside policies).
create function resource_course(rid uuid) returns uuid
    language sql stable security definer set search_path = public as
$$ select course_id from resources where id = rid $$;

create function assignment_course(aid uuid) returns uuid
    language sql stable security definer set search_path = public as
$$ select course_id from assignments where id = aid $$;

create function quiz_course(qid uuid) returns uuid
    language sql stable security definer set search_path = public as
$$ select course_id from quizzes where id = qid $$;

create function attempt_course(aid uuid) returns uuid
    language sql stable security definer set search_path = public as
$$ select qz.course_id from quiz_attempts a join quizzes qz on qz.id = a.quiz_id where a.id = aid $$;

create function attempt_student(aid uuid) returns uuid
    language sql stable security definer set search_path = public as
$$ select student_id from quiz_attempts where id = aid $$;

create function safe_uuid(v text) returns uuid
    language plpgsql immutable as
$$ begin return v::uuid; exception when others then return null; end $$;

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
create policy profiles_select on profiles for select using (
    id = auth.uid()
    or is_admin()
    or (auth_role() = 'teacher' and exists (
        select 1 from enrollments e join courses c on c.id = e.course_id
        where e.student_id = profiles.id and c.teacher_id = auth.uid()))
);
-- Users edit only their own row, and column privileges below narrow that to
-- full_name + avatar_url. Admin changes go through server actions (service role).
create policy profiles_update_own on profiles for update
    using (id = auth.uid() and is_active) with check (id = auth.uid());

revoke insert, delete on profiles from authenticated;
revoke update on profiles from authenticated;
grant update (full_name, avatar_url) on profiles to authenticated;

-- Safe directory: names, avatars, roll numbers of people you share a course with.
-- Never exposes email. Runs with the view owner's rights on purpose (see WHERE).
create function shares_course_with(pid uuid) returns boolean
    language sql stable security definer set search_path = public as
$$
select
  exists (
    select 1 from courses c
    where c.is_active
      and (c.teacher_id = auth.uid() or exists (
            select 1 from enrollments me where me.course_id = c.id and me.student_id = auth.uid()))
      and (c.teacher_id = pid or exists (
            select 1 from enrollments o where o.course_id = c.id and o.student_id = pid))
  )
  or (auth_role() = 'teacher' and (
        exists (select 1 from submissions s
                  join assignments a on a.id = s.assignment_id
                  join courses c on c.id = a.course_id
                where s.student_id = pid and c.teacher_id = auth.uid())
     or exists (select 1 from quiz_attempts qa
                  join quizzes q on q.id = qa.quiz_id
                  join courses c on c.id = q.course_id
                where qa.student_id = pid and c.teacher_id = auth.uid())
     or exists (select 1 from chat_messages m
                  join courses c on c.id = m.course_id
                where m.sender_id = pid and c.teacher_id = auth.uid())))
$$;

create view profile_directory as
    select id, full_name, avatar_url, role, roll_no, is_active
    from profiles
    where auth_role() is not null
      and (id = auth.uid() or is_admin() or role = 'admin' or shares_course_with(id));
revoke all on profile_directory from anon;
grant select on profile_directory to authenticated;

-- ---------------------------------------------------------------------------
-- COURSES + ENROLLMENTS
-- ---------------------------------------------------------------------------
create policy courses_select on courses for select
    using (is_admin() or teaches_course(id) or enrolled_in(id));
create policy courses_admin_write on courses for all
    using (is_admin()) with check (is_admin());

create policy enrollments_select on enrollments for select
    using (is_admin() or teaches_course(course_id)
           or (student_id = auth.uid() and enrolled_in(course_id)));
create policy enrollments_admin_write on enrollments for all
    using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- RESOURCES
-- ---------------------------------------------------------------------------
create policy resources_read on resources for select using (can_access_course(course_id));
create policy resources_write on resources for all
    using (is_admin() or teaches_course(course_id))
    with check (is_admin() or teaches_course(course_id));

-- Only students write views; one row per (resource, student).
create policy views_student_insert on resource_views for insert with check (
    student_id = auth.uid() and auth_role() = 'student'
    and enrolled_in(resource_course(resource_id)));
create policy views_read on resource_views for select using (
    student_id = auth.uid() or is_admin() or teaches_course(resource_course(resource_id)));

-- ---------------------------------------------------------------------------
-- ASSIGNMENTS + SUBMISSIONS
-- ---------------------------------------------------------------------------
create policy assignments_read on assignments for select using (
    is_admin() or teaches_course(course_id) or (enrolled_in(course_id) and is_published));
create policy assignments_write on assignments for all
    using (is_admin() or teaches_course(course_id))
    with check (is_admin() or teaches_course(course_id));

create policy submissions_read on submissions for select using (
    student_id = auth.uid() or is_admin() or teaches_course(assignment_course(assignment_id)));
create policy submissions_student_insert on submissions for insert with check (
    student_id = auth.uid() and auth_role() = 'student'
    and enrolled_in(assignment_course(assignment_id)));
create policy submissions_student_update on submissions for update
    using (student_id = auth.uid() and auth_role() = 'student' and graded_at is null)
    with check (student_id = auth.uid());
create policy submissions_staff_write on submissions for all
    using (is_admin() or teaches_course(assignment_course(assignment_id)))
    with check (is_admin() or teaches_course(assignment_course(assignment_id)));

-- Deadline, lateness, grading columns: decided by the server clock, never the client.
create function submissions_guard() returns trigger
    language plpgsql security definer set search_path = public as
$$
declare
    a assignments%rowtype;
    r user_role;
begin
    select * into a from assignments where id = new.assignment_id;
    if not found then raise exception 'Assignment not found.'; end if;

    if new.marks_obtained is not null and (new.marks_obtained < 0 or new.marks_obtained > a.max_marks) then
        raise exception 'Marks must be between 0 and %.', a.max_marks;
    end if;

    if auth.uid() is null then return new; end if;   -- service role / migrations
    r := auth_role();
    if r is null then raise exception 'Your account is disabled.'; end if;

    if r in ('admin', 'teacher') then
        if new.marks_obtained is not null and (tg_op = 'INSERT'
              or new.marks_obtained is distinct from old.marks_obtained
              or new.feedback is distinct from old.feedback) then
            new.graded_by := auth.uid();
            new.graded_at := now();
        end if;
        return new;
    end if;

    -- student
    if not a.is_published then raise exception 'Assignment not found.'; end if;
    if tg_op = 'UPDATE' and old.graded_at is not null then
        raise exception 'This submission has been graded and can no longer be changed.';
    end if;
    if new.marks_obtained is not null or new.feedback is not null
       or new.graded_by is not null or new.graded_at is not null then
        raise exception 'You cannot set marks or feedback.';
    end if;
    if now() > a.due_at and not a.allow_late then
        raise exception 'The deadline for this assignment has passed.';
    end if;
    if coalesce(btrim(new.text_answer), '') = '' and new.file_path is null then
        raise exception 'Add some text or a file before submitting.';
    end if;
    new.submitted_at := now();
    new.is_late := now() > a.due_at;
    return new;
end $$;

create trigger submissions_guard before insert or update on submissions
    for each row execute function submissions_guard();

-- ---------------------------------------------------------------------------
-- QUIZZES (students never read questions/options directly: see 0005)
-- ---------------------------------------------------------------------------
create policy quizzes_read on quizzes for select using (
    is_admin() or teaches_course(course_id) or (enrolled_in(course_id) and is_published));
create policy quizzes_write on quizzes for all
    using (is_admin() or teaches_course(course_id))
    with check (is_admin() or teaches_course(course_id));

create policy quiz_questions_staff on quiz_questions for all
    using (is_admin() or teaches_course(quiz_course(quiz_id)))
    with check (is_admin() or teaches_course(quiz_course(quiz_id)));

create policy quiz_options_staff on quiz_options for all
    using (is_admin() or teaches_course(quiz_course((select quiz_id from quiz_questions q where q.id = question_id))))
    with check (is_admin() or teaches_course(quiz_course((select quiz_id from quiz_questions q where q.id = question_id))));

create policy quiz_attempts_read on quiz_attempts for select using (
    student_id = auth.uid() or is_admin() or teaches_course(quiz_course(quiz_id)));
create policy quiz_attempts_staff_write on quiz_attempts for update
    using (is_admin() or teaches_course(quiz_course(quiz_id)))
    with check (is_admin() or teaches_course(quiz_course(quiz_id)));

create policy quiz_answers_read on quiz_answers for select using (
    attempt_student(attempt_id) = auth.uid() or is_admin() or teaches_course(attempt_course(attempt_id)));
create policy quiz_answers_staff_write on quiz_answers for update
    using (is_admin() or teaches_course(attempt_course(attempt_id)))
    with check (is_admin() or teaches_course(attempt_course(attempt_id)));

-- Students have no direct write access to attempts/answers: start/save/submit run
-- through security definer functions that use the server clock.
revoke insert, delete on quiz_attempts, quiz_answers from authenticated;

-- Questions of a quiz that already has attempts are frozen.
create function quiz_edit_guard() returns trigger
    language plpgsql security definer set search_path = public as
$$
declare qid uuid;
begin
    if auth.uid() is null or pg_trigger_depth() > 1 then return coalesce(new, old); end if;
    if tg_table_name = 'quiz_questions' then
        qid := coalesce(new.quiz_id, old.quiz_id);
    else
        select quiz_id into qid from quiz_questions where id = coalesce(new.question_id, old.question_id);
    end if;
    if qid is not null and exists (select 1 from quiz_attempts where quiz_id = qid) then
        raise exception 'This quiz already has attempts. Unpublish it or create a copy to change questions.';
    end if;
    return coalesce(new, old);
end $$;

create trigger quiz_questions_guard before insert or update or delete on quiz_questions
    for each row execute function quiz_edit_guard();
create trigger quiz_options_guard before insert or update or delete on quiz_options
    for each row execute function quiz_edit_guard();

-- ---------------------------------------------------------------------------
-- ANNOUNCEMENTS
-- ---------------------------------------------------------------------------
create policy announcements_read on announcements for select using (
    auth_role() is not null and (course_id is null or can_access_course(course_id)));
create policy announcements_insert on announcements for insert with check (
    author_id = auth.uid()
    and (is_admin() or (course_id is not null and teaches_course(course_id))));
create policy announcements_update on announcements for update
    using (is_admin() or (author_id = auth.uid() and course_id is not null and teaches_course(course_id)))
    with check (is_admin() or (author_id = auth.uid() and course_id is not null and teaches_course(course_id)));
create policy announcements_delete on announcements for delete
    using (is_admin() or (author_id = auth.uid() and course_id is not null and teaches_course(course_id)));

-- ---------------------------------------------------------------------------
-- CHAT
-- ---------------------------------------------------------------------------
create policy chat_read on chat_messages for select using (can_access_course(course_id));
create policy chat_insert on chat_messages for insert with check (
    sender_id = auth.uid() and (teaches_course(course_id) or enrolled_in(course_id)));
create policy chat_soft_delete on chat_messages for update
    using (sender_id = auth.uid() or is_admin() or teaches_course(course_id))
    with check (sender_id = auth.uid() or is_admin() or teaches_course(course_id));
revoke update on chat_messages from authenticated;
grant update (deleted_at) on chat_messages to authenticated;
revoke delete on chat_messages from authenticated;

create function chat_guard() returns trigger
    language plpgsql security definer set search_path = public as
$$
begin
    if tg_op = 'INSERT' then
        if auth.uid() is not null and (
            select count(*) from chat_messages
            where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
            raise exception 'You are sending messages too fast. Please wait a moment.';
        end if;
        new.body := btrim(new.body);
        return new;
    end if;
    -- UPDATE: only soft delete is possible (column grant); blank the body.
    if new.deleted_at is not null and old.deleted_at is null then
        new.body := '[deleted]';
    else
        new.deleted_at := old.deleted_at;
    end if;
    return new;
end $$;

create trigger chat_guard before insert or update on chat_messages
    for each row execute function chat_guard();

-- ---------------------------------------------------------------------------
-- COMPLAINTS (private to submitter and admins)
-- ---------------------------------------------------------------------------
create policy complaints_read on complaints for select
    using (submitted_by = auth.uid() or is_admin());
create policy complaints_insert on complaints for insert with check (
    submitted_by = auth.uid() and auth_role() is not null and status = 'open'
    and (course_id is null or can_access_course(course_id)));
create policy complaints_admin_update on complaints for update
    using (is_admin()) with check (is_admin());
revoke delete on complaints from authenticated;

create function complaints_guard() returns trigger
    language plpgsql security definer set search_path = public as
$$
begin
    if tg_op = 'INSERT' then
        if auth.uid() is not null and (
            select count(*) from complaints
            where submitted_by = new.submitted_by and created_at > now() - interval '1 day') >= 5 then
            raise exception 'You can file at most 5 complaints per day.';
        end if;
        return new;
    end if;

    if auth.uid() is null then return new; end if;

    -- A complainant can only withdraw their own open complaint.
    if not is_admin() then
        if old.submitted_by = auth.uid() and old.status = 'open' and new.status = 'rejected'
           and new.admin_response = 'Withdrawn by user' then
            new.resolved_at := now();
            return new;
        end if;
        raise exception 'You cannot change this complaint.';
    end if;

    if new.status is distinct from old.status then
        if not ((old.status = 'open' and new.status in ('in_review', 'rejected'))
             or (old.status = 'in_review' and new.status in ('resolved', 'rejected'))) then
            raise exception 'A % complaint cannot move to %.', old.status, new.status;
        end if;
        if new.status in ('resolved', 'rejected') then
            if coalesce(btrim(new.admin_response), '') = '' then
                raise exception 'A response is required to resolve or reject a complaint.';
            end if;
            new.resolved_by := auth.uid();
            new.resolved_at := now();
        end if;
    elsif old.status in ('resolved', 'rejected') then
        raise exception 'This complaint is closed.';
    end if;
    return new;
end $$;

create trigger complaints_guard before insert or update on complaints
    for each row execute function complaints_guard();

-- ===================== 0003_features.sql =====================
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

-- ===================== 0004_storage.sql =====================
-- 0004_storage.sql
-- Private buckets + storage policies (spec Section 5). Files are only ever served
-- through signed URLs (60 min). Size and MIME limits are also enforced here, in
-- addition to the validation done in the server actions.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('resources', 'resources', false, 52428800, array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png', 'image/jpeg', 'video/mp4', 'application/zip', 'application/x-zip-compressed']),
  ('submissions', 'submissions', false, 26214400, array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png', 'image/jpeg', 'application/zip', 'application/x-zip-compressed']),
  ('avatars', 'avatars', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;

create function can_submit_assignment(aid uuid) returns boolean
    language sql stable security definer set search_path = public as
$$ select exists (select 1 from assignments
                  where id = aid and is_published and (now() <= due_at or allow_late)) $$;

-- RESOURCES: {course_id}/{uuid}-{filename}
create policy resources_obj_read on storage.objects for select to authenticated
    using (bucket_id = 'resources'
           and can_access_course(safe_uuid((storage.foldername(name))[1])));
create policy resources_obj_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'resources'
           and (is_admin() or teaches_course(safe_uuid((storage.foldername(name))[1]))));
create policy resources_obj_update on storage.objects for update to authenticated
    using (bucket_id = 'resources'
           and (is_admin() or teaches_course(safe_uuid((storage.foldername(name))[1]))));
create policy resources_obj_delete on storage.objects for delete to authenticated
    using (bucket_id = 'resources'
           and (is_admin() or teaches_course(safe_uuid((storage.foldername(name))[1]))));

-- SUBMISSIONS: {assignment_id}/{student_id}/{uuid}-{filename}
create policy submissions_obj_read on storage.objects for select to authenticated
    using (bucket_id = 'submissions' and (
           safe_uuid((storage.foldername(name))[2]) = auth.uid()
        or is_admin()
        or teaches_course(assignment_course(safe_uuid((storage.foldername(name))[1])))));
create policy submissions_obj_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'submissions'
        and safe_uuid((storage.foldername(name))[2]) = auth.uid()
        and enrolled_in(assignment_course(safe_uuid((storage.foldername(name))[1])))
        and can_submit_assignment(safe_uuid((storage.foldername(name))[1])));
create policy submissions_obj_delete on storage.objects for delete to authenticated
    using (bucket_id = 'submissions' and (
           safe_uuid((storage.foldername(name))[2]) = auth.uid()
        or is_admin()
        or teaches_course(assignment_course(safe_uuid((storage.foldername(name))[1])))));

-- AVATARS: {user_id}.{ext}  (any signed-in user reads, only the owner writes)
create policy avatars_obj_read on storage.objects for select to authenticated
    using (bucket_id = 'avatars' and auth_role() is not null);
create policy avatars_obj_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and name like auth.uid()::text || '.%');
create policy avatars_obj_update on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and name like auth.uid()::text || '.%');
create policy avatars_obj_delete on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and name like auth.uid()::text || '.%');

-- ===================== 0005_quiz_functions.sql =====================
-- 0005_quiz_functions.sql
-- Quiz engine (spec Feature 5). Students have NO direct table access to questions,
-- options, attempts or answers beyond reading their own attempts. Everything goes
-- through these security definer functions, which:
--   * use the database clock (never the browser clock),
--   * never return is_correct while an attempt is open,
--   * score in a single place (finalize_attempt).

-- At most one in-progress attempt per student and quiz (resume instead of parallel).
create unique index quiz_attempts_one_open on quiz_attempts (quiz_id, student_id)
    where status = 'in_progress';

create function attempt_deadline(p_attempt uuid) returns timestamptz
    language sql stable security definer set search_path = public as
$$ select least(a.started_at + make_interval(mins => q.duration_minutes), q.closes_at)
   from quiz_attempts a join quizzes q on q.id = a.quiz_id where a.id = p_attempt $$;

-- Internal: scores an attempt from the answers saved before expiry and closes it.
create function finalize_attempt(p_attempt uuid) returns void
    language plpgsql security definer set search_path = public as
$$
declare
    a quiz_attempts%rowtype;
    dl timestamptz;
    pending int;
begin
    select * into a from quiz_attempts where id = p_attempt for update;
    if not found or a.status <> 'in_progress' then return; end if;
    dl := attempt_deadline(p_attempt);

    -- one answer row per question so unanswered ones score 0
    insert into quiz_answers (attempt_id, question_id)
    select p_attempt, qq.id from quiz_questions qq where qq.quiz_id = a.quiz_id
    on conflict (attempt_id, question_id) do nothing;

    -- auto-graded types: full marks only if the selected set equals the correct set
    update quiz_answers qa
       set marks_awarded = case
             when (select array_agg(o.id order by o.id) from quiz_options o
                    where o.question_id = qa.question_id and o.is_correct)
                  is not distinct from
                  (select array_agg(distinct x order by x) from unnest(qa.selected_option_ids) x)
             then qq.marks else 0 end
      from quiz_questions qq
     where qa.attempt_id = p_attempt and qq.id = qa.question_id and qq.type <> 'short_answer';

    -- blank short answers are 0; the rest wait for the teacher
    update quiz_answers qa set marks_awarded = 0
      from quiz_questions qq
     where qa.attempt_id = p_attempt and qq.id = qa.question_id and qq.type = 'short_answer'
       and coalesce(btrim(qa.text_answer), '') = '';

    select count(*) into pending from quiz_answers where attempt_id = p_attempt and marks_awarded is null;

    update quiz_attempts
       set submitted_at = least(now(), dl),
           status = case when pending = 0 then 'graded'::attempt_status else 'submitted'::attempt_status end,
           score = (select coalesce(sum(marks_awarded), 0) from quiz_answers where attempt_id = p_attempt)
     where id = p_attempt;
end $$;

create function start_quiz_attempt(p_quiz uuid) returns uuid
    language plpgsql security definer set search_path = public as
$$
declare
    q quizzes%rowtype;
    a quiz_attempts%rowtype;
    n int;
    v uuid;
begin
    if auth_role() is distinct from 'student' then raise exception 'Only students can take quizzes.'; end if;
    select * into q from quizzes where id = p_quiz and is_published;
    if not found or not enrolled_in(q.course_id) then raise exception 'Quiz not found.'; end if;

    perform pg_advisory_xact_lock(hashtextextended(p_quiz::text || auth.uid()::text, 0));

    -- resume an open attempt, or finalize it if its time is up
    for a in select * from quiz_attempts
              where quiz_id = p_quiz and student_id = auth.uid() and status = 'in_progress' loop
        if now() >= attempt_deadline(a.id) then
            perform finalize_attempt(a.id);
        else
            return a.id;
        end if;
    end loop;

    if now() < q.opens_at then raise exception 'This quiz has not opened yet.'; end if;
    if now() >= q.closes_at then raise exception 'This quiz is closed.'; end if;
    select count(*) into n from quiz_attempts where quiz_id = p_quiz and student_id = auth.uid();
    if n >= q.max_attempts then raise exception 'You have used all attempts for this quiz.'; end if;

    insert into quiz_attempts (quiz_id, student_id) values (p_quiz, auth.uid()) returning id into v;
    return v;
end $$;

-- Questions for an open attempt, WITHOUT is_correct. Also returns the saved answers
-- and the server-derived expiry so a refresh never resets the timer.
create function get_attempt_questions(p_attempt uuid) returns jsonb
    language plpgsql security definer set search_path = public as
$$
declare
    a quiz_attempts%rowtype;
    q quizzes%rowtype;
    dl timestamptz;
begin
    select * into a from quiz_attempts where id = p_attempt and student_id = auth.uid();
    if not found then raise exception 'Attempt not found.'; end if;
    select * into q from quizzes where id = a.quiz_id;
    dl := attempt_deadline(p_attempt);

    if a.status = 'in_progress' and now() >= dl then
        perform finalize_attempt(p_attempt);
        select * into a from quiz_attempts where id = p_attempt;
    end if;
    if a.status <> 'in_progress' then
        return jsonb_build_object('finished', true, 'attempt_id', a.id, 'quiz_id', q.id);
    end if;

    return jsonb_build_object(
        'finished', false,
        'attempt_id', a.id,
        'quiz', jsonb_build_object('id', q.id, 'title', q.title, 'description', q.description,
                                   'course_id', q.course_id),
        'expires_at', dl,
        'server_now', now(),
        'questions', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'id', qq.id, 'position', qq.position, 'type', qq.type,
                'prompt', qq.prompt, 'marks', qq.marks,
                'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'text', o.text)
                                                      order by o.position), '[]'::jsonb)
                            from quiz_options o where o.question_id = qq.id))
              order by case when q.shuffle_questions
                            then hashtext(a.id::text || qq.id::text) else qq.position end), '[]'::jsonb)
            from quiz_questions qq where qq.quiz_id = q.id),
        'answers', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'question_id', x.question_id, 'selected_option_ids', x.selected_option_ids,
                'text_answer', x.text_answer)), '[]'::jsonb)
            from quiz_answers x where x.attempt_id = a.id)
    );
end $$;

-- Autosave. Returns false (after finalizing) when the attempt has expired.
create function save_quiz_answer(p_attempt uuid, p_question uuid, p_option_ids uuid[], p_text text)
    returns boolean
    language plpgsql security definer set search_path = public as
$$
declare
    a quiz_attempts%rowtype;
    qt question_type;
begin
    select * into a from quiz_attempts
     where id = p_attempt and student_id = auth.uid() and status = 'in_progress';
    if not found then raise exception 'This attempt is no longer open.'; end if;

    if now() >= attempt_deadline(p_attempt) then
        perform finalize_attempt(p_attempt);
        return false;
    end if;

    select type into qt from quiz_questions where id = p_question and quiz_id = a.quiz_id;
    if qt is null then raise exception 'Question not found.'; end if;

    p_option_ids := coalesce(p_option_ids, '{}');
    if exists (select 1 from unnest(p_option_ids) x
               where not exists (select 1 from quiz_options o where o.id = x and o.question_id = p_question)) then
        raise exception 'Invalid option.';
    end if;
    if qt in ('mcq_single', 'true_false') and cardinality(p_option_ids) > 1 then
        raise exception 'Select only one option.';
    end if;
    if qt = 'short_answer' then
        p_option_ids := '{}';
        if char_length(coalesce(p_text, '')) > 5000 then raise exception 'Answer is too long.'; end if;
    else
        p_text := null;
    end if;

    insert into quiz_answers (attempt_id, question_id, selected_option_ids, text_answer)
    values (p_attempt, p_question, p_option_ids, p_text)
    on conflict (attempt_id, question_id)
    do update set selected_option_ids = excluded.selected_option_ids, text_answer = excluded.text_answer;
    return true;
end $$;

create function submit_quiz_attempt(p_attempt uuid) returns void
    language plpgsql security definer set search_path = public as
$$
begin
    if not exists (select 1 from quiz_attempts where id = p_attempt and student_id = auth.uid()) then
        raise exception 'Attempt not found.';
    end if;
    perform finalize_attempt(p_attempt);
end $$;

-- Review for the student: answers + correct options only once the quiz has closed
-- and the teacher allowed it.
create function get_attempt_review(p_attempt uuid) returns jsonb
    language plpgsql security definer set search_path = public as
$$
declare
    a quiz_attempts%rowtype;
    q quizzes%rowtype;
    allowed boolean;
begin
    select * into a from quiz_attempts where id = p_attempt and student_id = auth.uid();
    if not found then raise exception 'Attempt not found.'; end if;
    select * into q from quizzes where id = a.quiz_id;
    if a.status = 'in_progress' then raise exception 'This attempt is still in progress.'; end if;
    allowed := q.show_answers_after_close and now() >= q.closes_at;

    return jsonb_build_object(
        'attempt', jsonb_build_object('id', a.id, 'status', a.status, 'score', a.score,
                                      'started_at', a.started_at, 'submitted_at', a.submitted_at),
        'quiz', jsonb_build_object('id', q.id, 'title', q.title, 'course_id', q.course_id,
                                   'closes_at', q.closes_at, 'max_marks', quiz_max_marks(q.id)),
        'review_allowed', allowed,
        'questions', case when not allowed then '[]'::jsonb else (
            select coalesce(jsonb_agg(jsonb_build_object(
                'id', qq.id, 'position', qq.position, 'type', qq.type, 'prompt', qq.prompt, 'marks', qq.marks,
                'options', (select coalesce(jsonb_agg(jsonb_build_object(
                                'id', o.id, 'text', o.text, 'is_correct', o.is_correct) order by o.position), '[]'::jsonb)
                            from quiz_options o where o.question_id = qq.id),
                'selected_option_ids', coalesce(x.selected_option_ids, '{}'),
                'text_answer', x.text_answer,
                'marks_awarded', x.marks_awarded) order by qq.position), '[]'::jsonb)
            from quiz_questions qq
            left join quiz_answers x on x.question_id = qq.id and x.attempt_id = a.id
            where qq.quiz_id = q.id) end
    );
end $$;

-- Teacher/admin: manual marks for a short answer; recomputes the attempt.
create function grade_short_answer(p_answer uuid, p_marks numeric) returns void
    language plpgsql security definer set search_path = public as
$$
declare
    x quiz_answers%rowtype;
    qq quiz_questions%rowtype;
    att quiz_attempts%rowtype;
    pending int;
begin
    select * into x from quiz_answers where id = p_answer;
    if not found then raise exception 'Answer not found.'; end if;
    if not (is_admin() or teaches_course(attempt_course(x.attempt_id))) then
        raise exception 'You cannot grade this answer.';
    end if;
    select * into qq from quiz_questions where id = x.question_id;
    if qq.type <> 'short_answer' then raise exception 'Only short answers are graded by hand.'; end if;
    if p_marks is null or p_marks < 0 or p_marks > qq.marks then
        raise exception 'Marks must be between 0 and %.', qq.marks;
    end if;
    select * into att from quiz_attempts where id = x.attempt_id for update;
    if att.status = 'in_progress' then raise exception 'The student is still taking this quiz.'; end if;

    update quiz_answers set marks_awarded = p_marks where id = p_answer;
    select count(*) into pending from quiz_answers where attempt_id = x.attempt_id and marks_awarded is null;
    update quiz_attempts
       set score = (select coalesce(sum(marks_awarded), 0) from quiz_answers where attempt_id = x.attempt_id),
           status = case when pending = 0 then 'graded'::attempt_status else 'submitted'::attempt_status end
     where id = x.attempt_id;
end $$;

-- Lazy "scheduled job": close every expired attempt (called on list/result loads).
create function finalize_expired_attempts(p_quiz uuid) returns int
    language plpgsql security definer set search_path = public as
$$
declare r record; n int := 0;
begin
    if not (is_admin() or teaches_course(quiz_course(p_quiz))) then return 0; end if;
    for r in select id from quiz_attempts where quiz_id = p_quiz and status = 'in_progress' loop
        if now() >= attempt_deadline(r.id) then perform finalize_attempt(r.id); n := n + 1; end if;
    end loop;
    return n;
end $$;

create function finalize_my_expired_attempts() returns int
    language plpgsql security definer set search_path = public as
$$
declare r record; n int := 0;
begin
    for r in select id from quiz_attempts where student_id = auth.uid() and status = 'in_progress' loop
        if now() >= attempt_deadline(r.id) then perform finalize_attempt(r.id); n := n + 1; end if;
    end loop;
    return n;
end $$;

-- Grants: internal helpers are not callable from the API.
revoke execute on function finalize_attempt(uuid), attempt_deadline(uuid) from public, anon, authenticated;
revoke execute on function start_quiz_attempt(uuid), get_attempt_questions(uuid),
    save_quiz_answer(uuid, uuid, uuid[], text), submit_quiz_attempt(uuid), get_attempt_review(uuid),
    grade_short_answer(uuid, numeric), finalize_expired_attempts(uuid), finalize_my_expired_attempts()
    from public, anon;
grant execute on function start_quiz_attempt(uuid), get_attempt_questions(uuid),
    save_quiz_answer(uuid, uuid, uuid[], text), submit_quiz_attempt(uuid), get_attempt_review(uuid),
    grade_short_answer(uuid, numeric), finalize_expired_attempts(uuid), finalize_my_expired_attempts()
    to authenticated;

-- ===================== 0006_course_people.sql =====================
-- 0006_course_people.sql
-- People tab (spec Feature 3, req. 8): the teacher plus every enrolled student of a
-- course, for any member of that course. Students cannot read each other's enrollment
-- rows or e-mail addresses, so this runs with definer rights and decides itself:
-- e-mail is returned only to the admin and the course's teacher.

create function course_people(p_course uuid) returns table (
    id uuid,
    full_name text,
    roll_no text,
    avatar_url text,
    role user_role,
    email text,
    is_teacher boolean
)
    language sql stable security definer set search_path = public as
$$
  select p.id, p.full_name, p.roll_no, p.avatar_url, p.role,
         case when is_admin() or teaches_course(p_course) then p.email end,
         true
    from courses c join profiles p on p.id = c.teacher_id
   where c.id = p_course and can_access_course(p_course)
  union all
  select p.id, p.full_name, p.roll_no, p.avatar_url, p.role,
         case when is_admin() or teaches_course(p_course) then p.email end,
         false
    from enrollments e join profiles p on p.id = e.student_id
   where e.course_id = p_course and can_access_course(p_course)
$$;

revoke execute on function course_people(uuid) from public, anon;
grant execute on function course_people(uuid) to authenticated;

-- ===================== 0007_quiz_builder.sql =====================
-- 0007_quiz_builder.sql
-- Helpers for the teacher quiz builder and results page. All run with the CALLER's
-- rights (security invoker), so RLS and the quiz_edit_guard trigger still apply:
-- a teacher can only touch their own course's quizzes, and questions of a quiz that
-- already has attempts stay frozen.

-- Reorders questions in ONE statement. Each REST call is its own transaction, and
-- (quiz_id, position) is unique, so swapping positions needs this single UPDATE.
create function reorder_quiz_questions(p_quiz uuid, p_ids uuid[]) returns void
    language plpgsql set search_path = public as
$$
begin
    if (select count(*) from quiz_questions where quiz_id = p_quiz) <> cardinality(p_ids) then
        raise exception 'The question list changed. Refresh the page and try again.';
    end if;
    update quiz_questions q
       set position = o.ord
      from unnest(p_ids) with ordinality as o(id, ord)
     where q.id = o.id and q.quiz_id = p_quiz;
end $$;

create function duplicate_quiz_question(p_question uuid) returns uuid
    language plpgsql set search_path = public as
$$
declare
    q quiz_questions%rowtype;
    v uuid;
begin
    select * into q from quiz_questions where id = p_question;
    if not found then raise exception 'Question not found.'; end if;
    insert into quiz_questions (quiz_id, position, type, prompt, marks)
    values (q.quiz_id,
            (select coalesce(max(position), 0) + 1 from quiz_questions where quiz_id = q.quiz_id),
            q.type, q.prompt, q.marks)
    returning id into v;
    insert into quiz_options (question_id, position, text, is_correct)
    select v, position, text, is_correct from quiz_options where question_id = p_question;
    return v;
end $$;

-- "Create a copy" for a quiz that already has attempts (its questions are frozen).
create function copy_quiz(p_quiz uuid) returns uuid
    language plpgsql set search_path = public as
$$
declare
    q quizzes%rowtype;
    r quiz_questions%rowtype;
    v uuid;
    nq uuid;
begin
    select * into q from quizzes where id = p_quiz;
    if not found then raise exception 'Quiz not found.'; end if;
    insert into quizzes (course_id, created_by, title, description, duration_minutes, opens_at, closes_at,
                         max_attempts, shuffle_questions, show_answers_after_close, is_published)
    values (q.course_id, auth.uid(), left(q.title, 140) || ' (copy)', q.description, q.duration_minutes,
            q.opens_at, q.closes_at, q.max_attempts, q.shuffle_questions, q.show_answers_after_close, false)
    returning id into v;
    for r in select * from quiz_questions where quiz_id = p_quiz order by position loop
        insert into quiz_questions (quiz_id, position, type, prompt, marks)
        values (v, r.position, r.type, r.prompt, r.marks) returning id into nq;
        insert into quiz_options (question_id, position, text, is_correct)
        select nq, position, text, is_correct from quiz_options where question_id = r.id;
    end loop;
    return v;
end $$;

-- Per-question results for the teacher: how many answered and how many got full marks.
create function quiz_question_stats(p_quiz uuid) returns table (
    question_id uuid, answered bigint, correct bigint, avg_marks numeric)
    language sql stable set search_path = public as
$$
  select qa.question_id,
         count(*),
         count(*) filter (where qa.marks_awarded is not null and qq.marks > 0 and qa.marks_awarded >= qq.marks),
         avg(qa.marks_awarded)
    from quiz_answers qa
    join quiz_attempts a on a.id = qa.attempt_id
    join quiz_questions qq on qq.id = qa.question_id
   where a.quiz_id = p_quiz and a.status <> 'in_progress'
   group by qa.question_id
$$;

-- Every short-answer response of a finished attempt (for manual grading).
create function quiz_short_answers(p_quiz uuid) returns table (
    answer_id uuid, attempt_id uuid, student_id uuid, question_id uuid,
    text_answer text, marks_awarded numeric)
    language sql stable set search_path = public as
$$
  select qa.id, qa.attempt_id, a.student_id, qa.question_id, qa.text_answer, qa.marks_awarded
    from quiz_answers qa
    join quiz_attempts a on a.id = qa.attempt_id
    join quiz_questions qq on qq.id = qa.question_id
   where a.quiz_id = p_quiz and qq.type = 'short_answer' and a.status <> 'in_progress'
   order by a.submitted_at nulls last, qa.id
$$;

revoke execute on function reorder_quiz_questions(uuid, uuid[]), duplicate_quiz_question(uuid),
    copy_quiz(uuid), quiz_question_stats(uuid), quiz_short_answers(uuid) from public, anon;
grant execute on function reorder_quiz_questions(uuid, uuid[]), duplicate_quiz_question(uuid),
    copy_quiz(uuid), quiz_question_stats(uuid), quiz_short_answers(uuid) to authenticated;

-- ===================== 0008_chat_realtime_fix.sql =====================
-- 0008_chat_realtime_fix.sql
-- Supabase Realtime validates a postgres_changes filter column against the subscriber's
-- column privileges, so "event: UPDATE ... filter course_id=eq.<id>" failed with
-- "invalid column for filter course_id" while only deleted_at was updatable.
--
-- Fix: allow UPDATE privilege on course_id as well, and make the trigger force every
-- column except deleted_at back to its old value. The privilege can therefore never be
-- used to move a message to another course or to impersonate another sender.

grant update (course_id) on chat_messages to authenticated;

create or replace function chat_guard() returns trigger
    language plpgsql security definer set search_path = public as
$$
begin
    if tg_op = 'INSERT' then
        if auth.uid() is not null and (
            select count(*) from chat_messages
            where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
            raise exception 'You are sending messages too fast. Please wait a moment.';
        end if;
        new.body := btrim(new.body);
        return new;
    end if;

    -- UPDATE: the only legitimate change is a soft delete.
    new.course_id := old.course_id;
    new.sender_id := old.sender_id;
    new.created_at := old.created_at;
    if new.deleted_at is not null and old.deleted_at is null then
        new.body := '[deleted]';
    else
        new.deleted_at := old.deleted_at;
        new.body := old.body;
    end if;
    return new;
end $$;
