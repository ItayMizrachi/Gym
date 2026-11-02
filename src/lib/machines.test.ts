import { describe, expect, it } from 'vitest'
import { lastPerformance, priorSets, sessionPRs } from './pr'
import { emptyDB, type Session } from './types'

const set = (id: string, weight: number, reps: number) => ({ id, kind: 'work' as const, weight, reps, done: true, done_at: '2026-01-01T10:00:00Z' })
const sess = (id: string, day: string, weight: number, machine?: string): Session => ({
  id,
  user_id: 'u',
  workout_id: null,
  name: 'x',
  started_at: `${day}T10:00:00Z`,
  finished_at: `${day}T11:00:00Z`,
  notes: '',
  data: { exercises: [{ exercise_id: 'fly', name: 'Fly', rest_sec: 60, superset: '', note: '', rep_min: 8, rep_max: 12, sets: [set(id + 's', weight, 10)], ...(machine ? { machine } : {}) }] }
})

describe('two machines for one exercise', () => {
  const db = { ...emptyDB(), sessions: [sess('a', '2026-01-01', 50), sess('b', '2026-01-02', 25, '2')] }
  it('last time and records follow the machine; no machine given = all of them', () => {
    expect(lastPerformance(db, 'fly', undefined, '')!.sets[0].weight).toBe(50)
    expect(lastPerformance(db, 'fly', undefined, '2')!.sets[0].weight).toBe(25)
    expect(priorSets(db, 'fly').length).toBe(2)
    expect(priorSets(db, 'fly', undefined, '2').map((s) => s.weight)).toEqual([25])
  })
  it('a set on the lighter machine is a record there, not compared with the heavier one', () => {
    const today = sess('c', '2026-01-03', 30, '2')
    expect(sessionPRs({ ...db, sessions: [...db.sessions, today] }, today).length).toBe(1)
  })
})
