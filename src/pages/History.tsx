import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { sessionDate, sessionPRs } from '../lib/pr'
import { Session } from '../lib/types'
import { Empty, Sheet, Thumb } from '../components/ui'
import { finishedSessions, fmtMinutes, fmtVolume, startOfWeek, summarizeSession, SessionSummary, weeklyTrend } from '../lib/stats'
import { splitName } from '../lib/format'
import '../styles/insights.css'

interface Item {
  s: Session
  m: SessionSummary
  prs: number
}

interface Week {
  key: string
  start: Date
  items: Item[]
  volume: number
}

/** "This week", "12–18 Oct", "28 Sept–4 Oct" */
function weekLabel(start: Date): string {
  if (start.getTime() === startOfWeek(new Date()).getTime()) return 'This week'
  const end = new Date(start.getTime() + 6 * 86400000)
  const sameMonth = start.getMonth() === end.getMonth()
  const f = (d: Date, month: boolean) => d.toLocaleDateString('en-GB', { day: 'numeric', ...(month ? { month: 'short' } : {}) })
  return `${f(start, !sameMonth)}–${f(end, true)}`
}

/**
 * History, one line per week: the list stays short however much you train. The newest week is open; tap any
 * week to see its workouts. Filtering to one kind of workout (Push, Legs…) shows them one per line instead.
 */
