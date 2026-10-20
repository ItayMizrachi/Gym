/**
 * Training insights: pure, read-only functions over the DB.
 *
 * Conventions used everywhere in this file:
 * - Only finished sessions count. A session is dated by `sessionDate` (finish time, else start time).
 * - Weeks start on Sunday (the owner's training week runs Sun–Thu). Pass `weekStartsOn` to change it.
 * - Warm-up sets never count. A set counts once it is ticked done.
 * - Volume (tonnage) = weight × reps over every counted set, drop sets included: it is real work moved.
 * - Sets per muscle: work and failure sets count 1, a drop set counts 0.5. A drop set is a short
 *   continuation of the set before it, so counting it as a full set would overstate weekly volume,
 *   but ignoring it would understate it.
 * - Every function takes `now` explicitly (defaulting to the current time) so results are reproducible.
 */
import { DB, Session, SessionSet, Workout } from './types'
import { sessionDate } from './pr'

const DAY = 86_400_000

/** Lower and upper end of the commonly cited 10–20 hard sets per muscle per week guideline. */
export const MUSCLE_SETS_MIN = 10
export const MUSCLE_SETS_MAX = 20

/* ---------- dates ---------- */

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date | string | number): string {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Local midnight at the start of the week that contains `d`. */
export function startOfWeek(d: Date | number, weekStartsOn = 0): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const diff = (x.getDay() - weekStartsOn + 7) % 7
  x.setDate(x.getDate() - diff)
  return x
}

/** Shift a date by whole local days (DST-safe, unlike adding 86 400 000 ms). */
export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/* ---------- sets & sessions ---------- */

export function countsAsSet(x: SessionSet): boolean {
  return x.done && x.kind !== 'warmup'
}

/** Weight of one set in the "sets per muscle" tally: drop = 0.5, other counted sets = 1, warm-up = 0. */
export function muscleSetWeight(x: SessionSet): number {
  if (!countsAsSet(x)) return 0
  return x.kind === 'drop' ? 0.5 : 1
}

export interface SessionSummary {
  sets: number
  volume: number
  exercises: number
  minutes: number
}

export function summarizeSession(s: Session): SessionSummary {
  let sets = 0
  let volume = 0
  let exercises = 0
  for (const e of s.data.exercises) {
    let any = false
    for (const x of e.sets)
      if (countsAsSet(x)) {
        sets++
        any = true
        volume += x.weight * (x.reps ?? 0)
      }
    if (any) exercises++
  }
  const end = s.finished_at ? new Date(s.finished_at).getTime() : new Date(s.started_at).getTime()
  const minutes = Math.max(0, Math.round((end - new Date(s.started_at).getTime()) / 60000))
  return { sets, volume, exercises, minutes }
}

/** Finished sessions, oldest first. */
export function finishedSessions(db: DB): Session[] {
  return db.sessions.filter((s) => s.finished_at).sort((a, b) => sessionDate(a).localeCompare(sessionDate(b)))
}

function inRange(s: Session, from: Date, to: Date): boolean {
  const t = new Date(sessionDate(s)).getTime()
  return t >= from.getTime() && t < to.getTime()
}

/* ---------- weekly summaries ---------- */

export interface PeriodSummary {
  workouts: number
  sets: number
  volume: number
}

export function summarizeRange(db: DB, from: Date, to: Date): PeriodSummary {
  const out: PeriodSummary = { workouts: 0, sets: 0, volume: 0 }
  for (const s of db.sessions) {
    if (!s.finished_at || !inRange(s, from, to)) continue
    const m = summarizeSession(s)
    out.workouts++
    out.sets += m.sets
    out.volume += m.volume
  }
  return out
}

export interface WeekComparison {
  thisWeek: PeriodSummary
  /** last week up to the same moment (same weekday and time), so Monday is not compared with a full week */
  lastWeekToDate: PeriodSummary
  lastWeek: PeriodSummary
  weekStart: Date
}

export function compareWeeks(db: DB, now = new Date(), weekStartsOn = 0): WeekComparison {
  const ws = startOfWeek(now, weekStartsOn)
  const prev = addDays(ws, -7)
  const elapsed = now.getTime() - ws.getTime()
  return {
    thisWeek: summarizeRange(db, ws, addDays(ws, 7)),
    lastWeekToDate: summarizeRange(db, prev, new Date(prev.getTime() + elapsed)),
    lastWeek: summarizeRange(db, prev, ws),
    weekStart: ws
  }
}

