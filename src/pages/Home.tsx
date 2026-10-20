import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Pencil, Plus, Zap, ChevronRight, Sparkles } from 'lucide-react'
import { useStore } from '../lib/store'
import { buildStarterPlan } from '../lib/seed'
import { startEmptySession, startSessionFromWorkout } from '../lib/actions'
import { primeAudio } from '../lib/beep'
import { fmtDate, fmtKg } from '../lib/format'
import { nowIso, uid } from '../lib/uid'
import { Empty } from '../components/ui'
import { sessionDate } from '../lib/pr'

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

export default function Home() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const save = useStore((s) => s.save)
  const user = useStore((s) => s.user)
  const repoMode = useStore((s) => s.repo?.mode)

  const workouts = useMemo(() => [...db.workouts].sort((a, b) => a.position - b.position), [db.workouts])
  const active = db.sessions.find((s) => !s.finished_at)
  const finished = db.sessions.filter((s) => s.finished_at)

  const week = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000
    const recent = finished.filter((s) => new Date(sessionDate(s)).getTime() >= cutoff)
    let sets = 0
    let volume = 0
    for (const s of recent)
      for (const e of s.data.exercises)
        for (const x of e.sets)
          if (x.done && x.kind !== 'warmup') {
            sets++
            volume += x.weight * (x.reps ?? 0)
          }
    return { sessions: recent.length, sets, volume }
  }, [finished])

  function loadStarter() {
    const plan = buildStarterPlan(user?.id ?? 'local', db.exercises, db.workouts.length)
    plan.exercises.forEach((e) => save('exercises', e))
    plan.workouts.forEach((w) => save('workouts', w))
    plan.workout_exercises.forEach((w) => save('workout_exercises', w))
  }

  function newWorkout() {
    const id = uid()
    save('workouts', { id, user_id: user?.id ?? 'local', name: 'New workout', notes: '', position: db.workouts.length, created_at: nowIso() })
    nav(`/workout/${id}`)
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div className="grow">
          <h1>Workouts</h1>
          <div className="sub">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      </div>

      {repoMode === 'local' && (
        <div className="card small" style={{ borderColor: '#5c4a0f', color: 'var(--warn)' }}>
          Demo mode: data is saved only on this device. Sign in (Settings) to sync across devices.
        </div>
      )}

      {active && (
        <div className="banner stack" style={{ gap: 8 }}>
          <div className="row">
            <div className="grow">
              <div style={{ fontWeight: 750, fontSize: 17 }}>{active.name}</div>
              <div className="small muted">Workout in progress · started {fmtDate(active.started_at)}</div>
            </div>
          </div>
          <button
            className="btn primary block"
            onClick={() => {
              primeAudio()
              nav(`/session/${active.id}`)
            }}
          >
            <Play size={18} /> Resume workout
          </button>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat">
          <div className="v">{week.sessions}</div>
          <div className="l">workouts · 7 days</div>
        </div>
        <div className="stat">
          <div className="v">{week.sets}</div>
          <div className="l">sets · 7 days</div>
        </div>
        <div className="stat">
          <div className="v">{week.volume >= 1000 ? `${fmtKg(Math.round(week.volume / 100) / 10)}t` : fmtKg(Math.round(week.volume))}</div>
          <div className="l">{week.volume >= 1000 ? 'volume' : 'volume kg'}</div>
        </div>
      </div>

      {workouts.length === 0 ? (
        <Empty title="No workouts yet" text="Start from the plan we built together, or create your own.">
          <button className="btn primary" onClick={loadStarter}>
            <Sparkles size={18} /> Load my starter plan (4 days)
          </button>
          <button className="btn" onClick={newWorkout}>
            <Plus size={18} /> Create a workout
          </button>
        </Empty>
      ) : (
        workouts.map((w) => {
          const wes = db.workout_exercises.filter((x) => x.workout_id === w.id).sort((a, b) => a.position - b.position)
          const names = wes.map((x) => db.exercises.find((e) => e.id === x.exercise_id)?.name ?? '?')
          const sets = wes.reduce((a, x) => a + x.sets + (x.drop_last ? 1 : 0), 0)
          const last = finished
            .filter((s) => s.workout_id === w.id)
            .sort((a, b) => (sessionDate(b) > sessionDate(a) ? 1 : -1))[0]
          return (
            <div key={w.id} className="card wcard">
              <div className="row">
                <div className="grow">
                  <div className="title">{w.name}</div>
                  <div className="small muted">
                    {wes.length} exercises · {sets} sets{last ? ` · last ${daysAgo(sessionDate(last))}` : ''}
                  </div>
                </div>
                <button className="btn icon sm" onClick={() => nav(`/workout/${w.id}`)} aria-label="Edit workout">
                  <Pencil size={16} />
                </button>
              </div>
              <div className="preview">{names.join(' · ')}</div>
              <button
                className="btn primary block"
                disabled={!!active || wes.length === 0}
                onClick={() => {
                  primeAudio()
                  const id = startSessionFromWorkout(w)
                  nav(`/session/${id}`)
                }}
              >
                <Play size={18} /> {active ? 'Finish current workout first' : 'Start workout'}
              </button>
            </div>
          )
        })
      )}

      <div className="row">
        <button className="btn grow" onClick={newWorkout}>
          <Plus size={18} /> New workout
        </button>
        <button
          className="btn grow"
          disabled={!!active}
          onClick={() => {
            primeAudio()
            nav(`/session/${startEmptySession()}`)
          }}
        >
          <Zap size={18} /> Empty workout
        </button>
      </div>
      {workouts.length > 0 && db.exercises.length > 0 && (
        <button className="btn ghost sm" onClick={() => nav('/history')}>
          See history <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
