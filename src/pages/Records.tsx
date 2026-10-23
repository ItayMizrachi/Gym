import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Trophy, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { exerciseRecords, ExerciseRecord } from '../lib/records'
import { fmtKg } from '../lib/format'
import { relativeDay } from '../lib/stats'
import { Empty, PageHeader } from '../components/ui'
import { ExerciseThumb } from '../components/ExerciseImage'
import '../styles/records.css'

const kg = (n: number) => `${fmtKg(Math.round(n * 10) / 10)} kg`

function RecordCard({ r, onOpen }: { r: ExerciseRecord; onOpen: () => void }) {
  const ex = useStore((s) => s.db.exercises.find((e) => e.id === r.exercise_id))
  const weighted = r.heaviest.weight > 0
  return (
    <button className="card rec-card" onClick={onOpen} aria-label={`${r.name}: open exercise`}>
      <div className="rec-head">
        <ExerciseThumb exercise={ex} name={r.name} size={44} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="rec-name ellipsis">{r.name}</div>
          <div className="small muted ellipsis">
            {r.prCount > 0 ? `Last record ${relativeDay(r.lastPR)}` : `First logged ${relativeDay(r.lastPR)}`}
            {r.prCount > 0 && ` · ${r.prCount} record${r.prCount === 1 ? '' : 's'}`}
          </div>
        </div>
        <ChevronRight size={18} className="muted" aria-hidden />
      </div>

      {weighted ? (
        <div className="rec-stats">
          <div>
            <div className="rec-v">{kg(r.heaviest.weight)}</div>
            <div className="rec-l">Heaviest</div>
          </div>
          <div>
            <div className="rec-v">
              {fmtKg(r.best.weight)} × {r.best.reps}
            </div>
            <div className="rec-l">Best set</div>
          </div>
          <div>
            <div className="rec-v accent">{kg(r.e1rm)}</div>
            <div className="rec-l">Est. 1-rep max</div>
          </div>
        </div>
      ) : (
        <div className="rec-stats">
          <div>
            <div className="rec-v accent">{r.mostReps.reps}</div>
            <div className="rec-l">Most reps in one set</div>
          </div>
        </div>
      )}

      {r.repRecords.length > 1 && (
        <div className="rec-reps" aria-label="Rep records: heaviest weight for at least this many reps">
          {r.repRecords.map((x) => (
            <span key={x.reps} className="chip">
              {x.reps} rep{x.reps === 1 ? '' : 's'}: <b>{kg(x.weight)}</b>
            </span>
          ))}
        </div>
      )}
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
      <PageHeader title="Records" sub="Your best lifts for every exercise, newest record first." back="/profile" />

      {all.length === 0 ? (
        <Empty icon={<Trophy size={28} />} title="No records yet" text="Finish a workout with weights and reps, and your best lifts show up here.">
          <button className="btn primary block" onClick={() => nav('/')}>
            Go to Train
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
              placeholder="Search by exercise or muscle"
              aria-label="Search records"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button className="clear" onClick={() => setQ('')} aria-label="Clear search">
                <X size={18} />
              </button>
            )}
          </div>
          <div className="small muted">
            Est. 1-rep max: the most you could likely lift once, worked out from your best set.
          </div>
          {list.length === 0 ? (
            <div className="card muted">No exercise matches “{q.trim()}”.</div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {list.map((r) => (
                <RecordCard key={r.exercise_id} r={r} onOpen={() => nav(`/exercise/${r.exercise_id}`)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
