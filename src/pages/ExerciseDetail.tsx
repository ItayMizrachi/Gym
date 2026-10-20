import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { MUSCLES } from '../lib/types'
import { Confirm, ImageField } from '../components/ui'
import { LineChart } from '../components/Chart'
import { exerciseHistory, priorSets, recordsFor, sessionDate } from '../lib/pr'
import { fmtDate, fmtKg, fmtRest, parseRest } from '../lib/format'
import { removeExercise } from '../lib/actions'

export default function ExerciseDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const save = useStore((s) => s.save)
  const ex = db.exercises.find((e) => e.id === id)
  const [restText, setRestText] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [metric, setMetric] = useState<'e1rm' | 'top'>('e1rm')

  const rec = useMemo(() => recordsFor(priorSets(db, id ?? '')), [db, id])
  const hist = useMemo(() => exerciseHistory(db, id ?? ''), [db, id])
  const recent = useMemo(() => {
    const rows: { date: string; sets: string; session: string }[] = []
    for (const s of [...db.sessions].filter((x) => x.finished_at).sort((a, b) => (sessionDate(b) > sessionDate(a) ? 1 : -1))) {
      const e = s.data.exercises.find((x) => x.exercise_id === id)
      if (!e) continue
      rows.push({
        date: sessionDate(s),
        session: s.id,
        sets: e.sets
          .filter((x) => x.done)
          .map((x) => `${x.kind === 'drop' ? 'D ' : x.kind === 'warmup' ? 'W ' : x.kind === 'failure' ? 'F ' : ''}${fmtKg(x.weight)}×${x.reps}`)
          .join(' · ')
      })
      if (rows.length >= 8) break
    }
    return rows
  }, [db.sessions, id])

  if (!ex) return <div className="card">Exercise not found. <button className="btn sm" onClick={() => nav('/exercises')}>Back</button></div>
  const upd = (p: Partial<typeof ex>, debounce = 400) => save('exercises', { ...ex, ...p }, { debounce })

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <button className="btn icon ghost" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <h1 className="ellipsis">{ex.name}</h1>
      </div>

      <div className="card stack">
        <ImageField path={ex.image_path} folder="exercises" large onChange={(p) => save('exercises', { ...ex, image_path: p })} label="Add a photo of the exercise / machine" />
        <label className="field">
          Name
          <input className="input" value={ex.name} onChange={(e) => upd({ name: e.target.value })} />
        </label>
        <div className="row">
          <label className="field grow">
            Muscle
            <select className="select" value={ex.muscle} onChange={(e) => upd({ muscle: e.target.value }, 0)}>
              {MUSCLES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="field grow">
            Default rest (m:ss)
            <input
              className="input"
              inputMode="numeric"
              value={restText ?? fmtRest(ex.rest_sec)}
              onFocus={() => setRestText(fmtRest(ex.rest_sec))}
              onChange={(e) => setRestText(e.target.value)}
              onBlur={() => {
                if (restText != null) upd({ rest_sec: parseRest(restText) }, 0)
                setRestText(null)
              }}
            />
          </label>
        </div>
        <label className="field">
          Setup (seat height, pad position, pin, grip…)
          <textarea className="textarea" placeholder="e.g. Seat 4, back pad 3, handles on the lower position" value={ex.setup} onChange={(e) => upd({ setup: e.target.value })} />
        </label>
        <label className="field">
          Notes & cues
          <textarea className="textarea" placeholder="What is it, how to do it, what to feel…" value={ex.notes} onChange={(e) => upd({ notes: e.target.value })} />
        </label>
      </div>

      <div className="card stack">
        <h2>Personal records</h2>
        {rec.heaviest ? (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat">
                <div className="v">
                  {fmtKg(rec.heaviest.weight)}×{rec.heaviest.reps}
                </div>
                <div className="l">heaviest set · {fmtDate(rec.heaviest.date, true)}</div>
              </div>
              <div className="stat">
                <div className="v">{rec.bestE1rm ? fmtKg(Math.round(rec.bestE1rm.value * 10) / 10) : '–'}</div>
                <div className="l">best est. 1RM</div>
              </div>
            </div>
            <div className="small muted">Best weight for N reps</div>
            <table className="t">
              <tbody>
                {rec.repTable
                  .filter((r) => [1, 3, 5, 6, 8, 10, 12, 15].includes(r.reps))
                  .map((r) => (
                    <tr key={r.reps}>
                      <td>{r.reps} {r.reps === 1 ? 'rep' : 'reps'}</td>
                      <td>
                        <b>{fmtKg(r.weight)} kg</b>
                      </td>
                      <td className="muted">{fmtDate(r.date, true)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="tiny muted">Warm-up and drop sets never count towards records. Est. 1RM uses the Epley formula (reps capped at 12).</div>
          </>
        ) : (
          <div className="muted small">Log this exercise in a workout and your records will appear here.</div>
        )}
      </div>

      {hist.length > 1 && (
        <div className="card stack">
          <div className="row">
            <h2 className="grow">Progress</h2>
            <div className="seg">
              <button className={metric === 'e1rm' ? 'on' : ''} onClick={() => setMetric('e1rm')}>
                Est. 1RM
              </button>
              <button className={metric === 'top' ? 'on' : ''} onClick={() => setMetric('top')}>
                Top weight
              </button>
            </div>
          </div>
          <LineChart
            unit=" kg"
            series={[
              {
                name: metric === 'e1rm' ? 'Est. 1RM' : 'Top weight',
                color: '#f0b92a',
                points: hist.map((h) => ({ t: new Date(h.date).getTime(), y: metric === 'e1rm' ? h.bestE1rm : h.topWeight }))
              }
            ]}
          />
        </div>
      )}

      {recent.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 8 }}>Recent sessions</h2>
          {recent.map((r) => (
            <button key={r.session} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 0', borderTop: '1px solid var(--line)' }} onClick={() => nav(`/history/${r.session}`)}>
              <div className="small muted">{fmtDate(r.date, true)}</div>
              <div>{r.sets}</div>
            </button>
          ))}
        </div>
      )}

      <button className="btn danger" onClick={() => setConfirmDel(true)}>
        <Trash2 size={16} /> Delete exercise
      </button>
      {confirmDel && (
        <Confirm
          title="Delete exercise?"
          text="It will also be removed from your workout templates. Past sessions keep their data."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            removeExercise(ex.id)
            nav('/exercises')
          }}
          onClose={() => setConfirmDel(false)}
        />
      )}
    </div>
  )
}
