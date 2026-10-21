/**
 * Achievements and the weekly goal: pure functions over the DB, so they are easy to test.
 *
 * - Every achievement is computed from history each time; nothing is stored except which ones the
 *   user has already been told about (see achievementsSeen / markAchievementsSeen).
 * - `date` is when it was earned: the finish date of the workout that crossed the line.
 * - Weeks follow stats.ts (start on Sunday). The weekly goal counts finished workouts.
 */
import { DB, Session } from './types'
import { sessionDate } from './pr'
import { History, scanHistory } from './records'
import { addDays, dayKey, finishedSessions, startOfWeek, summarizeSession } from './stats'

export type AchievementIcon = 'start' | 'count' | 'streak' | 'record' | 'lift' | 'volume' | 'sun' | 'goal'

export interface Achievement {
  id: string
  title: string
  /** one plain sentence on how to earn it */
  desc: string
  icon: AchievementIcon
  earned: boolean
  /** ISO date it was earned, or null */
  date: string | null
  /** where you are now and what it takes, in the unit of `unit` */
  current: number
  target: number
  /** 0–1 */
  progress: number
  unit: string
  /** shown instead of the progress numbers when something is missing (e.g. no body weight logged) */
  hint?: string
}

/* ---------- lifts ---------- */

const LIFTS = {
  squat: { match: /squat/i, skip: /goblet|split|bulgarian|jump|pistol|sissy|hack|smith|machine|box|dumbbell|kettlebell|overhead/i },
  bench: { match: /bench press|^bench$/i, skip: /dumbbell|\bdb\b|machine|smith|incline|decline|close|floor/i },
  deadlift: { match: /deadlift/i, skip: /romanian|\brdl\b|stiff|single|one.leg|dumbbell|kettlebell|deficit|snatch/i }
} as const
export type Lift = keyof typeof LIFTS

/** Is this exercise name the classic barbell squat, bench press or deadlift? */
export function isLift(name: string, lift: Lift): boolean {
  const l = LIFTS[lift]
  return l.match.test(name) && !l.skip.test(name)
}

/* ---------- weekly goal ---------- */

export const GOAL_MIN = 1
export const GOAL_MAX = 7
export const clampGoal = (n: unknown): number => {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? Math.min(GOAL_MAX, Math.max(GOAL_MIN, v)) : 3
}

export interface WeekGoal {
  goal: number
  /** finished workouts this week */
  done: number
  hit: boolean
  weekStart: Date
  /** 7 entries, first = week start: trained that day? */
  days: boolean[]
  /** index of today in `days` */
  today: number
}

export function weekGoal(db: DB, goal: number, now = new Date(), weekStartsOn = 0): WeekGoal {
  const ws = startOfWeek(now, weekStartsOn)
  const end = addDays(ws, 7)
  const keys = Array.from({ length: 7 }, (_, i) => dayKey(addDays(ws, i)))
  const days = keys.map(() => false)
  let done = 0
  for (const s of db.sessions) {
    if (!s.finished_at) continue
    const t = new Date(sessionDate(s))
    if (t < ws || t >= end) continue
    done++
    const i = keys.indexOf(dayKey(t))
    if (i >= 0) days[i] = true
  }
  const g = clampGoal(goal)
  return { goal: g, done, hit: done >= g, weekStart: ws, days, today: keys.indexOf(dayKey(now)) }
}

/** Finished workouts per week start (ms), sessions oldest first. */
function weeks(db: DB, weekStartsOn: number): Map<number, Session[]> {
  const out = new Map<number, Session[]>()
  for (const s of finishedSessions(db)) {
    const k = startOfWeek(new Date(sessionDate(s)), weekStartsOn).getTime()
    out.set(k, [...(out.get(k) ?? []), s])
  }
  return out
}

/**
 * Weeks in a row that reached the goal, ending last week, plus this week once it is reached
 * (a week still in progress never breaks the run).
 */
export function goalWeeksInRow(db: DB, goal: number, now = new Date(), weekStartsOn = 0): number {
  const g = clampGoal(goal)
  const w = weeks(db, weekStartsOn)
  const hit = (t: Date) => (w.get(t.getTime())?.length ?? 0) >= g
  const cur = startOfWeek(now, weekStartsOn)
  let n = hit(cur) ? 1 : 0
  for (let t = addDays(cur, -7); hit(t); t = addDays(t, -7)) n++
  return n
}

