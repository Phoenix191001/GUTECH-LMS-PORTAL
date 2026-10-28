import { Skeleton } from '@/components/ui/feedback'

export default function Loading() {
  return (
    <div role="status" aria-label="Loading courses">
      <Skeleton className="mb-2 h-4 w-20" />
      <Skeleton className="mb-8 h-9 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
