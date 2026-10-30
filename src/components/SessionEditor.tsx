import { useEffect, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { Session, SessionSet, SetKind, trackingOf } from '../lib/types'
import { fmtClock, parseRest } from '../lib/format'
import { uid } from '../lib/uid'
import { NumInput } from './ui'
import '../styles/insights.css'
import '../styles/progress.css'

const KINDS: SetKind[] = ['work', 'warmup', 'drop', 'failure']
const KIND_TAG: Record<SetKind, string> = { work: '', warmup: 'W', drop: 'D', failure: 'F' }
const KIND_NAME: Record<SetKind, string> = { work: 'Work set', warmup: 'Warm-up', drop: 'Drop set', failure: 'To failure' }

/** ISO → value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function durationMin(s: Session): number {
  if (!s.finished_at) return 0
  return Math.max(0, Math.round((new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000))
}

/** Minutes:seconds text field ("1:30", or plain seconds "90"); tidied up on blur. */
function TimeInput({ value, onChange }: { value: number | null | undefined; onChange: (sec: number) => void }) {
  const [text, setText] = useState(value != null ? fmtClock(value) : '')
  return (
    <input
      className="input"
      inputMode="numeric"
      placeholder="0:00"
      aria-label={tr("Time (minutes:seconds)")}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d:]/g, '')
        setText(t)
        onChange(parseRest(t))
      }}
      onBlur={(e) => setText(fmtClock(parseRest(e.target.value)))}
    />
  )
}

/**
 * Edit a finished workout in place: sets, exercises, name, date, duration and notes.
 * Nothing is saved until Save; records are derived from the sessions, so they update by themselves.
 */
