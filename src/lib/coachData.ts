import { useCallback, useEffect, useState } from 'react'
import { CoachLink, listTrainees, loadTrainee } from './coach'
import { DB } from './types'
import { finishedSessions, prSetIds } from './stats'
import { sessionDate } from './pr'

/*
 * A trainee's link and training, shared by the coach screens (trainee, workout, plan editor) so moving between
 * them does not download everything again. `reload` fetches fresh data after an edit.
 */

const cache = new Map<string, { link: CoachLink; db: DB }>()

export function useTraineeData(linkId: string | undefined) {
  const [state, setState] = useState(() => (linkId ? cache.get(linkId) ?? null : null))
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!linkId) return
    try {
      const link = (await listTrainees()).find((x) => x.id === linkId && x.status === 'active')
      if (!link?.trainee_id) throw new Error('This trainee is no longer connected.')
      const db = await loadTrainee(link.trainee_id)
      const next = { link, db }
      cache.set(linkId, next)
      setState(next)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [linkId])

  useEffect(() => {
    // show the cached copy at once, refresh in the background
    void reload()
  }, [reload])

  /** apply a local change straight away (the server write happens separately) */
  const patch = useCallback(
    (fn: (db: DB) => DB) => {
      if (!linkId) return
      setState((s) => {
        if (!s) return s
        const next = { ...s, db: fn(s.db) }
        cache.set(linkId, next)
        return next
      })
    },
    [linkId]
  )

  return { link: state?.link ?? null, db: state?.db ?? null, error, reload, patch }
}

export function forgetTrainee(linkId: string) {
  cache.delete(linkId)
}

/** what a coach needs at a glance: days since the last workout, records in the last 7 days */
export interface TraineeGlance {
  daysSince: number | null
  newPRs: number
}
const DAY = 86400000
export function glance(db: DB, now = Date.now()): TraineeGlance {
  const done = finishedSessions(db)
  const last = done[done.length - 1]
  const daysSince = last ? Math.floor((now - new Date(sessionDate(last)).getTime()) / DAY) : null
  let newPRs = 0
  for (const s of done) if (now - new Date(sessionDate(s)).getTime() <= 7 * DAY) newPRs += prSetIds(db, s).size
  return { daysSince, newPRs }
}

/** load every active trainee for the list (also fills the cache the trainee screen uses) */
export async function prefetchTrainees(links: CoachLink[]): Promise<Map<string, TraineeGlance>> {
  const out = new Map<string, TraineeGlance>()
  await Promise.all(
    links
      .filter((l) => l.status === 'active' && l.trainee_id)
      .map(async (l) => {
        try {
          const db = await loadTrainee(l.trainee_id!)
          cache.set(l.id, { link: l, db })
          out.set(l.id, glance(db))
        } catch {
          /* shown without a status line */
        }
      })
  )
  return out
}
