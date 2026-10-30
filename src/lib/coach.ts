import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useStore } from './store'
import { DB, Exercise, Workout, WorkoutExercise, emptyDB } from './types'
import { nowIso, uid } from './uid'

/*
 * Coaching (supabase/schema.sql, "Coaching"). A coach invites a trainee with a code, then reads their training and
 * adds workouts to their plan. Cloud only. Free for now; a future paid tier would gate createInvite.
 */

export interface CoachLink {
  id: string
  coach_id: string
  trainee_id: string | null
  name: string
  code: string
  status: 'invited' | 'active' | 'ended'
  trainee_email: string | null
  created_at: string
  accepted_at: string | null
  /** coached without the app: the coach logs for them (placeholder account) */
  managed?: boolean
}

export interface MyCoach {
  id: string
  coach_email: string
  status: string
  accepted_at: string | null
}

/**
 * Trainees a coach can have without Pro. null = no limit (coaching is free during the preview, owner's call
 * 2026-10-29). Setting a number shows the Pro screen instead of a new invite once the limit is reached.
 */
export const COACH_FREE_LIMIT: number | null = null

/** folder the coach's workouts land in on the trainee's Train tab */
export const COACH_FOLDER = 'From your coach'

const ROLE_KEY = 'gymlog:coach-role'

function sb() {
  if (!supabase || useStore.getState().repo?.mode !== 'cloud') throw new Error('Coaching needs you to be signed in.')
  return supabase
}

/** "I coach other people": shows the Coach screen. Stored on the device. */
export function getCoachRole(): boolean {
  try {
    return localStorage.getItem(ROLE_KEY) === '1'
  } catch {
    return false
  }
}
export function setCoachRole(on: boolean) {
  try {
    if (on) localStorage.setItem(ROLE_KEY, '1')
    else localStorage.removeItem(ROLE_KEY)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('gymlog:coach-role'))
}
export function useCoachRole(): boolean {
  const [on, setOn] = useState(getCoachRole)
  useEffect(() => {
    const f = () => setOn(getCoachRole())
    window.addEventListener('gymlog:coach-role', f)
    return () => window.removeEventListener('gymlog:coach-role', f)
  }, [])
  return on
}

const friendly = (e: { message?: string } | null | undefined, fallback: string) =>
  new Error(e?.message && !/fetch|network/i.test(e.message) ? e.message : fallback)

/* ------------------------------------------------------------------ coach side */

export async function listTrainees(): Promise<CoachLink[]> {
  const me = useStore.getState().user?.id
  const { data, error } = await sb().from('coach_links').select('*').eq('coach_id', me).neq('status', 'ended').order('created_at')
  if (error) throw friendly(error, 'Could not load your trainees. Check the connection.')
  return (data ?? []) as CoachLink[]
}

export async function createInvite(name: string): Promise<CoachLink> {
  const { data, error } = await sb().from('coach_links').insert({ name: name.trim() }).select('*').single()
  if (error) throw friendly(error, 'Could not create the invite. Check the connection.')
  return data as CoachLink
}

export async function renameTrainee(id: string, name: string) {
  const { error } = await sb().from('coach_links').update({ name: name.trim() }).eq('id', id)
  if (error) throw friendly(error, 'Could not rename. Check the connection.')
}

/** coach: stop coaching (an unused invite is deleted) */
export async function removeTrainee(link: CoachLink) {
  const q = link.status === 'invited' ? sb().from('coach_links').delete().eq('id', link.id) : sb().from('coach_links').update({ status: 'ended' }).eq('id', link.id)
  const { error } = await q
  if (error) throw friendly(error, 'Could not remove. Check the connection.')
}

