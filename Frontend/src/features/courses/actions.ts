'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ActionError, authedAction, parse, unwrap, unwrapList } from '@/lib/actions'
import type { Supabase } from '@/lib/auth'
import { parseCsvObjects } from '@/lib/csv'
import {
  createCourseSchema,
  csvEnrollSchema,
  enrollStudentsSchema,
  setCourseTeacherSchema,
  updateCourseSchema,
  type CreateCourseInput,
  type UpdateCourseInput,
} from './schemas'

const idSchema = z.uuid()

const refresh = (courseId?: string) => {
  revalidatePath('/admin/courses')
  revalidatePath('/courses')
  if (courseId) revalidatePath(`/admin/courses/${courseId}`)
}

async function assertActiveTeacher(supabase: Supabase, teacherId: string) {
  const teacher = unwrap(await supabase.from('profiles').select('id, role, is_active').eq('id', teacherId).maybeSingle())
  if (!teacher || teacher.role !== 'teacher' || !teacher.is_active) throw new ActionError('Choose an active teacher.')
}

function codeTaken(error: { code?: string }) {
  return error.code === '23505'
}

export async function createCourse(input: CreateCourseInput) {
  return authedAction('createCourse', ['admin'], async ({ supabase }) => {
    const v = parse(createCourseSchema, input)
    await assertActiveTeacher(supabase, v.teacherId)
    const { data, error } = await supabase
      .from('courses')
      .insert({ code: v.code, title: v.title, description: v.description || null, teacher_id: v.teacherId })
      .select('id')
      .single()
    if (error) throw new ActionError(codeTaken(error) ? `A course with the code ${v.code} already exists.` : 'Could not create the course.')
    refresh()
    return { id: data.id }
  })
}

export async function updateCourse(input: UpdateCourseInput) {
  return authedAction('updateCourse', ['admin'], async ({ supabase }) => {
    const v = parse(updateCourseSchema, input)
    const { error } = await supabase.from('courses').update({ code: v.code, title: v.title, description: v.description || null }).eq('id', v.id)
    if (error) throw new ActionError(codeTaken(error) ? `A course with the code ${v.code} already exists.` : 'Could not update the course.')
    refresh(v.id)
    return undefined
  })
}

/** Changing the teacher takes effect immediately (RLS follows courses.teacher_id). */
export async function setCourseTeacher(input: { id: string; teacherId: string }) {
  return authedAction('setCourseTeacher', ['admin'], async ({ supabase }) => {
    const v = parse(setCourseTeacherSchema, input)
    await assertActiveTeacher(supabase, v.teacherId)
    unwrap(await supabase.from('courses').update({ teacher_id: v.teacherId }).eq('id', v.id))
    refresh(v.id)
    return undefined
  })
}

/** Deactivating hides the course from students and teachers but keeps all data. */
export async function setCourseActive(courseId: string, active: boolean) {
  return authedAction('setCourseActive', ['admin'], async ({ supabase }) => {
    const id = parse(idSchema, courseId)
    unwrap(await supabase.from('courses').update({ is_active: active }).eq('id', id))
    refresh(id)
    return undefined
  })
}

/** Enrols many students at once. Already-enrolled students are reported, never duplicated. */
export async function enrollStudents(input: { courseId: string; studentIds: string[] }) {
  return authedAction('enrollStudents', ['admin'], async ({ supabase }) => {
    const v = parse(enrollStudentsSchema, input)
    const ids = [...new Set(v.studentIds)]

    const [students, existing] = await Promise.all([
      supabase.from('profiles').select('id').in('id', ids).eq('role', 'student').eq('is_active', true),
      supabase.from('enrollments').select('student_id').eq('course_id', v.courseId).in('student_id', ids),
    ])
    const valid = new Set(unwrapList(students).map((s) => s.id))
    const already = new Set(unwrapList(existing).map((e) => e.student_id))
    const toAdd = ids.filter((id) => valid.has(id) && !already.has(id))

    if (toAdd.length > 0) {
      unwrap(
        await supabase
          .from('enrollments')
          .upsert(toAdd.map((student_id) => ({ course_id: v.courseId, student_id })), { onConflict: 'course_id,student_id', ignoreDuplicates: true }),
      )
    }
    refresh(v.courseId)
    return { added: toAdd.length, alreadyEnrolled: ids.filter((id) => already.has(id)).length, skipped: ids.length - valid.size }
  })
}