/* ---------- achievements ---------- */

interface Def {
  id: string
  title: string
  desc: string
  icon: AchievementIcon
  unit: string
  target: number
}

const nth = <T,>(list: T[], n: number): T | undefined => (list.length >= n ? list[n - 1] : undefined)

/** Longest run of consecutive weeks matching `ok`, and the date the run first reached `need` weeks. */
function weekRun(w: Map<number, Session[]>, ok: (list: Session[]) => string | null, need: number) {
  let best = 0
  let run = 0
  let prev: number | null = null
  let date: string | null = null
  for (const t of [...w.keys()].sort((a, b) => a - b)) {
    const when = ok(w.get(t)!)
    const next = prev != null && startOfWeek(addDays(new Date(prev), 7)).getTime() === t
    run = when ? (next ? run + 1 : 1) : 0
    if (when) prev = t
    else prev = null
    if (run > best) best = run
    if (!date && when && run >= need) date = when
  }
  return { best, date }
}

/** Body weight on a day: the latest log on or before it, else the earliest log at all. */
function bodyWeightOn(db: DB, day: string): number | null {
  const logs = db.metrics.filter((m) => m.weight_kg != null && m.weight_kg > 0).sort((a, b) => a.date.localeCompare(b.date))
  if (!logs.length) return null
  let kg = logs[0].weight_kg!
  for (const m of logs) if (m.date <= day) kg = m.weight_kg!
  return kg
}

