import { z } from 'zod'
import { emailSchema, newPasswordSchema } from '@/features/auth/schemas'

export const ROLES = ['admin', 'teacher', 'student'] as const

const fullName = z.string().trim().min(2, 'Enter the full name').max(120, 'Name is too long')
const rollNo = z
  .string()
  .trim()
  .max(40, 'Roll number is too long')
  .regex(/^[A-Za-z0-9._\-/ ]*$/, 'Use letters, numbers and - . / only')

export const createUserSchema = z
  .object({
    fullName,
    email: emailSchema,
    role: z.enum(ROLES),
    rollNo: rollNo.optional(),
    tempPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    const policy = newPasswordSchema(v.email).safeParse(v.tempPassword)
    if (!policy.success) ctx.addIssue({ code: 'custom', path: ['tempPassword'], message: policy.error.issues[0]?.message ?? 'Weak password' })
    if (v.role !== 'student' && v.rollNo) ctx.addIssue({ code: 'custom', path: ['rollNo'], message: 'Roll numbers are for students only' })
  })
export type CreateUserInput = z.input<typeof createUserSchema>

export const updateUserSchema = z
  .object({
    id: z.uuid(),
    fullName,
    role: z.enum(ROLES),
    rollNo: rollNo.optional(),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.role !== 'student' && v.rollNo) ctx.addIssue({ code: 'custom', path: ['rollNo'], message: 'Roll numbers are for students only' })
  })
export type UpdateUserInput = z.input<typeof updateUserSchema>

export const resetPasswordSchemaAdmin = z.object({ id: z.uuid(), password: z.string().optional() })

/** Form shape used by the add/edit dialog. */
export const userFormSchema = z
  .object({
    fullName,
    email: z.string().trim(),
    role: z.enum(ROLES),
    rollNo: z.string().trim(),
    tempPassword: z.string(),
    isActive: z.boolean(),
  })
export type UserFormValues = z.infer<typeof userFormSchema>

export const csvImportSchema = z.object({ csv: z.string().min(1, 'Choose a CSV file').max(500_000, 'File is too large') })
