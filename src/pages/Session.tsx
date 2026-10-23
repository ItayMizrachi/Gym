import { fmtVolume, previousOfTemplate, summarizeSession } from '../lib/stats'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronDown, ChevronLeft, ChevronUp, Disc, MoreHorizontal, Plus, Flag, Trash2, TrendingUp, HelpCircle, Play, Square, Trophy, Calculator, Repeat, StickyNote, Info, Link2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Session, SessionExercise, SessionSet, SetKind, Tracking, trackingOf } from '../lib/types'
import { fmtTime, missingForLog, parseTime, prevLabel, setLabel } from '../lib/tracking'
import { nextInSuperset } from '../lib/superset'
import { addExerciseToSession, replaceExerciseInSession, addWarmupSets, discardSession, finishSession, newSet, toggleProgression } from '../lib/actions'
import { evaluateSet, lastPerformance, priorSets, recordsFor, repsForPR, SetRec, e1rm } from '../lib/pr'
import { fmtDate, fmtDuration, fmtKg, fmtRest, roundTo, splitName } from '../lib/format'
import { ExercisePicker } from '../components/ExercisePicker'
import { Confirm, NumInput, Sheet, Toggle } from '../components/ui'
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

const KIND_ORDER: SetKind[] = ['work', 'failure', 'drop', 'warmup']
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
  { target: '.ex .set-row .kind', title: 'Set type', text: 'Tap the set number to switch between work, warm-up (W), drop (D) and failure (F).' },
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

