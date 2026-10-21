import { describe, expect, it } from 'vitest'
import { DB, emptyDB, Exercise, Session, SessionSet, SetKind } from './types'
import { achievements, clampGoal, freshAchievements, goalWeeksInRow, isLift, nextUp, weekGoal } from './achievements'
import { exerciseRecords, scanHistory } from './records'

let n = 0
const set = (weight: number, reps: number, kind: SetKind = 'work'): SessionSet => ({
  id: `s${++n}`,
  kind,
  weight,
  reps,
  done: true,
  done_at: `2026-01-01T10:${String(n % 60).padStart(2, '0')}:00`
})
const ex = (id: string, name: string, extra: Partial<Exercise> = {}): Exercise => ({
  id,
  user_id: 'u',
  name,
  muscle: 'Chest',
  notes: '',
  setup: '',
  image_path: null,
  rest_sec: 90,
  created_at: '',
  ...extra
})
/** `start` is local time; the workout lasts 60 min */
const session = (id: string, start: string, exercises: [string, SessionSet[]][]): Session => ({
  id,
  user_id: 'u',
  workout_id: 'w',
  name: 'Upper A',
  started_at: new Date(start).toISOString(),
  finished_at: new Date(new Date(start).getTime() + 3_600_000).toISOString(),
  notes: '',
  data: {
    exercises: exercises.map(([exercise_id, sets]) => ({ exercise_id, name: exercise_id, rest_sec: 90, superset: '', note: '', rep_min: 5, rep_max: 8, sets }))
  }
})
const db = (sessions: Session[], extra: Partial<DB> = {}): DB => ({
  ...emptyDB(),
  exercises: [ex('bench', 'Bench Press (Barbell)'), ex('squat', 'Back Squat'), ex('dl', 'Deadlift'), ex('curl', 'Bicep Curl'), ex('pu', 'Pull-up', { tracking: 'reps' })],
  sessions,
  ...extra
})
const byId = (list: ReturnType<typeof achievements>, id: string) => list.find((a) => a.id === id)!

// Sundays (weeks start on Sunday): 2026-09-06, 09-13, 09-20, 09-27, 10-04, 10-11, 10-18; "now" = Wed 2026-10-21
const NOW = new Date('2026-10-21T12:00:00')

describe('isLift', () => {
  it('matches the classic lifts only', () => {
    expect(isLift('Bench Press (Barbell)', 'bench')).toBe(true)
    expect(isLift('Incline Bench Press', 'bench')).toBe(false)
    expect(isLift('Dumbbell Bench Press', 'bench')).toBe(false)
    expect(isLift('Back Squat', 'squat')).toBe(true)
    expect(isLift('Goblet Squat', 'squat')).toBe(false)
    expect(isLift('Deadlift', 'deadlift')).toBe(true)
    expect(isLift('Romanian Deadlift', 'deadlift')).toBe(false)
  })
})

describe('weekly goal', () => {
  const sessions = [
    session('a', '2026-10-18T09:00:00', [['bench', [set(60, 5)]]]),
    session('b', '2026-10-20T09:00:00', [['bench', [set(60, 5)]]])
  ]
  it('counts this week and marks the days trained', () => {
    const g = weekGoal(db(sessions), 3, NOW)
    expect(g.done).toBe(2)
    expect(g.hit).toBe(false)
    expect(g.days).toEqual([true, false, true, false, false, false, false])
    expect(g.today).toBe(3)
  })
  it('clamps the goal to 1–7', () => {
    expect(clampGoal(0)).toBe(1)
    expect(clampGoal(9)).toBe(7)
    expect(clampGoal('x')).toBe(3)
  })
  it('counts weeks in a row; an unfinished current week does not break the run', () => {
    const d = db([
      session('1', '2026-10-04T09:00:00', [['bench', [set(60, 5)]]]),
      session('2', '2026-10-06T09:00:00', [['bench', [set(60, 5)]]]),
      session('3', '2026-10-11T09:00:00', [['bench', [set(60, 5)]]]),
      session('4', '2026-10-13T09:00:00', [['bench', [set(60, 5)]]]),
      session('5', '2026-10-19T09:00:00', [['bench', [set(60, 5)]]])
    ])
    expect(goalWeeksInRow(d, 2, NOW)).toBe(2)
    expect(goalWeeksInRow(d, 1, NOW)).toBe(3)
    expect(goalWeeksInRow(d, 3, NOW)).toBe(0)
  })
})