/** everything a trainee has logged, as a DB (read-only for the coach) */
export async function loadTrainee(traineeId: string): Promise<DB> {
  const db = emptyDB()
  const tables = ['exercises', 'workouts', 'workout_exercises', 'sessions', 'metrics'] as const
  await Promise.all(
    tables.map(async (t) => {
      const rows: unknown[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb().from(t).select('*').eq('user_id', traineeId).order('id').range(from, from + 999)
        if (error) throw friendly(error, 'Could not load this trainee. Check the connection.')
        rows.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
      ;(db as unknown as Record<string, unknown[]>)[t] = rows
    })
  )
  return db
}

/**
 * Copy one of the coach's workouts into the trainee's plan (folder "From your coach"). Exercises are matched by
 * name to the trainee's own; missing ones are created for them, with the same library picture.
 */
export async function assignWorkout(traineeId: string, trainee: DB, mine: DB, workoutId: string): Promise<Workout> {
  const src = mine.workouts.find((w) => w.id === workoutId)
  if (!src) throw new Error('Workout not found.')
  const rows = mine.workout_exercises.filter((r) => r.workout_id === workoutId).sort((a, b) => a.position - b.position)
  const byName = new Map(trainee.exercises.map((e) => [e.name.trim().toLowerCase(), e]))
  const newExercises: Exercise[] = []
  const idFor = new Map<string, string>()
  for (const r of rows) {
    const ex = mine.exercises.find((e) => e.id === r.exercise_id)
    if (!ex || idFor.has(ex.id)) continue
    const have = byName.get(ex.name.trim().toLowerCase())
    if (have) {
      idFor.set(ex.id, have.id)
      continue
    }
    // own photos are private to the coach; a library picture (lib:…) carries over
    const copy: Exercise = { ...ex, id: uid(), user_id: traineeId, notes: '', goal: null, image_path: ex.image_path?.startsWith('lib:') ? ex.image_path : null, created_at: nowIso() }
    newExercises.push(copy)
    byName.set(copy.name.trim().toLowerCase(), copy)
    idFor.set(ex.id, copy.id)
  }
  const position = trainee.workouts.reduce((m, w) => Math.max(m, w.position), -1) + 1
  const workout: Workout = { ...src, id: uid(), user_id: traineeId, position, created_at: nowIso(), folder: COACH_FOLDER }
  const wes: WorkoutExercise[] = rows
    .filter((r) => idFor.has(r.exercise_id))
    .map((r) => ({ ...r, id: uid(), user_id: traineeId, workout_id: workout.id, exercise_id: idFor.get(r.exercise_id)! }))
  const c = sb()
  if (newExercises.length) {
    const { error } = await c.from('exercises').insert(newExercises)
    if (error) throw friendly(error, 'Could not add the workout. Check the connection.')
  }
  {
    const { error } = await c.from('workouts').insert(workout)
    if (error) throw friendly(error, 'Could not add the workout. Check the connection.')
  }
  if (wes.length) {
    const { error } = await c.from('workout_exercises').insert(wes)
    if (error) throw friendly(error, 'Could not add the workout. Check the connection.')
  }
  return workout
}

/** remove a workout from the trainee's plan (their past sessions stay) */
export async function unassignWorkout(workoutId: string) {
  const c = sb()
  const a = await c.from('workout_exercises').delete().eq('workout_id', workoutId)
  if (a.error) throw friendly(a.error, 'Could not remove. Check the connection.')
  const b = await c.from('workouts').delete().eq('id', workoutId)
  if (b.error) throw friendly(b.error, 'Could not remove. Check the connection.')
}

/* ---------------------------------------------------------------- trainee side */

export async function myCoaches(): Promise<MyCoach[]> {
  const { data, error } = await sb().rpc('my_coaches')
  if (error) throw friendly(error, 'Could not load your coach. Check the connection.')
  return (data ?? []) as MyCoach[]
}

export async function acceptInvite(code: string) {
  const { error } = await sb().rpc('accept_coach_invite', { p_code: code })
  if (error) throw new Error(error.code === 'P0002' ? 'No invite with that code. Check it with your coach.' : friendly(error, 'Could not connect. Check the connection.').message)
}

/** trainee: stop sharing with this coach */
export async function leaveCoach(linkId: string) {
  const { error } = await sb().from('coach_links').update({ status: 'ended' }).eq('id', linkId)
  if (error) throw friendly(error, 'Could not disconnect. Check the connection.')
}

/* ------------------------------------------------------------------ notes */

export interface CoachNote {
  id: string
  coach_id: string
  trainee_id: string
  session_id: string | null
  text: string
  created_at: string
}

/** coach: notes written for one trainee; trainee: notes from their coaches (RLS decides which) */
export async function listNotes(traineeId: string): Promise<CoachNote[]> {
  const { data, error } = await sb().from('coach_notes').select('*').eq('trainee_id', traineeId).order('created_at', { ascending: false }).limit(500)
  if (error) throw friendly(error, 'Could not load notes. Check the connection.')
  return (data ?? []) as CoachNote[]
}

export async function addNote(traineeId: string, sessionId: string | null, text: string): Promise<CoachNote> {
  const { data, error } = await sb().from('coach_notes').insert({ trainee_id: traineeId, session_id: sessionId, text: text.trim() }).select('*').single()
  if (error) throw friendly(error, 'Could not save the note. Check the connection.')
  return data as CoachNote
}

export async function deleteNote(id: string) {
  const { error } = await sb().from('coach_notes').delete().eq('id', id)
  if (error) throw friendly(error, 'Could not delete the note. Check the connection.')
}

/** trainee: notes on one of my workouts (empty when there is no coach or no connection) */
export async function notesForMySession(sessionId: string): Promise<CoachNote[]> {
  if (!supabase || useStore.getState().repo?.mode !== 'cloud') return []
  const { data, error } = await supabase.from('coach_notes').select('*').eq('session_id', sessionId).order('created_at')
  return error ? [] : ((data ?? []) as CoachNote[])
}

/* ------------------------------------------------------- editing a trainee's plan */

type PlanTable = 'workouts' | 'workout_exercises' | 'exercises'

/** coach: save one row of a trainee's plan straight to the server */
export async function saveTraineeRow(table: PlanTable, row: { id: string; user_id: string }) {
  const { error } = await sb().from(table).upsert(row)
  if (error) throw friendly(error, 'Could not save. Check the connection.')
}

export async function deleteTraineeRow(table: 'workouts' | 'workout_exercises', id: string) {
  const { error } = await sb().from(table).delete().eq('id', id)
  if (error) throw friendly(error, 'Could not remove. Check the connection.')
}

/* ------------------------------------------------- trainees without the app ("managed") */

/** coach: someone who will not use GymLog; you build their plan and log for them. Returns the link id. */
export async function createManagedTrainee(name: string): Promise<string> {
  const { data, error } = await sb().rpc('create_managed_trainee', { p_name: name.trim() })
  if (error) throw friendly(error, 'Could not add them. Check the connection.')
  return data as string
}

/** coach: remove a managed trainee and everything logged for them */
export async function deleteManagedTrainee(linkId: string) {
  const { error } = await sb().rpc('delete_managed_trainee', { p_link: linkId })
  if (error) throw friendly(error, 'Could not delete. Check the connection.')
}

/** coach: save a workout or weigh-in you logged for a managed trainee */
export async function saveForTrainee(table: 'sessions' | 'metrics', row: { id: string; user_id: string }) {
  const { error } = await sb().from(table).upsert(row)
  if (error) throw friendly(error, 'Could not save. Check the connection.')
}
