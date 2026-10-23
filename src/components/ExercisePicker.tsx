import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Plus, RotateCw, Search, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { EQUIPMENT, Exercise, MUSCLES, Tracking } from '../lib/types'
import { nowIso, uid } from '../lib/uid'
import { exerciseMeta, facets, filterExercises, recentExerciseIds } from '../lib/exerciseFilters'
import { TRACKING_LABEL } from '../lib/tracking'
import { ImageField, Sheet, Toggle } from './ui'
import { ThumbButton } from './ExerciseHowTo'
import { LibraryExercise, bestLibraryMatch, libMeta, libPath, linkedLibIds, searchLibrary, useLibrary } from '../lib/library'
import { declineLibraryPhoto } from '../lib/autoMatch'
import { ensureLibraryExercise } from '../lib/libraryActions'
import { LibSkeleton } from './Library'
import '../styles/library.css'
import '../styles/workout-live.css'

export function createExercise(name: string, muscle: string, opts: { equipment?: string; tracking?: Tracking; image_path?: string | null } = {}): Exercise {
  const tracking = opts.tracking ?? 'weight_reps'
  const e: Exercise = {
    id: uid(),
    user_id: useStore.getState().user?.id ?? 'local',
    name: name.trim(),
    muscle,
    notes: '',
    setup: '',
    image_path: opts.image_path ?? null,
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
  const [photo, setPhoto] = useState<string | null>(null)
  // every exercise should have a picture: offer the closest library photo for what is typed
  const { list: lib } = useLibrary()
  const match = useMemo(
    () => (lib && name.trim().length >= 3 ? bestLibraryMatch(lib, { name, muscle, equipment }, { fallback: true }) : null),
    [lib, name, muscle, equipment]
  )
  const [usePic, setUsePic] = useState(true)
  return (
    <form
      className="stack"
      onSubmit={(ev) => {
        ev.preventDefault()
        if (!name.trim()) return
        const libPic = !photo && usePic && match ? libPath(match.lib.id) : null
        const e = createExercise(name, muscle, { equipment, tracking, image_path: photo ?? libPic })
        // said no to the picture: do not add one later in the background either
        if (!photo && !libPic) declineLibraryPhoto(e.id)
        onCreated(e)
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
      <div className="field">
        Picture
        {match && !photo && (
          <div className={`lib-match ${usePic ? 'on' : ''}`}>
            <ThumbButton exercise={{ name: match.lib.name, muscle: match.lib.muscle, equipment: match.lib.equipment, image_path: libPath(match.lib.id) }} size={56} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="title">{match.byName ? 'Use this picture?' : 'Closest picture we have'}</div>
              <div className="meta ellipsis">{match.lib.name}</div>
            </div>
            <Toggle on={usePic} onChange={setUsePic} ariaLabel={`Use the picture of ${match.lib.name}`} />
          </div>
        )}
        <ImageField path={photo} folder="exercises" onChange={setPhoto} label={match ? 'Or use my own photo' : 'Add a photo of the machine'} quiet={!!match} />
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

/** Library rows shown at a time in the picker; "Show more" adds the next batch. */
const LIB_PAGE = 30
/** a picked library entry is kept as `lib:<id>` until "Add" creates the exercise */
const libKey = (id: string) => 'lib:' + id

/**
 * Pick exercises: "My exercises" first, then the library below (a library pick becomes one of "My exercises").
 * With only `onPick`, a tap picks one exercise straight away.
 * With `onPickMany`, taps select several and a sticky button adds them all in the order they were tapped.
 */
export function ExercisePicker({
  onPick,
  onPickMany,
  onClose,
  title = 'Add exercises'
}: {
  onPick: (e: Exercise) => void
  onPickMany?: (list: Exercise[]) => void
  onClose: () => void
  /** sheet title, e.g. "Replace exercise" */
  title?: string
}) {
  const exercises = useStore((s) => s.db.exercises)
  const sessions = useStore((s) => s.db.sessions)
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('All')
  const [eq, setEq] = useState('All')
  const [creating, setCreating] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [libLimit, setLibLimit] = useState(LIB_PAGE)
  const multi = !!onPickMany

  const { list: lib, error: libError, retry } = useLibrary()
  const recentIds = useMemo(() => recentExerciseIds(sessions), [sessions])
  // once the library is here every muscle and equipment can be filtered, not only those in "My exercises"
  const { muscles, equipment } = useMemo(() => (lib ? { muscles: MUSCLES, equipment: EQUIPMENT } : facets(exercises)), [exercises, lib])
  const needle = q.trim().toLowerCase()
  const filtered = muscle !== 'All' || eq !== 'All'
  const matches = useMemo(() => filterExercises(exercises, { q, muscle, equipment: eq }), [exercises, q, muscle, eq])
  const recent = needle || filtered ? [] : recentIds.map((id) => exercises.find((e) => e.id === id)).filter((e): e is Exercise => !!e)
  const rest = recent.length ? matches.filter((e) => !recentIds.includes(e.id)) : matches
  const linked = useMemo(() => linkedLibIds(exercises), [exercises])
  // library entries the user already has show up under "My exercises", so they are left out here
  const libMatches = useMemo(
    () => (lib ? searchLibrary(lib, { q, muscle, equipment: eq }).filter((e) => !linked.has(e.id)) : []),
    [lib, q, muscle, eq, linked]
  )
  useEffect(() => setLibLimit(LIB_PAGE), [q, muscle, eq])
  const exact = exercises.some((e) => e.name.trim().toLowerCase() === needle) || libMatches.some((e) => e.name.toLowerCase() === needle)

  const toggle = (key: string) => setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]))
  const addPicked = () => {
    const list = picked
      .map((key) => {
        if (key.startsWith('lib:')) {
          const l = lib?.find((e) => libKey(e.id) === key)
          return l ? ensureLibraryExercise(l) : undefined
        }
        return exercises.find((e) => e.id === key)
      })
      .filter((e): e is Exercise => !!e)
    if (list.length) onPickMany!(list)
  }

  const check = (key: string) => {
    const on = picked.includes(key)
    return multi ? (
      <span className={`xp-check ${on ? 'on' : ''}`} aria-hidden>
        {on ? picked.indexOf(key) + 1 : <Plus size={16} />}
      </span>
    ) : (
      <Plus size={18} className="chev" />
    )
  }

  const row = (e: Exercise) => {
    const on = picked.includes(e.id)
    return (
      <div key={e.id} className={`lib-row ${on ? 'xp-on' : ''}`}>
        <ThumbButton exercise={e} size={48} />
        <button className="list-row" onClick={() => (multi ? toggle(e.id) : onPick(e))} aria-pressed={multi ? on : undefined}>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="title ellipsis">{e.name}</div>
          <div className="meta ellipsis">{exerciseMeta(e)}</div>
        </div>
        {check(e.id)}
        </button>
      </div>
    )
  }

  const libRow = (l: LibraryExercise) => {
    const key = libKey(l.id)
    const on = picked.includes(key)
    return (
      <div key={key} className={`lib-row ${on ? 'xp-on' : ''}`}>
        <ThumbButton exercise={{ name: l.name, muscle: l.muscle, equipment: l.equipment, image_path: libPath(l.id) }} size={48} />
      <button
        className="list-row"
        onClick={() => (multi ? toggle(key) : onPick(ensureLibraryExercise(l)))}
        aria-pressed={multi ? on : undefined}
      >
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="title ellipsis">{l.name}</div>
          <div className="meta ellipsis">{libMeta(l)}</div>
        </div>
        {check(key)}
      </button>
      </div>
    )
  }

  const searching = !!needle || filtered
  return (
    <Sheet title={creating ? 'New exercise' : title} onClose={onClose}>
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
            <input
              className="input"
              type="search"
              enterKeyHint="search"
              placeholder="Search exercises"
              aria-label="Search exercises"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
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
              <span className="grow ellipsis">{q.trim() ? `Create “${q.trim()}”` : 'Create your own exercise'}</span>
            </button>
          )}
          {recent.length > 0 && (
            <>
              <div className="picker-sec">Recent</div>
              <div className="list-group" style={{ ['--inset' as string]: '74px' }}>{recent.map(row)}</div>
            </>
          )}
          {rest.length > 0 && (
            <>
              <div className="picker-sec">{searching ? `My exercises · ${rest.length}` : 'My exercises'}</div>
              <div className="list-group" style={{ ['--inset' as string]: '74px' }}>{rest.map(row)}</div>
            </>
          )}

          <div className="picker-sec">{lib ? `Library · ${libMatches.length}` : 'Library'}</div>
          {libError ? (
            <div className="row small muted" style={{ justifyContent: 'space-between', padding: 'var(--s2) 2px' }}>
              The library could not load.
              <button className="btn sm" onClick={retry}>
                <RotateCw size={14} /> Try again
              </button>
            </div>
          ) : !lib ? (
            <LibSkeleton rows={4} />
          ) : libMatches.length ? (
            <>
              <div className="list-group" style={{ ['--inset' as string]: '74px' }}>{libMatches.slice(0, libLimit).map(libRow)}</div>
              {libMatches.length > libLimit && (
                <button className="btn lib-more" onClick={() => setLibLimit((n) => n + LIB_PAGE)}>
                  Show more ({libMatches.length - libLimit} left)
                </button>
              )}
            </>
          ) : (
            <div className="muted center small" style={{ padding: 'var(--s4)' }}>
              {rest.length || recent.length ? 'Nothing more in the library.' : `No exercise matches${needle ? ` “${q.trim()}”` : ' these filters'}. Create it above.`}
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
