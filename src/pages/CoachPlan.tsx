import { useMemo, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from 'lucide-react'
import { deleteTraineeRow, saveTraineeRow, unassignWorkout } from '../lib/coach'
import { useTraineeData } from '../lib/coachData'
import { useStore } from '../lib/store'
import { Exercise, WorkoutExercise, trackingOf } from '../lib/types'
import { uid, nowIso } from '../lib/uid'
import { exerciseFromLibrary, libMeta, searchLibrary, useLibrary } from '../lib/library'
import { Confirm, PageHeader, Sheet } from '../components/ui'
import { ExerciseThumb } from '../components/ExerciseImage'
import '../styles/coach.css'

const int = (v: string) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
const num = (v: string) => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Coach: edit one workout in a trainee's plan. Every change is saved to the trainee straight away. */
export default function CoachPlan() {
  const { id, wid } = useParams()
  const nav = useNavigate()
  const toast = useStore((s) => s.toast)
  const mine = useStore((s) => s.db)
  const { link, db, error, reload, patch } = useTraineeData(id)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const w = db?.workouts.find((x) => x.id === wid) ?? null
  const rows = useMemo(() => (db ? db.workout_exercises.filter((r) => r.workout_id === wid).sort((a, b) => a.position - b.position) : []), [db, wid])

  async function save<T extends { id: string; user_id: string }>(table: 'workouts' | 'workout_exercises' | 'exercises', row: T) {
    try {
      await saveTraineeRow(table, row)
    } catch (e) {
      toast({ kind: 'error', text: (e as Error).message })
      void reload()
    }
  }
  function setRow(r: WorkoutExercise, p: Partial<WorkoutExercise>, persist = false) {
    const next = { ...r, ...p }
    patch((d) => ({ ...d, workout_exercises: d.workout_exercises.map((x) => (x.id === r.id ? next : x)) }))
    if (persist) void save('workout_exercises', next)
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const a = { ...rows[i], position: rows[j].position }
    const b = { ...rows[j], position: rows[i].position }
    // equal positions (old data): give every row its index first
    if (a.position === b.position) {
      a.position = j
      b.position = i
    }
    patch((x) => ({ ...x, workout_exercises: x.workout_exercises.map((y) => (y.id === a.id ? a : y.id === b.id ? b : y)) }))
    void save('workout_exercises', a)
    void save('workout_exercises', b)
  }
  async function removeRow(r: WorkoutExercise) {
    patch((d) => ({ ...d, workout_exercises: d.workout_exercises.filter((x) => x.id !== r.id) }))
    try {
      await deleteTraineeRow('workout_exercises', r.id)
    } catch (e) {
      toast({ kind: 'error', text: (e as Error).message })
      void reload()
    }
  }
  /** add an exercise: the trainee's own one by name, else a copy made for them */
  async function addExercise(src: Exercise) {
    if (!db || !link?.trainee_id || !w) return
    setAdding(false)
    let ex = db.exercises.find((e) => e.name.trim().toLowerCase() === src.name.trim().toLowerCase())
    if (!ex) {
      ex = { ...src, id: uid(), user_id: link.trainee_id, notes: '', image_path: src.image_path?.startsWith('lib:') ? src.image_path : null, created_at: nowIso() }
      const made = ex
      patch((d) => ({ ...d, exercises: [...d.exercises, made] }))
      await save('exercises', made)
    }
    const r: WorkoutExercise = {
      id: uid(),
      user_id: link.trainee_id,
      workout_id: w.id,
      exercise_id: ex.id,
      position: rows.reduce((m, x) => Math.max(m, x.position), -1) + 1,
      sets: trackingOf(ex) === 'time' ? 1 : 3,
      rep_min: trackingOf(ex) === 'time' ? 0 : 8,
      rep_max: trackingOf(ex) === 'time' ? 0 : 12,
      weight: 0,
      rest_sec: ex.rest_sec || 90,
      superset: '',
      drop_last: false,
      note: ''
    }
    patch((d) => ({ ...d, workout_exercises: [...d.workout_exercises, r] }))
    await save('workout_exercises', r)
  }

  if (error)
    return (
      <div className="stack coach" style={{ gap: 16 }}>
        <PageHeader title={tr("Workout")} back={`/coach/${id}`} />
        <div className="card stack">
          <div className="small muted">{error}</div>
          <button className="btn" onClick={() => void reload()}>
            {tr("Try again")}
          </button>
        </div>
      </div>
    )
  if (!db || !link) return <div className="card small muted">Loading…</div>
  if (!w) return <div className="card small muted">{tr("This workout is no longer in the plan.")}</div>

  return (
    <div className="stack coach" style={{ gap: 16 }}>
      <PageHeader title={w.name || 'Workout'} sub={`${link.name}'s plan · saved as you go`} back={`/coach/${id}`} />
      <label className="field">
        {tr("Name")}
        <input
          className="input"
          value={w.name}
          maxLength={60}
          onChange={(e) => patch((d) => ({ ...d, workouts: d.workouts.map((x) => (x.id === w.id ? { ...x, name: e.target.value } : x)) }))}
          onBlur={() => void save('workouts', { ...w, name: w.name.trim() || 'Workout' })}
          enterKeyHint="done"
        />
      </label>

      {rows.length === 0 && <div className="small muted">{tr("No exercises yet.")}</div>}
      {rows.map((r, i) => {
        const ex = db.exercises.find((e) => e.id === r.exercise_id)
        const timed = trackingOf(ex) === 'time'
        const field = (label: string, value: number, onChange: (v: string) => void, decimal = false) => (
          <label className="coach-num">
            <span className="tiny muted">{label}</span>
            <input
              className="input"
              inputMode={decimal ? 'decimal' : 'numeric'}
              value={value || value === 0 ? String(value) : ''}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => void save('workout_exercises', db.workout_exercises.find((x) => x.id === r.id) ?? r)}
              onFocus={(e) => e.target.select()}
            />
          </label>
        )
        return (
          <div key={r.id} className="card stack coach-plan-ex" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <ExerciseThumb exercise={ex} name={ex?.name ?? ''} size={40} />
              <div className="grow title ellipsis" style={{ minWidth: 0 }}>
                {ex?.name ?? 'Exercise'}
              </div>
              <button className="btn icon ghost" aria-label={tr("Move up")} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={18} aria-hidden />
              </button>
              <button className="btn icon ghost" aria-label={tr("Move down")} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={18} aria-hidden />
              </button>
              <button className="btn icon ghost" aria-label={`Remove ${ex?.name ?? 'exercise'}`} onClick={() => void removeRow(r)}>
                <Trash2 size={18} aria-hidden />
              </button>
            </div>
            <div className="coach-nums">
              {field('Sets', r.sets, (v) => setRow(r, { sets: Math.min(20, int(v)) }))}
              {!timed && field('Reps from', r.rep_min, (v) => setRow(r, { rep_min: Math.min(100, int(v)) }))}
              {!timed && field('to', r.rep_max, (v) => setRow(r, { rep_max: Math.min(100, int(v)) }))}
              {!timed && field('kg', r.weight, (v) => setRow(r, { weight: Math.min(1000, num(v)) }), true)}
              {field('Rest s', r.rest_sec, (v) => setRow(r, { rest_sec: Math.min(900, int(v)) }))}
            </div>
            <input
              className="input"
              value={r.note}
              maxLength={200}
              placeholder={tr("Note for this exercise (optional)")}
              aria-label={`Note for ${ex?.name ?? 'this exercise'}`}
              onChange={(e) => setRow(r, { note: e.target.value })}
              onBlur={() => void save('workout_exercises', db.workout_exercises.find((x) => x.id === r.id) ?? r)}
            />
          </div>
        )
      })}

      <button className="btn primary block" onClick={() => setAdding(true)}>
        <Plus size={18} aria-hidden /> {tr("Add exercise")}
      </button>
      <button className="btn ghost block" style={{ color: 'var(--danger-text)' }} onClick={() => setDeleting(true)}>
        {tr("Remove this workout from the plan")}
      </button>

      {adding && <PickExercise trainee={db.exercises} mine={mine.exercises} userId={link.trainee_id ?? ''} onPick={(e) => void addExercise(e)} onClose={() => setAdding(false)} />}
      {deleting && (
        <Confirm
          title={`Remove ${w.name}?`}
          text={tr("It leaves their plan. Workouts they already did stay in their history.")}
          confirmLabel={tr("Remove")}
          danger
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            setDeleting(false)
            try {
              await unassignWorkout(w.id)
              await reload()
              nav(`/coach/${id}`, { replace: true })
            } catch (e) {
              toast({ kind: 'error', text: (e as Error).message })
            }
          }}
        />
      )}
    </div>
  )
}

