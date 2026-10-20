import { describe, expect, it } from 'vitest'
import { liveIntensity, muscleSets, sessionVolume } from './muscles'
import { Exercise, Session, SessionSet } from './types'

const ex = (id: string, muscle: string) => ({ id, muscle }) as Exercise
const set = (p: Partial<SessionSet>): SessionSet => ({ id: Math.random().toString(36), kind: 'work', weight: 50, reps: 10, done: false, done_at: null, ...p })
const session = (rows: [string, SessionSet[]][]): Session => ({
  id: 's',
  user_id: 'u',
  workout_id: null,
  name: 'W',
  started_at: '2026-01-01T10:00:00Z',
  finished_at: null,
  notes: '',
  data: { exercises: rows.map(([id, sets]) => ({ exercise_id: id, name: id, rest_sec: 60, superset: '', note: '', rep_min: 8, rep_max: 12, sets })) }
})

describe('muscle sets for the live workout', () => {
  const exercises = [ex('bench', 'Chest'), ex('fly', 'Chest'), ex('squat', 'Quads'), ex('warm', 'Other')]
  const s = session([
    ['warm', [set({ time_sec: 300, reps: null, weight: 0, done: true })]],
    ['bench', [set({ kind: 'warmup', done: true }), set({ done: true }), set({})]],
    ['fly', [set({ done: true })]],
    ['squat', [set({}), set({})]]
  ])
  it('counts done and planned sets, ignoring warm-ups, Other last', () => {
    expect(muscleSets(s, exercises)).toEqual([
      { muscle: 'Chest', done: 2, planned: 3 },
      { muscle: 'Quads', done: 0, planned: 2 },
      { muscle: 'Other', done: 1, planned: 1 }
    ])
  })
  it('logged muscles are bright, planned ones dim', () => {
    expect(liveIntensity(muscleSets(s, exercises))).toEqual({ Chest: 1, Quads: 0.3, Other: 1 })
  })
  it('volume counts done sets only (warm-up included, time sets add nothing)', () => {
    expect(sessionVolume(s)).toBe(50 * 10 * 3)
  })
})
