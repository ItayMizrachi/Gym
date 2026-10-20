import { describe, expect, it } from 'vitest'
import { exerciseMeta, facets, filterExercises, recentExerciseIds } from './exerciseFilters'
import { Exercise, Session } from './types'

const ex = (name: string, muscle: string, equipment?: string) => ({ id: name, name, muscle, equipment }) as Exercise
const list = [ex('Bench Press', 'Chest', 'Barbell'), ex('Chest Fly', 'Chest', 'Machine'), ex('Squat', 'Quads', 'Barbell'), ex('Old One', 'Back')]

describe('exercise filters', () => {
  it('combines muscle, equipment and search', () => {
    expect(filterExercises(list, { muscle: 'Chest' }).map((e) => e.name)).toEqual(['Bench Press', 'Chest Fly'])
    expect(filterExercises(list, { equipment: 'Barbell' }).map((e) => e.name)).toEqual(['Bench Press', 'Squat'])
    expect(filterExercises(list, { muscle: 'Chest', equipment: 'Machine' }).map((e) => e.name)).toEqual(['Chest Fly'])
    expect(filterExercises(list, { q: 'barbell' })).toHaveLength(2)
  })
  it('treats missing equipment as Other', () => {
    expect(filterExercises(list, { equipment: 'Other' }).map((e) => e.name)).toEqual(['Old One'])
    expect(facets(list).equipment).toEqual(['Barbell', 'Machine', 'Other'])
  })
  it('ranks names that start with the query first', () => {
    expect(filterExercises(list, { q: 'ch' }).map((e) => e.name)).toEqual(['Chest Fly', 'Bench Press'])
  })
  it('lists recent exercises newest first', () => {
    const s = (day: string, ids: string[]) => ({ started_at: day, data: { exercises: ids.map((exercise_id) => ({ exercise_id })) } }) as unknown as Session
    expect(recentExerciseIds([s('2026-01-01', ['a', 'b']), s('2026-01-05', ['c', 'a'])])).toEqual(['c', 'a', 'b'])
  })
  it('formats the row meta', () => {
    expect(exerciseMeta(list[0])).toBe('Chest · Barbell')
    expect(exerciseMeta(list[3])).toBe('Back')
  })
})
