import { plateaus } from '../lib/plateau'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, Flame, Moon, Trophy } from 'lucide-react'
import { useStore } from '../lib/store'
import { Empty, PageHeader } from '../components/ui'
import { CalendarHeat } from '../components/CalendarHeat'
import { WeekBars } from '../components/WeekBars'
import { GoalRing, GoalSheet } from '../components/GoalRing'
import { AchievementsSection, useAchievementToasts } from '../components/Achievements'
import { usePrefs } from '../lib/prefs'
import { goalWeeksInRow, weekGoal } from '../lib/achievements'
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
import '../styles/records.css'

const METRICS: { id: WeekMetric; label: string }[] = [
  { id: 'duration', label: 'Duration' },
  { id: 'volume', label: 'Volume' },
  { id: 'reps', label: 'Reps' }
]
const RANGES: { id: WeekRange; label: string; short: string }[] = [
  { id: '4w', label: 'Last 4 weeks', short: '4w' },
  { id: '3m', label: 'Last 3 months', short: '3m' },
  { id: '1y', label: 'Last year', short: '1y' }
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
  const stalled = useMemo(() => plateaus(db), [db])
  const [metric, setMetric] = useState<WeekMetric>('duration')
  const [range, setRange] = useState<WeekRange>('3m')
  const calRef = useRef<HTMLDivElement>(null)

  const sum = useMemo(() => totals(db), [db])
  const series = useMemo(() => weeklySeries(db, metric, range), [db, metric, range])
  const days = useMemo(() => trainingDays(db), [db])
  const names = useMemo(() => dayNames(db), [db])
  const streak = useMemo(() => weeklyStreak(db), [db])
  const rest = useMemo(() => restDaysThisWeek(db), [db])
  const goal = usePrefs((s) => s.weeklyGoal)
  const week = useMemo(() => weekGoal(db, goal), [db, goal])
  const inRow = useMemo(() => goalWeeksInRow(db, goal), [db, goal])
  const [editGoal, setEditGoal] = useState(false)
  useAchievementToasts()


  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Progress" sub="Your training at a glance." />

      {sum.workouts === 0 ? (
        <Empty title="Nothing here yet" text="Finish your first workout and your weekly chart, totals and calendar show up here." />
      ) : (
        <>
          <div className="card hv-card">
            <div className="hv-stats three">
              <div>
                <div className="hv-l">Workouts</div>
                <div className="hv-v">{sum.workouts}</div>
              </div>
              <div>
                <div className="hv-l">Total time</div>
                <div className="hv-v">{hours(sum.minutes)}</div>
              </div>
              <div>
                <div className="hv-l">Volume</div>
                <div className="hv-v">{fmtVolume(sum.volume)}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="prof-seg">
              <div className="seg block" role="tablist" aria-label="What to show">
                {METRICS.map((m) => (
                  <button key={m.id} className={metric === m.id ? 'on' : ''} onClick={() => setMetric(m.id)} aria-pressed={metric === m.id}>
                    {m.label}
                  </button>
                ))}
              </div>
              {/* the range is secondary: a small control on its own line, not a second full-width bar */}
              <div className="prof-range">
                <span className="small muted">{RANGES.find((r) => r.id === range)?.label}</span>
                <div className="seg sm" role="tablist" aria-label="Time range">
                  {RANGES.map((r) => (
                    <button key={r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)} aria-pressed={range === r.id} aria-label={r.label}>
                      {r.short}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <WeekBars values={series.map((w) => w.value)} starts={series.map((w) => w.start)} format={FORMAT[metric]} />
          </div>
        </>
      )}

      <button className="list-group list-row rec-link" onClick={() => nav('/records')}>
        <Trophy size={22} aria-hidden className="accent-ico" />
        <span className="grow">
          <span className="title">Records</span>
          <span className="meta" style={{ display: 'block' }}>
            Best lifts for every exercise
          </span>
        </span>
        <ChevronRight size={18} aria-hidden className="muted" />
      </button>

      {stalled.length > 0 && (
        <section className="card stack" aria-label="Stalled lifts" style={{ gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 'var(--fs-md)' }}>Stalled lifts</h2>
            <div className="small muted">No new best for a few sessions. That's normal; a change usually gets it moving again.</div>
          </div>
          {stalled.slice(0, 3).map((p) => (
            <button key={p.exerciseId} className="stall-row" onClick={() => nav(`/exercise/${p.exerciseId}`)}>
              <span className="grow">
                <span className="stall-name">{p.name}</span>
                <span className="small muted" style={{ display: 'block' }}>
                  {p.sessions} sessions since your best (est. 1-rep max {Math.round(p.best)} kg)
                </span>
              </span>
              <ChevronRight size={18} aria-hidden className="muted" />
            </button>
          ))}
          <div className="small" style={{ color: 'var(--text-2)' }}>
            Try one easier week at about 90% of your usual weights, or switch the rep range (for example 5–8 instead of 8–12)
            for a few weeks.
          </div>
        </section>
      )}

      <section className="card goal-streak" aria-label="Weekly goal">
        <GoalRing done={week.done} goal={week.goal} size={56} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="goal-title">
            {inRow > 0 ? `${inRow} week${inRow === 1 ? '' : 's'} in a row` : 'Weekly goal'}
          </div>
          <div className="small muted">
            {week.done >= week.goal ? `Goal met: ${week.done} workouts this week` : `${week.done} of ${week.goal} workouts this week`}
          </div>
        </div>
        <button className="btn sm secondary" onClick={() => setEditGoal(true)} aria-label="Change weekly goal">
          Change
        </button>
      </section>
      {editGoal && <GoalSheet onClose={() => setEditGoal(false)} />}

      <AchievementsSection />

      {/* Body and History are tabs and the calendar is right below: only the exercise list needs a way in */}
      <button className="list-group list-row rec-link" onClick={() => nav('/exercises')}>
        <BookOpen size={22} aria-hidden className="muted" />
        <span className="grow">
          <span className="title">Exercises</span>
          <span className="meta" style={{ display: 'block' }}>
            Your list, photos, setup notes and records per exercise
          </span>
        </span>
        <ChevronRight size={18} aria-hidden className="muted" />
      </button>

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
