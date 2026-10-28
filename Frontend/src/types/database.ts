/**
 * Database types in the shape produced by `supabase gen types typescript`.
 * Hand-written to match Backend/supabase/migrations/0001..0005 so the app compiles
 * before a project is linked. Regenerate with:
 *   supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'admin' | 'teacher' | 'student'
export type ResourceKind = 'file' | 'link'
export type QuestionType = 'mcq_single' | 'mcq_multi' | 'true_false' | 'short_answer'
export type AttemptStatus = 'in_progress' | 'submitted' | 'graded'
export type ComplaintStatus = 'open' | 'in_review' | 'resolved' | 'rejected'
export type ComplaintCategory = 'academic' | 'teacher' | 'facility' | 'technical' | 'other'

type FK<Col extends string, Table extends string, One extends boolean = false> = {
  foreignKeyName: string
  columns: [Col]
  isOneToOne: One
  referencedRelation: Table
  referencedColumns: ['id']
}

/** Insert requires `Req` keys; every other column is optional (has a default or is nullable). */
type Tbl<Row, Req extends keyof Row, Rel extends unknown[] = []> = {
  Row: Row
  Insert: { [K in Req]: Row[K] } & { [K in Exclude<keyof Row, Req>]?: Row[K] }
  Update: Partial<Row>
  Relationships: Rel
}

type ProfileRow = {
  id: string
  full_name: string
  email: string
  role: UserRole
  roll_no: string | null
  avatar_url: string | null
  is_active: boolean
  must_change_password: boolean
  created_at: string
}
type CourseRow = {
  id: string
  code: string
  title: string
  description: string | null
  teacher_id: string
  is_active: boolean
  created_at: string
}
type EnrollmentRow = { id: string; course_id: string; student_id: string; enrolled_at: string }
type ResourceRow = {
  id: string
  course_id: string
  uploaded_by: string
  title: string
  description: string | null
  kind: ResourceKind
  storage_path: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  external_url: string | null
  created_at: string
}
type ResourceViewRow = { id: string; resource_id: string; student_id: string; seen_at: string }
type AssignmentRow = {
  id: string
  course_id: string
  created_by: string
  title: string
  instructions: string | null
  attachment_path: string | null
  attachment_name: string | null
  due_at: string
  max_marks: number
  allow_late: boolean
  is_published: boolean
  created_at: string
}
type SubmissionRow = {
  id: string
  assignment_id: string
  student_id: string
  text_answer: string | null
  file_path: string | null
  file_name: string | null
  submitted_at: string
  is_late: boolean
  marks_obtained: number | null
  feedback: string | null
  graded_by: string | null
  graded_at: string | null
}
type QuizRow = {
  id: string
  course_id: string
  created_by: string
  title: string
  description: string | null
  duration_minutes: number
  opens_at: string
  closes_at: string
  max_attempts: number
  shuffle_questions: boolean
  show_answers_after_close: boolean
  is_published: boolean
  created_at: string
}
type QuizQuestionRow = {
  id: string
  quiz_id: string
  position: number
  type: QuestionType
  prompt: string
  marks: number
}
type QuizOptionRow = {
  id: string
  question_id: string
  position: number
  text: string
  is_correct: boolean
}
type QuizAttemptRow = {
  id: string
  quiz_id: string
  student_id: string
  started_at: string
  submitted_at: string | null
  status: AttemptStatus
  score: number | null
}
type QuizAnswerRow = {
  id: string
  attempt_id: string
  question_id: string
  selected_option_ids: string[]
  text_answer: string | null
  marks_awarded: number | null
}
type AnnouncementRow = {
  id: string
  course_id: string | null
  author_id: string
  title: string
  body: string
  is_pinned: boolean
  created_at: string
}
type ChatMessageRow = {
  id: string
  course_id: string
  sender_id: string
  body: string
  created_at: string
  deleted_at: string | null
}
type ComplaintRow = {
  id: string
  submitted_by: string
  course_id: string | null
  category: ComplaintCategory
  subject: string
  description: string
  status: ComplaintStatus
  admin_response: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}
