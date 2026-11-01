import { describe, expect, it } from 'vitest'
import { inUse, makeCurrent, unshelveAll } from './folders'
import { emptyDB, Workout } from './types'

const w = (id: string, folder: string, shelved?: boolean): Workout => ({ id, user_id: 'u', name: id, notes: '', position: 0, created_at: '', folder, shelved })

describe('current program', () => {
  it('folds every other workout away and keeps that folder', () => {
    const list = [w('a', 'Ultimate'), w('b', 'Ultimate'), w('c', 'Old'), w('d', '')]
    const changed = makeCurrent(list, 'Ultimate')
    expect(changed.map((x) => [x.id, x.shelved])).toEqual([
      ['c', true],
      ['d', true]
    ])
  })

  it('only changes rows that differ, and brings a shelved folder back', () => {
    const list = [w('a', 'Ultimate', true), w('c', 'Old', false)]
    expect(makeCurrent(list, 'Ultimate').map((x) => [x.id, x.shelved])).toEqual([
      ['a', false],
      ['c', true]
    ])
  })

  it('Up next plans only from the current program, or from everything if all are shelved', () => {
    const db = { ...emptyDB(), workouts: [w('a', 'Ultimate'), w('c', 'Old', true)] }
    expect(inUse(db).workouts.map((x) => x.id)).toEqual(['a'])
    const all = { ...emptyDB(), workouts: [w('c', 'Old', true)] }
    expect(inUse(all)).toBe(all)
  })

  it('Show all programs unshelves everything', () => {
    expect(unshelveAll([w('a', 'x', true), w('b', 'y')]).map((x) => x.id)).toEqual(['a'])
  })
})
