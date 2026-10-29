import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Trash2, Trophy } from 'lucide-react'
import { CoachNote, addNote, deleteNote, listNotes } from '../lib/coach'
import { useTraineeData } from '../lib/coachData'
import { useStore } from '../lib/store'
import { trackingOf } from '../lib/types'
import { setLabel } from '../lib/tracking'
import { sessionDate } from '../lib/pr'
import { fmtDateLong } from '../lib/format'
import { fmtVolume, prSetIds, summarizeSession } from '../lib/stats'
import { PageHeader } from '../components/ui'
import '../styles/coach.css'

/** Coach: one of a trainee's workouts, set by set, with notes the trainee sees on that workout. */
export default function CoachSession() {
  const { id, sid } = useParams()
  const { link, db, error, reload } = useTraineeData(id)
  const toast = useStore((s) => s.toast)
  const [notes, setNotes] = useState<CoachNote[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const s = db?.sessions.find((x) => x.id === sid) ?? null
  const prIds = useMemo(() => (db && s ? prSetIds(db, s) : new Set<string>()), [db, s])

  useEffect(() => {
    if (!link?.trainee_id) return
    listNotes(link.trainee_id).then(
      (l) => setNotes(l.filter((n) => n.session_id === sid).reverse()),
      () => setNotes([])
    )
  }, [link?.trainee_id, sid])

  if (error)
    return (
      <div className="stack coach" style={{ gap: 16 }}>
        <PageHeader title="Workout" back={`/coach/${id}`} />
        <div className="card stack">
          <div className="small muted">{error}</div>
          <button className="btn" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      </div>
    )
  if (!db || !link) return <div className="card small muted">Loading…</div>
  if (!s) return <div className="card small muted">This workout is no longer there.</div>

  const sum = summarizeSession(s)
  return (
    <div className="stack coach" style={{ gap: 16 }}>
      <PageHeader title={s.name} sub={`${link.name} · ${fmtDateLong(sessionDate(s))}`} back={`/coach/${id}`} />
      <div className="coach-stats">
        <div>
          <div className="coach-n">{sum.minutes < 60 ? `${sum.minutes}m` : `${Math.floor(sum.minutes / 60)}h ${sum.minutes % 60}m`}</div>
          <div className="tiny muted">Time</div>
        </div>
        <div>
          <div className="coach-n">{sum.sets}</div>
          <div className="tiny muted">Sets</div>
        </div>
        <div>
          <div className="coach-n">{sum.volume > 0 ? fmtVolume(sum.volume) : '–'}</div>
          <div className="tiny muted">Volume</div>
        </div>
        <div>
          <div className="coach-n">{prIds.size}</div>
          <div className="tiny muted">Records</div>
        </div>
      </div>

      <div className="list-group">
        {s.data.exercises.map((e, i) => {
          const ex = db.exercises.find((x) => x.id === e.exercise_id)
          const done = e.sets.filter((x) => x.done)
          return (
            <div key={i} className="list-row coach-ex">
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="title">{ex?.name ?? e.name}</div>
                {done.length === 0 ? (
                  <div className="meta">Skipped</div>
                ) : (
                  <div className="coach-sets">
                    {done.map((x) => (
                      <span key={x.id} className={prIds.has(x.id) ? 'pr' : undefined}>
                        {prIds.has(x.id) && <Trophy size={12} aria-label="Record" />}
                        {setLabel(x, trackingOf(ex))}
                      </span>
                    ))}
                  </div>
                )}
                {e.note && <div className="small muted">“{e.note}”</div>}
              </div>
            </div>
          )
        })}
      </div>
      {s.notes && <div className="small muted">Their note: “{s.notes}”</div>}

      <section className="stack" style={{ gap: 8 }} aria-label="Your notes">
        <h2 className="coach-h2">Your note</h2>
        {notes?.map((n) => (
          <div key={n.id} className="card coach-note">
            <div className="grow">{n.text}</div>
            <button
              className="btn icon ghost"
              aria-label="Delete note"
              onClick={async () => {
                try {
                  await deleteNote(n.id)
                  setNotes((l) => l?.filter((x) => x.id !== n.id) ?? null)
                } catch (e) {
                  toast({ kind: 'error', text: (e as Error).message })
                }
              }}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ))}
        <form
          className="stack"
          style={{ gap: 8 }}
          onSubmit={async (ev) => {
            ev.preventDefault()
            if (!text.trim() || busy || !link.trainee_id) return
            setBusy(true)
            try {
              const n = await addNote(link.trainee_id, s.id, text)
              setNotes((l) => [...(l ?? []), n])
              setText('')
            } catch (e) {
              toast({ kind: 'error', text: (e as Error).message })
            } finally {
              setBusy(false)
            }
          }}
        >
          <textarea
            className="input"
            rows={3}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Great depth on the squats. Add 2.5 kg next time."
            aria-label={`Note for ${link.name}`}
          />
          <button className="btn primary block" type="submit" disabled={!text.trim() || busy}>
            Send to {link.name}
          </button>
        </form>
      </section>
    </div>
  )
}
