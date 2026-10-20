import { describe, expect, it } from 'vitest'
import raw from '../data/library.json'
import { EQUIPMENT, Exercise, MUSCLES } from './types'
import { NAME_TO_LIB, exerciseFromLibrary, fromRaw, libIdForExercise, libIdOf, libImageUrl, libPath, linkedLibIds, searchLibrary } from './library'
import { buildStarterPlan } from './seed'
import { PROGRAMS, uniqueExercises } from './programs'
import { X } from './programCatalog'

const LIB = (raw as unknown as Parameters<typeof fromRaw>[0][]).map(fromRaw)
const ids = new Set(LIB.map((e) => e.id))
const ex = (name: string, image_path: string | null = null): Exercise => ({
  id: name,
  user_id: 'u',
  name,
  muscle: 'Chest',
  notes: '',
  setup: '',
  image_path,
  rest_sec: 90,
  created_at: ''
})

describe('library data', () => {
  it('has the whole free-exercise-db with GymLog muscles and equipment', () => {
    expect(LIB.length).toBeGreaterThan(850)
    for (const e of LIB) {
      expect(e.muscles.length).toBeGreaterThan(0)
      for (const m of [...e.muscles, ...e.secondary]) expect(MUSCLES).toContain(m)
      expect(EQUIPMENT).toContain(e.equipment)
      expect(['weight_reps', 'reps', 'time']).toContain(e.tracking)
      expect(e.frames).toBeGreaterThan(0)
    }
  })

  it('guesses what a set records', () => {
    const by = (id: string) => LIB.find((e) => e.id === id)!
    expect(by('Barbell_Squat').tracking).toBe('weight_reps')
    expect(by('Pushups').tracking).toBe('reps')
    expect(by('Plank').tracking).toBe('time')
    expect(by('Worlds_Greatest_Stretch').tracking).toBe('time')
  })
})

describe('photos for built-in exercises', () => {
  it('every starter-plan exercise resolves to a library photo', () => {
    const { exercises } = buildStarterPlan('u', [], 0)
    for (const e of exercises) {
      const id = libIdForExercise(e)
      expect(id, e.name).toBeTruthy()
      expect(ids.has(id!), `${e.name} -> ${id}`).toBe(true)
      expect(e.image_path).toBe(libPath(id!))
    }
  })

  it('every exercise in the ready-made programs resolves to a library photo', () => {
    const names = new Set([...Object.values(X).map((x) => x.name), ...PROGRAMS.flatMap((p) => uniqueExercises(p).map((x) => x.name))])
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(30)
    for (const name of names) {
      const id = libIdForExercise(ex(name))
      expect(id, name).toBeTruthy()
      expect(ids.has(id!), `${name} -> ${id}`).toBe(true)
    }
  })

  it('every mapped id exists in the library', () => {
    for (const [name, id] of Object.entries(NAME_TO_LIB)) expect(ids.has(id), `${name} -> ${id}`).toBe(true)
  })

  it('a user photo wins over the name match; a lib: link wins over the name', () => {
    expect(libIdForExercise(ex('Plank', 'exercises/me.jpg'))).toBeNull()
    expect(libIdForExercise(ex('Plank', 'lib:Side_Bridge'))).toBe('Side_Bridge')
    expect(libIdForExercise(ex('Something new'))).toBeNull()
  })
})

describe('links and urls', () => {
  it('round-trips lib: paths', () => {
    expect(libIdOf(libPath('3_4_Sit-Up'))).toBe('3_4_Sit-Up')
    expect(libIdOf('exercises/abc.jpg')).toBeNull()
    expect(libIdOf(null)).toBeNull()
  })

  it('builds the CDN url for each frame', () => {
    expect(libImageUrl('Barbell_Squat')).toBe('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg')
    expect(libImageUrl('Barbell_Squat', 1)).toMatch(/\/1\.jpg$/)
  })

  it('creates a linked exercise and recognises it as added', () => {
    const squat = LIB.find((e) => e.id === 'Barbell_Squat')!
    const e = exerciseFromLibrary(squat, 'u')
    expect(e.image_path).toBe('lib:Barbell_Squat')
    expect(e.muscle).toBe('Quads')
    expect(e.equipment).toBe('Barbell')
    expect(linkedLibIds([e]).get('Barbell_Squat')).toBe(e.id)
    // starter names count too
    expect(linkedLibIds([ex('Bench Press (Barbell)')]).has('Barbell_Bench_Press_-_Medium_Grip')).toBe(true)
  })
})

describe('searchLibrary', () => {
  it('matches every word against name, muscle and equipment', () => {
    const r = searchLibrary(LIB, { q: 'bench press dumbbell' })
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((e) => e.equipment === 'Dumbbell' || /dumbbell|db/i.test(e.name))).toBe(true)
    expect(searchLibrary(LIB, { q: 'quads' }).every((e) => [...e.muscles, ...e.secondary].includes('Quads'))).toBe(true)
  })

  it('ranks names that start with the query first', () => {
    expect(searchLibrary(LIB, { q: 'squat' })[0].name.toLowerCase().startsWith('squat')).toBe(true)
  })

  it('filters by muscle, equipment and level', () => {
    const r = searchLibrary(LIB, { muscle: 'Chest', equipment: 'Machine', level: 'Beginner' })
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((e) => e.muscles.includes('Chest') && e.equipment === 'Machine' && e.level === 'Beginner')).toBe(true)
    expect(searchLibrary(LIB, { muscle: 'All', equipment: '', level: 'All' }).length).toBe(LIB.length)
  })
})
