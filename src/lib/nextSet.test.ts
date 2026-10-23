import { describe, expect, it } from 'vitest'
import { nextSetLabel } from './nextSet'
import type { Session, SessionSet } from './types'

const set = (done: boolean): SessionSet => ({ id: Math.random().toString(36), kind: 'work', weight: 60, reps: 8, done, done_at: null })

function session(exs: { name: string; superset?: string; sets: boolean[] }[]): Session {
  return {
    id: 's1',
    user_id: 'u',
    workout_id: null,
    name: 'Upper A',
    started_at: '2026-10-23T10:00:00Z',
    finished_at: null,
    notes: '',
    data: {
      exercises: exs.map((e, i) => ({
        exercise_id: `e${i}`,
        name: e.name,
        rest_sec: 90,
        superset: e.superset ?? '',
        note: '',
        rep_min: 6,
        rep_max: 8,
        sets: e.sets.map(set)
      }))
    }
  }
}

describe('nextSetLabel', () => {
  it('points to the next set of the same exercise', () => {
    expect(nextSetLabel(session([{ name: 'Bench', sets: [true, false, false] }, { name: 'Row', sets: [false] }]), 0)).toBe('Bench · Set 2 of 3')
  })
  it('moves on to the next exercise when this one is done', () => {
    expect(nextSetLabel(session([{ name: 'Bench', sets: [true, true] }, { name: 'Row', sets: [false, false] }]), 0)).toBe('Row · Set 1 of 2')
  })
  it('goes back to an earlier exercise with sets left after the last one', () => {
    expect(nextSetLabel(session([{ name: 'Bench', sets: [true, false] }, { name: 'Row', sets: [true] }]), 1)).toBe('Bench · Set 2 of 2')
  })
  it('starts a superset round again at the first exercise of the group', () => {
    const s = session([
      { name: 'Bench', superset: 'A', sets: [true, false] },
      { name: 'Pull up', superset: 'A', sets: [true, false] },
      { name: 'Curl', sets: [false] }
    ])
    expect(nextSetLabel(s, 1)).toBe('Bench · Set 2 of 2')
  })
  it('says when everything is logged', () => {
    expect(nextSetLabel(session([{ name: 'Bench', sets: [true] }]), 0)).toBe('All sets logged')
  })
})
