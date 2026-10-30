import { useEffect, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { MessageSquare } from 'lucide-react'
import { CoachNote, notesForMySession } from '../lib/coach'

/** On a workout's summary: what the trainee's coach wrote about it (nothing without a coach). */
export function CoachNotes({ sessionId }: { sessionId: string }) {
  const [notes, setNotes] = useState<CoachNote[]>([])
  useEffect(() => {
    let alive = true
    notesForMySession(sessionId).then((n) => alive && setNotes(n))
    return () => {
      alive = false
    }
  }, [sessionId])
  if (!notes.length) return null
  return (
    <section className="card stack coach-notes" style={{ gap: 6 }} aria-label={tr("From your coach")}>
      <div className="row tiny muted" style={{ gap: 6 }}>
        <MessageSquare size={14} aria-hidden /> {tr("From your coach")}
      </div>
      {notes.map((n) => (
        <div key={n.id} style={{ whiteSpace: 'pre-wrap' }}>
          {n.text}
        </div>
      ))}
    </section>
  )
}
