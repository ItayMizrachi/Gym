import { Exercise, Tracking, Workout, WorkoutExercise } from './types'
import { uid, nowIso } from './uid'

/** One exercise inside a ready-made program. For 'time' exercises rep_min / rep_max are seconds. */
export interface ProgramExercise {
  name: string
  muscle: string
  equipment: string
  tracking: Tracking
  sets: number
  rep_min: number
  rep_max: number
  rest_sec: number
  superset: string
  note: string
}

export interface ProgramWorkout {
  name: string
  notes: string
  exercises: ProgramExercise[]
}

export type Level = 'Beginner' | 'Intermediate' | 'Advanced'

export interface Program {
  id: string
  name: string
  description: string
  level: Level
  /** what you need, in plain words */
  equipment: string
  goal: string
  days: number
  workouts: ProgramWorkout[]
}

/** x('Squat (Barbell)', 'Quads', 'Barbell', 3, '6-8', 180, { ss: 'A' }) */
function x(
  name: string,
  muscle: string,
  equipment: string,
  sets: number,
  reps: string,
  rest: number,
  o: { ss?: string; note?: string; tracking?: Tracking } = {}
): ProgramExercise {
  const [a, b] = reps.split('-').map(Number)
  return {
    name,
    muscle,
    equipment,
    tracking: o.tracking ?? 'weight_reps',
    sets,
    rep_min: a,
    rep_max: b ?? a,
    rest_sec: rest,
    superset: o.ss ?? '',
    note: o.note ?? ''
  }
}
const timed = (name: string, muscle: string, equipment: string, sets: number, secs: string, rest: number, note: string) =>
  x(name, muscle, equipment, sets, secs, rest, { tracking: 'time', note })
const bw = (name: string, muscle: string, sets: number, reps: string, rest: number, note = '') =>
  x(name, muscle, 'Bodyweight', sets, reps, rest, { tracking: 'reps', note })

/* shared exercises, so the same name always means the same lift */
const SQUAT = (s: number, r: string, rest = 180) => x('Squat (Barbell)', 'Quads', 'Barbell', s, r, rest)
const BENCH = (s: number, r: string, rest = 150) => x('Bench Press (Barbell)', 'Chest', 'Barbell', s, r, rest)
const ROW = (s: number, r: string, rest = 150) => x('Bent Over Row (Barbell)', 'Back', 'Barbell', s, r, rest)
const OHP = (s: number, r: string, rest = 150) => x('Overhead Press (Barbell)', 'Shoulders', 'Barbell', s, r, rest)
const DEADLIFT = (s: number, r: string, rest = 180) => x('Deadlift (Barbell)', 'Back', 'Barbell', s, r, rest)
const RDL = (s: number, r: string, rest = 150) => x('Romanian Deadlift (Barbell)', 'Hamstrings', 'Barbell', s, r, rest)
const LAT_PD = (s: number, r: string, rest = 105) => x('Lat Pulldown (Cable)', 'Back', 'Cable', s, r, rest)
const LEG_PRESS = (s: number, r: string, rest = 150) => x('Leg Press (Machine)', 'Quads', 'Machine', s, r, rest)
const LEG_CURL = (s: number, r: string, rest = 90) => x('Lying Leg Curl (Machine)', 'Hamstrings', 'Machine', s, r, rest)
const LEG_EXT = (s: number, r: string, rest = 90) => x('Leg Extension (Machine)', 'Quads', 'Machine', s, r, rest)
const CALF = (s: number, r: string, rest = 75) => x('Standing Calf Raise (Machine)', 'Calves', 'Machine', s, r, rest)
const LATERAL = (s: number, r: string, rest = 60, ss = '') => x('Lateral Raise (Dumbbell)', 'Shoulders', 'Dumbbell', s, r, rest, { ss })
const INCLINE_DB = (s: number, r: string, rest = 120) => x('Incline Bench Press (Dumbbell)', 'Chest', 'Dumbbell', s, r, rest)
const CABLE_ROW = (s: number, r: string, rest = 105) => x('Seated Cable Row', 'Back', 'Cable', s, r, rest)
const PUSHDOWN = (s: number, r: string, rest = 60, ss = '') => x('Triceps Pushdown', 'Triceps', 'Cable', s, r, rest, { ss })
const CURL = (s: number, r: string, rest = 60, ss = '') => x('Bicep Curl (Dumbbell)', 'Biceps', 'Dumbbell', s, r, rest, { ss })
const FACE_PULL = (s: number, r: string, rest = 60, ss = '') => x('Face Pull (Cable)', 'Shoulders', 'Cable', s, r, rest, { ss })
const PLANK = (s: number) => timed('Plank', 'Abs', 'Bodyweight', s, '30-60', 60, 'Hold a straight line from head to heels.')

