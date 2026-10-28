import { describe, expect, it } from 'vitest'
import { assignmentCell, classSummary, quizCell, sortAndFilter, totals, type Cell, type GridRow } from './logic'

const past = '2026-01-01T00:00:00Z'
const future = '2999-01-01T00:00:00Z'

describe('assignmentCell', () => {
  it('is graded when marks exist (including 0)', () => {
    expect(assignmentCell({ due_at: past }, { marks_obtained: 0 })).toEqual({ state: 'graded', marks: 0 })
  })
  it('is pending when submitted but not graded', () => {
    expect(assignmentCell({ due_at: past }, { marks_obtained: null })).toEqual({ state: 'pending' })
  })
  it('is missing after the deadline with no submission, open before it', () => {
    expect(assignmentCell({ due_at: past }, null)).toEqual({ state: 'missing' })
    expect(assignmentCell({ due_at: future }, null)).toEqual({ state: 'open' })
  })
})

describe('quizCell', () => {
  it('uses the best graded attempt', () => {
    expect(
      quizCell({ closes_at: past }, [
        { status: 'graded', score: 4 },
        { status: 'graded', score: 7 },
        { status: 'graded', score: 5 },
      ]),
    ).toEqual({ state: 'graded', marks: 7 })
  })
  it('is pending while a short answer awaits grading', () => {
    expect(quizCell({ closes_at: past }, [{ status: 'submitted', score: 2 }])).toEqual({ state: 'pending' })
  })
  it('is missing if the window closed without an attempt', () => {
    expect(quizCell({ closes_at: past }, [])).toEqual({ state: 'missing' })
  })
})

describe('totals', () => {
  const entries: { cell: Cell; max: number }[] = [
    { cell: { state: 'graded', marks: 18 }, max: 20 },
    { cell: { state: 'graded', marks: 6 }, max: 10 },
    { cell: { state: 'pending' }, max: 50 },
    { cell: { state: 'missing' }, max: 50 },
    { cell: { state: 'open' }, max: 50 },
  ]
  it('excludes pending, missing and open items from total and percentage', () => {
    expect(totals(entries)).toEqual({ obtained: 24, max: 30, percent: 80, pending: 1, missing: 1 })
  })
  it('has no percentage until something is graded', () => {
    expect(totals([{ cell: { state: 'pending' }, max: 10 }]).percent).toBeNull()
  })
})

describe('sortAndFilter / classSummary', () => {
  const row = (name: string, rollNo: string | null, pct: number | null, missing = 0): GridRow => ({
    studentId: name,
    name,
    rollNo,
    removed: false,
    cells: [],
    totals: { obtained: 0, max: 0, percent: pct, pending: 0, missing },
  })
  const rows = [row('Cara', '10', 90), row('Abe', '2', 40, 1), row('Bo', '1', null)]

  it('sorts by name, roll number (numeric) and total (high first, ungraded last)', () => {
    expect(sortAndFilter(rows, 'name').map((r) => r.name)).toEqual(['Abe', 'Bo', 'Cara'])
    expect(sortAndFilter(rows, 'roll').map((r) => r.name)).toEqual(['Bo', 'Abe', 'Cara'])
    expect(sortAndFilter(rows, 'total').map((r) => r.name)).toEqual(['Cara', 'Abe', 'Bo'])
  })
  it('filters below 50% and missing work', () => {
    expect(sortAndFilter(rows, 'name', 'below50').map((r) => r.name)).toEqual(['Abe'])
    expect(sortAndFilter(rows, 'name', 'missing').map((r) => r.name)).toEqual(['Abe'])
  })
  it('summarises the class', () => {
    expect(classSummary(rows)).toMatchObject({ average: 65, highest: 90, lowest: 40, missing: 1 })
  })
})
