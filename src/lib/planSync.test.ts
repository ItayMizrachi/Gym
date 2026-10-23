import { describe, expect, it } from 'vitest'
import { planChanges, planUpdate } from './planSync'
import type { Session, SessionExercise, SessionSet, SetKind, WorkoutExercise } from './types'

const set = (kind: SetKind = 'work', done = false): SessionSet => ({ id: Math.random().toString(36), kind, weight: 50, reps: 8, done, done_at: null })
const we = (id: string, exercise_id: string, position: number, extra: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id,
  user_id: 'u',
  workout_id: 'w',
  exercise_id,
  position,
  sets: 3,
  rep_min: 6,
  rep_max: 8,
  weight: 50,
  rest_sec: 90,
  superset: '',
  drop_last: false,
  note: 'seat 4',
  ...extra
})
const se = (exercise_id: string, kinds: SetKind[], extra: Partial<SessionExercise> = {}): SessionExercise => ({
  exercise_id,
  name: exercise_id.toUpperCase(),
  rest_sec: 90,
  superset: '',
  note: '',
  rep_min: 6,
  rep_max: 8,
  sets: kinds.map((k) => set(k)),
  ...extra
})
const session = (exercises: SessionExercise[]): Session => ({
  id: 's',
  user_id: 'u',
  workout_id: 'w',
  name: 'Upper A',
  started_at: '2026-10-23T10:00:00Z',
  finished_at: null,
  notes: '',
  data: { exercises }
})
const plan = [we('1', 'a', 0), we('2', 'b', 1)]
const name = (id: string) => id.toUpperCase()

describe('planChanges', () => {
  it('finds nothing when the workout kept the plan (warm-ups do not count)', () => {
    expect(planChanges(session([se('a', ['warmup', 'work', 'work', 'work']), se('b', ['work', 'work', 'work'])]), plan, name)).toEqual([])
  })
  it('lists added sets, rest, an added and a removed exercise and the order', () => {
    const s = session([se('c', ['work']), se('a', ['work', 'work', 'work', 'work'], { rest_sec: 120 })])
    expect(planChanges(s, plan, name)).toEqual(['Added C', 'A: 4 sets instead of 3', 'A: rest 2:00 instead of 1:30', 'Removed B'])
  })
  it('notices a new order', () => {
    expect(planChanges(session([se('b', ['work', 'work', 'work']), se('a', ['work', 'work', 'work'])]), plan, name)).toEqual(['New exercise order'])
  })
})

describe('planUpdate', () => {
  it('rewrites positions and sets, keeps notes, adds and removes rows', () => {
    const s = session([se('b', ['work', 'work', 'work', 'drop']), se('c', ['work', 'work'])])
    const { save, remove } = planUpdate(s, plan, 'w', 'u')
    expect(remove).toEqual(['1'])
    expect(save.map((r) => [r.exercise_id, r.position, r.sets, r.drop_last])).toEqual([
      ['b', 0, 3, true],
      ['c', 1, 2, false]
    ])
    expect(save[0].id).toBe('2')
    expect(save[0].note).toBe('seat 4')
    expect(save[1].workout_id).toBe('w')
  })
})

describe('workoutFromSession', () => {
  it('keeps order, work sets, the rep range done and drops warm-up-only exercises', async () => {
    const { workoutFromSession } = await import('./planSync')
    const warm = se('w', ['warmup'])
    const a = se('a', ['warmup', 'work', 'work', 'drop'])
    a.sets[1].reps = 10
    a.sets[2].reps = 7
    const { workout, rows } = workoutFromSession(session([warm, a]), 'u', 4, 'now')
    expect(workout.name).toBe('Upper A')
    expect(workout.position).toBe(4)
    expect(rows.map((r) => [r.exercise_id, r.sets, r.rep_min, r.rep_max, r.drop_last, r.workout_id === workout.id])).toEqual([['a', 2, 7, 10, true, true]])
  })
})