function ExerciseCard({ session, index, onMore, showLegend, current }: { session: Session; index: number; onMore: () => void; showLegend?: boolean; current?: boolean }) {
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
    if (s.kind !== 'warmup' && se.superset) {
      const next = nextInSuperset(useStore.getState().db.sessions.find((x) => x.id === session.id) ?? session, index)
      if (next != null) {
        // superset: no rest before the paired exercise; rest only at the end of the round.
        // The screen never scrolls by itself (it moved under the lifter's thumb).
        useStore.getState().clearRest()
        return
      }
    }
    startRest(s.kind === 'warmup' ? 30 : se.rest_sec, nextSetLabel(useStore.getState().db.sessions.find((x) => x.id === session.id) ?? session, index))
    setTimeout(revealNextSet, 300)
  }

  const workNo = (i: number) => se.sets.slice(0, i + 1).filter((x) => x.kind === 'work').length
  const lastDesc = last ? last.sets.map((x) => setLabel(x, tracking)).join(' · ') : null

  const name = ex?.name ?? se.name
  const firstTime = !last && prior.length === 0 && tracking !== 'time'
  const plan = `${tracking !== 'time' && se.rep_min && se.rep_max ? `${se.rep_min}–${se.rep_max} reps · ` : ''}rest ${fmtRest(se.rest_sec)}`
  const hasNotes = !!(se.note || lastNote || ex?.setup)
  const prog = se.progression
  const doneLine = `${se.sets.length} ${se.sets.length === 1 ? 'set' : 'sets'} · ${se.sets.map((x) => setLabel(x, tracking)).join(' · ')}`

  return (
    <div
      id={`ex-${index}`}
      className={`ex ${se.superset ? 'ss' : ''} ${current ? 'current' : ''} ${finished ? 'finished' : ''} ${shut ? 'shut' : ''}`}
    >
      <div className="ex-head">
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
              {se.superset ? ` · superset ${se.superset}: go straight to the paired exercise, rest after the round` : ''}
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
                  onClick={() => patchSet(s.id, { kind: KIND_ORDER[(KIND_ORDER.indexOf(s.kind) + 1) % KIND_ORDER.length] }, true)}
                  aria-label={`Set type ${s.kind}, tap to change`}
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

/**
 * What the rest bar and the rest-over alert point to: the next set of this exercise, else the next
 * exercise with sets left (in a superset round, the first of the group), else anything left.
 */
function nextSetLabel(session: Session, index: number): string {
  const exs = session.data.exercises
  const open = (i: number) => exs[i]?.sets.findIndex((x) => !x.done) ?? -1
  const group = exs[index]?.superset
  const order = [
    ...(group ? exs.map((e, i) => (e.superset === group ? i : -1)).filter((i) => i >= 0) : [index]),
    ...exs.map((_, i) => i).filter((i) => i > index),
    ...exs.map((_, i) => i).filter((i) => i < index)
  ]
  for (const i of order) {
    const k = open(i)
    if (k >= 0) return `${exs[i].name} · Set ${k + 1} of ${exs[i].sets.length}`
  }
  return 'All sets logged'
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
  // the exercise you are on: the first one with a set still to do
  const currentIdx = session.data.exercises.findIndex((e) => e.sets.some((s) => !s.done))

  function mutateEx(i: number, fn: (e: SessionExercise) => SessionExercise) {
    const cur = useStore.getState().db.sessions.find((x) => x.id === session!.id)!
    save('sessions', { ...cur, data: { ...cur.data, exercises: cur.data.exercises.map((e, k) => (k === i ? fn(e) : e)) } })
  }

  function move(i: number, dir: -1 | 1) {
    const cur = useStore.getState().db.sessions.find((x) => x.id === session!.id)!
    const arr = [...cur.data.exercises]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    save('sessions', { ...cur, data: { ...cur.data, exercises: arr } })
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
            onClick={() => (doneSets === 0 ? setConfirmDiscard(true) : doneSets < totalSets ? setConfirmFinish(true) : (finishSession(session.id), nav(`/history/${session.id}`, { state: { fresh: true } })))}
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
          onMore={() => setMoreIdx(i)}
          showLegend={i === 0 && loggedEver < 5}
          current={i === currentIdx}
        />
      ))}

      <button className="btn wl-addex" onClick={() => setPicking(true)}>
        <Plus size={20} /> Add exercise
      </button>

      <label className="field">
        Workout notes
        <textarea
          className="textarea"
          placeholder="How did it feel? Anything to remember next time…"
          value={session.notes}
          onChange={(e) => save('sessions', { ...session, notes: e.target.value }, { debounce: 500 })}
        />
      </label>

      <button className="btn danger" onClick={() => setConfirmDiscard(true)}>
        <Trash2 size={16} /> Discard workout
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
          index={moreIdx}
          count={session.data.exercises.length}
          onClose={() => setMoreIdx(null)}
          onChange={(fn) => mutateEx(moreIdx, fn)}
          onMove={(d) => {
            move(moreIdx, d)
            setMoreIdx(moreIdx + d)
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
          text={`${totalSets - doneSets} planned set${totalSets - doneSets === 1 ? '' : 's'} not logged will be dropped from this workout.`}
          confirmLabel="Finish"
          onConfirm={() => {
            finishSession(session.id)
            nav(`/history/${session.id}`, { state: { fresh: true } })
          }}
          onClose={() => setConfirmFinish(false)}
        />
      )}
      {confirmDiscard && (
        <Confirm
          title="Discard this workout?"
          text="Nothing from this session will be saved."
          confirmLabel="Discard"
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

function MoreSheet({
  se,
  index,
  count,
  onClose,
  onChange,
  onMove,
  onRemove,
  onReplace
}: {
  se: SessionExercise
  index: number
  count: number
  onClose: () => void
  onChange: (fn: (e: SessionExercise) => SessionExercise) => void
  onMove: (d: -1 | 1) => void
  onRemove: () => void
  onReplace: () => void
}) {
  const [kpMode, setKpMode] = useKeypadMode()
  const setRest = (sec: number) => onChange((e) => ({ ...e, rest_sec: Math.min(600, Math.max(0, sec)) }))
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

        <div className="exo-rest">
          <div className="grow">
            <div>Rest</div>
            <div className="small muted">For this exercise, in this workout</div>
          </div>
          <div className="exo-step" role="group" aria-label="Rest time">
            <button className="btn icon" onClick={() => setRest(se.rest_sec - 15)} disabled={se.rest_sec <= 0} aria-label="15 seconds less">
              −
            </button>
            <span className="exo-step-v" aria-live="polite">
              {se.rest_sec ? fmtRest(se.rest_sec) : 'Off'}
            </span>
            <button className="btn icon" onClick={() => setRest(se.rest_sec + 15)} disabled={se.rest_sec >= 600} aria-label="15 seconds more">
              +
            </button>
          </div>
        </div>
        <div className="chips" role="group" aria-label="Rest presets">
          {[60, 90, 120, 180].map((v) => (
            <button key={v} className={`chip${se.rest_sec === v ? ' active' : ''}`} aria-pressed={se.rest_sec === v} onClick={() => setRest(v)}>
              {fmtRest(v)}
            </button>
          ))}
        </div>

        <label className="field">
          Note for this workout
          <input className="input" value={se.note} onChange={(e) => onChange((x) => ({ ...x, note: e.target.value }))} placeholder="Seat 4, slow on the way down…" />
        </label>
        <div className="row">
          <button className="btn grow" disabled={index === 0} onClick={() => onMove(-1)}>
            <ChevronUp size={16} aria-hidden /> Move up
          </button>
          <button className="btn grow" disabled={index === count - 1} onClick={() => onMove(1)}>
            <ChevronDown size={16} aria-hidden /> Move down
          </button>
        </div>
        <button className="btn ghost" disabled={se.sets.length === 0} onClick={() => onChange((e) => ({ ...e, sets: e.sets.slice(0, -1) }))}>
          Remove last set row
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
