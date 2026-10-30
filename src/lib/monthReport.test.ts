import { describe, expect, it } from 'vitest'
import { monthReport } from './monthReport'
import { emptyDB, Session } from './types'

const sess = (id: string, at: string, weight: number, reps = 5): Session => ({
  id,
  user_id: 'u',
  workout_id: null,
  name: 'W',
  started_at: at,
  finished_at: at,
  notes: '',
  data: { exercises: [{ exercise_id: 'bench', name: 'Bench', sets: [{ id: id + 's', kind: 'work', weight, reps, done: true }] } as never] }
})

describe('monthly report', () => {
  const db = { ...emptyDB(), sessions: [sess('a', '2026-09-20T18:00:00', 80), sess('b', '2026-10-05T18:00:00', 85), sess('c', '2026-10-20T18:00:00', 90)] }
  it('counts this month and compares with the last', () => {
    const r = monthReport(db, new Date('2026-10-30T12:00:00'))
    expect(r.workouts).toBe(2)
    expect(r.sets).toBe(2)
    expect(r.volume).toBe(85 * 5 + 90 * 5)
    expect(r.change).toBe(Math.round(((875 - 400) / 400) * 100))
    expect(r.records[0]).toMatchObject({ exerciseId: 'bench', weight: 90 })
  })
})
