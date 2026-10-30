import { DB } from './types'
import { finishedSessions, summarizeSession } from './stats'
import { sessionDate, sessionPRs } from './pr'

/*
 * A month in numbers, for the coach to send a trainee as an image (src/lib/shareCard.ts):
 * workouts, sets, volume, the change against the month before, and the month's best records (one per exercise).
 */

export interface MonthReport {
  /** first day of the month */
  month: Date
  workouts: number
  sets: number
  volume: number
  /** volume change against the month before, in % (null without one) */
  change: number | null
  records: { exerciseId: string; weight: number; reps: number }[]
}

export function monthReport(db: DB, now = new Date()): MonthReport {
  const month = new Date(now.getFullYear(), now.getMonth(), 1)
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  let workouts = 0
  let sets = 0
  let volume = 0
  let before = 0
  const best = new Map<string, { exerciseId: string; weight: number; reps: number }>()
  for (const s of finishedSessions(db)) {
    const t = new Date(sessionDate(s))
    if (t >= prev && t < month) before += summarizeSession(s).volume
    if (t < month || t >= next) continue
    const sum = summarizeSession(s)
    workouts++
    sets += sum.sets
    volume += sum.volume
    for (const p of sessionPRs(db, s)) {
      const cur = best.get(p.exercise_id)
      if (!cur || p.weight > cur.weight || (p.weight === cur.weight && p.reps > cur.reps)) best.set(p.exercise_id, { exerciseId: p.exercise_id, weight: p.weight, reps: p.reps })
    }
  }
  return {
    month,
    workouts,
    sets,
    volume,
    change: before > 0 ? Math.round(((volume - before) / before) * 100) : null,
    records: [...best.values()].sort((a, b) => b.weight - a.weight)
  }
}
