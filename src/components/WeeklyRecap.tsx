import { useMemo, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { Trophy, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { dismissRecap, recapDismissed, weeklyRecap } from '../lib/recap'
import { fmtVolume } from '../lib/stats'
import { fmtKg } from '../lib/format'

/** Train tab, first two days of a week: last week in one card. Tap for Progress, X to hide it until next week. */
export function WeeklyRecap() {
  const db = useStore((s) => s.db)
  const nav = useNavigate()
  const r = useMemo(() => weeklyRecap(db), [db])
  const [hidden, setHidden] = useState(() => (r ? recapDismissed(r.week) : true))
  if (!r || hidden) return null
  const best = r.best ? db.exercises.find((e) => e.id === r.best!.exerciseId)?.name : null
  return (
    <section className="card recap" aria-label={tr("Last week")}>
      <button className="recap-main" onClick={() => nav('/profile')}>
        <span className="recap-t">{tr("Last week")}</span>
        <span className="recap-nums">
          <span>
            <b>{r.workouts}</b> {r.workouts === 1 ? 'workout' : 'workouts'}
          </span>
          <span>
            <b>{r.sets}</b> sets
          </span>
          {r.volume > 0 && (
            <span>
              <b>{fmtVolume(r.volume)}</b>
              {r.volumeChange != null && r.volumeChange !== 0 && <span className={r.volumeChange > 0 ? 'up' : 'down'}> {r.volumeChange > 0 ? '+' : ''}{r.volumeChange}%</span>}
            </span>
          )}
        </span>
        {r.records > 0 && (
          <span className="recap-pr">
            <Trophy size={14} aria-hidden /> {r.records} {r.records === 1 ? 'record' : 'records'}
            {best && r.best && ` · ${best} ${fmtKg(r.best.weight)} kg × ${r.best.reps}`}
          </span>
        )}
      </button>
      <button
        className="btn icon ghost recap-x"
        aria-label={tr("Hide until next week")}
        onClick={() => {
          dismissRecap(r.week)
          setHidden(true)
        }}
      >
        <X size={18} aria-hidden />
      </button>
    </section>
  )
}
