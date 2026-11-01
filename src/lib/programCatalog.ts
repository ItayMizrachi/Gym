import type { Tracking } from './types'

/** One exercise as programs know it. Names follow the common "Name (Equipment)" style so they can be matched to a photo library later. */
export interface CatalogExercise {
  name: string
  muscle: string
  equipment: string
  tracking: Tracking
}

const e = (name: string, muscle: string, equipment: string, tracking: Tracking = 'weight_reps'): CatalogExercise => ({
  name,
  muscle,
  equipment,
  tracking
})
const reps = (name: string, muscle: string, equipment = 'Bodyweight') => e(name, muscle, equipment, 'reps')
const hold = (name: string, muscle: string, equipment = 'Bodyweight') => e(name, muscle, equipment, 'time')

/** Every exercise used by the program library. One entry per name, so the same name always means the same lift. */
export const X = {
  // chest
  bench: e('Bench Press (Barbell)', 'Chest', 'Barbell'),
  dbBench: e('Bench Press (Dumbbell)', 'Chest', 'Dumbbell'),
  inclineDb: e('Incline Bench Press (Dumbbell)', 'Chest', 'Dumbbell'),
  chestPress: e('Chest Press (Machine)', 'Chest', 'Machine'),
  chestFly: e('Chest Fly (Machine)', 'Chest', 'Machine'),
  cableFly: e('Chest Fly (Cable)', 'Chest', 'Cable'),
  dip: e('Chest Dip', 'Chest', 'Bodyweight'),
  wDip: e('Chest Dip (Weighted)', 'Chest', 'Bodyweight'),
  inclineMachine: e('Incline Chest Press (Machine)', 'Chest', 'Machine'),
  floorPress: e('Floor Press (Dumbbell)', 'Chest', 'Dumbbell'),
  pushUp: reps('Push Up', 'Chest'),
  // shoulders
  ohp: e('Overhead Press (Barbell)', 'Shoulders', 'Barbell'),
  dbOhp: e('Shoulder Press (Dumbbell)', 'Shoulders', 'Dumbbell'),
  mOhp: e('Shoulder Press (Machine)', 'Shoulders', 'Machine'),
  arnold: e('Arnold Press (Dumbbell)', 'Shoulders', 'Dumbbell'),
  lateral: e('Lateral Raise (Dumbbell)', 'Shoulders', 'Dumbbell'),
  cableLateral: e('Lateral Raise (Cable)', 'Shoulders', 'Cable'),
  rearDelt: e('Reverse Fly (Machine)', 'Shoulders', 'Machine'),
  facePull: e('Face Pull (Cable)', 'Shoulders', 'Cable'),
  plateOhp: e('Shoulder Press (Machine Plates)', 'Shoulders', 'Machine'),
  oneArmLateral: e('Single Arm Lateral Raise (Cable)', 'Shoulders', 'Cable'),
  oneArmRearFly: e('Reverse Fly Single Arm (Cable)', 'Shoulders', 'Cable'),
  pikePush: reps('Pike Push Up', 'Shoulders'),
  wallSlide: reps('Wall Slide', 'Shoulders'),
  armCircles: hold('Arm Circles', 'Shoulders'),
  // back
  latPd: e('Lat Pulldown (Cable)', 'Back', 'Cable'),
  pullUp: e('Pull Up', 'Back', 'Bodyweight'),
  wPullUp: e('Pull Up (Weighted)', 'Back', 'Bodyweight'),
  isoRow: e('Iso-Lateral Row (Machine)', 'Back', 'Machine'),
  closeRow: e('Seated Cable Row (Close Grip)', 'Back', 'Cable'),
  straightArm: e('Cable Pullover (Straight Arm)', 'Back', 'Cable'),
  chinUp: e('Chin Up', 'Back', 'Bodyweight'),
  row: e('Bent Over Row (Barbell)', 'Back', 'Barbell'),
  dbRow: e('One Arm Row (Dumbbell)', 'Back', 'Dumbbell'),
  cableRow: e('Seated Row (Cable)', 'Back', 'Cable'),
  mRow: e('Seated Row (Machine)', 'Back', 'Machine'),
  deadlift: e('Deadlift (Barbell)', 'Back', 'Barbell'),
  backExt: e('Back Extension', 'Back', 'Bodyweight'),
  catCow: hold('Cat Cow', 'Back'),
  // legs
  squat: e('Squat (Barbell)', 'Quads', 'Barbell'),
  goblet: e('Goblet Squat (Dumbbell)', 'Quads', 'Dumbbell'),
  legPress: e('Leg Press (Machine)', 'Quads', 'Machine'),
  hack: e('Hack Squat (Machine)', 'Quads', 'Machine'),
  legExt: e('Leg Extension (Machine)', 'Quads', 'Machine'),
  split: e('Bulgarian Split Squat (Dumbbell)', 'Quads', 'Dumbbell'),
  lunge: e('Walking Lunge (Dumbbell)', 'Quads', 'Dumbbell'),
  bwSquat: reps('Squat (Bodyweight)', 'Quads'),
  bwLunge: reps('Lunge (Bodyweight)', 'Quads'),
  squatHold: hold('Deep Squat Hold', 'Quads'),
  rdl: e('Romanian Deadlift (Barbell)', 'Hamstrings', 'Barbell'),
  dbRdl: e('Romanian Deadlift (Dumbbell)', 'Hamstrings', 'Dumbbell'),
  legCurl: e('Lying Leg Curl (Machine)', 'Hamstrings', 'Machine'),
  seatedCurl: e('Seated Leg Curl (Machine)', 'Hamstrings', 'Machine'),
  standingCurl: e('Standing Leg Curl (Machine)', 'Hamstrings', 'Machine'),
  goodMorning: e('Good Morning (Barbell)', 'Hamstrings', 'Barbell'),
  hipThrust: e('Hip Thrust (Barbell)', 'Glutes', 'Barbell'),
  gluteBridge: reps('Glute Bridge', 'Glutes'),
  kickback: e('Glute Kickback (Cable)', 'Glutes', 'Cable'),
  abduction: e('Hip Abduction (Machine)', 'Glutes', 'Machine'),
  kbSwing: e('Kettlebell Swing', 'Glutes', 'Kettlebell'),
  hipFlexor: hold('Hip Flexor Stretch', 'Glutes'),
  calf: e('Standing Calf Raise (Machine)', 'Calves', 'Machine'),
  seatedCalf: e('Seated Calf Raise (Machine)', 'Calves', 'Machine'),
  dbCalf: e('Calf Raise (Dumbbell)', 'Calves', 'Dumbbell'),
  // arms
  curl: e('Bicep Curl (Dumbbell)', 'Biceps', 'Dumbbell'),
  bbCurl: e('Bicep Curl (Barbell)', 'Biceps', 'Barbell'),
  cableCurl: e('Bicep Curl (Cable)', 'Biceps', 'Cable'),
  hammer: e('Hammer Curl (Dumbbell)', 'Biceps', 'Dumbbell'),
  preacher: e('Preacher Curl (Machine)', 'Biceps', 'Machine'),
  pushdown: e('Triceps Pushdown', 'Triceps', 'Cable'),
  ohExt: e('Overhead Triceps Extension (Cable)', 'Triceps', 'Cable'),
  dbOhExt: e('Overhead Triceps Extension (Dumbbell)', 'Triceps', 'Dumbbell'),
  skull: e('Skull Crusher (Barbell)', 'Triceps', 'Barbell'),
  benchDip: reps('Bench Dip', 'Triceps'),
  farmer: e('Farmer Carry (Dumbbell)', 'Forearms', 'Dumbbell', 'time'),
  wristCurl: e('Wrist Curl (Cable)', 'Forearms', 'Cable'),
  revWristCurl: e('Reverse Wrist Curl (Cable)', 'Forearms', 'Cable'),
  // core
  plank: hold('Plank', 'Abs'),
  sidePlank: hold('Side Plank', 'Abs'),
  cableCrunch: e('Cable Crunch', 'Abs', 'Cable'),
  legRaise: reps('Hanging Leg Raise', 'Abs'),
  kneeRaise: reps('Knee Raise (Parallel Bars)', 'Abs'),
  deadBug: reps('Dead Bug', 'Abs'),
  crunch: reps('Crunch', 'Abs'),
  mountain: hold('Mountain Climber', 'Abs'),
  // full body / conditioning / mobility
  burpee: reps('Burpee', 'Other'),
  jumpingJack: hold('Jumping Jack', 'Other'),
  rower: e('Rowing (Machine)', 'Other', 'Machine', 'time'),
  worldsGreatest: hold("World's Greatest Stretch", 'Other')
} satisfies Record<string, CatalogExercise>
