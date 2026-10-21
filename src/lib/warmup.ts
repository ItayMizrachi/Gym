import { loadBar } from './plates'
import { roundTo } from './format'
import type { SessionSet } from './types'

/** One planned warm-up set. */
export interface WarmupSet {
  weight: number
  reps: number
}

export type WarmupStyle = 'barbell' | 'plates' | 'dumbbell' | 'stack' | 'none'

const EPS = 1e-6

/** How an exercise is loaded, from its equipment (old rows without equipment fall back to the name). */
export function warmupStyle(equipment: string | undefined, name = ''): WarmupStyle {
  const eq = (equipment ?? '').toLowerCase()
  const n = name.toLowerCase()
  if (eq === 'barbell') return 'barbell'
  if (eq === 'smith') return 'plates'
  if (eq === 'dumbbell' || eq === 'kettlebell') return 'dumbbell'
  if (eq === 'machine' || eq === 'cable' || eq === 'other') return 'stack'
  if (eq === 'bodyweight' || eq === 'band') return 'none'
  // no equipment saved
  if (/barbell|\bbb\b/.test(n)) return 'barbell'
  if (/dumbbell|\bdb\b|kettlebell/.test(n)) return 'dumbbell'
  return 'stack'
}

/**
 * Warm-up ramp for a first work set of `work` kg.
 * Barbell: empty bar × 10, then 50% × 5, 70% × 3 and (for heavy sets) 85% × 1, each rounded to loadable plates.
 * Machines, cables and dumbbells get two lighter sets. Very light work weights get none.
 * Steps that round to the same weight as the one before, or reach the work weight, are skipped.
 */
export function warmupSets(work: number, opts: { style: WarmupStyle; barKg: number; plates: number[] }): WarmupSet[] {
  const { style, barKg, plates } = opts
  if (!(work > 0) || style === 'none') return []

  let start: WarmupSet[] = []
  let steps: [pct: number, reps: number][]
  let round: (kg: number) => number

  if (style === 'barbell') {
    if (work < barKg * 1.5) return []
    start = [{ weight: barKg, reps: 10 }]
    steps = work >= barKg * 3 ? [[0.5, 5], [0.7, 3], [0.85, 1]] : [[0.5, 5], [0.75, 3]]
    round = (kg) => loadBar(kg, barKg, plates).achieved
  } else if (style === 'plates') {
    // plate-loaded with an unknown sled or bar weight: count plates only
    if (work < 20) return []
    steps = work >= 60 ? [[0.4, 10], [0.6, 5], [0.8, 2]] : [[0.5, 10], [0.75, 5]]
    round = (kg) => loadBar(kg, 0, plates).achieved
  } else if (style === 'dumbbell') {
    if (work < 10) return []
    steps = [[0.5, 10], [0.75, 5]]
    round = (kg) => roundTo(kg, 2)
  } else {
    if (work < 15) return []
    steps = work >= 60 ? [[0.4, 10], [0.6, 6], [0.8, 3]] : [[0.5, 10], [0.75, 5]]
    round = (kg) => roundTo(kg, 2.5)
  }

  const out = [...start]
  for (const [pct, reps] of steps) {
    const w = round(work * pct)
    const prev = out[out.length - 1]?.weight ?? 0
    if (w <= prev + EPS || w >= work - EPS || w <= 0) continue
    out.push({ weight: w, reps })
  }
  return out
}

/**
 * Put warm-up rows in front of the first work set.
 * Logged rows are never touched. Unlogged warm-up rows in front of the first work set are replaced,
 * and planned steps at or below the heaviest logged warm-up are dropped, so it never duplicates.
 * Returns null when there is nothing to add (no work set, or work sets already started).
 */
export function insertWarmups(sets: SessionSet[], plan: WarmupSet[], make: (w: WarmupSet) => SessionSet): SessionSet[] | null {
  const firstWork = sets.findIndex((s) => s.kind === 'work' || s.kind === 'failure')
  if (firstWork < 0 || !plan.length) return null
  if (sets.some((s) => (s.kind === 'work' || s.kind === 'failure') && s.done)) return null
  const before = sets.slice(0, firstWork)
  const keptBefore = before.filter((s) => s.kind !== 'warmup' || s.done)
  const loggedWarm = keptBefore.filter((s) => s.kind === 'warmup')
  const top = loggedWarm.length ? Math.max(...loggedWarm.map((s) => s.weight)) : -Infinity
  const fresh = plan.filter((p) => p.weight > top + EPS)
  if (!fresh.length) return null
  return [...keptBefore, ...fresh.map(make), ...sets.slice(firstWork)]
}
