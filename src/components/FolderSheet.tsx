import { useState } from 'react'
import { Check, Folder, FolderPlus, Inbox } from 'lucide-react'
import { useStore } from '../lib/store'
import { folderOf, listFolders, NO_FOLDER } from '../lib/folders'
import { Sheet } from './ui'
import '../styles/programs.css'

/** Put one workout into a folder (existing, new, or none). */
export function MoveToFolderSheet({ workoutId, onClose }: { workoutId: string; onClose: () => void }) {
  const workouts = useStore((s) => s.db.workouts)
  const save = useStore((s) => s.save)
  const w = workouts.find((x) => x.id === workoutId)
  const [name, setName] = useState('')
  if (!w) return null
  const current = folderOf(w)
  const move = (folder: string) => {
    save('workouts', { ...w, folder: folder.trim() })
    onClose()
  }
  const row = (folder: string, label: string, icon: JSX.Element) => (
    <button key={folder || '-'} className="list-row" onClick={() => move(folder)} aria-pressed={current === folder}>
      {icon}
      <span className="grow" style={{ textAlign: 'left' }}>
        {label}
      </span>
      {current === folder && <Check size={18} aria-label="Current folder" style={{ color: 'var(--ok)' }} />}
    </button>
  )
  return (
    <Sheet title="Move to folder" onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="small muted">Folders group workouts on the Train tab, for example one folder per program.</div>
        <div className="list-group">
          {row('', `${NO_FOLDER} (no folder)`, <Inbox size={18} aria-hidden />)}
          {listFolders(workouts).map((f) => row(f, f, <Folder size={18} aria-hidden />))}
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) move(name)
          }}
        >
          <input
            className="input grow"
            placeholder="New folder name"
            aria-label="New folder name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            enterKeyHint="done"
          />
          <button className="btn" type="submit" disabled={!name.trim()}>
            <FolderPlus size={16} /> Create
          </button>
        </form>
      </div>
    </Sheet>
  )
}

/** Rename a folder: every workout in it moves to the new name. */
export function RenameFolderSheet({ folder, onClose }: { folder: string; onClose: () => void }) {
  const workouts = useStore((s) => s.db.workouts)
  const save = useStore((s) => s.save)
  const [name, setName] = useState(folder)
  function apply(next: string) {
    for (const w of workouts) if (folderOf(w) === folder) save('workouts', { ...w, folder: next })
    onClose()
  }
  return (
    <Sheet title="Folder" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) apply(name.trim())
        }}
      >
        <label className="field">
          Folder name
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus enterKeyHint="done" />
        </label>
        <button className="btn primary" type="submit" disabled={!name.trim() || name.trim() === folder}>
          Rename
        </button>
        <button className="btn" type="button" onClick={() => apply('')}>
          Remove folder (keeps the workouts)
        </button>
      </form>
    </Sheet>
  )
}
