import { describe, expect, it } from 'vitest'
import { shortName } from './CalendarHeat'

describe('shortName', () => {
  it('keeps short names and turns long ones into initials', () => {
    expect(shortName('Push')).toBe('Push')
    expect(shortName('Legs')).toBe('Legs')
    expect(shortName('Upper Body')).toBe('UB')
    expect(shortName('Pull + Hamstrings')).toBe('PH')
    expect(shortName('Late night workout 🌙')).toBe('LNW')
    expect(shortName('Lower A (Sunday)')).toBe('LA')
    expect(shortName('Quick workout')).toBe('QW')
  })
})
