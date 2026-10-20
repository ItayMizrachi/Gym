import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useStore } from '../lib/store'
import { Exercise, MUSCLES } from '../lib/types'
import { nowIso, uid } from '../lib/uid'
import { Sheet, Thumb } from './ui'

export function createExercise(name: string, muscle: string): Exercise {
  const e: Exercise = {
    id: uid(),
    user_id: useStore.getState().user?.id ?? 'local',
    name: name.trim(),
    muscle,
    notes: '',
    setup: '',
    image_path: null,
    rest_sec: 90,
    created_at: nowIso()
  }
  useStore.getState().save('exercises', e)
  return e
}

export function NewExerciseForm({ onCreated, initialName = '' }: { onCreated: (e: Exercise) => void; initialName?: string }) {
  const [name, setName] = useState(initialName)
  const [muscle, setMuscle] = useState('Chest')
  return (
    <div className="stack">
      <label className="field">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Incline Dumbbell Press" autoFocus />
      </label>
      <label className="field">
        Muscle group
        <select className="select" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          {MUSCLES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <button className="btn primary" disabled={!name.trim()} onClick={() => onCreated(createExercise(name, muscle))}>
        <Plus size={18} /> Create exercise
      </button>
    </div>
  )
}

export function ExercisePicker({ onPick, onClose }: { onPick: (e: Exercise) => void; onClose: () => void }) {
  const exercises = useStore((s) => s.db.exercises)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const list = useMemo(
    () =>
      exercises
        .filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) || e.muscle.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [exercises, q]
  )
  if (creating)
    return (
      <Sheet title="New exercise" onClose={() => setCreating(false)}>
        <NewExerciseForm initialName={q} onCreated={(e) => onPick(e)} />
      </Sheet>
    )
  return (
    <Sheet title="Pick exercise" onClose={onClose}>
      <div className="stack">
        <div className="row" style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Search name or muscle" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn" onClick={() => setCreating(true)}>
          <Plus size={18} /> New exercise{q ? ` “${q}”` : ''}
        </button>
        <div>
          {list.map((e) => (
            <button key={e.id} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => onPick(e)}>
              <Thumb path={e.image_path} size={40} />
              <div className="grow">
                <div style={{ fontWeight: 650 }}>{e.name}</div>
                <div className="small muted">{e.muscle}</div>
              </div>
            </button>
          ))}
          {!list.length && <div className="muted center small" style={{ padding: 16 }}>No matches</div>}
        </div>
      </div>
    </Sheet>
  )
}
