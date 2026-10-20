import { useEffect, useState } from 'react'
import { Exercise } from '../lib/types'
import { libIdForExercise, libIdOf, libImageUrl } from '../lib/libraryLinks'
import { scheduleAutoMatch } from '../lib/autoMatch'
import { Thumb, useImageUrl } from './ui'
import '../styles/workout-live.css'
import '../styles/library.css'

type ExLike = Pick<Exercise, 'name' | 'muscle' | 'image_path'> | null | undefined

/**
 * The user's own uploaded photo (a storage path), or null. Library links (`lib:<id>`) are not storage paths,
 * so they are left out here: use `useExerciseImageUrl` / `ExerciseThumb` to also get library photos.
 */
export function exerciseImagePath(ex: ExLike): string | null {
  return ex?.image_path && !libIdOf(ex.image_path) ? ex.image_path : null
}

/**
 * The one place that decides which picture an exercise shows:
 * its library photo (`lib:<id>`, or a built-in name match), else the user's own photo, else null (initials).
 */
export function useExerciseImageUrl(ex: ExLike, frame: 0 | 1 = 0): string | null {
  const libId = libIdForExercise(ex)
  const own = useImageUrl(libId ? null : exerciseImagePath(ex))
  return libId ? libImageUrl(libId, frame) : own
}

/** Round exercise thumbnail used in lists, the picker, the workout screen and summaries. */
export function ExerciseThumb({ exercise, name, size = 44 }: { exercise: ExLike; name?: string; size?: number }) {
  const libId = libIdForExercise(exercise)
  // a saved exercise with no picture at all: find it one from the library in the background
  const needsPhoto = !!exercise && 'id' in exercise && !exercise.image_path
  useEffect(() => {
    if (needsPhoto) scheduleAutoMatch()
  }, [needsPhoto])
  if (libId) return <LibThumb id={libId} name={exercise?.name ?? name} muscle={exercise?.muscle} size={size} />
  return <Thumb path={exerciseImagePath(exercise)} name={exercise?.name ?? name} muscle={exercise?.muscle} size={size} className="round" />
}

/** Round thumbnail of a library exercise. Falls back to the initials plate when the photo cannot load (offline, not cached). */
export function LibThumb({ id, name, muscle, size = 44 }: { id: string; name?: string; muscle?: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [id])
  if (failed) return <Thumb path={null} name={name} muscle={muscle} size={size} className="round" />
  return (
    <div className="thumb round lib-thumb" style={{ width: size, height: size }}>
      <img src={libImageUrl(id)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    </div>
  )
}

/**
 * Big library photo. The library has a start and an end position; a tap flips between them,
 * so the move reads like a two-frame animation.
 */
export function LibPhoto({ id, name, frames = 2 }: { id: string; name: string; frames?: number }) {
  const [frame, setFrame] = useState<0 | 1>(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFrame(0)
    setFailed(false)
  }, [id])
  // warm the second frame so the first tap flips instantly
  useEffect(() => {
    if (frames < 2) return
    const img = new Image()
    img.src = libImageUrl(id, 1)
  }, [id, frames])

  if (failed)
    return (
      <div className="lib-photo failed">
        <Thumb path={null} name={name} size={96} className="round" />
        <div className="small muted">Photo not available offline.</div>
      </div>
    )
  const two = frames > 1
  return (
    <button
      type="button"
      className="lib-photo"
      onClick={() => two && setFrame((f) => (f ? 0 : 1))}
      disabled={!two}
      aria-label={two ? `${name}: ${frame ? 'end' : 'start'} position. Tap to show the ${frame ? 'start' : 'end'} position.` : name}
    >
      <img src={libImageUrl(id, frame)} alt="" onError={() => setFailed(true)} />
      {two && (
        <span className="lib-frames" aria-hidden>
          <span className={frame === 0 ? 'on' : ''}>Start</span>
          <span className={frame === 1 ? 'on' : ''}>End</span>
        </span>
      )}
    </button>
  )
}
