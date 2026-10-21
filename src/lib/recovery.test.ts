import { describe, expect, it } from 'vitest'
import { recoveryLoad, recoveryView } from './recovery'
import { emptyDB, type DB, type SessionSet } from './types'

const NOW = new Date('2026-10-21T12:00:00Z')
const set = (kind: SessionSet['kind'] = 'work'): SessionSet => ({ id: Math.random().toString(36), kind, weight: 50, reps: 8, done: true, done_at: null })

function db(hoursAgo: number, muscle: string, sets: SessionSet[]): DB {
  const d = emptyDB()
  d.exercises = [{ id: 'e', user_id: 'u', name: 'X', muscle, notes: '', setup: '', image_path: null, rest_sec: 90, created_at: '' }]
  const t = new Date(NOW.getTime() - hoursAgo * 3600_000).toISOString()
  d.sessions = [{ id: 's', user_id: 'u', workout_id: null, name: 'W', started_at: t, finished_at: t, notes: '', data: { exercises: [{ exercise_id: 'e', name: 'X', rest_sec: 90, superset: '', note: '', rep_min: 8, rep_max: 8, sets }] } }]
  return d
}

describe('recoveryLoad', () => {
  it('8 hard sets just now reads as fully worked', () => {
    expect(recoveryLoad(db(0, 'Chest', Array.from({ length: 8 }, () => set())), NOW).Chest).toBe(1)
  })
  it('fades over time, slower for big muscles', () => {
    const sets = Array.from({ length: 8 }, () => set())
    expect(recoveryLoad(db(36, 'Chest', sets), NOW).Chest).toBeCloseTo(0.5, 2) // 72 h window
    expect(recoveryLoad(db(36, 'Biceps', sets), NOW).Biceps).toBeCloseTo(0.25, 2) // 48 h window
    expect(recoveryLoad(db(50, 'Biceps', sets), NOW).Biceps).toBeUndefined()
  })
  it('ignores warm-ups and counts drop sets as half', () => {
    expect(recoveryLoad(db(0, 'Back', [set('warmup'), set('drop'), set('drop')]), NOW).Back).toBeCloseTo(1 / 8, 3)
  })
})

describe('recoveryView', () => {
  it('splits muscles into recovering and ready', () => {
    const v = recoveryView(db(2, 'Quads', Array.from({ length: 6 }, () => set())), NOW)
    expect(v.recovering).toEqual(['Quads'])
    expect(v.ready).not.toContain('Quads')
    expect(v.ready).toContain('Chest')
  })
})
