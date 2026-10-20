import { describe, expect, it } from 'vitest'
import {
  PROGRAMS,
  SINGLES,
  WEEKLIES,
  buildProgram,
  estimateMinutes,
  filterPrograms,
  fmtTarget,
  freeFolderName,
  gearOf,
  programById,
  programMeta
} from './programs'
import { X } from './programCatalog'
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
  it('has about 20 single workouts and 10 weekly programs with unique ids', () => {
    expect(SINGLES.length).toBeGreaterThanOrEqual(20)
    expect(WEEKLIES.length).toBeGreaterThanOrEqual(10)
    expect(SINGLES.every((p) => p.kind === 'single' && p.workouts.length === 1 && p.days === 1)).toBe(true)
    expect(WEEKLIES.every((p) => p.kind === 'weekly' && p.days >= 2 && p.workouts.length >= 2)).toBe(true)
    expect(new Set(PROGRAMS.map((p) => p.id)).size).toBe(PROGRAMS.length)
  })

  it('every program has a description and every exercise has name, muscle, equipment and tracking', () => {
    for (const p of PROGRAMS) {
      expect(p.description.length, p.id).toBeGreaterThan(20)
      expect(new Set(p.workouts.map((w) => w.name)).size, `${p.id} workout names`).toBe(p.workouts.length)
      for (const w of p.workouts)
        for (const e of w.exercises) {
          expect(e.name.trim(), p.id).not.toBe('')
          expect(MUSCLES, e.name).toContain(e.muscle)
          expect(EQUIPMENT, e.name).toContain(e.equipment)
          expect(['weight_reps', 'reps', 'time'], e.name).toContain(e.tracking)
          expect(e.sets).toBeGreaterThan(0)
          expect(e.rep_min).toBeGreaterThan(0)
          expect(e.rep_max).toBeGreaterThanOrEqual(e.rep_min)
          expect(e.rest_sec).toBeGreaterThanOrEqual(0)
        }
    }
  })

  it('uses one definition per exercise name across all programs', () => {
    const seen = new Map<string, string>()
    for (const p of PROGRAMS)
      for (const w of p.workouts)
        for (const e of w.exercises) {
          const sig = `${e.muscle}|${e.equipment}|${e.tracking}`
          const k = e.name.toLowerCase()
          if (seen.has(k)) expect(seen.get(k), e.name).toBe(sig)
          else seen.set(k, sig)
        }
    // the catalog itself has no duplicate names
    const names = Object.values(X).map((e) => e.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })

  it('works out equipment, length and filters', () => {
    expect(gearOf(programById('bodyweight-home')!)).toBe('none')
    expect(gearOf(programById('mobility')!)).toBe('none')
    expect(gearOf(programById('dumbbell-full-body')!)).toBe('home')
    expect(gearOf(programById('machines-only')!)).toBe('gym')
    const quick = programById('full-body-quick')!
    expect(estimateMinutes(quick.workouts[0])).toBeLessThanOrEqual(35)
    expect(programMeta(quick)).toMatch(/^About \d+ min · Gym$/)
    expect(programMeta(programById('ppl-3')!)).toBe('3 days a week · Gym')
    const beginnersAtHome = filterPrograms(PROGRAMS, { level: 'Beginner', gear: 'none', size: null })
    expect(beginnersAtHome.map((p) => p.id)).toContain('bodyweight-home')
    expect(beginnersAtHome.every((p) => p.level === 'Beginner' && gearOf(p) === 'none')).toBe(true)
    expect(filterPrograms(WEEKLIES, { level: null, gear: null, size: '5-6' }).every((p) => p.days >= 5)).toBe(true)
  })

  it('looks programs up by id', () => {
    expect(programById('strength-5x5')?.name).toBe('5×5 Strength')
    expect(programById('push')?.kind).toBe('single')
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

describe('single workouts', () => {
  it('save without a folder and as one workout', () => {
    const r = buildProgram(programById('core')!, 'u', [], [wk('PPL', 0)])
    expect(r.folder).toBe('')
    expect(r.workouts).toHaveLength(1)
    expect(r.workouts[0].folder).toBe('')
    expect(r.workouts[0].name).toBe('Core')
  })
})

describe('freeFolderName', () => {
  it('counts up until a name is free, ignoring case', () => {
    expect(freeFolderName('PPL', [])).toBe('PPL')
    expect(freeFolderName('PPL', [wk('ppl', 0), wk('PPL 2', 1)])).toBe('PPL 3')
  })
})
