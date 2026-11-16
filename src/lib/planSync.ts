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
/** sets that match the plan row's count: warm-ups for a warm-up-only row, work sets otherwise */
const planSets = (e: SessionExercise, we: Pick<WorkoutExercise, 'warmup'> | null) => (we?.warmup ? warmSets(e) : mainSets(e))
const warmSets = (e: SessionExercise) => e.sets.filter((s) => s.kind === 'warmup').length
/**
 * Warm-ups the lifter added or removed during the workout (compared with what it started with, so automatic
 * warm-ups alone are not a change). Older sessions do not know what they started with: no change.
 */
const warmChanged = (e: SessionExercise, we: Pick<WorkoutExercise, 'warmup'> | null) =>
  !we?.warmup && e.plan_warmups != null && warmSets(e) !== e.plan_warmups

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
    const n = Math.max(1, planSets(e, we))
    if (n !== we.sets) out.push(`${e.name}: ${n} sets instead of ${we.sets}`)
    if (warmChanged(e, we)) {
      const w = warmSets(e)
      out.push(`${e.name}: ${w ? `${w} warm-up set${w === 1 ? '' : 's'}` : 'no warm-up sets'}`)
    }
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
    // an added exercise with warm-up sets only (light pulldowns before pull ups) becomes a warm-up row
    const warmOnly = !we && mainSets(e) === 0 && warmSets(e) > 0
    const row = {
      ...(we ?? {
        id: uid(),
        user_id: userId,
        workout_id: workoutId,
        exercise_id: e.exercise_id,
        rep_min: e.rep_min,
        rep_max: e.rep_max,
        weight: firstWork?.weight ?? 0,
        note: '',
        ...(warmOnly ? { warmup: true } : {})
      }),
      position,
      sets: Math.max(1, warmOnly ? warmSets(e) : planSets(e, we)),
      drop_last: hasDrop(e),
      rest_sec: e.rest_sec,
      superset: e.superset || ''
    } as WorkoutExercise
    // warm-ups before the work sets: kept when the lifter added or removed some, or on a newly added exercise
    if (!row.warmup && (warmChanged(e, we) || (!we && warmSets(e) > 0))) row.warmup_sets = warmSets(e)
    return row
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
