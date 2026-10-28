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
