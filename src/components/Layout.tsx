import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Dumbbell, BookOpen, History, Scale, Settings, Check, Minus, Plus, SkipForward } from 'lucide-react'
import { useStore } from '../lib/store'
import { fmtClock } from '../lib/format'
import { beep } from '../lib/beep'

function RestBar() {
  const rest = useStore((s) => s.rest)
  const clear = useStore((s) => s.clearRest)
  const adjust = useStore((s) => s.adjustRest)
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

  if (!rest) return null
  const left = Math.max(0, (rest.endsAt - Date.now()) / 1000)
  const pct = rest.finished ? 100 : Math.min(100, ((rest.total - left) / rest.total) * 100)
  return (
    <div className={`rest ${rest.finished ? 'done' : ''}`}>
      <div className="row">
        <div className="time">{rest.finished ? 'Go!' : fmtClock(Math.ceil(left))}</div>
        <div className="grow">
          <div className="small" style={{ fontWeight: 650 }}>
            {rest.finished ? 'Rest over' : 'Rest'}
          </div>
          <div className="tiny muted ellipsis">{rest.label}</div>
        </div>
        {!rest.finished && (
          <>
            <button className="btn icon sm" onClick={() => adjust(-15)} aria-label="minus 15 seconds">
              <Minus size={16} />
            </button>
            <button className="btn icon sm" onClick={() => adjust(15)} aria-label="plus 15 seconds">
              <Plus size={16} />
            </button>
          </>
        )}
        <button className="btn sm" onClick={clear}>
          {rest.finished ? <Check size={16} /> : <SkipForward size={16} />}
          {rest.finished ? 'OK' : 'Skip'}
        </button>
      </div>
      <div className="bar" style={{ width: `${pct}%` }} />
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
      <div className={`app ${rest ? 'has-rest' : ''}`}>
        <Outlet />
      </div>
      <RestBar />
      <Toasts />
      <nav className="nav">
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
      </nav>
    </>
  )
}
