import { useMemo, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { sessionDate, sessionPRs } from '../lib/pr'
import { Session } from '../lib/types'
import { Empty, Sheet, Thumb } from '../components/ui'
import { finishedSessions, fmtMinutes, fmtVolume, summarizeSession, SessionSummary, weeklyTrend } from '../lib/stats'
import { splitName } from '../lib/format'
import '../styles/insights.css'

interface Item {
  s: Session
  m: SessionSummary
  prs: number
}

/**
 * History kept short: this month shows its last three workouts (the rest one tap away), every month before it
 * is one card you open. Filtering to one kind of workout (Push, Legs…) works the same way.
 */
export default function HistoryPage() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const [filter, setFilter] = useState<string>('all')
  const [picking, setPicking] = useState(false)
  // months opened by hand (and "the rest of this month")
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

  /** workouts by calendar month, newest first */
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
  const now = new Date()
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`

  // everything starts folded; a tap opens a month (or the rest of this month)
  const isOpen = (k: string) => toggled.has(k)
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
          <h1>{tr("History")}</h1>
          {all.length > 0 && (
            <div className="sub">
              {tr(all.length === 1 ? '{n} workout' : '{n} workouts', { n: all.length })} · {tr('this week {v}', { v: fmtVolume(thisWeek) })}
              {avg > 0 && ` · avg ${fmtVolume(avg)}`}
            </div>
          )}
        </div>
        {canFilter && (
          <button className={`btn icon${filter !== 'all' ? ' primary' : ''}`} onClick={() => setPicking(true)} aria-label={tr("Filter by workout")}>
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
        <Empty title={tr("No finished workouts yet")} text={tr("Complete a workout and it shows up here, with your volume and records.")} />
      ) : (
        <div>
          {months.map((g, idx) => (
            <section key={g.key}>
              {idx === 0 && g.key === thisMonthKey && (
                <div className="month-head">
                  <h2>{g.label}</h2>
                </div>
              )}
              {idx === 1 || (idx === 0 && g.key !== thisMonthKey) ? (
                <div className="month-head">
                  <h2>{tr("Earlier")}</h2>
                </div>
              ) : null}
              {(() => {
                const current = idx === 0 && g.key === thisMonthKey
                const open = isOpen(g.key)
                if (current) {
                  // this month: the last three workouts, the rest one tap away
                  const shown = open ? g.items : g.items.slice(0, 3)
                  return (
                    <div className="hlist">
                      {shown.map(row)}
                      {g.items.length > 3 && (
                        <button
                          className="hmore"
                          aria-expanded={open}
                          onClick={(e) => {
                            const list = e.currentTarget.closest('.hlist')
                            flip(g.key)
                            if (open) requestAnimationFrame(() => list?.scrollIntoView({ block: 'nearest' }))
                          }}
                        >
                          {open ? 'Show less' : `${g.items.length - 3} more this month`}
                          <ChevronDown size={18} aria-hidden className={`hweek-caret${open ? ' up' : ''}`} />
                        </button>
                      )}
                    </div>
                  )
                }
                // a month that is over: one card, its workouts inside
                return (
                  <div className={`hlist hmonth${open ? ' open' : ''}`}>
                    <button className="hweek-head" aria-expanded={open} onClick={() => flip(g.key)}>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="hweek-t">
                          {g.label}
                          <span className="hweek-n">
                            {' '}
                            · {g.items.length} workout{g.items.length === 1 ? '' : 's'}
                            {g.volume > 0 && ` · ${fmtVolume(g.volume)}`}
                          </span>
                        </span>
                      </span>
                      <ChevronDown size={18} aria-hidden className={`hweek-caret${open ? ' up' : ''}`} />
                    </button>
                    {open && (
                      <div className="hweek-list">
                        {g.items.map(row)}
                        {/* close again from the bottom, then bring the folded card back into view */}
                        <button
                          className="hmore"
                          aria-expanded
                          onClick={(e) => {
                            const card = e.currentTarget.closest('.hmonth')
                            flip(g.key)
                            requestAnimationFrame(() => card?.scrollIntoView({ block: 'nearest' }))
                          }}
                        >
                          {tr("Show less")}
                          <ChevronDown size={18} aria-hidden className="hweek-caret up" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()}
            </section>
          ))}
          {items.length === 0 && <div className="card small muted">{tr("No workouts of this type yet.")}</div>}
        </div>
      )}

      {picking && (
        <Sheet title={tr("Show workouts")} onClose={() => setPicking(false)}>
          <div className="kind-list" role="radiogroup" aria-label={tr("Filter by workout")}>
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
