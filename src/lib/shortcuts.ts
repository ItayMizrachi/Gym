import { DB } from './types'
import { startSessionFromWorkout } from './actions'

/**
 * Home-screen shortcut "Start next workout" (manifest url `#/?start=next`).
 * Resumes an unfinished session if there is one; otherwise starts the workout after the one you did last,
 * in plan order. Returns the session id to open, or null when there is no workout to start.
 */
export function startNextWorkout(db: DB): string | null {
  const active = db.sessions.find((s) => !s.finished_at)
  if (active) return active.id
  const plan = [...db.workouts].sort((a, b) => a.position - b.position)
  if (!plan.length) return null
  const last = db.sessions
    .filter((s) => s.finished_at && s.workout_id)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
  const i = last ? plan.findIndex((w) => w.id === last.workout_id) : -1
  const next = plan[(i + 1) % plan.length]
  return startSessionFromWorkout(next)
}
