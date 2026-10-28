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
