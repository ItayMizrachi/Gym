import { EQUIPMENT, Exercise, MUSCLES, Session } from './types'
import { tm } from './i18n'
import { englishQuery } from './hebrewSearch'

export interface ExerciseFilter {
  q?: string
  /** 'All' or '' = any */
  muscle?: string
  equipment?: string
}

const any = (v: string | undefined) => !v || v === 'All'

/** Search by name, muscle or equipment; names that start with the query rank first, then A–Z. */
export function filterExercises(list: Exercise[], f: ExerciseFilter): Exercise[] {
  const raw = (f.q ?? '').trim().toLowerCase()
  // Hebrew is turned into the English words exercise names use (src/lib/hebrewSearch.ts)
  const needle = englishQuery(raw).toLowerCase()
  const words = needle.split(/\s+/).filter(Boolean)
  return list
    .filter((e) => {
      if (!(any(f.muscle) || e.muscle === f.muscle) || !(any(f.equipment) || (e.equipment || 'Other') === f.equipment)) return false
      if (!needle) return true
      const hay = `${e.name} ${e.muscle} ${e.equipment ?? ''}`.toLowerCase()
      // the name as typed (any language), or every word of the translated query
      return hay.includes(raw) || words.every((w) => hay.includes(w))
    })
    .sort((a, b) => {
      if (needle) {
        const sa = a.name.toLowerCase().startsWith(needle) ? 0 : 1
        const sb = b.name.toLowerCase().startsWith(needle) ? 0 : 1
        if (sa !== sb) return sa - sb
      }
      return a.name.localeCompare(b.name)
    })
}

/** Exercise ids from the most recent workouts, newest first. */
export function recentExerciseIds(sessions: Session[], max = 6): string[] {
  const ids: string[] = []
  const sorted = [...sessions].sort((a, b) => (b.started_at > a.started_at ? 1 : -1))
  for (const s of sorted) {
    for (const e of s.data.exercises) if (!ids.includes(e.exercise_id)) ids.push(e.exercise_id)
    if (ids.length >= max) break
  }
  return ids.slice(0, max)
}

/** Muscle and equipment values that actually occur in `list`, in the standard order. */
export function facets(list: Exercise[]) {
  const ms = new Set(list.map((e) => e.muscle))
  const eq = new Set(list.map((e) => e.equipment || 'Other'))
  const order = (all: string[], have: Set<string>) => [...all.filter((x) => have.has(x)), ...[...have].filter((x) => !all.includes(x)).sort()]
  return { muscles: order(MUSCLES, ms), equipment: order(EQUIPMENT, eq) }
}

/** "Chest · Barbell" */
export const exerciseMeta = (e: Pick<Exercise, 'muscle' | 'equipment'>) => [e.muscle, e.equipment].filter(Boolean).map((x) => tm(x!)).join(' · ')
