import { describe, expect, it } from 'vitest'
import { currentSet, lockInfo } from './lockscreen'
import type { Session, SessionSet } from './types'

const set = (done: boolean): SessionSet => ({ id: Math.random().toString(36), kind: 'work', weight: 60, reps: 8, done, done_at: null })
const T0 = new Date('2026-10-21T10:00:00Z').getTime()

function session(sets: boolean[][]): Session {
  return {
    id: 's1',
    user_id: 'u',
    workout_id: null,
    name: 'Upper A',
    started_at: new Date(T0).toISOString(),
    finished_at: null,
    notes: '',
    data: {
      exercises: sets.map((ss, i) => ({
        exercise_id: `e${i}`,
        name: i === 0 ? 'Bench Press' : 'Row',
        rest_sec: 90,
        superset: '',
        note: '',
        rep_min: 6,
        rep_max: 8,
        sets: ss.map(set)
      }))
    }
  }
}

describe('currentSet', () => {
  it('is the first set not yet logged, across exercises', () => {
    const cur = currentSet(session([[true, true], [true, false, false]]))
    expect(cur?.ex.name).toBe('Row')
    expect(cur?.index).toBe(1)
    expect(cur?.count).toBe(3)
  })
  it('is null when everything is logged', () => {
    expect(currentSet(session([[true]]))).toBeNull()
  })
})

describe('lockInfo', () => {
  it('shows the exercise, set and workout time without rest', () => {
    const info = lockInfo(session([[true, false]]), null, T0 + 65_000)
    expect(info.title).toBe('Bench Press · Set 2 of 2')
    expect(info.artist).toBe('Workout 1:05')
    expect(info.album).toBe('Upper A')
    expect(info.duration).toBeNull()
    expect(info.exerciseId).toBe('e0')
  })
  it('shows the rest countdown with a progress bar', () => {
    const rest = { endsAt: T0 + 60_000, total: 90, label: 'Bench Press', finished: false }
    const info = lockInfo(session([[true, false]]), rest, T0)
    expect(info.artist).toBe('Rest 1:00 left')
    expect(info.duration).toBe(90)
    expect(info.position).toBe(30)
  })
  it('says when rest is over', () => {
    const rest = { endsAt: T0, total: 90, label: '', finished: true }
    expect(lockInfo(session([[false]]), rest, T0 + 1000).artist).toBe('Rest over · time for the next set')
  })
  it('handles a finished set list', () => {
    expect(lockInfo(session([[true]]), null, T0).title).toBe('All sets done · tap Finish')
  })
})
