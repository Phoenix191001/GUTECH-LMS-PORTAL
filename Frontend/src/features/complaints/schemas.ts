import { z } from 'zod'
import type { ComplaintCategory, ComplaintStatus } from '@/types/database'

export const CATEGORIES: ComplaintCategory[] = ['academic', 'teacher', 'facility', 'technical', 'other']
export const STATUSES: ComplaintStatus[] = ['open', 'in_review', 'resolved', 'rejected']

export const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  academic: 'Academic',
  teacher: 'About a teacher',
  facility: 'Facilities',
  technical: 'Technical issue',
  other: 'Other',
}

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  resolved: 'Resolved',
  rejected: 'Rejected',
}

/** open -> in_review | rejected; in_review -> resolved | rejected; resolved and rejected are closed. */
export const NEXT_STATUSES: Record<ComplaintStatus, ComplaintStatus[]> = {
  open: ['in_review', 'rejected'],
  in_review: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
}

export const canTransition = (from: ComplaintStatus, to: ComplaintStatus) => NEXT_STATUSES[from].includes(to)

/** A response is mandatory when closing a complaint. */
export const needsResponse = (to: ComplaintStatus) => to === 'resolved' || to === 'rejected'

/** Reference number shown to the complainant: first 8 characters of the id. */
export const referenceOf = (id: string) => id.slice(0, 8).toUpperCase()

export const createComplaintSchema = z.object({
  category: z.enum(CATEGORIES as [ComplaintCategory, ...ComplaintCategory[]]),
  courseId: z.uuid().nullable(),
  subject: z.string().trim().min(3, 'Add a short subject').max(150, 'Keep the subject under 150 characters'),
  description: z.string().trim().min(10, 'Please describe the problem in a few words').max(3000, 'Keep the description under 3000 characters'),
})
export type CreateComplaintInput = z.input<typeof createComplaintSchema>

export const updateComplaintSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(STATUSES as [ComplaintStatus, ...ComplaintStatus[]]),
    response: z.string().trim().max(3000, 'Keep the response under 3000 characters').optional(),
  })
  .refine((v) => !needsResponse(v.status) || !!v.response, { path: ['response'], message: 'A response is required to resolve or reject a complaint' })
export type UpdateComplaintInput = z.input<typeof updateComplaintSchema>

export const complaintFormSchema = z.object({
  category: z.enum(CATEGORIES as [ComplaintCategory, ...ComplaintCategory[]]),
  courseId: z.string(),
  subject: createComplaintSchema.shape.subject,
  description: createComplaintSchema.shape.description,
})
export type ComplaintFormValues = z.infer<typeof complaintFormSchema>
