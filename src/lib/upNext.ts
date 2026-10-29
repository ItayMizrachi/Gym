import { DB, Workout } from './types'
import { NextWorkout, suggestNextWorkout } from './stats'
import { recoveryLoad } from './recovery'
import { todaysWorkout } from './plan'

/*
 * Up next on the Train tab (and the home-screen shortcut):
 * 1. a workout planned for today wins;
 * 2. otherwise the rotation (suggestNextWorkout);
 * 3. but when the rotation's pick mostly works muscles that are still recovering and another workout's muscles
 *    are rested, the rested one goes first ('fresh'), naming the tired muscles so the swap makes sense.
 */

export interface UpNext extends Omit<NextWorkout, 'reason'> {
  reason: NextWorkout['reason'] | 'today' | 'fresh'
  /** with 'fresh': the muscles of the skipped workout that are still recovering */
  tired?: string[]
}

/** 0..1: how tired a workout's muscles are, weighted by its planned sets */
export function workoutFatigue(db: DB, w: Workout, load: Record<string, number>): number {
  const muscleOf = new Map(db.exercises.map((e) => [e.id, e.muscle]))
  let sets = 0
  let tired = 0
  for (const r of db.workout_exercises) {
    if (r.workout_id !== w.id) continue
    const m = muscleOf.get(r.exercise_id)
    if (!m || m === 'Other') continue
    const n = Math.max(1, r.sets)
    sets += n
    tired += n * (load[m] ?? 0)
  }
  return sets ? tired / sets : 0
}

const TIRED = 0.5
const RESTED = 0.25

export function upNext(db: DB, now = new Date()): UpNext | null {
  const base = suggestNextWorkout(db)
  const planned = todaysWorkout(db, now)
  if (planned) return { workout: planned, lastDone: base && base.workout.id === planned.id ? base.lastDone : null, reason: 'today' }
  if (!base || base.reason === 'first') return base
  const load = recoveryLoad(db, now)
  if (workoutFatigue(db, base.workout, load) < TIRED) return base

  const withEx = new Set(db.workout_exercises.map((r) => r.workout_id))
  const last = new Map<string, string>()
  for (const s of db.sessions) if (s.finished_at && s.workout_id && (last.get(s.workout_id) ?? '') < s.finished_at) last.set(s.workout_id, s.finished_at)
  const alt = db.workouts
    .filter((w) => w.id !== base.workout.id && withEx.has(w.id))
    .map((w) => ({ w, f: workoutFatigue(db, w, load), at: last.get(w.id) ?? '' }))
    .filter((x) => x.f < RESTED)
    // the one done longest ago first, then plan order
    .sort((a, b) => a.at.localeCompare(b.at) || a.w.position - b.w.position)[0]
  if (!alt) return base

  const muscleOf = new Map(db.exercises.map((e) => [e.id, e.muscle]))
  const tired = [
    ...new Set(
      db.workout_exercises
        .filter((r) => r.workout_id === base.workout.id)
        .map((r) => muscleOf.get(r.exercise_id))
        .filter((m): m is string => !!m && (load[m] ?? 0) >= TIRED)
    )
  ]
  return { workout: alt.w, lastDone: last.get(alt.w.id) ?? null, reason: 'fresh', tired }
}
