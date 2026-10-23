import type { Session, SessionExercise, WorkoutExercise } from './types'
import { fmtRest } from './format'
import { uid } from './uid'

/*
 * After a workout started from a plan: did the lifter change the plan's shape on the way (order, exercises
 * added or removed, number of sets, a drop set, rest, supersets)? If so, offer to write it back.
 * Weights and reps are not plan changes: they move every week on their own.
 * Compare the session as it was before finishing (planned rows still in it), not the cleaned-up history.
 */

const mainSets = (e: SessionExercise) => e.sets.filter((s) => s.kind === 'work' || s.kind === 'failure').length
const hasDrop = (e: SessionExercise) => e.sets.some((s) => s.kind === 'drop')

/** Pair each session exercise with a plan row of the same exercise (in order, each row used once). */
function match(session: Session, wes: WorkoutExercise[]) {
  const pool = [...wes].sort((a, b) => a.position - b.position)
  const used = new Set<string>()
  const pairs = session.data.exercises.map((e) => {
    const we = pool.find((w) => w.exercise_id === e.exercise_id && !used.has(w.id)) ?? null
    if (we) used.add(we.id)
    return { e, we }
  })
  const removed = pool.filter((w) => !used.has(w.id))
  return { pool, pairs, removed }
}

/** Plain-language list of what differs from the plan; empty when nothing did. */
export function planChanges(session: Session, wes: WorkoutExercise[], nameOf: (exerciseId: string) => string): string[] {
  if (!wes.length && !session.data.exercises.length) return []
  const { pool, pairs, removed } = match(session, wes)
  const out: string[] = []
  for (const { e, we } of pairs) {
    if (!we) {
      out.push(`Added ${e.name}`)
      continue
    }
    const n = Math.max(1, mainSets(e))
    if (n !== we.sets) out.push(`${e.name}: ${n} sets instead of ${we.sets}`)
    if (hasDrop(e) !== we.drop_last) out.push(`${e.name}: ${hasDrop(e) ? 'drop set added' : 'no drop set'}`)
    if (e.rest_sec !== we.rest_sec) out.push(`${e.name}: rest ${fmtRest(e.rest_sec)} instead of ${fmtRest(we.rest_sec)}`)
    if ((e.superset || '') !== (we.superset || '')) out.push(`${e.name}: ${e.superset ? `superset ${e.superset}` : 'no superset'}`)
  }
  for (const w of removed) out.push(`Removed ${nameOf(w.exercise_id)}`)
  // order: compare the kept exercises in session order with their order in the plan
  const kept = pairs.filter((p) => p.we).map((p) => p.we!.id)
  const planOrder = pool.filter((w) => kept.includes(w.id)).map((w) => w.id)
  if (kept.join() !== planOrder.join()) out.push('New exercise order')
  return out
}

/** The plan rows to save and to delete so the plan matches this session's shape. */
export function planUpdate(session: Session, wes: WorkoutExercise[], workoutId: string, userId: string): { save: WorkoutExercise[]; remove: string[] } {
  const { pairs, removed } = match(session, wes)
  const save = pairs.map(({ e, we }, position): WorkoutExercise => {
    const firstWork = e.sets.find((s) => s.kind === 'work' || s.kind === 'failure')
    return {
      ...(we ?? {
        id: uid(),
        user_id: userId,
        workout_id: workoutId,
        exercise_id: e.exercise_id,
        rep_min: e.rep_min,
        rep_max: e.rep_max,
        weight: firstWork?.weight ?? 0,
        note: ''
      }),
      position,
      sets: Math.max(1, mainSets(e)),
      drop_last: hasDrop(e),
      rest_sec: e.rest_sec,
      superset: e.superset || ''
    } as WorkoutExercise
  })
  return { save, remove: removed.map((w) => w.id) }
}

/**
 * A plan made from a finished workout (e.g. one imported from Hevy): same exercises in the same order, the number
 * of work sets, the rep range you actually did, the weight of your first work set, rest and supersets.
 * Exercises with only warm-up sets are left out.
 */
export function workoutFromSession(session: Session, userId: string, position: number, now: string) {
  const id = uid()
  const workout = { id, user_id: userId, name: session.name.trim() || 'Workout', notes: '', position, created_at: now }
  const rows: WorkoutExercise[] = []
  for (const e of session.data.exercises) {
    const work = e.sets.filter((s) => s.kind === 'work' || s.kind === 'failure')
    if (!work.length) continue
    const reps = work.map((s) => s.reps ?? 0).filter((r) => r > 0)
    rows.push({
      id: uid(),
      user_id: userId,
      workout_id: id,
      exercise_id: e.exercise_id,
      position: rows.length,
      sets: work.length,
      rep_min: reps.length ? Math.min(...reps) : e.rep_min || 8,
      rep_max: reps.length ? Math.max(...reps) : e.rep_max || 12,
      weight: work[0].weight ?? 0,
      rest_sec: e.rest_sec || 90,
      superset: e.superset || '',
      drop_last: e.sets.some((s) => s.kind === 'drop'),
      note: ''
    })
  }
  return { workout, rows }
}
