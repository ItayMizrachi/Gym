import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { sessionDate, sessionPRs } from '../lib/pr'
import { fmtDateLong, fmtDuration, fmtKg } from '../lib/format'
import { Confirm } from '../components/ui'

const KIND: Record<string, string> = { work: '', failure: 'F', drop: 'D', warmup: 'W' }

export default function SessionDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const fresh = (loc.state as any)?.fresh
  const db = useStore((s) => s.db)
  const remove = useStore((s) => s.remove)
  const [confirm, setConfirm] = useState(false)
  const s = db.sessions.find((x) => x.id === id)
  const prs = useMemo(() => (s ? sessionPRs(db, s) : []), [db, s])
  if (!s) return <div className="card">Session not found. <button className="btn sm" onClick={() => nav('/history')}>History</button></div>

  let sets = 0
  let volume = 0
  for (const e of s.data.exercises)
    for (const x of e.sets)
      if (x.done && x.kind !== 'warmup') {
        sets++
        volume += x.weight * (x.reps ?? 0)
      }
  const nameOf = (exId: string, fallback: string) => db.exercises.find((e) => e.id === exId)?.name ?? fallback

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <button className="btn icon ghost" onClick={() => nav(fresh ? '/history' : -1 as any)} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="grow">
          <h1 className="ellipsis">{fresh ? 'Workout complete' : s.name}</h1>
          <div className="sub">
            {s.name} · {fmtDateLong(sessionDate(s))}
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="v">{fmtDuration(s.started_at, s.finished_at)}</div>
          <div className="l">duration</div>
        </div>
        <div className="stat">
          <div className="v">{sets}</div>
          <div className="l">sets</div>
        </div>
        <div className="stat">
          <div className="v">{fmtKg(Math.round(volume))}</div>
          <div className="l">volume kg</div>
        </div>
      </div>

      {prs.length > 0 && (
        <div className="card" style={{ borderColor: '#8a6a14', background: '#2b2409' }}>
          <h2 style={{ color: 'var(--warn)' }}>🏆 {prs.length} personal record{prs.length > 1 ? 's' : ''}</h2>
          <div className="stack" style={{ gap: 4, marginTop: 8 }}>
            {prs.map((p, i) => (
              <div key={i} className="small">
                <b>{nameOf(p.exercise_id, '?')}</b> · {fmtKg(p.weight)} kg × {p.reps}{' '}
                <span className="muted">
                  ({p.types.map((t) => (t === 'weight' ? 'heaviest' : t === 'e1rm' ? 'est. 1RM' : 'reps')).join(', ')})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {s.data.exercises.map((e, i) => (
        <div key={i} className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{nameOf(e.exercise_id, e.name)}</div>
          <table className="t">
            <thead>
              <tr>
                <th>Set</th>
                <th>kg</th>
                <th>Reps</th>
              </tr>
            </thead>
            <tbody>
              {e.sets
                .filter((x) => x.done)
                .map((x, k) => (
                  <tr key={x.id}>
                    <td>{KIND[x.kind] || e.sets.filter((y) => y.done).slice(0, k + 1).filter((y) => y.kind === 'work').length}</td>
                    <td>{fmtKg(x.weight)}</td>
                    <td>{x.reps}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}

      {s.notes && (
        <div className="card">
          <div className="tiny muted">NOTES</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{s.notes}</div>
        </div>
      )}

      <button className="btn danger" onClick={() => setConfirm(true)}>
        <Trash2 size={16} /> Delete this workout
      </button>
      {confirm && (
        <Confirm
          title="Delete this workout from history?"
          text="Records are recalculated without it."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            remove('sessions', s.id)
            nav('/history')
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  )
}
