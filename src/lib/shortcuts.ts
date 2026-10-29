import { DB } from './types'
import { startSessionFromWorkout } from './actions'
import { upNext } from './upNext'

/**
 * Home-screen shortcut "Start next workout" (manifest url `#/?start=next`).
 * Resumes an unfinished session if there is one; otherwise starts the same workout Up next shows on Train. Returns the session id to open, or null when there is no workout to start.
 */
export function startNextWorkout(db: DB): string | null {
  const active = db.sessions.find((s) => !s.finished_at)
  if (active) return active.id
  const next = upNext(db)?.workout
  if (!next) return null
  return startSessionFromWorkout(next)
}
