import type { Program, ProgramExercise, ProgramWorkout } from './programs'
import { CatalogExercise, X } from './programCatalog'

/** s(X.bench, 3, '6-8', 150, { ss: 'A' }). For timed exercises the range is seconds. `drop` adds a drop set after the last set. */
function s(ex: CatalogExercise, sets: number, range: string, rest: number, o: { ss?: string; note?: string; drop?: boolean } = {}): ProgramExercise {
  const [a, b] = range.split('-').map(Number)
  return { ...ex, sets, rep_min: a, rep_max: b ?? a, rest_sec: rest, superset: o.ss ?? '', note: o.note ?? '', ...(o.drop ? { drop: true } : {}) }
}
const wo = (name: string, notes: string, exercises: ProgramExercise[]): ProgramWorkout => ({ name, notes, exercises })
const PLANK = (sets = 2) => s(X.plank, sets, '30-60', 60, { note: 'Keep a straight line from head to heels.' })
// shared parts of the Ultimate 4-Day Plan
const ULT_LATERAL = (ss: string) =>
  s(X.oneArmLateral, 3, '10-15', 30, { ss, drop: true, note: 'Superset with the reverse fly; do the 3rd set alone after it. Drop set on the last set.' })
const ULT_REAR_FLY = (ss: string) => s(X.oneArmRearFly, 2, '12-15', 90, { ss, drop: true })
const ULT_LEG_PRESS = (range: string, rest: number) =>
  s(X.legPress, 2, range, rest, { note: 'Natural stance (about shoulder width), as deep as you can without the pelvis lifting; knees over toes, no knee pain.' })
const ULT_CALF = () => s(X.calf, 3, '10-15', 90, { drop: true, note: 'Pause 1-2 s at the bottom; full stretch. Drop set on the last set.' })
const ULT_WRISTS = () => [
  s(X.wristCurl, 2, '12-20', 30, { ss: 'C', drop: true, note: 'Forearm flexors. Cable or dumbbell.' }),
  s(X.revWristCurl, 2, '12-20', 90, { ss: 'C', drop: true, note: 'Forearm extensors. Cable or dumbbell.' })
]

/* ---------------------------------------------------------------- workouts */

