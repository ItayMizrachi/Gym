import type { LastPerformance } from './pr'

/**
 * Double progression: work inside a rep range; once every work set reaches the top of the range,
 * add weight next time. If most sets fell short of the bottom, hold the weight.
 */
export interface Progression {
  kind: 'increase' | 'hold'
  /** heaviest work weight last time */
  from: number
  /** suggested weight (same as `from` for 'hold') */
  to: number
  delta: number
  /** reps of last time's work sets, in order */
  reps: number[]
  /** for 'increase': whether the new weight is currently filled in (false after the user tapped undo) */
  applied?: boolean
}

const WORK = new Set(['work', 'failure'])

export function suggestProgression(
  last: LastPerformance | null,
  repMin: number,
  repMax: number,
  increment: number
): Progression | null {
  if (!last) return null
  const work = last.sets.filter((s) => WORK.has(s.kind) && s.reps != null && s.reps > 0)
  if (!work.length) return null
  const reps = work.map((s) => s.reps!)
  const from = Math.max(...work.map((s) => s.weight))
  if (from <= 0) return null // body-weight work: nothing to add

  if (repMax > 0 && increment > 0 && reps.every((r) => r >= repMax)) {
    return { kind: 'increase', from, to: round2(from + increment), delta: increment, reps, applied: true }
  }
  if (repMin > 0) {
    const short = reps.filter((r) => r < repMin).length
    if (short > reps.length / 2) return { kind: 'hold', from, to: from, delta: 0, reps }
  }
  return null
}

const round2 = (n: number) => Math.round(n * 100) / 100
