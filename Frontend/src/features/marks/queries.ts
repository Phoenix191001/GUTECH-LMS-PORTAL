import 'server-only'
import { unwrap, unwrapList } from '@/lib/actions'
import type { Supabase } from '@/lib/auth'
import { loadDirectory } from '@/features/shared/directory'
import { assignmentCell, quizCell, totals, type Cell, type GridRow } from './logic'

export type GradeItem = {
  key: string
  type: 'assignment' | 'quiz'
  id: string
  title: string
  max: number
  /** due date (assignment) or closing time (quiz) */
  date: string
}

const PAGE = 1000

/** PostgREST returns at most 1000 rows per request; this walks every page. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

/** Published assignments and quizzes of a course, as gradebook columns (oldest first). */
export async function loadItems(supabase: Supabase, courseId: string): Promise<GradeItem[]> {
  const [assignments, quizzes] = await Promise.all([
    supabase.from('assignments').select('id, title, max_marks, due_at').eq('course_id', courseId).eq('is_published', true).order('due_at'),
    supabase.from('quizzes').select('id, title, closes_at').eq('course_id', courseId).eq('is_published', true).order('closes_at'),
  ])
  const quizRows = unwrapList(quizzes)
  // students cannot read quiz_questions, so the max comes from a definer function
  const quizMax = await Promise.all(quizRows.map(async (q) => Number(unwrap(await supabase.rpc('quiz_max_marks', { qid: q.id })))))

  const items: GradeItem[] = [
    ...unwrapList(assignments).map((a) => ({ key: `a:${a.id}`, type: 'assignment' as const, id: a.id, title: a.title, max: Number(a.max_marks), date: a.due_at })),
    ...quizRows.map((q, i) => ({ key: `q:${q.id}`, type: 'quiz' as const, id: q.id, title: q.title, max: quizMax[i] ?? 0, date: q.closes_at })),
  ]
  return items.sort((a, b) => a.date.localeCompare(b.date))
}

export type StudentLine = { item: GradeItem; cell: Cell; feedback: string | null; recordedAt: string | null }

/** One student's marks in a course (RLS restricts a student to their own rows). */
export async function getStudentGradebook(supabase: Supabase, courseId: string, studentId: string) {
  const items = await loadItems(supabase, courseId)
  const aIds = items.filter((i) => i.type === 'assignment').map((i) => i.id)
  const qIds = items.filter((i) => i.type === 'quiz').map((i) => i.id)
  const [subs, attempts] = await Promise.all([
    aIds.length ? supabase.from('submissions').select('assignment_id, marks_obtained, feedback, graded_at').eq('student_id', studentId).in('assignment_id', aIds) : Promise.resolve({ data: [], error: null }),
    qIds.length ? supabase.from('quiz_attempts').select('quiz_id, status, score, submitted_at').eq('student_id', studentId).in('quiz_id', qIds) : Promise.resolve({ data: [], error: null }),
  ])
  const subMap = new Map(unwrapList(subs).map((s) => [s.assignment_id, s]))
  const attemptMap = new Map<string, NonNullable<typeof attempts.data>>()
  for (const a of unwrapList(attempts)) attemptMap.set(a.quiz_id, [...(attemptMap.get(a.quiz_id) ?? []), a])

  const lines: StudentLine[] = items.map((item) => {
    if (item.type === 'assignment') {
      const s = subMap.get(item.id)
      return { item, cell: assignmentCell({ due_at: item.date }, s), feedback: s?.feedback ?? null, recordedAt: s?.graded_at ?? null }
    }
    const list = attemptMap.get(item.id) ?? []
    const latest = list.map((a) => a.submitted_at).filter((d): d is string => !!d).sort().at(-1) ?? null
    return { item, cell: quizCell({ closes_at: item.date }, list), feedback: null, recordedAt: latest }
  })
  return { lines, totals: totals(lines.map((l) => ({ cell: l.cell, max: l.item.max }))) }
}

/** The teacher's grid: every enrolled student (and removed ones who have work) against every item. */
export async function getCourseGradebook(supabase: Supabase, courseId: string) {
  const items = await loadItems(supabase, courseId)
  const aIds = items.filter((i) => i.type === 'assignment').map((i) => i.id)
  const qIds = items.filter((i) => i.type === 'quiz').map((i) => i.id)

  const [enrolled, subs, attempts] = await Promise.all([
    fetchAll((from, to) => supabase.from('enrollments').select('student_id').eq('course_id', courseId).range(from, to)),
    aIds.length ? fetchAll((from, to) => supabase.from('submissions').select('assignment_id, student_id, marks_obtained').in('assignment_id', aIds).range(from, to)) : Promise.resolve([]),
    qIds.length ? fetchAll((from, to) => supabase.from('quiz_attempts').select('quiz_id, student_id, status, score').in('quiz_id', qIds).range(from, to)) : Promise.resolve([]),
  ])

  const enrolledIds = new Set(enrolled.map((e) => e.student_id))
  const subMap = new Map(subs.map((s) => [`${s.assignment_id}:${s.student_id}`, s]))
  const attemptMap = new Map<string, typeof attempts>()
  for (const a of attempts) {
    const k = `${a.quiz_id}:${a.student_id}`
    attemptMap.set(k, [...(attemptMap.get(k) ?? []), a])
  }
  const studentIds = new Set([...enrolledIds, ...subs.map((s) => s.student_id), ...attempts.map((a) => a.student_id)])
  const dir = await loadDirectory(supabase, [...studentIds])

  const rows: GridRow[] = [...studentIds].map((studentId) => {
    const cells = items.map((item) =>
      item.type === 'assignment'
        ? assignmentCell({ due_at: item.date }, subMap.get(`${item.id}:${studentId}`))
        : quizCell({ closes_at: item.date }, attemptMap.get(`${item.id}:${studentId}`) ?? []),
    )
    return {
      studentId,
      name: dir.get(studentId)?.full_name ?? 'Former member',
      rollNo: dir.get(studentId)?.roll_no ?? null,
      removed: !enrolledIds.has(studentId),
      cells,
      totals: totals(cells.map((cell, i) => ({ cell, max: items[i]!.max }))),
    }
  })
  return { items, rows }
}
