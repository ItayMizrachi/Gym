import { Exercise } from '../lib/types'
import { Thumb } from './ui'
import '../styles/workout-live.css'

type ExLike = Pick<Exercise, 'name' | 'muscle' | 'image_path'> | null | undefined

/**
 * The one place that decides which picture an exercise shows. Today: the user's own photo,
 * else a plate with the initials. A future built-in library can add its stock photo here
 * (e.g. look up by exercise name) without touching any screen.
 */
export function exerciseImagePath(ex: ExLike): string | null {
  return ex?.image_path ?? null
}

/** Round exercise thumbnail used in lists, the picker and the workout screen. */
export function ExerciseThumb({ exercise, name, size = 44 }: { exercise: ExLike; name?: string; size?: number }) {
  return <Thumb path={exerciseImagePath(exercise)} name={exercise?.name ?? name} muscle={exercise?.muscle} size={size} className="round" />
}
