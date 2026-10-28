import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/auth'
import { toCsv } from '@/lib/csv'
import { getCourseGradebook } from '@/features/marks/queries'

/** CSV export of the teacher's grid. Teacher of the course or admin only (RLS + explicit check). */
export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const user = await getAppUser()
  if (!user || (user.profile.role !== 'admin' && user.profile.role !== 'teacher')) return new NextResponse('Forbidden', { status: 403 })

  const { data: course } = await user.supabase.from('courses').select('code, teacher_id').eq('id', courseId).maybeSingle()
  if (!course || (user.profile.role === 'teacher' && course.teacher_id !== user.id)) return new NextResponse('Not found', { status: 404 })

  const { items, rows } = await getCourseGradebook(user.supabase, courseId)
  const label = (c: (typeof rows)[number]['cells'][number]) => (c.state === 'graded' ? c.marks : c.state === 'pending' ? 'Pending' : c.state === 'missing' ? 'Missing' : '')
  const csv = toCsv([
    ['Roll no', 'Name', ...items.map((i) => `${i.title} (max ${i.max})`), 'Total obtained', 'Total max', 'Percent', 'Enrolment'],
    ...rows
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => [r.rollNo ?? '', r.name, ...r.cells.map(label), r.totals.obtained, r.totals.max, r.totals.percent ?? '', r.removed ? 'Removed' : 'Enrolled']),
  ])

  return new NextResponse(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${course.code}-gradebook.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