const W = {
  fullQuick: wo('Full Body Quick', 'Whole body in about half an hour. Short rests.', [
    s(X.goblet, 3, '10-12', 75),
    s(X.chestPress, 3, '10-12', 75),
    s(X.latPd, 3, '10-12', 75),
    s(X.dbRdl, 2, '10-12', 75),
    PLANK(2)
  ]),
  push: wo('Push', 'Chest, shoulders and triceps.', [
    s(X.bench, 4, '6-10', 150),
    s(X.inclineDb, 3, '8-12', 120),
    s(X.dbOhp, 3, '8-12', 120),
    s(X.lateral, 3, '12-15', 60),
    s(X.pushdown, 3, '10-12', 60),
    s(X.ohExt, 2, '12-15', 60)
  ]),
  pull: wo('Pull', 'Back and biceps.', [
    s(X.latPd, 4, '8-12', 105),
    s(X.row, 3, '8-10', 120),
    s(X.cableRow, 3, '10-12', 90),
    s(X.facePull, 3, '12-15', 60),
    s(X.curl, 3, '10-12', 60),
    s(X.hammer, 2, '10-12', 60)
  ]),
  legs: wo('Legs', 'Quads, hamstrings, glutes and calves.', [
    s(X.squat, 4, '6-10', 180),
    s(X.rdl, 3, '8-10', 150),
    s(X.legPress, 3, '10-12', 120),
    s(X.legCurl, 3, '10-12', 90),
    s(X.calf, 4, '10-15', 60)
  ]),
  upper: wo('Upper', 'Chest, back, shoulders and arms.', [
    s(X.bench, 3, '6-10', 150),
    s(X.row, 3, '8-10', 120),
    s(X.dbOhp, 3, '8-12', 120),
    s(X.latPd, 3, '8-12', 105),
    s(X.curl, 2, '10-12', 15, { ss: 'A' }),
    s(X.pushdown, 2, '10-12', 75, { ss: 'A' })
  ]),
  lower: wo('Lower', 'Legs and core.', [
    s(X.squat, 3, '6-10', 180),
    s(X.rdl, 3, '8-10', 150),
    s(X.legExt, 3, '10-15', 90),
    s(X.legCurl, 3, '10-12', 90),
    s(X.calf, 3, '10-15', 60),
    PLANK(2)
  ]),
  chestTri: wo('Chest & Triceps', 'Presses first, then isolation.', [
    s(X.bench, 4, '6-10', 150),
    s(X.inclineDb, 3, '8-12', 120),
    s(X.chestFly, 3, '12-15', 75),
    s(X.dip, 3, '8-12', 120),
    s(X.pushdown, 3, '10-12', 60),
    s(X.ohExt, 2, '12-15', 60)
  ]),
  backBi: wo('Back & Biceps', 'Pull-ups first while you are fresh.', [
    s(X.pullUp, 3, '6-10', 120, { note: 'Use the assisted machine if you need it.' }),
    s(X.row, 3, '8-10', 120),
    s(X.latPd, 3, '10-12', 90),
    s(X.cableRow, 3, '10-12', 90),
    s(X.bbCurl, 3, '8-12', 75),
    s(X.hammer, 2, '10-12', 60)
  ]),
  shouldersArms: wo('Shoulders & Arms', 'Arms are done as supersets: one set of each, then rest.', [
    s(X.dbOhp, 4, '8-12', 120),
    s(X.lateral, 4, '12-15', 60),
    s(X.rearDelt, 3, '12-15', 60),
    s(X.curl, 3, '10-12', 15, { ss: 'A' }),
    s(X.pushdown, 3, '10-12', 75, { ss: 'A' }),
    s(X.hammer, 2, '10-12', 15, { ss: 'B' }),
    s(X.ohExt, 2, '12-15', 75, { ss: 'B' })
  ]),
  gluteHam: wo('Glutes & Hamstrings', 'Hip thrust heavy, the rest controlled.', [
    s(X.hipThrust, 4, '8-12', 120),
    s(X.rdl, 3, '8-10', 120),
    s(X.split, 3, '8-12', 90, { note: 'Reps per leg.' }),
    s(X.seatedCurl, 3, '10-15', 75),
    s(X.abduction, 3, '12-20', 60),
    s(X.kickback, 2, '12-15', 60, { note: 'Reps per leg.' })
  ]),
  core: wo('Core', 'Slow and controlled. Quality over speed.', [
    PLANK(3),
    s(X.legRaise, 3, '8-15', 60),
    s(X.cableCrunch, 3, '10-15', 60),
    s(X.sidePlank, 2, '20-40', 45, { note: 'Each side.' }),
    s(X.deadBug, 2, '8-12', 45, { note: 'Reps per side.' })
  ]),
  dbFull: wo('Dumbbell Full Body', 'Everything with one pair of dumbbells.', [
    s(X.goblet, 3, '10-12', 90),
    s(X.dbBench, 3, '8-12', 90),
    s(X.dbRow, 3, '8-12', 75, { note: 'Reps per arm.' }),
    s(X.dbOhp, 3, '8-12', 90),
    s(X.dbRdl, 3, '10-12', 90),
    s(X.curl, 2, '10-12', 60)
  ]),
  bodyweight: wo('Bodyweight at Home', 'No equipment. Go slow and keep good form.', [
    s(X.bwSquat, 3, '12-20', 60),
    s(X.pushUp, 3, '8-20', 60, { note: 'Knees down is fine.' }),
    s(X.bwLunge, 3, '8-12', 60, { note: 'Reps per leg.' }),
    s(X.gluteBridge, 3, '12-20', 45),
    s(X.pikePush, 2, '6-12', 60),
    PLANK(2),
    s(X.mountain, 2, '30-45', 45)
  ]),
  firstDay: wo('First Gym Day', 'Light weights. The goal is to learn the machines and feel how each one works.', [
    s(X.legPress, 2, '10-12', 90),
    s(X.chestPress, 2, '10-12', 90),
    s(X.latPd, 2, '10-12', 90),
    s(X.mRow, 2, '10-12', 90),
    s(X.mOhp, 2, '10-12', 90),
    PLANK(2)
  ]),
  machines: wo('Machines Only', 'Every exercise on a machine. Easy to learn, easy to set up.', [
    s(X.legPress, 3, '10-12', 120),
    s(X.legCurl, 3, '10-12', 75),
    s(X.legExt, 3, '12-15', 75),
    s(X.chestPress, 3, '8-12', 90),
    s(X.mRow, 3, '8-12', 90),
    s(X.mOhp, 3, '8-12', 90),
    s(X.preacher, 2, '10-12', 60)
  ]),
  arms: wo('Arms Pump', 'Biceps and triceps in supersets. Short rests, chase the pump.', [
    s(X.bbCurl, 3, '8-12', 15, { ss: 'A' }),
    s(X.skull, 3, '8-12', 75, { ss: 'A' }),
    s(X.hammer, 3, '10-12', 15, { ss: 'B' }),
    s(X.ohExt, 3, '10-12', 75, { ss: 'B' }),
    s(X.cableCurl, 2, '12-15', 15, { ss: 'C' }),
    s(X.pushdown, 2, '12-15', 60, { ss: 'C' })
  ]),
  legStrength: wo('Leg Day Strength', 'Heavy and low reps. Warm up well before the first work set.', [
    s(X.squat, 5, '3-5', 180),
    s(X.rdl, 3, '5-6', 180),
    s(X.legPress, 3, '6-8', 150),
    s(X.seatedCalf, 3, '8-12', 75)
  ]),
  posterior: wo('Posterior Chain', 'Back of the body: glutes, hamstrings and lower back.', [
    s(X.deadlift, 3, '4-6', 180),
    s(X.goodMorning, 3, '8-10', 120),
    s(X.hipThrust, 3, '8-12', 120),
    s(X.seatedCurl, 3, '10-12', 75),
    s(X.backExt, 2, '12-15', 60)
  ]),
  mobility: wo('Mobility & Warm-up', 'Gentle moves before training or on a rest day. Breathe and move slowly.', [
    s(X.catCow, 2, '30-45', 15),
    s(X.worldsGreatest, 2, '30-45', 15, { note: 'Each side.' }),
    s(X.hipFlexor, 2, '30-45', 15, { note: 'Each side.' }),
    s(X.armCircles, 1, '30-45', 15),
    s(X.wallSlide, 2, '10-15', 15),
    s(X.squatHold, 2, '30-60', 15)
  ]),
  conditioning: wo('Conditioning Circuit', 'Do one round of all four, rest 90 seconds, repeat. Keep moving.', [
    s(X.jumpingJack, 4, '30-45', 0, { ss: 'A' }),
    s(X.goblet, 4, '12-15', 0, { ss: 'A' }),
    s(X.burpee, 4, '8-12', 0, { ss: 'A' }),
    s(X.mountain, 4, '30-45', 90, { ss: 'A' })
  ]),

  // parts of weekly programs only
  // The Ultimate 4-Day Plan: 2 hard sets per lift, under 75 minutes a day
  ultUpperA: wo('Upper A', 'Back and chest focus. 2 working sets per lift; under 75 min.', [
    s(X.wPullUp, 2, '6-8', 180),
    s(X.inclineMachine, 2, '6-10', 180),
    s(X.isoRow, 2, '8-10', 150, { note: 'Or a chest-supported T-bar row.' }),
    s(X.wDip, 2, '6-10', 150),
    s(X.plateOhp, 2, '8-10', 150),
    ULT_LATERAL('A'),
    ULT_REAR_FLY('A'),
    s(X.cableCurl, 2, '10-12', 30, { ss: 'B', drop: true }),
    s(X.pushdown, 2, '10-12', 90, { ss: 'B', drop: true })
  ]),
  ultLowerA: wo('Lower A', 'Quad focus. 2 working sets per lift; under 75 min.', [
    s(X.rdl, 2, '6-10', 180, { note: 'Main hip hinge of the week: stretch the hamstrings to mid-shin, 2-3 s on the way down.' }),
    ULT_LEG_PRESS('8-12', 180),
    s(X.legExt, 2, '10-15', 90, { drop: true }),
    s(X.standingCurl, 2, '10-12', 90, { drop: true, note: 'Lean forward on the pad for more hamstring stretch; slow on the way down.' }),
    ULT_CALF(),
    s(X.cableCrunch, 3, '10-15', 60, { note: 'Last set: crunch with a twist to each side (obliques).' }),
    ...ULT_WRISTS()
  ]),
  ultUpperB: wo('Upper B', 'Chest and back, arms. 2 working sets per lift; under 75 min.', [
    s(X.chestPress, 2, '6-10', 180, { note: 'Bench press machine.' }),
    s(X.inclineDb, 2, '8-12', 150, { note: 'Or the incline machine. Upper chest twice a week.' }),
    s(X.wPullUp, 2, '6-10', 180),
    s(X.closeRow, 2, '8-12', 150),
    s(X.straightArm, 2, '12-15', 90, { drop: true, note: 'Lats in the stretch; elbows soft and fixed.' }),
    s(X.chestFly, 2, '10-15', 120, { drop: true }),
    ULT_LATERAL('A'),
    ULT_REAR_FLY('A'),
    s(X.hammer, 2, '10-12', 30, { ss: 'B', drop: true }),
    s(X.pushdown, 2, '10-12', 90, { ss: 'B', drop: true, note: 'Or an overhead cable extension for more long-head stretch.' })
  ]),
  ultLowerB: wo('Lower B', 'Glute and hamstring focus. 2 working sets per lift; under 75 min.', [
    s(X.hipThrust, 2, '8-12', 150),
    ULT_LEG_PRESS('10-12', 150),
    s(X.standingCurl, 2, '10-12', 90, { drop: true }),
    s(X.legExt, 2, '12-15', 90, { drop: true }),
    ULT_CALF(),
    s(X.kneeRaise, 3, '10-15', 60, { note: 'Move on to straight-leg hanging leg raises when 15 reps are easy.' }),
    ...ULT_WRISTS()
  ]),
  fbA: wo('Full Body A', 'Start light. Add weight once you reach the top of the rep range on every set.', [
    s(X.legPress, 3, '8-12', 120),
    s(X.chestPress, 3, '8-12', 120),
    s(X.latPd, 3, '8-12', 105),
    s(X.legCurl, 2, '10-12', 90),
    PLANK(2)
  ]),
  fbB: wo('Full Body B', 'Start light. Add weight once you reach the top of the rep range on every set.', [
    s(X.goblet, 3, '8-12', 120),
    s(X.mOhp, 3, '8-12', 120),
    s(X.cableRow, 3, '8-12', 105),
    s(X.hipThrust, 2, '10-12', 120),
    s(X.curl, 2, '10-12', 60)
  ]),
  upperA: wo('Upper A', 'Heavier day.', [
    s(X.bench, 3, '5-8', 150),
    s(X.row, 3, '6-8', 150),
    s(X.ohp, 2, '6-8', 150),
    s(X.latPd, 3, '8-10', 105),
    s(X.pushdown, 2, '10-12', 15, { ss: 'A' }),
    s(X.curl, 2, '10-12', 75, { ss: 'A' })
  ]),
  lowerA: wo('Lower A', 'Heavier day.', [s(X.squat, 3, '5-8', 180), s(X.rdl, 3, '6-8', 150), s(X.legCurl, 3, '8-12', 90), s(X.calf, 3, '8-12', 75), PLANK(2)]),
  upperB: wo('Upper B', 'Lighter day, more reps.', [
    s(X.inclineDb, 3, '8-12', 120),
    s(X.cableRow, 3, '10-12', 90),
    s(X.lateral, 3, '12-15', 60),
    s(X.pullUp, 3, '6-10', 120),
    s(X.facePull, 2, '12-15', 60)
  ]),
  lowerB: wo('Lower B', 'Lighter day, more reps.', [
    s(X.legPress, 3, '10-12', 120),
    s(X.hipThrust, 3, '8-12', 120),
    s(X.legExt, 3, '12-15', 75),
    s(X.legCurl, 2, '12-15', 75),
    s(X.calf, 3, '12-15', 60),
    s(X.cableCrunch, 3, '10-15', 60)
  ]),
  pushA: wo('Push A', 'Heavy pressing.', [
    s(X.bench, 4, '5-8', 150),
    s(X.ohp, 3, '6-8', 150),
    s(X.inclineDb, 3, '8-12', 120),
    s(X.lateral, 3, '12-15', 15, { ss: 'A' }),
    s(X.pushdown, 3, '10-12', 75, { ss: 'A' })
  ]),
  pullA: wo('Pull A', 'Heavy pulling.', [
    s(X.deadlift, 3, '4-6', 180),
    s(X.pullUp, 3, '6-10', 120),
    s(X.row, 3, '6-8', 120),
    s(X.facePull, 3, '12-15', 15, { ss: 'A' }),
    s(X.curl, 3, '8-12', 75, { ss: 'A' })
  ]),
  legsA: wo('Legs A', 'Squat focus.', [s(X.squat, 4, '5-8', 180), s(X.rdl, 3, '8-10', 150), s(X.legExt, 3, '10-15', 75), s(X.legCurl, 3, '10-12', 75), s(X.calf, 4, '8-12', 60)]),
  pushB: wo('Push B', 'More reps.', [
    s(X.inclineDb, 4, '8-12', 120),
    s(X.chestFly, 3, '12-15', 75),
    s(X.dbOhp, 3, '8-12', 120),
    s(X.lateral, 4, '12-20', 60),
    s(X.ohExt, 3, '10-15', 60)
  ]),
  pullB: wo('Pull B', 'More reps.', [
    s(X.latPd, 4, '8-12', 105),
    s(X.cableRow, 3, '10-12', 90),
    s(X.rearDelt, 3, '12-15', 60),
    s(X.hammer, 3, '10-12', 60),
    s(X.cableCrunch, 3, '10-15', 60)
  ]),
  legsB: wo('Legs B', 'Glutes and hamstrings focus.', [
    s(X.hipThrust, 4, '8-12', 120),
    s(X.legPress, 3, '10-15', 120),
    s(X.split, 3, '8-12', 90, { note: 'Reps per leg.' }),
    s(X.legCurl, 3, '12-15', 75),
    s(X.calf, 4, '12-15', 60)
  ]),
  fiveA: wo('5×5 A', 'Rest 3 minutes between heavy sets. Add 2.5 kg next time if you got all 25 reps.', [
    s(X.squat, 5, '5', 180),
    s(X.bench, 5, '5', 180),
    s(X.row, 5, '5', 180)
  ]),
  fiveB: wo('5×5 B', 'Deadlift is one heavy set of five after warm-ups.', [s(X.squat, 5, '5', 180), s(X.ohp, 5, '5', 180), s(X.deadlift, 1, '5', 180)]),
  homeA: wo('Home A', 'Full body. Short rests.', [
    s(X.goblet, 3, '10-15', 75),
    s(X.floorPress, 3, '8-12', 75),
    s(X.dbRow, 3, '8-12', 75, { note: 'Reps per arm.' }),
    s(X.lateral, 2, '12-15', 60),
    PLANK(3)
  ]),
  homeB: wo('Home B', 'Full body. Short rests.', [
    s(X.dbRdl, 3, '10-12', 75),
    s(X.pushUp, 3, '8-20', 60, { note: 'Knees down is fine.' }),
    s(X.dbOhp, 3, '8-12', 75),
    s(X.curl, 2, '10-12', 15, { ss: 'A' }),
    s(X.dbOhExt, 2, '10-12', 60, { ss: 'A' }),
    s(X.sidePlank, 2, '20-40', 45, { note: 'Each side.' })
  ]),
  glutesA: wo('Glutes A', 'Heavy hip thrusts.', [
    s(X.hipThrust, 4, '6-10', 150),
    s(X.rdl, 3, '8-10', 120),
    s(X.split, 3, '8-12', 90, { note: 'Reps per leg.' }),
    s(X.abduction, 3, '12-20', 60),
    s(X.kickback, 2, '12-15', 60, { note: 'Reps per leg.' })
  ]),
  glutesB: wo('Glutes B', 'Squats and more reps.', [
    s(X.squat, 3, '8-10', 150),
    s(X.hipThrust, 3, '10-15', 120),
    s(X.lunge, 3, '10-12', 90, { note: 'Reps per leg.' }),
    s(X.seatedCurl, 3, '10-15', 75),
    s(X.abduction, 3, '15-20', 60)
  ]),
  upperLight: wo('Upper (light)', 'Back, shoulders and arms, moderate weights.', [
    s(X.latPd, 3, '8-12', 105),
    s(X.dbOhp, 3, '8-12', 105),
    s(X.cableRow, 3, '10-12', 90),
    s(X.inclineDb, 3, '8-12', 105),
    s(X.lateral, 3, '12-15', 60),
    s(X.curl, 2, '10-12', 15, { ss: 'A' }),
    s(X.pushdown, 2, '10-12', 60, { ss: 'A' })
  ]),
  arnoldChestBack: wo('Chest & Back', 'Push and pull in turns. Supersets save time.', [
    s(X.bench, 4, '6-10', 15, { ss: 'A' }),
    s(X.pullUp, 4, '6-10', 120, { ss: 'A' }),
    s(X.inclineDb, 3, '8-12', 15, { ss: 'B' }),
    s(X.row, 3, '8-10', 120, { ss: 'B' }),
    s(X.cableFly, 3, '12-15', 75),
    s(X.cableRow, 3, '10-12', 75)
  ]),
  arnoldShArms: wo('Shoulders & Arms', 'Presses first, then arm supersets.', [
    s(X.arnold, 4, '8-12', 120),
    s(X.lateral, 4, '12-15', 60),
    s(X.rearDelt, 3, '12-15', 60),
    s(X.bbCurl, 3, '8-12', 15, { ss: 'A' }),
    s(X.skull, 3, '8-12', 75, { ss: 'A' }),
    s(X.hammer, 3, '10-12', 15, { ss: 'B' }),
    s(X.ohExt, 3, '10-12', 75, { ss: 'B' })
  ]),
  arnoldLegs: wo('Legs', 'Squats, hamstrings, calves and abs.', [
    s(X.squat, 4, '6-10', 180),
    s(X.rdl, 3, '8-10', 150),
    s(X.legExt, 3, '12-15', 75),
    s(X.legCurl, 3, '10-12', 75),
    s(X.calf, 4, '10-15', 60),
    s(X.legRaise, 3, '10-15', 60)
  ]),
  miniA: wo('Minimal A', 'Four big lifts. In and out in 45 minutes.', [
    s(X.squat, 3, '6-8', 180),
    s(X.bench, 3, '6-8', 150),
    s(X.row, 3, '8-10', 120),
    PLANK(2)
  ]),
  miniB: wo('Minimal B', 'Four big lifts. In and out in 45 minutes.', [
    s(X.deadlift, 3, '5', 180),
    s(X.ohp, 3, '6-8', 150),
    s(X.latPd, 3, '8-12', 105),
    s(X.legRaise, 2, '8-15', 60)
  ]),
  broChest: wo('Chest', 'Chest from every angle.', [
    s(X.bench, 4, '6-10', 150),
    s(X.inclineDb, 3, '8-12', 120),
    s(X.chestPress, 3, '10-12', 90),
    s(X.cableFly, 3, '12-15', 60),
    s(X.dip, 2, '8-12', 90)
  ]),
  broBack: wo('Back', 'Width and thickness.', [
    s(X.pullUp, 3, '6-10', 120),
    s(X.row, 3, '8-10', 120),
    s(X.latPd, 3, '10-12', 90),
    s(X.cableRow, 3, '10-12', 90),
    s(X.backExt, 2, '12-15', 60)
  ]),
  broShoulders: wo('Shoulders', 'Front, side and rear.', [
    s(X.ohp, 4, '6-10', 150),
    s(X.lateral, 4, '12-15', 60),
    s(X.cableLateral, 3, '12-15', 45),
    s(X.rearDelt, 3, '12-15', 60),
    s(X.facePull, 3, '12-15', 60)
  ]),
  broLegs: wo('Legs', 'The hardest day of the week.', [
    s(X.squat, 4, '6-10', 180),
    s(X.hack, 3, '8-12', 150),
    s(X.rdl, 3, '8-10', 150),
    s(X.legExt, 3, '12-15', 75),
    s(X.legCurl, 3, '10-12', 75),
    s(X.calf, 4, '10-15', 60)
  ]),
  broArms: wo('Arms', 'Biceps and triceps, finish with forearms.', [
    s(X.bbCurl, 3, '8-12', 75),
    s(X.skull, 3, '8-12', 75),
    s(X.hammer, 3, '10-12', 60),
    s(X.pushdown, 3, '10-12', 60),
    s(X.preacher, 2, '12-15', 60),
    s(X.ohExt, 2, '12-15', 60),
    s(X.farmer, 2, '30-45', 60)
  ])
}

