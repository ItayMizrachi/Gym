import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronDown, ChevronUp, Info, MoreHorizontal, Plus, Flag, Trash2, Timer } from 'lucide-react'
import { useStore } from '../lib/store'
import { Session, SessionExercise, SessionSet, SetKind } from '../lib/types'
import { addExerciseToSession, discardSession, finishSession, newSet } from '../lib/actions'
import { evaluateSet, lastPerformance, priorSets, recordsFor, repsForPR, SetRec, e1rm } from '../lib/pr'
import { fmtDate, fmtDuration, fmtKg, fmtRest, parseRest, roundTo } from '../lib/format'
import { ExercisePicker } from '../components/ExercisePicker'
import { Confirm, NumInput, Sheet, Thumb, useImageUrl } from '../components/ui'
import { nowIso } from '../lib/uid'

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

function shortSet(s: SessionSet): string {
  const p = s.kind === 'drop' ? 'D ' : s.kind === 'warmup' ? 'W ' : s.kind === 'failure' ? 'F ' : ''
  return `${p}${fmtKg(s.weight)}×${s.reps}`
}

function InfoSheet({ ex, onClose, onOpen }: { ex: any; onClose: () => void; onOpen: () => void }) {
  const url = useImageUrl(ex.image_path)
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
            <div className="tiny muted">SETUP</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{ex.setup}</div>
          </div>
        )}
        {ex.notes && (
          <div className="card">
            <div className="tiny muted">NOTES</div>
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

function ExerciseCard({ session, index, onMore }: { session: Session; index: number; onMore: () => void }) {
  const nav = useNavigate()
  const se = session.data.exercises[index]
  const db = useStore((s) => s.db)
  const save = useStore((s) => s.save)
  const toast = useStore((s) => s.toast)
  const startRest = useStore((s) => s.startRest)
  const ex = db.exercises.find((e) => e.id === se.exercise_id)
  const [info, setInfo] = useState(false)

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
    if (s.reps == null || s.reps <= 0) {
      toast({ kind: 'info', text: 'Enter the reps first', sub: 'Then tap the check to log the set.' })
      return
    }
    const celebrateKey = `${s.id}:${s.weight}:${s.reps}`
    if (ELIGIBLE.has(s.kind) && !celebrated.has(celebrateKey)) {
      celebrated.add(celebrateKey)
      const res = evaluateSet(runningPrior(s.id), s.weight, s.reps)
      if (res.types.length) {
        const label = res.types.includes('weight') ? 'Heaviest ever' : res.types.includes('e1rm') ? 'Estimated 1RM record' : 'Rep record'
        toast({
          kind: 'pr',
          text: `🏆 New PR! ${ex?.name ?? se.name}`,
          sub: `${fmtKg(s.weight)} kg × ${s.reps} · ${label} · est. 1RM ${fmtKg(Math.round(res.e1rm * 10) / 10)}`
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
          sub: `${fmtKg(s.weight)} kg × ${s.reps} on ${ex?.name ?? se.name}`
        })
      }
    }
    patchSet(s.id, { done: true, done_at: nowIso() }, true)
    startRest(s.kind === 'warmup' ? 30 : se.rest_sec, ex?.name ?? se.name)
  }

  const workNo = (i: number) => se.sets.slice(0, i + 1).filter((x) => x.kind === 'work').length
  const lastDesc = last ? last.sets.map(shortSet).join(' · ') : null

  return (
    <div className={`ex ${se.superset ? 'ss' : ''}`}>
      <div className="ex-head">
        <button onClick={() => setInfo(true)} aria-label="Exercise info">
          <Thumb path={ex?.image_path} />
        </button>
        <div className="grow" onClick={() => setInfo(true)}>
          <div className="ex-name">{ex?.name ?? se.name}</div>
          <div className="row small muted" style={{ gap: 6, flexWrap: 'wrap' }}>
            {se.superset && <span className="chip blue">Superset {se.superset}</span>}
            <span>
              {se.rep_min && se.rep_max ? `${se.rep_min}–${se.rep_max} reps · ` : ''}rest {fmtRest(se.rest_sec)}
            </span>
          </div>
        </div>
        <button className="btn icon sm" onClick={() => setInfo(true)} aria-label="Info">
          <Info size={16} />
        </button>
        <button className="btn icon sm" onClick={onMore} aria-label="More">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {(se.note || ex?.setup) && (
        <div className="small" style={{ marginTop: 8, color: 'var(--warn)' }}>
          {se.note && <div>📝 {se.note}</div>}
          {ex?.setup && <div style={{ color: 'var(--muted)' }}>⚙ {ex.setup}</div>}
        </div>
      )}
      {lastDesc && (
        <div className="small muted" style={{ marginTop: 6 }}>
          Last ({fmtDate(last!.date)}): <span style={{ color: 'var(--text)' }}>{lastDesc}</span>
        </div>
      )}
      {rec.heaviest && (
        <div className="row" style={{ marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
          <span className="chip pr">🏆 {fmtKg(rec.heaviest.weight)}×{rec.heaviest.reps}</span>
          {rec.bestE1rm && <span className="chip pr">1RM ~{fmtKg(Math.round(rec.bestE1rm.value * 10) / 10)}</span>}
        </div>
      )}

      <div className="sets">
        <div className="set-row">
          <div className="hdr">Set</div>
          <div className="hdr">Prev</div>
          <div className="hdr">kg</div>
          <div className="hdr">Reps</div>
          <div className="hdr">✓</div>
        </div>
        {se.sets.map((s, i) => {
          // "Prev" = the same kind of set from last time (so a new warm-up row does not shift everything by one)
          const kindIdx = se.sets.slice(0, i).filter((x) => x.kind === s.kind).length
          const prev = last?.sets.filter((x) => x.kind === s.kind)[kindIdx]
          // one PR hint per exercise: on the next set still to do
          const nextUndone = se.sets.findIndex((x) => !x.done && ELIGIBLE.has(x.kind))
          const need = i === nextUndone ? repsForPR(runningPrior(s.id), s.weight) : null
          const hintReps = need != null && need <= 20 ? need : null
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
                <div className="prev">{prev && prev.reps != null ? `${fmtKg(prev.weight)}×${prev.reps}` : '–'}</div>
                <NumInput value={s.weight} onChange={(n) => patchSet(s.id, { weight: n ?? 0 })} ariaLabel="Weight kg" />
                <NumInput
                  value={s.reps}
                  decimal={false}
                  placeholder={prev?.reps != null ? String(prev.reps) : se.rep_min ? String(se.rep_min) : ''}
                  onChange={(n) => patchSet(s.id, { reps: n == null ? null : Math.round(n) })}
                  ariaLabel="Reps"
                />
                <button className="check" onClick={() => toggleDone(s)} aria-label={s.done ? 'Undo set' : 'Log set'}>
                  <Check size={20} />
                </button>
              </div>
              {hintReps != null && nearTarget && (
                <div className="set-row" style={{ marginTop: -2 }}>
                  <div className="set-hint pr">
                    🏆 {hintReps} {hintReps === 1 ? 'rep' : 'reps'} at {fmtKg(s.weight)} kg = new PR
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        <button
          className="btn sm"
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
          <Plus size={14} /> Set
        </button>
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
  useWakeLock()

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 20000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (session?.finished_at) nav(`/history/${session.id}`, { replace: true })
  }, [session?.finished_at])

  if (!session) return <div className="card">Workout not found. <button className="btn sm" onClick={() => nav('/')}>Home</button></div>

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
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head" style={{ position: 'sticky', top: 'var(--safe-t)', zIndex: 15, background: 'var(--bg)', padding: '8px 0', margin: 0 }}>
        <div className="grow">
          <h1 style={{ fontSize: 22 }} className="ellipsis">{session.name}</h1>
          <div className="sub">
            {fmtDuration(session.started_at, null)} · {doneSets}/{totalSets} sets
          </div>
        </div>
        <button
          className="btn primary"
          onClick={() => (doneSets === 0 ? setConfirmDiscard(true) : doneSets < totalSets ? setConfirmFinish(true) : (finishSession(session.id), nav(`/history/${session.id}`, { state: { fresh: true } })))}
        >
          <Flag size={16} /> Finish
        </button>
      </div>

      {session.data.exercises.map((_, i) => (
        <ExerciseCard key={i + session.data.exercises[i].exercise_id} session={session} index={i} onMore={() => setMoreIdx(i)} />
      ))}

      <button className="btn" onClick={() => setPicking(true)}>
        <Plus size={18} /> Add exercise
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
        <button className="btn danger" onClick={onRemove}>
          <Trash2 size={16} /> Remove exercise from workout
        </button>
      </div>
    </Sheet>
  )
}
