import { useStore } from './store'
import { DB, Exercise, Session, SessionExercise, SessionSet, SetKind, Workout, trackingOf } from './types'
import { lastPerformance } from './pr'
import { nowIso, uid } from './uid'
import { roundTo } from './format'
import { suggestProgression } from './progression'
import { getPrefs } from './prefs'

const st = () => useStore.getState()
const userId = () => st().user?.id ?? 'local'

export function newSet(kind: SetKind, weight: number): SessionSet {
  return { id: uid(), kind, weight, reps: null, done: false, done_at: null }
}

/**
 * Build the rows for one exercise, pre-filled from the last time it was done (falls back to the template weight).
 * When every work set last time reached the top of the rep range, the work weights go up by `increment`.
 */
export function buildSessionExercise(
  db: DB,
  exercise: Exercise,
  cfg: {
    sets: number
    rep_min: number
    rep_max: number
    weight: number
    rest_sec: number
    superset: string
    drop_last: boolean
    note: string
  },
  excludeSessionId?: string,
  increment = getPrefs().increment
): SessionExercise {
  const last = lastPerformance(db, exercise.id, excludeSessionId)
  const progression = suggestProgression(last, cfg.rep_min, cfg.rep_max, increment)
  const bump = progression?.kind === 'increase' ? progression.delta : 0
  const lastWork = last?.sets.filter((s) => s.kind === 'work' || s.kind === 'failure') ?? []
  const lastDrop = last?.sets.find((s) => s.kind === 'drop')
  const rows: SessionSet[] = []
  for (let i = 0; i < cfg.sets; i++) {
    const ref = lastWork[i] ?? lastWork[lastWork.length - 1]
    rows.push(newSet('work', ref ? roundTo(ref.weight + bump, 0.01) : cfg.weight))
  }
  if (cfg.drop_last && cfg.sets > 0) {
    const base = rows[rows.length - 1].weight
    rows.push(newSet('drop', lastDrop ? lastDrop.weight : roundTo(base * 0.75, 0.5)))
  }
  return {
    exercise_id: exercise.id,
    name: exercise.name,
    rest_sec: cfg.rest_sec,
    superset: cfg.superset,
    note: cfg.note,
    rep_min: cfg.rep_min,
    rep_max: cfg.rep_max,
    sets: rows,
    progression
  }
}

/** Undo (or re-apply) the suggested weight increase on the sets that are not logged yet. */
export function toggleProgression(se: SessionExercise): SessionExercise {
  const p = se.progression
  if (!p || p.kind !== 'increase') return se
  const sign = p.applied === false ? 1 : -1
  return {
    ...se,
    progression: { ...p, applied: p.applied === false },
    sets: se.sets.map((s) => (s.kind === 'work' && !s.done ? { ...s, weight: roundTo(s.weight + sign * p.delta, 0.01) } : s))
  }
}

export function startSessionFromWorkout(workout: Workout): string {
  const { db } = st()
  const wes = db.workout_exercises.filter((w) => w.workout_id === workout.id).sort((a, b) => a.position - b.position)
  const exercises: SessionExercise[] = []
  for (const we of wes) {
    const ex = db.exercises.find((e) => e.id === we.exercise_id)
    if (!ex) continue
    exercises.push(buildSessionExercise(db, ex, we))
  }
  const session: Session = {
    id: uid(),
    user_id: userId(),
    workout_id: workout.id,
    name: workout.name,
    started_at: nowIso(),
    finished_at: null,
    notes: '',
    data: { exercises }
  }
  st().save('sessions', session)
  return session.id
}

export function startEmptySession(): string {
  const session: Session = {
    id: uid(),
    user_id: userId(),
    workout_id: null,
    name: 'Quick workout',
    started_at: nowIso(),
    finished_at: null,
    notes: '',
    data: { exercises: [] }
  }
  st().save('sessions', session)
  return session.id
}

export function addExerciseToSession(sessionId: string, exercise: Exercise) {
  const { db } = st()
  const s = db.sessions.find((x) => x.id === sessionId)
  if (!s) return
  const last = lastPerformance(db, exercise.id, sessionId)
  // a timed exercise (warm-up, plank) usually starts with one set; everything else with three
  const lastWorkCount = last?.sets.filter((x) => x.kind === 'work' || x.kind === 'failure').length ?? (trackingOf(exercise) === 'time' ? 1 : 3)
  const se = buildSessionExercise(db, exercise, {
    sets: Math.max(1, lastWorkCount),
    rep_min: 8,
    rep_max: 12,
    weight: 0,
    rest_sec: exercise.rest_sec,
    superset: '',
    drop_last: false,
    note: ''
  }, sessionId)
  st().save('sessions', { ...s, data: { exercises: [...s.data.exercises, se] } })
}

export function finishSession(sessionId: string) {
  const s = st().db.sessions.find((x) => x.id === sessionId)
  if (!s) return
  // drop empty planned rows so history stays clean
  const exercises = s.data.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) }))
    .filter((e) => e.sets.length > 0)
  st().save('sessions', { ...s, finished_at: nowIso(), data: { exercises } })
  st().clearRest()
}

export function discardSession(sessionId: string) {
  st().remove('sessions', sessionId)
  st().clearRest()
}

export function removeWorkout(id: string) {
  const { db, remove } = st()
  for (const we of db.workout_exercises.filter((w) => w.workout_id === id)) remove('workout_exercises', we.id)
  remove('workouts', id)
}

export function removeExercise(id: string) {
  const { db, remove, repo } = st()
  const img = db.exercises.find((e) => e.id === id)?.image_path
  if (img) void repo?.deleteImage(img)
  for (const we of db.workout_exercises.filter((w) => w.exercise_id === id)) remove('workout_exercises', we.id)
  remove('exercises', id)
}

export function duplicateWorkout(id: string) {
  const { db, save } = st()
  const w = db.workouts.find((x) => x.id === id)
  if (!w) return
  const copy: Workout = {
    ...w,
    id: uid(),
    name: w.name + ' (copy)',
    position: db.workouts.length,
    created_at: nowIso()
  }
  save('workouts', copy)
  for (const we of db.workout_exercises.filter((x) => x.workout_id === id)) {
    save('workout_exercises', { ...we, id: uid(), workout_id: copy.id })
  }
}
