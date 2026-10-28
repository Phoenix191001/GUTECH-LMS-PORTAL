import {
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Link2,
  Presentation,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fileIconKind } from '@/lib/files'

const ICONS: Record<ReturnType<typeof fileIconKind>, { icon: LucideIcon; tone: string }> = {
  pdf: { icon: FileText, tone: 'bg-danger-soft text-danger' },
  doc: { icon: FileText, tone: 'bg-info-soft text-info' },
  slides: { icon: Presentation, tone: 'bg-warning-soft text-warning' },
  sheet: { icon: FileSpreadsheet, tone: 'bg-success-soft text-success' },
  image: { icon: FileImage, tone: 'bg-primary-soft text-primary-soft-foreground' },
  video: { icon: FileVideo, tone: 'bg-info-soft text-info' },
  archive: { icon: FileArchive, tone: 'bg-muted text-muted-foreground' },
  file: { icon: FileIcon, tone: 'bg-muted text-muted-foreground' },
}

export function FileKindIcon({
  mime,
  name,
  link,
  className,
}: {
  mime?: string | null
  name?: string | null
  link?: boolean
  className?: string
}) {
  const { icon: Icon, tone } = link ? { icon: Link2, tone: 'bg-info-soft text-info' } : ICONS[fileIconKind(mime, name)]
  return (
    <span aria-hidden className={cn('grid size-11 shrink-0 place-items-center rounded-xl', tone, className)}>
      <Icon className="size-5" />
    </span>
  )
}
