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
