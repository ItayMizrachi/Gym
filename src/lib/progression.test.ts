import { describe, expect, it } from 'vitest'
import { suggestProgression } from './progression'
import type { LastPerformance } from './pr'
import type { SessionSet, SetKind } from './types'

const set = (weight: number, reps: number, kind: SetKind = 'work'): SessionSet => ({
  id: Math.random().toString(36),
  kind,
  weight,
  reps,
  done: true,
  done_at: '2026-01-01T10:00:00Z'
})
const last = (...sets: SessionSet[]): LastPerformance => ({ date: '2026-01-01T10:00:00Z', sets })

describe('suggestProgression', () => {
  it('returns null without history', () => {
    expect(suggestProgression(null, 6, 8, 2.5)).toBeNull()
  })

  it('suggests an increase when every work set hit the top of the range', () => {
    const p = suggestProgression(last(set(60, 8), set(60, 8), set(60, 9)), 6, 8, 2.5)
    expect(p).toEqual({ kind: 'increase', from: 60, to: 62.5, delta: 2.5, reps: [8, 8, 9], applied: true })
  })

  it('uses the configured increment', () => {
    expect(suggestProgression(last(set(20, 12), set(20, 12)), 10, 12, 1)?.to).toBe(21)
  })

  it('ignores warm-ups and drop sets', () => {
    const p = suggestProgression(last(set(30, 5, 'warmup'), set(60, 8), set(60, 8), set(45, 6, 'drop')), 6, 8, 2.5)
    expect(p?.kind).toBe('increase')
    expect(p?.reps).toEqual([8, 8])
  })

  it('counts failure sets as work', () => {
    expect(suggestProgression(last(set(60, 8), set(60, 7, 'failure')), 6, 8, 2.5)).toBeNull()
  })

  it('stays quiet inside the range', () => {
    expect(suggestProgression(last(set(60, 8), set(60, 7), set(60, 6)), 6, 8, 2.5)).toBeNull()
  })

  it('suggests holding when most sets fell below the bottom of the range', () => {
    const p = suggestProgression(last(set(60, 6), set(60, 5), set(60, 4)), 6, 8, 2.5)
    expect(p).toMatchObject({ kind: 'hold', from: 60, to: 60, delta: 0 })
  })

  it('does not hold when only a minority fell short', () => {
    expect(suggestProgression(last(set(60, 7), set(60, 6), set(60, 5)), 6, 8, 2.5)).toBeNull()
  })

  it('takes the heaviest work set as the base', () => {
    expect(suggestProgression(last(set(55, 10), set(60, 10)), 8, 10, 2.5)?.to).toBe(62.5)
  })

  it('skips body-weight work and missing rep ranges', () => {
    expect(suggestProgression(last(set(0, 15), set(0, 15)), 10, 12, 2.5)).toBeNull()
    expect(suggestProgression(last(set(60, 8)), 0, 0, 2.5)).toBeNull()
  })
})
