import { useEffect, useState } from 'react'
import { Exercise, Tracking } from './types'
import { nowIso, uid } from './uid'
import { NAME_TO_LIB, libIdForExercise, libPath } from './libraryLinks'

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
  listPromise ??= import('../data/library.json')
    .then((m) => {
      listCache = (m.default as unknown as RawEntry[]).map(fromRaw)
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
  return (await stepsPromise)[id] ?? []
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
    return words.every((w) => hay.includes(w))
  })
  // no query: the well-known gym lifts (the ones the built-in plans use) first, then A–Z
  if (!q) return [...out].sort((a, b) => Number(!POPULAR.has(a.id)) - Number(!POPULAR.has(b.id)))
  const rank = (e: LibraryExercise) => {
    const n = norm(e.name)
    return n.startsWith(q) ? 0 : n.includes(q) ? 1 : words.every((w) => n.includes(w)) ? 2 : 3
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
    image_path: libPath(lib.id),
    rest_sec: lib.tracking === 'time' ? 60 : lib.equipment === 'Barbell' ? 150 : 90,
    created_at: nowIso(),
    equipment: lib.equipment,
    tracking: lib.tracking
  }
}

/** "Chest · Barbell" */
export const libMeta = (e: LibraryExercise) => [e.muscle, e.equipment].filter(Boolean).join(' · ')
