import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { markSeen, seen } from './Welcome'

const installed = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true)

/** Four first steps on Train for new users; ticks itself off and disappears when done or dismissed. */
export function StartChecklist() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const [hidden, setHidden] = useState(() => seen('start-checklist'))
  if (hidden) return null

  const steps = [
    { done: db.workouts.length > 0, t: 'Pick a program', d: 'Or build your own workout', go: () => nav('/programs') },
    { done: db.sessions.some((s) => s.finished_at), t: 'Finish your first workout', d: 'Tick each set as you go', go: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { done: db.metrics.length > 0, t: 'Log your body weight', d: 'Track it next to your lifts', go: () => nav('/body') },
    { done: installed(), t: 'Add GymLog to your home screen', d: 'Opens full screen, works offline', go: () => nav('/help') }
  ]
  const left = steps.filter((s) => !s.done).length
  if (!left) return null
  const close = () => {
    markSeen('start-checklist')
    setHidden(true)
  }

  return (
    <section className="card start-list" aria-label="Getting started">
      <div className="start-head">
        <div className="grow">
          <div className="start-title">Getting started</div>
          <div className="small muted">
            {steps.length - left} of {steps.length} done
          </div>
        </div>
        <button className="btn icon ghost sm" onClick={close} aria-label="Hide getting started">
          <X size={18} />
        </button>
      </div>
      <div className="start-bar" aria-hidden>
        <i style={{ width: `${((steps.length - left) / steps.length) * 100}%` }} />
      </div>
      {steps.map((s) => (
        <button key={s.t} className={`start-row${s.done ? ' done' : ''}`} onClick={s.go} disabled={s.done}>
          <span className="start-tick" aria-hidden>
            {s.done && <Check size={14} />}
          </span>
          <span className="grow">
            <span className="start-t">{s.t}</span>
            {!s.done && <span className="small muted" style={{ display: 'block' }}>{s.d}</span>}
          </span>
          {!s.done && <ChevronRight size={18} aria-hidden className="muted" />}
          <span className="sr-only">{s.done ? 'done' : 'to do'}</span>
        </button>
      ))}
    </section>
  )
}
