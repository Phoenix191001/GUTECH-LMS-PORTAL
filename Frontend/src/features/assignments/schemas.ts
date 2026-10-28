import { z } from 'zod'
import { uploadedFileSchema } from '@/features/resources/schemas'

const title = z.string().trim().min(2, 'Enter a title').max(150, 'Keep the title under 150 characters')
const instructions = z.string().trim().max(10000, 'Instructions are too long').optional()

/** numeric(6,2) in Postgres: up to 9999.99 */
const marks = z.number({ error: 'Enter a number' }).positive('Must be greater than 0').max(9999.99, 'Too large')

const isoDate = z.iso.datetime({ offset: true, error: 'Choose a due date and time' })

export const assignmentSchema = z.object({
  courseId: z.uuid(),
  title,
  instructions,
  attachment: uploadedFileSchema.optional(),
  dueAt: isoDate,
  maxMarks: marks,
  allowLate: z.boolean(),
  publish: z.boolean(),
})
export type AssignmentInput = z.input<typeof assignmentSchema>

export const updateAssignmentSchema = z.object({
  id: z.uuid(),
  title,
  instructions,
  /** new attachment replaces the old one; `removeAttachment` clears it */
  attachment: uploadedFileSchema.optional(),
  removeAttachment: z.boolean().optional(),
  dueAt: isoDate,
  maxMarks: marks,
  allowLate: z.boolean(),
})
export type UpdateAssignmentInput = z.input<typeof updateAssignmentSchema>

export const submitAssignmentSchema = z.object({
  assignmentId: z.uuid(),
  textAnswer: z.string().max(20000, 'Your answer is too long').optional(),
  file: uploadedFileSchema.optional(),
})
export type SubmitAssignmentInput = z.input<typeof submitAssignmentSchema>

export const submissionUploadSchema = z.object({
  assignmentId: z.uuid(),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
})

export const gradeSchema = z.object({
  assignmentId: z.uuid(),
  studentId: z.uuid(),
  marks: z.number({ error: 'Enter marks' }).min(0, 'Marks cannot be negative').max(9999.99),
  feedback: z.string().trim().max(5000, 'Feedback is too long').optional(),
})
export type GradeInput = z.input<typeof gradeSchema>

export const deleteAssignmentSchema = z.object({ id: z.uuid(), confirmTitle: z.string().optional() })

/** Client-side form shape (strings from inputs). */
export const assignmentFormSchema = z.object({
  title,
  instructions: z.string().max(10000),
  dueAt: z.string().min(1, 'Choose a due date and time'),
  maxMarks: z.string().min(1, 'Enter the maximum marks'),
  allowLate: z.boolean(),
  publish: z.boolean(),
})
export type AssignmentFormValues = z.infer<typeof assignmentFormSchema>
