import { describe, expect, it } from 'vitest'
import { emptyDB, DB, Exercise, Session, SessionSet, SetKind } from './types'
import {
  estimateCalories,
  latestBodyWeight,
  muscleSplit,
  prSetIds,
  restDaysThisWeek,
  summarizeSession,
  totals,
  weeklySeries,
  dayNames
} from './stats'

let n = 0
const set = (weight: number, reps: number | null, kind: SetKind = 'work', extra: Partial<SessionSet> = {}): SessionSet => ({
  id: `s${++n}`,
  kind,
  weight,
  reps,
  done: true,
  done_at: `2026-01-01T10:${String(n % 60).padStart(2, '0')}:00Z`,
  ...extra
})
const ex = (id: string, muscle: string): Exercise => ({
  id,
  user_id: 'u',
  name: id,
  muscle,
  notes: '',
  setup: '',
  image_path: null,
  rest_sec: 90,
  created_at: ''
})
const session = (id: string, start: string, minutes: number, exercises: [string, SessionSet[]][], name = 'Upper A'): Session => ({
  id,
  user_id: 'u',
  workout_id: 'w',
  name,
  started_at: new Date(start).toISOString(),
  finished_at: new Date(new Date(start).getTime() + minutes * 60000).toISOString(),
  notes: '',
  data: {
    exercises: exercises.map(([exercise_id, sets]) => ({ exercise_id, name: exercise_id, rest_sec: 90, superset: '', note: '', rep_min: 6, rep_max: 8, sets }))
  }
})
const dbWith = (sessions: Session[]): DB => ({ ...emptyDB(), exercises: [ex('bench', 'Chest'), ex('row', 'Back'), ex('plank', 'Abs')], sessions })

describe('summarizeSession', () => {
  it('counts reps and ignores warm-ups; time-only sets add a set but no reps', () => {
    const s = session('a', '2026-01-05T10:00:00', 60, [
      ['bench', [set(40, 10, 'warmup'), set(80, 8), set(80, 6)]],
      ['plank', [set(0, null, 'work', { time_sec: 60 })]]
    ])
    expect(summarizeSession(s)).toMatchObject({ sets: 3, reps: 14, volume: 1120, minutes: 60 })
  })
})

describe('calories', () => {
  it('uses MET × kg × hours and falls back to 75 kg', () => {
    expect(estimateCalories(60, 80)).toBe(400)
    expect(estimateCalories(60, null)).toBe(375)
    expect(estimateCalories(0, 80)).toBe(0)
  })
  it('reads the most recent body weight', () => {
    const db = emptyDB()
    db.metrics = [
      { id: '1', user_id: 'u', date: '2026-01-01', weight_kg: 80, note: '', photo_path: null, created_at: '' },
      { id: '2', user_id: 'u', date: '2026-02-01', weight_kg: 78.5, note: '', photo_path: null, created_at: '' },
      { id: '3', user_id: 'u', date: '2026-03-01', weight_kg: null, note: '', photo_path: 'x', created_at: '' }
    ]
    expect(latestBodyWeight(db)).toBe(78.5)
    expect(latestBodyWeight(emptyDB())).toBeNull()
  })
})

describe('muscleSplit', () => {
  it('gives each muscle its share of working sets, drop = half', () => {
    const s = session('a', '2026-01-05T10:00:00', 60, [
      ['bench', [set(80, 8), set(80, 8), set(60, 10, 'drop')]],
      ['row', [set(70, 10), set(40, 10, 'warmup')]]
    ])
    expect(muscleSplit(dbWith([s]), s)).toEqual([
      { muscle: 'Chest', sets: 2.5, pct: 71 },
      { muscle: 'Back', sets: 1, pct: 29 }
    ])
  })
})

describe('prSetIds', () => {
  it('marks the sets that beat earlier sessions', () => {
    const old = session('a', '2026-01-05T10:00:00', 60, [['bench', [set(80, 8)]]])
    const better = set(85, 5)
    const same = set(80, 8)
    const s = session('b', '2026-01-12T10:00:00', 60, [['bench', [same, better]]])
    const ids = prSetIds(dbWith([old, s]), s)
    expect(ids.has(better.id)).toBe(true)
    expect(ids.has(same.id)).toBe(false)
  })
  it('the first session of an exercise has no records', () => {
    const s = session('a', '2026-01-05T10:00:00', 60, [['bench', [set(80, 8)]]])
    expect(prSetIds(dbWith([s]), s).size).toBe(0)
  })
})

describe('weeklySeries', () => {
  // Wednesday 21 Jan 2026; weeks start on Sunday
  const now = new Date('2026-01-21T18:00:00')
  const db = dbWith([
    session('a', '2026-01-18T10:00:00', 50, [['bench', [set(100, 5)]]]), // this week
    session('b', '2026-01-20T10:00:00', 40, [['bench', [set(100, 5)]]]), // this week
    session('c', '2026-01-13T10:00:00', 30, [['bench', [set(50, 10)]]]), // last week
    session('d', '2025-12-01T10:00:00', 30, [['bench', [set(50, 10)]]]) // 8 weeks ago
  ])
  it('sums duration per week, current week last', () => {
    const w = weeklySeries(db, 'duration', '4w', now)
    expect(w.map((x) => x.value)).toEqual([0, 0, 30, 90])
    expect(w[3].start.getDay()).toBe(0)
  })
  it('switches metric', () => {
    expect(weeklySeries(db, 'volume', '4w', now).map((x) => x.value)).toEqual([0, 0, 500, 1000])
    expect(weeklySeries(db, 'reps', '4w', now).map((x) => x.value)).toEqual([0, 0, 10, 10])
  })
  it('longer ranges have more weeks and reach older sessions', () => {
    const w = weeklySeries(db, 'duration', '3m', now)
    expect(w.length).toBe(13)
    expect(w.reduce((a, x) => a + x.value, 0)).toBe(150)
    expect(weeklySeries(db, 'duration', '1y', now).length).toBe(52)
  })
  it('totals and rest days', () => {
    expect(totals(db)).toMatchObject({ workouts: 4, minutes: 150 })
    // Sun 18 trained, Mon 19 rest, Tue 20 trained, Wed 21 (today) rest
    expect(restDaysThisWeek(db, now)).toBe(2)
  })
  it('names training days without the date suffix', () => {
    const s = session('x', '2026-01-18T10:00:00', 50, [], 'Lower B (18 Jan)')
    expect(dayNames(dbWith([s])).get('2026-01-18')).toEqual(['Lower B'])
  })
})
