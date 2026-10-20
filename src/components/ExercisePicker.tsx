import { useMemo, useState } from 'react'
import { ArrowLeft, Plus, Search, X } from 'lucide-react'
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
    <form
      className="stack"
      onSubmit={(ev) => {
        ev.preventDefault()
        if (name.trim()) onCreated(createExercise(name, muscle))
      }}
    >
      <label className="field">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Incline Dumbbell Press" autoFocus enterKeyHint="done" />
      </label>
      <div className="field">
        Muscle group
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
          {MUSCLES.map((m) => (
            <button type="button" key={m} className={`chip ${muscle === m ? 'active' : ''}`} onClick={() => setMuscle(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <button className="btn primary" type="submit" disabled={!name.trim()}>
        <Plus size={18} /> Create exercise
      </button>
    </form>
  )
}

export function ExercisePicker({ onPick, onClose }: { onPick: (e: Exercise) => void; onClose: () => void }) {
  const exercises = useStore((s) => s.db.exercises)
  const sessions = useStore((s) => s.db.sessions)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)

  /** exercises from the most recent sessions, newest first */
  const recentIds = useMemo(() => {
    const ids: string[] = []
    const sorted = [...sessions].sort((a, b) => (b.started_at > a.started_at ? 1 : -1))
    for (const s of sorted) {
      for (const e of s.data.exercises) if (!ids.includes(e.exercise_id)) ids.push(e.exercise_id)
      if (ids.length >= 6) break
    }
    return ids.slice(0, 6)
  }, [sessions])

  const needle = q.trim().toLowerCase()
  const matches = useMemo(
    () =>
      exercises
        .filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.muscle.toLowerCase().includes(needle))
        .sort((a, b) => {
          // names that start with the query rank first
          if (needle) {
            const sa = a.name.toLowerCase().startsWith(needle) ? 0 : 1
            const sb = b.name.toLowerCase().startsWith(needle) ? 0 : 1
            if (sa !== sb) return sa - sb
          }
          return a.name.localeCompare(b.name)
        }),
    [exercises, needle]
  )
  const recent = needle ? [] : recentIds.map((id) => exercises.find((e) => e.id === id)).filter((e): e is Exercise => !!e)
  const rest = needle ? matches : matches.filter((e) => !recentIds.includes(e.id))
  const exact = exercises.some((e) => e.name.trim().toLowerCase() === needle)

  const row = (e: Exercise) => (
    <button key={e.id} className="list-row" onClick={() => onPick(e)}>
      <Thumb path={e.image_path} name={e.name} size={40} />
      <div className="grow">
        <div className="title ellipsis">{e.name}</div>
        <div className="meta">{e.muscle}</div>
      </div>
      <Plus size={18} className="chev" />
    </button>
  )

  return (
    <Sheet title={creating ? 'New exercise' : 'Add exercise'} onClose={onClose}>
      {creating ? (
        <div className="stack">
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start', marginLeft: -8 }} onClick={() => setCreating(false)}>
            <ArrowLeft size={16} /> Back to list
          </button>
          <NewExerciseForm initialName={q} onCreated={(e) => onPick(e)} />
        </div>
      ) : (
        <div className="stack" style={{ gap: 0 }}>
          <div className="search" style={{ marginBottom: 'var(--s3)' }}>
            <Search size={18} />
            <input className="input" type="search" enterKeyHint="search" placeholder="Search name or muscle" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button className="clear" onClick={() => setQ('')} aria-label="Clear search">
                <X size={18} />
              </button>
            )}
          </div>
          {!exact && (
            <button className="create-inline" onClick={() => setCreating(true)}>
              <span className="plus">
                <Plus size={20} />
              </span>
              <span className="grow ellipsis">{q.trim() ? `Create “${q.trim()}”` : 'Create a new exercise'}</span>
            </button>
          )}
          {recent.length > 0 && (
            <>
              <div className="picker-sec">Recent</div>
              <div className="list-group" style={{ ['--inset' as string]: '66px' }}>{recent.map(row)}</div>
            </>
          )}
          {rest.length > 0 && (
            <>
              <div className="picker-sec">{needle ? `${rest.length} result${rest.length === 1 ? '' : 's'}` : 'All exercises'}</div>
              <div className="list-group" style={{ ['--inset' as string]: '66px' }}>{rest.map(row)}</div>
            </>
          )}
          {needle && !rest.length && <div className="muted center small" style={{ padding: 'var(--s4)' }}>No exercise matches “{q.trim()}”.</div>}
        </div>
      )}
    </Sheet>
  )
}
