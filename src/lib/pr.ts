import { DB, Session, SessionSet } from './types'

/** Only these set kinds count towards records. Warm-ups and drop sets never do. */
const ELIGIBLE = new Set(['work', 'failure'])

export interface SetRec {
  exercise_id: string
  weight: number
  reps: number
  kind: string
  session_id: string
  date: string
  set_id: string
}

/** Epley estimate, reps capped at 12 so high-rep sets do not inflate the number. */
export const e1rm = (w: number, r: number) => (w > 0 && r > 0 ? w * (1 + Math.min(r, 12) / 30) : 0)

export const sessionDate = (s: Session) => s.finished_at ?? s.started_at

/** All completed, record-eligible sets for one exercise from every session except `excludeSessionId`. */
export function priorSets(db: DB, exerciseId: string, excludeSessionId?: string): SetRec[] {
  const out: SetRec[] = []
  for (const s of db.sessions) {
    if (s.id === excludeSessionId) continue
    if (!s.finished_at) continue // an abandoned, unfinished workout is not a baseline
    for (const ex of s.data.exercises) {
      if (ex.exercise_id !== exerciseId) continue
      for (const st of ex.sets) {
        if (!st.done || st.reps == null || st.reps <= 0 || !ELIGIBLE.has(st.kind)) continue
        out.push({
          exercise_id: exerciseId,
          weight: st.weight,
          reps: st.reps,
          kind: st.kind,
          session_id: s.id,
          date: sessionDate(s),
          set_id: st.id
        })
      }
    }
  }
  return out
}

export interface PRResult {
  first: boolean
  types: ('weight' | 'e1rm' | 'reps')[]
  nearPct: number | null
  e1rm: number
}

/** Evaluate one finished set against earlier history. */
export function evaluateSet(prior: SetRec[], weight: number, reps: number): PRResult {
  const e = e1rm(weight, reps)
  if (prior.length === 0) return { first: true, types: [], nearPct: null, e1rm: e }
  const types: PRResult['types'] = []
  const maxW = Math.max(...prior.map((p) => p.weight))
  const bestE = Math.max(...prior.map((p) => e1rm(p.weight, p.reps)))
  const atOrAbove = prior.filter((p) => p.weight >= weight - 1e-6)
  const bestRepsAtW = atOrAbove.length ? Math.max(...atOrAbove.map((p) => p.reps)) : 0

  if (weight > 0 && weight > maxW + 1e-6) types.push('weight')
  if (weight > 0 && e > bestE + 0.01) types.push('e1rm')
  if (atOrAbove.length > 0 && reps > bestRepsAtW) types.push('reps')

  let nearPct: number | null = null
  if (types.length === 0 && weight > 0 && bestE > 0) {
    const pct = e / bestE
    if (pct >= 0.95 && pct < 1) nearPct = Math.round(pct * 100)
  }
  return { first: false, types, nearPct, e1rm: e }
}

/** Smallest rep count at `weight` that would be a new record, or null if no history / not reachable. */
export function repsForPR(prior: SetRec[], weight: number): number | null {
  if (prior.length === 0) return null
  const maxW = Math.max(...prior.map((p) => p.weight))
  const bestE = Math.max(...prior.map((p) => e1rm(p.weight, p.reps)))
  const atOrAbove = prior.filter((p) => p.weight >= weight - 1e-6)
  const cands: number[] = []
  if (weight > 0 && weight > maxW + 1e-6) cands.push(1)
  if (atOrAbove.length) cands.push(Math.max(...atOrAbove.map((p) => p.reps)) + 1)
  if (weight > 0 && bestE > 0) {
    for (let r = 1; r <= 12; r++) {
      if (e1rm(weight, r) > bestE + 0.01) {
        cands.push(r)
        break
      }
    }
  }
  return cands.length ? Math.min(...cands) : null
}

export interface Records {
  heaviest: SetRec | null
  bestE1rm: { rec: SetRec; value: number } | null
  /** best weight lifted for at least N reps (N = 1..15) */
  repTable: { reps: number; weight: number; date: string }[]
}

