/*
 * GymLog's own additions to the free-exercise-db library: common gym names (Hevy style, "Name (Equipment)")
 * that the original list lacks or names differently. Each borrows the photos and instructions of the closest
 * original entry (`p`). Ids start with GL_ so they never clash with the original ids. Names already in
 * NAME_TO_LIB (built-in plans) are left out: those link to an original entry.
 * Fields as in library.json: n name, m muscles, s helpers, e equipment, t tracking, l level.
 */

import type { Tracking } from '../lib/types'

export interface ExtraEntry {
  i: string
  n: string
  m: string[]
  s: string[]
  e: string
  t: Tracking
  l: 'Beginner' | 'Intermediate' | 'Advanced'
  f: number
  /** original library id whose photos and steps this entry shows */
  p: string
}

const x = (n: string, m: string, s: string[], e: string, p: string, t: Tracking = 'weight_reps', l: ExtraEntry['l'] = 'Beginner'): ExtraEntry => ({
  i: 'GL_' + n.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  n,
  m: [m],
  s,
  e,
  t,
  l,
  f: 2,
  p
})

export const LIBRARY_EXTRA: ExtraEntry[] = [
  // chest
  x('Bench Press (Machine)', 'Chest', ['Triceps', 'Shoulders'], 'Machine', 'Leverage_Chest_Press'),
  x('Decline Chest Press (Machine)', 'Chest', ['Triceps'], 'Machine', 'Leverage_Decline_Chest_Press'),
  x('Bench Press (Smith Machine)', 'Chest', ['Triceps', 'Shoulders'], 'Smith', 'Smith_Machine_Bench_Press'),
  x('Incline Bench Press (Smith Machine)', 'Chest', ['Shoulders', 'Triceps'], 'Smith', 'Smith_Machine_Incline_Bench_Press'),
  x('Pec Deck (Machine)', 'Chest', [], 'Machine', 'Butterfly'),
  x('Cable Fly Crossover', 'Chest', ['Shoulders'], 'Cable', 'Cable_Crossover'),
  // back
  x('Hex Bar Deadlift', 'Back', ['Quads', 'Glutes', 'Hamstrings'], 'Barbell', 'Trap_Bar_Deadlift', 'weight_reps', 'Intermediate'),
  x('Close Grip Lat Pulldown (Cable)', 'Back', ['Biceps'], 'Cable', 'Close-Grip_Front_Lat_Pulldown'),
  x('Single Arm Lat Pulldown (Cable)', 'Back', ['Biceps'], 'Cable', 'One_Arm_Lat_Pulldown'),
  x('Seated Cable Row', 'Back', ['Biceps'], 'Cable', 'Seated_Cable_Rows'),
  x('Straight Arm Pulldown (Cable)', 'Back', [], 'Cable', 'Rope_Straight-Arm_Pulldown'),
  x('Back Extension (45°)', 'Back', ['Glutes', 'Hamstrings'], 'Other', 'Hyperextensions_Back_Extensions'),
  // shoulders
  x('Shoulder Press (Smith Machine)', 'Shoulders', ['Triceps'], 'Smith', 'Smith_Machine_Overhead_Shoulder_Press'),
  x('Rear Delt Fly (Machine)', 'Shoulders', ['Back'], 'Machine', 'Reverse_Machine_Flyes'),
  // legs
  x('Single Leg Press (Machine)', 'Quads', ['Glutes'], 'Machine', 'Leg_Press'),
  x('Squat (Smith Machine)', 'Quads', ['Glutes', 'Hamstrings'], 'Smith', 'Smith_Machine_Squat'),
  x('Pendulum Squat (Machine)', 'Quads', ['Glutes'], 'Machine', 'Hack_Squat', 'weight_reps', 'Intermediate'),
  x('Single Leg Extension (Machine)', 'Quads', [], 'Machine', 'Leg_Extensions'),
  x('Single Leg Curl (Machine)', 'Hamstrings', [], 'Machine', 'Lying_Leg_Curls'),
  x('Single Leg Romanian Deadlift (Dumbbell)', 'Hamstrings', ['Glutes'], 'Dumbbell', 'Kettlebell_One-Legged_Deadlift', 'weight_reps', 'Intermediate'),
  x('Hip Adduction (Machine)', 'Quads', [], 'Machine', 'Thigh_Adductor'),
  // calves
  x('Single Leg Standing Calf Raise', 'Calves', [], 'Bodyweight', 'Standing_Dumbbell_Calf_Raise', 'reps'),
  x('Single Leg Standing Calf Raise (Dumbbell)', 'Calves', [], 'Dumbbell', 'Standing_Dumbbell_Calf_Raise'),
  x('Single Leg Calf Raise (Smith Machine)', 'Calves', [], 'Smith', 'Smith_Machine_Calf_Raise'),
  x('Calf Press (Leg Press)', 'Calves', [], 'Machine', 'Calf_Press_On_The_Leg_Press_Machine'),
  // arms
  x('Preacher Curl (Cable)', 'Biceps', [], 'Cable', 'Cable_Preacher_Curl'),
  x('Hammer Curl (Cable Rope)', 'Biceps', ['Forearms'], 'Cable', 'Cable_Hammer_Curls_-_Rope_Attachment'),
  x('Triceps Rope Pushdown', 'Triceps', [], 'Cable', 'Triceps_Pushdown_-_Rope_Attachment'),
  x('Triceps Kickback (Dumbbell)', 'Triceps', [], 'Dumbbell', 'Tricep_Dumbbell_Kickback')
]
