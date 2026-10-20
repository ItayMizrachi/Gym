import { Exercise, Tracking, Workout, WorkoutExercise } from './types'
import { uid, nowIso } from './uid'
import { SINGLE_WORKOUTS, WEEKLY_PROGRAMS } from './programData'

/** One exercise slot inside a ready-made workout. For 'time' exercises rep_min / rep_max are seconds. */
export interface ProgramExercise {
  name: string
  muscle: string
  equipment: string
  tracking: Tracking
  sets: number
  rep_min: number
  rep_max: number
  rest_sec: number
  superset: string
  note: string
}

export interface ProgramWorkout {
  name: string
  notes: string
  exercises: ProgramExercise[]
}

export type Level = 'Beginner' | 'Intermediate' | 'Advanced'
export const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced']

export interface Program {
  id: string
  /** 'single' = one workout you can start right away; 'weekly' = several workouts spread over the week */
  kind: 'single' | 'weekly'
  name: string
  description: string
  level: Level
  goal: string
  /** days a week (1 for single workouts) */
  days: number
  workouts: ProgramWorkout[]
}

export const SINGLES = SINGLE_WORKOUTS
export const WEEKLIES = WEEKLY_PROGRAMS
export const PROGRAMS: Program[] = [...SINGLE_WORKOUTS, ...WEEKLY_PROGRAMS]

export const programById = (id: string | null | undefined) => PROGRAMS.find((p) => p.id === id)

/* ------------------------------------------------------------- equipment */

export type Gear = 'none' | 'home' | 'gym'
export const GEAR_LABEL: Record<Gear, string> = { none: 'No equipment', home: 'Dumbbells', gym: 'Gym' }
const NO_GEAR = new Set(['Bodyweight', 'Other'])
const HOME_GEAR = new Set(['Bodyweight', 'Other', 'Dumbbell', 'Kettlebell', 'Band'])

/** What you need: nothing, home kit (dumbbells / kettlebell / band), or a gym. */
export function gearOf(p: Program): Gear {
  const eq = p.workouts.flatMap((w) => w.exercises.map((e) => e.equipment))
  if (eq.every((x) => NO_GEAR.has(x))) return 'none'
  if (eq.every((x) => HOME_GEAR.has(x))) return 'home'
  return 'gym'
}

/* -------------------------------------------------------------- duration */

/** Rough length of one workout: each set ~40 s of work (or its target time) plus its rest, plus 5 min to warm up. Rounded to 5 min. */
export function estimateMinutes(w: ProgramWorkout): number {
  let sec = 0
  w.exercises.forEach((e, i) => {
    const work = e.tracking === 'time' ? (e.rep_min + e.rep_max) / 2 : 40
    // inside a superset you rest only after the last exercise of the round
    const next = w.exercises[i + 1]
    const rest = e.superset && next?.superset === e.superset ? Math.min(e.rest_sec, 15) : e.rest_sec
    sec += e.sets * (work + rest)
  })
  return Math.max(10, Math.round((sec / 60 + 5) / 5) * 5)
}

/** Typical workout length for a program (longest of its workouts). */
export const programMinutes = (p: Program) => Math.max(...p.workouts.map(estimateMinutes))

/** Short line for a card: "About 45 min · Gym" or "3 days a week · Dumbbells". */
export function programMeta(p: Program) {
  const lead = p.kind === 'single' ? `About ${programMinutes(p)} min` : `${p.days} days a week`
  return `${lead} · ${GEAR_LABEL[gearOf(p)]}`
}

/** "8–12 reps", "5 reps", "30–60 s" */
export function fmtTarget(e: Pick<ProgramExercise, 'rep_min' | 'rep_max' | 'tracking'>) {
  const r = e.rep_min === e.rep_max ? `${e.rep_min}` : `${e.rep_min}–${e.rep_max}`
  return e.tracking === 'time' ? `${r} s` : `${r} reps`
}

/** Every distinct exercise a program uses (for "N exercises" and later, photo matching). */
export const uniqueExercises = (p: Program) => [...new Map(p.workouts.flatMap((w) => w.exercises).map((e) => [e.name, e])).values()]

/* --------------------------------------------------------------- filters */

export interface ProgramFilter {
  level: Level | null
  gear: Gear | null
  /** singles: max minutes bucket; weeklies: days-a-week bucket */
  size: string | null
}

