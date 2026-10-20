import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Dumbbell, BookOpen, History, Scale, Settings, Check, SkipForward } from 'lucide-react'
import { useStore } from '../lib/store'
import { fmtClock } from '../lib/format'
import { beep } from '../lib/beep'
import { usePrefs } from '../lib/prefs'
import { cancelRestNotification, scheduleRestNotification } from '../lib/notify'
import '../styles/workout-flow.css'

const RING_R = 30
const RING_C = 2 * Math.PI * RING_R

function RestBar({ inSession }: { inSession: boolean }) {
  const rest = useStore((s) => s.rest)
  const clear = useStore((s) => s.clearRest)
  const adjust = useStore((s) => s.adjustRest)
  const restNotify = usePrefs((s) => s.restNotify)
  const [, tick] = useState(0)

  useEffect(() => {
    if (!rest) return
    const id = setInterval(() => {
      tick((n) => n + 1)
      const r = useStore.getState().rest
      if (r && !r.finished && Date.now() >= r.endsAt) {
        const done = { ...r, finished: true }
        try {
          localStorage.setItem('gymlog:rest', JSON.stringify(done))
        } catch {
          /* ignore */
        }
        useStore.setState({ rest: done })
        if (localStorage.getItem('gymlog:sound') !== 'off') beep(3)
      }
    }, 250)
    return () => clearInterval(id)
  }, [rest?.endsAt, rest?.finished])

  // background alert: (re)scheduled whenever the end time moves, cancelled on skip / OK.
  // Reaching the end (finished) leaves it alone so the pending alert still fires while hidden.
  useEffect(() => {
    if (!rest || !restNotify) cancelRestNotification()
    else if (!rest.finished) scheduleRestNotification(rest.endsAt, rest.label)
  }, [rest?.endsAt, rest == null, restNotify])

  if (!rest) return null
  const left = Math.max(0, (rest.endsAt - Date.now()) / 1000)
  const frac = rest.finished ? 1 : Math.min(1, Math.max(0, (rest.total - left) / rest.total))
  return (
    <div className={`rp ${rest.finished ? 'done' : ''} ${inSession ? 'full' : ''}`} role="timer" aria-live="off">
      <div className="rp-ring">
        <svg viewBox="0 0 72 72" aria-hidden>
          <circle className="track" cx="36" cy="36" r={RING_R} />
          <circle
            className="fill"
            cx="36"
            cy="36"
            r={RING_R}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - frac)}
            transform="rotate(-90 36 36)"
          />
        </svg>
        <div className="rp-time">{rest.finished ? 'Go' : fmtClock(Math.ceil(left))}</div>
      </div>
      <div className="rp-body">
        <div className="rp-title">
          <span>{rest.finished ? 'Rest over' : 'Resting'}</span>
          {!rest.finished && <span className="muted"> · {fmtClock(rest.total)}</span>}
        </div>
        <div className="rp-label ellipsis">{rest.label}</div>
        <div className="rp-ctrl">
          {rest.finished ? (
            <button className="btn sm ok grow" onClick={clear}>
              <Check size={16} /> Next set
            </button>
          ) : (
            <>
              <button className="btn sm" onClick={() => adjust(-15)} aria-label="Minus 15 seconds">
                −15s
              </button>
              <button className="btn sm" onClick={() => adjust(15)} aria-label="Plus 15 seconds">
                +15s
              </button>
              <button className="btn sm grow" onClick={clear}>
                <SkipForward size={16} /> Skip
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          <div className="t">{t.text}</div>
          {t.sub && <div className="small muted">{t.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function SyncDot() {
  const pending = useStore((s) => s.pending)
  const err = useStore((s) => s.syncError)
  const repo = useStore((s) => s.repo)
  const queued = useStore((s) => s.queued)
  if (!repo) return null
  return (
    <div className="sync">
      <span className={`dot ${err ? 'err' : pending || queued ? 'busy' : ''}`} />
      {queued
        ? `${queued} change${queued === 1 ? '' : 's'} waiting to sync`
        : err
        ? 'not saved'
        : pending
        ? 'saving…'
        : repo.mode === 'cloud'
        ? 'synced'
        : 'demo · this device'}
    </div>
  )
}

export default function Layout() {
  const rest = useStore((s) => s.rest)
  const loc = useLocation()
  const inSession = loc.pathname.startsWith('/session')
  return (
    <>
      <SyncDot />
      <div className={`app ${rest ? 'has-rest' : ''} ${inSession ? 'in-session' : ''}`}>
        <Outlet />
      </div>
      <RestBar inSession={inSession} />
      <Toasts />
      {/* the live workout gets the whole screen; the nav comes back when you leave it */}
      {!inSession && <nav className="nav">
        <div className="nav-inner">
          <NavLink to="/" end className={({ isActive }) => (isActive || inSession ? 'active' : '')}>
            <Dumbbell size={22} />
            Workouts
          </NavLink>
          <NavLink to="/exercises">
            <BookOpen size={22} />
            Exercises
          </NavLink>
          <NavLink to="/history">
            <History size={22} />
            History
          </NavLink>
          <NavLink to="/body">
            <Scale size={22} />
            Body
          </NavLink>
          <NavLink to="/settings">
            <Settings size={22} />
            Settings
          </NavLink>
        </div>
      </nav>}
    </>
  )
}
