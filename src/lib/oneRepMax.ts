import { e1rm } from './pr'
import { loadBar } from './plates'

/** Weight you could lift for `reps` at the same effort as a 1-rep max of `max` (inverse of e1rm; 1 rep = the max itself). */
export function weightForReps(max: number, reps: number): number {
  if (!(max > 0) || !(reps > 0)) return 0
  if (reps <= 1) return max
  // e1rm(1, reps) is the Epley multiplier for that many reps
  return max / e1rm(1, reps)
}

export interface RepRow {
  reps: number
  weight: number
}

/** Same-effort weights for 1 to 12 reps from an estimated max. */
export function repTable(max: number, upTo = 12): RepRow[] {
  return Array.from({ length: upTo }, (_, i) => ({ reps: i + 1, weight: weightForReps(max, i + 1) }))
}

export interface PctRow {
  pct: number
  /** exact kg */
  weight: number
  /** nearest weight you can load on the bar */
  loadable: number
}

/** Percent-of-max table, each weight also rounded to the nearest loadable barbell weight. */
export function percentTable(max: number, barKg: number, plates: number[], pcts = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]): PctRow[] {
  return pcts.map((pct) => {
    const weight = (max * pct) / 100
    return { pct, weight, loadable: loadBar(weight, barKg, plates).achieved }
  })
}
