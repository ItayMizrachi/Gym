import { Workout } from './types'

/** Name shown for workouts with no folder. */
export const NO_FOLDER = 'My workouts'

export const folderOf = (w: Pick<Workout, 'folder'>) => (w.folder ?? '').trim()

/** Folder names in the order they first appear (by workout position). */
export function listFolders(workouts: Workout[]): string[] {
  const out: string[] = []
  for (const w of [...workouts].sort((a, b) => a.position - b.position)) {
    const f = folderOf(w)
    if (f && !out.includes(f)) out.push(f)
  }
  return out
}

export interface FolderGroup {
  /** '' = no folder */
  folder: string
  label: string
  workouts: Workout[]
}

/** Workouts grouped by folder: unfiled ones ("My workouts") first, then folders in order of first appearance. */
export function groupByFolder(workouts: Workout[]): FolderGroup[] {
  const sorted = [...workouts].sort((a, b) => a.position - b.position)
  const groups: FolderGroup[] = []
  const loose = sorted.filter((w) => !folderOf(w))
  if (loose.length) groups.push({ folder: '', label: NO_FOLDER, workouts: loose })
  for (const f of listFolders(sorted)) groups.push({ folder: f, label: f, workouts: sorted.filter((w) => folderOf(w) === f) })
  return groups
}
