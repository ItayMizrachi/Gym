import { supabase } from './supabase'
import { useStore } from './store'
import { Exercise, Tracking } from './types'
import { libIdOf, PHOTO_OF } from './libraryLinks'

/*
 * Shared library (supabase/schema.sql: shared_exercises). An exercise someone creates is sent as a suggestion;
 * once an admin approves it, it is part of everyone's library. Cloud mode only; local mode keeps to itself.
 */

export interface SharedExercise {
  id: string
  name: string
  muscle: string
  equipment: string
  tracking: Tracking
  photo: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

/** library ids of approved shared exercises */
export const sharedLibId = (id: string) => 'SH_' + id

const CACHE = 'gymlog:shared-library'
const QUEUE = 'gymlog:suggest-queue'
type Suggestion = Pick<SharedExercise, 'name' | 'muscle' | 'equipment' | 'tracking' | 'photo'>

const cloud = () => (supabase && useStore.getState().repo?.mode === 'cloud' ? supabase : null)

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* storage full or blocked: not important */
  }
}

/** Offer a newly created exercise to everyone's library (waits for an admin). Never throws. */
export async function suggestExercise(e: Exercise) {
  const photo = libIdOf(e.image_path)
  const s: Suggestion = { name: e.name.trim(), muscle: e.muscle, equipment: e.equipment ?? '', tracking: e.tracking ?? 'weight_reps', photo: photo ? (PHOTO_OF[photo] ?? photo) : null }
  if (s.name.length < 2) return
  writeJson(QUEUE, [...readJson<Suggestion[]>(QUEUE, []).filter((x) => x.name.toLowerCase() !== s.name.toLowerCase()), s])
  await flushSuggestions()
}

let flushing = false
const FINAL = new Set(['23505', '23514', '42501', '22001'])
/** send queued suggestions (also after coming back online) */
export async function flushSuggestions() {
  const sb = cloud()
  if (!sb || flushing) return
  flushing = true
  try {
    const left: Suggestion[] = []
    for (const s of readJson<Suggestion[]>(QUEUE, [])) {
      const { error } = await sb.from('shared_exercises').insert(s)
      // final answers: the name is taken (23505), the row is not allowed (23514 check, 42501 policy, 22001 too long).
      // Anything else (offline, table not created yet) stays queued for the next try.
      if (error && !FINAL.has(error.code)) left.push(s)
    }
    writeJson(QUEUE, left)
  } catch {
    /* offline: the queue stays */
  } finally {
    flushing = false
  }
}

/** Approved shared exercises; the last copy when offline. */
export async function loadShared(): Promise<SharedExercise[]> {
  const sb = cloud()
  const cached = readJson<SharedExercise[]>(CACHE, [])
  if (!sb) return cached
  void flushSuggestions() // anything that waited (offline, or before the table existed)
  try {
    const res = await Promise.race([
      sb.from('shared_exercises').select('id,name,muscle,equipment,tracking,photo,status,created_at').eq('status', 'approved').limit(2000),
      new Promise<null>((r) => setTimeout(() => r(null), 4000))
    ])
    if (!res || res.error || !res.data) return cached
    writeJson(CACHE, res.data)
    return res.data as SharedExercise[]
  } catch {
    return cached
  }
}

/* ------------------------------------------------------------------ admins */

export async function isExerciseAdmin(): Promise<boolean> {
  const sb = cloud()
  if (!sb) return false
  const { data, error } = await sb.rpc('is_exercise_admin')
  return !error && data === true
}

export async function pendingSuggestions(): Promise<SharedExercise[]> {
  const sb = cloud()
  if (!sb) return []
  const { data, error } = await sb
    .from('shared_exercises')
    .select('id,name,muscle,equipment,tracking,photo,status,created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as SharedExercise[]
}

export async function reviewSuggestion(id: string, status: 'approved' | 'rejected') {
  const sb = cloud()
  if (!sb) return
  const { error } = await sb.from('shared_exercises').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
