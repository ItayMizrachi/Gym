import { useEffect, useLayoutEffect, useState } from 'react'
import { t as tr } from '../lib/i18n'
import '../styles/workout-live.css'

export interface CoachStep {
  /** CSS selector of the element to point at; the first match is used */
  target: string
  title: string
  text: string
}

const seenKey = (id: string, userId: string) => `gymlog:tips:${id}:${userId}`

export function tipsSeen(id: string, userId: string): boolean {
  try {
    return localStorage.getItem(seenKey(id, userId)) === '1'
  } catch {
    return true // no storage: do not nag on every visit
  }
}
export function markTipsSeen(id: string, userId: string) {
  try {
    localStorage.setItem(seenKey(id, userId), '1')
  } catch {
    /* ignore */
  }
}

/**
 * A few sequential coach marks. Each step dims the screen except the target and shows a short note
 * next to it. Shown once per user (`id` + `userId` in localStorage); "Skip" also counts as seen.
 */
export function CoachMarks({ id, userId, steps, enabled = true }: { id: string; userId: string; steps: CoachStep[]; enabled?: boolean }) {
  const [step, setStep] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // start a moment after the screen has rendered, only once per user
  useEffect(() => {
    if (!enabled || step != null || tipsSeen(id, userId)) return
    const t = setTimeout(() => {
      if (document.querySelector(steps[0]?.target)) setStep(0)
    }, 600)
    return () => clearTimeout(t)
  }, [enabled, id, userId])

  useLayoutEffect(() => {
    if (step == null) return
    const el = document.querySelector(steps[step].target) as HTMLElement | null
    if (!el) return finish()
    const r0 = el.getBoundingClientRect()
    // keep the target clear of the sticky header and the note below it
    if (r0.top < 190 || r0.bottom > window.innerHeight - 220) window.scrollBy({ top: r0.top - 230 })
    const measure = () => setRect(el.getBoundingClientRect())
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step])

  function finish() {
    markTipsSeen(id, userId)
    setStep(null)
  }

  if (step == null || !rect) return null
  const s = steps[step]
  const last = step === steps.length - 1
  const pad = 6
  const below = rect.bottom + 160 < window.innerHeight
  const noteStyle = below ? { top: rect.bottom + pad + 10 } : { bottom: window.innerHeight - rect.top + pad + 10 }
  // arrow points at the target's centre, clamped inside the note
  const arrowX = Math.max(36, Math.min(window.innerWidth - 36, rect.left + rect.width / 2)) - 16 - 8

  return (
    <div className="cm" role="dialog" aria-modal="true" aria-label={s.title}>
      <div className="cm-hole" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      <div className={`cm-note ${below ? 'below' : 'above'}`} style={noteStyle}>
        <span className="cm-arrow" style={{ left: arrowX }} aria-hidden />
        <div className="cm-step">
          {step + 1} of {steps.length}
        </div>
        <div className="cm-title">{s.title}</div>
        <div className="cm-text">{s.text}</div>
        <div className="cm-actions">
          <button className="btn ghost sm" onClick={finish}>
            {tr("Skip tips")}
          </button>
          <button className="btn primary sm" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
