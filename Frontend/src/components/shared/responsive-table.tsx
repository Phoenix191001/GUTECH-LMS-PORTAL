import * as React from 'react'
import { cn } from '@/lib/utils'

export type Column<T> = {
  key: string
  header: string
  cell: (row: T) => React.ReactNode
  /** Title line of the mobile card (use for exactly one column). */
  primary?: boolean
  /** Rendered at the bottom of the mobile card instead of as a label/value pair. */
  actions?: boolean
  className?: string
  /** Skip this column in the mobile card. */
  hideOnMobile?: boolean
}

/**
 * Table on md+ screens, stacked cards on phones (spec: "tables become stacked cards on small screens").
 * Server-component friendly: no hooks, cells are plain render functions.
 */
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  className,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  caption: string
  className?: string
}) {
  const primary = columns.find((c) => c.primary) ?? columns[0]
  const actions = columns.find((c) => c.actions)
  const details = columns.filter((c) => c !== primary && c !== actions && !c.hideOnMobile)

  return (
    <div className={className}>
      <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-soft)] md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted/60 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-4 py-3', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors hover:bg-muted/40">
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
            {primary && <div className="font-medium">{primary.cell(row)}</div>}
            {details.length > 0 && (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {details.map((c) => (
                  <React.Fragment key={c.key}>
                    <dt className="text-muted-foreground">{c.header}</dt>
                    <dd className="min-w-0 text-right">{c.cell(row)}</dd>
                  </React.Fragment>
                ))}
              </dl>
            )}
            {actions && <div className="mt-3 flex flex-wrap justify-end gap-2 border-t pt-3">{actions.cell(row)}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}
