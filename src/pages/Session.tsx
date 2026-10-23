import { fmtVolume, previousOfTemplate, summarizeSession } from '../lib/stats'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GripVertical, Timer, Check, ChevronDown, ChevronLeft, ChevronUp, Disc, MoreHorizontal, Plus, Flag, Trash2, TrendingUp, HelpCircle, Play, Square, Trophy, Calculator, Repeat, StickyNote, Info, Link2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Exercise, Session, SessionExercise, SessionSet, SetKind, Tracking, trackingOf } from '../lib/types'
import { fmtTime, missingForLog, parseTime, prevLabel, setLabel } from '../lib/tracking'
import { addExerciseToSession, replaceExerciseInSession, addWarmupSets, discardSession, finishSession, newSet, toggleProgression } from '../lib/actions'
import { evaluateSet, lastPerformance, priorSets, recordsFor, repsForPR, SetRec, e1rm } from '../lib/pr'
import { nextSetLabel } from '../lib/nextSet'
import { planChanges, planUpdate } from '../lib/planSync'
import { fmtDate, fmtDuration, fmtKg, fmtRest, roundTo, splitName } from '../lib/format'
import { ExercisePicker } from '../components/ExercisePicker'
import { Confirm, NumInput, Sheet, Toggle } from '../components/ui'
import { moved, useDragReorder } from '../components/useDragReorder'
import { exerciseMeta } from '../lib/exerciseFilters'
import { nowIso } from '../lib/uid'
import { PlateCalc } from '../components/PlateCalc'
import { WarmupSheet } from '../components/WarmupSheet'
import { ToolsSheet } from '../components/ToolsSheet'
import { BodyMap } from '../components/BodyMap'
import { ExerciseThumb } from '../components/ExerciseImage'
import { HowToBody } from '../components/ExerciseHowTo'
import { KeypadProvider, KpField, useKeypadMode } from '../components/Keypad'
import { CoachMarks, CoachStep } from '../components/CoachMarks'
import { liveIntensity, muscleSets, MuscleRow, sessionVolume } from '../lib/muscles'
import { usePrefs } from '../lib/prefs'
import '../styles/workout-flow.css'
import '../styles/workout-live.css'

const KIND_ORDER: SetKind[] = ['work', 'warmup', 'drop', 'failure']
const KIND_INFO: Record<SetKind, { t: string; tag: string; d: string }> = {
  work: { t: 'Work set', tag: '1', d: 'A normal set. Counts towards records and progress.' },
  warmup: { t: 'Warm-up', tag: 'W', d: 'Lighter, to get ready. Never counts towards records.' },
  drop: { t: 'Drop set', tag: 'D', d: 'Straight after a set, with less weight and no rest.' },
  failure: { t: 'To failure', tag: 'F', d: 'As many reps as you can. Counts towards records.' }
}

/** Tap a set number: choose its type, or remove the row. */
function SetTypeSheet({ set, label, onPick, onRemove, onClose }: { set: SessionSet; label: string; onPick: (k: SetKind) => void; onRemove: () => void; onClose: () => void }) {
  return (
    <Sheet title={label} onClose={onClose}>
      <div className="stack" style={{ gap: 'var(--s2)' }}>
        <div className="kind-list" role="radiogroup" aria-label="Set type">
          {KIND_ORDER.map((k) => (
            <button key={k} role="radio" aria-checked={set.kind === k} className={`kind-opt${set.kind === k ? ' on' : ''}`} onClick={() => onPick(k)}>
              <span className={`kind ${k}`} aria-hidden>
                {KIND_INFO[k].tag}
              </span>
              <span className="grow">
                <span className="kind-opt-t">{KIND_INFO[k].t}</span>
                <span className="kind-opt-d">{KIND_INFO[k].d}</span>
              </span>
              {set.kind === k && <Check size={18} aria-hidden className="kind-opt-check" />}
            </button>
          ))}
        </div>
        <button className="btn danger block" onClick={onRemove}>
          <Trash2 size={16} aria-hidden /> Remove set
        </button>
      </div>
    </Sheet>
  )
}
// sets that already fired a record / near-record message, so un-ticking and re-ticking does not repeat it
const celebrated = new Set<string>()
const ELIGIBLE = new Set(['work', 'failure'])

function useWakeLock() {
  useEffect(() => {
    if (localStorage.getItem('gymlog:awake') === 'off') return
    let lock: any = null
    let alive = true
    const req = async () => {
      try {
        const l = await (navigator as any).wakeLock?.request('screen')
        if (!alive) l?.release?.()
        else lock = l
      } catch {
        /* not supported or denied */
      }
    }
    void req()
    const vis = () => document.visibilityState === 'visible' && void req()
    document.addEventListener('visibilitychange', vis)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', vis)
      try {
        lock?.release()
      } catch {
        /* ignore */
      }
    }
  }, [])
}

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const RPE_HELP: Record<number, string> = { 6: '4+ reps left', 7: '3 reps left', 8: '2 reps left', 9: '1 rep left', 10: 'nothing left' }

function RpeSheet({ value, onPick, onClose }: { value: number | null | undefined; onPick: (v: number | null) => void; onClose: () => void }) {
  return (
    <Sheet title="How hard was that set?" onClose={onClose}>
      <div className="stack">
        <div className="rpe-grid">
          {RPE_VALUES.map((v) => (
            <button
              key={v}
              className={`btn ${value === v ? 'active' : ''}`}
              onClick={() => {
                onPick(v)
                onClose()
              }}
            >
              {fmtKg(v)}
            </button>
          ))}
        </div>
        <div className="tiny muted">RPE {RPE_VALUES.filter((v) => RPE_HELP[v]).map((v) => `${v} = ${RPE_HELP[v]}`).join(' · ')}</div>
        {value != null && (
          <button
            className="btn"
            onClick={() => {
              onPick(null)
              onClose()
            }}
          >
            Clear RPE
          </button>
        )}
      </div>
    </Sheet>
  )
}

/** Press and hold for ~half a second. Text selection / the iOS callout are suppressed on the wrapper via CSS. */
function useLongPress(onLong: () => void, ms = 500) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const stop = () => {
    if (t.current) clearTimeout(t.current)
    t.current = null
    start.current = null
  }
  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY }
      fired.current = false
      t.current = setTimeout(() => {
        stop()
        fired.current = true
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        onLong()
      }, ms)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) stop()
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    // the tap that ends a long press should not also open the field
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        fired.current = false
        e.stopPropagation()
      }
    }
  }
}

function KgCell({ id, label, value, onChange, onLong }: { id: string; label: string; value: number; onChange: (n: number | null) => void; onLong: () => void }) {
  const lp = useLongPress(onLong)
  return (
    <div className="kg-hold" {...lp}>
      <KpField
        spec={{ id: `${id}:kg`, kind: 'kg', value, label: `${label} · kg`, onChange }}
        native={<NumInput value={value} onChange={onChange} ariaLabel="Weight kg (hold for plates)" />}
      />
    </div>
  )
}

