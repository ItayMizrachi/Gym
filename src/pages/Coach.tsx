import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Copy, Share2, UserPlus } from 'lucide-react'
import { CoachLink, createInvite, listTrainees, removeTrainee } from '../lib/coach'
import { useStore } from '../lib/store'
import { Confirm, PageHeader, Sheet } from '../components/ui'
import '../styles/coach.css'

/** Coach screen: the trainee list, and invites waiting for a code to be entered. */
export default function Coach() {
  const nav = useNavigate()
  const cloud = useStore((s) => s.repo?.mode === 'cloud')
  const [list, setList] = useState<CoachLink[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [invite, setInvite] = useState<CoachLink | null>(null)
  const [cancel, setCancel] = useState<CoachLink | null>(null)

  const load = () =>
    listTrainees().then(
      (l) => {
        setList(l)
        setError(null)
      },
      (e: Error) => setError(e.message)
    )
  useEffect(() => {
    if (cloud) void load()
  }, [cloud])

  const active = list?.filter((l) => l.status === 'active') ?? []
  const waiting = list?.filter((l) => l.status === 'invited') ?? []

  return (
    <div className="stack coach" style={{ gap: 16 }}>
      <PageHeader title="Coaching" sub="Your trainees, their plans and progress." back="/" />
      {!cloud ? (
        <div className="card small muted">Sign in with Google to coach other people.</div>
      ) : error ? (
        <div className="card stack">
          <div className="small muted">{error}</div>
          <button className="btn" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : list == null ? (
        <div className="card small muted">Loading…</div>
      ) : (
        <>
          {active.length > 0 ? (
            <div className="list-group">
              {active.map((l) => (
                <button key={l.id} className="list-row" onClick={() => nav(`/coach/${l.id}`)}>
                  <span className="coach-avatar" aria-hidden>
                    {l.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="title ellipsis" style={{ display: 'block' }}>
                      {l.name}
                    </span>
                    <span className="meta ellipsis" style={{ display: 'block' }}>
                      {l.trainee_email}
                    </span>
                  </span>
                  <ChevronRight size={18} aria-hidden />
                </button>
              ))}
            </div>
          ) : (
            <div className="card stack coach-empty">
              <div className="title">Add your first trainee</div>
              <div className="small muted">You get a short code. Your trainee enters it in GymLog under Settings → My coach, and you see their training.</div>
            </div>
          )}

          <button className="btn primary block" onClick={() => setAdding(true)}>
            <UserPlus size={18} aria-hidden /> Add trainee
          </button>

          {waiting.length > 0 && (
            <section className="stack" style={{ gap: 8 }} aria-label="Waiting for a code">
              <h2 className="coach-h2">Waiting for their code</h2>
              <div className="list-group">
                {waiting.map((l) => (
                  <button key={l.id} className="list-row" onClick={() => setInvite(l)}>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="title ellipsis" style={{ display: 'block' }}>
                        {l.name}
                      </span>
                      <span className="meta">Code {l.code}</span>
                    </span>
                    <ChevronRight size={18} aria-hidden />
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {adding && (
        <AddTrainee
          onClose={() => setAdding(false)}
          onCreated={(l) => {
            setAdding(false)
            setList((x) => [...(x ?? []), l])
            setInvite(l)
          }}
        />
      )}
      {invite && <InviteSheet link={invite} onClose={() => setInvite(null)} onCancel={() => setCancel(invite)} />}
      {cancel && (
        <Confirm
          title={`Cancel the invite for ${cancel.name}?`}
          text="The code stops working."
          confirmLabel="Cancel invite"
          cancelLabel="Keep"
          danger
          onClose={() => setCancel(null)}
          onConfirm={async () => {
            const l = cancel
            setCancel(null)
            setInvite(null)
            try {
              await removeTrainee(l)
              setList((x) => x?.filter((y) => y.id !== l.id) ?? null)
            } catch (e) {
              useStore.getState().toast({ kind: 'error', text: (e as Error).message })
            }
          }}
        />
      )}
    </div>
  )
}

function AddTrainee({ onClose, onCreated }: { onClose: () => void; onCreated: (l: CoachLink) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet title="Add trainee" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || busy) return
          setBusy(true)
          try {
            onCreated(await createInvite(name))
          } catch (err) {
            setError((err as Error).message)
            setBusy(false)
          }
        }}
      >
        <label className="field">
          Their name
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dana" autoFocus enterKeyHint="done" maxLength={60} />
        </label>
        {error && <div className="small" style={{ color: 'var(--danger-text)' }}>{error}</div>}
        <button className="btn primary block" type="submit" disabled={!name.trim() || busy}>
          Get a code
        </button>
      </form>
    </Sheet>
  )
}

function InviteSheet({ link, onClose, onCancel }: { link: CoachLink; onClose: () => void; onCancel: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = `Join me on GymLog so I can coach you: open https://itaymizrachi.github.io/Gym/, go to Settings → My coach and enter the code ${link.code}`
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  return (
    <Sheet title={`Invite ${link.name}`} onClose={onClose}>
      <div className="stack">
        <div className="small muted">They enter this code in GymLog under Settings → My coach.</div>
        <div className="coach-code" aria-label={`Code ${link.code.split('').join(' ')}`}>
          {link.code}
        </div>
        {canShare ? (
          <button className="btn primary block" onClick={() => navigator.share({ text }).catch(() => {})}>
            <Share2 size={18} aria-hidden /> Send the code
          </button>
        ) : null}
        <button
          className={`btn block${canShare ? '' : ' primary'}`}
          onClick={() =>
            navigator.clipboard?.writeText(text).then(
              () => setCopied(true),
              () => {}
            )
          }
        >
          <Copy size={18} aria-hidden /> {copied ? 'Copied' : 'Copy the message'}
        </button>
        <button className="btn ghost block" style={{ color: 'var(--danger-text)' }} onClick={onCancel}>
          Cancel invite
        </button>
      </div>
    </Sheet>
  )
}
