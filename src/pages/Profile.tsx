import { plateaus } from '../lib/plateau'
import { GoalsList } from '../components/GoalCard'
import { WeekSummary } from '../components/WeekSummary'
import '../styles/records.css'
import { t as tr } from '../lib/i18n'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, Medal, Trophy } from 'lucide-react'
import { useStore } from '../lib/store'
import { Empty, PageHeader, Sheet } from '../components/ui'
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
  const [ach, setAch] = useState(false)
  useAchievementToasts()


  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title={tr("Progress")} sub={tr("Your training at a glance.")} />

      {sum.workouts > 0 && (
        <section className="card goal-streak" aria-label={tr("Weekly goal")}>
          <GoalRing done={week.done} goal={week.goal} size={56} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="goal-title">
              {inRow > 0 ? tr(inRow === 1 ? '{n} week in a row' : '{n} weeks in a row', { n: inRow }) : tr('Weekly goal')}
            </div>
            <div className="small muted">
              {week.done >= week.goal ? tr('Goal met: {n} workouts this week', { n: week.done }) : tr('{a} of {b} workouts this week', { a: week.done, b: week.goal })}
            </div>
          </div>
          <button className="btn sm secondary" onClick={() => setEditGoal(true)} aria-label={tr("Change weekly goal")}>
            {tr("Change")}
          </button>
        </section>
      )}
      {editGoal && <GoalSheet onClose={() => setEditGoal(false)} />}

      {sum.workouts === 0 ? (
        <Empty title={tr("Nothing here yet")} text={tr("Finish your first workout and your weekly chart, totals and calendar show up here.")} />
      ) : (
        <>
          <WeekSummary />

          <div className="card">
            <div className="prof-seg">
              <div className="seg block" role="tablist" aria-label={tr("What to show")}>
                {METRICS.map((m) => (
                  <button key={m.id} className={metric === m.id ? 'on' : ''} onClick={() => setMetric(m.id)} aria-pressed={metric === m.id}>
                    {tr(m.label)}
                  </button>
                ))}
              </div>
              {/* the range is secondary: a small control on its own line, not a second full-width bar */}
              <div className="prof-range">
                <span className="small muted">{tr(RANGES.find((r) => r.id === range)?.label ?? '')}</span>
                <div className="seg sm" role="tablist" aria-label={tr("Time range")}>
                  {RANGES.map((r) => (
                    <button key={r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)} aria-pressed={range === r.id} aria-label={tr(r.label)}>
                      {tr(r.short)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <WeekBars values={series.map((w) => w.value)} starts={series.map((w) => w.start)} format={FORMAT[metric]} />
          </div>
        </>
      )}


      {sum.workouts > 0 && (
        <div className="card" ref={calRef} style={{ scrollMarginTop: 12 }}>
          <CalendarHeat days={days} names={names} onDay={(_, d) => nav(`/history/${d.sessionIds[d.sessionIds.length - 1]}`)} />
          {/* one quiet line under the month instead of two pills above it */}
          <div className="small muted prof-streak">
            {[streak.current > 0 ? tr('{n}-week streak', { n: streak.current }) : '', tr(rest === 1 ? '{n} rest day this week' : '{n} rest days this week', { n: rest })]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      )}

      <GoalsList db={db} onOpen={(id) => nav(`/exercise/${id}`)} />

      {stalled.length > 0 && (
        <section className="card stall" aria-label={tr("Stalled lifts")}>
          <div className="stall-head">
            <h2>{tr("Stalled lifts")}</h2>
            <span className="small muted">{tr("No new best lately")}</span>
          </div>
          {stalled.slice(0, 3).map((p) => (
            <button key={p.exerciseId} className="stall-row" onClick={() => nav(`/exercise/${p.exerciseId}`)}>
              <span className="grow ellipsis stall-name">{p.name}</span>
              <span className="small muted stall-n">{p.sessions} sessions</span>
              <ChevronRight size={16} aria-hidden className="muted" />
            </button>
          ))}
          {/* the advice is one line; the details are on each exercise's page */}
          <div className="tiny muted stall-tip">Try an easier week at ~90%, or a different rep range for a few weeks.</div>
        </section>
      )}




      <div className="list-group">
        <button className="list-row" onClick={() => nav('/records')}>
          <Trophy size={20} aria-hidden className="accent-ico" />
          <span className="grow">{tr('Records')}</span>
          <ChevronRight size={18} aria-hidden className="muted" />
        </button>
        <button className="list-row" onClick={() => setAch(true)}>
          <Medal size={20} aria-hidden className="muted" />
          <span className="grow">{tr('Achievements')}</span>
          <ChevronRight size={18} aria-hidden className="muted" />
        </button>
        <button className="list-row" onClick={() => nav('/exercises')}>
          <BookOpen size={20} aria-hidden className="muted" />
          <span className="grow">{tr('Exercises')}</span>
          <ChevronRight size={18} aria-hidden className="muted" />
        </button>
      </div>
      {ach && (
        <Sheet title={tr('Achievements')} onClose={() => setAch(false)}>
          <AchievementsSection />
        </Sheet>
      )}
    </div>
  )
}
