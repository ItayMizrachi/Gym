import { Exercise, Tracking, Workout, WorkoutExercise } from './types'
import { uid, nowIso } from './uid'

type Ex = [name: string, muscle: string, rest: number, equipment: string, tracking?: Tracking]

const EXERCISES: Ex[] = [
  ['Hack Squat (Machine)', 'Quads', 180, 'Machine'],
  ['Romanian Deadlift (Barbell)', 'Hamstrings', 180, 'Barbell'],
  ['Lying Leg Curl (Machine)', 'Hamstrings', 105, 'Machine'],
  ['Leg Extension (Machine)', 'Quads', 90, 'Machine'],
  ['Standing Calf Raise (Smith)', 'Calves', 90, 'Smith'],
  ['Knee Raise (Parallel Bars)', 'Abs', 60, 'Bodyweight', 'reps'],
  ['Bench Press (Barbell)', 'Chest', 90, 'Barbell'],
  ['Pull Up (Weighted)', 'Back', 90, 'Bodyweight'],
  ['Shoulder Press (Machine Plates)', 'Shoulders', 120, 'Machine'],
  ['Iso-Lateral Row (Machine)', 'Back', 120, 'Machine'],
  ['Single Arm Lateral Raise (Cable)', 'Shoulders', 60, 'Cable'],
  ['Reverse Fly Single Arm (Cable)', 'Shoulders', 60, 'Cable'],
  ['Overhead Triceps Extension (Cable)', 'Triceps', 15, 'Cable'],
  ['Bicep Curl (Cable)', 'Biceps', 90, 'Cable'],
  ['Hip Thrust (Barbell)', 'Glutes', 165, 'Barbell'],
  ['Cable Crunch', 'Abs', 75, 'Cable'],
  ['Incline Chest Press (Machine)', 'Chest', 15, 'Machine'],
  ['Chest Supported T Bar Row', 'Back', 120, 'Machine'],
  ['Chest Dip (Weighted)', 'Chest', 135, 'Bodyweight'],
  ['Chest Fly (Machine)', 'Chest', 15, 'Machine'],
  ['Triceps Pushdown', 'Triceps', 15, 'Cable'],
  ['Hammer Curl (Dumbbell)', 'Biceps', 90, 'Dumbbell'],
  // not in a plan: ready to add to any workout
  ['Warm Up', 'Other', 30, 'Other', 'time'],
  ['Plank', 'Abs', 60, 'Bodyweight', 'time']
]

/** [exercise, sets, repMin, repMax, weight, rest, superset, dropLast] */
type Row = [string, number, number, number, number, number, string, boolean]

