import { useEffect, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Copy, Share2, Sparkles, UserPlus } from 'lucide-react'
import { COACH_FREE_LIMIT, CoachLink, createInvite, createManagedTrainee, listTrainees, removeTrainee } from '../lib/coach'
import { TraineeGlance, prefetchTrainees } from '../lib/coachData'
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
  const [pro, setPro] = useState(false)
  const [glances, setGlances] = useState<Map<string, TraineeGlance>>(new Map())

  const load = () =>
    listTrainees().then(
      (l) => {
        setList(l)
        setError(null)
        void prefetchTrainees(l).then(setGlances)
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
      <PageHeader title={tr("Coaching")} sub={tr("Your trainees, their plans and progress.")} back="/" />
      {!cloud ? (
        <div className="card small muted">{tr("Sign in with Google to coach other people.")}</div>
      ) : error ? (
        <div className="card stack">
          <div className="small muted">{error}</div>
          <button className="btn" onClick={() => void load()}>
            {tr("Try again")}
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
                    <GlanceLine g={glances.get(l.id)} fallback={l.trainee_email ?? ''} />
                  </span>
                  <ChevronRight size={18} aria-hidden />
                </button>
              ))}
            </div>
          ) : (
            <div className="card stack coach-empty">
              <div className="title">{tr("Add your first trainee")}</div>
              <div className="small muted">You get a short code. Your trainee enters it in GymLog under Settings → My coach, and you see their training.</div>
            </div>
          )}

          <button
            className="btn primary block"
            onClick={() => (COACH_FREE_LIMIT != null && (list?.length ?? 0) >= COACH_FREE_LIMIT ? setPro(true) : setAdding(true))}
          >
            <UserPlus size={18} aria-hidden /> {tr("Add trainee")}
          </button>
          <button className="btn ghost block coach-pro-link" onClick={() => setPro(true)}>
            <Sparkles size={16} aria-hidden /> {tr("Coaching is free during the preview")}
          </button>

          {waiting.length > 0 && (
            <section className="stack" style={{ gap: 8 }} aria-label={tr("Waiting for a code")}>
              <h2 className="coach-h2">{tr("Waiting for their code")}</h2>
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
          onManaged={(linkId) => {
            setAdding(false)
            nav(`/coach/${linkId}`)
          }}
        />
      )}
      {pro && <ProSheet onClose={() => setPro(false)} />}
      {invite && <InviteSheet link={invite} onClose={() => setInvite(null)} onCancel={() => setCancel(invite)} />}
      {cancel && (
        <Confirm
          title={`Cancel the invite for ${cancel.name}?`}
          text={tr("The code stops working.")}
          confirmLabel={tr("Cancel invite")}
          cancelLabel={tr("Keep")}
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

function AddTrainee({ onClose, onCreated, onManaged }: { onClose: () => void; onCreated: (l: CoachLink) => void; onManaged: (linkId: string) => void }) {
  const [name, setName] = useState('')
  // app = they use GymLog themselves (a code to enter); none = you log for them, they never need the app
  const [mode, setMode] = useState<'app' | 'none'>('app')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet title={tr("Add trainee")} onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || busy) return
          setBusy(true)
          try {
            if (mode === 'app') onCreated(await createInvite(name))
            else onManaged(await createManagedTrainee(name))
          } catch (err) {
            setError((err as Error).message)
            setBusy(false)
          }
        }}
      >
        <label className="field">
          {tr("Their name")}
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Dana")} autoFocus enterKeyHint="done" maxLength={60} />
        </label>
        <div className="coach-mode" role="radiogroup" aria-label={tr('How they train with you')}>
          <button type="button" role="radio" aria-checked={mode === 'app'} className={mode === 'app' ? 'on' : ''} onClick={() => setMode('app')}>
            <span className="coach-mode-t">{tr('They use GymLog')}</span>
            <span className="small muted">{tr('They log their own workouts. You get a code to send them.')}</span>
          </button>
          <button type="button" role="radio" aria-checked={mode === 'none'} className={mode === 'none' ? 'on' : ''} onClick={() => setMode('none')}>
            <span className="coach-mode-t">{tr('Without the app')}</span>
            <span className="small muted">{tr('You log their workouts and weight. They can join the app later and keep everything.')}</span>
          </button>
        </div>
        {error && <div className="small" style={{ color: 'var(--danger-text)' }}>{error}</div>}
        <button className="btn primary block" type="submit" disabled={!name.trim() || busy}>
          {tr(mode === 'app' ? 'Get a code' : 'Add {name}', { name: name.trim() || tr('trainee') })}
        </button>
      </form>
    </Sheet>
  )
}