export function SessionEditor({ session, onDone }: { session: Session; onDone: () => void }) {
  const exercises = useStore((s) => s.db.exercises)
  const save = useStore((s) => s.save)
  const toast = useStore((s) => s.toast)
  const [draft, setDraft] = useState<Session>(() => structuredClone(session))
  const [start, setStart] = useState(toLocalInput(session.started_at))
  const [minutes, setMinutes] = useState<number | null>(durationMin(session))
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const patchEx = (i: number, fn: (sets: SessionSet[]) => SessionSet[]) =>
    setDraft((d) => ({
      ...d,
      data: { ...d.data, exercises: d.data.exercises.map((e, j) => (j === i ? { ...e, sets: fn(e.sets) } : e)) }
    }))
  const patchSet = (i: number, id: string, p: Partial<SessionSet>) => patchEx(i, (sets) => sets.map((x) => (x.id === id ? { ...x, ...p } : x)))

  function addSet(i: number) {
    patchEx(i, (sets) => {
      const last = [...sets].reverse().find((x) => x.done)
      const at = last?.done_at ?? draft.finished_at ?? draft.started_at
      return [
        ...sets,
        {
          id: uid(),
          kind: last?.kind === 'warmup' || !last ? 'work' : last.kind,
          weight: last?.weight ?? 0,
          reps: last?.reps ?? null,
          time_sec: last?.time_sec ?? null,
          done: true,
          // just after the previous set, so records are evaluated in the right order
          done_at: new Date(new Date(at).getTime() + 1000).toISOString()
        }
      ]
    })
  }

  function commit() {
    const t = new Date(start)
    if (Number.isNaN(t.getTime())) {
      toast({ kind: 'error', text: 'Pick a valid date and time' })
      return
    }
    const started_at = t.toISOString()
    const finished_at = new Date(t.getTime() + Math.max(1, minutes ?? 0) * 60000).toISOString()
    const shift = t.getTime() - new Date(session.started_at).getTime()
    const out: Session = {
      ...draft,
      name: draft.name.trim() || session.name,
      started_at,
      finished_at,
      data: {
        ...draft.data,
        exercises: draft.data.exercises
          .map((e) => ({
            ...e,
            // moving the workout moves its set times with it
            sets: e.sets.map((x) => (x.done_at && shift ? { ...x, done_at: new Date(new Date(x.done_at).getTime() + shift).toISOString() } : x))
          }))
          .filter((e) => e.sets.length > 0)
      }
    }
    save('sessions', out)
    toast({ kind: 'info', text: 'Workout updated' })
    onDone()
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <button className="btn icon ghost" onClick={onDone} aria-label={tr("Cancel editing")}>
          <X size={22} />
        </button>
        <div className="grow">
          <h1>{tr("Edit workout")}</h1>
          <div className="sub">{tr("Changes are saved when you tap Save.")}</div>
        </div>
      </div>

      <div className="card stack">
        <label className="field">
          {tr("Name")}
          <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow">
            {tr("Started")}
            <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field" style={{ width: 96 }}>
            {tr("Minutes")}
            <NumInput className="input" value={minutes} onChange={setMinutes} decimal={false} ariaLabel="Duration in minutes" />
          </label>
        </div>
        <label className="field">
          {tr("Notes")}
          <textarea className="textarea" rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder={tr("How did it go?")} />
        </label>
      </div>

      {draft.data.exercises.map((e, i) => {
        const ex = exercises.find((x) => x.id === e.exercise_id)
        const tracking = trackingOf(ex)
        const one = tracking === 'time'
        const sets = e.sets.filter((x) => x.done)
        let n = 0
        return (
          <div key={e.exercise_id + i} className="card">
            <div className="row" style={{ marginBottom: 6 }}>
              <div className="grow" style={{ fontWeight: 700 }}>
                {ex?.name ?? e.name}
              </div>
              <button
                className="btn icon sm ghost"
                aria-label={`Remove ${ex?.name ?? e.name}`}
                onClick={() => setDraft((d) => ({ ...d, data: { ...d.data, exercises: d.data.exercises.filter((_, j) => j !== i) } }))}
              >
                <Trash2 size={18} />
              </button>
            </div>
            {sets.length > 0 && (
              <div className={`ed-head${one ? ' one' : ''}`}>
                <span>{tr("Set")}</span>
                {one ? <span>{tr("Time")}</span> : <><span>{tracking === 'reps' ? '+kg' : 'kg'}</span><span>{tr("Reps")}</span></>}
                <span />
              </div>
            )}
            {sets.map((x) => {
              if (x.kind !== 'warmup' && x.kind !== 'drop' && x.kind !== 'failure') n++
              return (
                <div key={x.id} className={`ed-set${one ? ' one' : ''}`}>
                  <button
                    className="ed-kind"
                    aria-label={`${KIND_NAME[x.kind]}. Tap to change`}
                    title={KIND_NAME[x.kind]}
                    onClick={() => patchSet(i, x.id, { kind: KINDS[(KINDS.indexOf(x.kind) + 1) % KINDS.length] })}
                  >
                    {KIND_TAG[x.kind] ? <span className={`kind-tag ${x.kind}`}>{KIND_TAG[x.kind]}</span> : <span className="kind-tag">{n}</span>}
                  </button>
                  {one ? (
                    <TimeInput value={x.time_sec} onChange={(sec) => patchSet(i, x.id, { time_sec: sec })} />
                  ) : (
                    <>
                      <NumInput className="input" value={x.weight} onChange={(v) => patchSet(i, x.id, { weight: v ?? 0 })} ariaLabel="Weight in kg" placeholder="0" />
                      <NumInput className="input" value={x.reps} onChange={(v) => patchSet(i, x.id, { reps: v })} decimal={false} ariaLabel="Reps" placeholder="0" />
                    </>
                  )}
                  <button className="btn icon sm ghost" aria-label={tr("Remove set")} onClick={() => patchEx(i, (all) => all.filter((y) => y.id !== x.id))}>
                    <X size={18} />
                  </button>
                </div>
              )
            })}
            <button className="btn sm ghost" style={{ marginTop: 6 }} onClick={() => addSet(i)}>
              <Plus size={16} /> {tr("Add set")}
            </button>
          </div>
        )
      })}
      {draft.data.exercises.length === 0 && <div className="card small muted">{tr("No exercises left. Save to keep an empty workout, or Cancel.")}</div>}
      <div className="tiny muted center">{tr("Tap a set number to switch between work, warm-up, drop and failure.")}</div>

      <div className="ed-bar">
        <button className="btn" onClick={onDone}>
          {tr("Cancel")}
        </button>
        <button className="btn primary" onClick={commit}>
          {tr("Save")}
        </button>
      </div>
    </div>
  )
}
