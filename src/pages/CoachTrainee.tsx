import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { COACH_FOLDER, CoachLink, assignWorkout, listTrainees, loadTrainee, removeTrainee, unassignWorkout } from '../lib/coach'
import { useStore } from '../lib/store'
import { DB } from '../lib/types'
import { compareWeeks, finishedSessions, fmtVolume, latestBodyWeight, prSetIds, relativeDay, summarizeSession, weeklyStreak } from '../lib/stats'
import { fmtKg } from '../lib/format'
import { Confirm, PageHeader, Sheet } from '../components/ui'
import '../styles/coach.css'

/** One trainee: how their training is going, their plan, and workouts to add to it. */
export default function CoachTrainee() {
  const { id } = useParams()
  const nav = useNavigate()
  const mine = useStore((s) => s.db)
  const toast = useStore((s) => s.toast)
  const [link, setLink] = useState<CoachLink | null>(null)
  const [db, setDb] = useState<DB | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null)
  const [ending, setEnding] = useState(false)

  async function load() {
    try {
      const l = (await listTrainees()).find((x) => x.id === id && x.status === 'active')
      if (!l?.trainee_id) throw new Error('This trainee is no longer connected.')
      setLink(l)
      setDb(await loadTrainee(l.trainee_id))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    void load()
  }, [id])

  const view = useMemo(() => {
    if (!db) return null
    const done = finishedSessions(db).reverse()
    const weeks = compareWeeks(db)
    return {
      recent: done.slice(0, 8).map((s) => ({ s, sum: summarizeSession(s), prs: prSetIds(db, s).size })),
      last: done[0] ?? null,
      week: weeks.thisWeek,
      streak: weeklyStreak(db),
      weight: latestBodyWeight(db),
      plan: [...db.workouts].sort((a, b) => a.position - b.position)
    }
  }, [db])

  const myWorkouts = [...mine.workouts].sort((a, b) => a.position - b.position)

  return (
    <div className="stack coach" style={{ gap: 16 }}>
      <PageHeader title={link?.name ?? 'Trainee'} sub={link?.trainee_email ?? undefined} back="/coach" />
      {error ? (
        <div className="card stack">
          <div className="small muted">{error}</div>
          <button className="btn" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : !view || !link ? (
        <div className="card small muted">Loading…</div>
      ) : (
        <>
          <div className="coach-stats">
            <div>
              <div className="coach-n">{view.week.workouts}</div>
              <div className="tiny muted">This week</div>
            </div>
            <div>
              <div className="coach-n">{view.last ? relativeDay(view.last.finished_at ?? view.last.started_at) : '–'}</div>
              <div className="tiny muted">Last workout</div>
            </div>
            <div>
              <div className="coach-n">{view.streak.current}</div>
              <div className="tiny muted">Week streak</div>
            </div>
            {view.weight != null && (
              <div>
                <div className="coach-n">{fmtKg(view.weight)}</div>
                <div className="tiny muted">Body kg</div>
              </div>
            )}
          </div>

          <section className="stack" style={{ gap: 8 }} aria-label="Plan">
            <h2 className="coach-h2">Plan</h2>
            {view.plan.length > 0 && (
              <div className="list-group">
                {view.plan.map((w) => {
                  const n = db!.workout_exercises.filter((r) => r.workout_id === w.id).length
                  const fromYou = w.folder === COACH_FOLDER
                  return (
                    <div key={w.id} className="list-row">
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="title ellipsis" style={{ display: 'block' }}>
                          {w.name}
                        </span>
                        <span className="meta">
                          {n} {n === 1 ? 'exercise' : 'exercises'}
                          {fromYou ? ' · from you' : ''}
                        </span>
                      </span>
                      {fromYou && (
                        <button className="btn icon ghost" aria-label={`Remove ${w.name} from the plan`} onClick={() => setRemoving({ id: w.id, name: w.name })}>
                          <Trash2 size={18} aria-hidden />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <button className="btn primary block" onClick={() => setPicking(true)}>
              <Plus size={18} aria-hidden /> Add a workout
            </button>
          </section>

          <section className="stack" style={{ gap: 8 }} aria-label="Recent workouts">
            <h2 className="coach-h2">Recent workouts</h2>
            {view.recent.length === 0 ? (
              <div className="small muted">No finished workouts yet.</div>
            ) : (
              <div className="list-group">
                {view.recent.map(({ s, sum, prs }) => (
                  <div key={s.id} className="list-row">
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="title ellipsis" style={{ display: 'block' }}>
                        {s.name}
                      </span>
                      <span className="meta">
                        {relativeDay(s.finished_at ?? s.started_at)} · {sum.sets} sets{sum.volume > 0 ? ` · ${fmtVolume(sum.volume)}` : ''}
                      </span>
                    </span>
                    {prs > 0 && <span className="coach-pr">{prs} PR</span>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <button className="btn ghost block" style={{ color: 'var(--danger-text)' }} onClick={() => setEnding(true)}>
            Stop coaching {link.name}
          </button>
        </>
      )}

      {picking && (
        <Sheet title="Add a workout" onClose={() => setPicking(false)}>
          <div className="stack" style={{ gap: 8 }}>
            <div className="small muted">Pick one of your workouts. It is copied into {link?.name}'s plan, in "{COACH_FOLDER}". Build new ones on your Train tab first.</div>
            {myWorkouts.length === 0 ? (
              <button className="btn block" onClick={() => nav('/')}>
                Go to Train
              </button>
            ) : (
              <div className="list-group">
                {myWorkouts.map((w) => (
                  <button
                    key={w.id}
                    className="list-row"
                    disabled={busy != null}
                    onClick={async () => {
                      if (!link?.trainee_id || !db) return
                      setBusy(w.id)
                      try {
                        await assignWorkout(link.trainee_id, db, mine, w.id)
                        setPicking(false)
                        toast({ kind: 'info', text: `${w.name} added`, sub: `${link.name} sees it on their Train tab.` })
                        await load()
                      } catch (e) {
                        toast({ kind: 'error', text: (e as Error).message })
                      } finally {
                        setBusy(null)
                      }
                    }}
                  >
                    <span className="grow title ellipsis">{w.name}</span>
                    <span className="meta">{busy === w.id ? 'Adding…' : `${mine.workout_exercises.filter((r) => r.workout_id === w.id).length} ex`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Sheet>
      )}
      {removing && (
        <Confirm
          title={`Remove ${removing.name}?`}
          text="It leaves their plan. Workouts they already did stay in their history."
          confirmLabel="Remove"
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            const r = removing
            setRemoving(null)
            try {
              await unassignWorkout(r.id)
              await load()
            } catch (e) {
              toast({ kind: 'error', text: (e as Error).message })
            }
          }}
        />
      )}
      {ending && link && (
        <Confirm
          title={`Stop coaching ${link.name}?`}
          text="You will no longer see their training. Workouts you added stay in their plan."
          confirmLabel="Stop coaching"
          danger
          onClose={() => setEnding(false)}
          onConfirm={async () => {
            setEnding(false)
            try {
              await removeTrainee(link)
              nav('/coach', { replace: true })
            } catch (e) {
              toast({ kind: 'error', text: (e as Error).message })
            }
          }}
        />
      )}
    </div>
  )
}
