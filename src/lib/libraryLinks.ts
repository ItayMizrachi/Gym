/**
 * Small, always-loaded part of the exercise library: how a library photo is referenced, and which library entry
 * each built-in exercise name (starter plan + ready-made programs) shows. The full library lives in
 * src/data/library.json and is only loaded on demand (see library.ts).
 *
 * An exercise links to the library by storing `lib:<id>` in `image_path` (Exercise has no library field).
 */

import { LIBRARY_EXTRA } from '../data/libraryExtra'

export const LIB_PREFIX = 'lib:'
const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

export const libPath = (id: string) => LIB_PREFIX + id
export const libIdOf = (path: string | null | undefined): string | null => (path?.startsWith(LIB_PREFIX) ? path.slice(LIB_PREFIX.length) : null)

/** GymLog's added entries (GL_…) → the original entry whose photos and steps they borrow */
export const PHOTO_OF: Record<string, string> = Object.fromEntries(LIBRARY_EXTRA.map((e) => [e.i, e.p]))

/** Photo of a library exercise. Frame 0 is the start position, frame 1 the end position. */
export const libImageUrl = (id: string, frame: 0 | 1 = 0) => `${IMG_BASE}${encodeURIComponent(PHOTO_OF[id] ?? id)}/${frame}.jpg`

/**
 * Built-in exercise name (lower case) → closest library entry. Covers every name in seed.ts and programCatalog.ts
 * (a test checks that), so exercises created before the library existed still get a photo.
 */
