import { useMemo, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { Search, Trophy, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { exerciseRecords, ExerciseRecord } from '../lib/records'
import { fmtKg } from '../lib/format'
import { relativeDay } from '../lib/stats'
import { Empty, PageHeader } from '../components/ui'
import { ExerciseThumb } from '../components/ExerciseImage'
import '../styles/records.css'

const kg = (n: number) => `${fmtKg(Math.round(n * 10) / 10)} kg`

/** One line per exercise: name, when the last record was, and the number that matters most on the right. */
function RecordRow({ r, onOpen }: { r: ExerciseRecord; onOpen: () => void }) {
  const ex = useStore((s) => s.db.exercises.find((e) => e.id === r.exercise_id))
  const weighted = r.heaviest.weight > 0
  return (
    <button className="rec-row" onClick={onOpen} aria-label={`${r.name}: ${weighted ? `estimated 1-rep max ${kg(r.e1rm)}, best set ${fmtKg(r.best.weight)} by ${r.best.reps}` : `${r.mostReps.reps} reps`}. Open exercise`}>
      <ExerciseThumb exercise={ex} name={r.name} size={40} />
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="rec-name ellipsis">{r.name}</span>
        <span className="small muted ellipsis" style={{ display: 'block' }}>
          {weighted ? `Best set ${fmtKg(r.best.weight)} × ${r.best.reps}` : 'Most reps in one set'} · {relativeDay(r.lastPR)}
        </span>
      </span>
      <span className="rec-main">
        <span className="rec-v accent">{weighted ? kg(r.e1rm) : r.mostReps.reps}</span>
        <span className="rec-l">{weighted ? 'est. max' : 'reps'}</span>
      </span>
    </button>
  )
}

export default function Records() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const [q, setQ] = useState('')
  const all = useMemo(() => exerciseRecords(db), [db])
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return all
    const muscle = new Map(db.exercises.map((e) => [e.id, e.muscle.toLowerCase()]))
    return all.filter((r) => r.name.toLowerCase().includes(t) || muscle.get(r.exercise_id)?.includes(t))
  }, [all, q, db.exercises])

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader title={tr("Records")} sub={tr("Newest record first. Est. max = the most you could likely lift once.")} back="/profile" />

      {all.length === 0 ? (
        <Empty icon={<Trophy size={28} />} title={tr("No records yet")} text={tr("Finish a workout with weights and reps, and your best lifts show up here.")}>
          <button className="btn primary block" onClick={() => nav('/')}>
            {tr("Go to Train")}
          </button>
        </Empty>
      ) : (
        <>
          <div className="search">
            <Search size={18} />
            <input
              className="input"
              type="search"
              enterKeyHint="search"
              placeholder={tr("Search by exercise or muscle")}
              aria-label={tr("Search records")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button className="clear" onClick={() => setQ('')} aria-label={tr("Clear search")}>
                <X size={18} />
              </button>
            )}
          </div>
          {list.length === 0 ? (
            <div className="card muted">No exercise matches “{q.trim()}”.</div>
          ) : (
            <div className="rec-list">
              {list.map((r) => (
                <RecordRow key={r.exercise_id} r={r} onOpen={() => nav(`/exercise/${r.exercise_id}`)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
