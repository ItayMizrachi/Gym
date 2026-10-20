import { lazy, useEffect, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './lib/store'
import { startNextWorkout } from './lib/shortcuts'
import Layout from './components/Layout'
import BootScreen from './components/BootScreen'
import UpdateBanner from './components/UpdateBanner'
import OfflineBanner from './components/OfflineBanner'
import Login from './pages/Login'
import Home from './pages/Home'
import SessionPage from './pages/Session'
import Welcome, { seen } from './components/Welcome'

// Secondary screens load on first visit (the service worker still caches them for offline use).
const WorkoutEditor = lazy(() => import('./pages/WorkoutEditor'))
const Exercises = lazy(() => import('./pages/Exercises'))
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail'))
const HistoryPage = lazy(() => import('./pages/History'))
const SessionDetail = lazy(() => import('./pages/SessionDetail'))
const Body = lazy(() => import('./pages/Body'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const Help = lazy(() => import('./pages/Help'))
const Profile = lazy(() => import('./pages/Profile'))
const Programs = lazy(() => import('./pages/Programs'))

/** The home-screen shortcut opens `#/?start=next`; act on it once the data is loaded. */
function useLaunchShortcut(ready: boolean) {
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => {
    if (!ready || new URLSearchParams(loc.search).get('start') !== 'next') return
    const id = startNextWorkout(useStore.getState().db)
    nav(id ? `/session/${id}` : '/', { replace: true })
  }, [ready, loc.search, nav])
}

export default function App() {
  const phase = useStore((s) => s.phase)
  const boot = useStore((s) => s.boot)
  useEffect(() => {
    void boot()
  }, [boot])
  useLaunchShortcut(phase === 'ready')
  const userId = useStore((s) => s.user?.id ?? 'local')
  const [welcome, setWelcome] = useState(false)
  useEffect(() => {
    if (phase === 'ready') setWelcome(!seen('welcome'))
  }, [phase, userId])
  useEffect(() => {
    const open = () => setWelcome(true)
    window.addEventListener('gymlog:welcome', open)
    return () => window.removeEventListener('gymlog:welcome', open)
  }, [])

  return (
    <>
      <OfflineBanner />
      {phase === 'booting' ? (
        <BootScreen />
      ) : phase === 'login' ? (
        <div className="pwa-enter">
          <Login />
        </div>
      ) : (
        <div className="pwa-enter">
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/workout/:id" element={<WorkoutEditor />} />
              <Route path="/session/:id" element={<SessionPage />} />
              <Route path="/exercises" element={<Exercises />} />
              <Route path="/exercise/:id" element={<ExerciseDetail />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:id" element={<SessionDetail />} />
              <Route path="/body" element={<Body />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/help" element={<Help />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/programs" element={<Programs />} />
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
          {welcome && <Welcome onDone={() => setWelcome(false)} />}
        </div>
      )}
      <UpdateBanner />
    </>
  )
}