export interface WeekPoint extends PeriodSummary {
  start: Date
}

/** The last `weeks` weeks (oldest first, current week last, possibly partial). */
export function weeklyTrend(db: DB, now = new Date(), weeks = 8, weekStartsOn = 0): WeekPoint[] {
  const cur = startOfWeek(now, weekStartsOn)
  const out: WeekPoint[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(cur, -7 * i)
    out.push({ start, ...summarizeRange(db, start, addDays(start, 7)) })
  }
  return out
}

/* ---------- muscles ---------- */

export interface MuscleSets {
  muscle: string
  sets: number
}

/**
 * Sets per muscle group for sessions in [from, to). Muscles that appear in `include` are listed even at 0
 * (pass the muscles of the user's plan so untrained ones stand out). Sorted by sets, most first.
 */
export function muscleSets(db: DB, from: Date, to: Date, include: string[] = []): MuscleSets[] {
  const muscleOf = new Map(db.exercises.map((e) => [e.id, e.muscle || 'Other']))
  const tally = new Map<string, number>(include.map((m) => [m, 0]))
  for (const s of db.sessions) {
    if (!s.finished_at || !inRange(s, from, to)) continue
    for (const e of s.data.exercises) {
      const n = e.sets.reduce((a, x) => a + muscleSetWeight(x), 0)
      if (!n) continue
      const m = muscleOf.get(e.exercise_id) ?? 'Other'
      tally.set(m, (tally.get(m) ?? 0) + n)
    }
  }
  return [...tally]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle))
}

/** Muscles targeted by the user's workout templates. */
export function plannedMuscles(db: DB): string[] {
  const used = new Set(db.workout_exercises.map((w) => w.exercise_id))
  return [...new Set(db.exercises.filter((e) => used.has(e.id)).map((e) => e.muscle || 'Other'))]
}

export type GuidelineZone = 'below' | 'within' | 'above'

export function guidelineZone(sets: number): GuidelineZone {
  return sets < MUSCLE_SETS_MIN ? 'below' : sets > MUSCLE_SETS_MAX ? 'above' : 'within'
}

/* ---------- calendar ---------- */

export interface TrainingDay {
  workouts: number
  sets: number
  volume: number
  sessionIds: string[]
}

/** Finished sessions grouped by local calendar day. */
export function trainingDays(db: DB): Map<string, TrainingDay> {
  const out = new Map<string, TrainingDay>()
  for (const s of finishedSessions(db)) {
    const k = dayKey(sessionDate(s))
    const m = summarizeSession(s)
    const d = out.get(k) ?? { workouts: 0, sets: 0, volume: 0, sessionIds: [] }
    d.workouts++
    d.sets += m.sets
    d.volume += m.volume
    d.sessionIds.push(s.id)
    out.set(k, d)
  }
  return out
}

/**
 * Calendar grid for one month: rows of 7 cells, `null` for padding days outside the month.
 * `month` is 0-based like Date.
 */
export function monthGrid(year: number, month: number, weekStartsOn = 0): (string | null)[][] {
  const first = new Date(year, month, 1)
  const days = new Date(year, month + 1, 0).getDate()
  const lead = (first.getDay() - weekStartsOn + 7) % 7
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) cells.push(dayKey(new Date(year, month, d)))
  while (cells.length % 7) cells.push(null)
  const rows: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

/** 0 = rest day, 1–3 = light / medium / heavy relative to the user's own heaviest day (by sets). */
export function intensityLevel(day: TrainingDay | undefined, maxSets: number): 0 | 1 | 2 | 3 {
  if (!day) return 0
  if (maxSets <= 0) return 1
  const r = day.sets / maxSets
  return r > 0.75 ? 3 : r > 0.4 ? 2 : 1
}

/* ---------- streaks ---------- */

export interface Streak {
  /** consecutive weeks with ≥ 1 finished workout, ending this week (or last week if this week is still empty) */
  current: number
  best: number
  /** true when this week already has a workout */
  thisWeekDone: boolean
}

