import type { Metric } from './types'

const DAY = 86400000
const ts = (d: string) => new Date(d + 'T12:00:00').getTime()

/** The photo's own weight, or the closest weigh-in within 3 days (photos are often logged on their own). */
export function weightNear(m: Pick<Metric, 'date' | 'weight_kg'>, all: Pick<Metric, 'date' | 'weight_kg'>[]): number | null {
  if (m.weight_kg != null) return m.weight_kg
  let best: Pick<Metric, 'date' | 'weight_kg'> | null = null
  for (const x of all) {
    if (x.weight_kg == null) continue
    const gap = Math.abs(ts(x.date) - ts(m.date))
    if (gap <= 3 * DAY && (!best || gap < Math.abs(ts(best.date) - ts(m.date)))) best = x
  }
  return best?.weight_kg ?? null
}
