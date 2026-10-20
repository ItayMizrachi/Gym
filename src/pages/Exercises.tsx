import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, Plus, Search, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { MUSCLES } from '../lib/types'
import { NewExerciseForm } from '../components/ExercisePicker'
import { Empty, Sheet, Thumb } from '../components/ui'
import { priorSets, recordsFor } from '../lib/pr'
import { fmtKg } from '../lib/format'

export default function Exercises() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<string>('All')
  const [creating, setCreating] = useState(false)

  const records = useMemo(() => {
    const m = new Map<string, ReturnType<typeof recordsFor>>()
    for (const e of db.exercises) m.set(e.id, recordsFor(priorSets(db, e.id)))
    return m
  }, [db])

  const counts = useMemo(() => {
    const c = new Map<string, number>()
    for (const e of db.exercises) c.set(e.muscle, (c.get(e.muscle) ?? 0) + 1)
    return c
  }, [db.exercises])

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = db.exercises
      .filter((e) => (muscle === 'All' || e.muscle === muscle) && (!needle || e.name.toLowerCase().includes(needle) || e.muscle.toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name))
    const order = [...MUSCLES, ...new Set(list.map((e) => e.muscle).filter((m) => !MUSCLES.includes(m)))]
    return order.map((m) => ({ muscle: m, items: list.filter((e) => e.muscle === m) })).filter((g) => g.items.length)
  }, [db.exercises, q, muscle])

  const total = groups.reduce((a, g) => a + g.items.length, 0)

  return (
    <div className="stack" style={{ gap: 'var(--s3)' }}>
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
          <div className="chips" role="tablist" aria-label="Muscle group">
            {['All', ...MUSCLES.filter((m) => counts.has(m))].map((m) => (
              <button key={m} role="tab" aria-selected={muscle === m} className={`chip ${muscle === m ? 'active' : ''}`} onClick={() => setMuscle(m)}>
                {m} <span className="n">{m === 'All' ? db.exercises.length : counts.get(m)}</span>
              </button>
            ))}
          </div>

          {groups.map((g) => (
            <section key={g.muscle}>
              <div className="section-label">
                <span>{g.muscle}</span>
                <span className="count">{g.items.length}</span>
              </div>
              <div className="list-group" style={{ ['--inset' as string]: '70px' }}>
                {g.items.map((e) => {
                  const rec = records.get(e.id)
                  const best = rec?.bestE1rm ? Math.round(rec.bestE1rm.value) : null
                  return (
                    <button key={e.id} className="list-row" onClick={() => nav(`/exercise/${e.id}`)}>
                      <Thumb path={e.image_path} name={e.name} size={44} />
                      <div className="grow">
                        <div className="title ellipsis">{e.name}</div>
                        <div className="meta ellipsis">
                          {rec?.heaviest ? `Best set ${fmtKg(rec.heaviest.weight)} kg × ${rec.heaviest.reps}` : 'Not logged yet'}
                        </div>
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
                })}
              </div>
            </section>
          ))}
          {!total && (
            <div className="muted center small" style={{ padding: 'var(--s5)' }}>
              No exercises match “{q}”.{' '}
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
