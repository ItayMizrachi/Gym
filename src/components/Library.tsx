import { ReactNode, useMemo, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, Dumbbell, Play, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { Exercise } from '../lib/types'
import { LibraryExercise, libMeta, libPath } from '../lib/library'
import { activeSession, addExerciseToSession, appendToWorkout } from '../lib/libraryActions'
import { Sheet } from './ui'
import { ThumbButton } from './ExerciseHowTo'
import '../styles/library.css'

/** Library row: tap opens the detail page, the pill on the right adds it to "My exercises". */
export function LibRow({ e, added, onOpen, onAdd }: { e: LibraryExercise; added: boolean; onOpen: () => void; onAdd: () => void }) {
  return (
    <div className="lib-row">
      <ThumbButton exercise={{ name: e.name, muscle: e.muscle, equipment: e.equipment, image_path: libPath(e.id) }} size={48} />
      <button className="list-row" onClick={onOpen}>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="title ellipsis">{e.name}</div>
          <div className="meta ellipsis">{libMeta(e)}</div>
        </div>
      </button>
      {added ? (
        <span className="lib-add done">
          <Check size={16} aria-hidden /> {tr("Added")}
        </span>
      ) : (
        <button className="lib-add" onClick={onAdd} aria-label={`Add ${e.name} to my exercises`}>
          <Plus size={16} /> {tr("Add")}
        </button>
      )}
    </div>
  )
}

export function LibSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="list-group" role="status" aria-busy="true">
      <span className="lib-sr">{tr("Loading the exercise library")}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="lib-skel">
          <div className="c" />
          <div className="grow stack" style={{ gap: 8 }}>
            <div className="l" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            <div className="l" style={{ width: '35%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A filter pill ("Muscle ▾") that opens a sheet with the choices. 'All' resets it. */
export function FilterPill({
  label,
  allLabel,
  value,
  options,
  onChange
}: {
  label: string
  allLabel: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const on = value !== 'All'
  return (
    <>
      <button className={`lib-pill ${on ? 'on' : ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${label}: ${on ? value : 'any'}`}>
        {on ? value : label}
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)}>
          <div className="list-group" role="radiogroup" aria-label={label}>
            {['All', ...options].map((o) => (
              <button
                key={o}
                role="radio"
                aria-checked={value === o}
                className="list-row"
                onClick={() => {
                  onChange(o)
                  setOpen(false)
                }}
              >
                <span className="grow title" style={{ fontWeight: value === o ? 600 : 500 }}>
                  {o === 'All' ? allLabel : o}
                </span>
                {value === o && <Check size={20} color="var(--accent)" aria-hidden />}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  )
}

/**
 * "Add to workout": the workout in progress first, then every saved workout.
 * `getExercise` runs only once a workout is chosen, so a library entry becomes one of "My exercises" only when used.
 */
export function AddToWorkoutSheet({ name, getExercise, onClose }: { name: string; getExercise: () => Exercise; onClose: () => void }) {
  const nav = useNavigate()
  const workouts = useStore((s) => s.db.workouts)
  const toast = useStore((s) => s.toast)
  const live = useMemo(() => activeSession(), [])
  const sorted = useMemo(() => [...workouts].sort((a, b) => (a.folder ?? '').localeCompare(b.folder ?? '') || a.position - b.position), [workouts])

  const row = (key: string, icon: ReactNode, title: string, meta: string, onClick: () => void) => (
    <button key={key} className="list-row" onClick={onClick}>
      <span className="lib-wo-icon" aria-hidden>
        {icon}
      </span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="title ellipsis">{title}</div>
        {meta && <div className="meta ellipsis">{meta}</div>}
      </div>
      <ChevronRight size={18} className="chev" />
    </button>
  )

  return (
    <Sheet title={`Add ${name} to…`} onClose={onClose}>
      <div className="stack" style={{ gap: 'var(--s3)' }}>
        {live && (
          <div className="list-group" style={{ ['--inset' as string]: '66px' }}>
            {row('live', <Play size={18} />, live.name || 'Workout in progress', 'Workout in progress', () => {
              addExerciseToSession(live.id, getExercise())
              toast({ kind: 'info', text: `Added to ${live.name || 'your workout'}` })
              onClose()
              nav(`/session/${live.id}`)
            })}
          </div>
        )}
        {sorted.length ? (
          <>
            <div className="section-label" style={{ margin: 0 }}>
              <span>{tr("My workouts")}</span>
            </div>
            <div className="list-group" style={{ ['--inset' as string]: '66px' }}>
              {sorted.map((w) =>
                row(w.id, <Dumbbell size={18} />, w.name, w.folder ?? '', () => {
                  appendToWorkout(w.id, getExercise())
                  toast({ kind: 'info', text: `Added to ${w.name}` })
                  onClose()
                })
              )}
            </div>
          </>
        ) : (
          !live && (
            <div className="empty">
              <div className="title" style={{ fontWeight: 600 }}>
                {tr("No workouts yet")}
              </div>
              <div className="small muted">{tr("Create a workout or pick a ready-made one first, then add exercises to it.")}</div>
              <button
                className="btn primary"
                onClick={() => {
                  onClose()
                  nav('/programs')
                }}
              >
                {tr("Browse workouts")}
              </button>
            </div>
          )
        )}
      </div>
    </Sheet>
  )
}
