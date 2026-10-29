import { describe, expect, it } from 'vitest'
import { glance } from './coachData'
import { emptyDB, Session } from './types'

const day = 86400000
const sess = (id: string, daysAgo: number, now: number): Session => ({
  id,
  user_id: 't',
  workout_id: null,
  name: 'W',
  started_at: new Date(now - daysAgo * day - 3600000).toISOString(),
  finished_at: new Date(now - daysAgo * day).toISOString(),
  notes: '',
  data: { exercises: [] }
})

describe('trainee at a glance', () => {
  const now = Date.parse('2026-10-29T12:00:00Z')
  it('no workouts yet', () => expect(glance(emptyDB(), now)).toEqual({ daysSince: null, newPRs: 0 }))
  it('days since the latest finished workout', () => {
    const db = { ...emptyDB(), sessions: [sess('a', 9, now), sess('b', 2, now)] }
    expect(glance(db, now).daysSince).toBe(2)
  })
})