export function weeklyStreak(db: DB, now = new Date(), weekStartsOn = 0): Streak {
  const weeks = new Set(finishedSessions(db).map((s) => startOfWeek(new Date(sessionDate(s)), weekStartsOn).getTime()))
  const cur = startOfWeek(now, weekStartsOn)
  const thisWeekDone = weeks.has(cur.getTime())

  // an empty current week does not break the streak yet: there is still time to train
  let current = 0
  let w = thisWeekDone ? cur : addDays(cur, -7)
  while (weeks.has(w.getTime())) {
    current++
    w = addDays(w, -7)
  }

  let best = 0
  let run = 0
  let prev: number | null = null
  for (const t of [...weeks].sort((a, b) => a - b)) {
    run = prev != null && startOfWeek(addDays(new Date(prev), 7), weekStartsOn).getTime() === t ? run + 1 : 1
    best = Math.max(best, run)
    prev = t
  }
  return { current, best: Math.max(best, current), thisWeekDone }
}

/* ---------- what to train next ---------- */

export interface NextWorkout {
  workout: Workout
  /** date of the last finished session of this template, if any */
  lastDone: string | null
  reason: 'first' | 'rotation' | 'oldest'
}

/**
 * Suggest the next template. Templates without exercises are skipped.
 * - Nothing trained from a template yet → the first one by position.
 * - Otherwise → the template after the most recently trained one, by position (wrapping around),
 *   which follows a rotating split such as Upper/Lower × 2.
 * - If that template was trained more recently than some other one (the user skipped around),
 *   the template whose last session is oldest (never-trained first) wins instead.
 */
export function suggestNextWorkout(db: DB): NextWorkout | null {
  const withEx = new Set(db.workout_exercises.map((w) => w.workout_id))
  const list = db.workouts.filter((w) => withEx.has(w.id)).sort((a, b) => a.position - b.position)
  if (!list.length) return null

  const last = new Map<string, string>()
  for (const s of finishedSessions(db)) if (s.workout_id) last.set(s.workout_id, sessionDate(s))
  const lastOf = (w: Workout) => last.get(w.id) ?? null

  const trained = list.filter((w) => last.has(w.id))
  if (!trained.length) return { workout: list[0], lastDone: null, reason: 'first' }

  const recent = trained.reduce((a, b) => (lastOf(b)! > lastOf(a)! ? b : a))
  const next = list[(list.indexOf(recent) + 1) % list.length]
  const oldest = list.reduce((a, b) => {
    const la = lastOf(a)
    const lb = lastOf(b)
    if (la == null) return a
    if (lb == null) return b
    return lb < la ? b : a
  })
  const nl = lastOf(next)
  const ol = lastOf(oldest)
  if (oldest.id !== next.id && nl != null && (ol == null || ol < nl)) return { workout: oldest, lastDone: ol, reason: 'oldest' }
  return { workout: next, lastDone: nl, reason: 'rotation' }
}

/* ---------- comparisons ---------- */

/** The latest finished session of the same template that happened before `s`. */
export function previousOfTemplate(db: DB, s: Session): Session | null {
  if (!s.workout_id) return null
  const d = sessionDate(s)
  let best: Session | null = null
  for (const x of db.sessions) {
    if (x.id === s.id || !x.finished_at || x.workout_id !== s.workout_id) continue
    const xd = sessionDate(x)
    if (xd < d && (!best || xd > sessionDate(best))) best = x
  }
  return best
}

/* ---------- formatting ---------- */

/** 850 → "850 kg", 12 450 → "12.5 t". */
export function fmtVolume(kg: number): string {
  const v = Math.round(kg)
  if (Math.abs(v) < 1000) return `${v} kg`
  const t = Math.round(v / 100) / 10
  return `${t % 1 === 0 ? t.toFixed(0) : t.toFixed(1)} t`
}

/** 0.5-step set counts: 12 → "12", 12.5 → "12½". */
export function fmtSets(n: number): string {
  const whole = Math.floor(n)
  return n - whole >= 0.5 ? `${whole || ''}½` : String(whole)
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`
}

/** "today", "yesterday", "3 days ago", "2 weeks ago". */
export function relativeDay(iso: string, now = new Date()): string {
  const a = new Date(dayKey(iso) + 'T12:00:00').getTime()
  const b = new Date(dayKey(now) + 'T12:00:00').getTime()
  const d = Math.round((b - a) / DAY)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 14) return `${d} days ago`
  return `${Math.round(d / 7)} weeks ago`
}
