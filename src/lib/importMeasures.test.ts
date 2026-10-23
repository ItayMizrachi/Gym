import { describe, expect, it } from 'vitest'
import { isMeasurementExport, parseMeasurements } from './importCsv'

const CSV = `"date","weight_kg","fat_percent","neck_cm","shoulder_cm","chest_cm","left_bicep_cm","right_bicep_cm","left_forearm_cm","right_forearm_cm","abdomen_cm","waist_cm","hips_cm","left_thigh_cm","right_thigh_cm","left_calf_cm","right_calf_cm"
"13 Aug 2026, 00:00",68,,,,,,,,,,,,,,,
"22 Sep 2026, 00:00",,,,,,,,,,,,,,,,
"1 Oct 2026, 00:00",70.9,14.5,,,101,,36,,,84,,,,,37,
`

describe('Hevy measurements', () => {
  it('is told apart from a workout export', () => {
    expect(isMeasurementExport(CSV)).toBe(true)
    expect(isMeasurementExport('"title","start_time","end_time","description","exercise_title","weight_kg"')).toBe(false)
  })
  it('reads weight and tape measures per day and drops empty days', () => {
    expect(parseMeasurements(CSV)).toEqual([
      { date: '2026-08-13', weight_kg: 68, measures: {} },
      { date: '2026-10-01', weight_kg: 70.9, measures: { body_fat_pct: 14.5, chest: 101, arm_r: 36, waist: 84, calf: 37 } }
    ])
  })
})

describe('planBodyImport', () => {
  it('adds new days, fills gaps on existing days and never overwrites a logged weight', async () => {
    const { planBodyImport } = await import('./importCsv')
    const existing = [
      { id: 'a', user_id: 'u', date: '2026-08-13', weight_kg: 67.5, note: '', photo_path: 'p.jpg', created_at: '' },
      { id: 'b', user_id: 'u', date: '2026-10-01', weight_kg: null, note: '', photo_path: null, created_at: '' }
    ]
    let n = 0
    const r = planBodyImport(parseMeasurements(CSV), existing, 'u', 'now', () => `new${n++}`)
    expect([r.added, r.updated, r.skipped]).toEqual([0, 1, 1])
    expect(r.save[0].id).toBe('b')
    expect(r.save[0].weight_kg).toBe(70.9)
    expect(r.save[0].measures?.waist).toBe(84)
  })
})