export const PROGRAMS: Program[] = [
  {
    id: 'beginner-full-body',
    name: 'Beginner Full Body',
    description:
      'Two full-body workouts, A and B. Do them on 3 days a week with a rest day in between, swapping A and B each time. Every workout trains the whole body with simple machine and free-weight lifts. A good first program.',
    level: 'Beginner',
    equipment: 'Full gym',
    goal: 'Learn the basics',
    days: 3,
    workouts: [
      {
        name: 'Full Body A',
        notes: 'Start light. Add weight once you reach the top of the rep range on every set.',
        exercises: [LEG_PRESS(3, '8-12'), x('Chest Press (Machine)', 'Chest', 'Machine', 3, '8-12', 120), LAT_PD(3, '8-12'), LEG_CURL(2, '10-12'), PLANK(2)]
      },
      {
        name: 'Full Body B',
        notes: 'Start light. Add weight once you reach the top of the rep range on every set.',
        exercises: [
          x('Goblet Squat (Dumbbell)', 'Quads', 'Dumbbell', 3, '8-12', 120),
          x('Shoulder Press (Machine)', 'Shoulders', 'Machine', 3, '8-12', 120),
          CABLE_ROW(3, '8-12'),
          x('Hip Thrust (Barbell)', 'Glutes', 'Barbell', 2, '10-12', 120),
          CURL(2, '10-12')
        ]
      }
    ]
  },
  {
    id: 'upper-lower-4',
    name: 'Upper / Lower',
    description:
      'Four days a week: upper body, lower body, rest, then upper and lower again. Day A is heavier with fewer reps, day B is lighter with more reps. Good once you have trained for a few months.',
    level: 'Intermediate',
    equipment: 'Full gym',
    goal: 'Muscle and strength',
    days: 4,
    workouts: [
      {
        name: 'Upper A',
        notes: 'Heavier day.',
        exercises: [BENCH(3, '5-8'), ROW(3, '6-8'), OHP(2, '6-8'), LAT_PD(3, '8-10'), PUSHDOWN(2, '10-12', 15, 'A'), CURL(2, '10-12', 75, 'A')]
      },
      {
        name: 'Lower A',
        notes: 'Heavier day.',
        exercises: [SQUAT(3, '5-8'), RDL(3, '6-8'), LEG_CURL(3, '8-12'), CALF(3, '8-12'), PLANK(2)]
      },
      {
        name: 'Upper B',
        notes: 'Lighter day, more reps.',
        exercises: [INCLINE_DB(3, '8-12'), CABLE_ROW(3, '10-12'), LATERAL(3, '12-15'), x('Pull Up', 'Back', 'Bodyweight', 3, '6-10', 120), FACE_PULL(2, '12-15')]
      },
      {
        name: 'Lower B',
        notes: 'Lighter day, more reps.',
        exercises: [LEG_PRESS(3, '10-12'), x('Hip Thrust (Barbell)', 'Glutes', 'Barbell', 3, '8-12', 120), LEG_EXT(3, '12-15'), LEG_CURL(2, '12-15'), CALF(3, '12-15'), x('Cable Crunch', 'Abs', 'Cable', 3, '10-15', 60)]
      }
    ]
  },
  {
    id: 'ppl-3',
    name: 'Push / Pull / Legs (3 days)',
    description:
      'Three workouts: push (chest, shoulders, triceps), pull (back, biceps) and legs. Each muscle gets one hard day a week. Simple to follow and easy to fit into a busy week.',
    level: 'Beginner',
    equipment: 'Full gym',
    goal: 'Build muscle',
    days: 3,
    workouts: [
      {
        name: 'Push',
        notes: 'Chest, shoulders and triceps.',
        exercises: [BENCH(3, '6-10'), INCLINE_DB(3, '8-12'), OHP(3, '8-10'), LATERAL(3, '12-15'), PUSHDOWN(3, '10-12')]
      },
      {
        name: 'Pull',
        notes: 'Back and biceps.',
        exercises: [LAT_PD(3, '8-12'), ROW(3, '8-10'), CABLE_ROW(3, '10-12'), FACE_PULL(2, '12-15'), CURL(3, '10-12')]
      },
      {
        name: 'Legs',
        notes: 'Quads, hamstrings, glutes and calves.',
        exercises: [SQUAT(3, '6-10'), RDL(3, '8-10'), LEG_PRESS(3, '10-12'), LEG_CURL(3, '10-12'), CALF(3, '10-15')]
      }
    ]
  },
  {
    id: 'ppl-6',
    name: 'Push / Pull / Legs (6 days)',
    description:
      'Push, pull and legs twice a week, six days in a row with one rest day. Each muscle is trained twice a week. Lots of volume, so only pick this if you recover well and can train most days.',
    level: 'Advanced',
    equipment: 'Full gym',
    goal: 'Build muscle',
    days: 6,
    workouts: [
      {
        name: 'Push A',
        notes: 'Heavy pressing.',
        exercises: [BENCH(4, '5-8'), OHP(3, '6-8'), INCLINE_DB(3, '8-12'), LATERAL(3, '12-15', 15, 'A'), PUSHDOWN(3, '10-12', 75, 'A')]
      },
      {
        name: 'Pull A',
        notes: 'Heavy pulling.',
        exercises: [DEADLIFT(3, '4-6'), x('Pull Up', 'Back', 'Bodyweight', 3, '6-10', 120), ROW(3, '6-8'), FACE_PULL(3, '12-15', 15, 'A'), CURL(3, '8-12', 75, 'A')]
      },
      {
        name: 'Legs A',
        notes: 'Squat focus.',
        exercises: [SQUAT(4, '5-8'), RDL(3, '8-10'), LEG_EXT(3, '10-15'), LEG_CURL(3, '10-12'), CALF(4, '8-12')]
      },
      {
        name: 'Push B',
        notes: 'More reps.',
        exercises: [INCLINE_DB(4, '8-12'), x('Chest Fly (Machine)', 'Chest', 'Machine', 3, '12-15', 90), x('Shoulder Press (Dumbbell)', 'Shoulders', 'Dumbbell', 3, '8-12', 120), LATERAL(4, '12-20'), x('Overhead Triceps Extension (Cable)', 'Triceps', 'Cable', 3, '10-15', 75)]
      },
      {
        name: 'Pull B',
        notes: 'More reps.',
        exercises: [LAT_PD(4, '8-12'), CABLE_ROW(3, '10-12'), x('Reverse Fly (Machine)', 'Shoulders', 'Machine', 3, '12-15', 60), x('Hammer Curl (Dumbbell)', 'Biceps', 'Dumbbell', 3, '10-12', 75), x('Cable Crunch', 'Abs', 'Cable', 3, '10-15', 60)]
      },
      {
        name: 'Legs B',
        notes: 'Glutes and hamstrings focus.',
        exercises: [x('Hip Thrust (Barbell)', 'Glutes', 'Barbell', 4, '8-12', 120), LEG_PRESS(3, '10-15'), x('Bulgarian Split Squat (Dumbbell)', 'Quads', 'Dumbbell', 3, '8-12', 90, { note: 'Reps per leg.' }), LEG_CURL(3, '12-15'), CALF(4, '12-15')]
      }
    ]
  },
  {
    id: 'strength-5x5',
    name: '5×5 Strength',
    description:
      'Two short barbell workouts, A and B, three times a week. Five sets of five reps on the big lifts. Add a little weight every time you finish all the reps. Simple, proven and great for getting stronger.',
    level: 'Beginner',
    equipment: 'Barbell and rack',
    goal: 'Get stronger',
    days: 3,
    workouts: [
      {
        name: '5×5 A',
        notes: 'Rest 3 minutes between heavy sets. Add 2.5 kg next time if you got all 25 reps.',
        exercises: [SQUAT(5, '5', 180), BENCH(5, '5', 180), ROW(5, '5', 180)]
      },
      {
        name: '5×5 B',
        notes: 'Deadlift is one heavy set of five after warm-ups.',
        exercises: [SQUAT(5, '5', 180), OHP(5, '5', 180), DEADLIFT(1, '5', 180)]
      }
    ]
  },
  {
    id: 'dumbbell-home',
    name: 'Dumbbells at Home',
    description:
      'Three full-body workouts a week with just a pair of dumbbells and your body weight. No gym needed. Keep the rest short and pick a weight that makes the last reps hard.',
    level: 'Beginner',
    equipment: 'Dumbbells only',
    goal: 'Stay fit at home',
    days: 3,
    workouts: [
      {
        name: 'Home A',
        notes: 'Full body. Short rests.',
        exercises: [
          x('Goblet Squat (Dumbbell)', 'Quads', 'Dumbbell', 3, '10-15', 75),
          x('Floor Press (Dumbbell)', 'Chest', 'Dumbbell', 3, '8-12', 75),
          x('One Arm Row (Dumbbell)', 'Back', 'Dumbbell', 3, '8-12', 75, { note: 'Reps per arm.' }),
          LATERAL(2, '12-15'),
          PLANK(3)
        ]
      },
      {
        name: 'Home B',
        notes: 'Full body. Short rests.',
        exercises: [
          x('Romanian Deadlift (Dumbbell)', 'Hamstrings', 'Dumbbell', 3, '10-12', 75),
          bw('Push Up', 'Chest', 3, '8-20', 60, 'Knees down is fine.'),
          x('Shoulder Press (Dumbbell)', 'Shoulders', 'Dumbbell', 3, '8-12', 75),
          CURL(2, '10-12', 45, 'A'),
          x('Overhead Triceps Extension (Dumbbell)', 'Triceps', 'Dumbbell', 2, '10-12', 60, { ss: 'A' }),
          timed('Side Plank', 'Abs', 'Bodyweight', 2, '20-40', 45, 'Each side.')
        ]
      }
    ]
  }
]

