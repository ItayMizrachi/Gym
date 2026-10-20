import { describe, expect, it } from 'vitest'
import { gearOk, recommend } from './recommend'
import { gearOf } from './programs'

describe('gearOk', () => {
  it('a gym has everything; home has no machines; none means bodyweight only', () => {
    expect(gearOk('gym', 'gym')).toBe(true)
    expect(gearOk('home', 'gym')).toBe(false)
    expect(gearOk('home', 'none')).toBe(true)
    expect(gearOk('none', 'home')).toBe(false)
  })
})

describe('recommend', () => {
  it('gives a beginner with 3 gym days a beginner 3-day plan', () => {
    const r = recommend({ goal: 'muscle', level: 'Beginner', days: 3, gear: 'gym' })
    expect(r.best.level).toBe('Beginner')
    expect(r.best.days).toBe(3)
  })
  it('never suggests more than the lifter is ready for at the top pick', () => {
    const r = recommend({ goal: 'muscle', level: 'Beginner', days: 6, gear: 'gym' })
    expect(r.best.level).not.toBe('Advanced')
  })
  it('gives an advanced lifter with 6 days a 6-day split', () => {
    const r = recommend({ goal: 'muscle', level: 'Advanced', days: 6, gear: 'gym' })
    expect(r.best.days).toBe(6)
  })
  it('matches the goal', () => {
    expect(recommend({ goal: 'glutes', level: 'Intermediate', days: 4, gear: 'gym' }).best.goal).toBe('Glutes')
    expect(recommend({ goal: 'strength', level: 'Beginner', days: 3, gear: 'gym' }).best.goal).toBe('Get stronger')
  })
  it('respects home equipment', () => {
    const r = recommend({ goal: 'fit', level: 'Beginner', days: 3, gear: 'home' })
    expect(gearOf(r.best)).not.toBe('gym')
    r.others.forEach((p) => expect(gearOf(p)).not.toBe('gym'))
  })
  it('falls back to single workouts when nothing weekly fits (no equipment)', () => {
    const r = recommend({ goal: 'fit', level: 'Beginner', days: 3, gear: 'none' })
    expect(r.best).toBeTruthy()
    expect(gearOf(r.best)).toBe('none')
  })
  it('always returns a different set of alternatives', () => {
    const r = recommend({ goal: 'muscle', level: 'Intermediate', days: 4, gear: 'gym' })
    expect(r.others.map((p) => p.id)).not.toContain(r.best.id)
    expect(r.others.length).toBeGreaterThan(0)
  })
})
