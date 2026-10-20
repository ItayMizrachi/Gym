import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, Plus, Search, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { Exercise, MUSCLES, trackingOf } from '../lib/types'
import { FilterChips, NewExerciseForm } from '../components/ExercisePicker'
import { facets, filterExercises, recentExerciseIds } from '../lib/exerciseFilters'
import { Empty, Sheet } from '../components/ui'
import { ExerciseThumb } from '../components/ExerciseImage'
import { priorSets, recordsFor } from '../lib/pr'
import { fmtKg } from '../lib/format'

export default function Exercises() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<string>('All')
  const [eq, setEq] = useState<string>('All')
  const [creating, setCreating] = useState(false)

  const records = useMemo(() => {
    const m = new Map<string, ReturnType<typeof recordsFor>>()
    for (const e of db.exercises) m.set(e.id, recordsFor(priorSets(db, e.id)))
    return m
  }, [db])

  const { muscles, equipment } = useMemo(() => facets(db.exercises), [db.exercises])
  const filtering = !!q.trim() || muscle !== 'All' || eq !== 'All'
  const recent = useMemo(
    () => (filtering ? [] : recentExerciseIds(db.sessions, 4).map((id) => db.exercises.find((e) => e.id === id)).filter((e): e is Exercise => !!e)),
    [db.sessions, db.exercises, filtering]
  )

  const groups = useMemo(() => {
    const list = filterExercises(db.exercises, { q, muscle, equipment: eq }).sort((a, b) => a.name.localeCompare(b.name))
    const order = [...MUSCLES, ...new Set(list.map((e) => e.muscle).filter((m) => !MUSCLES.includes(m)))]
    return order.map((m) => ({ muscle: m, items: list.filter((e) => e.muscle === m) })).filter((g) => g.items.length)
  }, [db.exercises, q, muscle, eq])

  const row = (e: Exercise, withMuscle = false) => {
    const rec = records.get(e.id)
    const best = trackingOf(e) === 'weight_reps' && rec?.bestE1rm ? Math.round(rec.bestE1rm.value) : null
    const bestSet = rec?.heaviest
      ? trackingOf(e) === 'weight_reps' || rec.heaviest.weight > 0
        ? `Best ${fmtKg(rec.heaviest.weight)} kg × ${rec.heaviest.reps}`
        : `Best ${Math.max(...rec.repTable.map((r) => r.reps))} reps`
      : trackingOf(e) === 'time'
        ? 'Timed'
        : 'Not logged yet'
    const meta = [withMuscle ? e.muscle : '', e.equipment, bestSet].filter(Boolean).join(' · ')
    return (
      <button key={e.id} className="list-row" onClick={() => nav(`/exercise/${e.id}`)}>
        <ExerciseThumb exercise={e} size={48} />
        <div className="grow">
          <div className="title ellipsis">{e.name}</div>
          <div className="meta ellipsis">{meta}</div>
        </div>
        {best != null && (
          <div className="trail">
            <div className="kpi">
              {best}
              <span className="muted" style={{ fontSize: 13, marginLeft: 2 }}>kg</span>
            </div>
            <div className="tiny muted">est. 1RM</div>
          </div>
        )}
        <ChevronRight size={18} className="chev" />
      </button>
    )
  }

  const total = groups.reduce((a, g) => a + g.items.length, 0)

  return (
    <div className="stack xl-page" style={{ gap: 'var(--s3)' }}>
      <div className="page-head">
        <h1>Exercises</h1>
        <button className="btn primary icon" onClick={() => setCreating(true)} aria-label="New exercise">
          <Plus size={22} />
        </button>
      </div>

      {db.exercises.length === 0 ? (
        <Empty icon={<BookOpen size={24} />} title="No exercises yet" text="Create one, or load the starter plan from the Workouts tab.">
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Plus size={18} /> New exercise
          </button>
        </Empty>
      ) : (
        <>
          <div className="search">
            <Search size={18} />
            <input className="input" type="search" enterKeyHint="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button className="clear" onClick={() => setQ('')} aria-label="Clear search">
                <X size={18} />
              </button>
            )}
          </div>
          <FilterChips muscles={muscles} equipment={equipment} muscle={muscle} eq={eq} setMuscle={setMuscle} setEq={setEq} />

          {recent.length > 0 && (
            <section>
              <div className="section-label">
                <span>Recent</span>
              </div>
              <div className="list-group" style={{ ['--inset' as string]: '70px' }}>{recent.map((e) => row(e, true))}</div>
            </section>
          )}

          {groups.map((g) => (
            <section key={g.muscle}>
              <div className="section-label">
                <span>{g.muscle}</span>
                <span className="count">{g.items.length}</span>
              </div>
              <div className="list-group" style={{ ['--inset' as string]: '70px' }}>
                {g.items.map((e) => row(e))}
              </div>
            </section>
          ))}
          {!total && (
            <div className="muted center small" style={{ padding: 'var(--s5)' }}>
              No exercises match{q.trim() ? ` “${q.trim()}”` : ' these filters'}.{' '}
              <button className="btn ghost sm" style={{ color: 'var(--accent)' }} onClick={() => setCreating(true)}>
                Create it
              </button>
            </div>
          )}
        </>
      )}
      {creating && (
        <Sheet title="New exercise" onClose={() => setCreating(false)}>
          <NewExerciseForm
            initialName={q}
            onCreated={(e) => {
              setCreating(false)
              nav(`/exercise/${e.id}`)
            }}
          />
        </Sheet>
      )}
    </div>
  )
}
