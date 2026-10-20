import { describe, expect, it } from 'vitest'
import { e1rm, evaluateSet, lastPerformance, priorSets, repsForPR, sessionPRs, SetRec } from './pr'
import { emptyDB, Session, SessionSet, SetKind } from './types'

const rec = (weight: number, reps: number): SetRec => ({
  exercise_id: 'bench',
  weight,
  reps,
  kind: 'work',
  session_id: 's0',
  date: '2026-01-01T10:00:00Z',
  set_id: Math.random().toString(36)
})

let n = 0
const set = (weight: number, reps: number, kind: SetKind = 'work', done = true): SessionSet => ({
  id: `set${++n}`,
  kind,
  weight,
  reps,
  done,
  done_at: done ? `2026-01-01T10:${String(n % 60).padStart(2, '0')}:00Z` : null
})
const session = (id: string, day: string, sets: SessionSet[], finished = true): Session => ({
  id,
  user_id: 'u',
  workout_id: null,
  name: 'W',
  started_at: `${day}T10:00:00Z`,
  finished_at: finished ? `${day}T11:00:00Z` : null,
  notes: '',
  data: { exercises: [{ exercise_id: 'bench', name: 'Bench', rest_sec: 120, superset: '', note: '', rep_min: 6, rep_max: 8, sets }] }
})

describe('e1rm', () => {
  it('uses Epley with reps capped at 12', () => {
    expect(e1rm(100, 1)).toBeCloseTo(103.33, 2)
    expect(e1rm(100, 12)).toBe(e1rm(100, 20))
    expect(e1rm(0, 5)).toBe(0)
  })
})

describe('evaluateSet', () => {
  it('marks the first ever set as first, not a record', () => {
    expect(evaluateSet([], 60, 8)).toMatchObject({ first: true, types: [] })
  })

  it('detects a weight + e1RM record', () => {
    expect(evaluateSet([rec(100, 5)], 105, 5).types).toEqual(['weight', 'e1rm'])
  })

  it('detects a rep record at the same weight', () => {
    const r = evaluateSet([rec(100, 5)], 100, 6)
    expect(r.types).toContain('reps')
    expect(r.types).toContain('e1rm')
    expect(r.types).not.toContain('weight')
  })

  it('reports a near PR between 95% and 99% of the best e1RM', () => {
    const r = evaluateSet([rec(100, 5)], 100, 4)
    expect(r.types).toEqual([])
    expect(r.nearPct).toBe(97)
  })

  it('is neither PR nor near PR for an easy set', () => {
    expect(evaluateSet([rec(100, 5)], 60, 5)).toMatchObject({ types: [], nearPct: null })
  })
})

describe('repsForPR', () => {
  it('is null without history', () => {
    expect(repsForPR([], 100)).toBeNull()
  })
  it('needs one rep at a new heaviest weight', () => {
    expect(repsForPR([rec(100, 5)], 102.5)).toBe(1)
  })
  it('needs one more rep than the best at that weight', () => {
    expect(repsForPR([rec(100, 5)], 100)).toBe(6)
  })
  it('counts heavier sets for the rep record at a lighter weight', () => {
    // 100x5 also means "5 reps at 90 or more", so 6 reps at 90 is already a rep PR
    expect(repsForPR([rec(100, 5)], 90)).toBe(6)
  })
  it('caps the e1RM search at 12 reps', () => {
    // 50 kg cannot beat a 116.67 e1RM within 12 reps, and nothing was done at 50+ with many reps
    expect(repsForPR([rec(100, 5)], 50)).toBe(6)
    expect(repsForPR([rec(100, 5)], 0)).toBe(6)
  })
})

describe('sessionPRs / priorSets / lastPerformance', () => {
  const s1 = session('s1', '2026-01-01', [set(100, 5), set(20, 10, 'warmup')])
  const s2 = session('s2', '2026-01-08', [set(102.5, 5), set(102.5, 6), set(80, 12, 'drop')])
  const open = session('s3', '2026-01-15', [set(200, 1)], false)
  const db = { ...emptyDB(), sessions: [s1, s2, open] }

  it('priorSets skips unfinished sessions, warm-ups and drops', () => {
    const p = priorSets(db, 'bench')
    expect(p.map((x) => x.weight).sort()).toEqual([100, 102.5, 102.5])
  })

  it('lastPerformance picks the latest finished session', () => {
    expect(lastPerformance(db, 'bench')?.sets.map((s) => s.weight)).toEqual([102.5, 102.5, 80])
    expect(lastPerformance(db, 'bench', 's2')?.sets[0].weight).toBe(100)
  })

  it('sessionPRs only compares with earlier sessions and runs within the session', () => {
    const prs = sessionPRs(db, s2)
    expect(prs).toHaveLength(2)
    expect(prs[0]).toMatchObject({ weight: 102.5, reps: 5 })
    expect(prs[0].types).toContain('weight')
    expect(prs[1]).toMatchObject({ weight: 102.5, reps: 6 })
    expect(prs[1].types).toContain('reps')
  })

  it('the first session has no PRs (nothing to beat)', () => {
    expect(sessionPRs(db, s1)).toEqual([])
  })
})
