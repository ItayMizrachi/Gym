import { useState } from 'react'
import { t as tr } from '../lib/i18n'
import { Check, Folder, FolderPlus, Inbox, Pin, Layers } from 'lucide-react'
import { useStore } from '../lib/store'
import { folderOf, listFolders, makeCurrent, NO_FOLDER, unshelveAll } from '../lib/folders'
import { Sheet } from './ui'
import '../styles/programs-nav.css'

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
      {current === folder && <Check size={18} aria-label={tr("Current folder")} style={{ color: 'var(--ok)' }} />}
    </button>
  )
  return (
    <Sheet title={tr("Move to folder")} onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="small muted">{tr("Folders group workouts on the Train tab, for example one folder per program.")}</div>
        <div className="list-group">
          {row('', tr('{f} (no folder)', { f: tr(NO_FOLDER) }), <Inbox size={18} aria-hidden />)}
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
            placeholder={tr("New folder name")}
            aria-label={tr("New folder name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            enterKeyHint="done"
          />
          <button className="btn" type="submit" disabled={!name.trim()}>
            <FolderPlus size={16} /> {tr("Create")}
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
  const anyShelved = workouts.some((w) => w.shelved)
  // already the only program on Train
  const isCurrent = anyShelved && workouts.every((w) => !!w.shelved === (folderOf(w) !== folder))
  return (
    <Sheet title={tr("Folder")} onClose={onClose}>
      <div className="list-group" style={{ marginBottom: 16 }}>
        {!isCurrent && (
          <button
            className="list-row"
            onClick={() => {
              for (const w of makeCurrent(workouts, folder)) save('workouts', w)
              onClose()
            }}
          >
            <Pin size={18} aria-hidden />
            <span className="grow" style={{ textAlign: 'start' }}>
              {tr('Make this my current program')}
              <span className="small muted" style={{ display: 'block' }}>
                {tr('Only this one shows on Train and in Up next. The others fold away below; nothing is deleted.')}
              </span>
            </span>
          </button>
        )}
        {anyShelved && (
          <button
            className="list-row"
            onClick={() => {
              for (const w of unshelveAll(workouts)) save('workouts', w)
              onClose()
            }}
          >
            <Layers size={18} aria-hidden />
            <span className="grow" style={{ textAlign: 'start' }}>
              {tr('Show all programs')}
            </span>
          </button>
        )}
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) apply(name.trim())
        }}
      >
        <label className="field">
          {tr("Folder name")}
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus enterKeyHint="done" />
        </label>
        <button className="btn primary" type="submit" disabled={!name.trim() || name.trim() === folder}>
          {tr("Rename")}
        </button>
        <button className="btn" type="button" onClick={() => apply('')}>
          {tr("Remove folder (keeps the workouts)")}
        </button>
      </form>
    </Sheet>
  )
}
