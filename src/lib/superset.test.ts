import { describe, expect, it } from 'vitest'
import { nextInSuperset } from './superset'
import type { Session, SessionSet } from './types'

const s = (done: boolean): SessionSet => ({ id: Math.random().toString(36), kind: 'work', weight: 20, reps: 10, done, done_at: null })
const ex = (superset: string, done: boolean[]) => ({ exercise_id: 'e', name: 'x', rest_sec: 90, superset, note: '', rep_min: 8, rep_max: 12, sets: done.map(s) })
const session = (exs: ReturnType<typeof ex>[]): Session => ({ id: 's', user_id: 'u', workout_id: null, name: 'W', started_at: '', finished_at: null, notes: '', data: { exercises: exs } })

describe('nextInSuperset', () => {
  it('goes to the partner after the first exercise of a round', () => {
    expect(nextInSuperset(session([ex('A', [true, false]), ex('A', [false, false])]), 0)).toBe(1)
  })
  it('rests once the round is complete', () => {
    expect(nextInSuperset(session([ex('A', [true, false]), ex('A', [true, false])]), 1)).toBeNull()
  })
  it('handles three exercises and ignores other groups', () => {
    const se = session([ex('A', [true, false]), ex('B', [false]), ex('A', [false, false]), ex('A', [false, false])])
    expect(nextInSuperset(se, 0)).toBe(2)
  })
  it('skips a partner with nothing left to do', () => {
    expect(nextInSuperset(session([ex('A', [true, true, false]), ex('A', [true])]), 0)).toBeNull()
  })
  it('is null outside a superset', () => {
    expect(nextInSuperset(session([ex('', [true]), ex('', [false])]), 0)).toBeNull()
  })
})
