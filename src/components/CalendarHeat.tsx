import { useMemo, useRef, useState } from 'react'
import { lang, t as tr } from '../lib/i18n'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dayKey, intensityLevel, monthGrid, TrainingDay } from '../lib/stats'
import '../styles/insights.css'

const WEEKDAYS = lang === 'he' ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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
  const today = dayKey(now)
  const maxSets = useMemo(() => Math.max(0, ...[...days.values()].map((d) => d.sets)), [days])
  const earliest = useMemo(() => [...days.keys()].sort()[0], [days])
  const labels = [...WEEKDAYS.slice(weekStartsOn), ...WEEKDAYS.slice(0, weekStartsOn)]
  const monthAt = (o: number) => new Date(now.getFullYear(), now.getMonth() + o, 1)
  const prefixOf = (o: number) => dayKey(monthAt(o)).slice(0, 7)
  const canBack = earliest != null && earliest.slice(0, 7) < prefixOf(offset)
  const canNext = offset < 0

  /*
   * Swipe between months like a photo carousel: last month, this month and next month sit side by side and
   * move with the finger, so the next month slides in as you drag. Let go past a third of the width (or with a
   * quick flick) and it settles on the new month; otherwise it springs back. Vertical drags stay page scrolls.
   */
  const viewport = useRef<HTMLDivElement>(null)
  const [dx, setDx] = useState(0)
  const [settle, setSettle] = useState<null | -1 | 0 | 1>(null) // animating to prev (-1), back (0) or next (1)
  const settleRef = useRef<null | -1 | 0 | 1>(null)
  const swipe = useRef<{ x: number; y: number; t: number; dx: number; axis?: 'x' | 'y' } | null>(null)
  const swiped = useRef(false)
  const width = () => viewport.current?.clientWidth ?? 320

  function slide(dir: -1 | 0 | 1) {
    if (dir === -1 && !canBack) dir = 0
    if (dir === 1 && !canNext) dir = 0
    const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (calm || dir === 0 && dx === 0) {
      if (dir) setOffset((o) => o + dir)
      setDx(0)
      setSettle(null)
      return
    }
    settleRef.current = dir
    setSettle(dir)
    // safety net: if the browser skips transitionend (e.g. nothing moved), finish anyway
    window.setTimeout(() => settleRef.current === dir && onSettled(), 450)
  }
  // when the slide animation ends, swap the months under it with no animation
  function onSettled() {
    const dir = settleRef.current
    if (dir == null) return
    settleRef.current = null
    setSettle(null)
    if (dir) setOffset((o) => o + dir)
    setDx(0)
  }

  const swipeProps = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' || settle != null) return
      swipe.current = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0 }
      swiped.current = false
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = swipe.current
      if (!g) return
      const mx = e.clientX - g.x
      const my = e.clientY - g.y
      if (!g.axis && Math.hypot(mx, my) > 8) g.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      if (g.axis !== 'x') return
      // past the first or the latest month: a rubber band instead of an empty page
      const blocked = (mx > 0 && !canBack) || (mx < 0 && !canNext)
      g.dx = blocked ? mx / 3 : mx
      setDx(g.dx)
    },
    onPointerUp: () => {
      const g = swipe.current
      swipe.current = null
      if (!g || g.axis !== 'x') return
      swiped.current = true
      const v = g.dx / Math.max(1, performance.now() - g.t) // px per ms
      const far = Math.abs(g.dx) > width() / 3
      const flick = Math.abs(v) > 0.45 && Math.abs(g.dx) > 24
      slide(far || flick ? (g.dx > 0 ? -1 : 1) : 0)
    },
    onPointerCancel: () => {
      swipe.current = null
      slide(0)
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (swiped.current) {
        swiped.current = false
        e.stopPropagation()
        e.preventDefault()
      }
    }
  }

  // the title follows the month that is mostly in view, so it changes halfway through a swipe
  const peek = settle ?? (Math.abs(dx) > width() / 2 ? (dx > 0 ? -1 : 1) : 0)
  const shown = offset + (peek === -1 && canBack ? -1 : peek === 1 && canNext ? 1 : 0)
  const view = monthAt(shown)
  const count = [...days.keys()].filter((k) => k.startsWith(prefixOf(shown))).length
  // track: [prev | current | next], current in the middle (-1/3)
  const pos = settle != null ? `${(-1 - settle) * 33.3333}%` : `calc(-33.3333% + ${dx}px)`

  const grid = (o: number) => {
    const v = monthAt(o)
    const rows = monthGrid(v.getFullYear(), v.getMonth(), weekStartsOn)
    return (
      <div className="cal-grid" role={o === offset ? 'grid' : undefined} aria-hidden={o !== offset}>
        {rows.flat().map((k, i) => {
          if (!k) return <div key={i} className="cal-cell pad" />
          const d = days.get(k)
          const lvl = intensityLevel(d, maxSets)
          const future = k > today
          return (
            <button
              key={k}
              className={`cal-cell l${lvl}${k === today ? ' today' : ''}${future ? ' future' : ''}`}
              disabled={!d || o !== offset}
              tabIndex={o === offset ? undefined : -1}
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
    )
  }

  return (
    <div className={`cal${names ? ' named' : ''}`}>
      <div className="row cal-head">
        <div className="grow">
          <div className="ins-title">{view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
          <div className="small muted">
            {count === 0 ? 'No training days' : `${count} training day${count === 1 ? '' : 's'}`}
          </div>
        </div>
        <button className="btn icon sm ghost" disabled={!canBack || settle != null} onClick={() => slide(-1)} aria-label={tr("Previous month")}>
          <ChevronLeft size={18} />
        </button>
        <button className="btn icon sm ghost" disabled={!canNext || settle != null} onClick={() => slide(1)} aria-label={tr("Next month")}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="cal-wds" aria-hidden>
        {labels.map((l, i) => (
          <div key={'h' + i} className="cal-wd">
            {l}
          </div>
        ))}
      </div>
      <div className="cal-viewport" ref={viewport} {...swipeProps}>
        <div
          className={`cal-track${settle != null ? ' settling' : ''}`}
          style={{ transform: `translateX(${pos})` }}
          onTransitionEnd={(e) => e.target === e.currentTarget && onSettled()}
        >
          <div className="cal-pane">{grid(offset - 1)}</div>
          <div className="cal-pane">{grid(offset)}</div>
          <div className="cal-pane">{canNext ? grid(offset + 1) : null}</div>
        </div>
      </div>
      <div className="row cal-legend tiny muted">
        <span className="grow">Shade = sets that day</span>
        <span>{tr("Less")}</span>
        <i className="cal-key l1" />
        <i className="cal-key l2" />
        <i className="cal-key l3" />
        <span>{tr("More")}</span>
      </div>
    </div>
  )
}
