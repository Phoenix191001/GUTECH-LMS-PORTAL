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
