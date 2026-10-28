import { z } from 'zod'

export const announcementFields = {
  title: z.string().trim().min(1, 'Add a title').max(120, 'Keep the title under 120 characters'),
  body: z.string().trim().min(1, 'Write a message').max(5000, 'Keep the message under 5000 characters'),
  isPinned: z.boolean(),
}

/** courseId = null means a global announcement (admin only). */
export const createAnnouncementSchema = z.object({ courseId: z.uuid().nullable(), ...announcementFields })
export type CreateAnnouncementInput = z.input<typeof createAnnouncementSchema>

export const updateAnnouncementSchema = z.object({ id: z.uuid(), ...announcementFields })
export type UpdateAnnouncementInput = z.input<typeof updateAnnouncementSchema>

export const markReadSchema = z.object({ ids: z.array(z.uuid()).min(1).max(50) })

export const announcementFormSchema = z.object({
  title: announcementFields.title,
  body: announcementFields.body,
  isPinned: z.boolean(),
})
export type AnnouncementFormValues = z.infer<typeof announcementFormSchema>