export function InviteSheet({ link, onClose, onCancel }: { link: CoachLink; onClose: () => void; onCancel?: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = tr('Join me on GymLog so I can coach you: open https://itaymizrachi.github.io/Gym/, sign in with Google, go to Settings → My coach and enter the code {code}', { code: link.code })
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  return (
    <Sheet title={tr('Invite {name}', { name: link.name })} onClose={onClose}>
      <div className="stack">
        <div className="small muted">
          {tr('They enter this code in GymLog under Settings → My coach.')}
          {link.managed && ' ' + tr('Everything you logged for them moves to their own account.')}
        </div>
        <div className="coach-code" aria-label={`Code ${link.code.split('').join(' ')}`}>
          {link.code}
        </div>
        {canShare ? (
          <button className="btn primary block" onClick={() => navigator.share({ text }).catch(() => {})}>
            <Share2 size={18} aria-hidden /> {tr("Send the code")}
          </button>
        ) : null}
        <button
          className={`btn block${canShare ? '' : ' primary'}`}
          onClick={() =>
            navigator.clipboard?.writeText(link.code).then(
              () => setCopied(true),
              () => {}
            )
          }
        >
          <Copy size={18} aria-hidden /> {tr(copied ? 'Code copied' : 'Copy the code')}
        </button>
        {onCancel && (
          <button className="btn ghost block" style={{ color: 'var(--danger-text)' }} onClick={onCancel}>
            {tr("Cancel invite")}
          </button>
        )}
      </div>
    </Sheet>
  )
}

/** "Trained 2 days ago · 3 new records", or a warning after a week without training */
function GlanceLine({ g, fallback }: { g: TraineeGlance | undefined; fallback: string }) {
  if (!g) return <span className="meta ellipsis" style={{ display: 'block' }}>{fallback}</span>
  const when = g.daysSince == null ? 'No workouts yet' : g.daysSince === 0 ? 'Trained today' : g.daysSince === 1 ? 'Trained yesterday' : `${g.daysSince >= 7 ? 'No workout for' : 'Trained'} ${g.daysSince} days${g.daysSince >= 7 ? '' : ' ago'}`
  const idle = g.daysSince == null || g.daysSince >= 7
  return (
    <span className="meta ellipsis" style={{ display: 'block' }}>
      <span className={idle ? 'coach-idle' : undefined}>{when}</span>
      {g.newPRs > 0 && <span className="coach-pr-inline"> · {g.newPRs} new {g.newPRs === 1 ? 'record' : 'records'}</span>}
    </span>
  )
}

/** what GymLog Pro for coaches will be; nothing to buy yet */
function ProSheet({ onClose }: { onClose: () => void }) {
  const limited = COACH_FREE_LIMIT != null
  return (
    <Sheet title={tr("GymLog Pro for coaches")} onClose={onClose}>
      <div className="stack">
        <div className="small muted">
          {limited
            ? `The free plan coaches up to ${COACH_FREE_LIMIT} trainees. Pro is for coaches with more.`
            : 'Coaching is free while it is new. Later it becomes part of GymLog Pro; your trainees and their plans stay as they are.'}
        </div>
        <ul className="coach-pro-list">
          <li>{tr("Unlimited trainees")}</li>
          <li>{tr("Plans, notes and progress for each of them")}</li>
          <li>{tr("Alerts when someone stops training or breaks a record")}</li>
        </ul>
        <button className="btn primary block" onClick={onClose}>
          {limited ? 'Coming soon' : 'Got it'}
        </button>
      </div>
    </Sheet>
  )
}