/* ------------------------------------------------------------ single workouts */

const single = (id: string, level: Program['level'], goal: string, w: ProgramWorkout, description: string): Program => ({
  id,
  kind: 'single',
  name: w.name,
  description,
  level,
  goal,
  days: 1,
  workouts: [w]
})

export const SINGLE_WORKOUTS: Program[] = [
  single('first-gym-day', 'Beginner', 'Learn the basics', W.firstDay, 'Your very first workout. Six simple machines that cover the whole body, two easy sets each.'),
  single('full-body-quick', 'Beginner', 'Stay fit', W.fullQuick, 'Short on time? Five exercises cover the whole body in about 30 minutes.'),
  single('machines-only', 'Beginner', 'Build muscle', W.machines, 'Only machines, so every exercise is easy to set up and safe to push hard.'),
  single('dumbbell-full-body', 'Beginner', 'Stay fit', W.dbFull, 'A complete workout with one pair of dumbbells and a bench.'),
  single('bodyweight-home', 'Beginner', 'Stay fit at home', W.bodyweight, 'No equipment at all. Do it in your living room, a hotel or a park.'),
  single('push', 'Intermediate', 'Build muscle', W.push, 'Every pushing muscle: chest, shoulders and triceps.'),
  single('pull', 'Intermediate', 'Build muscle', W.pull, 'Every pulling muscle: back, rear shoulders and biceps.'),
  single('legs', 'Intermediate', 'Build muscle', W.legs, 'A full leg day: squat, hinge, press, curl and calves.'),
  single('upper', 'Intermediate', 'Muscle and strength', W.upper, 'Chest, back, shoulders and arms in one session.'),
  single('lower', 'Intermediate', 'Muscle and strength', W.lower, 'Legs and core in one session.'),
  single('chest-triceps', 'Intermediate', 'Build muscle', W.chestTri, 'A classic pairing. Heavy presses, then fly, dips and triceps.'),
  single('back-biceps', 'Intermediate', 'Build muscle', W.backBi, 'Pull-ups, rows and pulldowns, then curls.'),
  single('shoulders-arms', 'Intermediate', 'Build muscle', W.shouldersArms, 'Rounder shoulders and bigger arms. Arm work is done in supersets.'),
  single('glutes-hamstrings', 'Intermediate', 'Glutes', W.gluteHam, 'Hip thrusts, Romanian deadlifts and split squats for the back of the legs.'),
  single('core', 'Beginner', 'Strong core', W.core, 'Planks, leg raises and crunches. Add it to the end of any workout or do it alone.'),
  single('arms-pump', 'Intermediate', 'Build muscle', W.arms, 'Three supersets of biceps and triceps with short rests.'),
  single('leg-day-strength', 'Advanced', 'Get stronger', W.legStrength, 'Heavy squats and Romanian deadlifts with low reps and long rests.'),
  single('posterior-chain', 'Advanced', 'Get stronger', W.posterior, 'Deadlifts, good mornings and hip thrusts for a strong back of the body.'),
  single('mobility', 'Beginner', 'Move better', W.mobility, 'About 15 easy minutes of timed stretches. Use it as a warm-up or on a rest day.'),
  single('conditioning', 'Intermediate', 'Fitness', W.conditioning, 'A sweaty circuit of jumping jacks, goblet squats, burpees and climbers. One dumbbell is enough.')
]

