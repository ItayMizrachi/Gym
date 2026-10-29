import { DB } from './types'
import { addDays, finishedSessions, startOfWeek, summarizeRange } from './stats'
import { sessionDate, sessionPRs } from './pr'

/*
 * Weekly recap on the Train tab: on the first two days of a week, a short look back at the week before
 * (workouts, sets, volume against the week before that, records), once per week until dismissed.
 */

export interface Recap {
  /** start of the week being looked back on (YYYY-MM-DD), also the dismiss key */
  week: string
  workouts: number
  sets: number
  volume: number
  /** volume change against the week before, in % (null without one) */
  volumeChange: number | null
  records: number
  /** the record to name: "Bench Press 85 kg × 5" */
  best: { exerciseId: string; weight: number; reps: number } | null
}

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function weeklyRecap(db: DB, now = new Date(), weekStartsOn = 0): Recap | null {
  const thisWeek = startOfWeek(now, weekStartsOn)
  // only on the first two days of the week
  if (now.getTime() - thisWeek.getTime() >= 2 * 86400000) return null
  const last = addDays(thisWeek, -7)
  const before = addDays(thisWeek, -14)
  const sum = summarizeRange(db, last, thisWeek)
  if (!sum.workouts) return null
  const prev = summarizeRange(db, before, last)
  let records = 0
  let best: Recap['best'] = null
  for (const s of finishedSessions(db)) {
    const t = new Date(sessionDate(s)).getTime()
    if (t < last.getTime() || t >= thisWeek.getTime()) continue
    for (const p of sessionPRs(db, s)) {
      records++
      if (!best || p.weight > best.weight) best = { exerciseId: p.exercise_id, weight: p.weight, reps: p.reps }
    }
  }
  return {
    week: key(last),
    workouts: sum.workouts,
    sets: sum.sets,
    volume: sum.volume,
    volumeChange: prev.volume > 0 ? Math.round(((sum.volume - prev.volume) / prev.volume) * 100) : null,
    records,
    best
  }
}

const DISMISSED = 'gymlog:recap-dismissed'
export function recapDismissed(week: string): boolean {
  try {
    return localStorage.getItem(DISMISSED) === week
  } catch {
    return false
  }
}
export function dismissRecap(week: string) {
  try {
    localStorage.setItem(DISMISSED, week)
  } catch {
    /* ignore */
  }
}
