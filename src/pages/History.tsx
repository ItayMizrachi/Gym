import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  // filters by workout name ("Push", "Legs"…), so imported history groups as well as plan workouts.
  // Names done at least twice get a chip, most frequent first; the rest share "Other".
  const keyOf = (i: Item) => splitName(i.s.name)[0].trim().toLowerCase()
  const names = useMemo(() => {
    const count = new Map<string, { label: string; n: number }>()
    for (const i of all) {
      const k = keyOf(i)
      const c = count.get(k)
      if (c) c.n++
      else count.set(k, { label: splitName(i.s.name)[0], n: 1 })
    }
    const chips = [...count.entries()].filter(([, c]) => c.n >= 2).sort((x, y) => y[1].n - x[1].n).slice(0, 8)
    const shown = new Set(chips.map(([k]) => k))
    return { chips, shown, other: all.some((i) => !shown.has(keyOf(i))) }
  }, [all])

  const items = useMemo(
    () =>
      all.filter((i) => {
        if (filter === 'all') return true
        if (filter === 'other') return !names.shown.has(keyOf(i))
        return keyOf(i) === filter
      }),
    [all, filter, names]
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

          {names.chips.length + (names.other ? 1 : 0) > 1 && (
            <div className="chips" role="tablist" aria-label="Filter by workout">
              <button className={`chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
                All
              </button>
              {names.chips.map(([k, c]) => (
                <button key={k} className={`chip${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>
                  {c.label}
                </button>
              ))}
              {names.other && (
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
                <div className="hlist">
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
                          {fmtMinutes(m.minutes)} · {fmtVolume(m.volume)}
                        </div>
                      </div>
                      {s.data.photo_path && <Thumb path={s.data.photo_path} size={44} />}
                      {/* records: one small mark, the count is in the workout itself */}
                      {prs > 0 && <span className="hpr-dot" aria-label={`${prs} new record${prs === 1 ? '' : 's'}`} />}
                    </button>
                  )
                })}
                </div>
              </section>
            ))}
            {items.length === 0 && <div className="card small muted">No workouts of this type yet.</div>}
          </div>
        </>
      )}
    </div>
  )
}
