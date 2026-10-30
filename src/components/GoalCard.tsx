import { useMemo, useState } from 'react'
import { lang, t as tr } from '../lib/i18n'
import { Target } from 'lucide-react'
import { Goal, goalView, removeGoal, setGoal, useGoals } from '../lib/goals'
import { HistoryPoint, exerciseHistory } from '../lib/pr'
import { fmtKg, fmtDate } from '../lib/format'
import { Sheet } from './ui'

const short = (d: Date | string) => new Date(d).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })

/** Exercise page: a weight goal, how close you are, and when the trend gets you there. */
export function GoalCard({ exerciseId, hist }: { exerciseId: string; hist: HistoryPoint[] }) {
  const goal = useGoals().find((g) => g.exerciseId === exerciseId)
  const [editing, setEditing] = useState(false)
  const view = useMemo(() => (goal ? goalView(goal, hist) : null), [goal, hist])

  return (
    <>
      {goal && view ? (
        <section className="card stack xgoal" style={{ gap: 8 }} aria-label={tr("Goal")}>
          <div className="goal-head">
            <div className="goal-name">
              <Target size={18} aria-hidden />
              <span className="goal-t ellipsis">
                {fmtKg(goal.weight)} kg × {goal.reps}
                {goal.by && <span className="muted"> · {tr('by {d}', { d: fmtDate(goal.by) })}</span>}
              </span>
            </div>
            <button className="btn sm ghost" onClick={() => setEditing(true)}>
              {tr("Edit")}
            </button>
          </div>
          <div className="goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.pct * 100)} aria-label={tr("Of the way to your goal")}>
            <span style={{ width: `${Math.round(view.pct * 100)}%` }} className={view.reached ? 'done' : undefined} />
          </div>
          <div className="small muted">
            {view.current === 0
              ? tr('Log this exercise in a workout to start tracking it.')
              : view.reached
              ? tr('Reached. Time for a new goal?')
              : view.eta
              ? tr(view.onTrack === false ? '{p}% there · at this pace around {d}, later than planned' : '{p}% there · at this pace around {d}', { p: Math.round(view.pct * 100), d: short(view.eta) })
              : tr('{p}% there · log a few more workouts to see when you get there', { p: Math.round(view.pct * 100) })}
          </div>
        </section>
      ) : (
        <button className="btn block goal-add" onClick={() => setEditing(true)}>
          <Target size={18} aria-hidden /> {tr("Set a goal")}
        </button>
      )}
      {editing && <GoalSheet exerciseId={exerciseId} goal={goal} onClose={() => setEditing(false)} />}
    </>
  )
}

function GoalSheet({ exerciseId, goal, onClose }: { exerciseId: string; goal?: Goal; onClose: () => void }) {
  const [weight, setWeight] = useState(goal ? String(goal.weight) : '')
  const [reps, setReps] = useState(goal ? String(goal.reps) : '1')
  const [by, setBy] = useState(goal?.by ?? '')
  const w = parseFloat(weight.replace(',', '.'))
  const r = parseInt(reps, 10)
  const ok = w > 0 && w < 1000 && r > 0 && r <= 30
  return (
    <Sheet title={tr(goal ? 'Your goal' : 'Set a goal')} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (!ok) return
          setGoal({ exerciseId, weight: w, reps: r, by: by || undefined, created: goal?.created ?? new Date().toISOString() })
          onClose()
        }}
      >
        <div className="row" style={{ gap: 8 }}>
          <label className="field grow">
            {tr("Weight (kg)")}
            <input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="100" autoFocus />
          </label>
          <label className="field grow">
            {tr("Reps")}
            <input className="input" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, ''))} />
          </label>
        </div>
        <label className="field">
          {tr("By (optional)")}
          <input className="input" type="date" value={by} onChange={(e) => setBy(e.target.value)} />
        </label>
        <button className="btn primary block" type="submit" disabled={!ok}>
          {tr("Save goal")}
        </button>
        {goal && (
          <button
            type="button"
            className="btn ghost block"
            style={{ color: 'var(--danger-text)' }}
            onClick={() => {
              removeGoal(exerciseId)
              onClose()
            }}
          >
            {tr("Remove goal")}
          </button>
        )}
      </form>
    </Sheet>
  )
}

/** Progress page: every goal in one quiet list (nothing when there are none). Tap one for its exercise. */
export function GoalsList({ db, onOpen }: { db: import('../lib/types').DB; onOpen: (exerciseId: string) => void }) {
  const goals = useGoals()
  const rows = useMemo(
    () =>
      goals
        .map((g) => ({ g, ex: db.exercises.find((e) => e.id === g.exerciseId), v: goalView(g, exerciseHistory(db, g.exerciseId)) }))
        .filter((r) => r.ex),
    [goals, db]
  )
  if (!rows.length) return null
  return (
    <section className="stack" style={{ gap: 8 }} aria-label={tr('Goals')}>
      <h2>{tr('Goals')}</h2>
      <div className="list-group">
        {rows.map(({ g, ex, v }) => (
          <button key={g.exerciseId} className="list-row goal-row" onClick={() => onOpen(g.exerciseId)}>
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="title ellipsis" style={{ display: 'block' }}>
                {ex!.name}
              </span>
              <span className="goal-bar" aria-hidden>
                <span style={{ width: `${Math.round(v.pct * 100)}%` }} className={v.reached ? 'done' : undefined} />
              </span>
              <span className="meta" style={{ display: 'block' }}>
                {fmtKg(g.weight)} kg × {g.reps} ·{' '}
                {v.reached ? tr('Reached') : v.eta ? tr('around {d}', { d: short(v.eta) }) : tr('{p}% there', { p: Math.round(v.pct * 100) })}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
