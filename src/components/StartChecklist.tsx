import { useState } from 'react'
import { lang, t } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { markSeen, seen } from './Welcome'

const installed = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true)

/** Four first steps on Train for new users: one line with progress, opens on tap; gone when done or hidden. */
export function StartChecklist() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const [hidden, setHidden] = useState(() => seen('start-checklist'))
  const [open, setOpen] = useState(false)
  // only for new users: after a handful of workouts it is no longer news
  if (hidden || db.sessions.filter((s) => s.finished_at).length >= 5) return null

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

  const next = steps.find((s) => !s.done)!
  const doneN = steps.length - left

  return (
    <section className="card hm-start" aria-label={t("Getting started")}>
      <button className="hm-start-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="hm-start-n" aria-hidden>
          {doneN}/{steps.length}
        </span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="hm-row-t">{t('Getting started')}</span>
          <span className="small muted ellipsis" style={{ display: 'block' }}>
            {open ? t('{a} of {b} done', { a: doneN, b: steps.length }) : t('Next: {x}', { x: lang === 'he' ? t(next.t) : next.t.charAt(0).toLowerCase() + next.t.slice(1) })}
          </span>
        </span>
        <ChevronDown size={18} className="hm-start-caret" aria-hidden />
      </button>
      <div className="hm-start-bar" aria-hidden>
        <i style={{ width: `${(doneN / steps.length) * 100}%` }} />
      </div>
      {open && (
        <div className="hm-start-list">
          {steps.map((s) => (
            <button key={s.t} className={`hm-start-row${s.done ? ' done' : ''}`} onClick={s.go} disabled={s.done}>
              <span className="hm-start-tick" aria-hidden>
                {s.done && <Check size={14} />}
              </span>
              <span className="grow">
                <span className="hm-start-t">{t(s.t)}</span>
                {!s.done && <span className="small muted" style={{ display: 'block' }}>{t(s.d)}</span>}
              </span>
              {!s.done && <ChevronRight size={18} aria-hidden className="muted" />}
              <span className="sr-only">{s.done ? 'done' : 'to do'}</span>
            </button>
          ))}
          <button className="btn ghost sm hm-start-hide" onClick={close}>
            {t("Hide this list")}
          </button>
        </div>
      )}
    </section>
  )
}