/** Removes only the enrollment row. Submissions, attempts and chat history stay. */
export async function removeEnrollment(enrollmentId: string) {
  return authedAction('removeEnrollment', ['admin'], async ({ supabase }) => {
    const id = parse(idSchema, enrollmentId)
    const row = unwrap(await supabase.from('enrollments').select('course_id').eq('id', id).maybeSingle())
    unwrap(await supabase.from('enrollments').delete().eq('id', id))
    refresh(row?.course_id)
    return undefined
  })
}

/* --------------------------- CSV enrolment --------------------------- */

export type CsvPerson = { key: string; id?: string; name?: string; rollNo?: string | null }
export type CsvPreview = { willAdd: CsvPerson[]; alreadyEnrolled: CsvPerson[]; notFound: CsvPerson[] }

/** Matches CSV rows (email or roll_no column) to active students and groups them. */
async function matchCsv(supabase: Supabase, courseId: string, csv: string): Promise<CsvPreview> {
  const records = parseCsvObjects(csv)
  if (records.length === 0) throw new ActionError('The file has no rows. Use a column named email or roll_no.')
  if (records.length > 500) throw new ActionError('Import at most 500 rows at a time.')
  if (!('email' in (records[0] ?? {})) && !('roll_no' in (records[0] ?? {}))) throw new ActionError('Missing column. Use email or roll_no.')

  const emails = [...new Set(records.map((r) => (r.email ?? '').toLowerCase()).filter(Boolean))]
  const rolls = [...new Set(records.map((r) => r.roll_no ?? '').filter(Boolean))]
  const [byEmail, byRoll, enrolled] = await Promise.all([
    emails.length ? supabase.from('profiles').select('id, full_name, email, roll_no').eq('role', 'student').eq('is_active', true).in('email', emails) : Promise.resolve({ data: [], error: null }),
    rolls.length ? supabase.from('profiles').select('id, full_name, email, roll_no').eq('role', 'student').eq('is_active', true).in('roll_no', rolls) : Promise.resolve({ data: [], error: null }),
    supabase.from('enrollments').select('student_id').eq('course_id', courseId).limit(2000),
  ])
  const emailMap = new Map(unwrapList(byEmail).map((p) => [p.email.toLowerCase(), p]))
  const rollMap = new Map(unwrapList(byRoll).map((p) => [p.roll_no ?? '', p]))
  const enrolledSet = new Set(unwrapList(enrolled).map((e) => e.student_id))

  const out: CsvPreview = { willAdd: [], alreadyEnrolled: [], notFound: [] }
  const seen = new Set<string>()
  for (const r of records) {
    const email = (r.email ?? '').toLowerCase()
    const roll = r.roll_no ?? ''
    const key = email || roll
    const hit = (email && emailMap.get(email)) || (roll && rollMap.get(roll)) || null
    if (!key) continue
    if (!hit) {
      out.notFound.push({ key })
      continue
    }
    if (seen.has(hit.id)) continue
    seen.add(hit.id)
    const person = { key, id: hit.id, name: hit.full_name, rollNo: hit.roll_no }
    ;(enrolledSet.has(hit.id) ? out.alreadyEnrolled : out.willAdd).push(person)
  }
  return out
}

/** Dry run: three groups (will be added, already enrolled, not found). Nothing is written. */
export async function previewEnrollmentCsv(input: { courseId: string; csv: string }) {
  return authedAction('previewEnrollmentCsv', ['admin'], async ({ supabase }) => {
    const v = parse(csvEnrollSchema, input)
    return matchCsv(supabase, v.courseId, v.csv)
  })
}

/** Commits only the "will be added" group, recomputed server-side after the admin confirms. */
export async function importEnrollmentsCsv(input: { courseId: string; csv: string }) {
  return authedAction('importEnrollmentsCsv', ['admin'], async ({ supabase }) => {
    const v = parse(csvEnrollSchema, input)
    const preview = await matchCsv(supabase, v.courseId, v.csv)
    const rows = preview.willAdd.flatMap((p) => (p.id ? [{ course_id: v.courseId, student_id: p.id }] : []))
    if (rows.length > 0) {
      unwrap(await supabase.from('enrollments').upsert(rows, { onConflict: 'course_id,student_id', ignoreDuplicates: true }))
    }
    refresh(v.courseId)
    return { added: rows.length, alreadyEnrolled: preview.alreadyEnrolled.length, notFound: preview.notFound.length }
  })
}