/** search the trainee's exercises, yours, and the library */
function PickExercise({ trainee, mine, userId, onPick, onClose }: { trainee: Exercise[]; mine: Exercise[]; userId: string; onPick: (e: Exercise) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const { list: lib } = useLibrary()
  const needle = q.trim().toLowerCase()
  const own = useMemo(() => {
    const seen = new Set<string>()
    return [...trainee, ...mine]
      .filter((e) => {
        const k = e.name.trim().toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return !needle || k.includes(needle)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40)
  }, [trainee, mine, needle])
  const ownNames = new Set(own.map((e) => e.name.trim().toLowerCase()))
  const fromLib = lib && needle ? searchLibrary(lib, { q }).filter((e) => !ownNames.has(e.name.toLowerCase())).slice(0, 30) : []
  return (
    <Sheet title={tr("Add exercise")} onClose={onClose}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="search">
          <Search size={18} />
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search exercises")} aria-label={tr("Search exercises")} enterKeyHint="search" />
        </div>
        <div className="list-group">
          {own.map((e) => (
            <button key={e.id} className="list-row" onClick={() => onPick(e)}>
              <ExerciseThumb exercise={e} name={e.name} size={40} />
              <span className="grow title ellipsis">{e.name}</span>
            </button>
          ))}
          {fromLib.map((l) => (
            <button key={l.id} className="list-row" onClick={() => onPick(exerciseFromLibrary(l, userId))}>
              <ExerciseThumb exercise={{ name: l.name, muscle: l.muscle, image_path: 'lib:' + l.id }} name={l.name} size={40} />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="title ellipsis" style={{ display: 'block' }}>
                  {l.name}
                </span>
                <span className="meta">{libMeta(l)}</span>
              </span>
            </button>
          ))}
        </div>
        {!needle && <div className="small muted">{tr("Type to search the whole library.")}</div>}
      </div>
    </Sheet>
  )
}
