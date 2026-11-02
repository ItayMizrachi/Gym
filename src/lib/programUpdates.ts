import type { DB, Exercise, Workout, WorkoutExercise } from './types'
import { fmtRest } from './format'
import { fmtTarget, programById, resolveExercises, type Program, type ProgramExercise, type ProgramWorkout } from './programs'
import { uid } from './uid'

/*
 * Ready-made programs change over time (src/lib/programData.ts, `version`). A copy someone already saved is theirs
 * and never changes by itself: its workouts remember the program and version they came from, and when the
 * library has a newer version the Train tab says so. They can look at the changes and update, or keep theirs.
 */

export interface OutdatedProgram {
  program: Program
  /** their saved workouts that came from it */
  workouts: Workout[]
}

export const programVersion = (p: Program) => p.version ?? 1

/** Saved programs whose library version moved on (one entry per program). */
export function outdatedPrograms(db: DB): OutdatedProgram[] {
  const byId = new Map<string, Workout[]>()
  for (const w of db.workouts) if (w.program) byId.set(w.program, [...(byId.get(w.program) ?? []), w])
  const out: OutdatedProgram[] = []
  for (const [id, workouts] of byId) {
    const program = programById(id)
    if (program && workouts.some((w) => (w.program_version ?? 1) < programVersion(program))) {
      out.push({ program, workouts: [...workouts].sort((a, b) => a.position - b.position) })
    }
  }
  return out
}

/** Each workout of the program with the saved workout it became: same name first, else the same place. */
function pairWorkouts(p: Program, saved: Workout[]): { pw: ProgramWorkout; w: Workout | null }[] {
  const used = new Set<string>()
  const pairs = p.workouts.map((pw) => {
    const w = saved.find((x) => !used.has(x.id) && x.name.trim().toLowerCase() === pw.name.toLowerCase()) ?? null
    if (w) used.add(w.id)
    return { pw, w }
  })
  return pairs.map((pair, i) => {
    if (pair.w) return pair
    const w = saved.filter((x) => !used.has(x.id))[0] ?? null
    if (w && i < saved.length) {
      used.add(w.id)
      return { ...pair, w }
    }
    return pair
  })
}

export interface WorkoutChanges {
  name: string
  lines: string[]
}

const rowLine = (pe: ProgramExercise) => `${pe.sets} × ${fmtTarget(pe)}`

/** What the update would change, per workout, in plain words. Empty when their copy already matches. */
export function programChanges(db: DB, o: OutdatedProgram): WorkoutChanges[] {
  const nameOf = new Map(db.exercises.map((e) => [e.id, e.name]))
  const out: WorkoutChanges[] = []
  for (const { pw, w } of pairWorkouts(o.program, o.workouts)) {
    if (!w) {
      out.push({ name: pw.name, lines: ['New workout'] })
      continue
    }
    const mine = db.workout_exercises.filter((r) => r.workout_id === w.id).sort((a, b) => a.position - b.position)
    const pool = [...mine]
    const lines: string[] = []
    for (const pe of pw.exercises) {
      const i = pool.findIndex((r) => (nameOf.get(r.exercise_id) ?? '').toLowerCase() === pe.name.toLowerCase())
      if (i < 0) {
        lines.push(`Added ${pe.name}${pe.warmup ? ' (warm-up)' : ''}: ${rowLine(pe)}`)
        continue
      }
      const r = pool.splice(i, 1)[0]
      // everything that changed for one exercise on one line
      const parts: string[] = []
      if (r.sets !== pe.sets || r.rep_min !== pe.rep_min || r.rep_max !== pe.rep_max)
        parts.push(`${rowLine(pe)} (was ${r.sets} × ${fmtTarget({ ...r, tracking: pe.tracking })})`)
      if (r.rest_sec !== pe.rest_sec) parts.push(`rest ${fmtRest(pe.rest_sec)} (was ${fmtRest(r.rest_sec)})`)
      if (r.drop_last !== !!pe.drop) parts.push(pe.drop ? 'drop set added' : 'no drop set')
      if ((r.superset || '') !== (pe.superset || '')) parts.push(pe.superset ? 'in a superset' : 'no superset')
      if (!!r.warmup !== !!pe.warmup) parts.push(pe.warmup ? 'warm-up only' : 'working sets')
      if ((r.note || '') !== (pe.note || '') && pe.note) parts.push('new note')
      if (parts.length) lines.push(`${pe.name}: ${parts.join(', ')}`)
    }
    for (const r of pool) lines.push(`Removed ${nameOf.get(r.exercise_id) ?? 'an exercise'}`)
    // order only matters when nothing else explains it
    const mineOrder = mine.map((r) => (nameOf.get(r.exercise_id) ?? '').toLowerCase()).filter((n) => pw.exercises.some((pe) => pe.name.toLowerCase() === n))
    const theirOrder = pw.exercises.map((pe) => pe.name.toLowerCase()).filter((n) => mineOrder.includes(n))
    if (mineOrder.join('|') !== theirOrder.join('|')) lines.push('New exercise order')
    if (lines.length) out.push({ name: w.name, lines })
  }
  return out
}

export interface ProgramUpdate {
  exercises: Exercise[]
  workouts: Workout[]
  rows: WorkoutExercise[]
  remove: string[]
}

/**
 * The rows that make their copy match the new version: each workout's exercises are replaced (exercises they
 * already have are reused by name, so history and records carry on); their name, folder and days stay.
 */
export function programUpdate(db: DB, o: OutdatedProgram, userId: string): ProgramUpdate {
  const { program } = o
  const { exercises, idByName } = resolveExercises(program, userId, db.exercises)
  const folder = o.workouts[0]?.folder ?? program.name
  let nextPos = db.workouts.reduce((m, w) => Math.max(m, w.position + 1), 0)
  const workouts: Workout[] = []
  const rows: WorkoutExercise[] = []
  const remove: string[] = []
  const version = programVersion(program)
  for (const { pw, w } of pairWorkouts(program, o.workouts)) {
    const target: Workout = w
      ? { ...w, notes: pw.notes, program_version: version }
      : { id: uid(), user_id: userId, name: pw.name, notes: pw.notes, position: nextPos++, created_at: new Date().toISOString(), folder, program: program.id, program_version: version }
    workouts.push(target)
    const old = w ? db.workout_exercises.filter((r) => r.workout_id === w.id) : []
    remove.push(...old.map((r) => r.id))
    pw.exercises.forEach((pe, position) => {
      const exercise_id = idByName.get(pe.name.toLowerCase())!
      rows.push({
        id: uid(),
        user_id: userId,
        workout_id: target.id,
        exercise_id,
        position,
        sets: pe.sets,
        rep_min: pe.rep_min,
        rep_max: pe.rep_max,
        // a plan weight they set stays with the exercise
        weight: old.find((r) => r.exercise_id === exercise_id)?.weight ?? 0,
        rest_sec: pe.rest_sec,
        superset: pe.superset,
        drop_last: !!pe.drop,
        note: pe.note,
        ...(pe.warmup ? { warmup: true } : {})
      })
    })
  }
  // saved workouts the new version no longer has stay as they are (they are theirs), just marked up to date
  for (const w of o.workouts) if (!workouts.some((x) => x.id === w.id)) workouts.push({ ...w, program_version: version })
  return { exercises, workouts, rows, remove }
}

/** "Keep mine": stop asking about this version. */
export const keepMine = (o: OutdatedProgram): Workout[] => o.workouts.map((w) => ({ ...w, program_version: programVersion(o.program) }))
