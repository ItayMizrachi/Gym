import { describe, expect, it } from 'vitest'
import { plateaus } from './plateau'
import { emptyDB, type DB } from './types'

const NOW = new Date('2026-10-21T12:00:00Z')

function db(weights: number[], daysAgoLast = 2): DB {
  const d = emptyDB()
  d.exercises = [{ id: 'e', user_id: 'u', name: 'Bench', muscle: 'Chest', notes: '', setup: '', image_path: null, rest_sec: 90, created_at: '' }]
  d.sessions = weights.map((w, i) => {
    const t = new Date(NOW.getTime() - (daysAgoLast + (weights.length - 1 - i) * 3) * 86400_000).toISOString()
    return {
      id: 's' + i, user_id: 'u', workout_id: null, name: 'W', started_at: t, finished_at: t, notes: '',
      data: { exercises: [{ exercise_id: 'e', name: 'Bench', rest_sec: 90, superset: '', note: '', rep_min: 5, rep_max: 5, sets: [{ id: 'x' + i, kind: 'work', weight: w, reps: 5, done: true, done_at: t }] }] }
    }
  })
  return d
}

describe('plateaus', () => {
  it('flags a lift with no new best for 4 sessions', () => {
    const r = plateaus(db([80, 85, 90, 90, 88, 90, 87]), NOW)
    expect(r).toHaveLength(1)
    expect(r[0].sessions).toBe(4)
  })
  it('does not flag a lift that is still improving', () => {
    expect(plateaus(db([80, 82, 84, 86, 88, 90]), NOW)).toHaveLength(0)
  })
  it('needs enough history and recent training', () => {
    expect(plateaus(db([90, 90, 90, 90]), NOW)).toHaveLength(0)
    expect(plateaus(db([90, 85, 85, 85, 85, 85], 40), NOW)).toHaveLength(0)
  })
})
