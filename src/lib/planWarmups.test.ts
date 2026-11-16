import { describe, expect, it, vi } from 'vitest'

// prefs.ts reads localStorage when it loads (actions.ts imports it), so provide one before any import runs
vi.hoisted(() => {
  const m = new Map<string, string>()
  const ls = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true })
})
import { buildSessionExercise, warmupShare } from './actions'
import { emptyDB, Exercise, Session } from './types'

const ex: Exercise = { id: 'e', user_id: 'u', name: 'Incline Chest Press', muscle: 'Chest', notes: '', setup: '', image_path: null, rest_sec: 150, created_at: '' }
const cfg = { sets: 2, rep_min: 6, rep_max: 8, weight: 60, rest_sec: 150, superset: '', drop_last: false, note: '' }
const set = (kind: 'warmup' | 'work', weight: number, reps: number) => ({ id: Math.random().toString(36), kind, weight, reps, done: true, done_at: '2026-11-15T15:00:00Z' })

describe('plan warm-up sets', () => {
  it('come before the work sets with last time’s warm-up weights and reps', () => {
    const last: Session = {
      id: 's1', user_id: 'u', workout_id: 'w', name: 'Upper A', started_at: '2026-11-15T15:00:00Z', finished_at: '2026-11-15T16:00:00Z', notes: '',
      data: { exercises: [{ exercise_id: 'e', name: ex.name, rest_sec: 150, superset: '', note: '', rep_min: 6, rep_max: 8, sets: [set('warmup', 30, 8), set('warmup', 50, 6), set('work', 65, 7), set('work', 55, 11)] }] }
    }
    const se = buildSessionExercise({ ...emptyDB(), sessions: [last] }, ex, { ...cfg, warmup_sets: 2 }, undefined, 2.5)
    expect(se.sets.map((s) => [s.kind, s.weight, s.reps])).toEqual([
      ['warmup', 30, 8],
      ['warmup', 50, 6],
      ['work', 65, null],
      ['work', 55, null]
    ])
  })
  it('without a last time: 50% and 75% of the first work weight; none when the plan has none', () => {
    const se = buildSessionExercise(emptyDB(), ex, { ...cfg, warmup_sets: 2 }, undefined, 2.5)
    expect(se.sets.map((s) => [s.kind, s.weight])).toEqual([
      ['warmup', 30],
      ['warmup', 45],
      ['work', 60],
      ['work', 60]
    ])
    expect(buildSessionExercise(emptyDB(), ex, cfg, undefined, 2.5).sets.every((s) => s.kind === 'work')).toBe(true)
    expect([warmupShare(0, 1), warmupShare(0, 3), warmupShare(2, 3)]).toEqual([0.75, 0.4, 0.8])
  })
})
