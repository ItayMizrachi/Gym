import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dayKey, intensityLevel, monthGrid, TrainingDay } from '../lib/stats'
import '../styles/insights.css'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Month calendar with training days shaded by how many sets were done that day. */
export function CalendarHeat({
  days,
  now = new Date(),
  weekStartsOn = 0,
  onDay
}: {
  days: Map<string, TrainingDay>
  now?: Date
  weekStartsOn?: number
  onDay?: (key: string, day: TrainingDay) => void
}) {
  const [offset, setOffset] = useState(0)
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const rows = useMemo(() => monthGrid(view.getFullYear(), view.getMonth(), weekStartsOn), [view.getFullYear(), view.getMonth(), weekStartsOn])
  const today = dayKey(now)
  const maxSets = useMemo(() => Math.max(0, ...[...days.values()].map((d) => d.sets)), [days])
  const prefix = dayKey(view).slice(0, 7)
  const count = [...days.keys()].filter((k) => k.startsWith(prefix)).length
  const earliest = [...days.keys()].sort()[0]
  const canBack = earliest != null && earliest.slice(0, 7) < prefix
  const labels = [...WEEKDAYS.slice(weekStartsOn), ...WEEKDAYS.slice(0, weekStartsOn)]

  return (
    <div className="cal">
      <div className="row cal-head">
        <div className="grow">
          <div className="ins-title">{view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
          <div className="small muted">
            {count === 0 ? 'No training days' : `${count} training day${count === 1 ? '' : 's'}`}
          </div>
        </div>
        <button className="btn icon sm ghost" disabled={!canBack} onClick={() => setOffset(offset - 1)} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <button className="btn icon sm ghost" disabled={offset >= 0} onClick={() => setOffset(offset + 1)} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="cal-grid" role="grid">
        {labels.map((l, i) => (
          <div key={'h' + i} className="cal-wd">
            {l}
          </div>
        ))}
        {rows.flat().map((k, i) => {
          if (!k) return <div key={i} className="cal-cell pad" />
          const d = days.get(k)
          const lvl = intensityLevel(d, maxSets)
          const future = k > today
          return (
            <button
              key={k}
              className={`cal-cell l${lvl}${k === today ? ' today' : ''}${future ? ' future' : ''}`}
              disabled={!d}
              onClick={() => d && onDay?.(k, d)}
              aria-label={`${k}${d ? `, ${d.workouts} workout${d.workouts > 1 ? 's' : ''}, ${d.sets} sets` : ''}`}
            >
              {Number(k.slice(8))}
            </button>
          )
        })}
      </div>
      <div className="row cal-legend tiny muted">
        <span className="grow">Shade = sets that day</span>
        <span>Less</span>
        <i className="cal-key l1" />
        <i className="cal-key l2" />
        <i className="cal-key l3" />
        <span>More</span>
      </div>
    </div>
  )
}
