import { Component, ReactNode, Suspense, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Dumbbell, TrendingUp, History, Scale, Settings, Check, SkipForward, Play } from 'lucide-react'
import { useStore } from '../lib/store'
import { Skeleton, SkeletonList } from './ui'
import { fmtClock } from '../lib/format'
import { beep } from '../lib/beep'
import { usePrefs } from '../lib/prefs'
import { cancelRestNotification, scheduleRestNotification } from '../lib/notify'
import { lockInfo, lockScreenActive, lockScreenSupported, setLockScreenActions, startLockScreen, stopLockScreen, updateLockScreen } from '../lib/lockscreen'
import { libIdForExercise, libImageUrl } from '../lib/libraryLinks'
import '../styles/workout-flow.css'
import '../styles/navigation.css'

const starts = (path: string, ...prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(p + '/'))

/** Bottom tabs. Each one stays lit on the screens you reach from it. */
const TABS = [
  { to: '/', label: 'Train', icon: Dumbbell, match: (p: string) => p === '/' || starts(p, '/workout', '/session', '/programs') },
  { to: '/profile', label: 'Progress', icon: TrendingUp, match: (p: string) => starts(p, '/profile', '/exercises', '/exercise') },
  { to: '/history', label: 'History', icon: History, match: (p: string) => starts(p, '/history') },
  { to: '/body', label: 'Body', icon: Scale, match: (p: string) => starts(p, '/body') },
  { to: '/settings', label: 'Settings', icon: Settings, match: (p: string) => starts(p, '/settings', '/help') }
]

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
              <button className="btn sm" onClick={() => adjust(-15)} aria-label="15 seconds less rest">
                −15s
              </button>
              <button className="btn sm" onClick={() => adjust(15)} aria-label="15 seconds more rest">
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

/** Keeps the lock-screen "now playing" card in step with the running workout (opt-in in Settings). */
function LockScreenSync() {
  const enabled = usePrefs((s) => s.lockScreen)
  const active = useStore((s) => s.db.sessions.find((x) => !x.finished_at) ?? null)
  const activeId = active?.id ?? null

  // start the silent audio on the next tap (browsers only allow playback from a gesture); stop when done
  useEffect(() => {
    if (!enabled || !activeId || !lockScreenSupported()) {
      stopLockScreen()
      return
    }
    const st = useStore.getState
    setLockScreenActions({ skip: () => st().clearRest(), more: () => st().adjustRest(15) })
    if (lockScreenActive()) return
    const kick = () => void startLockScreen()
    window.addEventListener('pointerdown', kick, { once: true, capture: true })
    return () => window.removeEventListener('pointerdown', kick, { capture: true })
  }, [enabled, activeId])

  useEffect(() => {
    if (!enabled || !activeId) return
    const push = () => {
      const s = useStore.getState()
      const session = s.db.sessions.find((x) => x.id === activeId)
      if (!session) return
      const info = lockInfo(session, s.rest, Date.now())
      const ex = s.db.exercises.find((e) => e.id === info.exerciseId)
      const lib = libIdForExercise(ex)
      updateLockScreen(info, lib ? libImageUrl(lib) : null)
    }
    push()
    const id = setInterval(push, 1000)
    return () => clearInterval(id)
  }, [enabled, activeId])

  useEffect(() => () => stopLockScreen(), [])
  return null
}

/** A screen that fails to load (offline, or a missing file after an update) shows a calm message, not a blank page. */
class ScreenBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="card stack" role="alert" style={{ marginTop: 16 }}>
        <h2>This screen didn't load</h2>
        <div className="small muted">Check your connection and try again. Your workouts are safe on this device.</div>
        <button className="btn primary block" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    )
  }
}

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)} title="Tap to dismiss">
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
  // Local mode is a developer tool: nothing to show in production builds.
  if (repo.mode !== 'cloud' && !queued && !err && !pending && !import.meta.env.DEV) return null
  return (
    <div className="sync" role="status">
      <span aria-hidden className={`dot ${err ? 'err' : pending || queued ? 'busy' : ''}`} />
      {queued
        ? `${queued} change${queued === 1 ? '' : 's'} waiting to sync`
        : err
        ? 'not saved'
        : pending
        ? 'saving…'
        : repo.mode === 'cloud'
        ? 'synced'
        : 'This device only'}
    </div>
  )
}

/** "Workout in progress · 12:34 · Resume" strip above the nav on every tab while a session is open. */
function ResumeBar() {
  const nav = useNavigate()
  const active = useStore((s) => s.db.sessions.find((x) => !x.finished_at))
  const [, tick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [active?.id])
  if (!active) return null
  const secs = Math.max(0, Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000))
  return (
    <button className="resume-bar" onClick={() => nav(`/session/${active.id}`)} aria-label={`Workout in progress: ${active.name}. Resume`}>
      <span className="resume-dot" aria-hidden />
      <span className="grow ellipsis">
        <b>{active.name}</b> <span className="muted">· {fmtClock(secs)}</span>
      </span>
      <span className="resume-go">
        <Play size={16} /> Resume
      </span>
    </button>
  )
}

export default function Layout() {
  const rest = useStore((s) => s.rest)
  const loc = useLocation()
  const inSession = loc.pathname.startsWith('/session')
  // a new screen starts at the top, not wherever the last one was scrolled to
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  return (
    <>
      <SyncDot />
      <main className={`app ${rest ? 'has-rest' : ''} ${inSession ? 'in-session' : ''}`}>
        <ScreenBoundary resetKey={loc.pathname}>
        <Suspense
          fallback={
            <div className="stack" style={{ gap: 16, paddingTop: 8 }} aria-label="Loading">
              <Skeleton w="45%" h={30} />
              <SkeletonList rows={4} />
            </div>
          }
        >
          <Outlet />
        </Suspense>
        </ScreenBoundary>
      </main>
      <RestBar inSession={inSession} />
      <LockScreenSync />
      <Toasts />
      {!inSession && !rest && <ResumeBar />}
      {/* the live workout gets the whole screen; the nav comes back when you leave it */}
      {!inSession && (
        <nav className="nav" aria-label="Main">
          <div className="nav-inner">
            {TABS.map((t) => {
              const on = t.match(loc.pathname)
              return (
                <Link key={t.to} to={t.to} className={on ? 'active' : ''} aria-current={on ? 'page' : undefined}>
                  <span className="nav-ico" aria-hidden>
                    <t.icon size={22} />
                  </span>
                  {t.label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </>
  )
}
