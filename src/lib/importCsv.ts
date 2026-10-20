import { EQUIPMENT, Exercise, Session, SessionExercise, SessionSet, SetKind } from './types'
import { uid, nowIso } from './uid'
import { LibraryExercise, bestLibraryMatch, exerciseFromLibrary } from './library'

/*
 * Import workout history exported from Hevy or Strong (CSV), so people can switch without losing their records.
 *   Hevy:   Profile → Settings → Export & import data → Export workouts
 *   Strong: Settings → Export strong data
 * Both files have one row per set; rows are grouped back into workouts and exercises here.
 */

export type Source = 'hevy' | 'strong'

export interface ImportedSet {
  kind: SetKind
  weight: number
  reps: number | null
  time_sec: number | null
  rpe: number | null
}
export interface ImportedExercise {
  name: string
  notes: string
  sets: ImportedSet[]
}
export interface ImportedWorkout {
  name: string
  start: Date
  end: Date | null
  notes: string
  exercises: ImportedExercise[]
}

/* ------------------------------------------------------------- CSV */

/** RFC 4180-ish: quotes, doubled quotes, newlines inside quotes; comma or semicolon. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const nl = src.indexOf('\n')
  const firstLine = nl < 0 ? src : src.slice(0, nl)
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else q = false
      } else cell += c
    } else if (c === '"') q = true
    else if (c === delim) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

/** "20 Oct 2026, 18:30" (Hevy), "2026-10-20 18:30:00" (Strong) or ISO. Local time. */
export function parseDate(s: string): Date | null {
  const t = s.trim()
  let m = t.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4}),? (\d{1,2}):(\d{2})/)
  if (m) return new Date(+m[3], MONTHS[m[2].toLowerCase()] ?? 0, +m[1], +m[4], +m[5])
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))
  const d = new Date(t)
  return isNaN(d.getTime()) ? null : d
}

/** Strong's "1h 5m" / "45m" / "3600" → seconds. */
export function parseDuration(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  if (/^\d+$/.test(t)) return +t
  const h = +(t.match(/(\d+)\s*h/)?.[1] ?? 0)
  const m = +(t.match(/(\d+)\s*m(?!s)/)?.[1] ?? 0)
  const sec = +(t.match(/(\d+)\s*s/)?.[1] ?? 0)
  const total = h * 3600 + m * 60 + sec
  return total || null
}

const num = (s: string | undefined) => {
  if (s == null) return null
  const v = parseFloat(s.replace(',', '.'))
  return isFinite(v) ? v : null
}

export interface ParseResult {
  source: Source
  workouts: ImportedWorkout[]
  /** true when weights were in pounds and converted */
  pounds: boolean
}

/** Read a Hevy or Strong export. `poundsHint` converts Strong weights (its file has no unit). */
export function parseExport(text: string, poundsHint = false): ParseResult {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('The file is empty.')
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const col = (...names: string[]) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')

  const hevy = head.includes('exercise_title') && head.includes('start_time')
  const strong = head.includes('exercise name') && head.includes('date')
  if (!hevy && !strong) throw new Error('This does not look like a Hevy or Strong export.')

  const LB = 0.45359237
  const byKey = new Map<string, ImportedWorkout>()
  const order: ImportedWorkout[] = []
  let pounds = false

  if (hevy) {
    const c = {
      title: col('title'), start: col('start_time'), end: col('end_time'), desc: col('description'),
      ex: col('exercise_title'), exNotes: col('exercise_notes'), type: col('set_type'),
      kg: col('weight_kg'), lbs: col('weight_lbs'), reps: col('reps'), dur: col('duration_seconds'), rpe: col('rpe')
    }
    pounds = c.kg < 0 && c.lbs >= 0
    for (const r of rows.slice(1)) {
      const start = parseDate(get(r, c.start))
      const exName = get(r, c.ex)
      if (!start || !exName) continue
      const key = `${get(r, c.title)}|${start.getTime()}`
      let w = byKey.get(key)
      if (!w) {
        w = { name: get(r, c.title) || 'Workout', start, end: parseDate(get(r, c.end)), notes: get(r, c.desc), exercises: [] }
        byKey.set(key, w)
        order.push(w)
      }
      let ex = w.exercises[w.exercises.length - 1]
      if (!ex || ex.name !== exName) {
        ex = { name: exName, notes: get(r, c.exNotes), sets: [] }
        w.exercises.push(ex)
      }
      const t = get(r, c.type).toLowerCase()
      const kind: SetKind = t.startsWith('warm') ? 'warmup' : t.startsWith('drop') ? 'drop' : t.startsWith('fail') ? 'failure' : 'work'
      const kg = c.kg >= 0 ? num(get(r, c.kg)) : (num(get(r, c.lbs)) ?? 0) * LB
      ex.sets.push({ kind, weight: round(kg ?? 0), reps: intOrNull(get(r, c.reps)), time_sec: intOrNull(get(r, c.dur)), rpe: num(get(r, c.rpe)) })
    }
  } else {
    const c = {
      date: col('date'), name: col('workout name'), dur: col('duration'), ex: col('exercise name'), order: col('set order'),
      weight: col('weight'), reps: col('reps'), secs: col('seconds'), notes: col('notes'), wNotes: col('workout notes'), rpe: col('rpe')
    }
    pounds = poundsHint
    for (const r of rows.slice(1)) {
      const start = parseDate(get(r, c.date))
      const exName = get(r, c.ex)
      if (!start || !exName) continue
      const key = `${get(r, c.name)}|${start.getTime()}`
      let w = byKey.get(key)
      if (!w) {
        const d = parseDuration(get(r, c.dur))
        w = { name: get(r, c.name) || 'Workout', start, end: d ? new Date(start.getTime() + d * 1000) : null, notes: get(r, c.wNotes), exercises: [] }
        byKey.set(key, w)
        order.push(w)
      }
      let ex = w.exercises[w.exercises.length - 1]
      if (!ex || ex.name !== exName) {
        ex = { name: exName, notes: get(r, c.notes), sets: [] }
        w.exercises.push(ex)
      }
      const o = get(r, c.order).toUpperCase()
      const kind: SetKind = o === 'W' ? 'warmup' : o === 'D' ? 'drop' : o === 'F' ? 'failure' : 'work'
      const wt = num(get(r, c.weight)) ?? 0
      ex.sets.push({ kind, weight: round(pounds ? wt * LB : wt), reps: intOrNull(get(r, c.reps)), time_sec: intOrNull(get(r, c.secs)), rpe: num(get(r, c.rpe)) })
    }
  }
  // drop empty rows (Strong writes rest timers as sets with nothing in them)
  for (const w of order) {
    for (const e of w.exercises) e.sets = e.sets.filter((s) => (s.reps ?? 0) > 0 || (s.time_sec ?? 0) > 0)
    w.exercises = w.exercises.filter((e) => e.sets.length)
  }
  const workouts = order.filter((w) => w.exercises.length).sort((a, b) => a.start.getTime() - b.start.getTime())
  return { source: hevy ? 'hevy' : 'strong', workouts, pounds }
}

