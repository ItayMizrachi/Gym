import type { DB } from './types'
import { exerciseHistory } from './pr'

/*
 * Stalled lifts: exercises you train regularly whose best estimated 1-rep max has not improved for a while.
 * A gentle coaching hint, never an alarm: plateaus are normal, and a lighter week or a new rep range usually helps.
 */

export interface Plateau {
  exerciseId: string
  name: string
  /** sessions in a row without beating the earlier best */
  sessions: number
  best: number
}

const MIN_HISTORY = 5
const STALL = 4
const RECENT_DAYS = 21

export function plateaus(db: DB, now = new Date()): Plateau[] {
  const out: Plateau[] = []
  const finished = new Set(db.sessions.filter((s) => s.finished_at).map((s) => s.id))
  const trainedIds = new Set(db.sessions.filter((s) => finished.has(s.id)).flatMap((s) => s.data.exercises.map((e) => e.exercise_id)))
  for (const ex of db.exercises) {
    if (!trainedIds.has(ex.id)) continue
    // only finished sessions count as history
    const pts = exerciseHistory({ ...db, sessions: db.sessions.filter((s) => finished.has(s.id)) }, ex.id).filter((p) => p.bestE1rm > 0)
    if (pts.length < MIN_HISTORY) continue
    const last = pts[pts.length - 1]
    if (now.getTime() - new Date(last.date).getTime() > RECENT_DAYS * 86400_000) continue // not training it now
    let bestIdx = 0
    pts.forEach((p, i) => {
      if (p.bestE1rm > pts[bestIdx].bestE1rm + 0.01) bestIdx = i
    })
    const since = pts.length - 1 - bestIdx
    if (since >= STALL) out.push({ exerciseId: ex.id, name: ex.name, sessions: since, best: pts[bestIdx].bestE1rm })
  }
  return out.sort((a, b) => b.sessions - a.sessions)
}