describe('achievements', () => {
  it('nothing earned on an empty history, the first workout is next', () => {
    const list = achievements(db([]), { now: NOW })
    expect(list.length).toBeGreaterThanOrEqual(15)
    expect(list.every((a) => !a.earned)).toBe(true)
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length)
    expect(byId(list, 'bw-bench').hint).toMatch(/body weight/)
  })

  it('first workout, first record, early bird and 100 kg clubs with dates', () => {
    const d = db([
      session('a', '2026-10-04T06:30:00', [['bench', [set(80, 5)]], ['squat', [set(100, 3)]]]),
      session('b', '2026-10-06T18:00:00', [['bench', [set(85, 5), set(100, 1, 'warmup')]], ['dl', [set(140, 3)]]])
    ])
    const list = achievements(d, { now: NOW })
    expect(byId(list, 'first-workout').earned).toBe(true)
    expect(byId(list, 'first-workout').date).toBe(d.sessions[0].finished_at)
    expect(byId(list, 'early-bird').earned).toBe(true)
    expect(byId(list, 'first-pr').date).toBe(d.sessions[1].finished_at)
    expect(byId(list, 'club-squat').earned).toBe(true)
    expect(byId(list, 'club-deadlift').earned).toBe(true)
    // a warm-up at 100 kg does not count
    expect(byId(list, 'club-bench').earned).toBe(false)
    expect(byId(list, 'club-bench').progress).toBeCloseTo(0.85)
    expect(byId(list, 'workouts-10').current).toBe(2)
  })

  it('body-weight bench uses the body weight logged at the time', () => {
    const metric = (date: string, kg: number) => ({ id: date, user_id: 'u', date, weight_kg: kg, note: '', photo_path: null, created_at: '' })
    const d = db([session('a', '2026-10-04T09:00:00', [['bench', [set(80, 3)]]])], { metrics: [metric('2026-10-01', 80), metric('2026-10-15', 85)] })
    const a = byId(achievements(d, { now: NOW }), 'bw-bench')
    expect(a.earned).toBe(true)
    const d2 = db([session('a', '2026-10-04T09:00:00', [['bench', [set(80, 3)]]])], { metrics: [metric('2026-10-01', 90)] })
    const b = byId(achievements(d2, { now: NOW }), 'bw-bench')
    expect(b.earned).toBe(false)
    expect(b.target).toBe(90)
    expect(b.current).toBe(80)
  })

  it('4-week streak and consistency (goal reached 3 weeks in a row)', () => {
    const weeks = ['2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11']
    const s = weeks.flatMap((w, i) => [
      session(`${i}a`, `${w}T09:00:00`, [['curl', [set(10, 10)]]]),
      session(`${i}b`, `${w.slice(0, 8)}${String(+w.slice(8) + 2).padStart(2, '0')}T09:00:00`, [['curl', [set(10, 10)]]])
    ])
    const list = achievements(db(s), { now: NOW, weeklyGoal: 2 })
    expect(byId(list, 'streak-4').earned).toBe(true)
    expect(byId(list, 'streak-4').date).toBe(s[6].finished_at)
    expect(byId(list, 'goal-3').earned).toBe(true)
    expect(byId(list, 'goal-3').date).toBe(s[5].finished_at)
    expect(byId(achievements(db(s), { now: NOW, weeklyGoal: 3 }), 'goal-3').earned).toBe(false)
  })

  it('10 tonnes in one week', () => {
    const heavy = Array.from({ length: 10 }, () => set(100, 10)) // 10 000 kg
    const list = achievements(db([session('a', '2026-10-04T09:00:00', [['squat', heavy]])]), { now: NOW })
    expect(byId(list, 'week-10t').earned).toBe(true)
  })

  it('next up picks the closest unearned ones, untrackable last', () => {
    const list = achievements(db([session('a', '2026-10-04T09:00:00', [['squat', [set(95, 3)]]])]), { now: NOW })
    const next = nextUp(list)
    expect(next).toHaveLength(3)
    expect(next[0].id).toBe('club-squat')
    expect(next.every((a) => !a.earned)).toBe(true)
  })

  it('toasts only what is new, and nothing on the first run', () => {
    const list = achievements(db([session('a', '2026-10-04T09:00:00', [['curl', [set(10, 10)]]])]), { now: NOW })
    expect(freshAchievements(list, null)).toEqual([])
    expect(freshAchievements(list, new Set()).map((a) => a.id)).toEqual(['first-workout'])
    expect(freshAchievements(list, new Set(['first-workout']))).toEqual([])
  })
})

describe('records', () => {
  it('finds PRs in date order and summarises each exercise', () => {
    const d = db([
      session('a', '2026-10-04T09:00:00', [['bench', [set(80, 5)]], ['pu', [set(0, 8)]]]),
      session('b', '2026-10-06T09:00:00', [['bench', [set(85, 5), set(90, 1)]], ['pu', [set(0, 10)]]]),
      session('c', '2026-10-08T09:00:00', [['bench', [set(70, 12)]]])
    ])
    const hist = scanHistory(d)
    // b: 85x5 (weight + e1rm), 90x1 (weight), pu 10 reps (reps); c: 70x12 (reps at 70, e1rm 98)
    expect(hist.prs.map((p) => `${p.exercise_id}:${p.weight}x${p.reps}`)).toEqual(['bench:85x5', 'bench:90x1', 'pu:0x10', 'bench:70x12'])
    const recs = exerciseRecords(d, hist)
    expect(recs.map((r) => r.exercise_id)).toEqual(['bench', 'pu'])
    const bench = recs[0]
    expect(bench.heaviest.weight).toBe(90)
    expect(bench.best).toMatchObject({ weight: 85, reps: 5 }) // 85 × (1 + 5/30) = 99.2 beats 70 × 1.4 = 98
    expect(bench.e1rm).toBeCloseTo(99.17, 1)
    expect(bench.repRecords).toEqual([
      { reps: 1, weight: 90 },
      { reps: 3, weight: 85 },
      { reps: 8, weight: 70 }
    ])
    expect(bench.prCount).toBe(3)
    const pu = recs[1]
    expect(pu.e1rm).toBe(0)
    expect(pu.best.reps).toBe(10)
  })
})
