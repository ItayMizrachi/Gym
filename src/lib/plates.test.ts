import { describe, expect, it } from 'vitest'
import { loadBar, plateColor } from './plates'

const STD = [25, 20, 15, 10, 5, 2.5, 1.25]

describe('loadBar', () => {
  it('loads exact weights greedily, heaviest first', () => {
    expect(loadBar(100, 20, STD)).toEqual({ perSide: [25, 15], achieved: 100, exact: true })
    expect(loadBar(142.5, 20, STD)).toEqual({ perSide: [25, 25, 10, 1.25], achieved: 142.5, exact: true })
    expect(loadBar(62.5, 20, STD)).toEqual({ perSide: [20, 1.25], achieved: 62.5, exact: true })
  })

  it('returns an empty bar for the bar weight or less', () => {
    expect(loadBar(20, 20, STD)).toEqual({ perSide: [], achieved: 20, exact: true })
    expect(loadBar(15, 20, STD)).toEqual({ perSide: [], achieved: 20, exact: false })
  })

  it('rounds an unreachable weight down to the nearest achievable', () => {
    // 61 kg: 20.5 per side -> 20 (60 kg) is closer than 21.25 (62.5 kg)
    expect(loadBar(61, 20, STD)).toEqual({ perSide: [20], achieved: 60, exact: false })
  })

  it('rounds an unreachable weight up when that is nearer', () => {
    // 62 kg: 21 per side -> 21.25 (62.5) is nearer than 20 (60)
    expect(loadBar(62, 20, STD)).toEqual({ perSide: [20, 1.25], achieved: 62.5, exact: false })
  })

  it('prefers the lighter loading on a tie', () => {
    // 61.25 kg sits exactly between 60 and 62.5
    expect(loadBar(61.25, 20, STD).achieved).toBe(60)
  })

  it('respects a custom bar and plate set', () => {
    expect(loadBar(60, 15, [20, 10, 5, 2.5])).toEqual({ perSide: [20, 2.5], achieved: 60, exact: true })
    expect(loadBar(100, 20, [10])).toEqual({ perSide: [10, 10, 10, 10], achieved: 100, exact: true })
    expect(loadBar(105, 20, [10]).achieved).toBe(100)
  })

  it('ignores duplicate, unsorted and zero plates', () => {
    expect(loadBar(70, 20, [5, 0, 25, 25])).toEqual({ perSide: [25], achieved: 70, exact: true })
  })

  it('handles no plates at all', () => {
    expect(loadBar(60, 20, [])).toEqual({ perSide: [], achieved: 20, exact: false })
  })
})

describe('plateColor', () => {
  it('uses competition colours', () => {
    expect(plateColor(25)).toBe('#d8383a')
    expect(plateColor(20)).toBe('#2f6fd6')
    expect(plateColor(15)).toBe('#e8c12f')
    expect(plateColor(10)).toBe('#3aa05a')
    expect(plateColor(5)).toBe('#eeeeea')
    expect(plateColor(2.5)).toBe(plateColor(1.25))
  })
})
