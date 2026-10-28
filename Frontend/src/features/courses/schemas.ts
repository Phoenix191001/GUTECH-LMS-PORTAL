import { z } from 'zod'

/** Course codes are unique and uppercase, e.g. CS-101. */
export const courseCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9._-]{1,19}$/, 'Use 2-20 letters, numbers, dash or dot (e.g. CS-101)')

const title = z.string().trim().min(2, 'Enter a title').max(150, 'Title is too long')
const description = z.string().trim().max(2000, 'Description is too long').optional()

export const createCourseSchema = z.object({ code: courseCode, title, description, teacherId: z.uuid('Choose a teacher') })
export type CreateCourseInput = z.input<typeof createCourseSchema>

export const updateCourseSchema = z.object({ id: z.uuid(), code: courseCode, title, description })
export type UpdateCourseInput = z.input<typeof updateCourseSchema>

export const setCourseTeacherSchema = z.object({ id: z.uuid(), teacherId: z.uuid('Choose a teacher') })

export const enrollStudentsSchema = z.object({
  courseId: z.uuid(),
  studentIds: z.array(z.uuid()).min(1, 'Select at least one student').max(500),
})

export const csvEnrollSchema = z.object({
  courseId: z.uuid(),
  csv: z.string().min(1, 'Choose a CSV file').max(200_000, 'File is too large'),
})

/** Client form (strings only). The server schemas above are authoritative. */
export const courseFormSchema = z.object({
  code: z.string().trim().min(2, 'Enter a course code'),
  title: z.string().trim().min(2, 'Enter a title').max(150),
  description: z.string().trim().max(2000),
  teacherId: z.string(),
})
export type CourseFormValues = z.infer<typeof courseFormSchema>
