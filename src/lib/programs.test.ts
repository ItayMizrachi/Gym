import { describe, expect, it } from 'vitest'
import { PROGRAMS, buildProgram, fmtTarget, freeFolderName, programById } from './programs'
import { EQUIPMENT, Exercise, MUSCLES, Workout } from './types'

const ex = (name: string, id = name): Exercise => ({
  id,
  user_id: 'u',
  name,
  muscle: 'Chest',
  notes: '',
  setup: '',
  image_path: null,
  rest_sec: 90,
  created_at: ''
})
const wk = (folder: string | undefined, position: number): Workout => ({ id: `w${position}`, user_id: 'u', name: 'x', notes: '', position, created_at: '', folder })

describe('program library', () => {
  it('has 5–6 well-formed programs with unique ids', () => {
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(5)
    expect(new Set(PROGRAMS.map((p) => p.id)).size).toBe(PROGRAMS.length)
    for (const p of PROGRAMS) {
      expect(p.description.length).toBeGreaterThan(40)
      expect(p.workouts.length).toBeGreaterThan(0)
      for (const w of p.workouts)
        for (const e of w.exercises) {
          expect(MUSCLES).toContain(e.muscle)
          expect(EQUIPMENT).toContain(e.equipment)
          expect(e.sets).toBeGreaterThan(0)
          expect(e.rep_min).toBeGreaterThan(0)
          expect(e.rep_max).toBeGreaterThanOrEqual(e.rep_min)
        }
    }
  })

  it('looks programs up by id', () => {
    expect(programById('strength-5x5')?.name).toBe('5×5 Strength')
    expect(programById('nope')).toBeUndefined()
  })

  it('formats targets for reps and timed exercises', () => {
    expect(fmtTarget({ rep_min: 8, rep_max: 12, tracking: 'weight_reps' })).toBe('8–12 reps')
    expect(fmtTarget({ rep_min: 5, rep_max: 5, tracking: 'weight_reps' })).toBe('5 reps')
    expect(fmtTarget({ rep_min: 30, rep_max: 60, tracking: 'time' })).toBe('30–60 s')
  })
})

describe('buildProgram', () => {
  const p = programById('upper-lower-4')!

  it('creates one row per workout and per exercise slot, in a folder named after the program', () => {
    const r = buildProgram(p, 'u', [], [])
    expect(r.folder).toBe(p.name)
    expect(r.workouts.map((w) => w.name)).toEqual(p.workouts.map((w) => w.name))
    expect(r.workouts.every((w) => w.folder === p.name && w.user_id === 'u')).toBe(true)
    const slots = p.workouts.reduce((a, w) => a + w.exercises.length, 0)
    expect(r.workout_exercises.length).toBe(slots)
    // every link points at a workout and an exercise that exist
    const wIds = new Set(r.workouts.map((w) => w.id))
    const eIds = new Set(r.exercises.map((e) => e.id))
    for (const we of r.workout_exercises) {
      expect(wIds.has(we.workout_id)).toBe(true)
      expect(eIds.has(we.exercise_id)).toBe(true)
    }
    // positions run 0..n-1 inside each workout
    for (const w of r.workouts) {
      const pos = r.workout_exercises.filter((x) => x.workout_id === w.id).map((x) => x.position)
      expect(pos).toEqual(pos.map((_, i) => i))
    }
  })

  it('creates each new exercise once, with equipment and tracking', () => {
    const r = buildProgram(p, 'u', [], [])
    const names = r.exercises.map((e) => e.name)
    expect(new Set(names).size).toBe(names.length)
    const plank = r.exercises.find((e) => e.name === 'Plank')!
    expect(plank.tracking).toBe('time')
    expect(plank.equipment).toBe('Bodyweight')
    expect(r.exercises.find((e) => e.name === 'Squat (Barbell)')?.tracking).toBe('weight_reps')
  })

  it('reuses exercises the user already has (name match ignores case)', () => {
    const mine = [ex('bench press (barbell)', 'my-bench'), ex('Plank', 'my-plank')]
    const r = buildProgram(p, 'u', mine, [])
    expect(r.exercises.some((e) => e.name.toLowerCase() === 'bench press (barbell)')).toBe(false)
    expect(r.exercises.some((e) => e.name === 'Plank')).toBe(false)
    expect(r.workout_exercises.filter((x) => x.exercise_id === 'my-bench').length).toBe(1)
    expect(r.workout_exercises.filter((x) => x.exercise_id === 'my-plank').length).toBe(1)
  })

  it('places workouts after existing ones and picks a free folder name', () => {
    const existing = [wk(p.name, 0), wk('', 4)]
    const r = buildProgram(p, 'u', [], existing)
    expect(r.folder).toBe(`${p.name} 2`)
    expect(r.workouts.map((w) => w.position)).toEqual([5, 6, 7, 8])
  })

  it('keeps program settings on each slot and starts weights at 0', () => {
    const r = buildProgram(programById('strength-5x5')!, 'u', [], [])
    const first = r.workout_exercises[0]
    expect([first.sets, first.rep_min, first.rep_max, first.rest_sec, first.weight]).toEqual([5, 5, 5, 180, 0])
  })
})

describe('freeFolderName', () => {
  it('counts up until a name is free, ignoring case', () => {
    expect(freeFolderName('PPL', [])).toBe('PPL')
    expect(freeFolderName('PPL', [wk('ppl', 0), wk('PPL 2', 1)])).toBe('PPL 3')
  })
})
