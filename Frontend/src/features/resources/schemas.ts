import { z } from 'zod'

const title = z.string().trim().min(1, 'Add a title').max(150, 'Keep the title under 150 characters')
const description = z.string().trim().max(1000, 'Keep the description under 1000 characters').optional()

export const fileMetaSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
})
export type FileMetaInput = z.infer<typeof fileMetaSchema>

export const uploadRequestSchema = z.object({ courseId: z.uuid() }).extend(fileMetaSchema.shape)

export const uploadedFileSchema = fileMetaSchema.extend({ path: z.string().min(3).max(600) })

export const finalizeResourceSchema = z.object({
  courseId: z.uuid(),
  title,
  description,
  file: uploadedFileSchema,
})
export type FinalizeResourceInput = z.infer<typeof finalizeResourceSchema>

/** Only http(s) links: javascript:, data: etc. are rejected. */
export const externalUrlSchema = z
  .url('Enter a valid link')
  .refine((u) => /^https?:\/\//i.test(u), 'Links must start with http:// or https://')

export const createLinkSchema = z.object({ courseId: z.uuid(), title, description, url: externalUrlSchema })
export type CreateLinkInput = z.infer<typeof createLinkSchema>

export const updateResourceSchema = z.object({
  id: z.uuid(),
  title,
  description,
  url: externalUrlSchema.optional(),
  file: uploadedFileSchema.optional(),
})
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>

/** Client-side form (title/description + optional link); files are handled separately. */
export const resourceFormSchema = z.object({
  title,
  description: z.string().trim().max(1000, 'Keep the description under 1000 characters'),
  url: z.string().trim(),
})
export type ResourceFormValues = z.infer<typeof resourceFormSchema>
