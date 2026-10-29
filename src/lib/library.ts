import { useEffect, useState } from 'react'
import { Exercise, Tracking } from './types'
import { nowIso, uid } from './uid'
import { NAME_TO_LIB, PHOTO_OF, libIdForExercise, libPath } from './libraryLinks'
import { LIBRARY_EXTRA } from '../data/libraryExtra'

export * from './libraryLinks'

/** One exercise from the built-in library (free-exercise-db, converted by scripts/build-exercise-library.mjs). */
export interface LibraryExercise {
  id: string
  name: string
  /** main muscle group, in GymLog's MUSCLES */
  muscle: string
  /** all primary groups (usually one) */
  muscles: string[]
  /** helper muscles */
  secondary: string[]
  equipment: string
  tracking: Tracking
  level: LibLevel
  /** number of photos (2 = start and end position) */
  frames: number
}

export type LibLevel = 'Beginner' | 'Intermediate' | 'Advanced'
export const LIB_LEVELS: LibLevel[] = ['Beginner', 'Intermediate', 'Advanced']

interface RawEntry {
  i: string
  n: string
  m: string[]
  s: string[]
  e: string
  t: Tracking
  l: LibLevel
  f: number
}

export const fromRaw = (r: RawEntry): LibraryExercise => ({
  id: r.i,
  name: r.n,
  muscle: r.m[0] ?? 'Other',
  muscles: r.m,
  secondary: r.s,
  equipment: r.e,
  tracking: r.t,
  level: r.l,
  frames: r.f
})

/* --------------------------------------------------------------- loading */

let listPromise: Promise<LibraryExercise[]> | null = null
let listCache: LibraryExercise[] | null = null
let stepsPromise: Promise<Record<string, string[]>> | null = null

/** The whole library (~870 exercises). A separate chunk: the first call downloads it, later calls are instant. */
export function loadLibrary(): Promise<LibraryExercise[]> {
  listPromise ??= Promise.all([import('../data/library.json'), import('./community').then((c) => c.loadShared()).catch(() => [])])
    .then(([m, shared]) => {
      const base = [...(m.default as unknown as RawEntry[]), ...LIBRARY_EXTRA]
      const names = new Set(base.map((e) => e.n.toLowerCase()))
      // approved exercises from other users (src/lib/community.ts); a name the library has already is skipped
      const extra: RawEntry[] = shared
        .filter((x) => !names.has(x.name.toLowerCase()))
        .map((x) => {
          const i = 'SH_' + x.id
          if (x.photo) PHOTO_OF[i] = x.photo
          return { i, n: x.name, m: [x.muscle], s: [], e: x.equipment, t: x.tracking, l: 'Beginner', f: x.photo ? 2 : 0 }
        })
      listCache = [...base, ...extra].map(fromRaw)
      return listCache
    })
    .catch((err) => {
      listPromise = null // allow a retry (e.g. the chunk failed to load offline)
      throw err
    })
  return listPromise
}

/** Step-by-step instructions for one library exercise (its own chunk, loaded only by the detail page). */
export async function loadInstructions(id: string): Promise<string[]> {
  stepsPromise ??= import('../data/library-instructions.json')
    .then((m) => m.default as unknown as Record<string, string[]>)
    .catch((err) => {
      stepsPromise = null
      throw err
    })
  const steps = await stepsPromise
  return steps[id] ?? steps[PHOTO_OF[id]] ?? []
}

/** React hook: the library, or null while it loads; `error` when it could not be loaded. */
export function useLibrary(enabled = true) {
  const [list, setList] = useState<LibraryExercise[] | null>(listCache)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled || list) return
    let alive = true
    setError(false)
    loadLibrary().then(
      (l) => alive && setList(l),
      () => alive && setError(true)
    )
    return () => {
      alive = false
    }
  }, [enabled, list, attempt])
  return { list, error, retry: () => setAttempt((a) => a + 1) }
}

/* ---------------------------------------------------------------- search */

export interface LibraryFilter {
  q?: string
  /** 'All' or '' = any */
  muscle?: string
  equipment?: string
  level?: string
}

const SHORT: Record<string, string> = { db: 'dumbbell', bb: 'barbell', kb: 'kettlebell', bw: 'bodyweight' }
/** gym words that the library spells another way: any of them matches */
const SAME: string[][] = [
  ['single', 'one', 'unilateral'],
  ['machine', 'leverage'],
  ['hex', 'trap'],
  ['pec', 'butterfly', 'fly'],
  ['fly', 'flye', 'flyes'],
  ['pulldown', 'pull down'],
  ['pushdown', 'push down'],
  ['calf', 'calves'],
  ['smith', 'machine']
]
const alts = (w: string): string[] => [w, ...SAME.filter((g) => g.includes(w)).flat()]
const POPULAR = new Set(Object.values(NAME_TO_LIB))
const any = (v: string | undefined) => !v || v === 'All'
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Every word of the query must appear in the name, a muscle or the equipment (db, bb and kb are understood).
 * Names that start with the query rank first, then names containing it, then A–Z.
 */
export function searchLibrary(list: LibraryExercise[], f: LibraryFilter): LibraryExercise[] {
  const q = norm(f.q ?? '')
  const words = q ? q.split(' ').map((w) => SHORT[w] ?? w) : []
  const out = list.filter((e) => {
    if (!any(f.muscle) && !e.muscles.includes(f.muscle!)) return false
    if (!any(f.equipment) && e.equipment !== f.equipment) return false
    if (!any(f.level) && e.level !== f.level) return false
    if (!words.length) return true
    const hay = norm([e.name, ...e.muscles, ...e.secondary, e.equipment].join(' '))
    return words.every((w) => alts(w).some((a) => hay.includes(a)))
  })
  // no query: the well-known gym lifts (the ones the built-in plans use) first, then A–Z
  if (!q) return [...out].sort((a, b) => Number(!POPULAR.has(a.id)) - Number(!POPULAR.has(b.id)))
  const rank = (e: LibraryExercise) => {
    const n = norm(e.name)
    return n.startsWith(q) ? 0 : n.includes(q) ? 1 : words.every((w) => alts(w).some((a) => n.includes(a))) ? 2 : 3
  }
  return out.map((e) => [rank(e), e] as const).sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).map((x) => x[1])
}