/** Running stopwatches by set id (start time in ms, already shifted back by any time logged before). Module level so they survive re-renders and leaving the screen. */
const watches = new Map<string, number>()
const watchSec = (id: string) => Math.max(0, Math.round((Date.now() - (watches.get(id) ?? Date.now())) / 1000))

function useTick(on: boolean, ms = 500) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => tick((n) => n + 1), ms)
    return () => clearInterval(t)
  }, [on, ms])
}

/** m:ss text field. Plain numbers are read as seconds. */
function TimeInput({ value, onChange, placeholder, running }: { value: number | null | undefined; onChange: (sec: number | null) => void; placeholder?: string; running: boolean }) {
  const [text, setText] = useState(fmtTime(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(fmtTime(value))
  }, [value])
  return (
    <input
      className={`num time ${running ? 'running' : ''}`}
      inputMode="numeric"
      aria-label="Time (minutes:seconds)"
      placeholder={placeholder || '0:00'}
      value={text}
      readOnly={running}
      onFocus={(e) => {
        focused.current = true
        e.target.select()
      }}
      onBlur={() => {
        focused.current = false
        setText(fmtTime(value))
      }}
      onChange={(e) => {
        const raw = e.target.value
        if (!/^[\d:.,]*$/.test(raw)) return
        setText(raw)
        onChange(parseTime(raw))
      }}
    />
  )
}

/** Start / stop button for a time set. While running, the time column shows the live count. */
function StopwatchBtn({ set, onStop }: { set: SessionSet; onStop: (sec: number) => void }) {
  const running = watches.has(set.id)
  useTick(running)
  return (
    <button
      className={`sw ${running ? 'on' : ''}`}
      disabled={set.done}
      onClick={() => {
        if (running) {
          const sec = watchSec(set.id)
          watches.delete(set.id)
          onStop(sec)
        } else {
          // continue from what is already filled in
          watches.set(set.id, Date.now() - (set.time_sec ?? 0) * 1000)
          onStop(set.time_sec ?? 0)
        }
      }}
      aria-label={running ? 'Stop timer' : 'Start timer'}
    >
      {running ? <Square size={16} /> : <Play size={16} />}
    </button>
  )
}

function InfoSheet({ ex, onClose, onOpen }: { ex: any; onClose: () => void; onOpen: () => void }) {
  const db = useStore((s) => s.db)
  const rec = useMemo(() => recordsFor(priorSets(db, ex.id)), [db, ex.id])
  return (
    <Sheet title={ex.name} onClose={onClose}>
      <div className="stack">
        <HowToBody exercise={ex} />
        {ex.setup && (
          <div className="card">
            <div className="tiny muted">Setup</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{ex.setup}</div>
          </div>
        )}
        {ex.notes && (
          <div className="card">
            <div className="tiny muted">Notes</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{ex.notes}</div>
          </div>
        )}
        {rec.heaviest && (
          <div className="small muted">
            Heaviest: <b style={{ color: 'var(--text)' }}>{fmtKg(rec.heaviest.weight)} kg × {rec.heaviest.reps}</b>
            {rec.bestE1rm && <> · best est. 1-rep max <b style={{ color: 'var(--text)' }}>{fmtKg(Math.round(rec.bestE1rm.value * 10) / 10)}</b></>}
          </div>
        )}
        <button className="btn" onClick={onOpen}>
          Open exercise page
        </button>
      </div>
    </Sheet>
  )
}