export const programById = (id: string | null | undefined) => PROGRAMS.find((p) => p.id === id)

/** Short line for a program card, e.g. "3 days a week · Full gym". */
export const programMeta = (p: Program) => `${p.days} days a week · ${p.equipment}`

/** "8–12 reps", "5 reps", "30–60 s" */
export function fmtTarget(e: Pick<ProgramExercise, 'rep_min' | 'rep_max' | 'tracking'>) {
  const r = e.rep_min === e.rep_max ? `${e.rep_min}` : `${e.rep_min}–${e.rep_max}`
  return e.tracking === 'time' ? `${r} s` : `${r} reps`
}

export interface ProgramRows {
  folder: string
  exercises: Exercise[]
  workouts: Workout[]
  workout_exercises: WorkoutExercise[]
}

/** A folder name not used yet: "Upper / Lower", then "Upper / Lower 2", … */
export function freeFolderName(name: string, existing: Workout[]) {
  const used = new Set(existing.map((w) => (w.folder ?? '').toLowerCase()))
  if (!used.has(name.toLowerCase())) return name
  for (let n = 2; ; n++) if (!used.has(`${name} ${n}`.toLowerCase())) return `${name} ${n}`
}

/**
 * Turn a program into rows to save. Exercises the user already has (same name, any case) are reused;
 * new ones are created once even if several workouts use them. Workouts go into a folder named after the program.
 */
