import type { DB, Workout } from './types'

/*
 * Weekly plan: each workout can be planned on days of the week (0 = Sunday … 6 = Saturday).
 * Home shows "Today's workout" when one is planned for today and not done yet.
 */

export const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Training days for N days a week, spread out with rest days in between (weeks start on Sunday). */
const SPREAD: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6]
}

export const spreadDays = (perWeek: number): number[] => SPREAD[Math.min(7, Math.max(1, Math.round(perWeek)))]

/**
 * Days for each workout of a weekly program: training days are spread over the week and handed out in
 * rotation, so PPL ×6 gives Push Sun + Wed, Pull Mon + Thu, Legs Tue + Fri.
 */
export function programDays(workoutCount: number, perWeek: number): number[][] {
  const out: number[][] = Array.from({ length: workoutCount }, () => [])
  if (!workoutCount) return out
  spreadDays(perWeek).forEach((d, k) => out[k % workoutCount].push(d))
  return out
}

/** "Upper A (Monday)" → [1]. Used for workouts named after their day, like the starter plan. */
export function daysFromName(name: string): number[] {
  const m = name.toLowerCase().match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*day\b/)
  if (!m) return []
  return [['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[1])]
}

export const plannedDays = (w: Pick<Workout, 'days'>): number[] => (w.days ?? []).filter((d) => d >= 0 && d <= 6)

/** The workout planned for today that has not been finished today, if any (first by position). */
export function todaysWorkout(db: DB, now = new Date()): Workout | null {
  const today = now.getDay()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const doneToday = new Set(
    db.sessions.filter((s) => s.finished_at && new Date(s.started_at) >= dayStart && s.workout_id).map((s) => s.workout_id)
  )
  const withEx = new Set(db.workout_exercises.map((x) => x.workout_id))
  return (
    [...db.workouts]
      .sort((a, b) => a.position - b.position)
      .find((w) => withEx.has(w.id) && plannedDays(w).includes(today) && !doneToday.has(w.id)) ?? null
  )
}

/** "Mon, Thu" for a workout's planned days, or '' when none. */
export const daysLabel = (days: number[]) =>
  [...days].sort((a, b) => a - b).map((d) => DAY_NAME[d].slice(0, 3)).join(', ')
