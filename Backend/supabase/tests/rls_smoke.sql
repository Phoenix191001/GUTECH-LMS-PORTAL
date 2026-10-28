-- RLS smoke tests. Run AFTER `npm run seed`, in the Supabase SQL editor (or psql).
-- Everything runs inside a transaction that is rolled back; nothing is persisted.
-- Each check raises an exception on failure, so a clean run means every check passed.

begin;

create schema lms_test;
grant usage on schema lms_test to anon, authenticated;

create or replace function lms_test.act_as(p_email text) returns void language plpgsql as $$
declare uid uuid;
begin
    select id into uid from public.profiles where email = p_email;
    if uid is null then raise exception 'seed user % not found', p_email; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
end $$;

create or replace function lms_test.expect(p_label text, p_ok boolean) returns void language plpgsql as $$
begin
    if not coalesce(p_ok, false) then raise exception 'FAIL: %', p_label; end if;
    raise notice 'PASS: %', p_label;
end $$;

-- ---------------------------------------------------------------- student 4
-- student4 is enrolled in CS-101 only; student1 is enrolled in CS-101 and CS-205.
select lms_test.act_as('student4@example.edu');

select lms_test.expect('student sees only enrolled courses',
    (select count(*) from courses) = 1 and (select code from courses limit 1) = 'CS-101');

select lms_test.expect('student cannot read other students profiles',
    (select count(*) from profiles) = 1);

select lms_test.expect('student directory hides email column',
    not exists (select 1 from information_schema.columns
                where table_name = 'profile_directory' and column_name = 'email'));

select lms_test.expect('student cannot read quiz questions or options directly',
    (select count(*) from quiz_questions) = 0 and (select count(*) from quiz_options) = 0);

select lms_test.expect('student cannot read complaints of others', (select count(*) from complaints) = 0);

do $$
begin
    update profiles set role = 'admin' where id = auth.uid();
    raise exception 'FAIL: student could change own role';
exception when insufficient_privilege then
    raise notice 'PASS: student cannot change own role';
end $$;

do $$
begin
    insert into courses (code, title, teacher_id) values ('HACK-1', 'x', auth.uid());
    raise exception 'FAIL: student created a course';
exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS: student cannot create courses';
end $$;

-- ---------------------------------------------------------------- teacher 2
-- teacher2 teaches CS-205 only.
reset role;
select lms_test.act_as('teacher2@example.edu');

select lms_test.expect('teacher sees only own course',
    (select count(*) from courses) = 1 and (select code from courses limit 1) = 'CS-205');

select lms_test.expect('teacher sees only students of own course',
    (select count(*) from profiles where role = 'student') = 3);

-- ---------------------------------------------------------------- admin
reset role;
select lms_test.act_as('admin@example.edu');
select lms_test.expect('admin sees all courses', (select count(*) from courses) >= 2);

-- ---------------------------------------------------------------- anon
reset role;
set local role anon;
do $$
begin
    perform 1 from public.courses;
    raise exception 'FAIL: anon can read courses';
exception when insufficient_privilege then
    raise notice 'PASS: anon has no table access';
end $$;

rollback;