const WORKOUT_TIPS: CoachStep[] = [
  { target: '.ex .set-row .kind', title: 'Set type', text: 'Tap the set number to make it a warm-up (W), drop (D) or failure (F) set, or to remove it.' },
  {
    target: '.ex [data-kp$=":reps"], .ex [data-kp$=":time"], .ex input[aria-label="Reps"], .ex input[aria-label^="Time"]',
    title: 'Enter what you did',
    text: 'Type your reps here. The weight is filled in from last time; tap it to change.'
  },
  { target: '.ex .check', title: 'Log the set', text: 'Tick to log the set. The rest timer starts on its own.' }
]

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** After a set is logged, keep the next set to do above the rest player instead of hidden under it. */
function revealNextSet() {
  const row = document.querySelector<HTMLElement>('.ex:not(.shut) .set-row.todo')
  if (!row) return
  const r = row.getBoundingClientRect()
  const limit = window.innerHeight - 170
  if (r.bottom > limit) window.scrollBy({ top: r.bottom - limit, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

/** Inert + aria-hidden while folded, so hidden controls are not tabbable or read out. */
const folded = (shut: boolean) => (shut ? ({ inert: '', 'aria-hidden': true } as any) : {})

function ExerciseCard({
  session,
  index,
  onMore,
  onReorder,
  showLegend,
  current,
  compact,
  drag,
  lifted
}: {
  session: Session
  index: number
  onMore: () => void
  onReorder: (clientY: number) => void
  showLegend?: boolean
  current?: boolean
  /** every card folds to its header while one is being dragged */
  compact?: boolean
  drag?: { ref: (el: HTMLElement | null) => void; style?: React.CSSProperties }
  lifted?: boolean
}) {
  const nav = useNavigate()
  const se = session.data.exercises[index]
  const db = useStore((s) => s.db)
  const save = useStore((s) => s.save)
  const toast = useStore((s) => s.toast)
  const startRest = useStore((s) => s.startRest)
  const ex = db.exercises.find((e) => e.id === se.exercise_id)
  const [info, setInfo] = useState(false)
  const [plateSet, setPlateSet] = useState<string | null>(null)
  const [rpeSet, setRpeSet] = useState<string | null>(null)
  const [warmup, setWarmup] = useState(false)
  const [details, setDetails] = useState(false)
  const [kindFor, setKindFor] = useState<string | null>(null)
  const [restOpen, setRestOpen] = useState(false)
  // the set that was just logged: its check pops, a new record also gets a light glow
  const [pop, setPop] = useState<{ id: string; pr: boolean } | null>(null)
  // a finished exercise folds down to one line; tapping its name opens it again
  const finished = se.sets.length > 0 && se.sets.every((x) => x.done)
  const [shut, setShut] = useState(finished)
  const wasFinished = useRef(finished)
  useEffect(() => {
    const was = wasFinished.current
    wasFinished.current = finished
    if (!finished) {
      setShut(false)
      return
    }
    if (was) return
    // let the green tick land before folding the card away
    const t = setTimeout(() => {
      setShut(true)
      setDetails(false)
      setTimeout(revealNextSet, 260)
    }, 700)
    return () => clearTimeout(t)
  }, [finished])
  useEffect(() => {
    if (!pop) return
    const t = setTimeout(() => setPop(null), 900)
    return () => clearTimeout(t)
  }, [pop])
  const showRpe = usePrefs((p) => p.showRpe)
  const tracking: Tracking = trackingOf(ex)
  const hasRunning = se.sets.some((x) => watches.has(x.id))
  useTick(hasRunning)

  const prior = useMemo(() => priorSets(db, se.exercise_id, session.id), [db.sessions, se.exercise_id, session.id])
  const last = useMemo(() => lastPerformance(db, se.exercise_id, session.id), [db.sessions, se.exercise_id, session.id])
  // the note you left on this exercise last time ("raise the seat"), if it differs from today's
  const lastNote = useMemo(() => {
    const prev = db.sessions
      .filter((x) => x.finished_at && x.id !== session.id)
      .sort((a, b) => (b.finished_at! > a.finished_at! ? 1 : -1))
      .map((x) => x.data.exercises.find((e) => e.exercise_id === se.exercise_id))
      .find(Boolean)
    const n = prev?.note?.trim()
    return n && n !== se.note.trim() ? n : null
  }, [db.sessions, se.exercise_id, session.id, se.note])
  const rec = useMemo(() => recordsFor(prior), [prior])

  function mutate(fn: (e: SessionExercise) => SessionExercise, immediate = false) {
    const cur = useStore.getState().db.sessions.find((x) => x.id === session.id)
    if (!cur) return
    const exs = cur.data.exercises.map((e, i) => (i === index ? fn(e) : e))
    save('sessions', { ...cur, data: { ...cur.data, exercises: exs } }, immediate ? undefined : { debounce: 350 })
  }
  const patchSet = (setId: string, p: Partial<SessionSet>, immediate = false) =>
    mutate((e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...p } : s)) }), immediate)

  function runningPrior(excludeId: string): SetRec[] {
    const own: SetRec[] = se.sets
      .filter((s) => s.id !== excludeId && s.done && s.reps && ELIGIBLE.has(s.kind))
      .map((s) => ({
        exercise_id: se.exercise_id,
        weight: s.weight,
        reps: s.reps!,
        kind: s.kind,
        session_id: session.id,
        date: s.done_at ?? '',
        set_id: s.id
      }))
    return [...prior, ...own]
  }

  /** `suggestedReps` is the grey number in the reps box (last time, or the bottom of the rep range). */
  function toggleDone(s: SessionSet, suggestedReps: number | null = null) {
    if (s.done) {
      patchSet(s.id, { done: false, done_at: null }, true)
      return
    }
    if (watches.has(s.id)) {
      // ticking a running timer stops it and logs what it shows
      const sec = watchSec(s.id)
      watches.delete(s.id)
      s = { ...s, time_sec: sec }
    }
    // like Hevy / Strong: ticking an empty reps box logs the suggested number shown in it
    if (tracking !== 'time' && (s.reps == null || s.reps <= 0) && suggestedReps != null && suggestedReps > 0) {
      s = { ...s, reps: suggestedReps }
    }
    const missing = missingForLog(s, tracking)
    if (missing) {
      toast({ kind: 'info', text: missing === 'time' ? 'Enter the time first' : 'Enter the reps first', sub: missing === 'time' ? 'Or start the timer. Then tap the check to log the set.' : 'Then tap the check to log the set.' })
      if (s.time_sec != null) patchSet(s.id, { time_sec: s.time_sec }, true)
      return
    }
    let isPR = false
    const celebrateKey = `${s.id}:${s.weight}:${s.reps}`
    if (tracking !== 'time' && s.reps != null && ELIGIBLE.has(s.kind) && !celebrated.has(celebrateKey)) {
      celebrated.add(celebrateKey)
      const res = evaluateSet(runningPrior(s.id), s.weight, s.reps)
      if (res.types.length) {
        isPR = true
        const label = res.types.includes('weight') ? 'Heaviest ever' : res.types.includes('e1rm') ? 'Best estimated 1-rep max' : 'Rep record'
        toast({
          kind: 'pr',
          text: `🏆 New PR! ${ex?.name ?? se.name}`,
          sub: `${setLabel(s, tracking, false)} · ${label} · est. 1-rep max ${fmtKg(Math.round(res.e1rm * 10) / 10)}`
        })
        try {
          navigator.vibrate?.([80, 60, 80, 60, 160])
        } catch {
          /* ignore */
        }
      } else if (res.nearPct) {
        toast({
          kind: 'near',
          text: `So close! ${res.nearPct}% of your best`,
          sub: `${setLabel(s, tracking, false)} on ${ex?.name ?? se.name}`
        })
      }
    }
    patchSet(s.id, { done: true, done_at: nowIso(), ...(tracking === 'time' ? { time_sec: s.time_sec } : { reps: s.reps }) }, true)
    setPop({ id: s.id, pr: isPR })
    // every logged set starts the rest timer, supersets included (the owner's call: going straight on is one tap on Skip).
    // The screen never scrolls by itself (it moved under the lifter's thumb).
    startRest(s.kind === 'warmup' ? 30 : se.rest_sec, nextSetLabel(useStore.getState().db.sessions.find((x) => x.id === session.id) ?? session, index))
    setTimeout(revealNextSet, 300)
  }

  const workNo = (i: number) => se.sets.slice(0, i + 1).filter((x) => x.kind === 'work').length
  const lastDesc = last ? last.sets.map((x) => setLabel(x, tracking)).join(' · ') : null

  const name = ex?.name ?? se.name
  const firstTime = !last && prior.length === 0 && tracking !== 'time'
  // rest has its own button on the card, so the line under the name is just the target
  const plan = tracking !== 'time' && se.rep_min && se.rep_max ? `${se.rep_min}–${se.rep_max} reps` : tracking === 'time' ? 'Timed' : 'Reps'
  const hasNotes = !!(se.note || lastNote || ex?.setup)
  const prog = se.progression
  const doneLine = `${se.sets.length} ${se.sets.length === 1 ? 'set' : 'sets'} · ${se.sets.map((x) => setLabel(x, tracking)).join(' · ')}`

  return (
    <div
      id={`ex-${index}`}
      ref={drag?.ref}
      style={drag?.style}
      className={`ex ${se.superset ? 'ss' : ''} ${current ? 'current' : ''} ${finished ? 'finished' : ''} ${shut ? 'shut' : ''}${compact ? ' compact' : ''}${lifted ? ' lifted' : ''}`}
    >
      <div className="ex-head" {...longPress(onReorder)}>
        <button className="ex-thumb" onClick={() => setInfo(true)} aria-label={`How to do ${name}`}>
          <ExerciseThumb exercise={ex} name={se.name} size={48} />
          {finished && (
            <span className="ex-tick" aria-hidden>
              <Check size={12} strokeWidth={3} />
            </span>
          )}
        </button>
        <button
          className="ex-title"
          onClick={() => (finished ? setShut((v) => !v) : setDetails((v) => !v))}
          aria-expanded={finished ? !shut : details}
          aria-label={finished ? `${name}, done. ${shut ? 'Show sets' : 'Hide sets'}` : `${name}. ${details ? 'Hide' : 'Show'} details`}
        >
          <span className="ex-name">{name}</span>
          <span className="ex-sum">
            {se.superset && (
              <span className="chip blue ex-ss" aria-label={`Superset ${se.superset}`}>
                <Link2 size={13} aria-hidden /> {se.superset}
              </span>
            )}
            {finished && shut ? (
              <span className="ex-sum-t done">{doneLine}</span>
            ) : (
              // "First time" lives in the details (and the empty Previous column): this line keeps the plan readable
              <span className="ex-sum-t">{plan}</span>
            )}
            {hasNotes && !(finished && shut) && <StickyNote size={14} className="ex-sum-i" aria-label="Has notes" />}
            <ChevronDown size={16} className={`ex-chev ${(finished ? !shut : details) ? 'up' : ''}`} aria-hidden />
          </span>
        </button>
        <button className="ex-rest" onClick={() => setRestOpen(true)} aria-label={`Rest ${se.rest_sec ? fmtRest(se.rest_sec) : 'off'} for ${name}. Change`}>
          <Timer size={15} aria-hidden />
          <span>{se.rest_sec ? fmtRest(se.rest_sec) : 'Off'}</span>
        </button>
        <button className="btn icon ghost" onClick={onMore} aria-label={`More options for ${name}`}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className={`ex-fold ${details && !finished ? '' : 'closed'}`} {...folded(!details || finished)}>
        <div>
          <div className="ex-more">
            {ex && <div className="ex-more-meta">{exerciseMeta(ex)}</div>}
            <div className="ex-more-meta">
              {plan}
              {se.superset ? ` · superset ${se.superset}: done in turns with its pair` : ''}
            </div>
            {se.note && <div className="ex-more-note">📝 {se.note}</div>}
            {lastNote && <div className="ex-more-last">💬 Last time: {lastNote}</div>}
            {ex?.setup && <div className="ex-more-setup">⚙ {ex.setup}</div>}
            {firstTime && (
              <div className="first-hint">
                {tracking === 'weight_reps' ? 'First time: pick a comfortable weight. GymLog remembers it for next time.' : 'First time: do what feels good. GymLog remembers it for next time.'}
              </div>
            )}
            {lastDesc && se.sets.length === 0 && (
              <div className="small muted">
                Last ({fmtDate(last!.date)}): <span style={{ color: 'var(--text)' }}>{lastDesc}</span>
              </div>
            )}
            {prog?.kind === 'increase' && (
              <div className="small muted">
                You hit {prog.reps.join('/')} last time, so the weight goes up {fmtKg(prog.delta)} kg (from {fmtKg(prog.from)} kg).
              </div>
            )}
            {prog?.kind === 'hold' && (
              <div className="small muted">
                Last time was {prog.reps.join('/')}. Stay at {fmtKg(prog.from)} kg and aim for {se.rep_min}+ reps on every set.
              </div>
            )}
            {rec.heaviest && tracking !== 'time' && (
              <div className="wl-best">
                <Trophy size={14} color="var(--accent)" aria-hidden />
                {tracking === 'reps' && !(rec.heaviest.weight > 0) ? (
                  <span>
                    Best <b>{Math.max(...prior.map((p) => p.reps))} reps</b>
                  </span>
                ) : (
                  <span>
                    Best <b>{fmtKg(rec.heaviest.weight)} kg × {rec.heaviest.reps}</b>
                    {tracking === 'weight_reps' && rec.bestE1rm && (
                      <> · best estimated 1-rep max <b>{fmtKg(Math.round(rec.bestE1rm.value * 10) / 10)} kg</b></>
                    )}
                  </span>
                )}
              </div>
            )}
            {ex && (
              <button className="btn sm ex-howto" onClick={() => setInfo(true)}>
                <Info size={16} /> How to do it
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`ex-fold ${shut ? 'closed' : ''}`} {...folded(shut)}>
      <div>
      {prog?.kind === 'increase' && (
        <div className={`prog ${prog.applied === false ? 'off' : ''}`}>
          <TrendingUp size={14} aria-hidden />
          <span>{prog.applied === false ? `Kept at ${fmtKg(prog.from)} kg` : `+${fmtKg(prog.delta)} kg today`}</span>
          <button onClick={() => mutate(toggleProgression, true)}>{prog.applied === false ? 'Redo' : 'Undo'}</button>
        </div>
      )}
      {prog?.kind === 'hold' && <div className="prog hold-chip">Hold {fmtKg(prog.from)} kg · aim for {se.rep_min}+ reps</div>}

      <div className={`sets t-${tracking}`}>
        <div className="set-row">
          <div className="hdr">Set</div>
          <div className="hdr">Previous</div>
          {tracking === 'time' ? (
            <div className="hdr span2">Time</div>
          ) : tracking === 'reps' ? (
            <div className="hdr span2">Reps</div>
          ) : (
          <>
          <div className="hdr">
            <button
              className="hdr-btn"
              onClick={() => setPlateSet((se.sets.find((x) => !x.done) ?? se.sets[se.sets.length - 1])?.id ?? null)}
              aria-label="Plate calculator"
            >
              kg <Disc size={12} />
            </button>
          </div>
          <div className="hdr">Reps</div>
          </>
          )}
          <div className="hdr">✓</div>
        </div>
        {se.sets.map((s, i) => {
          // "Prev" = the same kind of set from last time (so a new warm-up row does not shift everything by one)
          const kindIdx = se.sets.slice(0, i).filter((x) => x.kind === s.kind).length
          const prev = last?.sets.filter((x) => x.kind === s.kind)[kindIdx]
          // one PR hint per exercise: on the next set still to do
          const nextUndone = se.sets.findIndex((x) => !x.done && ELIGIBLE.has(x.kind))
          const need = i === nextUndone && tracking !== 'time' ? repsForPR(runningPrior(s.id), s.weight) : null
          const hintReps = need != null && need <= 20 ? need : null
          const setNo = s.kind === 'work' ? String(workNo(i)) : s.kind === 'failure' ? 'F' : s.kind === 'drop' ? 'D' : 'W'
          const nearTarget = hintReps != null && se.rep_max ? hintReps <= se.rep_max + 2 : false
          return (
            <div key={s.id} style={{ display: 'contents' }}>
              <div className={`set-row ${s.done ? 'done' : 'todo'}${pop?.id === s.id ? (pop.pr ? ' pop pr-pop' : ' pop') : ''}`}>
                <button
                  className={`kind ${s.kind}`}
                  onClick={() => setKindFor(s.id)}
                  aria-label={`Set ${setNo}, ${KIND_INFO[s.kind].t.toLowerCase()}. Change type or remove`}
                >
                  {s.kind === 'work' ? workNo(i) : s.kind === 'failure' ? 'F' : s.kind === 'drop' ? 'D' : 'W'}
                </button>
                <div className="prev">{prevLabel(prev, tracking)}</div>
                {tracking === 'time' ? (
                  <>
                    <KpField
                      spec={{
                        id: `${s.id}:time`,
                        kind: 'time',
                        value: s.time_sec ?? null,
                        placeholder: prev?.time_sec ?? null,
                        label: `Set ${setNo} · time`,
                        onChange: (sec) => patchSet(s.id, { time_sec: sec })
                      }}
                      className={`num time ${watches.has(s.id) ? 'running' : ''}`}
                      disabled={watches.has(s.id) || s.done}
                      display={watches.has(s.id) ? fmtTime(watchSec(s.id)) : undefined}
                      native={
                        <TimeInput
                          value={watches.has(s.id) ? watchSec(s.id) : s.time_sec}
                          running={watches.has(s.id)}
                          placeholder={prev?.time_sec ? fmtTime(prev.time_sec) : ''}
                          onChange={(sec) => patchSet(s.id, { time_sec: sec })}
                        />
                      }
                    />
                    <StopwatchBtn set={s} onStop={(sec) => patchSet(s.id, { time_sec: sec || null }, true)} />
                  </>
                ) : (
                <>
                {tracking === 'weight_reps' && (
                  <KgCell id={s.id} label={`Set ${setNo}`} value={s.weight} onChange={(n) => patchSet(s.id, { weight: n ?? 0 })} onLong={() => setPlateSet(s.id)} />
                )}
                <KpField
                  spec={{
                    id: `${s.id}:reps`,
                    kind: 'reps',
                    value: s.reps,
                    placeholder: prev?.reps ?? (se.rep_min || null),
                    label: `Set ${setNo} · reps`,
                    onChange: (n) => patchSet(s.id, { reps: n == null ? null : Math.round(n) })
                  }}
                  className={tracking === 'reps' ? 'num span2' : 'num'}
                  native={<NumInput
                    value={s.reps}
                    decimal={false}
                    placeholder={prev?.reps != null ? String(prev.reps) : se.rep_min ? String(se.rep_min) : ''}
                    onChange={(n) => patchSet(s.id, { reps: n == null ? null : Math.round(n) })}
                    ariaLabel="Reps"
                    className={tracking === 'reps' ? 'num span2' : 'num'}
                  />}
                />
                </>
                )}
                <button className="check" onClick={() => toggleDone(s, prev?.reps ?? (se.rep_min || null))} aria-label={s.done ? 'Undo set' : 'Log set'}>
                  <Check size={20} />
                </button>
              </div>
              {showRpe && s.done && (
                <div className="set-row" style={{ marginTop: -2 }}>
                  <div className="rpe-line">
                    <button className={`rpe-chip ${s.rpe != null ? 'set' : ''}`} onClick={() => setRpeSet(s.id)}>
                      {s.rpe != null ? `RPE ${fmtKg(s.rpe)}` : '+ RPE'}
                    </button>
                  </div>
                </div>
              )}
              {hintReps != null && nearTarget && (
                <div className="set-row" style={{ marginTop: -2 }}>
                  <div className="set-hint pr">
                    🏆 {hintReps} {hintReps === 1 ? 'rep' : 'reps'}{tracking === 'weight_reps' || s.weight > 0 ? ` at ${fmtKg(s.weight)} kg` : ''} = new PR
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showLegend && (
        <div className="set-legend">
          <span className="lg-dot">1</span> work <span className="lg-dot warmup">W</span> warm-up <span className="lg-dot drop">D</span> drop{' '}
          <span className="lg-dot failure">F</span> failure
        </div>
      )}
      <div className="wl-addrow">
        <button
          className="btn wl-addset"
          onClick={() =>
            mutate(
              (e) => {
                const lastRow = e.sets[e.sets.length - 1]
                return { ...e, sets: [...e.sets, newSet('work', lastRow ? lastRow.weight : 0)] }
              },
              true
            )
          }
        >
          <Plus size={18} /> Add set
        </button>
        {tracking === 'weight_reps' && (
        <button
          className="btn sm"
          onClick={() =>
            mutate(
              (e) => {
                const lastRow = [...e.sets].reverse().find((x) => x.kind !== 'drop') ?? e.sets[e.sets.length - 1]
                return { ...e, sets: [...e.sets, newSet('drop', roundTo((lastRow?.weight ?? 0) * 0.75, 0.5))] }
              },
              true
            )
          }
        >
          <Plus size={14} /> Drop
        </button>
        )}
        <button className="btn sm" onClick={() => setWarmup(true)}>
          <Plus size={14} /> Warm-up
        </button>
      </div>
      </div>
      </div>
      {warmup && (
        <WarmupSheet
          se={se}
          exercise={ex}
          onClose={() => setWarmup(false)}
          onApply={() => mutate((e) => addWarmupSets(e, ex) ?? e, true)}
          onAddOne={() =>
            mutate(
              (e) => {
                const firstWork = e.sets.find((x) => x.kind === 'work')
                return { ...e, sets: [newSet('warmup', roundTo((firstWork?.weight ?? 0) * 0.5, 0.5)), ...e.sets] }
              },
              true
            )
          }
        />
      )}
      {plateSet && (
        <PlateCalc
          weight={se.sets.find((x) => x.id === plateSet)?.weight ?? 0}
          onClose={() => setPlateSet(null)}
          onUse={se.sets.find((x) => x.id === plateSet && !x.done) ? (kg) => patchSet(plateSet, { weight: kg }, true) : undefined}
        />
      )}
      {rpeSet && (
        <RpeSheet
          value={se.sets.find((x) => x.id === rpeSet)?.rpe}
          onPick={(v) => patchSet(rpeSet, { rpe: v }, true)}
          onClose={() => setRpeSet(null)}
        />
      )}
      {info && ex && (
        <InfoSheet
          ex={ex}
          onClose={() => setInfo(false)}
          onOpen={() => {
            setInfo(false)
            nav(`/exercise/${ex.id}`)
          }}
        />
      )}
      {restOpen && <RestSheet name={name} value={se.rest_sec} onSet={(v) => mutate((e) => ({ ...e, rest_sec: v }), true)} onClose={() => setRestOpen(false)} />}
      {kindFor && se.sets.find((x) => x.id === kindFor) && (
        <SetTypeSheet
          set={se.sets.find((x) => x.id === kindFor)!}
          label={(() => {
            const k = se.sets.findIndex((x) => x.id === kindFor)
            const x = se.sets[k]
            return x.kind === 'work' ? `Set ${workNo(k)}` : KIND_INFO[x.kind].t
          })()}
          onPick={(kind) => {
            patchSet(kindFor, { kind }, true)
            setKindFor(null)
          }}
          onRemove={() => {
            mutate((e) => ({ ...e, sets: e.sets.filter((x) => x.id !== kindFor) }), true)
            setKindFor(null)
          }}
          onClose={() => setKindFor(null)}
        />
      )}
    </div>
  )
}

/** Live workout clock; ticks on its own so the exercise cards do not re-render every second. */
function ElapsedClock({ start }: { start: string }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const sec = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 1000))
  const h = Math.floor(sec / 3600)
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(h ? 2 : 1, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return <span className="sp-clock">{h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`}</span>
}

export default function SessionPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const session = useStore((s) => s.db.sessions.find((x) => x.id === id))
  const db = useStore((s) => s.db)
  const save = useStore((s) => s.save)
  const [, tick] = useState(0)
  const [picking, setPicking] = useState(false)
  const [moreIdx, setMoreIdx] = useState<number | null>(null)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [showMuscles, setShowMuscles] = useState(false)
  const [tools, setTools] = useState(false)
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null)
  const [planAsk, setPlanAsk] = useState<string[] | null>(null)
  const [reordering, setReordering] = useState(false)
  // long-press on an exercise: every card folds to one line and the held one follows the finger
  const [lifted, setLifted] = useState<{ from: number; y: number } | null>(null)
  const dropAt = useRef<number | null>(null)
  const dragList = useDragReorder(
    (a, b) => {
      const cur = useStore.getState().db.sessions.find((x) => x.id === id)
      if (!cur) return
      save('sessions', { ...cur, data: { ...cur.data, exercises: moved(cur.data.exercises, a, b) } })
      dropAt.current = b
    },
    () => {
      setLifted(null)
      const at = dropAt.current
      dropAt.current = null
      // back to full cards: keep the exercise you moved in view
      requestAnimationFrame(() => at != null && document.getElementById(`ex-${at}`)?.scrollIntoView({ block: 'center' }))
    }
  )
  // the cards have folded: put the held one under the finger, then pick it up
  useLayoutEffect(() => {
    if (!lifted) return
    const el = document.getElementById(`ex-${lifted.from}`)
    if (el) {
      const r = el.getBoundingClientRect()
      window.scrollBy(0, r.top + r.height / 2 - lifted.y)
    }
    dragList.start(lifted.from, lifted.y)
  }, [lifted?.from, lifted?.y])
  const removeRow = useStore((s) => s.remove)
  const toast = useStore((s) => s.toast)
  const userId = useStore((s) => s.user?.id ?? 'local')
  useWakeLock()

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 20000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (session?.finished_at) nav(`/history/${session.id}`, { replace: true })
  }, [session?.finished_at])

  if (!session) return <div className="card">Workout not found. <button className="btn sm" onClick={() => nav('/')}>Home</button></div>

  const muscles = muscleSets(session, db.exercises)
  // the set-type legend stays until the user has logged a handful of sets in total
  const loggedEver = db.sessions.reduce((a, x) => a + x.data.exercises.reduce((b, e) => b + e.sets.filter((st) => st.done).length, 0), 0)
  const volume = Math.round(sessionVolume(session))
  // the same workout last time: a number to beat
  // (plain computation: hooks cannot run after the early return above, and this is cheap)
  const prevSession = previousOfTemplate(db, session)
  const lastVolume = prevSession ? Math.round(summarizeSession(prevSession).volume) : null
  const beatLast = lastVolume != null && lastVolume > 0 && volume > lastVolume
  const doneSets = session.data.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)
  const totalSets = session.data.exercises.reduce((a, e) => a + e.sets.length, 0)
  // nothing logged: offer to discard; some sets left: ask first; all done: straight to the summary
  const finishTap = () => (doneSets === 0 ? setConfirmDiscard(true) : doneSets < totalSets ? setConfirmFinish(true) : finishOrAsk())
  // a workout from a plan whose shape changed on the way (sets, exercises, order, rest): ask before finishing
  // whether the plan should follow. Compared before finishing, while the planned rows are still there.
  const planRows = session.workout_id ? db.workout_exercises.filter((w) => w.workout_id === session.workout_id) : []
  const planWorkout = session.workout_id ? db.workouts.find((w) => w.id === session.workout_id) : undefined
  function finishOrAsk() {
    const changes = planWorkout ? planChanges(session!, planRows, (id) => db.exercises.find((e) => e.id === id)?.name ?? 'an exercise') : []
    if (changes.length) setPlanAsk(changes)
    else finishNow()
  }
  function finishNow() {
    finishSession(session!.id)
    nav(`/history/${session!.id}`, { state: { fresh: true } })
  }
  function updatePlanAndFinish() {
    const cur = useStore.getState().db.sessions.find((x) => x.id === session!.id)!
    const { save: rows, remove: gone } = planUpdate(cur, planRows, planWorkout!.id, userId)
    for (const r of rows) save('workout_exercises', r)
    for (const id of gone) removeRow('workout_exercises', id)
    toast({ kind: 'info', text: `${splitName(planWorkout!.name)[0]} updated`, sub: 'Next time it starts with these exercises and sets.' })
    finishNow()
  }
  // the exercise you are on: the first one with a set still to do
  const currentIdx = session.data.exercises.findIndex((e) => e.sets.some((s) => !s.done))

  function mutateEx(i: number, fn: (e: SessionExercise) => SessionExercise) {
    const cur = useStore.getState().db.sessions.find((x) => x.id === session!.id)!
    save('sessions', { ...cur, data: { ...cur.data, exercises: cur.data.exercises.map((e, k) => (k === i ? fn(e) : e)) } })
  }

  /** new order from the reorder sheet, as indexes into the current list */
  function reorder(order: number[]) {
    const cur = useStore.getState().db.sessions.find((x) => x.id === session!.id)!
    save('sessions', { ...cur, data: { ...cur.data, exercises: order.map((k) => cur.data.exercises[k]) } })
  }

  return (
    <KeypadProvider>
    <div className="stack" style={{ gap: 14 }}>
      <div className="sp-head">
        <div className="sp-row">
          <button className="btn icon sm ghost" onClick={() => nav('/')} aria-label="Back to workouts (keeps this workout running)">
            <ChevronLeft size={22} />
          </button>
          <div className="grow" style={{ minWidth: 0 }}>
            <h1 className="sp-name ellipsis">{splitName(session.name)[0]}</h1>
          </div>
          <button className="btn icon sm ghost" onClick={() => setTools(true)} aria-label="Tools: 1-rep max, percent of max, plates">
            <Calculator size={20} />
          </button>
          <button
            className="btn primary sp-finish"
            onClick={finishTap}
          >
            <Flag size={16} /> Finish
          </button>
        </div>
        <div className="ls-strip">
          <div className="ls-stat">
            <ElapsedClock start={session.started_at} />
            <div className="l">Duration</div>
          </div>
          <div className="ls-stat">
            <div className="v">
              {volume.toLocaleString('en-US')}
              <span className="u">kg</span>
            </div>
            <div className={`l${beatLast ? ' beat' : ''}`}>
              {beatLast ? 'Beat last time' : lastVolume ? `Last ${fmtVolume(lastVolume)}` : 'Volume'}
            </div>
          </div>
          <div className="ls-stat">
            <div className="v">
              {doneSets}
              <span className="u">/{totalSets}</span>
            </div>
            <div className="l">Sets</div>
          </div>
          <button className="ls-map" onClick={() => setShowMuscles(true)} aria-label="Sets per muscle">
            <BodyMap intensity={liveIntensity(muscles)} height={40} />
          </button>
        </div>
        <div className="sp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={doneSets}>
          <div style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>
      </div>

      {session.data.exercises.map((_, i) => (
        <ExerciseCard
          key={i + session.data.exercises[i].exercise_id}
          session={session}
          index={i}
          onReorder={(y) => session.data.exercises.length > 1 && setLifted({ from: i, y })}
          compact={lifted != null}
          drag={dragList.item(i)}
          lifted={dragList.dragging === i}
          onMore={() => setMoreIdx(i)}
          showLegend={i === 0 && loggedEver < 5}
          current={i === currentIdx}
        />
      ))}

      <button className="btn wl-addex" onClick={() => setPicking(true)}>
        <Plus size={20} /> Add exercise
      </button>
      {session.data.exercises.length > 1 && (
        <button className="btn ghost" onClick={() => setReordering(true)}>
          <GripVertical size={16} aria-hidden /> Reorder exercises
        </button>
      )}

      <label className="field">
        Workout notes
        <textarea
          className="textarea"
          placeholder="How did it feel? Anything to remember next time…"
          value={session.notes}
          onChange={(e) => save('sessions', { ...session, notes: e.target.value }, { debounce: 500 })}
        />
      </label>

      {/* the natural end of the page: finish here as well as in the header */}
      <button className="btn primary block" onClick={finishTap}>
        <Flag size={18} aria-hidden /> Finish workout
      </button>
      <button className="btn ghost danger-text" onClick={() => setConfirmDiscard(true)}>
        <Trash2 size={16} aria-hidden /> Discard workout
      </button>
      <button className="btn ghost" onClick={() => nav('/help')}>
        <HelpCircle size={18} aria-hidden /> How the workout screen works
      </button>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            addExerciseToSession(session.id, ex)
            setPicking(false)
          }}
          onPickMany={(list) => {
            for (const ex of list) addExerciseToSession(session.id, ex)
            setPicking(false)
          }}
        />
      )}

      {moreIdx != null && session.data.exercises[moreIdx] && (
        <MoreSheet
          se={session.data.exercises[moreIdx]}
          count={session.data.exercises.length}
          onClose={() => setMoreIdx(null)}
          onChange={(fn) => mutateEx(moreIdx, fn)}
          onReorder={() => {
            setMoreIdx(null)
            setReordering(true)
          }}
          onReplace={() => {
            setReplaceIdx(moreIdx)
            setMoreIdx(null)
          }}
          onRemove={() => {
            const cur = useStore.getState().db.sessions.find((x) => x.id === session.id)!
            save('sessions', { ...cur, data: { ...cur.data, exercises: cur.data.exercises.filter((_, k) => k !== moreIdx) } })
            setMoreIdx(null)
          }}
        />
      )}

      {replaceIdx != null && (
        <ExercisePicker
          title="Replace exercise"
          onClose={() => setReplaceIdx(null)}
          onPick={(ex) => {
            replaceExerciseInSession(session.id, replaceIdx, ex)
            setReplaceIdx(null)
          }}
        />
      )}

      <CoachMarks id="workout" userId={userId} steps={WORKOUT_TIPS} enabled={session.data.exercises.some((e) => e.sets.length > 0)} />
      {tools && <ToolsSheet onClose={() => setTools(false)} weight={session.data.exercises.flatMap((e) => e.sets).find((x) => !x.done && x.kind === 'work')?.weight ?? 0} />}
      {showMuscles && <MusclesSheet rows={muscles} onClose={() => setShowMuscles(false)} />}

      {confirmFinish && (
        <Confirm
          title="Finish workout?"
          text={`You logged ${doneSets} of ${totalSets} sets. The ${totalSets - doneSets} you skipped won't be saved. Skipping sets doesn't change your plan.`}
          confirmLabel="Finish"
          cancelLabel="Keep going"
          onConfirm={() => {
            finishOrAsk()
          }}
          onClose={() => setConfirmFinish(false)}
        />
      )}
      {reordering && (
        <ReorderSheet
          items={session.data.exercises.map((e) => ({ name: e.name, exercise: db.exercises.find((x) => x.id === e.exercise_id), superset: e.superset }))}
          onDone={(order) => {
            reorder(order)
            setReordering(false)
          }}
          onClose={() => setReordering(false)}
        />
      )}
      {planAsk && planWorkout && (
        <Sheet title={`Update ${splitName(planWorkout.name)[0]}?`} onClose={() => setPlanAsk(null)}>
          <div className="stack">
            <p className="confirm-text" style={{ margin: 0 }}>
              You changed this workout today. Save the changes to the plan, so next time starts the same way?
            </p>
            <ul className="plan-changes">
              {planAsk.slice(0, 6).map((c) => (
                <li key={c}>{c}</li>
              ))}
              {planAsk.length > 6 && <li>and {planAsk.length - 6} more</li>}
            </ul>
            <button className="btn primary block" onClick={updatePlanAndFinish}>
              Update the plan
            </button>
            <button className="btn block" onClick={finishNow}>
              Keep the plan as it is
            </button>
            <div className="tiny muted center">Either way, today's workout is saved as you did it.</div>
          </div>
        </Sheet>
      )}
      {confirmDiscard && (
        <Confirm
          title={doneSets === 0 ? 'No sets logged yet' : 'Discard this workout?'}
          text={doneSets === 0 ? 'There is nothing to save. Tick a set to log it, or discard this workout.' : 'Nothing from this session will be saved.'}
          confirmLabel="Discard"
          cancelLabel={doneSets === 0 ? 'Keep going' : 'Cancel'}
          danger
          onConfirm={() => {
            discardSession(session.id)
            nav('/')
          }}
          onClose={() => setConfirmDiscard(false)}
        />
      )}
    </div>
    </KeypadProvider>
  )
}

function MusclesSheet({ rows, onClose }: { rows: MuscleRow[]; onClose: () => void }) {
  const max = Math.max(1, ...rows.map((r) => r.planned))
  return (
    <Sheet title="Muscles in this workout" onClose={onClose}>
      <div className="stack">
        <div className="ls-map-lg">
          <BodyMap intensity={liveIntensity(rows)} height={190} />
        </div>
        <div className="tiny muted center">Bright = sets logged · dim = still to do</div>
        {rows.length === 0 && <div className="small muted center">Add an exercise to see which muscles it works.</div>}
        <div className="ls-rows">
          {rows.map((r) => (
            <div key={r.muscle} className="ls-row">
              <div className="name">{r.muscle}</div>
              <div className="bar" aria-hidden>
                <div className="plan" style={{ width: `${(r.planned / max) * 100}%` }} />
                <div className="done" style={{ width: `${(r.done / max) * 100}%` }} />
              </div>
              <div className="n">
                {r.done}
                <span className="muted">/{r.planned}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="tiny muted">Warm-up sets are not counted.</div>
      </div>
    </Sheet>
  )
}

/**
 * Hold a finger on an exercise's header for half a second to pick it up: the reorder list opens.
 * A scroll or a quick tap cancels it, so normal taps on the name and buttons keep working.
 */
function longPress(fire: (clientY: number) => void) {
  let t: number | undefined
  let start: { x: number; y: number } | null = null
  const cancel = () => {
    window.clearTimeout(t)
    start = null
  }
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start = { x: e.clientX, y: e.clientY }
      const y = e.clientY
      t = window.setTimeout(() => {
        start = null
        fire(y)
      }, 400)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault()
  }
}

const ROW_H = 64

/**
 * Drag the handle to move an exercise; the arrows do the same for keyboards and screen readers.
 * The new order is applied when you tap Done, so a slip of the finger is easy to undo.
 */
function ReorderSheet({
  items,
  onDone,
  onClose
}: {
  items: { name: string; exercise: Exercise | undefined; superset: string }[]
  onDone: (order: number[]) => void
  onClose: () => void
}) {
  const [order, setOrder] = useState(() => items.map((_, i) => i))
  const [drag, setDrag] = useState<{ from: number; y0: number; dy: number } | null>(null)
  const to = drag ? Math.min(order.length - 1, Math.max(0, drag.from + Math.round(drag.dy / ROW_H))) : -1
  const moveTo = (from: number, target: number) =>
    setOrder((o) => {
      const n = [...o]
      const [x] = n.splice(from, 1)
      n.splice(target, 0, x)
      return n
    })
  return (
    <Sheet title="Reorder exercises" onClose={onClose}>
      <div className="stack">
        <div className="small muted">Press an exercise and drag it up or down.</div>
        <div className="ro-list" style={{ height: order.length * ROW_H }}>
          {order.map((k, pos) => {
            const it = items[k]
            // where this row is drawn: the dragged one follows the finger, the others make room
            let shift = 0
            if (drag && pos !== drag.from) {
              if (drag.from < to && pos > drag.from && pos <= to) shift = -ROW_H
              if (drag.from > to && pos < drag.from && pos >= to) shift = ROW_H
            }
            const dragging = drag?.from === pos
            const y = pos * ROW_H + (dragging ? drag!.dy : shift)
            return (
              <div
                key={k}
                className={`ro-row${dragging ? ' dragging' : ''}`}
                style={{ transform: `translateY(${y}px)` }}
                // the whole row is the handle: press anywhere on it and drag
                onPointerDown={(e) => {
                  try {
                    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
                  } catch {
                    /* fine without capture */
                  }
                  setDrag({ from: pos, y0: e.clientY, dy: 0 })
                }}
                onPointerMove={(e) => drag && setDrag({ ...drag, dy: e.clientY - drag.y0 })}
                onPointerUp={() => {
                  if (drag && to !== drag.from) moveTo(drag.from, to)
                  setDrag(null)
                }}
                onPointerCancel={() => setDrag(null)}
              >
                <ExerciseThumb exercise={it.exercise} name={it.name} size={40} />
                <span className="grow ellipsis ro-name">
                  {it.name}
                  {it.superset && <span className="chip blue ro-ss">{it.superset}</span>}
                </span>
                <button className="sr-only" disabled={pos === 0} onClick={() => moveTo(pos, pos - 1)} aria-label={`Move ${it.name} up`}>
                  <ChevronUp size={18} aria-hidden />
                </button>
                <button className="sr-only" disabled={pos === order.length - 1} onClick={() => moveTo(pos, pos + 1)} aria-label={`Move ${it.name} down`}>
                  <ChevronDown size={18} aria-hidden />
                </button>
                <span className="ro-grip" aria-hidden>
                  <GripVertical size={20} />
                </span>
              </div>
            )
          })}
        </div>
        <button className="btn primary block" onClick={() => onDone(order)}>
          Done
        </button>
      </div>
    </Sheet>
  )
}

/** Rest for one exercise: − / + in 15 s steps and the common presets. Saves straight away. */
function RestEditor({ value, onSet }: { value: number; onSet: (sec: number) => void }) {
  const set = (v: number) => onSet(Math.min(600, Math.max(0, v)))
  return (
    <div className="stack" style={{ gap: 'var(--s3)' }}>
      <div className="exo-step big" role="group" aria-label="Rest time">
        <button className="btn icon" onClick={() => set(value - 15)} disabled={value <= 0} aria-label="15 seconds less">
          −
        </button>
        <span className="exo-step-v" aria-live="polite">
          {value ? fmtRest(value) : 'Off'}
        </span>
        <button className="btn icon" onClick={() => set(value + 15)} disabled={value >= 600} aria-label="15 seconds more">
          +
        </button>
      </div>
      <div className="chips exo-presets" role="group" aria-label="Rest presets">
        {[0, 60, 90, 120, 180].map((v) => (
          <button key={v} className={`chip${value === v ? ' active' : ''}`} aria-pressed={value === v} onClick={() => set(v)}>
            {v ? fmtRest(v) : 'Off'}
          </button>
        ))}
      </div>
    </div>
  )
}

function RestSheet({ name, value, onSet, onClose }: { name: string; value: number; onSet: (sec: number) => void; onClose: () => void }) {
  return (
    <Sheet title="Rest time" onClose={onClose}>
      <div className="stack">
        <div className="small muted">
          After each set of <b style={{ color: 'var(--text)' }}>{name}</b> the rest timer starts with this time. Applies to this workout; save it
          to the plan when you finish.
        </div>
        <RestEditor value={value} onSet={onSet} />
        <button className="btn primary block" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  )
}

function MoreSheet({
  se,
  count,
  onClose,
  onChange,
  onReorder,
  onRemove,
  onReplace
}: {
  se: SessionExercise
  count: number
  onClose: () => void
  onChange: (fn: (e: SessionExercise) => SessionExercise) => void
  onReorder: () => void
  onRemove: () => void
  onReplace: () => void
}) {
  const [kpMode, setKpMode] = useKeypadMode()
  // most used first (swap a taken machine), settings in the middle, the destructive one last
  return (
    <Sheet title={se.name} onClose={onClose}>
      <div className="stack">
        <button className="btn block" onClick={onReplace}>
          <Repeat size={16} aria-hidden /> Replace exercise
        </button>
        <div className="small muted" style={{ marginTop: -4 }}>
          Machine taken? Swap it for another one. Sets you already logged stay as they are.
        </div>

        <label className="field">
          Note for this workout
          <input className="input" value={se.note} onChange={(e) => onChange((x) => ({ ...x, note: e.target.value }))} placeholder="Seat 4, slow on the way down…" />
        </label>
        <button className="btn block" disabled={count < 2} onClick={onReorder}>
          <GripVertical size={16} aria-hidden /> Reorder exercises
        </button>
        <div className="exo-sep">
          <Toggle on={kpMode === 'app'} onChange={(v) => setKpMode(v ? 'app' : 'native')} label="Use the GymLog number pad (off = phone keyboard)" />
        </div>
        <button className="btn danger" onClick={onRemove}>
          <Trash2 size={16} aria-hidden /> Remove exercise from workout
        </button>
      </div>
    </Sheet>
  )
}
