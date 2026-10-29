import { describe, expect, it } from 'vitest'
import { weeklyRecap } from './recap'
import { emptyDB, Session } from './types'

const sess = (id: string, at: string, weight: number): Session => ({
  id,
  user_id: 'u',
  workout_id: null,
  name: 'W',
  started_at: at,
  finished_at: at,
  notes: '',
  data: { exercises: [{ exercise_id: 'bench', name: 'Bench', sets: [{ id: id + 's', kind: 'work', weight, reps: 5, done: true }] } as never] }
})

describe('weekly recap', () => {
  // Sunday 1 Nov 2026 starts a week (weeks start on Sunday)
  const db = { ...emptyDB(), sessions: [sess('a', '2026-10-20T18:00:00', 80), sess('b', '2026-10-27T18:00:00', 85)] }
  it('looks back on last week at the start of a new one', () => {
    const r = weeklyRecap(db, new Date('2026-11-01T10:00:00'))!
    expect(r).toMatchObject({ week: '2026-10-25', workouts: 1, sets: 1, records: 1, best: { exerciseId: 'bench', weight: 85, reps: 5 } })
    expect(r.volumeChange).toBe(Math.round(((425 - 400) / 400) * 100))
  })
  it('stays away later in the week, and after an empty week', () => {
    expect(weeklyRecap(db, new Date('2026-11-04T10:00:00'))).toBeNull()
    expect(weeklyRecap(db, new Date('2026-11-08T10:00:00'))).toBeNull()
  })
})