const PLANS: { name: string; notes: string; rows: Row[] }[] = [
  {
    name: 'Lower A (Sunday)',
    notes: 'Hack squat + hamstrings focus. Drop set only on the last set of isolation moves.',
    rows: [
      ['Hack Squat (Machine)', 3, 6, 8, 60, 180, '', false],
      ['Romanian Deadlift (Barbell)', 3, 6, 8, 90, 180, '', false],
      ['Lying Leg Curl (Machine)', 2, 8, 12, 38, 105, '', true],
      ['Leg Extension (Machine)', 2, 10, 15, 90, 90, '', false],
      ['Standing Calf Raise (Smith)', 3, 8, 12, 135, 90, '', true],
      ['Knee Raise (Parallel Bars)', 2, 10, 15, 0, 60, '', false]
    ]
  },
  {
    name: 'Upper A (Monday)',
    notes: 'Heavier day. Superset letters share a round: alternate the exercises, rest after each.',
    rows: [
      ['Bench Press (Barbell)', 3, 6, 8, 65, 90, 'A', false],
      ['Pull Up (Weighted)', 3, 6, 8, 25, 90, 'A', false],
      ['Shoulder Press (Machine Plates)', 2, 8, 10, 40, 120, '', false],
      ['Iso-Lateral Row (Machine)', 3, 8, 10, 40, 120, '', false],
      ['Single Arm Lateral Raise (Cable)', 3, 12, 15, 9, 15, 'B', true],
      ['Reverse Fly Single Arm (Cable)', 2, 12, 15, 7.5, 90, 'B', false],
      ['Overhead Triceps Extension (Cable)', 3, 10, 12, 30, 15, 'C', true],
      ['Bicep Curl (Cable)', 2, 10, 12, 0, 90, 'C', false]
    ]
  },
  {
    name: 'Lower B (Wednesday)',
    notes: 'Quads + glutes focus.',
    rows: [
      ['Hack Squat (Machine)', 3, 8, 10, 60, 165, '', false],
      ['Hip Thrust (Barbell)', 3, 8, 10, 175, 165, '', false],
      ['Leg Extension (Machine)', 3, 10, 15, 96, 90, '', true],
      ['Lying Leg Curl (Machine)', 3, 10, 12, 38, 105, '', true],
      ['Standing Calf Raise (Smith)', 4, 12, 15, 125, 90, '', true],
      ['Cable Crunch', 3, 10, 12, 75, 75, '', false]
    ]
  },
  {
    name: 'Upper B (Thursday)',
    notes: 'Volume day. Incline press + T-bar row are a superset (push / pull).',
    rows: [
      ['Pull Up (Weighted)', 3, 8, 10, 22.5, 165, '', false],
      ['Incline Chest Press (Machine)', 3, 8, 10, 60, 15, 'A', true],
      ['Chest Supported T Bar Row', 3, 8, 10, 50, 120, 'A', false],
      ['Chest Dip (Weighted)', 2, 6, 10, 27.5, 135, '', false],
      ['Chest Fly (Machine)', 2, 10, 15, 65, 15, 'B', true],
      ['Reverse Fly Single Arm (Cable)', 2, 10, 15, 7.5, 90, 'B', false],
      ['Single Arm Lateral Raise (Cable)', 3, 12, 15, 9, 60, '', true],
      ['Triceps Pushdown', 2, 10, 12, 32, 15, 'C', true],
      ['Hammer Curl (Dumbbell)', 2, 10, 12, 14, 90, 'C', false]
    ]
  }
]

export interface SeedResult {
  exercises: Exercise[]
  workouts: Workout[]
  workout_exercises: WorkoutExercise[]
}

/** Build the starter plan. `existing` lets us reuse exercises the user already has (matched by name). */
export function buildStarterPlan(userId: string, existing: Exercise[], startPosition: number): SeedResult {
  const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e]))
  const exercises: Exercise[] = []
  const idFor = new Map<string, string>()
  for (const [name, muscle, rest, equipment, tracking] of EXERCISES) {
    const found = byName.get(name.toLowerCase())
    if (found) {
      idFor.set(name, found.id)
      continue
    }
    const e: Exercise = {
      id: uid(),
      user_id: userId,
      name,
      muscle,
      notes: '',
      setup: '',
      image_path: null,
      rest_sec: rest,
      created_at: nowIso(),
      equipment,
      tracking: tracking ?? 'weight_reps'
    }
    exercises.push(e)
    idFor.set(name, e.id)
  }
  const workouts: Workout[] = []
  const workout_exercises: WorkoutExercise[] = []
  PLANS.forEach((p, i) => {
    const w: Workout = {
      id: uid(),
      user_id: userId,
      name: p.name,
      notes: p.notes,
      position: startPosition + i,
      created_at: nowIso()
    }
    workouts.push(w)
    p.rows.forEach((r, j) => {
      workout_exercises.push({
        id: uid(),
        user_id: userId,
        workout_id: w.id,
        exercise_id: idFor.get(r[0])!,
        position: j,
        sets: r[1],
        rep_min: r[2],
        rep_max: r[3],
        weight: r[4],
        rest_sec: r[5],
        superset: r[6],
        drop_last: r[7],
        note: ''
      })
    })
  })
  return { exercises, workouts, workout_exercises }
}
