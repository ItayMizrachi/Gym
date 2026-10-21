import { describe, expect, it } from 'vitest'
import { Metric } from './types'
import { cleanMeasures, fieldsToShow, latestMeasure, measureDeltas, measureOf, measureSeries, measuresWithData } from './measures'

let n = 0
const m = (date: string, measures?: Record<string, number> | null): Metric => ({
  id: `m${n++}`,
  user_id: 'u',
  date,
  weight_kg: 80,
  note: '',
  photo_path: null,
  created_at: date,
  ...(measures === undefined ? {} : { measures })
})

describe('measures', () => {
  const rows = [
    m('2026-09-20', { waist: 85, chest: 102 }),
    m('2026-07-01', { waist: 88 }),
    m('2026-08-01'), // old row without measures
    m('2026-08-15', null),
    m('2026-09-01', { waist: 86.5, arm_r: 38 }),
    m('2026-10-20', { waist: 84.2 })
  ]

  it('reads values and ignores rows without measures', () => {
    expect(measureOf(rows[2], 'waist')).toBeNull()
    expect(measureOf(rows[3], 'waist')).toBeNull()
    expect(measureOf(rows[0], 'waist')).toBe(85)
    expect(measureSeries(rows, 'waist').map((p) => p.date)).toEqual(['2026-07-01', '2026-09-01', '2026-09-20', '2026-10-20'])
  })

  it('finds the latest value, optionally before a date', () => {
    expect(latestMeasure(rows, 'waist')).toEqual({ date: '2026-10-20', value: 84.2 })
    expect(latestMeasure(rows, 'waist', '2026-09-10')).toEqual({ date: '2026-09-01', value: 86.5 })
    expect(latestMeasure(rows, 'calf')).toBeNull()
  })

  it('lists measures with data in standard order', () => {
    expect(measuresWithData(rows)).toEqual(['waist', 'chest', 'arm_r'])
    expect(measuresWithData([m('2026-01-01')])).toEqual([])
  })

  it('computes change vs 30 days ago and since first', () => {
    const d = measureDeltas(rows, 'waist')
    expect(d.latest?.value).toBe(84.2)
    // 30 days before 2026-10-20 is 2026-09-20 -> 85
    expect(d.vsDays).toBe(-0.8)
    expect(d.sinceFirst).toBe(-3.8)
    expect(d.first?.date).toBe('2026-07-01')
  })

  it('has no deltas with a single value', () => {
    const d = measureDeltas(rows, 'chest')
    expect(d.latest?.value).toBe(102)
    expect(d.vsDays).toBeNull()
    expect(d.sinceFirst).toBeNull()
    expect(measureDeltas(rows, 'calf').latest).toBeNull()
  })

  it('cleans input values', () => {
    expect(cleanMeasures({ waist: 84.25, chest: null, hips: 0, bogus: 3 } as any)).toEqual({ waist: 84.3 })
    expect(cleanMeasures({ waist: null })).toBeNull()
  })

  it('picks fields for the log sheet', () => {
    expect(fieldsToShow([], [])).toEqual(['waist', 'chest', 'arm_r'])
    expect(fieldsToShow(['calf'], ['waist'])).toEqual(['waist', 'calf'])
  })
})
