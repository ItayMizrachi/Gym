import { describe, expect, it } from 'vitest'
import { daysFromName, daysLabel, programDays, spreadDays, todaysWorkout } from './plan'
import type { DB } from './types'
import { emptyDB } from './types'

describe('spreadDays / programDays', () => {
  it('spreads training days with rest in between', () => {
    expect(spreadDays(3)).toEqual([0, 2, 4])
    expect(spreadDays(9)).toHaveLength(7)
  })
  it('rotates workouts over the days (PPL ×6)', () => {
    expect(programDays(3, 6)).toEqual([[0, 3], [1, 4], [2, 5]])
  })
  it('gives each workout one day when counts match', () => {
    expect(programDays(4, 4)).toEqual([[0], [1], [3], [4]])
  })
})

describe('daysFromName', () => {
  it('reads the day from names like the starter plan', () => {
    expect(daysFromName('Upper A (Monday)')).toEqual([1])
    expect(daysFromName('Lower B (Wednesday)')).toEqual([3])
    expect(daysFromName('Push')).toEqual([])
  })
})

describe('todaysWorkout', () => {
  const wed = new Date(2026, 9, 21, 9, 0) // a Wednesday
  function db(): DB {
    const d = emptyDB()
    d.workouts = [
      { id: 'a', user_id: 'u', name: 'Upper', notes: '', position: 0, created_at: '', days: [1, 4] },
      { id: 'b', user_id: 'u', name: 'Lower', notes: '', position: 1, created_at: '', days: [3] }
    ]
    d.workout_exercises = ['a', 'b'].map((w, i) => ({
      id: 'x' + i, user_id: 'u', workout_id: w, exercise_id: 'e', position: 0, sets: 3, rep_min: 8, rep_max: 10, weight: 0,
      rest_sec: 90, superset: '', drop_last: false, note: ''
    }))
    return d
  }
  it('finds the workout planned for today', () => {
    expect(todaysWorkout(db(), wed)?.id).toBe('b')
  })
  it('is null once it was done today', () => {
    const d = db()
    d.sessions = [{ id: 's', user_id: 'u', workout_id: 'b', name: 'Lower', started_at: new Date(2026, 9, 21, 7).toISOString(), finished_at: new Date(2026, 9, 21, 8).toISOString(), notes: '', data: { exercises: [] } }]
    expect(todaysWorkout(d, wed)).toBeNull()
  })
  it('labels days in week order', () => {
    expect(daysLabel([4, 1])).toBe('Mon, Thu')
  })
})