/* -------------------------------------------------------- my exercises */

/** Library ids the user's exercises already show, so the library can say "Added". */
export function linkedLibIds(exercises: Exercise[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const e of exercises) {
    const id = libIdForExercise(e)
    if (id && !m.has(id)) m.set(id, e.id)
  }
  return m
}

/** A new Exercise row for a library entry, linked through `image_path` so it shows the library photo. */
export function exerciseFromLibrary(lib: LibraryExercise, userId: string): Exercise {
  return {
    id: uid(),
    user_id: userId,
    name: lib.name,
    muscle: lib.muscle,
    notes: '',
    setup: '',
    image_path: lib.id.startsWith('SH_') ? (PHOTO_OF[lib.id] ? libPath(PHOTO_OF[lib.id]) : null) : libPath(lib.id),
    rest_sec: lib.tracking === 'time' ? 60 : lib.equipment === 'Barbell' ? 150 : 90,
    created_at: nowIso(),
    equipment: lib.equipment,
    tracking: lib.tracking
  }
}

/** "Chest · Barbell" */
export const libMeta = (e: LibraryExercise) => [e.muscle, e.equipment].filter(Boolean).join(' · ')

/* ------------------------------------------------------------- matching */

const STOP = new Set(['the', 'a', 'with', 'on', 'to', 'and', 'of', 'in', 'grip', 'medium', 'version', 'exercise', 'single', 'one', 'two'])
// "curls" → "curl", "raises" → "raise", "flyes" → "fly", "pullups" → "pull up"
const WORD: Record<string, string> = { pullups: 'pull up', pullup: 'pull up', pushups: 'push up', pushup: 'push up', chinup: 'chin up', flyes: 'fly', flies: 'fly' }
function stem(w: string) {
  if (WORD[w]) return WORD[w]
  if (/(ch|sh|x)es$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}
// gym slang → the library's words
const PHRASES: [RegExp, string][] = [
  [/pec deck/g, 'butterfly'],
  [/skull crusher/g, 'skullcrusher'],
  [/\bflye\b/g, 'fly'],
  [/\bohp\b/g, 'overhead press'],
  [/\brdl\b/g, 'romanian deadlift']
]
const tokens = (s: string) =>
  PHRASES.reduce((t, [re, to]) => t.replace(re, to), norm(s))
    .split(' ')
    .map(stem)
    .join(' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w))

export interface LibraryMatch {
  lib: LibraryExercise
  /** true when the name matched; false when it is only the most common exercise for that muscle (and equipment) */
  byName: boolean
}

/**
 * The library entry that best fits a name the user typed, using muscle and equipment to break ties.
 * With `fallback`, an exercise with no name match still gets the best-known exercise for its muscle (and equipment),
 * so every exercise has a picture.
 */
export function bestLibraryMatch(
  list: LibraryExercise[],
  ex: { name: string; muscle?: string; equipment?: string },
  opts: { fallback?: boolean } = {}
): LibraryMatch | null {
  const want = new Set(tokens(ex.name))
  // the equipment word in "(Barbell)" is a strong hint even when it is not in the library name
  const eq = ex.equipment || EQUIP_WORDS.find((w) => want.has(w.toLowerCase())) || ''
  let best: { lib: LibraryExercise; score: number } | null = null
  if (want.size) {
    for (const e of list) {
      const have = tokens(e.name)
      // short words ("up" in "warm up") alone never make a match
      const hit = have.filter((w) => want.has(w) && w.length > 2).length
      if (!hit) continue
      const coverage = [...want].filter((w) => have.includes(w) || w.toLowerCase() === e.equipment.toLowerCase()).length / want.size
      const score =
        coverage * 2 +
        hit / have.length -
        // extra words in the library name ("…to a Bench", "…with Chains") make it a variation
        Math.max(0, have.length - hit) * 0.1 -
        have.filter((w) => VARIANT.has(w) && !want.has(w)).length * 0.5 +
        (ex.muscle && e.muscles.includes(ex.muscle) ? 0.3 : 0) +
        (eq ? (e.equipment === eq ? 0.3 : -0.4) : 0) +
        (POPULAR.has(e.id) ? 0.25 : 0)
      if (coverage >= 0.5 && (!best || score > best.score)) best = { lib: e, score }
    }
  }
  if (best) return { lib: best.lib, byName: true }
  if (!opts.fallback || !ex.muscle || ex.muscle === 'Other') return null
  const pool = list.filter((e) => e.muscle === ex.muscle)
  const pick =
    pool.find((e) => POPULAR.has(e.id) && (!eq || e.equipment === eq)) ??
    pool.find((e) => !eq || e.equipment === eq) ??
    pool.find((e) => POPULAR.has(e.id)) ??
    pool[0]
  return pick ? { lib: pick, byName: false } : null
}
/** words that make a different exercise, not just a different name */
const VARIANT = new Set(['reverse', 'decline', 'incline', 'isometric', 'weighted', 'close', 'wide', 'behind', 'jump', 'side', 'rear', 'pronation', 'supination'])
const EQUIP_WORDS = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Smith', 'Bodyweight', 'Kettlebell', 'Band']
