import type { DB } from './types'
import { finishedSessions, muscleSetWeight } from './stats'
import { sessionDate } from './pr'

/*
 * Muscle recovery: a simple, honest estimate of how much each muscle group was worked recently.
 * Every working set adds load to its muscle, fading linearly to zero over the recovery window
 * (bigger muscles take longer). About 8 hard sets in the last day reads as "fully worked".
 * It is a guide for picking today's workout, not a medical measure.
 */

const BIG = new Set(['Quads', 'Hamstrings', 'Glutes', 'Back', 'Chest'])
export const recoveryHours = (muscle: string) => (BIG.has(muscle) ? 72 : 48)
const FULL = 8

/** Main groups shown in the "ready" list (Other is never listed). */
export const MAIN_MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs']

/** muscle → 0..1, how much it was worked recently (1 = trained hard in the last day). */
export function recoveryLoad(db: DB, now = new Date()): Record<string, number> {
  const muscleOf = new Map(db.exercises.map((e) => [e.id, e.muscle]))
  const load: Record<string, number> = {}
  const since = now.getTime() - 72 * 3600_000
  for (const s of finishedSessions(db)) {
    const t = new Date(sessionDate(s)).getTime()
    if (t < since || t > now.getTime()) continue
    const hours = (now.getTime() - t) / 3600_000
    for (const ex of s.data.exercises) {
      const m = muscleOf.get(ex.exercise_id)
      if (!m || m === 'Other') continue
      const fade = Math.max(0, 1 - hours / recoveryHours(m))
      if (!fade) continue
      const sets = ex.sets.reduce((a, x) => a + muscleSetWeight(x), 0)
      load[m] = (load[m] ?? 0) + sets * fade
    }
  }
  for (const m of Object.keys(load)) load[m] = Math.min(1, load[m] / FULL)
  return load
}

export interface RecoveryView {
  load: Record<string, number>
  /** worked recently, most worked first */
  recovering: string[]
  /** main groups that are rested */
  ready: string[]
}

export function recoveryView(db: DB, now = new Date()): RecoveryView {
  const load = recoveryLoad(db, now)
  const recovering = Object.entries(load)
    .filter(([, v]) => v >= 0.25)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m)
  const ready = MAIN_MUSCLES.filter((m) => (load[m] ?? 0) < 0.25)
  return { load, recovering, ready }
}