const round = (kg: number) => Math.round(kg * 4) / 4
const intOrNull = (s: string) => {
  const v = num(s)
  return v == null || v <= 0 ? null : Math.round(v)
}

/* ------------------------------------------------------------- to GymLog rows */

const EQUIP_IN_NAME = new RegExp(`\\((${EQUIPMENT.join('|')})\\)`, 'i')

export interface ImportPlan {
  exercises: Exercise[]
  sessions: Session[]
  skipped: number
}

/**
 * Turn parsed workouts into new rows. Exercises are reused by name (case-insensitive), otherwise matched to the
 * library for a photo, muscle and equipment. Workouts already in GymLog (same name, same start minute) are skipped,
 * so importing the same file twice is harmless.
 */
export function planImport(
  parsed: ImportedWorkout[],
  userId: string,
  existing: { exercises: Exercise[]; sessions: Session[] },
  library: LibraryExercise[]
): ImportPlan {
  const byName = new Map(existing.exercises.map((e) => [e.name.trim().toLowerCase(), e]))
  const seen = new Set(existing.sessions.map((s) => `${s.name.trim().toLowerCase()}|${Math.floor(new Date(s.started_at).getTime() / 60000)}`))
  const created: Exercise[] = []
  const sessions: Session[] = []
  let skipped = 0

  const exerciseFor = (name: string): Exercise => {
    const k = name.trim().toLowerCase()
    const have = byName.get(k)
    if (have) return have
    const m = bestLibraryMatch(library, { name })
    let ex: Exercise
    if (m) ex = { ...exerciseFromLibrary(m.lib, userId), name: name.trim() }
    else
      ex = {
        id: uid(), user_id: userId, name: name.trim(), muscle: 'Other', notes: '', setup: '', image_path: null,
        rest_sec: 90, created_at: nowIso(), equipment: name.match(EQUIP_IN_NAME)?.[1] ?? '', tracking: 'weight_reps'
      }
    byName.set(k, ex)
    created.push(ex)
    return ex
  }

  for (const w of parsed) {
    const key = `${w.name.trim().toLowerCase()}|${Math.floor(w.start.getTime() / 60000)}`
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    const doneAt = (w.end ?? w.start).toISOString()
    const exercises: SessionExercise[] = w.exercises.map((ie) => {
      const ex = exerciseFor(ie.name)
      const timed = ie.sets.every((s) => !s.reps && s.time_sec)
      if (timed && ex.tracking !== 'time' && created.includes(ex)) ex.tracking = 'time'
      const sets: SessionSet[] = ie.sets.map((s) => ({
        id: uid(), kind: s.kind, weight: s.weight, reps: s.reps, done: true, done_at: doneAt,
        ...(s.time_sec ? { time_sec: s.time_sec } : {}), ...(s.rpe ? { rpe: s.rpe } : {})
      }))
      const reps = ie.sets.map((s) => s.reps ?? 0).filter(Boolean)
      return {
        exercise_id: ex.id, name: ex.name, rest_sec: ex.rest_sec, superset: '', note: ie.notes,
        rep_min: reps.length ? Math.min(...reps) : 0, rep_max: reps.length ? Math.max(...reps) : 0, sets
      }
    })
    sessions.push({
      id: uid(), user_id: userId, workout_id: null, name: w.name, started_at: w.start.toISOString(),
      finished_at: doneAt, notes: w.notes, data: { exercises }
    })
  }
  return { exercises: created, sessions, skipped }
}
