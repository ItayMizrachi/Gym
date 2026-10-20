import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { duplicateWorkout, removeWorkout } from '../lib/actions'
import { ExercisePicker } from '../components/ExercisePicker'
import { Confirm, NumInput, Thumb, Toggle } from '../components/ui'
import { fmtRest, parseRest } from '../lib/format'
import { uid } from '../lib/uid'
import { WorkoutExercise } from '../lib/types'

const GROUPS = ['', 'A', 'B', 'C', 'D', 'E', 'F']

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

  const w = db.workouts.find((x) => x.id === id)
  if (!w) return <div className="card">Workout not found. <button className="btn sm" onClick={() => nav('/')}>Back</button></div>
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

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <button className="btn icon ghost" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <h1>Edit workout</h1>
      </div>

      <div className="card stack">
        <label className="field">
          Name
          <input className="input" value={w.name} onChange={(e) => save('workouts', { ...w, name: e.target.value }, { debounce: 400 })} />
        </label>
        <label className="field">
          Notes
          <textarea className="textarea" style={{ minHeight: 60 }} value={w.notes} onChange={(e) => save('workouts', { ...w, notes: e.target.value }, { debounce: 400 })} />
        </label>
      </div>

      {wes.map((we, i) => {
        const ex = db.exercises.find((e) => e.id === we.exercise_id)
        return (
          <div key={we.id} className={`card stack ${we.superset ? 'ss' : ''}`} style={we.superset ? { borderLeft: '3px solid var(--accent)' } : undefined}>
            <div className="row">
              <Thumb path={ex?.image_path} size={44} />
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{ex?.name ?? 'Deleted exercise'}</div>
                <div className="small muted">{ex?.muscle}</div>
              </div>
              <button className="btn icon sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp size={16} />
              </button>
              <button className="btn icon sm" onClick={() => move(i, 1)} disabled={i === wes.length - 1} aria-label="Move down">
                <ArrowDown size={16} />
              </button>
            </div>
            <div className="we-grid">
              <label className="field">
                Sets
                <NumInput decimal={false} value={we.sets} onChange={(n) => patch(we, { sets: Math.max(0, Math.round(n ?? 0)) })} />
              </label>
              <label className="field">
                Reps min
                <NumInput decimal={false} value={we.rep_min} onChange={(n) => patch(we, { rep_min: Math.round(n ?? 0) })} />
              </label>
              <label className="field">
                Reps max
                <NumInput decimal={false} value={we.rep_max} onChange={(n) => patch(we, { rep_max: Math.round(n ?? 0) })} />
              </label>
              <label className="field">
                Weight kg
                <NumInput value={we.weight} onChange={(n) => patch(we, { weight: n ?? 0 })} />
              </label>
            </div>
            <div className="row">
              <label className="field grow">
                Rest (m:ss)
                <RestInput value={we.rest_sec} onChange={(n) => patch(we, { rest_sec: n })} />
              </label>
              <label className="field grow">
                Superset
                <select className="select" style={{ minHeight: 40, height: 40 }} value={we.superset} onChange={(e) => patch(we, { superset: e.target.value })}>
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g ? `Group ${g}` : 'None'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ alignItems: 'center' }}>
                Drop set
                <Toggle on={we.drop_last} onChange={(v) => patch(we, { drop_last: v })} />
              </label>
            </div>
            <input className="input" placeholder="Note (shown during the workout)" value={we.note} onChange={(e) => patch(we, { note: e.target.value })} />
            <button
              className="btn danger sm"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => useStore.getState().remove('workout_exercises', we.id)}
            >
              <Trash2 size={16} /> Remove from workout
            </button>
          </div>
        )
      })}

      <button className="btn primary" onClick={() => setPicking(true)}>
        <Plus size={18} /> Add exercise
      </button>

      <div className="row">
        <button className="btn grow" onClick={() => { duplicateWorkout(w.id); nav('/') }}>
          <Copy size={16} /> Duplicate
        </button>
        <button className="btn danger grow" onClick={() => setConfirmDel(true)}>
          <Trash2 size={16} /> Delete workout
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            save('workout_exercises', {
              id: uid(),
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
