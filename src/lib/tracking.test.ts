import { describe, expect, it } from 'vitest'
import { fmtTime, missingForLog, parseTime, prevLabel, setLabel, setVolume } from './tracking'
import { lastPerformance, priorSets, sessionPRs } from './pr'
import { emptyDB, Session, SessionSet } from './types'

const set = (p: Partial<SessionSet>): SessionSet => ({ id: Math.random().toString(36), kind: 'work', weight: 0, reps: null, done: true, done_at: '2026-01-01T10:00:00Z', ...p })

describe('time format', () => {
  it('formats seconds as m:ss', () => {
    expect(fmtTime(0)).toBe('0:00')
    expect(fmtTime(75)).toBe('1:15')
    expect(fmtTime(600)).toBe('10:00')
    expect(fmtTime(null)).toBe('')
  })
  it('parses m:ss and plain seconds', () => {
    expect(parseTime('1:15')).toBe(75)
    expect(parseTime('45')).toBe(45)
    expect(parseTime('2:')).toBe(120)
    expect(parseTime(':30')).toBe(30)
    expect(parseTime('1.30')).toBe(90)
    expect(parseTime('')).toBeNull()
    expect(parseTime('abc')).toBeNull()
  })
})

describe('what a set needs before it can be logged', () => {
  it('time sets need a time, not reps', () => {
    expect(missingForLog({ reps: null, time_sec: null }, 'time')).toBe('time')
    expect(missingForLog({ reps: null, time_sec: 40 }, 'time')).toBeNull()
  })
  it('reps-only and weight sets need reps', () => {
    expect(missingForLog({ reps: null }, 'reps')).toBe('reps')
    expect(missingForLog({ reps: 12 }, 'reps')).toBeNull()
    expect(missingForLog({ reps: 0 }, 'weight_reps')).toBe('reps')
  })
})

describe('labels', () => {
  it('shows the right unit for each kind of exercise', () => {
    expect(setLabel(set({ weight: 60, reps: 8 }), 'weight_reps')).toBe('60×8')
    expect(setLabel(set({ reps: 12, kind: 'warmup' }), 'reps')).toBe('W 12 reps')
    expect(setLabel(set({ time_sec: 90 }), 'time')).toBe('1:30')
    expect(prevLabel(set({ time_sec: 45 }), 'time')).toBe('0:45')
    expect(prevLabel(set({ reps: 15 }), 'reps')).toBe('15')
    expect(prevLabel(set({ weight: 10, reps: 8 }), 'reps')).toBe('+10×8')
    expect(prevLabel(undefined, 'time')).toBe('–')
  })
  it('time sets add no volume', () => {
    expect(setVolume(set({ time_sec: 60 }))).toBe(0)
    expect(setVolume(set({ weight: 50, reps: 10 }))).toBe(500)
    expect(setVolume(set({ weight: 50, reps: 10, done: false }))).toBe(0)
  })
})

describe('records ignore time sets', () => {
  const sess = (id: string, day: string, sets: SessionSet[]): Session => ({
    id,
    user_id: 'u',
    workout_id: null,
    name: 'W',
    started_at: `${day}T10:00:00Z`,
    finished_at: `${day}T11:00:00Z`,
    notes: '',
    data: { exercises: [{ exercise_id: 'plank', name: 'Plank', rest_sec: 60, superset: '', note: '', rep_min: 0, rep_max: 0, sets }] }
  })
  it('never become a baseline or a PR, but do count as "last time"', () => {
    const db = emptyDB()
    // a time set that somehow also carries reps and weight still must not count
    db.sessions = [sess('a', '2026-01-01', [set({ time_sec: 60 }), set({ time_sec: 30, weight: 20, reps: 1 })])]
    expect(priorSets(db, 'plank')).toHaveLength(0)
    expect(sessionPRs(db, db.sessions[0])).toHaveLength(0)
    const last = lastPerformance(db, 'plank')
    expect(last?.sets.map((s) => s.time_sec)).toEqual([60, 30])
  })
  it('reps-only body-weight sets still give rep records', () => {
    const db = emptyDB()
    db.sessions = [sess('a', '2026-01-01', [set({ reps: 10 })]), sess('b', '2026-01-08', [set({ reps: 12 })])]
    const prs = sessionPRs(db, db.sessions[1])
    expect(prs).toHaveLength(1)
    expect(prs[0].types).toContain('reps')
  })
})
