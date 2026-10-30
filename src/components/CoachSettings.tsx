import { useEffect, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Users } from 'lucide-react'
import { MyCoach, acceptInvite, leaveCoach, myCoaches, setCoachRole, useCoachRole } from '../lib/coach'
import { useStore } from '../lib/store'
import { Confirm, Toggle } from './ui'

/** a typed or pasted code; from a pasted invite message, the code after the word "code" */
export function cleanCode(v: string): string {
  const m = v.match(/\bcode\s+([A-Za-z0-9]{6})\b/i)
  return (m ? m[1] : v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

/** Settings → Coaching: "I coach other people", and the trainee's side (enter a code, see or remove the coach). */
export function CoachSettings() {
  const nav = useNavigate()
  const coach = useCoachRole()
  const toast = useStore((s) => s.toast)
  const [coaches, setCoaches] = useState<MyCoach[] | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<MyCoach | null>(null)

  const load = () => myCoaches().then(setCoaches, () => setCoaches([]))
  useEffect(() => {
    void load()
  }, [])

  return (
    <section className="card stack" aria-label={tr("Coaching")}>
      <h2>{tr("Coaching")}</h2>
      <div className="row set-tog">
        <div className="grow" onClick={() => setCoachRole(!coach)} style={{ cursor: 'pointer' }}>
          <div>{tr("I coach other people")}</div>
          <div className="small muted">{tr("Plans and progress for your trainees. Free for now.")}</div>
        </div>
        <Toggle on={coach} onChange={setCoachRole} ariaLabel="I coach other people" />
      </div>
      {coach && (
        <button className="btn set-link" onClick={() => nav('/coach')}>
          <Users size={18} aria-hidden />
          <span className="grow set-link-t">{tr("My trainees")}</span>
          <ChevronRight size={16} aria-hidden />
        </button>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <div>{tr("My coach")}</div>
        {coaches?.map((c) => (
          <div key={c.id} className="row" style={{ gap: 8 }}>
            <div className="grow small ellipsis" style={{ minWidth: 0 }}>
              {c.coach_email} sees your training and can add workouts.
            </div>
            <button className="btn sm" onClick={() => setLeaving(c)}>
              {tr("Remove")}
            </button>
          </div>
        ))}
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={async (e) => {
            e.preventDefault()
            if (code.trim().length < 4 || busy) return
            setBusy(true)
            setError(null)
            try {
              await acceptInvite(code)
              setCode('')
              // a coach who logged for you before you joined: that training is now yours, load it
              window.setTimeout(() => location.reload(), 1500)
              toast({ kind: 'info', text: 'Connected to your coach', sub: 'Their workouts appear on your Train tab.' })
              await load()
            } catch (err) {
              setError((err as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <input
            className="input grow"
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            placeholder={tr("Code from your coach")}
            aria-label={tr("Code from your coach")}
            autoCapitalize="characters"
            autoComplete="off"
            enterKeyHint="go"
          />
          <button className="btn primary" type="submit" disabled={code.length < 4 || busy}>
            {tr("Connect")}
          </button>
        </form>
        {error && <div className="small" style={{ color: 'var(--danger-text)' }}>{error}</div>}
      </div>

      {leaving && (
        <Confirm
          title={tr("Remove your coach?")}
          text={`${leaving.coach_email} will no longer see your training. Workouts they added stay in your plan.`}
          confirmLabel={tr("Remove")}
          danger
          onClose={() => setLeaving(null)}
          onConfirm={async () => {
            const c = leaving
            setLeaving(null)
            try {
              await leaveCoach(c.id)
              await load()
            } catch (e) {
              toast({ kind: 'error', text: (e as Error).message })
            }
          }}
        />
      )}
    </section>
  )
}
