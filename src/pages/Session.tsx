import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronDown, ChevronLeft, ChevronUp, Disc, MoreHorizontal, Plus, Flag, Trash2, Timer, TrendingUp, HelpCircle, Play, Square } from 'lucide-react'
import { useStore } from '../lib/store'
import { Session, SessionExercise, SessionSet, SetKind, Tracking, trackingOf } from '../lib/types'
import { fmtTime, missingForLog, parseTime, prevLabel, setLabel } from '../lib/tracking'
import { addExerciseToSession, discardSession, finishSession, newSet, toggleProgression } from '../lib/actions'
import { evaluateSet, lastPerformance, priorSets, recordsFor, repsForPR, SetRec, e1rm } from '../lib/pr'
import { fmtDate, fmtDuration, fmtKg, fmtRest, parseRest, roundTo } from '../lib/format'
import { ExercisePicker } from '../components/ExercisePicker'
import { Confirm, NumInput, Sheet, Toggle, useImageUrl } from '../components/ui'
import { exerciseMeta } from '../lib/exerciseFilters'
import { nowIso } from '../lib/uid'
import { PlateCalc } from '../components/PlateCalc'
import { BodyMap } from '../components/BodyMap'
import { ExerciseThumb, exerciseImagePath } from '../components/ExerciseImage'
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
  const url = useImageUrl(exerciseImagePath(ex))
  const db = useStore((s) => s.db)
  const rec = useMemo(() => recordsFor(priorSets(db, ex.id)), [db, ex.id])
  return (
    <Sheet title={ex.name} onClose={onClose}>
      <div className="stack">
        {url ? (
          <div className="thumb lg">
            <img src={url} alt="" />
          </div>
        ) : (
          <div className="muted small">No photo yet. Add one from the exercise page.</div>
        )}
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
            {rec.bestE1rm && <> · best est. 1RM <b style={{ color: 'var(--text)' }}>{fmtKg(Math.round(rec.bestE1rm.value * 10) / 10)}</b></>}
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

function ExerciseCard({ session, index, onMore, showLegend }: { session: Session; index: number; onMore: () => void; showLegend?: boolean }) {
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
  const showRpe = usePrefs((p) => p.showRpe)
  const tracking: Tracking = trackingOf(ex)
  const hasRunning = se.sets.some((x) => watches.has(x.id))
  useTick(hasRunning)

  const prior = useMemo(() => priorSets(db, se.exercise_id, session.id), [db.sessions, se.exercise_id, session.id])
  const last = useMemo(() => lastPerformance(db, se.exercise_id, session.id), [db.sessions, se.exercise_id, session.id])
  const rec = useMemo(() => recordsFor(prior), [prior])

  function mutate(fn: (e: SessionExercise) => SessionExercise, immediate = false) {
    const cur = useStore.getState().db.sessions.find((x) => x.id === session.id)
    if (!cur) return
    const exs = cur.data.exercises.map((e, i) => (i === index ? fn(e) : e))
    save('sessions', { ...cur, data: { exercises: exs } }, immediate ? undefined : { debounce: 350 })
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

  function toggleDone(s: SessionSet) {
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
    const missing = missingForLog(s, tracking)
    if (missing) {
      toast({ kind: 'info', text: missing === 'time' ? 'Enter the time first' : 'Enter the reps first', sub: missing === 'time' ? 'Or start the timer. Then tap the check to log the set.' : 'Then tap the check to log the set.' })
      if (s.time_sec != null) patchSet(s.id, { time_sec: s.time_sec }, true)
      return
    }
    const celebrateKey = `${s.id}:${s.weight}:${s.reps}`
    if (tracking !== 'time' && s.reps != null && ELIGIBLE.has(s.kind) && !celebrated.has(celebrateKey)) {
      celebrated.add(celebrateKey)
      const res = evaluateSet(runningPrior(s.id), s.weight, s.reps)
      if (res.types.length) {
        const label = res.types.includes('weight') ? 'Heaviest ever' : res.types.includes('e1rm') ? 'Estimated 1RM record' : 'Rep record'
        toast({
          kind: 'pr',
          text: `🏆 New PR! ${ex?.name ?? se.name}`,
          sub: `${setLabel(s, tracking, false)} · ${label} · est. 1RM ${fmtKg(Math.round(res.e1rm * 10) / 10)}`
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
    patchSet(s.id, { done: true, done_at: nowIso(), ...(tracking === 'time' ? { time_sec: s.time_sec } : {}) }, true)
    startRest(s.kind === 'warmup' ? 30 : se.rest_sec, ex?.name ?? se.name)
  }

  const workNo = (i: number) => se.sets.slice(0, i + 1).filter((x) => x.kind === 'work').length
  const lastDesc = last ? last.sets.map((x) => setLabel(x, tracking)).join(' · ') : null

  return (
    <div className={`ex ${se.superset ? 'ss' : ''}`}>
      <div className="ex-head">
        <button onClick={() => setInfo(true)} aria-label="Exercise info">
          <ExerciseThumb exercise={ex} name={se.name} size={48} />
        </button>
        <div className="grow" onClick={() => setInfo(true)}>
          <div className="ex-name">{ex?.name ?? se.name}</div>
          {ex && <div className="wl-meta ellipsis">{exerciseMeta(ex)}</div>}
          <div className="wl-plan">
            {se.superset && <span className="chip blue">Superset {se.superset}</span>}
            <span>
              {tracking !== 'time' && se.rep_min && se.rep_max ? `${se.rep_min}–${se.rep_max} reps · ` : ''}rest {fmtRest(se.rest_sec)}
            </span>
          </div>
        </div>
        <button className="btn icon ghost" onClick={onMore} aria-label={`More options for ${ex?.name ?? se.name}`}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      {(se.note || ex?.setup) && (
        <div className="small" style={{ marginTop: 8, color: 'var(--warn)' }}>
          {se.note && <div>📝 {se.note}</div>}
          {ex?.setup && <div style={{ color: 'var(--muted)' }}>⚙ {ex.setup}</div>}
        </div>
      )}
      {!last && prior.length === 0 && tracking !== 'time' && (
        <div className="first-hint">
          {tracking === 'weight_reps' ? 'First time: pick a comfortable weight. GymLog remembers it for next time.' : 'First time: do what feels good. GymLog remembers it for next time.'}
        </div>
      )}
      {lastDesc && (
        <div className="small muted" style={{ marginTop: 6 }}>
          Last ({fmtDate(last!.date)}): <span style={{ color: 'var(--text)' }}>{lastDesc}</span>
        </div>
      )}
      {se.progression?.kind === 'increase' && (
        <div className={`prog ${se.progression.applied === false ? 'off' : ''}`}>
          <TrendingUp size={14} />
          <span>
            {se.progression.applied === false
              ? `Kept at ${fmtKg(se.progression.from)} kg`
              : `+${fmtKg(se.progression.delta)} kg: you hit ${se.progression.reps.join('/')} last time`}
          </span>
          <button onClick={() => mutate(toggleProgression, true)}>{se.progression.applied === false ? 'Redo' : 'Undo'}</button>
        </div>
      )}
      {se.progression?.kind === 'hold' && (
        <div className="hold">
          Hold {fmtKg(se.progression.from)} kg: last time was {se.progression.reps.join('/')}, aim for {se.rep_min}+ on every set.
        </div>
      )}
      {rec.heaviest && tracking !== 'time' && (
        <div className="row" style={{ marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
          {tracking === 'reps' && !(rec.heaviest.weight > 0) ? (
            <span className="chip pr">🏆 {Math.max(...prior.map((p) => p.reps))} reps</span>
          ) : (
            <span className="chip pr">🏆 {fmtKg(rec.heaviest.weight)}×{rec.heaviest.reps}</span>
          )}
          {tracking === 'weight_reps' && rec.bestE1rm && <span className="chip pr">1RM ~{fmtKg(Math.round(rec.bestE1rm.value * 10) / 10)}</span>}
        </div>
      )}

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
              <div className={`set-row ${s.done ? 'done' : ''}`}>
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
                <button className="check" onClick={() => toggleDone(s)} aria-label={s.done ? 'Undo set' : 'Log set'}>
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
        <button
          className="btn sm"
          onClick={() =>
            mutate(
              (e) => {
                const firstWork = e.sets.find((x) => x.kind === 'work')
                return { ...e, sets: [newSet('warmup', roundTo((firstWork?.weight ?? 0) * 0.5, 0.5)), ...e.sets] }
              },
              true
            )
          }
        >
          <Plus size={14} /> Warm-up
        </button>
      </div>
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
  const doneSets = session.data.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)
  const totalSets = session.data.exercises.reduce((a, e) => a + e.sets.length, 0)

  function mutateEx(i: number, fn: (e: SessionExercise) => SessionExercise) {
    const cur = useStore.getState().db.sessions.find((x) => x.id === session!.id)!
    save('sessions', { ...cur, data: { exercises: cur.data.exercises.map((e, k) => (k === i ? fn(e) : e)) } })
  }

  function move(i: number, dir: -1 | 1) {
    const cur = useStore.getState().db.sessions.find((x) => x.id === session!.id)!
    const arr = [...cur.data.exercises]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    save('sessions', { ...cur, data: { exercises: arr } })
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
            <div className="sp-name ellipsis">{session.name}</div>
          </div>
          <button className="btn icon sm ghost" onClick={() => nav('/help')} aria-label="How it works">
            <HelpCircle size={20} />
          </button>
          <button
            className="btn primary"
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
            <div className="l">Volume</div>
          </div>
          <div className="ls-stat">
            <div className="v">
              {doneSets}
              <span className="u">/{totalSets}</span>
            </div>
            <div className="l">Sets</div>
          </div>
          <button className="ls-map" onClick={() => setShowMuscles(true)} aria-label="Sets per muscle">
            <BodyMap intensity={liveIntensity(muscles)} height={46} />
          </button>
        </div>
        <div className="sp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={doneSets}>
          <div style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>
      </div>

      {session.data.exercises.map((_, i) => (
        <ExerciseCard key={i + session.data.exercises[i].exercise_id} session={session} index={i} onMore={() => setMoreIdx(i)} showLegend={i === 0 && loggedEver < 5} />
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
          onRemove={() => {
            const cur = useStore.getState().db.sessions.find((x) => x.id === session.id)!
            save('sessions', { ...cur, data: { exercises: cur.data.exercises.filter((_, k) => k !== moreIdx) } })
            setMoreIdx(null)
          }}
        />
      )}

      <CoachMarks id="workout" userId={userId} steps={WORKOUT_TIPS} enabled={session.data.exercises.some((e) => e.sets.length > 0)} />
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
  onRemove
}: {
  se: SessionExercise
  index: number
  count: number
  onClose: () => void
  onChange: (fn: (e: SessionExercise) => SessionExercise) => void
  onMove: (d: -1 | 1) => void
  onRemove: () => void
}) {
  const [rest, setRest] = useState(fmtRest(se.rest_sec))
  const [kpMode, setKpMode] = useKeypadMode()
  return (
    <Sheet title={se.name} onClose={onClose}>
      <div className="stack">
        <label className="field">
          Rest for this exercise (m:ss), applies to this workout
          <div className="row">
            <input className="input" value={rest} onChange={(e) => setRest(e.target.value)} inputMode="numeric" />
            <button className="btn" onClick={() => onChange((e) => ({ ...e, rest_sec: parseRest(rest) }))}>
              <Timer size={16} /> Set
            </button>
          </div>
        </label>
        <label className="field">
          Note for this workout
          <input className="input" value={se.note} onChange={(e) => onChange((x) => ({ ...x, note: e.target.value }))} />
        </label>
        <div className="row">
          <button className="btn grow" disabled={index === 0} onClick={() => onMove(-1)}>
            <ChevronUp size={16} /> Move up
          </button>
          <button className="btn grow" disabled={index === count - 1} onClick={() => onMove(1)}>
            <ChevronDown size={16} /> Move down
          </button>
        </div>
        <button
          className="btn"
          disabled={se.sets.length === 0}
          onClick={() => onChange((e) => ({ ...e, sets: e.sets.slice(0, -1) }))}
        >
          Remove last set row
        </button>
        <Toggle on={kpMode === 'app'} onChange={(v) => setKpMode(v ? 'app' : 'native')} label="Use the GymLog number pad (off = phone keyboard)" />
        <button className="btn danger" onClick={onRemove}>
          <Trash2 size={16} /> Remove exercise from workout
        </button>
      </div>
    </Sheet>
  )
}
