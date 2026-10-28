import { ListSkeleton, Skeleton } from '@/components/ui/feedback'

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="mb-6 h-10 w-2/3" />
      <Skeleton className="mb-6 h-14 w-full rounded-2xl" />
      <ListSkeleton rows={4} />
    </div>
  )
}
