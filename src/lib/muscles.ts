import { Exercise, Session, MUSCLES } from './types'
import { setVolume } from './tracking'

export interface MuscleRow {
  muscle: string
  /** sets ticked so far (warm-ups excluded) */
  done: number
  /** all non-warm-up set rows in the workout, ticked or not */
  planned: number
}

/** Sets per muscle group for one workout. Warm-up sets do not count as training a muscle. */
export function muscleSets(session: Session, exercises: Exercise[]): MuscleRow[] {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const rows = new Map<string, MuscleRow>()
  for (const se of session.data.exercises) {
    const muscle = byId.get(se.exercise_id)?.muscle || 'Other'
    const r = rows.get(muscle) ?? { muscle, done: 0, planned: 0 }
    for (const s of se.sets) {
      if (s.kind === 'warmup') continue
      r.planned++
      if (s.done) r.done++
    }
    rows.set(muscle, r)
  }
  const order = (m: string) => (MUSCLES.includes(m) ? MUSCLES.indexOf(m) : MUSCLES.length)
  // 'Other' (warm-ups, cardio) always goes last
  return [...rows.values()].sort((a, b) => Number(a.muscle === 'Other') - Number(b.muscle === 'Other') || b.done - a.done || b.planned - a.planned || order(a.muscle) - order(b.muscle))
}

/** For BodyMap: muscles with a logged set are full strength, ones only planned are dim. */
export function liveIntensity(rows: MuscleRow[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) if (r.planned > 0 || r.done > 0) out[r.muscle] = r.done > 0 ? 1 : 0.3
  return out
}

export function sessionVolume(session: Session): number {
  return session.data.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + setVolume(s), 0), 0)
}
