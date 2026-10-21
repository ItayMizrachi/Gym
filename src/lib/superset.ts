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
