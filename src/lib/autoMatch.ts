import { useStore } from './store'
import { bestLibraryMatch, loadLibrary } from './library'
import { NAME_TO_LIB, libPath } from './libraryLinks'

/*
 * Every exercise should have a picture, so someone new to the gym can see what it is.
 * Exercises with no picture at all (image_path empty) get their closest library photo, once, in the background.
 * Never touches an exercise that has a photo, and never one where the user said "no thanks" to the match.
 */

const DECLINED_KEY = 'gymlog:no-library-photo'

function declined(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DECLINED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

/** Remember that the user does not want a library photo on this exercise (this device). */
export function declineLibraryPhoto(exerciseId: string) {
  try {
    const s = declined()
    s.add(exerciseId)
    localStorage.setItem(DECLINED_KEY, JSON.stringify([...s]))
  } catch {
    /* private mode: the match may come back next time, which is harmless */
  }
}

const tried = new Set<string>()
let timer: ReturnType<typeof setTimeout> | undefined

/** Ask for a matching pass soon. Cheap to call often: passes are batched and each exercise is tried once per run of the app. */
export function scheduleAutoMatch(delay = 1200) {
  if (timer) return
  timer = setTimeout(() => {
    void autoMatchNow().finally(() => (timer = undefined))
  }, delay)
}

export async function autoMatchNow() {
  const no = declined()
  const todo = () => useStore.getState().db.exercises.filter((e) => !e.image_path && !tried.has(e.id) && !no.has(e.id))
  if (!todo().length) return
  // built-in names need no download
  const rest = []
  for (const e of todo()) {
    const id = NAME_TO_LIB[e.name.trim().toLowerCase()]
    if (id) link(e.id, id)
    else rest.push(e)
  }
  if (!rest.length) return
  let lib
  try {
    lib = await loadLibrary()
  } catch {
    return // offline: try again on a later pass
  }
  for (const e of rest) {
    const m = bestLibraryMatch(lib, e, { fallback: true })
    tried.add(e.id)
    if (m) link(e.id, m.lib.id)
  }
}

function link(exerciseId: string, libId: string) {
  tried.add(exerciseId)
  const { db, save } = useStore.getState()
  // re-read: the user may have added a photo meanwhile
  const cur = db.exercises.find((x) => x.id === exerciseId)
  if (cur && !cur.image_path) save('exercises', { ...cur, image_path: libPath(libId) })
}