export function achievements(db: DB, opts: { weeklyGoal?: number; now?: Date; history?: History } = {}): Achievement[] {
  const goal = clampGoal(opts.weeklyGoal ?? 3)
  const now = opts.now ?? new Date()
  const hist = opts.history ?? scanHistory(db)
  const done = finishedSessions(db)
  const w = weeks(db, 0)
  const out: Achievement[] = []
  const add = (d: Def, current: number, date: string | null, hint?: string) => {
    const earned = date != null
    const cur = earned ? Math.max(current, d.target) : Math.min(current, d.target)
    out.push({ ...d, earned, date, current: cur, progress: Math.max(0, Math.min(1, cur / d.target)), hint: earned ? undefined : hint })
  }

  // workout counts
  const counts: [string, number, string][] = [
    ['first-workout', 1, 'First workout'],
    ['workouts-10', 10, '10 workouts'],
    ['workouts-50', 50, '50 workouts'],
    ['workouts-100', 100, '100 workouts']
  ]
  for (const [id, n, title] of counts) {
    const s = nth(done, n)
    add(
      { id, title, desc: n === 1 ? 'Finish your first workout.' : `Finish ${n} workouts.`, icon: n === 1 ? 'start' : 'count', unit: 'workouts', target: n },
      done.length,
      s ? sessionDate(s) : null
    )
  }

  // weekly streaks: at least one workout a week
  const firstOf = (list: Session[]) => (list.length ? sessionDate(list[0]) : null)
  for (const n of [4, 12]) {
    const r = weekRun(w, firstOf, n)
    add({ id: `streak-${n}`, title: `${n}-week streak`, desc: `Train at least once a week, ${n} weeks in a row.`, icon: 'streak', unit: 'weeks', target: n }, r.best, r.date)
  }

  // records
  for (const [id, n, title] of [
    ['first-pr', 1, 'First record'],
    ['prs-10', 10, '10 records'],
    ['prs-50', 50, '50 records']
  ] as [string, number, string][]) {
    const p = nth(hist.prs, n)
    add(
      { id, title, desc: n === 1 ? 'Beat one of your own bests.' : `Beat your own bests ${n} times.`, icon: 'record', unit: 'records', target: n },
      hist.prs.length,
      p?.date ?? null
    )
  }

  // lifts
  const nameOf = new Map(db.exercises.map((e) => [e.id, e.name]))
  const liftSets = (lift: Lift) => {
    const out: { weight: number; date: string }[] = []
    for (const [id, sets] of hist.sets) {
      const name = nameOf.get(id) ?? done.flatMap((s) => s.data.exercises).find((e) => e.exercise_id === id)?.name ?? ''
      if (isLift(name, lift)) for (const s of sets) out.push({ weight: s.weight, date: s.date })
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }
  const bench = liftSets('bench')
  const latestBw = bodyWeightOn(db, dayKey(now))
  const bwHit = bench.find((s) => {
    const kg = bodyWeightOn(db, dayKey(s.date))
    return kg != null && s.weight >= kg
  })
  const bestBench = Math.max(0, ...bench.map((s) => s.weight))
  add(
    { id: 'bw-bench', title: 'Body-weight bench', desc: 'Bench press your own body weight for at least one rep.', icon: 'lift', unit: 'kg', target: latestBw ?? 1 },
    latestBw ? bestBench : 0,
    bwHit?.date ?? null,
    latestBw ? undefined : 'Log your body weight on the Body tab to track this.'
  )
  for (const [lift, label] of [
    ['squat', 'squat'],
    ['bench', 'bench press'],
    ['deadlift', 'deadlift']
  ] as [Lift, string][]) {
    const sets = lift === 'bench' ? bench : liftSets(lift)
    const hit = sets.find((s) => s.weight >= 100)
    add(
      { id: `club-${lift}`, title: `100 kg ${lift}`, desc: `Lift 100 kg in the ${label} for at least one rep.`, icon: 'lift', unit: 'kg', target: 100 },
      Math.max(0, ...sets.map((s) => s.weight)),
      hit?.date ?? null
    )
  }

  // 10 tonnes in one week
  let bestWeek = 0
  let tonDate: string | null = null
  for (const t of [...w.keys()].sort((a, b) => a - b)) {
    let sum = 0
    for (const s of w.get(t)!) {
      sum += summarizeSession(s).volume
      if (!tonDate && sum >= 10_000) tonDate = sessionDate(s)
    }
    bestWeek = Math.max(bestWeek, sum)
  }
  add({ id: 'week-10t', title: '10 tonnes in a week', desc: 'Lift 10,000 kg in total (weight × reps) in one week.', icon: 'volume', unit: 'kg', target: 10_000 }, bestWeek, tonDate)

  // early bird: started before 7:00 local time
  const early = done.find((s) => new Date(s.started_at).getHours() < 7)
  add({ id: 'early-bird', title: 'Early bird', desc: 'Start a workout before 7:00 in the morning.', icon: 'sun', unit: 'workouts', target: 1 }, early ? 1 : 0, early ? sessionDate(early) : null)

  // consistency: weekly goal reached 3 weeks in a row
  const goalDay = (list: Session[]) => (list.length >= goal ? sessionDate(list[goal - 1]) : null)
  const c = weekRun(w, goalDay, 3)
  add(
    { id: 'goal-3', title: 'Consistent', desc: `Reach your weekly goal (${goal} workout${goal === 1 ? '' : 's'}) 3 weeks in a row.`, icon: 'goal', unit: 'weeks', target: 3 },
    c.best,
    c.date
  )

  return out
}

/** The next ones to earn: closest first (ones that cannot be tracked yet go last). */
export function nextUp(list: Achievement[], n = 3): Achievement[] {
  return list
    .filter((a) => !a.earned)
    .sort((a, b) => (a.hint ? 1 : 0) - (b.hint ? 1 : 0) || b.progress - a.progress)
    .slice(0, n)
}

/* ---------- which ones the user has already been told about (per user, this device) ---------- */

const seenKey = (userId: string) => `gymlog:achievements-seen:${userId}`

/** null = never stored (first run on this device). */
export function achievementsSeen(userId: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(seenKey(userId))
    if (raw == null) return null
    const v = JSON.parse(raw)
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
  } catch {
    return null
  }
}

export function markAchievementsSeen(userId: string, ids: Iterable<string>) {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify([...new Set(ids)]))
  } catch {
    /* ignore */
  }
}

/**
 * Earned achievements the user has not been told about yet. On the very first run everything already
 * earned is recorded silently, so existing users are not flooded with old news.
 */
export function freshAchievements(list: Achievement[], seen: Set<string> | null): Achievement[] {
  if (seen == null) return []
  return list.filter((a) => a.earned && !seen.has(a.id))
}
