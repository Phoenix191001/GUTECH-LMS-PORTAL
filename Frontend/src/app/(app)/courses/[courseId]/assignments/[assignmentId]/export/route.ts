import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/auth'
import { toCsv } from '@/lib/csv'
import { loadRoster } from '@/features/assignments/queries'

/** CSV of every student's submission status and marks. Teacher of the course or admin only (RLS + explicit check). */
export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string; assignmentId: string }> }) {
  const { courseId, assignmentId } = await params
  const user = await getAppUser()
  if (!user || (user.profile.role !== 'admin' && user.profile.role !== 'teacher')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { data: assignment } = await user.supabase.from('assignments').select('*').eq('id', assignmentId).eq('course_id', courseId).maybeSingle()
  const { data: course } = await user.supabase.from('courses').select('teacher_id, code').eq('id', courseId).maybeSingle()
  if (!assignment || !course || (user.profile.role === 'teacher' && course.teacher_id !== user.id)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const roster = await loadRoster(user.supabase, courseId, assignmentId)
  const rows: unknown[][] = [
    ['Roll no', 'Name', 'Status', 'Submitted at (UTC)', 'Late', `Marks (max ${assignment.max_marks})`, 'Feedback', 'Enrolment'],
    ...roster.map((r) => [
      r.rollNo ?? '',
      r.name,
      !r.submission ? 'Not submitted' : r.submission.marks_obtained !== null ? 'Graded' : r.submission.is_late ? 'Late' : 'Submitted',
      r.submission && (r.submission.text_answer || r.submission.file_path) ? r.submission.submitted_at : '',
      r.submission?.is_late ? 'Yes' : '',
      r.submission?.marks_obtained ?? '',
      r.submission?.feedback ?? '',
      r.removed ? 'Removed' : 'Enrolled',
    ]),
  ]

  const safe = assignment.title.replace(/[^\w-]+/g, '_').slice(0, 60)
  return new NextResponse(`﻿${toCsv(rows)}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${course.code}-${safe}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
