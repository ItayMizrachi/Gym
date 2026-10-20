import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Dumbbell, Folder, Link2, Plus, Trash2 } from 'lucide-react'
import { MoveToFolderSheet } from '../components/FolderSheet'
import { folderOf, NO_FOLDER } from '../lib/folders'
import { useStore } from '../lib/store'
import { duplicateWorkout, removeWorkout } from '../lib/actions'
import { ExercisePicker } from '../components/ExercisePicker'
import { Confirm, Empty, NumInput, Thumb, Toggle } from '../components/ui'
import { fmtKg, fmtRest, parseRest } from '../lib/format'
import { uid } from '../lib/uid'
import { WorkoutExercise } from '../lib/types'

const GROUPS = ['', 'A', 'B', 'C', 'D']

function RestInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(fmtRest(value))
  const [focus, setFocus] = useState(false)
  return (
    <input
      className="num"
      inputMode="numeric"
      value={focus ? text : fmtRest(value)}
      onFocus={(e) => {
        setFocus(true)
        setText(fmtRest(value))
        e.target.select()
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocus(false)
        onChange(parseRest(text))
      }}
      aria-label="Rest (m:ss)"
    />
  )
}

export default function WorkoutEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const save = useStore((s) => s.save)
  const user = useStore((s) => s.user)
  const [picking, setPicking] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [movingFolder, setMovingFolder] = useState(false)

  const w = db.workouts.find((x) => x.id === id)
  if (!w)
    return (
      <div className="card">
        Workout not found.{' '}
        <button className="btn sm" onClick={() => nav('/')}>
          Back
        </button>
      </div>
    )
  const wes = db.workout_exercises.filter((x) => x.workout_id === w.id).sort((a, b) => a.position - b.position)

  function patch(we: WorkoutExercise, p: Partial<WorkoutExercise>) {
    save('workout_exercises', { ...we, ...p }, { debounce: 400 })
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= wes.length) return
    const a = wes[i]
    const b = wes[j]
    save('workout_exercises', { ...a, position: b.position })
    save('workout_exercises', { ...b, position: a.position })
  }

  const totalSets = wes.reduce((a, x) => a + x.sets, 0)

  // consecutive exercises sharing a superset label are drawn as one group on a blue rail
  const blocks: { label: string; items: { we: WorkoutExercise; i: number }[] }[] = []
  wes.forEach((we, i) => {
    const prev = blocks[blocks.length - 1]
    if (we.superset && prev && prev.label === we.superset) prev.items.push({ we, i })
    else blocks.push({ label: we.superset, items: [{ we, i }] })
  })

  const row = (we: WorkoutExercise, i: number) => {
    const ex = db.exercises.find((e) => e.id === we.exercise_id)
    const reps = we.rep_min === we.rep_max ? `${we.rep_min}` : `${we.rep_min}–${we.rep_max}`
    return (
      <div key={we.id} className={`we-card ${we.superset ? 'ss' : ''} ${open === we.id ? 'open' : ''}`}>
        <div className="we-head">
          <button className="we-toggle" onClick={() => setOpen(open === we.id ? null : we.id)} aria-expanded={open === we.id}>
            <span className="we-idx">{i + 1}</span>
            <Thumb path={ex?.image_path} name={ex?.name} size={44} />
            <div className="grow">
              <div style={{ fontWeight: 600, lineHeight: 1.25 }} className="ellipsis">
                {ex?.name ?? 'Deleted exercise'}
              </div>
              <div className="we-sum">
                {we.sets} × {reps}
                {we.weight ? ` · ${fmtKg(we.weight)} kg` : ''} · rest {fmtRest(we.rest_sec)}
                {we.drop_last ? ' · drop' : ''}
              </div>
              {we.note && open !== we.id && (
                <div className="tiny muted ellipsis" style={{ marginTop: 2 }}>
                  {we.note}
                </div>
              )}
            </div>
            <ChevronDown size={18} className="we-caret" />
          </button>
          <div className="reorder">
            <button className="btn ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
              <ChevronUp size={22} />
            </button>
            <button className="btn ghost" onClick={() => move(i, 1)} disabled={i === wes.length - 1} aria-label="Move down">
              <ChevronDown size={22} />
            </button>
          </div>
        </div>
        {open === we.id && (
          <div className="we-body">
            <div className="we-grid">
              <label className="field">
                Sets
                <NumInput decimal={false} value={we.sets} onChange={(n) => patch(we, { sets: Math.max(0, Math.round(n ?? 0)) })} />
              </label>
              <label className="field">
                Min reps
                <NumInput decimal={false} value={we.rep_min} onChange={(n) => patch(we, { rep_min: Math.round(n ?? 0) })} />
              </label>
              <label className="field">
                Max reps
                <NumInput decimal={false} value={we.rep_max} onChange={(n) => patch(we, { rep_max: Math.round(n ?? 0) })} />
              </label>
              <label className="field">
                kg
                <NumInput value={we.weight} onChange={(n) => patch(we, { weight: n ?? 0 })} />
              </label>
            </div>
            <div className="row" style={{ gap: 'var(--s3)', alignItems: 'flex-end' }}>
              <label className="field" style={{ width: 96 }}>
                Rest (m:ss)
                <RestInput value={we.rest_sec} onChange={(n) => patch(we, { rest_sec: n })} />
              </label>
              <div className="grow">
                <Toggle blue label="Drop set at the end" on={we.drop_last} onChange={(v) => patch(we, { drop_last: v })} />
              </div>
            </div>
            <div className="field">
              Superset with
              <div className="group-pick" role="radiogroup" aria-label="Superset group">
                {(GROUPS.includes(we.superset) ? GROUPS : [...GROUPS, we.superset]).map((g) => (
                  <button
                    key={g || 'none'}
                    role="radio"
                    aria-checked={we.superset === g}
                    className={`${g ? '' : 'none'} ${we.superset === g ? 'on' : ''}`}
                    onClick={() => patch(we, { superset: g })}
                  >
                    {g || 'None'}
                  </button>
                ))}
              </div>
            </div>
            <input
              className="input"
              placeholder="Note shown during the workout"
              value={we.note}
              onChange={(e) => patch(we, { note: e.target.value })}
            />
            <div className="we-foot">
              <button
                className="btn ghost sm"
                style={{ color: 'var(--danger)', marginLeft: -8 }}
                onClick={() => useStore.getState().remove('workout_exercises', we.id)}
              >
                <Trash2 size={16} /> Remove from workout
              </button>
              <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setOpen(null)}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 'var(--s3)' }}>
      <div className="page-head" style={{ marginBottom: 'var(--s1)' }}>
        <button className="btn icon ghost" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="grow">
          <h1 className="ellipsis" style={{ fontSize: 30 }}>
            {w.name || 'Untitled workout'}
          </h1>
          <div className="small muted" style={{ marginTop: 2 }}>
            {wes.length} exercise{wes.length === 1 ? '' : 's'} · {totalSets} sets
          </div>
        </div>
      </div>

      <div className="card stack">
        <label className="field">
          Name
          <input className="input" value={w.name} onChange={(e) => save('workouts', { ...w, name: e.target.value }, { debounce: 400 })} />
        </label>
        <div className="field">
          Folder
          <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => setMovingFolder(true)} aria-label={`Folder: ${folderOf(w) || NO_FOLDER}. Move to folder`}>
            <Folder size={16} aria-hidden />
            <span className="grow ellipsis" style={{ textAlign: 'left' }}>
              {folderOf(w) || `${NO_FOLDER} (no folder)`}
            </span>
            <span className="small muted">Move</span>
          </button>
        </div>
        <label className="field">
          Notes
          <textarea
            className="textarea"
            style={{ minHeight: 64 }}
            placeholder="Focus, tempo, anything to remember"
            value={w.notes}
            onChange={(e) => save('workouts', { ...w, notes: e.target.value }, { debounce: 400 })}
          />
        </label>
      </div>

      {wes.length > 0 && (
        <div className="section-label" style={{ marginBottom: 0 }}>
          <span>Exercises</span>
          <span className="count">Tap to edit · arrows to reorder</span>
        </div>
      )}

      {blocks.map((b) =>
        b.label && b.items.length > 1 ? (
          <div key={b.items[0].we.id}>
            <div className="ss-label">
              <Link2 size={14} /> Superset {b.label}
            </div>
            <div className="ss-group" style={{ marginTop: 8 }}>
              {b.items.map(({ we, i }) => row(we, i))}
            </div>
          </div>
        ) : (
          b.items.map(({ we, i }) => row(we, i))
        )
      )}

      {!wes.length && (
        <Empty
          icon={<Dumbbell size={24} />}
          title="No exercises yet"
          text="Add the exercises for this workout. You can set sets, reps, rest and supersets for each."
        />
      )}

      <button className="btn primary" onClick={() => setPicking(true)}>
        <Plus size={18} /> Add exercise
      </button>

      <div className="row" style={{ gap: 'var(--s2)', marginTop: 'var(--s3)' }}>
        <button
          className="btn grow"
          onClick={() => {
            duplicateWorkout(w.id)
            nav('/')
          }}
        >
          <Copy size={16} /> Duplicate
        </button>
        <button className="btn danger grow" onClick={() => setConfirmDel(true)}>
          <Trash2 size={16} /> Delete
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            const newId = uid()
            setOpen(newId)
            save('workout_exercises', {
              id: newId,
              user_id: user?.id ?? 'local',
              workout_id: w.id,
              exercise_id: ex.id,
              position: wes.length ? Math.max(...wes.map((x) => x.position)) + 1 : 0,
              sets: 3,
              rep_min: 8,
              rep_max: 12,
              weight: 0,
              rest_sec: ex.rest_sec,
              superset: '',
              drop_last: false,
              note: ''
            })
            setPicking(false)
          }}
        />
      )}
      {movingFolder && <MoveToFolderSheet workoutId={w.id} onClose={() => setMovingFolder(false)} />}
      {confirmDel && (
        <Confirm
          title="Delete this workout?"
          text="Past sessions stay in your history."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            removeWorkout(w.id)
            nav('/')
          }}
          onClose={() => setConfirmDel(false)}
        />
      )}
    </div>
  )
}
