import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCw } from 'lucide-react'
import { Exercise } from '../lib/types'
import { libIdForExercise } from '../lib/libraryLinks'
import { loadInstructions } from '../lib/library'
import { ExerciseThumb, LibPhoto, useExerciseImageUrl } from './ExerciseImage'
import { Sheet } from './ui'
import '../styles/library.css'

type ExLike = (Pick<Exercise, 'name' | 'muscle' | 'image_path'> & Partial<Pick<Exercise, 'id' | 'equipment' | 'notes' | 'setup'>>) | null | undefined

/** Numbered steps from the library. Loaded on demand (its own chunk). */
export function useSteps(id: string | null) {
  const [steps, setSteps] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!id) return
    let alive = true
    setSteps(null)
    setFailed(false)
    loadInstructions(id).then(
      (s) => alive && setSteps(s),
      () => alive && setFailed(true)
    )
    return () => {
      alive = false
    }
  }, [id, attempt])
  return { steps, failed, retry: () => setAttempt((a) => a + 1) }
}

/** The numbered "how to" list for a library exercise (nothing when it has no steps). */
export function StepList({ id }: { id: string }) {
  const { steps, failed, retry } = useSteps(id)
  if (failed)
    return (
      <div className="row small muted" style={{ justifyContent: 'space-between' }}>
        Instructions could not load.
        <button className="btn sm" onClick={retry}>
          <RotateCw size={14} /> Try again
        </button>
      </div>
    )
  if (!steps) return <div className="small muted">Loading…</div>
  if (!steps.length) return null
  return (
    <ol className="lib-steps">
      {steps.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ol>
  )
}

/** "How to do it" card used on exercise pages. */
export function HowToCard({ id }: { id: string }) {
  return (
    <div className="card stack">
      <h2>How to do it</h2>
      <StepList id={id} />
    </div>
  )
}

/** Photo (start/end, or the user's own) + what it works + the numbered steps. Shared by the sheet and the workout info sheet. */
export function HowToBody({ exercise, name }: { exercise: ExLike; name?: string }) {
  const libId = libIdForExercise(exercise)
  const ownUrl = useExerciseImageUrl(libId ? null : exercise)
  const title = exercise?.name ?? name ?? 'Exercise'
  const meta = [exercise?.muscle, exercise?.equipment].filter(Boolean).join(' · ')
  return (
    <>
      {libId ? (
        <LibPhoto id={libId} name={title} />
      ) : ownUrl ? (
        <div className="thumb lg">
          <img src={ownUrl} alt={`Photo of ${title}`} />
        </div>
      ) : null}
      {meta && <div className="lib-muscle-line">{meta}</div>}
      {libId ? (
        <>
          <h3 className="lib-howto-h">How to do it</h3>
          <StepList id={libId} />
        </>
      ) : (
        !exercise?.notes && <div className="small muted">No instructions for this exercise yet. Add your own cues on its page.</div>
      )}
    </>
  )
}

/** Quick explanation of an exercise: start/end photos, what it works, the steps, the user's own setup and notes. */
export function HowToSheet({ exercise, name, onClose }: { exercise: ExLike; name?: string; onClose: () => void }) {
  const nav = useNavigate()
  return (
    <Sheet title={exercise?.name ?? name ?? 'Exercise'} onClose={onClose}>
      <div className="stack" style={{ gap: 'var(--s3)' }}>
        <HowToBody exercise={exercise} name={name} />
        {exercise?.setup && (
          <div className="card">
            <div className="tiny muted">Your setup</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{exercise.setup}</div>
          </div>
        )}
        {exercise?.notes && (
          <div className="card">
            <div className="tiny muted">Your notes</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{exercise.notes}</div>
          </div>
        )}
        {exercise?.id && (
          <button
            className="btn"
            onClick={() => {
              onClose()
              nav(`/exercise/${exercise.id}`)
            }}
          >
            Open exercise page
          </button>
        )}
      </div>
    </Sheet>
  )
}

/**
 * Round exercise thumbnail you can tap to see how the exercise is done.
 * Use it where the thumb is not already inside another button.
 */
export function ThumbButton({ exercise, name, size = 44 }: { exercise: ExLike; name?: string; size?: number }) {
  const [open, setOpen] = useState(false)
  const title = exercise?.name ?? name ?? 'exercise'
  return (
    <>
      <button
        type="button"
        className="thumb-btn"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={`How to do ${title}`}
      >
        <ExerciseThumb exercise={exercise} name={name} size={size} />
      </button>
      {open && <HowToSheet exercise={exercise} name={name} onClose={() => setOpen(false)} />}
    </>
  )
}
