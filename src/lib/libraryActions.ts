import { useStore } from './store'
import { Exercise, trackingOf } from './types'
import { uid } from './uid'
import { LibraryExercise, exerciseFromLibrary, linkedLibIds } from './library'
import { addExerciseToSession } from './actions'

/** The user's exercise for a library entry: the one already linked (or matching by name), else a new one. */
export function ensureLibraryExercise(lib: LibraryExercise): Exercise {
  const { db, save, user } = useStore.getState()
  const linked = linkedLibIds(db.exercises).get(lib.id)
  const found = db.exercises.find((e) => e.id === linked) ?? db.exercises.find((e) => e.name.trim().toLowerCase() === lib.name.toLowerCase())
  if (found) return found
  const e = exerciseFromLibrary(lib, user?.id ?? 'local')
  save('exercises', e)
  return e
}

/** Append an exercise to a workout template with sensible starting values (same as the workout editor). */
export function appendToWorkout(workoutId: string, ex: Exercise) {
  const { db, save, user } = useStore.getState()
  const wes = db.workout_exercises.filter((x) => x.workout_id === workoutId)
  const timed = trackingOf(ex) === 'time'
  save('workout_exercises', {
    id: uid(),
    user_id: user?.id ?? 'local',
    workout_id: workoutId,
    exercise_id: ex.id,
    position: wes.length ? Math.max(...wes.map((x) => x.position)) + 1 : 0,
    sets: 3,
    rep_min: timed ? 30 : 8,
    rep_max: timed ? 60 : 12,
    weight: 0,
    rest_sec: ex.rest_sec,
    superset: '',
    drop_last: false,
    note: ''
  })
}

/** The workout in progress, if any (newest first). */
export function activeSession() {
  return [...useStore.getState().db.sessions].filter((s) => !s.finished_at).sort((a, b) => (b.started_at > a.started_at ? 1 : -1))[0] ?? null
}

export { addExerciseToSession }
