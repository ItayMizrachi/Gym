import type { Session } from './types'

/**
 * What the rest bar and the rest-over alert point to: the next set of this exercise, else the next
 * exercise with sets left (in a superset round, the first of the group), else anything left.
 */
export function nextSetLabel(session: Session, index: number): string {
  const exs = session.data.exercises
  const open = (i: number) => exs[i]?.sets.findIndex((x) => !x.done) ?? -1
  const group = exs[index]?.superset
  const order = [
    ...(group ? exs.map((e, i) => (e.superset === group ? i : -1)).filter((i) => i >= 0) : [index]),
    ...exs.map((_, i) => i).filter((i) => i > index),
    ...exs.map((_, i) => i).filter((i) => i < index)
  ]
  for (const i of order) {
    const k = open(i)
    if (k >= 0) return `${exs[i].name} · Set ${k + 1} of ${exs[i].sets.length}`
  }
  return 'All sets logged'
}
