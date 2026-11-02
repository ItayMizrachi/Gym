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

/* ------------------------------------------------- the monthly report page (src/pages/MonthReport.tsx) */

export interface MonthNumbers {
  workouts: number
  minutes: number
  volume: number
  sets: number
}

export interface FullMonthReport {
  month: Date
  now: MonthNumbers
  before: MonthNumbers
  /** days of the month with a finished workout (1-31) */
  days: number[]
  /** workouts per month, oldest first, ending with this month */
  trend: { month: Date; workouts: number }[]
  /** most done exercises (times = workouts they were in) */
  top: { exerciseId: string; name: string; times: number }[]
  records: MonthReport['records']
  /** workout and body photos taken this month, newest first */
  photos: string[]
}

const emptyNums = (): MonthNumbers => ({ workouts: 0, minutes: 0, volume: 0, sets: 0 })

/** Everything the report shows for the month that starts at `month` (day 1). */
export function fullMonthReport(db: DB, month: Date): FullMonthReport {
  const start = new Date(month.getFullYear(), month.getMonth(), 1)
  const next = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  const prev = new Date(start.getFullYear(), start.getMonth() - 1, 1)
  const now = emptyNums()
  const before = emptyNums()
  const days = new Set<number>()
  const times = new Map<string, { name: string; times: number }>()
  const photos: { at: string; path: string }[] = []
  const trendStart = new Date(start.getFullYear(), start.getMonth() - 5, 1)
  const trend = Array.from({ length: 6 }, (_, i) => ({ month: new Date(trendStart.getFullYear(), trendStart.getMonth() + i, 1), workouts: 0 }))
  for (const s of finishedSessions(db)) {
    const at = sessionDate(s)
    const t = new Date(at)
    const k = (t.getFullYear() - trendStart.getFullYear()) * 12 + t.getMonth() - trendStart.getMonth()
    if (k >= 0 && k < 6) trend[k].workouts++
    const into = t >= start && t < next ? now : t >= prev && t < start ? before : null
    if (!into) continue
    const sum = summarizeSession(s)
    into.workouts++
    into.minutes += sum.minutes
    into.volume += sum.volume
    into.sets += sum.sets
    if (into !== now) continue
    days.add(t.getDate())
    if (s.data.photo_path) photos.push({ at, path: s.data.photo_path })
    for (const e of s.data.exercises) {
      if (!e.sets.some((x) => x.done && x.kind !== 'warmup')) continue
      const cur = times.get(e.exercise_id) ?? { name: db.exercises.find((x) => x.id === e.exercise_id)?.name ?? e.name, times: 0 }
      cur.times++
      times.set(e.exercise_id, cur)
    }
  }
  for (const m of db.metrics) {
    const t = new Date(m.date)
    if (m.photo_path && t >= start && t < next) photos.push({ at: m.date, path: m.photo_path })
  }
  return {
    month: start,
    now,
    before,
    days: [...days].sort((a, b) => a - b),
    trend,
    top: [...times.entries()].map(([exerciseId, v]) => ({ exerciseId, ...v })).sort((a, b) => b.times - a.times),
    records: monthReport(db, start).records,
    photos: photos.sort((a, b) => b.at.localeCompare(a.at)).map((p) => p.path)
  }
}

/** "2026-10" for the month of `d` (route key) */
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
