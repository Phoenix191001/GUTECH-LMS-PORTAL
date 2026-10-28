import type { Tone } from '@/components/ui/card'
import { num } from '@/lib/utils'

export type StudentStatus = 'not_submitted' | 'submitted' | 'late' | 'graded' | 'overdue'

type AssignmentLite = { due_at: string; allow_late: boolean; max_marks: number }
type SubmissionLite = { is_late: boolean; marks_obtained: number | null; graded_at: string | null } | null | undefined

/**
 * Student-facing status. `now` should be the server's time. Note that the real deadline
 * decision is made again by Postgres when a submission is written.
 */
export function studentStatus(a: AssignmentLite, s: SubmissionLite, now = Date.now()): StudentStatus {
  if (s && s.marks_obtained !== null && s.graded_at) return 'graded'
  if (s) return s.is_late ? 'late' : 'submitted'
  return now > new Date(a.due_at).getTime() ? 'overdue' : 'not_submitted'
}

export function statusChip(status: StudentStatus, a: AssignmentLite, s: SubmissionLite): { label: string; tone: Tone } {
  switch (status) {
    case 'graded':
      return { label: `Graded (${num(s?.marks_obtained)}/${num(a.max_marks)})`, tone: 'success' }
    case 'late':
      return { label: 'Late', tone: 'warning' }
    case 'submitted':
      return { label: 'Submitted', tone: 'info' }
    case 'overdue':
      return { label: 'Overdue', tone: 'danger' }
    default:
      return { label: 'Not submitted', tone: 'neutral' }
  }
}

/** True while the student may still submit (server clock decides in the end). */
export function canSubmitNow(a: AssignmentLite, now = Date.now()): boolean {
  return now <= new Date(a.due_at).getTime() || a.allow_late
}
