import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Clock, Layers, Trophy, Weight } from 'lucide-react'
import { useStore } from '../lib/store'
import { sessionDate, sessionPRs } from '../lib/pr'
import { Session } from '../lib/types'
import { Empty, Thumb } from '../components/ui'
import { SparkBars } from '../components/Sparkline'
import { finishedSessions, fmtMinutes, fmtVolume, summarizeSession, SessionSummary, weeklyTrend } from '../lib/stats'
import { splitName } from '../lib/format'
import '../styles/insights.css'

interface Item {
  s: Session
  m: SessionSummary
  prs: number
}

export default function HistoryPage() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const [filter, setFilter] = useState<string>('all')

  const all = useMemo<Item[]>(
    () =>
      finishedSessions(db)
        .reverse()
        .map((s) => ({ s, m: summarizeSession(s), prs: sessionPRs(db, s).length })),
    [db]
  )

  // templates that actually appear in history, in plan order; "Other" for empty / deleted templates
  const templates = useMemo(() => {
    const used = new Set(all.map((i) => i.s.workout_id ?? ''))
    const known = [...db.workouts].sort((a, b) => a.position - b.position).filter((w) => used.has(w.id))
    const other = all.some((i) => !i.s.workout_id || !db.workouts.some((w) => w.id === i.s.workout_id))
    return { known, other }
  }, [all, db.workouts])

  const items = useMemo(
    () =>
      all.filter((i) => {
        if (filter === 'all') return true
        if (filter === 'other') return !i.s.workout_id || !db.workouts.some((w) => w.id === i.s.workout_id)
        return i.s.workout_id === filter
      }),
    [all, filter, db.workouts]
  )

  const months = useMemo(() => {
    const out: { key: string; label: string; items: Item[]; volume: number }[] = []
    for (const i of items) {
      const d = new Date(sessionDate(i.s))
      const key = `${d.getFullYear()}-${d.getMonth()}`
      let g = out[out.length - 1]
      if (!g || g.key !== key) {
        const sameYear = d.getFullYear() === new Date().getFullYear()
        g = { key, label: d.toLocaleDateString('en-GB', { month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }), items: [], volume: 0 }
        out.push(g)
      }
      g.items.push(i)
      g.volume += i.m.volume
    }
    return out
  }, [items])

  const trend = useMemo(() => weeklyTrend(db), [db])
  const thisWeek = trend[trend.length - 1].volume
  const avg = trend.slice(0, -1).reduce((a, w) => a + w.volume, 0) / Math.max(1, trend.length - 1)
  const totalPrs = all.reduce((a, i) => a + i.prs, 0)

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <div className="grow">
          <h1>History</h1>
          {all.length > 0 && (
            <div className="sub">
              {all.length} workout{all.length === 1 ? '' : 's'}
              {totalPrs > 0 && ` · ${totalPrs} record${totalPrs === 1 ? '' : 's'}`}
            </div>
          )}
        </div>
      </div>
      {all.length === 0 ? (
        <Empty title="No finished workouts yet" text="Complete a workout and it shows up here, with your volume and records." />
      ) : (
        <>
          <div className="card trend-card">
            <div className="trend-top">
              <div className="grow">
                <div className="small muted">Volume this week</div>
                <div className="trend-v">{fmtVolume(thisWeek)}</div>
              </div>
              {avg > 0 && (
                <div className="small muted" style={{ textAlign: 'right' }}>
                  Weekly average
                  <div style={{ color: 'var(--text)', fontWeight: 600 }}>{fmtVolume(avg)}</div>
                </div>
              )}
            </div>
            <SparkBars values={trend.map((w) => w.volume)} labels={['8 weeks ago', 'This week']} />
          </div>

          {(templates.known.length > 1 || (templates.known.length > 0 && templates.other)) && (
            <div className="chips" role="tablist" aria-label="Filter by workout">
              <button className={`chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
                All
              </button>
              {templates.known.map((w) => (
                <button key={w.id} className={`chip${filter === w.id ? ' active' : ''}`} onClick={() => setFilter(w.id)}>
                  {splitName(w.name)[0]}
                </button>
              ))}
              {templates.other && (
                <button className={`chip${filter === 'other' ? ' active' : ''}`} onClick={() => setFilter('other')}>
                  Other
                </button>
              )}
            </div>
          )}

          <div>
            {months.map((g) => (
              <section key={g.key}>
                <div className="month-head">
                  <h2>{g.label}</h2>
                  <span className="small muted">
                    {g.items.length} workout{g.items.length === 1 ? '' : 's'} · {fmtVolume(g.volume)}
                  </span>
                </div>
                {g.items.map(({ s, m, prs }) => {
                  const d = new Date(sessionDate(s))
                  return (
                    <button key={s.id} className="hrow" onClick={() => nav(`/history/${s.id}`)}>
                      <div className="hdate">
                        <div className="d">{d.getDate()}</div>
                        <div className="w">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                      </div>
                      <div className="grow">
                        <div className="hname ellipsis">{splitName(s.name)[0]}</div>
                        <div className="hmeta">
                          <span>
                            <Clock size={13} /> {fmtMinutes(m.minutes)}
                          </span>
                          <span>
                            <Layers size={13} /> {m.sets} {m.sets === 1 ? 'set' : 'sets'}
                          </span>
                          <span>
                            <Weight size={13} /> {fmtVolume(m.volume)}
                          </span>
                        </div>
                      </div>
                      {s.data.photo_path && <Thumb path={s.data.photo_path} size={44} />}
                      {prs > 0 && (
                        <span className="chip pr">
                          <Trophy size={12} /> {prs}
                        </span>
                      )}
                      <ChevronRight size={18} className="muted" />
                    </button>
                  )
                })}
              </section>
            ))}
            {items.length === 0 && <div className="card small muted">No workouts of this type yet.</div>}
          </div>
        </>
      )}
    </div>
  )
}
