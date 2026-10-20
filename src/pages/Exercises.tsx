import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
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

  const list = useMemo(
    () =>
      db.exercises
        .filter((e) => (muscle === 'All' || e.muscle === muscle) && e.name.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [db.exercises, q, muscle]
  )
  const used = useMemo(() => new Set(db.exercises.map((e) => e.muscle)), [db.exercises])

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <h1>Exercises</h1>
        <button className="btn primary icon" onClick={() => setCreating(true)} aria-label="New exercise">
          <Plus size={22} />
        </button>
      </div>
      <div className="row" style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: 12, color: 'var(--muted)' }} />
        <input className="input" style={{ paddingLeft: 38 }} placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips">
        {['All', ...MUSCLES.filter((m) => used.has(m))].map((m) => (
          <button key={m} className={`chip ${muscle === m ? 'active' : ''}`} onClick={() => setMuscle(m)}>
            {m}
          </button>
        ))}
      </div>
      {db.exercises.length === 0 ? (
        <Empty title="No exercises yet" text="Create one, or load the starter plan from the Workouts tab." />
      ) : (
        <div>
          {list.map((e) => {
            const rec = recordsFor(priorSets(db, e.id))
            return (
              <button key={e.id} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav(`/exercise/${e.id}`)}>
                <Thumb path={e.image_path} size={48} />
                <div className="grow">
                  <div style={{ fontWeight: 650 }}>{e.name}</div>
                  <div className="small muted">
                    {e.muscle}
                    {rec.heaviest ? ` · best ${fmtKg(rec.heaviest.weight)}×${rec.heaviest.reps}` : ''}
                  </div>
                </div>
              </button>
            )
          })}
          {!list.length && <div className="muted center small" style={{ padding: 20 }}>No matches</div>}
        </div>
      )}
      {creating && (
        <Sheet title="New exercise" onClose={() => setCreating(false)}>
          <NewExerciseForm
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
