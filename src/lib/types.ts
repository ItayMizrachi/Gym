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
}

export interface Workout {
  id: string
  user_id: string
  name: string
  notes: string
  position: number
  created_at: string
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
}

export interface Session {
  id: string
  user_id: string
  workout_id: string | null
  name: string
  started_at: string
  finished_at: string | null
  notes: string
  data: { exercises: SessionExercise[] }
}

export interface Metric {
  id: string
  user_id: string
  date: string // YYYY-MM-DD
  weight_kg: number | null
  note: string
  photo_path: string | null
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
