import type { Session } from './types'

const workDone = (sets: Session['data']['exercises'][number]['sets']) => sets.filter((x) => x.done && x.kind !== 'warmup').length
const hasTodo = (sets: Session['data']['exercises'][number]['sets']) => sets.some((x) => !x.done && x.kind !== 'warmup')

/**
 * After logging a set on exercise `index`: the next exercise of the same superset that is behind in this round
 * (fewer logged sets) and still has sets to do, in order and wrapping around. null = the round is complete, rest now.
 */
export function nextInSuperset(session: Session, index: number): number | null {
  const list = session.data.exercises
  const label = list[index]?.superset
  if (!label) return null
  const group = list.map((e, i) => (e.superset === label ? i : -1)).filter((i) => i >= 0)
  if (group.length < 2) return null
  const mine = workDone(list[index].sets)
  const at = group.indexOf(index)
  for (let k = 1; k < group.length; k++) {
    const j = group[(at + k) % group.length]
    if (workDone(list[j].sets) < mine && hasTodo(list[j].sets)) return j
  }
  return null
}

/*
 * Supersets by pairing, not by letters: "Superset with…" → pick the other exercise, and both share a group.
 * Letters (A, B, C…) are handed out here and never typed by the lifter.
 */

type Item = { superset: string }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** Drop groups that are left with a single exercise (a superset of one is no superset). */
function tidy<T extends Item>(list: T[]): T[] {
  const count = new Map<string, number>()
  for (const x of list) if (x.superset) count.set(x.superset, (count.get(x.superset) ?? 0) + 1)
  return list.map((x) => (x.superset && count.get(x.superset)! < 2 ? { ...x, superset: '' } : x))
}

/** Put exercise `i` in a superset with exercise `j` (joining j's group if it has one). */
export function linkSuperset<T extends Item>(list: T[], i: number, j: number): T[] {
  if (i === j || !list[i] || !list[j]) return list
  const used = new Set(list.map((x) => x.superset).filter(Boolean))
  const letter = list[j].superset || (list[i].superset && list.filter((x) => x.superset === list[i].superset).length > 1 ? list[i].superset : '') || LETTERS.find((l) => !used.has(l)) || 'Z'
  return tidy(list.map((x, k) => (k === i || k === j ? { ...x, superset: letter } : x)))
}

/** Take exercise `i` out of its superset (its partner, if left alone, is no longer in one either). */
export const unlinkSuperset = <T extends Item>(list: T[], i: number): T[] => tidy(list.map((x, k) => (k === i ? { ...x, superset: '' } : x)))

/** Indexes of the other exercises in i's superset. */
export const partnersOf = (list: Item[], i: number): number[] =>
  list[i]?.superset ? list.map((x, k) => (k !== i && x.superset === list[i].superset ? k : -1)).filter((k) => k >= 0) : []
