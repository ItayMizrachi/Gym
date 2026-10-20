import { Gear, Level, Program, WEEKLIES, SINGLES, gearOf } from './programs'

/** Answers from the "Find my program" questions. */
export interface Answers {
  goal: 'muscle' | 'strength' | 'fit' | 'glutes'
  level: Level
  days: number
  gear: Gear
}

export const GOAL_LABEL: Record<Answers['goal'], string> = {
  muscle: 'Build muscle',
  strength: 'Get stronger',
  fit: 'Get fit and healthy',
  glutes: 'Glutes and legs'
}

/** Which program goals count as a match for each answer (first = best). */
const GOAL_FIT: Record<Answers['goal'], string[]> = {
  muscle: ['Build muscle', 'Muscle and strength'],
  strength: ['Get stronger', 'Muscle and strength'],
  fit: ['Stay fit', 'Stay fit at home', 'Learn the basics', 'Fitness'],
  glutes: ['Glutes']
}

const LEVEL_RANK: Record<Level, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 }

/** Can someone with `have` equipment do a program that needs `need`? */
export function gearOk(have: Gear, need: Gear): boolean {
  if (have === 'gym') return true
  if (have === 'home') return need !== 'gym'
  return need === 'none'
}

/** Higher is better. Exported for tests. */
export function score(p: Program, a: Answers): number {
  if (!gearOk(a.gear, gearOf(p))) return -Infinity
  let s = 0
  const fit = GOAL_FIT[a.goal].indexOf(p.goal)
  s += fit === 0 ? 30 : fit > 0 ? 20 : 0
  const lv = LEVEL_RANK[p.level] - LEVEL_RANK[a.level]
  s -= lv > 0 ? lv * 25 : -lv * 8 // a program above your level is worse than one a bit below it
  s -= Math.abs(p.days - a.days) * 9
  if (p.days > a.days) s -= 6 // more days than you have is worse than fewer
  if (a.level === 'Beginner' && p.id === 'beginner-full-body') s += 4 // the gentlest first program
  return s
}

export interface Recommendation {
  best: Program
  others: Program[]
}

/** Best weekly program for the answers, plus up to two alternatives. Falls back to single workouts. */
export function recommend(a: Answers): Recommendation {
  const rank = (list: Program[]) =>
    list
      .map((p) => ({ p, s: score(p, a) }))
      .filter((x) => x.s > -Infinity)
      .sort((x, y) => y.s - x.s)
      .map((x) => x.p)
  let list = rank(WEEKLIES)
  if (!list.length) list = rank(SINGLES) // e.g. no equipment at all: no weekly plan fits yet
  return { best: list[0], others: list.slice(1, 3) }
}
