import { useEffect, useRef, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Dumbbell, Home, Sparkles, X } from 'lucide-react'
import { Answers, GOAL_LABEL, Recommendation, recommend } from '../lib/recommend'
import { GEAR_LABEL, Gear, Level, Program, gearOf } from '../lib/programs'
import { addProgram } from '../lib/programStart'
import { useStore } from '../lib/store'
import '../styles/findprogram.css'

interface Opt<T> {
  v: T
  t: string
  d?: string
}

const GOALS: Opt<Answers['goal']>[] = [
  { v: 'muscle', t: GOAL_LABEL.muscle, d: 'Bigger, more defined muscles' },
  { v: 'strength', t: GOAL_LABEL.strength, d: 'Lift heavier on the big lifts' },
  { v: 'fit', t: GOAL_LABEL.fit, d: 'Feel good, move well, stay in shape' },
  { v: 'glutes', t: GOAL_LABEL.glutes, d: 'Glutes, hamstrings and legs first' }
]
const LEVELS: Opt<Level>[] = [
  { v: 'Beginner', t: 'New to the gym', d: 'Less than 6 months of regular training' },
  { v: 'Intermediate', t: 'Some experience', d: 'You know the main lifts and train regularly' },
  { v: 'Advanced', t: 'Experienced', d: 'Years of structured training' }
]
const DAYS: Opt<number>[] = [2, 3, 4, 5, 6].map((d) => ({ v: d, t: `${d} days` }))
const GEAR: Opt<Gear>[] = [
  { v: 'gym', t: 'A gym', d: 'Machines, cables, barbells and dumbbells' },
  { v: 'home', t: 'Dumbbells at home', d: 'Dumbbells, a kettlebell or bands' },
  { v: 'none', t: 'No equipment', d: 'Just your bodyweight' }
]

const QUESTIONS = ['What is your main goal?', 'How much have you trained?', 'How many days a week can you train?', 'Where do you train?']

/**
 * "Find my program": four quick questions, then one recommended ready-made program you can add in one tap.
 * Full-screen, like the welcome tour. `onDone` closes it.
 */
export default function FindProgram({ onDone }: { onDone: () => void }) {
  const nav = useNavigate()
  const toast = useStore((s) => s.toast)
  const [step, setStep] = useState(0)
  const [a, setA] = useState<Partial<Answers>>({})
  const [result, setResult] = useState<Recommendation | null>(null)
  const [pick, setPick] = useState<Program | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => box.current?.focus({ preventScroll: true }), [step, result])

  function answer<K extends keyof Answers>(k: K, v: Answers[K]) {
    const next = { ...a, [k]: v }
    setA(next)
    if (step < QUESTIONS.length - 1) setStep(step + 1)
    else {
      const r = recommend(next as Answers)
      setResult(r)
      setPick(r.best)
    }
  }

  function add(p: Program) {
    addProgram(p)
    toast({ kind: 'info', text: `${p.name} added`, sub: p.kind === 'weekly' ? `${p.workouts.length} workouts are on the Train tab.` : 'It is on the Train tab.' })
    onDone()
    nav('/')
  }

  const back = () => (result ? (setResult(null), setPick(null)) : setStep(Math.max(0, step - 1)))

  const list = <T,>(opts: Opt<T>[], cur: T | undefined, on: (v: T) => void, icon?: (v: T) => JSX.Element | null) => (
    <div className={`fp-opts ${opts.length > 4 ? 'grid' : ''}`} role="radiogroup" aria-label={QUESTIONS[step]}>
      {opts.map((o) => (
        <button key={String(o.v)} role="radio" aria-checked={cur === o.v} className={`fp-opt ${cur === o.v ? 'on' : ''}`} onClick={() => on(o.v)}>
          {icon?.(o.v)}
          <span className="grow">
            <span className="fp-t">{o.t}</span>
            {o.d && <span className="fp-d">{o.d}</span>}
          </span>
          {cur === o.v && <Check size={18} aria-hidden />}
        </button>
      ))}
    </div>
  )

  return (
    <div ref={box} tabIndex={-1} className="wl fp" role="dialog" aria-modal="true" aria-label={tr("Find my program")}>
      <div className="wl-top">
        {step > 0 || result ? (
          <button className="btn icon ghost" onClick={back} aria-label={tr("Back")}>
            <ArrowLeft size={22} />
          </button>
        ) : (
          <span className="wl-brand">{tr("Find my program")}</span>
        )}
        <button className="btn icon ghost" onClick={onDone} aria-label={tr("Close")}>
          <X size={22} />
        </button>
      </div>

      {!result ? (
        <div className="fp-body" key={step}>
          <div className="fp-progress" aria-label={`Question ${step + 1} of ${QUESTIONS.length}`}>
            {QUESTIONS.map((_, i) => (
              <i key={i} className={i <= step ? 'on' : ''} />
            ))}
          </div>
          <h1>{QUESTIONS[step]}</h1>
          {step === 0 && list(GOALS, a.goal, (v) => answer('goal', v))}
          {step === 1 && list(LEVELS, a.level, (v) => answer('level', v))}
          {step === 2 && list(DAYS, a.days, (v) => answer('days', v))}
          {step === 3 &&
            list(GEAR, a.gear, (v) => answer('gear', v), (v) => (v === 'gym' ? <Dumbbell size={20} aria-hidden /> : v === 'home' ? <Home size={20} aria-hidden /> : <Sparkles size={20} aria-hidden />))}
        </div>
      ) : (
        <div className="fp-body">
          <div className="fp-eyebrow">{tr("Your best match")}</div>
          {pick && <ProgramCard p={pick} best={pick.id === result.best.id} />}
          <button className="btn primary block" onClick={() => pick && add(pick)}>
            <Check size={18} aria-hidden /> {pick?.kind === 'weekly' ? 'Add this program' : 'Add this workout'}
          </button>
          {result.others.length > 0 && (
            <>
              <div className="fp-eyebrow" style={{ marginTop: 'var(--s5)' }}>
                {tr("Also a good fit")}
              </div>
              <div className="fp-opts">
                {[result.best, ...result.others]
                  .filter((p) => p.id !== pick?.id)
                  .map((p) => (
                    <button key={p.id} className="fp-opt" onClick={() => setPick(p)}>
                      <span className="grow">
                        <span className="fp-t">{p.name}</span>
                        <span className="fp-d">
                          {p.days > 1 ? `${p.days} days a week` : 'Single workout'} · {p.level} · {GEAR_LABEL[gearOf(p)]}
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}
          <button
            className="btn ghost block"
            onClick={() => {
              onDone()
              nav('/programs')
            }}
          >
            {tr("Browse all programs")}
          </button>
        </div>
      )}
    </div>
  )
}

function ProgramCard({ p, best }: { p: Program; best: boolean }) {
  return (
    <div className={`fp-card ${best ? 'best' : ''}`}>
      <div className="fp-card-name">{p.name}</div>
      <div className="fp-chips">
        <span className="chip">{p.days > 1 ? `${p.days} days a week` : 'Single workout'}</span>
        <span className="chip">{p.level}</span>
        <span className="chip">{GEAR_LABEL[gearOf(p)]}</span>
      </div>
      <p>{p.description}</p>
      {p.kind === 'weekly' && (
        <ol className="fp-days">
          {p.workouts.map((w) => (
            <li key={w.name}>
              <b>{w.name}</b> <span className="muted">· {w.exercises.length} exercises</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
