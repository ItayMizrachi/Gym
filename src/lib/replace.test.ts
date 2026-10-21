import { beforeEach, describe, expect, it, vi } from 'vitest'

// prefs.ts reads localStorage when it loads (actions.ts imports it), so provide one before any import runs
const mem = vi.hoisted(() => {
  const m = new Map<string, string>()
  const ls = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true })
  return m
})
import { useStore } from './store'
import { replaceExerciseInSession } from './actions'
import { emptyDB, type Exercise, type Session, type SessionSet } from './types'

const ex = (id: string, name: string): Exercise => ({ id, user_id: 'u', name, muscle: 'Quads', notes: '', setup: '', image_path: null, rest_sec: 120, created_at: '' })
const set = (done: boolean, kind: SessionSet['kind'] = 'work'): SessionSet => ({ id: Math.random().toString(36), kind, weight: 60, reps: done ? 8 : null, done, done_at: done ? '2026-10-21T10:00:00Z' : null })

function session(sets: SessionSet[]): Session {
  return {
    id: 's1', user_id: 'u', workout_id: 'w', name: 'Legs', started_at: '2026-10-21T09:00:00Z', finished_at: null, notes: '',
    data: {
      photo_path: 'u/sessions/p.jpg',
      exercises: [
        { exercise_id: 'a', name: 'Hack Squat', rest_sec: 150, superset: '', note: 'slow', rep_min: 6, rep_max: 8, sets },
        { exercise_id: 'c', name: 'Leg Curl', rest_sec: 90, superset: '', note: '', rep_min: 10, rep_max: 12, sets: [set(false)] }
      ]
    }
  }
}

describe('replaceExerciseInSession', () => {
  let saved: Session | null
  beforeEach(() => {
    saved = null
    mem.clear()
    useStore.setState({ save: ((_t: string, row: Session) => (saved = row)) as any })
  })

  it('swaps an untouched exercise and keeps rep range, note and the session photo', () => {
    useStore.setState({ db: { ...emptyDB(), exercises: [ex('a', 'Hack Squat'), ex('b', 'Leg Press'), ex('c', 'Leg Curl')], sessions: [session([set(false), set(false), set(false)])] } })
    replaceExerciseInSession('s1', 0, ex('b', 'Leg Press'))
    const exs = saved!.data.exercises
    expect(exs.map((e) => e.name)).toEqual(['Leg Press', 'Leg Curl'])
    expect(exs[0].sets).toHaveLength(3)
    expect([exs[0].rep_min, exs[0].rep_max, exs[0].note]).toEqual([6, 8, 'slow'])
    expect(saved!.data.photo_path).toBe('u/sessions/p.jpg')
  })

  it('keeps logged sets with the original and moves the rest to the new exercise', () => {
    useStore.setState({ db: { ...emptyDB(), exercises: [ex('a', 'Hack Squat'), ex('b', 'Leg Press'), ex('c', 'Leg Curl')], sessions: [session([set(true), set(false), set(false)])] } })
    replaceExerciseInSession('s1', 0, ex('b', 'Leg Press'))
    const exs = saved!.data.exercises
    expect(exs.map((e) => e.name)).toEqual(['Hack Squat', 'Leg Press', 'Leg Curl'])
    expect(exs[0].sets.every((x) => x.done)).toBe(true)
    expect(exs[0].sets).toHaveLength(1)
    expect(exs[1].sets).toHaveLength(2)
    expect(exs[1].sets.every((x) => !x.done)).toBe(true)
  })
})
