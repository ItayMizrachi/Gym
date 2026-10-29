import { describe, expect, it } from 'vitest'
import { goalView } from './goals'

const pt = (date: string, bestE1rm: number) => ({ date, bestE1rm, topWeight: bestE1rm, volume: 0 }) as never

describe('goal forecast', () => {
  const now = new Date('2026-10-29T12:00:00')
  it('reached when the best e1RM is at the target', () => {
    const v = goalView({ exerciseId: 'b', weight: 100, reps: 1, created: '' }, [pt('2026-10-20', 104)], now)
    expect(v.reached).toBe(true)
    expect(v.pct).toBe(1)
  })
  it('a rising trend gives a date; a flat one does not', () => {
    const rising = [pt('2026-09-01', 80), pt('2026-09-29', 85), pt('2026-10-27', 90)]
    const v = goalView({ exerciseId: 'b', weight: 100, reps: 1, created: '', by: '2027-03-01' }, rising, now)
    expect(v.eta).not.toBeNull()
    expect(v.onTrack).toBe(true)
    const flat = [pt('2026-09-01', 90), pt('2026-09-29', 90), pt('2026-10-27', 90)]
    expect(goalView({ exerciseId: 'b', weight: 100, reps: 1, created: '' }, flat, now).eta).toBeNull()
  })
})
