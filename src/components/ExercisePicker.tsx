import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Plus, Search, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { EQUIPMENT, Exercise, MUSCLES, Tracking } from '../lib/types'
import { nowIso, uid } from '../lib/uid'
import { exerciseMeta, facets, filterExercises, recentExerciseIds } from '../lib/exerciseFilters'
import { TRACKING_LABEL } from '../lib/tracking'
import { Sheet } from './ui'
import { ExerciseThumb } from './ExerciseImage'
import '../styles/workout-live.css'

export function createExercise(name: string, muscle: string, opts: { equipment?: string; tracking?: Tracking } = {}): Exercise {
  const tracking = opts.tracking ?? 'weight_reps'
  const e: Exercise = {
    id: uid(),
    user_id: useStore.getState().user?.id ?? 'local',
    name: name.trim(),
    muscle,
    notes: '',
    setup: '',
    image_path: null,
    rest_sec: tracking === 'time' ? 60 : 90,
    created_at: nowIso(),
    equipment: opts.equipment ?? '',
    tracking
  }
  useStore.getState().save('exercises', e)
  return e
}

export function NewExerciseForm({ onCreated, initialName = '' }: { onCreated: (e: Exercise) => void; initialName?: string }) {
  const [name, setName] = useState(initialName)
  const [muscle, setMuscle] = useState('Chest')
  const [equipment, setEquipment] = useState('')
  const [tracking, setTracking] = useState<Tracking>('weight_reps')
  const [trackingTouched, setTrackingTouched] = useState(false)
  return (
    <form
      className="stack"
      onSubmit={(ev) => {
        ev.preventDefault()
        if (name.trim()) onCreated(createExercise(name, muscle, { equipment, tracking }))
      }}
    >
      <label className="field">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Incline Dumbbell Press" autoFocus enterKeyHint="done" />
      </label>
      <div className="field">
        Muscle group
        <div className="chips wrap">
          {MUSCLES.map((m) => (
            <button type="button" key={m} className={`chip ${muscle === m ? 'active' : ''}`} onClick={() => setMuscle(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        Equipment
        <div className="chips wrap">
          {EQUIPMENT.map((m) => (
            <button
              type="button"
              key={m}
              className={`chip ${equipment === m ? 'active' : ''}`}
              onClick={() => {
                const next = equipment === m ? '' : m
                setEquipment(next)
                // body-weight moves are usually just reps; only guess while the user has not chosen
                if (!trackingTouched) setTracking(next === 'Bodyweight' ? 'reps' : 'weight_reps')
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        What do you record?
        <div className="seg" role="radiogroup" aria-label="What do you record">
          {(['weight_reps', 'reps', 'time'] as Tracking[]).map((t) => (
            <button
              type="button"
              key={t}
              role="radio"
              aria-checked={tracking === t}
              className={tracking === t ? 'on' : ''}
              onClick={() => {
                setTracking(t)
                setTrackingTouched(true)
              }}
            >
              {TRACKING_LABEL[t]}
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

/** Muscle + equipment filter chips. Each row only lists values that exist, and hides itself when there is just one. */
export function FilterChips({
  muscles,
  equipment,
  muscle,
  eq,
  setMuscle,
  setEq
}: {
  muscles: string[]
  equipment: string[]
  muscle: string
  eq: string
  setMuscle: (m: string) => void
  setEq: (m: string) => void
}) {
  return (
    <div className="xp-filters">
      {muscles.length > 1 && (
        <div className="chips" role="group" aria-label="Muscle group">
          {['All', ...muscles].map((m) => (
            <button key={m} aria-pressed={muscle === m} className={`chip ${muscle === m ? 'active' : ''}`} onClick={() => setMuscle(muscle === m && m !== 'All' ? 'All' : m)}>
              {m === 'All' ? 'All muscles' : m}
            </button>
          ))}
        </div>
      )}
      {equipment.length > 1 && (
        <div className="chips" role="group" aria-label="Equipment">
          {['All', ...equipment].map((m) => (
            <button key={m} aria-pressed={eq === m} className={`chip ${eq === m ? 'active' : ''}`} onClick={() => setEq(eq === m && m !== 'All' ? 'All' : m)}>
              {m === 'All' ? 'All equipment' : m}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Pick exercises. With only `onPick`, a tap picks one exercise straight away.
 * With `onPickMany`, taps select several and a sticky button adds them all in the order they were tapped.
 */
export function ExercisePicker({
  onPick,
  onPickMany,
  onClose
}: {
  onPick: (e: Exercise) => void
  onPickMany?: (list: Exercise[]) => void
  onClose: () => void
}) {
  const exercises = useStore((s) => s.db.exercises)
  const sessions = useStore((s) => s.db.sessions)
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('All')
  const [eq, setEq] = useState('All')
  const [creating, setCreating] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const multi = !!onPickMany

  const recentIds = useMemo(() => recentExerciseIds(sessions), [sessions])
  const { muscles, equipment } = useMemo(() => facets(exercises), [exercises])
  const needle = q.trim().toLowerCase()
  const filtered = muscle !== 'All' || eq !== 'All'
  const matches = useMemo(() => filterExercises(exercises, { q, muscle, equipment: eq }), [exercises, q, muscle, eq])
  const recent = needle || filtered ? [] : recentIds.map((id) => exercises.find((e) => e.id === id)).filter((e): e is Exercise => !!e)
  const rest = recent.length ? matches.filter((e) => !recentIds.includes(e.id)) : matches
  const exact = exercises.some((e) => e.name.trim().toLowerCase() === needle)

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const addPicked = () => {
    const list = picked.map((id) => exercises.find((e) => e.id === id)).filter((e): e is Exercise => !!e)
    if (list.length) onPickMany!(list)
  }

  const row = (e: Exercise) => {
    const on = picked.includes(e.id)
    return (
      <button key={e.id} className={`list-row ${on ? 'xp-on' : ''}`} onClick={() => (multi ? toggle(e.id) : onPick(e))} aria-pressed={multi ? on : undefined}>
        <ExerciseThumb exercise={e} size={44} />
        <div className="grow">
          <div className="title ellipsis">{e.name}</div>
          <div className="meta ellipsis">{exerciseMeta(e)}</div>
        </div>
        {multi ? (
          <span className={`xp-check ${on ? 'on' : ''}`} aria-hidden>
            {on ? picked.indexOf(e.id) + 1 : <Plus size={16} />}
          </span>
        ) : (
          <Plus size={18} className="chev" />
        )}
      </button>
    )
  }

  return (
    <Sheet title={creating ? 'New exercise' : 'Add exercises'} onClose={onClose}>
      {creating ? (
        <div className="stack">
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start', marginLeft: -8 }} onClick={() => setCreating(false)}>
            <ArrowLeft size={16} /> Back to list
          </button>
          <NewExerciseForm
            initialName={q}
            onCreated={(e) => {
              if (!multi) return onPick(e)
              // in multi-select, a new exercise joins the selection and the list comes back
              setPicked((p) => [...p, e.id])
              setQ('')
              setMuscle('All')
              setEq('All')
              setCreating(false)
            }}
          />
        </div>
      ) : (
        <div className="stack xp-list" style={{ gap: 0 }}>
          <div className="search" style={{ marginBottom: 'var(--s2)' }}>
            <Search size={18} />
            <input className="input" type="search" enterKeyHint="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button className="clear" onClick={() => setQ('')} aria-label="Clear search">
                <X size={18} />
              </button>
            )}
          </div>
          <FilterChips muscles={muscles} equipment={equipment} muscle={muscle} eq={eq} setMuscle={setMuscle} setEq={setEq} />
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
              <div className="picker-sec">{needle || filtered ? `${rest.length} result${rest.length === 1 ? '' : 's'}` : 'All exercises'}</div>
              <div className="list-group" style={{ ['--inset' as string]: '66px' }}>{rest.map(row)}</div>
            </>
          )}
          {!rest.length && !recent.length && (
            <div className="muted center small" style={{ padding: 'var(--s4)' }}>
              No exercise matches{needle ? ` “${q.trim()}”` : ' these filters'}.
            </div>
          )}
          {multi && picked.length > 0 && (
            <div className="xp-foot">
              <button className="btn ghost" onClick={() => setPicked([])}>
                Clear
              </button>
              <button className="btn primary grow" onClick={addPicked}>
                <Check size={18} /> Add {picked.length} exercise{picked.length === 1 ? '' : 's'}
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
