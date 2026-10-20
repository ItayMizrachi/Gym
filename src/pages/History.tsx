import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { sessionDate, sessionPRs } from '../lib/pr'
import { fmtDateLong, fmtDuration, fmtKg } from '../lib/format'
import { Empty } from '../components/ui'

export default function HistoryPage() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)

  const items = useMemo(
    () =>
      db.sessions
        .filter((s) => s.finished_at)
        .sort((a, b) => (sessionDate(b) > sessionDate(a) ? 1 : -1))
        .map((s) => {
          let sets = 0
          let volume = 0
          for (const e of s.data.exercises)
            for (const x of e.sets)
              if (x.done && x.kind !== 'warmup') {
                sets++
                volume += x.weight * (x.reps ?? 0)
              }
          return { s, sets, volume, prs: sessionPRs(db, s).length }
        }),
    [db]
  )

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <h1>History</h1>
      </div>
      {items.length === 0 ? (
        <Empty title="No finished workouts yet" text="Complete a workout and it shows up here." />
      ) : (
        <div>
          {items.map(({ s, sets, volume, prs }) => (
            <button key={s.id} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav(`/history/${s.id}`)}>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div className="small muted">
                  {fmtDateLong(sessionDate(s))} · {fmtDuration(s.started_at, s.finished_at)}
                </div>
                <div className="small muted">
                  {s.data.exercises.length} exercises · {sets} sets · {fmtKg(Math.round(volume))} kg
                </div>
              </div>
              {prs > 0 && <span className="chip pr">🏆 {prs}</span>}
              <ChevronRight size={18} className="muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
