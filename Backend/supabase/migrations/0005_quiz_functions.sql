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
