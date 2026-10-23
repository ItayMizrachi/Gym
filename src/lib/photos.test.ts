import { describe, expect, it } from 'vitest'
import { weightNear } from './photos'

const w = (date: string, weight_kg: number | null) => ({ date, weight_kg })

describe('weightNear', () => {
  it("uses the photo entry's own weight first", () => {
    expect(weightNear(w('2026-10-10', 72), [w('2026-10-10', 70)])).toBe(72)
  })
  it('takes the closest weigh-in within three days', () => {
    expect(weightNear(w('2026-10-10', null), [w('2026-10-07', 71), w('2026-10-11', 72.5), w('2026-10-20', 70)])).toBe(72.5)
  })
  it('gives nothing when no weigh-in is close enough', () => {
    expect(weightNear(w('2026-10-10', null), [w('2026-10-01', 71)])).toBeNull()
  })
})