/* ------------------------------------------------------------- weekly programs */

const weekly = (p: Omit<Program, 'kind'>): Program => ({ ...p, kind: 'weekly' })

export const WEEKLY_PROGRAMS: Program[] = [
  weekly({
    id: 'ultimate-4',
    name: 'The Ultimate 4-Day Plan',
    description:
      'Upper / lower on Sunday, Monday, Wednesday and Thursday. Only 2 hard working sets per lift, so every day fits in 75 minutes with warm-ups. Drop sets and supersets on the small muscles, forearms twice a week.',
    level: 'Intermediate',
    goal: 'Muscle and strength',
    days: 4,
    workouts: [W.ultUpperA, W.ultLowerA, W.ultUpperB, W.ultLowerB]
  }),
  weekly({
    id: 'beginner-full-body',
    name: 'Beginner Full Body',
    description:
      'Two full-body workouts, A and B. Do them on 3 days a week with a rest day in between, swapping A and B each time. Simple machine and free-weight lifts. A good first program.',
    level: 'Beginner',
    goal: 'Learn the basics',
    days: 3,
    workouts: [W.fbA, W.fbB]
  }),
  weekly({
    id: 'minimalist-2',
    name: 'Minimalist',
    description: 'Only two days a week and four big lifts per workout. The least you can do and still make real progress.',
    level: 'Beginner',
    goal: 'Get stronger',
    days: 2,
    workouts: [W.miniA, W.miniB]
  }),
  weekly({
    id: 'strength-5x5',
    name: '5×5 Strength',
    description:
      'Two short barbell workouts, A and B, three times a week. Five sets of five reps on the big lifts. Add a little weight every time you finish all the reps.',
    level: 'Beginner',
    goal: 'Get stronger',
    days: 3,
    workouts: [W.fiveA, W.fiveB]
  }),
  weekly({
    id: 'dumbbell-home',
    name: 'Dumbbells at Home',
    description: 'Three full-body workouts a week with just a pair of dumbbells and your body weight. No gym needed.',
    level: 'Beginner',
    goal: 'Stay fit at home',
    days: 3,
    workouts: [W.homeA, W.homeB]
  }),
  weekly({
    id: 'ppl-3',
    name: 'Push / Pull / Legs',
    description: 'Three workouts: push (chest, shoulders, triceps), pull (back, biceps) and legs. Each muscle gets one hard day a week.',
    level: 'Beginner',
    goal: 'Build muscle',
    days: 3,
    workouts: [W.push, W.pull, W.legs]
  }),
  weekly({
    id: 'upper-lower-4',
    name: 'Upper / Lower',
    description:
      'Upper body, lower body, rest, then upper and lower again. Day A is heavier with fewer reps, day B is lighter with more reps. Good once you have trained for a few months.',
    level: 'Intermediate',
    goal: 'Muscle and strength',
    days: 4,
    workouts: [W.upperA, W.lowerA, W.upperB, W.lowerB]
  }),
  weekly({
    id: 'glute-focus-4',
    name: 'Glute Focus',
    description: 'Two glute days and two upper-body days a week. Most of the work goes to glutes and hamstrings.',
    level: 'Intermediate',
    goal: 'Glutes',
    days: 4,
    workouts: [W.glutesA, W.upper, W.glutesB, W.upperLight]
  }),
  weekly({
    id: 'bro-split-5',
    name: 'Body Part Split',
    description: 'One muscle group a day, five days a week: chest, back, shoulders, legs and arms. Lots of sets for each muscle once a week.',
    level: 'Intermediate',
    goal: 'Build muscle',
    days: 5,
    workouts: [W.broChest, W.broBack, W.broShoulders, W.broLegs, W.broArms]
  }),
  weekly({
    id: 'ppl-6',
    name: 'Push / Pull / Legs ×2',
    description: 'Push, pull and legs twice a week, six days in a row with one rest day. Lots of volume, so only pick this if you recover well.',
    level: 'Advanced',
    goal: 'Build muscle',
    days: 6,
    workouts: [W.pushA, W.pullA, W.legsA, W.pushB, W.pullB, W.legsB]
  }),
  weekly({
    id: 'arnold-6',
    name: 'Arnold Split',
    description: 'Chest and back, shoulders and arms, then legs. Repeat once more for six days a week. High volume with plenty of supersets.',
    level: 'Advanced',
    goal: 'Build muscle',
    days: 6,
    workouts: [W.arnoldChestBack, W.arnoldShArms, W.arnoldLegs]
  })
]
