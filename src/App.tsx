import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useStore } from './lib/store'
import Layout from './components/Layout'
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

export default function App() {
  const phase = useStore((s) => s.phase)
  const boot = useStore((s) => s.boot)
  useEffect(() => {
    void boot()
  }, [boot])

  if (phase === 'booting')
    return (
      <div className="login center">
        <img className="logo" style={{ margin: '0 auto' }} src="icon.svg" alt="" />
        <div className="muted">Loading…</div>
      </div>
    )
  if (phase === 'login') return <Login />

  return (
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
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
