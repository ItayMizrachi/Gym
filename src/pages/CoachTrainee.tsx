import { useMemo, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { COACH_FOLDER, assignWorkout, removeTrainee, saveTraineeRow, unassignWorkout } from '../lib/coach'
import { forgetTrainee, useTraineeData } from '../lib/coachData'
import { nowIso, uid } from '../lib/uid'
import { Workout } from '../lib/types'
import { useStore } from '../lib/store'
import { compareWeeks, weeklyTrend, finishedSessions, fmtVolume, latestBodyWeight, prSetIds, relativeDay, summarizeSession, weeklyStreak } from '../lib/stats'
import { fmtKg } from '../lib/format'
import { Confirm, PageHeader, Sheet } from '../components/ui'
import '../styles/coach.css'

/** One trainee: how their training is going, their plan, and workouts to add to it. */
export default function CoachTrainee() {
  const { id } = useParams()
  const nav = useNavigate()
  const mine = useStore((s) => s.db)
  const toast = useStore((s) => s.toast)
  const { link, db, error, reload } = useTraineeData(id)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null)
  const [ending, setEnding] = useState(false)

  const load = reload
  /** an empty workout in the trainee's plan, opened in the editor */
  async function newWorkout() {
    if (!link?.trainee_id || !db) return
    const w: Workout = {
      id: uid(),
      user_id: link.trainee_id,
      name: 'New workout',
      notes: '',
      position: db.workouts.reduce((m, x) => Math.max(m, x.position), -1) + 1,
      created_at: nowIso(),
      folder: COACH_FOLDER
    }
    try {
      await saveTraineeRow('workouts', w)
      await reload()
      nav(`/coach/${id}/w/${w.id}`)
    } catch (e) {
      toast({ kind: 'error', text: (e as Error).message })
    }
  }

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
      trend: weeklyTrend(db),
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
            {tr("Try again")}
          </button>
        </div>
      ) : !view || !link ? (
        <div className="card small muted">Loading…</div>
      ) : (
        <>
          <div className="coach-stats">
            <div>
              <div className="coach-n">{view.week.workouts}</div>
              <div className="tiny muted">{tr("This week")}</div>
            </div>
            <div>
              <div className="coach-n">{view.last ? relativeDay(view.last.finished_at ?? view.last.started_at) : '–'}</div>
              <div className="tiny muted">{tr("Last workout")}</div>
            </div>
            <div>
              <div className="coach-n">{view.streak.current}</div>
              <div className="tiny muted">{tr("Week streak")}</div>
            </div>
            {view.weight != null && (
              <div>
                <div className="coach-n">{fmtKg(view.weight)}</div>
                <div className="tiny muted">{tr("Body kg")}</div>
              </div>
            )}
          </div>

          <Trend weeks={view.trend} />

          <section className="stack" style={{ gap: 8 }} aria-label={tr("Plan")}>
            <h2 className="coach-h2">{tr("Plan")}</h2>
            {view.plan.length > 0 && (
              <div className="list-group">
                {view.plan.map((w) => {
                  const n = db!.workout_exercises.filter((r) => r.workout_id === w.id).length
                  const fromYou = w.folder === COACH_FOLDER
                  return (
                    <div key={w.id} className="list-row">
                      <button className="grow coach-rowbtn" style={{ minWidth: 0 }} onClick={() => nav(`/coach/${id}/w/${w.id}`)}>
                        <span className="title ellipsis" style={{ display: 'block' }}>
                          {w.name}
                        </span>
                        <span className="meta">
                          {n} {n === 1 ? 'exercise' : 'exercises'}
                          {fromYou ? ' · from you' : ''}
                        </span>
                      </button>
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
            <div className="row" style={{ gap: 8 }}>
              <button className="btn primary grow" onClick={() => void newWorkout()}>
                <Plus size={18} aria-hidden /> {tr("New workout")}
              </button>
              <button className="btn grow" onClick={() => setPicking(true)}>
                <Copy size={18} aria-hidden /> {tr("Copy one of mine")}
              </button>
            </div>
          </section>

          <section className="stack" style={{ gap: 8 }} aria-label={tr("Recent workouts")}>
            <h2 className="coach-h2">{tr("Recent workouts")}</h2>
            {view.recent.length === 0 ? (
              <div className="small muted">{tr("No finished workouts yet.")}</div>
            ) : (
              <div className="list-group">
                {view.recent.map(({ s, sum, prs }) => (
                  <button key={s.id} className="list-row" onClick={() => nav(`/coach/${id}/s/${s.id}`)}>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="title ellipsis" style={{ display: 'block' }}>
                        {s.name}
                      </span>
                      <span className="meta">
                        {relativeDay(s.finished_at ?? s.started_at)} · {sum.sets} sets{sum.volume > 0 ? ` · ${fmtVolume(sum.volume)}` : ''}
                      </span>
                    </span>
                    {prs > 0 && <span className="coach-pr">{prs} PR</span>}
                    <ChevronRight size={18} aria-hidden />
                  </button>
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
        <Sheet title={tr("Copy one of your workouts")} onClose={() => setPicking(false)}>
          <div className="stack" style={{ gap: 8 }}>
            <div className="small muted">Pick one of your workouts. It is copied into {link?.name}'s plan, in "{COACH_FOLDER}". Build new ones on your Train tab first.</div>
            {myWorkouts.length === 0 ? (
              <button className="btn block" onClick={() => nav('/')}>
                {tr("Go to Train")}
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
          text={tr("It leaves their plan. Workouts they already did stay in their history.")}
          confirmLabel={tr("Remove")}
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
          text={tr("You will no longer see their training. Workouts you added stay in their plan.")}
          confirmLabel={tr("Stop coaching")}
          danger
          onClose={() => setEnding(false)}
          onConfirm={async () => {
            setEnding(false)
            try {
              await removeTrainee(link)
              forgetTrainee(link.id)
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

/** weekly volume for the last 8 weeks (sets when nothing was lifted with weight) */
function Trend({ weeks }: { weeks: { start: Date; volume: number; sets: number; workouts: number }[] }) {
  const useVol = weeks.some((w) => w.volume > 0)
  const val = (w: (typeof weeks)[number]) => (useVol ? w.volume : w.sets)
  const max = Math.max(1, ...weeks.map(val))
  if (!weeks.some((w) => w.workouts > 0)) return null
  const label = weeks.map((w) => `${w.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${useVol ? fmtVolume(w.volume) : `${w.sets} sets`}`).join(', ')
  return (
    <section className="card stack" style={{ gap: 6 }} aria-label={`${useVol ? 'Volume' : 'Sets'} per week. ${label}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="small">{useVol ? 'Volume per week' : 'Sets per week'}</span>
        <span className="tiny muted">8 weeks</span>
      </div>
      <div className="coach-trend" aria-hidden>
        {weeks.map((w, i) => (
          <div key={i}>
            <span className={`bar${val(w) === 0 ? ' zero' : ''}${i === weeks.length - 1 ? ' now' : ''}`} style={{ height: `${Math.round((val(w) / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="coach-trend-axis tiny muted" aria-hidden>
        <span>{weeks[0].start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        <span>{tr("This week")}</span>
      </div>
    </section>
  )
}
