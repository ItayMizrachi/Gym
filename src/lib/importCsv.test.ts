import { describe, expect, it } from 'vitest'
import { parseCsv, parseDate, parseDuration, parseExport, planImport } from './importCsv'
import type { LibraryExercise } from './library'

const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push","20 Oct 2026, 18:30","20 Oct 2026, 19:41","Felt strong","Bench Press (Barbell)",,"",0,"warmup",40,10,,,
"Push","20 Oct 2026, 18:30","20 Oct 2026, 19:41","Felt strong","Bench Press (Barbell)",,"",1,"normal",80,8,,,8.5
"Push","20 Oct 2026, 18:30","20 Oct 2026, 19:41","Felt strong","Bench Press (Barbell)",,"",2,"failure",80,6,,,
"Push","20 Oct 2026, 18:30","20 Oct 2026, 19:41","Felt strong","Plank",,"",0,"normal",,,,60,
"Pull","22 Oct 2026, 07:05","22 Oct 2026, 08:00","","Lat Pulldown (Cable)",,"slow negatives",0,"normal",55,"12",,,
`

const STRONG = `Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE
2026-10-19 17:00:00;Legs;1h 5m;Squat (Barbell);W;60;5;0;0;;;
2026-10-19 17:00:00;Legs;1h 5m;Squat (Barbell);1;100;5;0;0;;;
2026-10-19 17:00:00;Legs;1h 5m;Squat (Barbell);2;100;5;0;0;;;
2026-10-19 17:00:00;Legs;1h 5m;Rest Timer;1;0;0;0;0;;;
`

describe('parseCsv', () => {
  it('handles quotes, doubled quotes and empty cells', () => {
    expect(parseCsv('a,"b, c","d ""e"""\n1,,3')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '', '3']
    ])
  })
  it('detects semicolons', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
  })
})

describe('dates and durations', () => {
  it('reads Hevy and Strong dates in local time', () => {
    const h = parseDate('20 Oct 2026, 18:30')!
    expect([h.getFullYear(), h.getMonth(), h.getDate(), h.getHours(), h.getMinutes()]).toEqual([2026, 9, 20, 18, 30])
    const s = parseDate('2026-10-19 17:00:00')!
    expect([s.getMonth(), s.getDate(), s.getHours()]).toEqual([9, 19, 17])
  })
  it('reads Strong durations', () => {
    expect(parseDuration('1h 5m')).toBe(3900)
    expect(parseDuration('45m')).toBe(2700)
    expect(parseDuration('')).toBeNull()
  })
})

describe('parseExport', () => {
  it('groups a Hevy file into workouts, exercises and sets', () => {
    const r = parseExport(HEVY)
    expect(r.source).toBe('hevy')
    expect(r.workouts.map((w) => w.name)).toEqual(['Push', 'Pull'])
    const push = r.workouts[0]
    expect(push.notes).toBe('Felt strong')
    expect(push.exercises.map((e) => e.name)).toEqual(['Bench Press (Barbell)', 'Plank'])
    expect(push.exercises[0].sets.map((s) => s.kind)).toEqual(['warmup', 'work', 'failure'])
    expect(push.exercises[0].sets[1]).toMatchObject({ weight: 80, reps: 8, rpe: 8.5 })
    expect(push.exercises[1].sets[0]).toMatchObject({ reps: null, time_sec: 60 })
    expect(r.workouts[1].exercises[0].notes).toBe('slow negatives')
  })
  it('reads Strong, skips rest timers and converts pounds when asked', () => {
    const kg = parseExport(STRONG)
    expect(kg.source).toBe('strong')
    expect(kg.workouts).toHaveLength(1)
    expect(kg.workouts[0].exercises.map((e) => e.name)).toEqual(['Squat (Barbell)'])
    expect(kg.workouts[0].exercises[0].sets.map((s) => s.kind)).toEqual(['warmup', 'work', 'work'])
    expect(kg.workouts[0].end!.getTime() - kg.workouts[0].start.getTime()).toBe(3900_000)
    const lb = parseExport(STRONG, true)
    expect(lb.workouts[0].exercises[0].sets[1].weight).toBe(45.25) // 100 lb ≈ 45.36 kg, rounded to 0.25
  })
  it('refuses other files', () => {
    expect(() => parseExport('name,age\nbob,3')).toThrow(/Hevy or Strong/)
  })
})

describe('planImport', () => {
  const lib: LibraryExercise[] = [
    { id: 'Barbell_Bench_Press', name: 'Barbell Bench Press', muscle: 'Chest', muscles: ['Chest'], secondary: [], equipment: 'Barbell', tracking: 'weight_reps', level: 'Beginner', frames: 2 }
  ]
  it('creates exercises once, reuses existing ones, and skips workouts already imported', () => {
    const parsed = parseExport(HEVY).workouts
    const existing = {
      exercises: [{ id: 'x1', user_id: 'u', name: 'Plank', muscle: 'Abs', notes: '', setup: '', image_path: null, rest_sec: 60, created_at: '' }],
      sessions: []
    }
    const first = planImport(parsed, 'u', existing, lib)
    expect(first.sessions).toHaveLength(2)
    expect(first.exercises.map((e) => e.name).sort()).toEqual(['Bench Press (Barbell)', 'Lat Pulldown (Cable)'])
    const bench = first.exercises.find((e) => e.name === 'Bench Press (Barbell)')!
    expect(bench.image_path).toBe('lib:Barbell_Bench_Press')
    expect(bench.muscle).toBe('Chest')
    expect(first.exercises.find((e) => e.name.startsWith('Lat'))!.equipment).toBe('Cable')
    expect(first.sessions[0].data.exercises[1].exercise_id).toBe('x1') // existing Plank reused
    expect(first.sessions[0].data.exercises[0].sets.every((s) => s.done)).toBe(true)

    const again = planImport(parsed, 'u', { exercises: [...existing.exercises, ...first.exercises], sessions: first.sessions }, lib)
    expect(again.sessions).toHaveLength(0)
    expect(again.skipped).toBe(2)
  })
})