export const NAME_TO_LIB: Record<string, string> = {
  // starter plan (seed.ts)
  'hack squat (machine)': 'Hack_Squat',
  'romanian deadlift (barbell)': 'Romanian_Deadlift',
  'lying leg curl (machine)': 'Lying_Leg_Curls',
  'leg extension (machine)': 'Leg_Extensions',
  'standing calf raise (smith)': 'Smith_Machine_Calf_Raise',
  'knee raise (parallel bars)': 'Knee_Hip_Raise_On_Parallel_Bars',
  'bench press (barbell)': 'Barbell_Bench_Press_-_Medium_Grip',
  'pull up (weighted)': 'Weighted_Pull_Ups',
  'shoulder press (machine plates)': 'Leverage_Shoulder_Press',
  'iso-lateral row (machine)': 'Leverage_Iso_Row',
  'single arm lateral raise (cable)': 'Cable_Seated_Lateral_Raise',
  'reverse fly single arm (cable)': 'Cable_Rear_Delt_Fly',
  'overhead triceps extension (cable)': 'Cable_Rope_Overhead_Triceps_Extension',
  'bicep curl (cable)': 'Standing_Biceps_Cable_Curl',
  'hip thrust (barbell)': 'Barbell_Hip_Thrust',
  'cable crunch': 'Cable_Crunch',
  'incline chest press (machine)': 'Leverage_Incline_Chest_Press',
  'chest supported t bar row': 'Lying_T-Bar_Row',
  'chest dip (weighted)': 'Dips_-_Chest_Version',
  'chest fly (machine)': 'Butterfly',
  'triceps pushdown': 'Triceps_Pushdown',
  'hammer curl (dumbbell)': 'Hammer_Curls',
  'warm up': 'Jogging_Treadmill',
  plank: 'Plank',

  // ready-made programs (programCatalog.ts)
  'bench press (dumbbell)': 'Dumbbell_Bench_Press',
  'incline bench press (dumbbell)': 'Incline_Dumbbell_Press',
  'chest press (machine)': 'Leverage_Chest_Press',
  'chest fly (cable)': 'Cable_Crossover',
  'chest dip': 'Dips_-_Chest_Version',
  'floor press (dumbbell)': 'Dumbbell_Floor_Press',
  'push up': 'Pushups',
  'overhead press (barbell)': 'Standing_Military_Press',
  'shoulder press (dumbbell)': 'Dumbbell_Shoulder_Press',
  'shoulder press (machine)': 'Machine_Shoulder_Military_Press',
  'arnold press (dumbbell)': 'Arnold_Dumbbell_Press',
  'lateral raise (dumbbell)': 'Side_Lateral_Raise',
  'lateral raise (cable)': 'Cable_Seated_Lateral_Raise',
  'reverse fly (machine)': 'Reverse_Machine_Flyes',
  'face pull (cable)': 'Face_Pull',
  'pike push up': 'Handstand_Push-Ups',
  'wall slide': 'Band_Pull_Apart',
  'arm circles': 'Arm_Circles',
  'lat pulldown (cable)': 'Wide-Grip_Lat_Pulldown',
  'pull up': 'Pullups',
  'chin up': 'Chin-Up',
  'bent over row (barbell)': 'Bent_Over_Barbell_Row',
  'one arm row (dumbbell)': 'One-Arm_Dumbbell_Row',
  'seated row (cable)': 'Seated_Cable_Rows',
  'seated row (machine)': 'Leverage_Iso_Row',
  'deadlift (barbell)': 'Barbell_Deadlift',
  'back extension': 'Hyperextensions_Back_Extensions',
  'cat cow': 'Cat_Stretch',
  'squat (barbell)': 'Barbell_Squat',
  'goblet squat (dumbbell)': 'Goblet_Squat',
  'leg press (machine)': 'Leg_Press',
  'bulgarian split squat (dumbbell)': 'Split_Squat_with_Dumbbells',
  'walking lunge (dumbbell)': 'Dumbbell_Lunges',
  'squat (bodyweight)': 'Bodyweight_Squat',
  'lunge (bodyweight)': 'Bodyweight_Walking_Lunge',
  'deep squat hold': 'Bodyweight_Squat',
  'romanian deadlift (dumbbell)': 'Stiff-Legged_Dumbbell_Deadlift',
  'seated leg curl (machine)': 'Seated_Leg_Curl',
  'good morning (barbell)': 'Good_Morning',
  'glute bridge': 'Butt_Lift_Bridge',
  'glute kickback (cable)': 'One-Legged_Cable_Kickback',
  'hip abduction (machine)': 'Thigh_Abductor',
  'kettlebell swing': 'One-Arm_Kettlebell_Swings',
  'hip flexor stretch': 'Kneeling_Hip_Flexor',
  'standing calf raise (machine)': 'Standing_Calf_Raises',
  'seated calf raise (machine)': 'Seated_Calf_Raise',
  'calf raise (dumbbell)': 'Standing_Dumbbell_Calf_Raise',
  'bicep curl (dumbbell)': 'Dumbbell_Bicep_Curl',
  'bicep curl (barbell)': 'Barbell_Curl',
  'preacher curl (machine)': 'Machine_Preacher_Curls',
  'overhead triceps extension (dumbbell)': 'Standing_Dumbbell_Triceps_Extension',
  'skull crusher (barbell)': 'EZ-Bar_Skullcrusher',
  'bench dip': 'Bench_Dips',
  'farmer carry (dumbbell)': 'Farmers_Walk',
  'side plank': 'Side_Bridge',
  'hanging leg raise': 'Hanging_Leg_Raise',
  'dead bug': 'Dead_Bug',
  crunch: 'Crunches',
  'mountain climber': 'Mountain_Climbers',
  burpee: 'Freehand_Jump_Squat',
  'jumping jack': 'Star_Jump',
  'rowing (machine)': 'Rowing_Stationary',
  "world's greatest stretch": 'Worlds_Greatest_Stretch',
  'seated cable row (close grip)': 'Seated_Cable_Rows',
  'cable pullover (straight arm)': 'Straight-Arm_Pulldown',
  'standing leg curl (machine)': 'Standing_Leg_Curl',
  'wrist curl (cable)': 'Cable_Wrist_Curl',
  'reverse wrist curl (cable)': 'Palms-Down_Wrist_Curl_Over_A_Bench'
}

/** Library id an exercise shows: its own `lib:` link, else the built-in name match. */
export function libIdForExercise(e: { name: string; image_path: string | null } | null | undefined): string | null {
  if (!e) return null
  return libIdOf(e.image_path) ?? (e.image_path ? null : NAME_TO_LIB[e.name.trim().toLowerCase()] ?? null)
}
