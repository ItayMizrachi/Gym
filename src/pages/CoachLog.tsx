import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Plus, Trash2 } from 'lucide-react'
import { saveForTrainee } from '../lib/coach'
import { useTraineeData } from '../lib/coachData'
import { useStore } from '../lib/store'
import { Session, SessionExercise, trackingOf } from '../lib/types'
import { buildSessionExercise, newSet } from '../lib/actions'
import { nowIso, uid } from '../lib/uid'
import { fmtKg } from '../lib/format'
import { t as tr } from '../lib/i18n'
import { PageHeader } from '../components/ui'
import '../styles/coach.css'

const num = (v: string) => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Coach: log a workout for a trainee who does not use the app. The plan's exercises come pre-filled from their
 * last time; tick the sets they did, then Save. Simple on purpose: one screen, nothing to set up.
 */
export default function CoachLog() {
  const { id, wid } = useParams()
  const nav = useNavigate()
  const toast = useStore((s) => s.toast)
  const { link, db, error, reload } = useTraineeData(id)
  const [list, setList] = useState<SessionExercise[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [started] = useState(nowIso)
  const workout = db?.workouts.find((w) => w.id === wid) ?? null

  // start from the plan once the trainee's data is here
  useEffect(() => {
    if (!db || list) return
    const rows = db.workout_exercises.filter((r) => r.workout_id === wid).sort((a, b) => a.position - b.position)
    const out: SessionExercise[] = []
    for (const r of rows) {
      const ex = db.exercises.find((e) => e.id === r.exercise_id)
      if (ex) out.push(buildSessionExercise(db, ex, r))
    }
    setList(out)
  }, [db, wid, list])

  const done = useMemo(() => list?.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0) ?? 0, [list])

  function patch(i: number, j: number, p: Partial<SessionExercise['sets'][number]>) {
    setList((l) => l && l.map((e, a) => (a !== i ? e : { ...e, sets: e.sets.map((x, b) => (b !== j ? x : { ...x, ...p })) })))
  }

  async function save() {
    if (!list || !link?.trainee_id || busy) return
    const exercises = list.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })).filter((e) => e.sets.length)
    if (!exercises.length) return toast({ kind: 'info', text: 'No sets ticked' })
    setBusy(true)
    const session: Session = {
      id: uid(),
      user_id: link.trainee_id,
      workout_id: workout?.id ?? null,
      name: workout?.name ?? 'Workout',
      started_at: started,
      finished_at: nowIso(),
      notes: '',
      data: { exercises }
    }
    try {
      await saveForTrainee('sessions', session)
      await reload()
      toast({ kind: 'info', text: tr('Workout saved for {name}', { name: link.name }) })
      nav(`/coach/${id}/s/${session.id}`, { replace: true })
    } catch (e) {
      toast({ kind: 'error', text: (e as Error).message })
      setBusy(false)
    }
  }

  if (error)
    return (
      <div className="stack coach" style={{ gap: 16 }}>
        <PageHeader title={tr('Log a workout')} back={`/coach/${id}`} />
        <div className="card small muted">{error}</div>
      </div>
    )
  if (!db || !link || !list) return <div className="card small muted">{tr('Loading')}…</div>

  return (
    <div className="stack coach" style={{ gap: 14 }}>
      <PageHeader title={workout?.name ?? tr('Workout')} sub={tr('Logging for {name}', { name: link.name })} back={`/coach/${id}`} />

      {list.map((e, i) => {
        const timed = trackingOf(db.exercises.find((x) => x.id === e.exercise_id)) === 'time'
        return (
          <section key={i} className="card stack coach-log-ex" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <div className="title ellipsis">{e.name}</div>
              <span className="tiny muted">{e.rep_min && e.rep_max ? tr('{a}–{b} reps', { a: e.rep_min, b: e.rep_max }) : ''}</span>
            </div>
            <div className="coach-log-head tiny muted" aria-hidden>
              <span>{tr('Set')}</span>
              <span>{timed ? tr('Seconds') : tr('kg')}</span>
              <span>{timed ? '' : tr('Reps')}</span>
              <span />
            </div>
            {e.sets.map((x, j) => (
              <div key={x.id} className={`coach-log-row${x.done ? ' done' : ''}`}>
                <span className="coach-log-n">{x.kind === 'warmup' ? 'W' : j + 1 - e.sets.slice(0, j).filter((y) => y.kind === 'warmup').length}</span>
                {timed ? (
                  <input
                    className="input"
                    inputMode="numeric"
                    aria-label={tr('Seconds')}
                    value={x.time_sec ?? ''}
                    onChange={(ev) => patch(i, j, { time_sec: num(ev.target.value) })}
                  />
                ) : (
                  <input
                    className="input"
                    inputMode="decimal"
                    aria-label={tr('kg')}
                    value={x.weight ? fmtKg(x.weight) : ''}
                    placeholder="0"
                    onChange={(ev) => patch(i, j, { weight: num(ev.target.value) ?? 0 })}
                  />
                )}
                {timed ? (
                  <span />
                ) : (
                  <input
                    className="input"
                    inputMode="numeric"
                    aria-label={tr('Reps')}
                    value={x.reps ?? ''}
                    placeholder={e.rep_min ? String(e.rep_min) : ''}
                    onChange={(ev) => patch(i, j, { reps: num(ev.target.value) })}
                  />
                )}
                <button
                  className="check"
                  aria-label={x.done ? tr('Undo set') : tr('Log set')}
                  onClick={() =>
                    patch(i, j, {
                      done: !x.done,
                      done_at: x.done ? null : nowIso(),
                      // an empty reps box logs the planned bottom of the range, like the live workout
                      ...(!x.done && !timed && x.reps == null && e.rep_min ? { reps: e.rep_min } : {})
                    })
                  }
                >
                  <Check size={18} />
                </button>
              </div>
            ))}
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn sm grow"
                onClick={() =>
                  setList((l) => l && l.map((y, a) => (a !== i ? y : { ...y, sets: [...y.sets, newSet('work', y.sets[y.sets.length - 1]?.weight ?? 0)] })))
                }
              >
                <Plus size={16} aria-hidden /> {tr('Add set')}
              </button>
              {e.sets.length > 1 && (
                <button
                  className="btn sm icon ghost"
                  aria-label={tr('Remove set')}
                  onClick={() => setList((l) => l && l.map((y, a) => (a !== i ? y : { ...y, sets: y.sets.slice(0, -1) })))}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </div>
          </section>
        )
      })}

      {list.length === 0 && <div className="small muted">{tr('No exercises yet.')}</div>}
      <button className="btn primary block" disabled={busy || done === 0} onClick={() => void save()}>
        <Check size={18} aria-hidden /> {tr('Save workout ({n} sets)', { n: done })}
      </button>
    </div>
  )
}