export const SIZE_OPTIONS: Record<Program['kind'], { id: string; label: string; test: (p: Program) => boolean }[]> = {
  single: [
    { id: 'short', label: 'Up to 30 min', test: (p) => programMinutes(p) <= 30 },
    { id: 'mid', label: '35–40 min', test: (p) => programMinutes(p) > 30 && programMinutes(p) <= 40 },
    { id: 'long', label: '45 min or more', test: (p) => programMinutes(p) > 40 }
  ],
  weekly: [
    { id: '2-3', label: '2–3 days', test: (p) => p.days <= 3 },
    { id: '4', label: '4 days', test: (p) => p.days === 4 },
    { id: '5-6', label: '5–6 days', test: (p) => p.days >= 5 }
  ]
}

export function filterPrograms(list: Program[], f: ProgramFilter): Program[] {
  return list.filter(
    (p) =>
      (!f.level || p.level === f.level) &&
      (!f.gear || gearOf(p) === f.gear) &&
      (!f.size || !!SIZE_OPTIONS[p.kind].find((o) => o.id === f.size)?.test(p))
  )
}

/* ------------------------------------------------------- program → rows */

export interface ProgramRows {
  /** '' for a single workout saved on its own */
  folder: string
  exercises: Exercise[]
  workouts: Workout[]
  workout_exercises: WorkoutExercise[]
  /** exercise id for each program exercise name (lower case) */
  idByName: Map<string, string>
}

/** A folder name not used yet: "Upper / Lower", then "Upper / Lower 2", … */
export function freeFolderName(name: string, existing: Workout[]) {
  const used = new Set(existing.map((w) => (w.folder ?? '').toLowerCase()))
  if (!used.has(name.toLowerCase())) return name
  for (let n = 2; ; n++) if (!used.has(`${name} ${n}`.toLowerCase())) return `${name} ${n}`
}

/**
 * Exercises the program needs: ones the user already has (same name, any case) are reused,
 * missing ones are created once even if several workouts use them.
 */
export function resolveExercises(p: Program, userId: string, existingExercises: Exercise[]) {
  const idByName = new Map(existingExercises.map((e) => [e.name.trim().toLowerCase(), e.id]))
  const exercises: Exercise[] = []
  for (const pe of uniqueExercises(p)) {
    const k = pe.name.toLowerCase()
    if (idByName.has(k)) continue
    const e: Exercise = {
      id: uid(),
      user_id: userId,
      name: pe.name,
      muscle: pe.muscle,
      notes: '',
      setup: '',
      image_path: null,
      rest_sec: pe.rest_sec,
      created_at: nowIso(),
      equipment: pe.equipment,
      tracking: pe.tracking
    }
    exercises.push(e)
    idByName.set(k, e.id)
  }
  return { exercises, idByName }
}

/**
 * Turn a program into rows to save. Weekly programs go into a folder named after the program;
 * a single workout is saved without a folder (it lands in "My workouts").
 */
export function buildProgram(p: Program, userId: string, existingExercises: Exercise[], existingWorkouts: Workout[]): ProgramRows {
  const { exercises, idByName } = resolveExercises(p, userId, existingExercises)
  const folder = p.kind === 'weekly' ? freeFolderName(p.name, existingWorkouts) : ''
  const start = existingWorkouts.reduce((m, w) => Math.max(m, w.position + 1), 0)
  const workouts: Workout[] = []
  const workout_exercises: WorkoutExercise[] = []

  p.workouts.forEach((pw, i) => {
    const w: Workout = { id: uid(), user_id: userId, name: pw.name, notes: pw.notes, position: start + i, created_at: nowIso(), folder }
    workouts.push(w)
    pw.exercises.forEach((pe, j) =>
      workout_exercises.push({
        id: uid(),
        user_id: userId,
        workout_id: w.id,
        exercise_id: idByName.get(pe.name.toLowerCase())!,
        position: j,
        sets: pe.sets,
        rep_min: pe.rep_min,
        rep_max: pe.rep_max,
        weight: 0,
        rest_sec: pe.rest_sec,
        superset: pe.superset,
        drop_last: false,
        note: pe.note
      })
    )
  })
  return { folder, exercises, workouts, workout_exercises, idByName }
}
