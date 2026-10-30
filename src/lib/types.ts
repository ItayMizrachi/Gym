import type { Progression } from './progression'

export type SetKind = 'warmup' | 'work' | 'drop' | 'failure'

export interface Exercise {
  id: string
  user_id: string
  name: string
  muscle: string
  notes: string // how to perform / cues
  setup: string // seat / machine / pin position
  image_path: string | null
  rest_sec: number
  created_at: string
  /** e.g. 'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight' (see EQUIPMENT); '' or missing on old rows */
  equipment?: string
  /** what a set records; missing on old rows = 'weight_reps' (use trackingOf) */
  tracking?: Tracking
  /** a weight goal (src/lib/goals.ts); missing/null = none */
  goal?: { weight: number; reps: number; by?: string; created: string } | null
}

export type Tracking = 'weight_reps' | 'reps' | 'time'
export const trackingOf = (e: { tracking?: Tracking } | null | undefined): Tracking => e?.tracking ?? 'weight_reps'

export interface Workout {
  id: string
  user_id: string
  name: string
  notes: string
  position: number
  created_at: string
  /** folder name for grouping on the Train tab; '' or missing = no folder */
  folder?: string
  /** planned days of the week, 0 = Sunday … 6 = Saturday; missing = not planned */
  days?: number[]
}

export interface WorkoutExercise {
  id: string
  user_id: string
  workout_id: string
  exercise_id: string
  position: number
  sets: number
  rep_min: number
  rep_max: number
  weight: number
  rest_sec: number
  superset: string // '' = none, otherwise a group label such as "A"
  drop_last: boolean
  note: string
}

export interface SessionSet {
  id: string
  kind: SetKind
  weight: number
  reps: number | null
  done: boolean
  done_at: string | null
  /** optional effort rating, 6–10 in 0.5 steps */
  rpe?: number | null
  /** seconds, for 'time' tracked exercises (plank, cardio, warm-up) */
  time_sec?: number | null
}

export interface SessionExercise {
  exercise_id: string
  name: string // snapshot so history still reads fine if the exercise is later deleted
  rest_sec: number
  superset: string
  note: string
  rep_min: number
  rep_max: number
  sets: SessionSet[]
  /** double-progression hint computed when the workout was started */
  progression?: Progression | null
}

export interface Session {
  id: string
  user_id: string
  workout_id: string | null
  name: string
  started_at: string
  finished_at: string | null
  notes: string
  data: { exercises: SessionExercise[]; /** photo taken for this workout */ photo_path?: string | null }
}

export interface Metric {
  id: string
  user_id: string
  date: string // YYYY-MM-DD
  weight_kg: number | null
  note: string
  photo_path: string | null
  /** body measurements in cm (body_fat_pct in %), keyed by MeasureKey; old rows have none */
  measures?: Record<string, number> | null
  created_at: string
}

export type TableName = 'exercises' | 'workouts' | 'workout_exercises' | 'sessions' | 'metrics'

export interface DB {
  exercises: Exercise[]
  workouts: Workout[]
  workout_exercises: WorkoutExercise[]
  sessions: Session[]
  metrics: Metric[]
}

export const emptyDB = (): DB => ({
  exercises: [],
  workouts: [],
  workout_exercises: [],
  sessions: [],
  metrics: []
})

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Smith', 'Bodyweight', 'Kettlebell', 'Band', 'Other']

export const MUSCLES = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abs',
  'Forearms',
  'Other'
]