export function buildProgram(p: Program, userId: string, existingExercises: Exercise[], existingWorkouts: Workout[]): ProgramRows {
  const byName = new Map(existingExercises.map((e) => [e.name.trim().toLowerCase(), e.id]))
  const folder = freeFolderName(p.name, existingWorkouts)
  const start = existingWorkouts.reduce((m, w) => Math.max(m, w.position + 1), 0)
  const exercises: Exercise[] = []
  const workouts: Workout[] = []
  const workout_exercises: WorkoutExercise[] = []

  const exerciseId = (pe: ProgramExercise) => {
    const k = pe.name.toLowerCase()
    const found = byName.get(k)
    if (found) return found
    const e: Exercise = {
      id: uid(),
      user_id: userId,
      name: pe.name,
      muscle: pe.muscle,
      notes: '',
      setup: '',
      image_path: null,
      rest_sec: pe.rest_sec,
      created_at: nowIso(),
      equipment: pe.equipment,
      tracking: pe.tracking
    }
    exercises.push(e)
    byName.set(k, e.id)
    return e.id
  }

  p.workouts.forEach((pw, i) => {
    const w: Workout = { id: uid(), user_id: userId, name: pw.name, notes: pw.notes, position: start + i, created_at: nowIso(), folder }
    workouts.push(w)
    pw.exercises.forEach((pe, j) =>
      workout_exercises.push({
        id: uid(),
        user_id: userId,
        workout_id: w.id,
        exercise_id: exerciseId(pe),
        position: j,
        sets: pe.sets,
        rep_min: pe.rep_min,
        rep_max: pe.rep_max,
        weight: 0,
        rest_sec: pe.rest_sec,
        superset: pe.superset,
        drop_last: false,
        note: pe.note
      })
    )
  })
  return { folder, exercises, workouts, workout_exercises }
}
