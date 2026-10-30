import { useEffect, useMemo } from 'react'
import { useStore } from './store'
import { HistoryPoint, e1rm } from './pr'
import { Exercise } from './types'

/*
 * Personal goals: "Bench Press 100 kg × 1 by 31 Dec", stored on the exercise (synced with the account).
 * Progress is measured in estimated 1-rep max, so a goal of 90 × 5 and your 95 × 3 compare fairly.
 * The forecast is a straight line through your best e1RM per workout over the last 10 weeks.
 */

export interface Goal {
  exerciseId: string
  weight: number
  reps: number
  /** YYYY-MM-DD, optional */
  by?: string
  created: string
}

export interface GoalView {
  /** 0..1 of the way there */
  pct: number
  current: number
  target: number
  reached: boolean
  /** when the trend line reaches the target, if it is going up */
  eta: Date | null
  /** with a date: will the trend get there in time */
  onTrack: boolean | null
}

/** goals saved on the device before they synced with the account (moved onto the exercise on first use) */
const legacyKey = () => `gymlog:goals:${useStore.getState().user?.id ?? 'local'}`

function goalOf(e: Exercise): Goal | null {
  const g = e.goal
  return g && g.weight > 0 && g.reps > 0 ? { exerciseId: e.id, weight: g.weight, reps: g.reps, by: g.by, created: g.created } : null
}

/** move device-only goals onto their exercises once (they then sync with the account) */
function migrateLegacy() {
  let old: Goal[] = []
  try {
    old = JSON.parse(localStorage.getItem(legacyKey()) ?? '[]')
  } catch {
    return
  }
  if (!Array.isArray(old) || !old.length) return
  const { db, save } = useStore.getState()
  for (const g of old) {
    const e = db.exercises.find((x) => x.id === g.exerciseId)
    if (e && !e.goal) save('exercises', { ...e, goal: { weight: g.weight, reps: g.reps, by: g.by, created: g.created } })
  }
  try {
    localStorage.removeItem(legacyKey())
  } catch {
    /* ignore */
  }
}

export function setGoal(g: Goal) {
  const { db, save } = useStore.getState()
  const e = db.exercises.find((x) => x.id === g.exerciseId)
  if (e) save('exercises', { ...e, goal: { weight: g.weight, reps: g.reps, by: g.by, created: g.created } })
}
export function removeGoal(exerciseId: string) {
  const { db, save } = useStore.getState()
  const e = db.exercises.find((x) => x.id === exerciseId)
  if (e) save('exercises', { ...e, goal: null })
}
/** every goal, from the exercises (kept with the account) */
export function useGoals(): Goal[] {
  const exercises = useStore((s) => s.db.exercises)
  useEffect(() => migrateLegacy(), [])
  return useMemo(() => exercises.map(goalOf).filter((g): g is Goal => g != null), [exercises])
}

const DAY = 86400000
const WINDOW = 70 * DAY

export function goalView(goal: Goal, hist: HistoryPoint[], now = new Date()): GoalView {
  const target = e1rm(goal.weight, goal.reps)
  const current = hist.reduce((m, h) => Math.max(m, h.bestE1rm), 0)
  const reached = current >= target - 1e-9
  const pct = target > 0 ? Math.min(1, current / target) : 0
  let eta: Date | null = null
  if (!reached) {
    const pts = hist.filter((h) => h.bestE1rm > 0 && now.getTime() - new Date(h.date).getTime() <= WINDOW).map((h) => ({ x: new Date(h.date).getTime() / DAY, y: h.bestE1rm }))
    if (pts.length >= 3) {
      const n = pts.length
      const mx = pts.reduce((a, p) => a + p.x, 0) / n
      const my = pts.reduce((a, p) => a + p.y, 0) / n
      const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0)
      const slope = sxx ? pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx : 0
      // only a real upward trend; from today's best, at that pace
      if (slope > 0.005) {
        const days = (target - current) / slope
        if (days < 3 * 365) eta = new Date(now.getTime() + days * DAY)
      }
    }
  }
  const onTrack = goal.by ? reached || (eta != null && eta.getTime() <= new Date(goal.by + 'T23:59:59').getTime()) : null
  return { pct, current, target, reached, eta, onTrack }
}
