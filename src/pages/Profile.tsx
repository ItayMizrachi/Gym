import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, Flame, History, Moon, Scale } from 'lucide-react'
import { useStore } from '../lib/store'
import { Empty, PageHeader } from '../components/ui'
import { CalendarHeat } from '../components/CalendarHeat'
import { WeekBars } from '../components/WeekBars'
import {
  dayNames,
  fmtMinutes,
  fmtVolume,
  restDaysThisWeek,
  totals,
  trainingDays,
  weeklySeries,
  weeklyStreak,
  WeekMetric,
  WeekRange
} from '../lib/stats'
import '../styles/insights.css'
import '../styles/progress.css'

const METRICS: { id: WeekMetric; label: string }[] = [
  { id: 'duration', label: 'Duration' },
  { id: 'volume', label: 'Volume' },
  { id: 'reps', label: 'Reps' }
]
const RANGES: { id: WeekRange; label: string }[] = [
  { id: '4w', label: '4 weeks' },
  { id: '3m', label: '3 months' },
  { id: '1y', label: '1 year' }
]
const FORMAT: Record<WeekMetric, (v: number) => string> = {
  duration: (v) => fmtMinutes(Math.round(v)),
  volume: fmtVolume,
  reps: (v) => `${Math.round(v)} reps`
}

function hours(min: number): string {
  if (min < 60) return `${min} min`
  const h = min / 60
  return `${h < 10 ? Math.round(h * 10) / 10 : Math.round(h)} h`
}

export default function Profile() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const [metric, setMetric] = useState<WeekMetric>('duration')
  const [range, setRange] = useState<WeekRange>('3m')
  const calRef = useRef<HTMLDivElement>(null)

  const sum = useMemo(() => totals(db), [db])
  const series = useMemo(() => weeklySeries(db, metric, range), [db, metric, range])
  const days = useMemo(() => trainingDays(db), [db])
  const names = useMemo(() => dayNames(db), [db])
  const streak = useMemo(() => weeklyStreak(db), [db])
  const rest = useMemo(() => restDaysThisWeek(db), [db])

  const links = [
    { label: 'Exercises', icon: <BookOpen size={18} />, go: () => nav('/exercises') },
    { label: 'Body / measures', icon: <Scale size={18} />, go: () => nav('/body') },
    { label: 'Calendar', icon: <CalendarDays size={18} />, go: () => calRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    { label: 'History', icon: <History size={18} />, go: () => nav('/history') }
  ]

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader title="Progress" sub="Your training at a glance." />

      {sum.workouts === 0 ? (
        <Empty title="Nothing here yet" text="Finish your first workout and your weekly chart, totals and calendar show up here." />
      ) : (
        <>
          <div className="prof-totals">
            <div className="stat">
              <div className="v">{sum.workouts}</div>
              <div className="l">workout{sum.workouts === 1 ? '' : 's'}</div>
            </div>
            <div className="stat">
              <div className="v">{hours(sum.minutes)}</div>
              <div className="l">total time</div>
            </div>
            <div className="stat">
              <div className="v">{fmtVolume(sum.volume)}</div>
              <div className="l">lifted</div>
            </div>
          </div>

          <div className="card">
            <div className="prof-seg">
              <div className="seg" role="tablist" aria-label="What to show">
                {METRICS.map((m) => (
                  <button key={m.id} className={metric === m.id ? 'on' : ''} onClick={() => setMetric(m.id)} aria-pressed={metric === m.id}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="seg" role="tablist" aria-label="Time range">
                {RANGES.map((r) => (
                  <button key={r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)} aria-pressed={range === r.id}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <WeekBars values={series.map((w) => w.value)} starts={series.map((w) => w.start)} format={FORMAT[metric]} />
          </div>
        </>
      )}

      <div className="prof-links">
        {links.map((l) => (
          <button key={l.label} className="prof-link" onClick={l.go}>
            {l.icon}
            <span className="grow">{l.label}</span>
          </button>
        ))}
      </div>

      {sum.workouts > 0 && (
        <div className="card" ref={calRef} style={{ scrollMarginTop: 12 }}>
          <div className="prof-chips">
            <span className={`chip${streak.current > 0 ? ' ok' : ''}`}>
              <Flame size={13} /> {streak.current} week streak
            </span>
            <span className="chip">
              <Moon size={13} /> {rest} rest day{rest === 1 ? '' : 's'} this week
            </span>
          </div>
          <CalendarHeat days={days} names={names} onDay={(_, d) => nav(`/history/${d.sessionIds[d.sessionIds.length - 1]}`)} />
        </div>
      )}
    </div>
  )
}
