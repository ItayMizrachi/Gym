/**
 * Records over the whole history: every PR in date order, and one summary per exercise for the Records page.
 * Pure and read-only. Same rules as pr.ts: only finished sessions, only done work / failure sets with reps.
 */
import { DB, SessionSet, Tracking, trackingOf } from './types'
import { e1rm, evaluateSet, isTimeSet, PRResult, sessionDate, SetRec } from './pr'
import { finishedSessions } from './stats'

const countsForRecords = (s: SessionSet) =>
  s.done && s.reps != null && s.reps > 0 && (s.kind === 'work' || s.kind === 'failure') && !isTimeSet(s)

export interface PRHit {
  exercise_id: string
  session_id: string
  date: string
  weight: number
  reps: number
  types: PRResult['types']
}

export interface History {
  /** every record-breaking set, oldest first */
  prs: PRHit[]
  /** every record-eligible set per exercise, oldest first */
  sets: Map<string, SetRec[]>
}

/**
 * One chronological pass over all finished sessions. A set is a PR when it beats everything before it
 * (earlier sessions and earlier sets of the same session), exactly like `sessionPRs`.
 */
export function scanHistory(db: DB): History {
  const sets = new Map<string, SetRec[]>()
  const prs: PRHit[] = []
  for (const s of finishedSessions(db)) {
    const date = sessionDate(s)
    for (const ex of s.data.exercises) {
      const running = sets.get(ex.exercise_id) ?? []
      const done = ex.sets.filter(countsForRecords).sort((a, b) => (a.done_at ?? '').localeCompare(b.done_at ?? ''))
      for (const x of done) {
        const res = evaluateSet(running, x.weight, x.reps!)
        if (res.types.length)
          prs.push({ exercise_id: ex.exercise_id, session_id: s.id, date, weight: x.weight, reps: x.reps!, types: res.types })
        running.push({ exercise_id: ex.exercise_id, weight: x.weight, reps: x.reps!, kind: x.kind, session_id: s.id, date, set_id: x.id })
      }
      if (running.length) sets.set(ex.exercise_id, running)
    }
  }
  return { prs, sets }
}

/** Rep counts shown as "rep records" (best weight for at least N reps). */
export const REP_MARKS = [1, 3, 5, 8, 10, 12]

export interface ExerciseRecord {
  exercise_id: string
  name: string
  tracking: Tracking
  /** the set with the best estimated 1-rep max (for reps-only exercises: the set with most reps) */
  best: { weight: number; reps: number; date: string }
  /** best estimated 1-rep max in kg, 0 for reps-only exercises */
  e1rm: number
  heaviest: { weight: number; reps: number; date: string }
  mostReps: { weight: number; reps: number; date: string }
  /** best weight for at least N reps, only where it differs from the next mark down */
  repRecords: { reps: number; weight: number }[]
  /** date of the newest PR, else of the first time it was logged */
  lastPR: string
  prCount: number
  lastDone: string
}

export function exerciseRecords(db: DB, hist: History = scanHistory(db)): ExerciseRecord[] {
  const byId = new Map(db.exercises.map((e) => [e.id, e]))
  const lastPR = new Map<string, { date: string; n: number }>()
  for (const p of hist.prs) {
    const cur = lastPR.get(p.exercise_id)
    lastPR.set(p.exercise_id, { date: p.date, n: (cur?.n ?? 0) + 1 })
  }
  const out: ExerciseRecord[] = []
  for (const [id, sets] of hist.sets) {
    const ex = byId.get(id)
    if (!ex || !sets.length) continue // deleted exercise: nothing to open
    const tracking = trackingOf(ex)
    let heaviest = sets[0]
    let mostReps = sets[0]
    let bestE = sets[0]
    for (const s of sets) {
      if (s.weight > heaviest.weight || (s.weight === heaviest.weight && s.reps > heaviest.reps)) heaviest = s
      if (s.reps > mostReps.reps || (s.reps === mostReps.reps && s.weight > mostReps.weight)) mostReps = s
      if (e1rm(s.weight, s.reps) > e1rm(bestE.weight, bestE.reps)) bestE = s
    }
    const bestSet = tracking === 'reps' || heaviest.weight === 0 ? mostReps : bestE
    const repRecords: ExerciseRecord['repRecords'] = []
    if (heaviest.weight > 0)
      for (const r of REP_MARKS) {
        const ok = sets.filter((s) => s.reps >= r)
        if (!ok.length) continue
        const w = Math.max(...ok.map((s) => s.weight))
        if (w > 0 && !repRecords.some((x) => x.weight === w)) repRecords.push({ reps: r, weight: w })
      }
    const pr = lastPR.get(id)
    const pick = (s: SetRec) => ({ weight: s.weight, reps: s.reps, date: s.date })
    out.push({
      exercise_id: id,
      name: ex.name,
      tracking,
      best: pick(bestSet),
      e1rm: heaviest.weight > 0 ? e1rm(bestE.weight, bestE.reps) : 0,
      heaviest: pick(heaviest),
      mostReps: pick(mostReps),
      repRecords,
      lastPR: pr?.date ?? sets[0].date,
      prCount: pr?.n ?? 0,
      lastDone: sets[sets.length - 1].date
    })
  }
  return out.sort((a, b) => b.lastPR.localeCompare(a.lastPR) || b.lastDone.localeCompare(a.lastDone))
}
