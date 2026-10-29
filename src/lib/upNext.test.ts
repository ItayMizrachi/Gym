import { describe, expect, it } from 'vitest'
import { upNext, workoutFatigue } from './upNext'
import { recoveryLoad } from './recovery'
import { DB, Exercise, Session, Workout, WorkoutExercise, emptyDB } from './types'

const ex = (id: string, muscle: string): Exercise =>
  ({ id, user_id: 'u', name: id, muscle, notes: '', setup: '', image_path: null, rest_sec: 90, created_at: '' }) as Exercise
const wk = (id: string, position: number, days?: number[]): Workout => ({ id, user_id: 'u', name: id, notes: '', position, created_at: '', days })
const row = (w: string, e: string): WorkoutExercise => ({ id: w + e, user_id: 'u', workout_id: w, exercise_id: e, position: 0, sets: 3, rep_min: 8, rep_max: 12, weight: 0, rest_sec: 90, superset: '', drop_last: false, note: '' })
const done = (id: string, w: string, e: string, at: string, sets = 6): Session => ({
  id,
  user_id: 'u',
  workout_id: w,
  name: w,
  started_at: at,
  finished_at: at,
  notes: '',
  data: { exercises: [{ exercise_id: e, name: e, sets: Array.from({ length: sets }, (_, i) => ({ id: id + i, kind: 'work', weight: 100, reps: 8, done: true })) } as never] }
})

// Lower A, Upper A, Lower B, Upper B — a rotation where Lower B follows Upper A
function plan(): DB {
  return {
    ...emptyDB(),
    exercises: [ex('squat', 'Quads'), ex('bench', 'Chest'), ex('legpress', 'Quads'), ex('row', 'Back')],
    workouts: [wk('lowerA', 0), wk('upperA', 1), wk('lowerB', 2), wk('upperB', 3)],
    workout_exercises: [row('lowerA', 'squat'), row('upperA', 'bench'), row('lowerB', 'legpress'), row('upperB', 'row')]
  }
}

describe('Up next', () => {
  const now = new Date('2026-10-29T18:00:00')
  it('follows the rotation when the muscles are rested', () => {
    const db = { ...plan(), sessions: [done('s1', 'upperA', 'bench', '2026-10-25T18:00:00')] }
    expect(upNext(db, now)?.workout.id).toBe('lowerB')
  })
  it('skips a workout whose muscles are still recovering, naming them', () => {
    // legs hard yesterday (outside the plan), then Upper A this morning: the rotation says Lower B, but quads are tired
    const db = {
      ...plan(),
      sessions: [done('s0', 'lowerA', 'squat', '2026-10-28T18:00:00', 12), done('s1', 'upperA', 'bench', '2026-10-29T08:00:00')]
    }
    const n = upNext(db, now)!
    expect(n.reason).toBe('fresh')
    expect(n.workout.id).toBe('upperB')
    expect(n.tired).toEqual(['Quads'])
  })
  it("a workout planned for today wins", () => {
    const db = { ...plan(), workouts: plan().workouts.map((w) => (w.id === 'upperB' ? { ...w, days: [now.getDay()] } : w)) }
    expect(upNext(db, now)).toMatchObject({ reason: 'today', workout: { id: 'upperB' } })
  })
  it('fatigue is 0 for a workout with nothing recent', () => {
    const db = plan()
    expect(workoutFatigue(db, db.workouts[0], recoveryLoad(db, now))).toBe(0)
  })
})
