import { useEffect, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './lib/store'
import { startNextWorkout } from './lib/shortcuts'
import Layout from './components/Layout'
import BootScreen from './components/BootScreen'
import UpdateBanner from './components/UpdateBanner'
import OfflineBanner from './components/OfflineBanner'
import Login from './pages/Login'
import Home from './pages/Home'
import WorkoutEditor from './pages/WorkoutEditor'
import SessionPage from './pages/Session'
import Exercises from './pages/Exercises'
import ExerciseDetail from './pages/ExerciseDetail'
import HistoryPage from './pages/History'
import SessionDetail from './pages/SessionDetail'
import Body from './pages/Body'
import SettingsPage from './pages/Settings'
import Help from './pages/Help'
import Profile from './pages/Profile'
import Programs from './pages/Programs'
import Welcome, { seen } from './components/Welcome'

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
