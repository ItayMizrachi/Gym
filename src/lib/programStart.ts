import { useStore } from './store'
import { Program, ProgramWorkout, buildProgram, resolveExercises } from './programs'
import { buildSessionExercise } from './actions'
import { Session, SessionExercise } from './types'
import { nowIso, uid } from './uid'

/** Save a program's exercises, workouts and links (parents first, so the cloud sync keeps them in order). */
export function addProgram(p: Program) {
  const { db, save, user } = useStore.getState()
  const rows = buildProgram(p, user?.id ?? 'local', db.exercises, db.workouts)
  rows.exercises.forEach((e) => save('exercises', e))
  rows.workouts.forEach((w) => save('workouts', w))
  rows.workout_exercises.forEach((w) => save('workout_exercises', w))
  return rows
}

/**
 * Start one ready-made workout straight away without saving it as a template.
 * Missing exercises are created (so history and records work); weights fill in from last time when known.
 */
export function startProgramWorkout(p: Program, w: ProgramWorkout = p.workouts[0]): string {
  const { save, user } = useStore.getState()
  const userId = user?.id ?? 'local'
  const { exercises, idByName } = resolveExercises(p, userId, useStore.getState().db.exercises)
  exercises.forEach((e) => save('exercises', e))
  const db = useStore.getState().db
  const list: SessionExercise[] = []
  for (const pe of w.exercises) {
    const ex = db.exercises.find((e) => e.id === idByName.get(pe.name.toLowerCase()))
    if (!ex) continue
    list.push(buildSessionExercise(db, ex, { ...pe, weight: 0, drop_last: false }))
  }
  const session: Session = {
    id: uid(),
    user_id: userId,
    workout_id: null,
    name: w.name,
    started_at: nowIso(),
    finished_at: null,
    notes: '',
    data: { exercises: list }
  }
  save('sessions', session)
  return session.id
}
