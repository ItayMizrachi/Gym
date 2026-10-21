import { describe, expect, it } from 'vitest'
import { insertWarmups, warmupSets, warmupStyle, WarmupSet } from './warmup'
import { repTable, percentTable, weightForReps } from './oneRepMax'
import { e1rm } from './pr'
import { loadBar } from './plates'
import type { SessionSet } from './types'

const STD = [25, 20, 15, 10, 5, 2.5, 1.25]
const bb = { style: 'barbell' as const, barKg: 20, plates: STD }

describe('warmupStyle', () => {
  it('reads the equipment', () => {
    expect(warmupStyle('Barbell')).toBe('barbell')
    expect(warmupStyle('Smith')).toBe('plates')
    expect(warmupStyle('Dumbbell')).toBe('dumbbell')
    expect(warmupStyle('Cable')).toBe('stack')
    expect(warmupStyle('Bodyweight')).toBe('none')
  })
  it('falls back to the name when equipment is missing', () => {
    expect(warmupStyle('', 'Barbell Row')).toBe('barbell')
    expect(warmupStyle(undefined, 'Incline DB Press')).toBe('dumbbell')
    expect(warmupStyle(undefined, 'Leg Press')).toBe('stack')
  })
})

describe('warmupSets', () => {
  it('ramps a heavy barbell lift: bar × 10, 50% × 5, 70% × 3, 85% × 1', () => {
    expect(warmupSets(100, bb)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 50, reps: 5 },
      { weight: 70, reps: 3 },
      { weight: 85, reps: 1 }
    ])
  })

  it('rounds every barbell weight to loadable plates', () => {
    const sets = warmupSets(137.5, bb)
    for (const s of sets) expect(loadBar(s.weight, 20, STD).exact).toBe(true)
    // with only 5s and 10s, 50% of 100 kg (50) is loadable but 70 kg is not (needs 25 per side)
    const coarse = warmupSets(100, { ...bb, plates: [10, 5] })
    for (const s of coarse) expect(loadBar(s.weight, 20, [10, 5]).exact).toBe(true)
  })

  it('gives a lighter barbell lift fewer steps and no single', () => {
    expect(warmupSets(50, bb)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 25, reps: 5 },
      { weight: 37.5, reps: 3 }
    ])
  })

  it('never repeats a weight or reaches the work weight', () => {
    for (const w of [30, 32.5, 40, 45, 60, 61, 80, 142.5, 200]) {
      const sets = warmupSets(w, bb)
      expect(sets.length).toBeLessThanOrEqual(4)
      for (let i = 1; i < sets.length; i++) expect(sets[i].weight).toBeGreaterThan(sets[i - 1].weight)
      for (const s of sets) expect(s.weight).toBeLessThan(w)
    }
  })

  it('skips warm-ups for very light work weights', () => {
    expect(warmupSets(25, bb)).toEqual([])
    expect(warmupSets(0, bb)).toEqual([])
    expect(warmupSets(8, { ...bb, style: 'dumbbell' })).toEqual([])
    expect(warmupSets(10, { ...bb, style: 'stack' })).toEqual([])
    expect(warmupSets(100, { ...bb, style: 'none' })).toEqual([])
  })

  it('keeps machines and dumbbells short', () => {
    expect(warmupSets(40, { ...bb, style: 'stack' })).toEqual([
      { weight: 20, reps: 10 },
      { weight: 30, reps: 5 }
    ])
    expect(warmupSets(30, { ...bb, style: 'dumbbell' })).toEqual([
      { weight: 16, reps: 10 },
      { weight: 22, reps: 5 }
    ])
    expect(warmupSets(120, { ...bb, style: 'stack' })).toHaveLength(3)
  })
})

let n = 0
const row = (kind: SessionSet['kind'], weight: number, done = false): SessionSet => ({
  id: `s${n++}`,
  kind,
  weight,
  reps: done ? 5 : null,
  done,
  done_at: done ? '2026-10-21T10:00:00Z' : null
})
const make = (w: WarmupSet): SessionSet => ({ ...row('warmup', w.weight), reps: w.reps })
const plan = warmupSets(100, bb)

describe('insertWarmups', () => {
  it('puts the warm-ups before the first work set', () => {
    const sets = [row('work', 100), row('work', 100), row('drop', 75)]
    const out = insertWarmups(sets, plan, make)!
    expect(out.map((s) => `${s.kind}:${s.weight}`)).toEqual(['warmup:20', 'warmup:50', 'warmup:70', 'warmup:85', 'work:100', 'work:100', 'drop:75'])
    expect(out[0].reps).toBe(10)
  })

  it('replaces unlogged warm-ups instead of duplicating them', () => {
    const once = insertWarmups([row('work', 100)], plan, make)!
    const twice = insertWarmups(once, plan, make)!
    expect(twice.filter((s) => s.kind === 'warmup')).toHaveLength(4)
  })

  it('keeps logged warm-ups and only adds the heavier steps', () => {
    const sets = [row('warmup', 20, true), row('warmup', 50, true), row('work', 100)]
    const out = insertWarmups(sets, plan, make)!
    expect(out.map((s) => `${s.kind}:${s.weight}:${s.done}`)).toEqual([
      'warmup:20:true',
      'warmup:50:true',
      'warmup:70:false',
      'warmup:85:false',
      'work:100:false'
    ])
    expect(out[0]).toBe(sets[0])
  })

  it('does nothing once every step is logged, a work set is done, or there is no work set', () => {
    const allDone = plan.map((p) => row('warmup', p.weight, true))
    expect(insertWarmups([...allDone, row('work', 100)], plan, make)).toBeNull()
    expect(insertWarmups([row('work', 100, true), row('work', 100)], plan, make)).toBeNull()
    expect(insertWarmups([row('drop', 50)], plan, make)).toBeNull()
    expect(insertWarmups([row('work', 100)], [], make)).toBeNull()
  })
})

describe('one-rep max tools', () => {
  it('is the inverse of the estimate', () => {
    const max = e1rm(100, 5)
    expect(weightForReps(max, 5)).toBeCloseTo(100, 6)
    expect(weightForReps(max, 1)).toBe(max)
    expect(weightForReps(0, 5)).toBe(0)
  })

  it('lists 1 to 12 reps, heaviest first', () => {
    const t = repTable(120)
    expect(t).toHaveLength(12)
    expect(t[0]).toEqual({ reps: 1, weight: 120 })
    for (let i = 1; i < t.length; i++) expect(t[i].weight).toBeLessThan(t[i - 1].weight)
    expect(t[9].weight).toBeCloseTo(90, 6) // 120 / (1 + 10/30)
  })

  it('rounds the percent table to loadable weights', () => {
    const t = percentTable(141, 20, STD)
    expect(t[0]).toEqual({ pct: 100, weight: 141, loadable: 140 })
    const eighty = t.find((r) => r.pct === 80)!
    expect(eighty.weight).toBeCloseTo(112.8, 6)
    expect(eighty.loadable).toBe(112.5)
  })
})