export default function HistoryPage() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const [filter, setFilter] = useState<string>('all')
  const [picking, setPicking] = useState(false)
  // weeks opened or closed by hand; the newest week starts open
  const [toggled, setToggled] = useState<Set<string>>(new Set())

  const all = useMemo<Item[]>(
    () =>
      finishedSessions(db)
        .reverse()
        .map((s) => ({ s, m: summarizeSession(s), prs: sessionPRs(db, s).length })),
    [db]
  )

  // filters by workout name ("Push", "Legs"…), so imported history groups as well as plan workouts.
  // Names done at least twice get an entry, most frequent first; the rest share "Other".
  // Prefixed so a workout called "Other" or "All" cannot clash with those two filters.
  const keyOf = (i: Item) => 'n:' + splitName(i.s.name)[0].trim().toLowerCase()
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

  /** month → week → workouts. A week sits in the month it starts in. */
  const months = useMemo(() => {
    const out: { key: string; label: string; weeks: Week[]; items: Item[] }[] = []
    for (const i of items) {
      const ws = startOfWeek(new Date(sessionDate(i.s)))
      const mKey = `${ws.getFullYear()}-${ws.getMonth()}`
      let g = out[out.length - 1]
      if (!g || g.key !== mKey) {
        const sameYear = ws.getFullYear() === new Date().getFullYear()
        g = { key: mKey, label: ws.toLocaleDateString('en-GB', { month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }), weeks: [], items: [] }
        out.push(g)
      }
      g.items.push(i)
      const wKey = `${ws.getFullYear()}-${ws.getMonth()}-${ws.getDate()}`
      let w = g.weeks[g.weeks.length - 1]
      if (!w || w.key !== wKey) {
        w = { key: wKey, start: ws, items: [], volume: 0 }
        g.weeks.push(w)
      }
      w.items.push(i)
      w.volume += i.m.volume
    }
    return out
  }, [items])

  const newestWeek = months[0]?.weeks[0]?.key
  const isOpen = (k: string) => (k === newestWeek) !== toggled.has(k)
  const flip = (k: string) =>
    setToggled((t) => {
      const n = new Set(t)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const trend = useMemo(() => weeklyTrend(db), [db])
  const thisWeek = trend[trend.length - 1].volume
  const avg = trend.slice(0, -1).reduce((a, w) => a + w.volume, 0) / Math.max(1, trend.length - 1)
  const canFilter = names.chips.length + (names.other ? 1 : 0) > 1
  const filterLabel = filter === 'all' ? null : filter === 'other' ? 'Other' : names.chips.find(([k]) => k === filter)?.[1].label
  const options: [string, string][] = [['all', 'All workouts'], ...names.chips.map(([k, c]): [string, string] => [k, c.label]), ...(names.other ? [['other', 'Other'] as [string, string]] : [])]

  const row = ({ s, m }: Item) => {
    const d = new Date(sessionDate(s))
    return (
      <button key={s.id} className="hrow" onClick={() => nav(`/history/${s.id}`)}>
        <div className="hdate">
          <div className="d">{d.getDate()}</div>
          <div className="w">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="hname ellipsis">{splitName(s.name)[0]}</div>
          <div className="hmeta">
            {fmtMinutes(m.minutes)} · {m.volume > 0 ? fmtVolume(m.volume) : `${m.sets} ${m.sets === 1 ? 'set' : 'sets'}`}
          </div>
        </div>
        {s.data.photo_path && <Thumb path={s.data.photo_path} size={36} />}
      </button>
    )
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <div className="grow">
          <h1>History</h1>
          {all.length > 0 && (
            <div className="sub">
              {all.length} workout{all.length === 1 ? '' : 's'} · this week {fmtVolume(thisWeek)}
              {avg > 0 && ` · avg ${fmtVolume(avg)}`}
            </div>
          )}
        </div>
        {canFilter && (
          <button className={`btn icon${filter !== 'all' ? ' primary' : ''}`} onClick={() => setPicking(true)} aria-label="Filter by workout">
            <SlidersHorizontal size={20} aria-hidden />
          </button>
        )}
      </div>

      {filterLabel && (
        <button className="hist-filter" onClick={() => setFilter('all')} aria-label={`Showing ${filterLabel} only. Show all`}>
          {filterLabel} <X size={14} aria-hidden />
        </button>
      )}

      {all.length === 0 ? (
        <Empty title="No finished workouts yet" text="Complete a workout and it shows up here, with your volume and records." />
      ) : (
        <div>
          {months.map((g) => (
            <section key={g.key}>
              <div className="month-head">
                <h2>{g.label}</h2>
              </div>
              {filter !== 'all' ? (
                // one kind of workout: a plain list, most weeks have one of it anyway
                <div className="hlist">{g.items.map(row)}</div>
              ) : (
                <div className="hlist">
                  {g.weeks.map((w) => {
                    const open = isOpen(w.key)
                    return (
                      <div key={w.key} className={`hweek${open ? ' open' : ''}`}>
                        <button className="hweek-head" aria-expanded={open} onClick={() => flip(w.key)}>
                          <span className="grow" style={{ minWidth: 0 }}>
                            <span className="hweek-t">
                              {weekLabel(w.start)}
                              <span className="hweek-n">
                                {' '}
                                · {w.items.length} workout{w.items.length === 1 ? '' : 's'}
                                {w.volume > 0 && ` · ${fmtVolume(w.volume)}`}
                              </span>
                            </span>
                            {!open && (
                              <span className="hweek-names ellipsis">
                                {[...w.items]
                                  .reverse()
                                  .map((i) => splitName(i.s.name)[0])
                                  .join(' · ')}
                              </span>
                            )}
                          </span>
                          <ChevronDown size={18} aria-hidden className="hweek-caret" />
                        </button>
                        {open && <div className="hweek-list">{w.items.map(row)}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          ))}
          {items.length === 0 && <div className="card small muted">No workouts of this type yet.</div>}
        </div>
      )}

      {picking && (
        <Sheet title="Show workouts" onClose={() => setPicking(false)}>
          <div className="kind-list" role="radiogroup" aria-label="Filter by workout">
            {options.map(([k, label]) => (
              <button
                key={k}
                role="radio"
                aria-checked={filter === k}
                className={`kind-opt${filter === k ? ' on' : ''}`}
                onClick={() => {
                  setFilter(k)
                  setPicking(false)
                }}
              >
                <span className="grow kind-opt-t">{label}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}
