// Build GymLog's bundled exercise library from free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense).
// Not shipped: run by hand when the source changes.
//
//   node scripts/build-exercise-library.mjs            (downloads dist/exercises.json)
//   node scripts/build-exercise-library.mjs file.json  (uses a local copy)
//
// Writes two files so browsing stays light:
//   src/data/library.json               id, name, muscles, equipment, tracking, level (loaded by the Exercises tab)
//   src/data/library-instructions.json  id -> steps (loaded only when a detail page opens)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// free-exercise-db muscle -> GymLog MUSCLES (src/lib/types.ts)
const MUSCLE = {
  abdominals: 'Abs',
  hamstrings: 'Hamstrings',
  adductors: 'Quads', // inner thigh: trained on leg day, closest group
  abductors: 'Glutes', // outer hip
  quadriceps: 'Quads',
  biceps: 'Biceps',
  shoulders: 'Shoulders',
  chest: 'Chest',
  'middle back': 'Back',
  lats: 'Back',
  'lower back': 'Back',
  traps: 'Back',
  calves: 'Calves',
  glutes: 'Glutes',
  triceps: 'Triceps',
  forearms: 'Forearms',
  neck: 'Other'
}

// free-exercise-db equipment -> GymLog EQUIPMENT
function equipment(e) {
  const name = e.name.toLowerCase()
  if (name.includes('smith machine')) return 'Smith'
  switch (e.equipment) {
    case 'barbell':
    case 'e-z curl bar':
      return 'Barbell'
    case 'dumbbell':
      return 'Dumbbell'
    case 'machine':
      return 'Machine'
    case 'cable':
      return 'Cable'
    case 'body only':
      return 'Bodyweight'
    case 'kettlebells':
      return 'Kettlebell'
    case 'bands':
      return 'Band'
    default:
      return 'Other'
  }
}

// What a set records. Stretches, cardio and holds are timed; body-weight moves are reps; the rest weight × reps.
function tracking(e, eq) {
  const name = e.name.toLowerCase()
  if (e.category === 'stretching' || e.category === 'cardio') return 'time'
  if (/\bplank\b|\bhold\b|wall sit|farmer|carry|\bwalk\b/.test(name)) return 'time'
  if (eq === 'Bodyweight') return 'reps'
  return 'weight_reps'
}

const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Advanced' }

const uniq = (xs) => [...new Set(xs)]
const clean = (s) => s.replace(/\s+/g, ' ').trim()
const short = (s) => (s.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [s]).slice(0, 2).join('').trim() || s

const raw = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : await (await fetch(SRC)).text()
const src = JSON.parse(raw)

const list = []
const steps = {}
for (const e of src) {
  if (!e.images?.length) continue
  const eq = equipment(e)
  const primary = uniq(e.primaryMuscles.map((m) => MUSCLE[m] ?? 'Other'))
  const secondary = uniq(e.secondaryMuscles.map((m) => MUSCLE[m] ?? 'Other')).filter((m) => !primary.includes(m))
  // id, name, primary muscles, secondary muscles, equipment, tracking, level, frames
  list.push({
    i: e.id,
    n: clean(e.name),
    m: primary,
    s: secondary,
    e: eq,
    t: tracking(e, eq),
    l: LEVEL[e.level] ?? 'Beginner',
    f: e.images.length
  })
  // Short: "Repeat for the recommended amount…" adds nothing, and each step keeps its first two sentences.
  const s = e.instructions
    .map(clean)
    .filter((x) => x && !/^repeat\b/i.test(x))
    .map(short)
    .slice(0, 6)
  if (s.length) steps[e.id] = s
}
list.sort((a, b) => a.n.localeCompare(b.n))

mkdirSync(join(root, 'src/data'), { recursive: true })
writeFileSync(join(root, 'src/data/library.json'), JSON.stringify(list))
writeFileSync(join(root, 'src/data/library-instructions.json'), JSON.stringify(steps))
console.log(`library: ${list.length} exercises, ${Object.keys(steps).length} with instructions`)
