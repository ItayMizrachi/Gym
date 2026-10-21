import { Metric } from './types'

/** Body measurements stored in Metric.measures. Lengths are cm; body fat is a percentage. */
export const MEASURES = [
  { key: 'waist', label: 'Waist', short: 'Waist', unit: 'cm', how: 'At the navel, relaxed, after breathing out.' },
  { key: 'chest', label: 'Chest', short: 'Chest', unit: 'cm', how: 'Across the nipples, arms down, tape level.' },
  { key: 'hips', label: 'Hips', short: 'Hips', unit: 'cm', how: 'Around the widest part of the glutes.' },
  { key: 'shoulders', label: 'Shoulders', short: 'Shoulders', unit: 'cm', how: 'Around the widest part of both shoulders.' },
  { key: 'neck', label: 'Neck', short: 'Neck', unit: 'cm', how: 'Just below the Adam’s apple.' },
  { key: 'arm_l', label: 'Left arm', short: 'Arm L', unit: 'cm', how: 'Biggest part of the upper arm, flexed.' },
  { key: 'arm_r', label: 'Right arm', short: 'Arm R', unit: 'cm', how: 'Biggest part of the upper arm, flexed.' },
  { key: 'thigh_l', label: 'Left thigh', short: 'Thigh L', unit: 'cm', how: 'Biggest part of the thigh, standing.' },
  { key: 'thigh_r', label: 'Right thigh', short: 'Thigh R', unit: 'cm', how: 'Biggest part of the thigh, standing.' },
  { key: 'calf', label: 'Calf', short: 'Calf', unit: 'cm', how: 'Biggest part of the calf, standing.' },
  { key: 'body_fat_pct', label: 'Body fat', short: 'Body fat', unit: '%', how: 'From a scale or caliper; use the same one each time.' }
] as const

export type MeasureKey = (typeof MEASURES)[number]['key']
export const MEASURE_KEYS: MeasureKey[] = MEASURES.map((m) => m.key)
export const measureInfo = (key: string) => MEASURES.find((m) => m.key === key)

/** Fields shown in the log sheet before the user has picked any. */
export const DEFAULT_FIELDS: MeasureKey[] = ['waist', 'chest', 'arm_r']

export interface MeasurePoint {
  date: string
  value: number
}

const DAY = 86400000
const ts = (d: string) => new Date(d + 'T12:00:00').getTime()

/** A measure's value on one entry, or null. Old rows have no `measures` at all. */
export function measureOf(m: Metric, key: string): number | null {
  const v = m.measures?.[key]
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

/** Every logged value of one measure, oldest first. */
export function measureSeries(metrics: Metric[], key: string): MeasurePoint[] {
  return metrics
    .map((m) => ({ date: m.date, value: measureOf(m, key) }))
    .filter((p): p is MeasurePoint => p.value != null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** The most recent value of a measure (optionally on or before a date), or null. */
export function latestMeasure(metrics: Metric[], key: string, before?: string): MeasurePoint | null {
  const s = measureSeries(metrics, key).filter((p) => before == null || p.date <= before)
  return s.length ? s[s.length - 1] : null
}

/** Measures that have at least one value, in the standard order. */
export function measuresWithData(metrics: Metric[]): MeasureKey[] {
  return MEASURE_KEYS.filter((k) => metrics.some((m) => measureOf(m, k) != null))
}

const round1 = (v: number) => Math.round(v * 10) / 10

export interface MeasureDeltas {
  latest: MeasurePoint | null
  /** latest minus the last value logged at least `days` days before it */
  vsDays: number | null
  /** latest minus the first value ever logged */
  sinceFirst: number | null
  first: MeasurePoint | null
}

export function measureDeltas(metrics: Metric[], key: string, days = 30): MeasureDeltas {
  const s = measureSeries(metrics, key)
  if (!s.length) return { latest: null, vsDays: null, sinceFirst: null, first: null }
  const latest = s[s.length - 1]
  const first = s[0]
  const cut = ts(latest.date) - days * DAY
  const older = s.filter((p) => ts(p.date) <= cut)
  const ref = older.length ? older[older.length - 1] : null
  return {
    latest,
    first,
    vsDays: ref ? round1(latest.value - ref.value) : null,
    sinceFirst: s.length > 1 ? round1(latest.value - first.value) : null
  }
}

/** Drop empty and invalid values; null when nothing is left (so old-style rows stay clean). */
export function cleanMeasures(m: Record<string, number | null | undefined>): Record<string, number> | null {
  const out: Record<string, number> = {}
  for (const k of MEASURE_KEYS) {
    const v = m[k]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = round1(v)
  }
  return Object.keys(out).length ? out : null
}

/** Fields to show in the log sheet: the ones you used before, plus any with data, in standard order. */
export function fieldsToShow(used: string[], withData: string[]): MeasureKey[] {
  const set = new Set([...used, ...withData])
  const picked = MEASURE_KEYS.filter((k) => set.has(k))
  return picked.length ? picked : DEFAULT_FIELDS
}

const USED_KEY = 'gymlog:measures-used'

export function loadUsedFields(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(USED_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : []
  } catch {
    return []
  }
}

export function rememberUsedFields(keys: string[]) {
  if (!keys.length) return
  try {
    const all = Array.from(new Set([...loadUsedFields(), ...keys]))
    localStorage.setItem(USED_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}