type AnnouncementReadRow = {
  id: string
  announcement_id: string
  user_id: string
  read_at: string
  created_at: string
}
type ChatLastReadRow = {
  id: string
  course_id: string
  user_id: string
  last_read_at: string
  created_at: string
}
type GradeAuditRow = {
  id: string
  submission_id: string | null
  quiz_attempt_id: string | null
  changed_by: string | null
  old_marks: number | null
  new_marks: number | null
  changed_at: string
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: Tbl<ProfileRow, 'id' | 'full_name' | 'email'>
      courses: Tbl<CourseRow, 'code' | 'title' | 'teacher_id', [FK<'teacher_id', 'profiles'>]>
      enrollments: Tbl<
        EnrollmentRow,
        'course_id' | 'student_id',
        [FK<'course_id', 'courses'>, FK<'student_id', 'profiles'>]
      >
      resources: Tbl<
        ResourceRow,
        'course_id' | 'uploaded_by' | 'title',
        [FK<'course_id', 'courses'>, FK<'uploaded_by', 'profiles'>]
      >
      resource_views: Tbl<
        ResourceViewRow,
        'resource_id' | 'student_id',
        [FK<'resource_id', 'resources'>, FK<'student_id', 'profiles'>]
      >
      assignments: Tbl<
        AssignmentRow,
        'course_id' | 'created_by' | 'title' | 'due_at' | 'max_marks',
        [FK<'course_id', 'courses'>, FK<'created_by', 'profiles'>]
      >
      submissions: Tbl<
        SubmissionRow,
        'assignment_id' | 'student_id',
        [FK<'assignment_id', 'assignments'>, FK<'student_id', 'profiles'>]
      >
      quizzes: Tbl<
        QuizRow,
        'course_id' | 'created_by' | 'title' | 'duration_minutes' | 'opens_at' | 'closes_at',
        [FK<'course_id', 'courses'>, FK<'created_by', 'profiles'>]
      >
      quiz_questions: Tbl<
        QuizQuestionRow,
        'quiz_id' | 'position' | 'type' | 'prompt',
        [FK<'quiz_id', 'quizzes'>]
      >
      quiz_options: Tbl<
        QuizOptionRow,
        'question_id' | 'position' | 'text',
        [FK<'question_id', 'quiz_questions'>]
      >
      quiz_attempts: Tbl<
        QuizAttemptRow,
        'quiz_id' | 'student_id',
        [FK<'quiz_id', 'quizzes'>, FK<'student_id', 'profiles'>]
      >
      quiz_answers: Tbl<
        QuizAnswerRow,
        'attempt_id' | 'question_id',
        [FK<'attempt_id', 'quiz_attempts'>, FK<'question_id', 'quiz_questions'>]
      >
      announcements: Tbl<
        AnnouncementRow,
        'author_id' | 'title' | 'body',
        [FK<'course_id', 'courses'>, FK<'author_id', 'profiles'>]
      >
      chat_messages: Tbl<
        ChatMessageRow,
        'course_id' | 'sender_id' | 'body',
        [FK<'course_id', 'courses'>, FK<'sender_id', 'profiles'>]
      >
      complaints: Tbl<
        ComplaintRow,
        'submitted_by' | 'category' | 'subject' | 'description',
        [FK<'submitted_by', 'profiles'>, FK<'course_id', 'courses'>]
      >
      announcement_reads: Tbl<AnnouncementReadRow, 'announcement_id' | 'user_id'>
      chat_last_read: Tbl<ChatLastReadRow, 'course_id' | 'user_id'>
      grade_audit: Tbl<GradeAuditRow, never>
    }
    Views: {
      gradebook: {
        Row: {
          student_id: string | null
          course_id: string | null
          item_type: string | null
          item_id: string | null
          title: string | null
          marks: number | null
          max_marks: number | null
          recorded_at: string | null
        }
        Relationships: []
      }
      profile_directory: {
        Row: {
          id: string | null
          full_name: string | null
          avatar_url: string | null
          role: UserRole | null
          roll_no: string | null
          is_active: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      clear_must_change_password: { Args: Record<string, never>; Returns: undefined }
      withdraw_complaint: { Args: { p_id: string }; Returns: undefined }
      mark_complaints_seen: { Args: Record<string, never>; Returns: undefined }
      has_complaint_update: { Args: Record<string, never>; Returns: boolean }
      unread_announcement_count: { Args: Record<string, never>; Returns: number }
      unread_chat_counts: {
        Args: Record<string, never>
        Returns: { course_id: string; unread: number }[]
      }
      mark_chat_read: { Args: { p_course: string }; Returns: undefined }
      course_overview: {
        Args: Record<string, never>
        Returns: {
          course_id: string
          pending_assignments: number
          open_quizzes: number
          student_count: number
        }[]
      }
      course_people: {
        Args: { p_course: string }
        Returns: {
          id: string
          full_name: string
          roll_no: string | null
          avatar_url: string | null
          role: UserRole
          email: string | null
          is_teacher: boolean
        }[]
      }
      reorder_quiz_questions: { Args: { p_quiz: string; p_ids: string[] }; Returns: undefined }
      duplicate_quiz_question: { Args: { p_question: string }; Returns: string }
      copy_quiz: { Args: { p_quiz: string }; Returns: string }
      quiz_question_stats: {
        Args: { p_quiz: string }
        Returns: { question_id: string; answered: number; correct: number; avg_marks: number | null }[]
      }
      quiz_short_answers: {
        Args: { p_quiz: string }
        Returns: {
          answer_id: string
          attempt_id: string
          student_id: string
          question_id: string
          text_answer: string | null
          marks_awarded: number | null
        }[]
      }
      quiz_max_marks: { Args: { qid: string }; Returns: number }
      login_locked: { Args: { p_email: string }; Returns: boolean }
      record_login_failure: { Args: { p_email: string }; Returns: undefined }
      clear_login_failures: { Args: { p_email: string }; Returns: undefined }
      reset_email_allowed: { Args: { p_email: string }; Returns: boolean }
      start_quiz_attempt: { Args: { p_quiz: string }; Returns: string }
      get_attempt_questions: { Args: { p_attempt: string }; Returns: Json }
      save_quiz_answer: {
        Args: { p_attempt: string; p_question: string; p_option_ids: string[]; p_text: string | null }
        Returns: boolean
      }
      submit_quiz_attempt: { Args: { p_attempt: string }; Returns: undefined }
      get_attempt_review: { Args: { p_attempt: string }; Returns: Json }
      grade_short_answer: { Args: { p_answer: string; p_marks: number }; Returns: undefined }
      finalize_expired_attempts: { Args: { p_quiz: string }; Returns: number }
      finalize_my_expired_attempts: { Args: Record<string, never>; Returns: number }
    }
    Enums: {
      user_role: UserRole
      resource_kind: ResourceKind
      question_type: QuestionType
      attempt_status: AttemptStatus
      complaint_status: ComplaintStatus
      complaint_category: ComplaintCategory
    }
    CompositeTypes: Record<string, never>
  }
}

export type TableName = keyof Database['public']['Tables']
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row']
export type Insert<T extends TableName> = Database['public']['Tables'][T]['Insert']
