import { SessionSet, Tracking } from './types'
import { fmtKg } from './format'

/** 75 -> "1:15". Hours roll into minutes ("75:00") since sets are never that long in practice. */
export function fmtTime(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return ''
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "1:15" -> 75, "45" -> 45 (plain number = seconds), "1:" -> 60, "" -> null, junk -> null */
export function parseTime(input: string): number | null {
  const t = input.trim().replace(/[.,]/g, ':')
  if (!t) return null
  if (!/^\d*(:\d{0,2})?$/.test(t)) return null
  if (!t.includes(':')) return parseInt(t, 10)
  const [m, s] = t.split(':')
  const sec = (parseInt(m || '0', 10) || 0) * 60 + (parseInt(s || '0', 10) || 0)
  return sec
}

/** What a set still needs before it can be ticked, or null when it is ready to log. */
export function missingForLog(s: Pick<SessionSet, 'reps' | 'time_sec'>, tracking: Tracking): string | null {
  if (tracking === 'time') return s.time_sec != null && s.time_sec > 0 ? null : 'time'
  return s.reps != null && s.reps > 0 ? null : 'reps'
}

/** Compact set label, e.g. "60×8", "W 12", "1:30". The prefix marks warm-up / drop / failure sets. */
export function setLabel(s: SessionSet, tracking: Tracking, withKind = true): string {
  const p = !withKind ? '' : s.kind === 'drop' ? 'D ' : s.kind === 'warmup' ? 'W ' : s.kind === 'failure' ? 'F ' : ''
  // a set logged as a time set (or on an exercise now tracked by time) reads as a duration
  if (tracking === 'time' || (s.time_sec != null && s.reps == null)) return `${p}${fmtTime(s.time_sec) || '–'}`
  const reps = s.reps ?? '–'
  if (tracking === 'reps' && !(s.weight > 0)) return `${p}${reps} reps`
  return `${p}${fmtKg(s.weight)}×${reps}${s.rpe != null ? ` @${fmtKg(s.rpe)}` : ''}`
}

/** Short "Prev" column text for one earlier set. */
export function prevLabel(s: SessionSet | undefined, tracking: Tracking): string {
  if (!s) return '–'
  if (tracking === 'time') return s.time_sec ? fmtTime(s.time_sec) : '–'
  if (s.reps == null) return '–'
  if (tracking === 'reps') return s.weight > 0 ? `+${fmtKg(s.weight)}×${s.reps}` : `${s.reps}`
  return `${fmtKg(s.weight)}×${s.reps}`
}

/** kg moved in one set. Time sets and unlogged sets move nothing. */
export const setVolume = (s: Pick<SessionSet, 'weight' | 'reps' | 'done'>) => (s.done && s.reps ? s.weight * s.reps : 0)

export const TRACKING_LABEL: Record<Tracking, string> = {
  weight_reps: 'Weight & reps',
  reps: 'Reps only',
  time: 'Time'
}
