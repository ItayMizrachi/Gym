import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { t as tr } from '../lib/i18n'
import { useStore } from '../lib/store'
import { keepMine, outdatedPrograms, programChanges, programUpdate, type OutdatedProgram } from '../lib/programUpdates'
import { Sheet } from './ui'

/** Train tab: a program you saved has a newer version. Your copy stays as it is until you choose. */
export function ProgramUpdateCard() {
  const db = useStore((s) => s.db)
  const list = useMemo(() => outdatedPrograms(db), [db])
  const [open, setOpen] = useState<OutdatedProgram | null>(null)
  if (!list.length) return null
  return (
    <>
      {list.map((o) => (
        <section key={o.program.id} className="card prog-upd" aria-label={tr('Program updated')}>
          <RefreshCw size={18} className="prog-upd-icon" aria-hidden />
          <div className="grow">
            <div className="prog-upd-t">{tr('{name} was updated', { name: o.program.name })}</div>
            <div className="small muted">{tr('Your copy has not changed. See what is new and decide.')}</div>
          </div>
          <button className="btn sm secondary" onClick={() => setOpen(o)}>
            {tr('See changes')}
          </button>
        </section>
      ))}
      {open && <ChangesSheet o={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function ChangesSheet({ o, onClose }: { o: OutdatedProgram; onClose: () => void }) {
  const db = useStore((s) => s.db)
  const user = useStore((s) => s.user)
  const save = useStore((s) => s.save)
  const remove = useStore((s) => s.remove)
  const toast = useStore((s) => s.toast)
  const changes = useMemo(() => programChanges(db, o), [db, o])

  function update() {
    if (!user) return
    const u = programUpdate(db, o, user.id)
    // parents before children: exercises and workouts first, then their rows; the old rows go last
    for (const e of u.exercises) save('exercises', e)
    for (const w of u.workouts) save('workouts', w)
    for (const r of u.rows) save('workout_exercises', r)
    for (const id of u.remove) remove('workout_exercises', id)
    toast({ kind: 'info', text: 'Plan updated', sub: 'Your history and records stay as they were.' })
    onClose()
  }
  function keep() {
    for (const w of keepMine(o)) save('workouts', w)
    onClose()
  }

  return (
    <Sheet title={tr('What changed in {name}', { name: o.program.name })} onClose={onClose}>
      <div className="stack" style={{ gap: 16 }}>
        {changes.length === 0 ? (
          <p className="muted">{tr('Your copy already matches the new version.')}</p>
        ) : (
          changes.map((c) => (
            <div key={c.name} className="stack" style={{ gap: 6 }}>
              <h3 className="prog-upd-w">{c.name}</h3>
              <ul className="prog-upd-list">
                {c.lines.map((l, i) => (
                  <li key={i}>
                    <bdi>{l}</bdi>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        <p className="small muted">{tr('Updating changes the plan only. Workouts you already did, your history and records stay as they were.')}</p>
        <button className="btn primary block" onClick={update}>
          {tr('Update my plan')}
        </button>
        <button className="btn block" onClick={keep}>
          {tr('Keep mine')}
        </button>
      </div>
    </Sheet>
  )
}
