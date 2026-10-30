import { useEffect, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { Check, X } from 'lucide-react'
import { SharedExercise, isExerciseAdmin, pendingSuggestions, reviewSuggestion } from '../lib/community'
import { useStore } from '../lib/store'
import { TRACKING_LABEL } from '../lib/tracking'

/** Settings, admins only: exercises people created, waiting to join everyone's library. */
export function SuggestedExercises() {
  const [admin, setAdmin] = useState(false)
  const [list, setList] = useState<SharedExercise[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useStore((s) => s.toast)

  useEffect(() => {
    let alive = true
    isExerciseAdmin().then((a) => {
      if (!alive || !a) return
      setAdmin(true)
      pendingSuggestions().then(
        (l) => alive && setList(l),
        () => alive && setList([])
      )
    })
    return () => {
      alive = false
    }
  }, [])

  if (!admin) return null

  async function review(x: SharedExercise, status: 'approved' | 'rejected') {
    setBusy(x.id)
    try {
      await reviewSuggestion(x.id, status)
      setList((l) => l?.filter((y) => y.id !== x.id) ?? null)
    } catch {
      toast({ kind: 'error', text: 'Could not save that', sub: 'Check the connection and try again.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card stack" aria-label={tr("Suggested exercises")}>
      <h2>{tr("Suggested exercises")}</h2>
      {list == null ? (
        <div className="small muted">Loading…</div>
      ) : list.length === 0 ? (
        <div className="small muted">{tr("Nothing waiting. New exercises people create show up here.")}</div>
      ) : (
        <div className="sx-list">
          {list.map((x) => (
            <div className="sx-row" key={x.id}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis">{x.name}</div>
                <div className="small muted ellipsis">{[x.muscle, x.equipment, TRACKING_LABEL[x.tracking]].filter(Boolean).join(' · ')}</div>
              </div>
              <button className="btn sm" disabled={busy === x.id} onClick={() => review(x, 'rejected')} aria-label={`Reject ${x.name}`}>
                <X size={16} aria-hidden />
              </button>
              <button className="btn sm primary" disabled={busy === x.id} onClick={() => review(x, 'approved')} aria-label={`Add ${x.name} for everyone`}>
                <Check size={16} aria-hidden /> {tr("Add")}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