export function recordsFor(sets: SetRec[]): Records {
  let heaviest: SetRec | null = null
  let bestE: { rec: SetRec; value: number } | null = null
  for (const s of sets) {
    if (!heaviest || s.weight > heaviest.weight || (s.weight === heaviest.weight && s.reps > heaviest.reps)) heaviest = s
    const v = e1rm(s.weight, s.reps)
    if (v > 0 && (!bestE || v > bestE.value)) bestE = { rec: s, value: v }
  }
  const repTable: Records['repTable'] = []
  for (let r = 1; r <= 15; r++) {
    const ok = sets.filter((s) => s.reps >= r)
    if (!ok.length) continue
    const best = ok.reduce((a, b) => (b.weight > a.weight ? b : a))
    repTable.push({ reps: r, weight: best.weight, date: best.date })
  }
  return { heaviest, bestE1rm: bestE, repTable }
}

export interface LastPerformance {
  date: string
  sets: SessionSet[]
}

/** The most recent finished session that contains completed sets of this exercise. */
export function lastPerformance(db: DB, exerciseId: string, excludeSessionId?: string): LastPerformance | null {
  const sessions = db.sessions
    .filter((s) => s.id !== excludeSessionId && s.finished_at)
    .sort((a, b) => (sessionDate(b) > sessionDate(a) ? 1 : -1))
  for (const s of sessions) {
    const ex = s.data.exercises.find((e) => e.exercise_id === exerciseId)
    if (!ex) continue
    const done = ex.sets.filter((x) => x.done && x.reps != null)
    if (done.length) return { date: sessionDate(s), sets: done }
  }
  return null
}

export interface PREvent {
  exercise_id: string
  weight: number
  reps: number
  types: PRResult['types']
}

/** PRs achieved inside a (finished) session, evaluated chronologically within the session. */
export function sessionPRs(db: DB, session: Session): PREvent[] {
  const events: PREvent[] = []
  for (const ex of session.data.exercises) {
    // only compare with what came BEFORE this session, so a later, better workout does not erase this record
    const prior = priorSets(db, ex.exercise_id, session.id).filter((p) => p.date < sessionDate(session))
    const running = [...prior]
    const done = ex.sets
      .filter((s) => s.done && s.reps != null && s.reps > 0 && ELIGIBLE.has(s.kind))
      .sort((a, b) => (a.done_at ?? '').localeCompare(b.done_at ?? ''))
    for (const s of done) {
      const res = evaluateSet(running, s.weight, s.reps!)
      if (res.types.length) events.push({ exercise_id: ex.exercise_id, weight: s.weight, reps: s.reps!, types: res.types })
      running.push({
        exercise_id: ex.exercise_id,
        weight: s.weight,
        reps: s.reps!,
        kind: s.kind,
        session_id: session.id,
        date: sessionDate(session),
        set_id: s.id
      })
    }
  }
  return events
}

export interface HistoryPoint {
  date: string
  topWeight: number
  bestE1rm: number
  volume: number
}

/** One point per session for charts. */
export function exerciseHistory(db: DB, exerciseId: string): HistoryPoint[] {
  const pts: HistoryPoint[] = []
  for (const s of db.sessions) {
    const ex = s.data.exercises.find((e) => e.exercise_id === exerciseId)
    if (!ex) continue
    const done = ex.sets.filter((x) => x.done && x.reps != null && x.reps > 0 && x.kind !== 'warmup')
    if (!done.length) continue
    const elig = done.filter((x) => ELIGIBLE.has(x.kind))
    pts.push({
      date: sessionDate(s),
      topWeight: Math.max(0, ...elig.map((x) => x.weight)),
      bestE1rm: Math.max(0, ...elig.map((x) => e1rm(x.weight, x.reps!))),
      volume: done.reduce((a, x) => a + x.weight * (x.reps ?? 0), 0)
    })
  }
  return pts.sort((a, b) => a.date.localeCompare(b.date))
}
