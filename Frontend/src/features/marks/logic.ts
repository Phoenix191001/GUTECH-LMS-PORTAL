/** Pure gradebook rules (no I/O) so they can be unit-tested. */

export type Cell =
  | { state: 'graded'; marks: number }
  | { state: 'pending' } // submitted, waiting for the teacher
  | { state: 'missing' } // deadline/window passed and nothing submitted
  | { state: 'open' } // not due yet / not started

type SubLite = { marks_obtained: number | null } | null | undefined
type AttemptLite = { status: 'in_progress' | 'submitted' | 'graded'; score: number | null }

export function assignmentCell(a: { due_at: string }, sub: SubLite, now = Date.now()): Cell {
  if (sub && sub.marks_obtained !== null) return { state: 'graded', marks: Number(sub.marks_obtained) }
  if (sub) return { state: 'pending' }
  return now > new Date(a.due_at).getTime() ? { state: 'missing' } : { state: 'open' }
}

/** Several attempts: the best graded score counts (matches the gradebook view). */
export function quizCell(q: { closes_at: string }, attempts: AttemptLite[], now = Date.now()): Cell {
  const graded = attempts.filter((a) => a.status === 'graded' && a.score !== null)
  if (graded.length > 0) return { state: 'graded', marks: Math.max(...graded.map((a) => Number(a.score))) }
  if (attempts.some((a) => a.status === 'submitted')) return { state: 'pending' }
  if (attempts.some((a) => a.status === 'in_progress')) return { state: 'open' }
  return now > new Date(q.closes_at).getTime() ? { state: 'missing' } : { state: 'open' }
}

export type Totals = { obtained: number; max: number; percent: number | null; pending: number; missing: number }

/**
 * Ungraded and missing items are EXCLUDED from the total and percentage until graded
 * (spec Feature 7, req. 7). `percent` is null when nothing has been graded yet.
 */
export function totals(entries: { cell: Cell; max: number }[]): Totals {
  let obtained = 0
  let max = 0
  let pending = 0
  let missing = 0
  for (const { cell, max: itemMax } of entries) {
    if (cell.state === 'graded') {
      obtained += cell.marks
      max += itemMax
    } else if (cell.state === 'pending') pending++
    else if (cell.state === 'missing') missing++
  }
  return { obtained, max, percent: max > 0 ? Math.round((obtained / max) * 1000) / 10 : null, pending, missing }
}

export type GridRow = { studentId: string; name: string; rollNo: string | null; removed: boolean; cells: Cell[]; totals: Totals }

export type SortKey = 'name' | 'roll' | 'total'
export type FilterKey = 'below50' | 'missing'

export function sortAndFilter(rows: GridRow[], sort: SortKey, filter?: FilterKey): GridRow[] {
  let out = rows
  if (filter === 'below50') out = out.filter((r) => r.totals.percent !== null && r.totals.percent < 50)
  if (filter === 'missing') out = out.filter((r) => r.totals.missing > 0)
  const cmp: Record<SortKey, (a: GridRow, b: GridRow) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    roll: (a, b) => (a.rollNo ?? '￿').localeCompare(b.rollNo ?? '￿', undefined, { numeric: true }) || a.name.localeCompare(b.name),
    total: (a, b) => (b.totals.percent ?? -1) - (a.totals.percent ?? -1) || a.name.localeCompare(b.name),
  }
  return [...out].sort(cmp[sort])
}

export function classSummary(rows: GridRow[]) {
  const pcts = rows.map((r) => r.totals.percent).filter((p): p is number => p !== null)
  return {
    average: pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : null,
    highest: pcts.length ? Math.max(...pcts) : null,
    lowest: pcts.length ? Math.min(...pcts) : null,
    ungraded: rows.reduce((n, r) => n + r.totals.pending, 0),
    missing: rows.reduce((n, r) => n + r.totals.missing, 0),
  }
}
