import { useEffect, useRef, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Plus, Sparkles, Wand2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { buildStarterPlan } from '../lib/seed'
import FindProgram from './FindProgram'
import '../styles/onboarding.css'
import '../styles/programs-nav.css'

/** Per-user UI flags (localStorage, keyed by user id). */
const key = (name: string) => `gymlog:${name}:${useStore.getState().user?.id ?? 'local'}`
export const seen = (name: string) => localStorage.getItem(key(name)) === '1'
export const markSeen = (name: string) => localStorage.setItem(key(name), '1')
export const unmark = (name: string) => localStorage.removeItem(key(name))
/** Tells App to show the tour again (Settings → "Show the welcome tour"). */
export const reopenWelcome = () => {
  unmark('welcome')
  window.dispatchEvent(new Event('gymlog:welcome'))
}

function Art({ step }: { step: number }) {
  if (step === 0)
    return (
      <svg viewBox="0 0 160 100" className="wl-art" aria-hidden>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${14 + i * 46} ${i === 1 ? 14 : 24})`}>
            <rect width="40" height="56" rx="7" fill="var(--card2)" stroke={i === 1 ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth="2" />
            <rect x="8" y="12" width="24" height="4" rx="2" fill="var(--text-2)" />
            <rect x="8" y="22" width="18" height="3" rx="1.5" fill="var(--faint)" />
            <rect x="8" y="30" width="20" height="3" rx="1.5" fill="var(--faint)" />
          </g>
        ))}
      </svg>
    )
  if (step === 1)
    return (
      <svg viewBox="0 0 160 100" className="wl-art" aria-hidden>
        {[0, 1].map((i) => (
          <g key={i} transform={`translate(10 ${18 + i * 38})`}>
            <circle cx="14" cy="14" r="12" fill={i ? 'var(--bg2)' : 'var(--chalk-plate)'} stroke="var(--chalk-plate)" strokeWidth="3" />
            <rect x="36" y="2" width="44" height="24" rx="5" fill="var(--bg2)" stroke="var(--line-strong)" />
            <rect x="86" y="2" width="30" height="24" rx="5" fill="var(--bg2)" stroke="var(--line-strong)" />
            <rect x="122" y="2" width="26" height="24" rx="5" fill={i ? 'var(--card2)' : 'var(--ok)'} />
            {!i && <path d="M129 14l4 4 8-8" stroke="var(--ok-ink)" strokeWidth="3" fill="none" />}
          </g>
        ))}
      </svg>
    )
  return (
    <svg viewBox="0 0 160 100" className="wl-art" aria-hidden>
      <polyline points="14,80 44,66 74,70 104,44 140,24" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="140" cy="24" r="7" fill="var(--accent)" />
      <line x1="14" y1="88" x2="148" y2="88" stroke="var(--line-strong)" strokeWidth="2" />
    </svg>
  )
}

const CARDS = [
  { t: 'Pick a program', d: 'Choose a ready-made program, or build your own workouts. You can change everything later.' },
  { t: 'Log as you lift', d: 'Weights fill in from last time. Tick the check to log a set. The rest timer starts by itself.' },
  { t: 'Watch progress', d: 'GymLog remembers your records, keeps your history and tracks your body weight.' }
]

export default function Welcome({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [finder, setFinder] = useState(false)
  const nav = useNavigate()
  const save = useStore((s) => s.save)
  const db = useStore((s) => s.db)
  const user = useStore((s) => s.user)
  const last = step === CARDS.length - 1
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => box.current?.focus({ preventScroll: true }), [])
  const close = () => {
    markSeen('welcome')
    onDone()
  }
  function loadStarter() {
    const plan = buildStarterPlan(user?.id ?? 'local', db.exercises, db.workouts.length)
    plan.exercises.forEach((e) => save('exercises', e))
    plan.workouts.forEach((w) => save('workouts', w))
    plan.workout_exercises.forEach((w) => save('workout_exercises', w))
    close()
    nav('/')
  }
  let x0 = 0
  if (finder) return <FindProgram onDone={close} />
  return (
    <div
      ref={box}
      tabIndex={-1}
      className="wl"
      role="dialog"
      aria-modal="true"
      aria-label={tr("Welcome to GymLog")}
      onPointerDown={(e) => (x0 = e.clientX)}
      onPointerUp={(e) => {
        const dx = e.clientX - x0
        if (dx < -50 && !last) setStep(step + 1)
        if (dx > 50 && step > 0) setStep(step - 1)
      }}
    >
      <div className="wl-top">
        <span className="wl-brand">GymLog</span>
        <button className="btn sm ghost" onClick={close} aria-label={tr("Skip the tour")}>
          {tr("Skip")}
        </button>
      </div>
      <div className="wl-card" key={step}>
        <Art step={step} />
        <h1>{CARDS[step].t}</h1>
        <p>{CARDS[step].d}</p>
      </div>
      <div className="wl-dots">
        {CARDS.map((_, i) => (
          <button
            key={i}
            className={i === step ? 'on' : ''}
            onClick={() => setStep(i)}
            aria-label={`Card ${i + 1} of ${CARDS.length}`}
            aria-current={i === step ? 'step' : undefined}
          />
        ))}
      </div>
      <div className="wl-actions">
        {last ? (
          <>
            {db.workouts.length === 0 && (
              <>
                <button className="btn primary block" onClick={() => setFinder(true)}>
                  <Wand2 size={18} /> {tr("Find my program")}
                </button>
                <button
                  className="btn block"
                  onClick={() => {
                    close()
                    nav('/programs')
                  }}
                >
                  <LayoutGrid size={18} /> {tr("Browse programs")}
                </button>
                <button className="btn block" onClick={loadStarter}>
                  <Sparkles size={18} /> {tr("Load the 4-day starter plan")}
                </button>
              </>
            )}
            <button className={`btn block ${db.workouts.length ? 'primary' : ''}`} onClick={close}>
              {db.workouts.length ? "Let's go" : (<><Plus size={18} /> {tr("I'll build my own")}</>)}
            </button>
          </>
        ) : (
          <button className="btn primary block" onClick={() => setStep(step + 1)}>
            {tr("Next")}
          </button>
        )}
      </div>
    </div>
  )
}
