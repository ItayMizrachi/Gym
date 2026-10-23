import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dayKey, intensityLevel, monthGrid, TrainingDay } from '../lib/stats'
import '../styles/insights.css'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * Month calendar with training days shaded by how many sets were done that day.
 * Pass `names` (day key → workout names) to print the workout name under each training day.
 */
/**
 * A workout name short enough for a seventh of a phone: "Push" and "Legs" as they are, longer names as initials
 * ("Upper Body" → "UB", "Pull + Hamstrings" → "PH"). Two workouts on a day: the first and "+".
 */
export function shortName(name: string): string {
  const base = name.replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (base.length <= 5) return base
  const words = base.split(/[^A-Za-z0-9֐-׿]+/).filter(Boolean)
  if (words.length < 2) return base.slice(0, 4)
  return words
    .slice(0, 3)
    .map((w) => (/^\d+$/.test(w) ? w : w[0].toUpperCase()))
    .join('')
}
const dayLabel = (names: string[]) => (names.length ? shortName(names[0]) + (names.length > 1 ? '+' : '') : '')

export function CalendarHeat({
  days,
  now = new Date(),
  weekStartsOn = 0,
  onDay,
  names
}: {
  days: Map<string, TrainingDay>
  now?: Date
  weekStartsOn?: number
  onDay?: (key: string, day: TrainingDay) => void
  names?: Map<string, string[]>
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
    <div className={`cal${names ? ' named' : ''}`}>
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
              aria-label={`${k}${d ? `, ${names?.get(k)?.join(', ') ?? `${d.workouts} workout${d.workouts > 1 ? 's' : ''}`}, ${d.sets} sets` : ''}`}
              title={names && d ? names.get(k)?.join(', ') : undefined}
            >
              <span className="cal-n">{Number(k.slice(8))}</span>
              {names && d && <span className="cal-name">{dayLabel(names.get(k) ?? [])}</span>}
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
