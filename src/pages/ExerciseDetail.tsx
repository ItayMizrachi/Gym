import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, Plus, RotateCw, Trash2, Trophy } from 'lucide-react'
import { useStore } from '../lib/store'
import { EQUIPMENT, MUSCLES, SetKind, Tracking, trackingOf } from '../lib/types'
import { fmtTime, setLabel, TRACKING_LABEL } from '../lib/tracking'
import { Confirm, ImageField } from '../components/ui'
import { LineChart } from '../components/Chart'
import { exerciseHistory, priorSets, recordsFor, sessionDate } from '../lib/pr'
import { fmtDate, fmtKg, fmtRest, parseRest } from '../lib/format'
import { removeExercise } from '../lib/actions'
import { LibPhoto } from '../components/ExerciseImage'
import { AddToWorkoutSheet } from '../components/Library'
import { libIdForExercise, linkedLibIds, useLibrary } from '../lib/library'
import { HowToCard } from '../components/ExerciseHowTo'
import { ensureLibraryExercise } from '../lib/libraryActions'
import '../styles/library.css'

const REP_COLS = [1, 3, 5, 6, 8, 10, 12, 15]

export default function ExerciseDetail() {
  const { id } = useParams()
  // library entries open on the same route, as /exercise/lib:<id>
  if (id?.startsWith('lib:')) return <LibraryDetail key={id} id={decodeURIComponent(id.slice(4))} />
  return <MyExerciseDetail key={id} id={id} />
}

function MyExerciseDetail({ id }: { id: string | undefined }) {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const save = useStore((s) => s.save)
  const ex = db.exercises.find((e) => e.id === id)
  const [restText, setRestText] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [metric, setMetric] = useState<'e1rm' | 'top'>('e1rm')

  const rec = useMemo(() => recordsFor(priorSets(db, id ?? '')), [db, id])
  const hist = useMemo(() => exerciseHistory(db, id ?? ''), [db, id])
  const longest = useMemo(() => {
    let best: { sec: number; date: string } | null = null
    for (const s of db.sessions) {
      if (!s.finished_at) continue
      for (const e of s.data.exercises) {
        if (e.exercise_id !== id) continue
        for (const x of e.sets) if (x.done && x.kind !== 'warmup' && (x.time_sec ?? 0) > (best?.sec ?? 0)) best = { sec: x.time_sec!, date: sessionDate(s) }
      }
    }
    return best
  }, [db.sessions, id])
  const recent = useMemo(() => {
    const rows: { date: string; name: string; session: string; sets: { kind: SetKind; text: string }[] }[] = []
    for (const s of [...db.sessions].filter((x) => x.finished_at).sort((a, b) => (sessionDate(b) > sessionDate(a) ? 1 : -1))) {
      const e = s.data.exercises.find((x) => x.exercise_id === id)
      if (!e) continue
      rows.push({
        date: sessionDate(s),
        name: s.name,
        session: s.id,
        sets: e.sets.filter((x) => x.done).map((x) => ({ kind: x.kind, text: setLabel(x, trackingOf(ex), false) }))
      })
      if (rows.length >= 8) break
    }
    return rows
  }, [db.sessions, id, ex?.tracking])

  if (!ex)
    return (
      <div className="card" style={{ marginTop: 'var(--s5)' }}>
        Exercise not found.{' '}
        <button className="btn sm" onClick={() => nav('/exercises')}>
          Back
        </button>
      </div>
    )
  const libId = libIdForExercise(ex)
  const upd = (p: Partial<typeof ex>, debounce = 400) => save('exercises', { ...ex, ...p }, { debounce })

  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <button className="btn icon ghost" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="grow">
          <h1 className="ellipsis" style={{ fontSize: 30 }}>
            {ex.name}
          </h1>
          <div className="small muted" style={{ marginTop: 2 }}>
            {[ex.muscle, ex.equipment].filter(Boolean).join(' · ')} · rest {fmtRest(ex.rest_sec)}
          </div>
        </div>
      </div>

      {libId ? (
        <div className="stack" style={{ gap: 'var(--s2)' }}>
          <LibPhoto id={libId} name={ex.name} />
          <ImageField path={null} folder="exercises" onChange={(p) => save('exercises', { ...ex, image_path: p })} label="Use my own photo instead" quiet />
        </div>
      ) : (
        <ImageField
          path={ex.image_path}
          folder="exercises"
          large
          onChange={(p) => save('exercises', { ...ex, image_path: p })}
          label="Add a photo of the machine"
        />
      )}

      <div className="card stack">
        <div className="card-head">
          <h2>Personal records</h2>
          <Trophy size={18} color="var(--accent)" aria-hidden />
        </div>
        {trackingOf(ex) === 'time' ? (
          longest ? (
            <div className="pr-hero">
              <div className="stat gold">
                <div className="v">{fmtTime(longest.sec)}</div>
                <div className="l">Longest set · {fmtDate(longest.date, true)}</div>
              </div>
            </div>
          ) : (
            <div className="muted small">Log this exercise in a workout and your longest set will appear here.</div>
          )
        ) : rec.heaviest ? (
          <>
            <div className="pr-hero">
              <div className="stat gold">
                <div className="v">
                  {rec.bestE1rm ? fmtKg(Math.round(rec.bestE1rm.value * 10) / 10) : '–'}
                  <span className="u">kg</span>
                </div>
                <div className="l">Best est. 1-rep max</div>
              </div>
              <div className="stat">
                <div className="v">
                  {fmtKg(rec.heaviest.weight)}
                  <span className="u">kg</span>
                  <span style={{ fontSize: '0.7em', marginLeft: 4 }}>×{rec.heaviest.reps}</span>
                </div>
                <div className="l">Heaviest set · {fmtDate(rec.heaviest.date, true)}</div>
              </div>
            </div>
            <div className="small muted" style={{ marginBottom: -4 }}>
              Best weight (kg) for at least N reps
            </div>
            <div className="reps-table">
              {/* only rep counts you have done: a row of dashes says nothing */}
              {REP_COLS.filter((n) => rec.repTable.some((r) => r.reps === n)).map((n) => {
                const row = rec.repTable.find((r) => r.reps === n)
                return (
                  <div key={n} title={row ? fmtDate(row.date, true) : undefined}>
                    <div className="r">
                      {n} {n === 1 ? 'rep' : 'reps'}
                    </div>
                    <div className={`w ${row ? '' : 'none'}`}>{row ? fmtKg(row.weight) : '–'}</div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="muted small">Log this exercise in a workout and your records will appear here.</div>
        )}
      </div>

      {hist.length > 1 && (
        <div className="card stack">
          <div className="card-head">
            <h2>Progress</h2>
            <div className="seg">
              <button className={metric === 'e1rm' ? 'on' : ''} onClick={() => setMetric('e1rm')}>
                1-rep max
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
                name: metric === 'e1rm' ? 'Est. 1-rep max' : 'Top weight',
                color: '#f0b92a',
                points: hist.map((h) => ({ t: new Date(h.date).getTime(), y: metric === 'e1rm' ? h.bestE1rm : h.topWeight }))
              }
            ]}
          />
        </div>
      )}

      {libId && <HowToCard id={libId} />}

      <div className="card stack">
        <h2>Setup &amp; cues</h2>
        <label className="field">
          Machine setup (seat, pads, pin, grip)
          <textarea
            className="textarea"
            placeholder="e.g. Seat 4, back pad 3, handles on the lower position"
            value={ex.setup}
            onChange={(e) => upd({ setup: e.target.value })}
          />
        </label>
        <label className="field">
          Notes &amp; cues
          <textarea
            className="textarea"
            placeholder="What is it, how to do it, what to feel…"
            value={ex.notes}
            onChange={(e) => upd({ notes: e.target.value })}
          />
        </label>
      </div>

      {recent.length > 0 && (
        <section>
          <div className="section-label">Recent sessions</div>
          <div className="list-group">
            {recent.map((r) => (
              <button key={r.session} className="list-row" onClick={() => nav(`/history/${r.session}`)}>
                <div className="grow">
                  <div className="row" style={{ gap: 6 }}>
                    <span className="title">{fmtDate(r.date, true)}</span>
                    <span className="small muted ellipsis">{r.name}</span>
                  </div>
                  <div className="set-pills">
                    {r.sets.map((x, i) => (
                      <span key={i} className={`set-pill ${x.kind === 'work' ? '' : x.kind}`}>
                        {x.text}
                      </span>
                    ))}
                    {!r.sets.length && <span className="small muted">No sets ticked</span>}
                  </div>
                </div>
                <ChevronRight size={18} className="chev" />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="card stack">
        <h2>Details</h2>
        <label className="field">
          Name
          <input className="input" value={ex.name} onChange={(e) => upd({ name: e.target.value })} />
        </label>
        <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--s3)' }}>
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
              className="input tnum"
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
      </div>

      <div className="card stack">
        <h2>What do you record?</h2>
        <div className="seg" role="radiogroup" aria-label="What do you record">
          {(['weight_reps', 'reps', 'time'] as Tracking[]).map((t) => (
            <button key={t} role="radio" aria-checked={trackingOf(ex) === t} className={trackingOf(ex) === t ? 'on' : ''} onClick={() => upd({ tracking: t }, 0)}>
              {TRACKING_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="small muted">
          {trackingOf(ex) === 'time'
            ? 'Each set is a duration, with a stopwatch. Good for planks, cardio and warm-ups.'
            : trackingOf(ex) === 'reps'
              ? 'Each set is just reps. Good for body-weight moves.'
              : 'Each set is a weight and a number of reps.'}
        </div>
        <label className="field">
          Equipment
          <select className="select" value={ex.equipment ?? ''} onChange={(e) => upd({ equipment: e.target.value }, 0)}>
            <option value="">Not set</option>
            {EQUIPMENT.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>

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

/** A library exercise that may not be one of "My exercises" yet: photo, what it works, how to do it, add buttons. */
function LibraryDetail({ id }: { id: string }) {
  const nav = useNavigate()
  const exercises = useStore((s) => s.db.exercises)
  const toast = useStore((s) => s.toast)
  const { list, error, retry } = useLibrary()
  const lib = list?.find((e) => e.id === id)
  const mineId = useMemo(() => linkedLibIds(exercises).get(id), [exercises, id])
  const [picking, setPicking] = useState(false)

  const head = (title: string, sub?: string) => (
    <div className="page-head" style={{ marginBottom: 0 }}>
      <button className="btn icon ghost" onClick={() => nav(-1)} aria-label="Back">
        <ArrowLeft size={22} />
      </button>
      <div className="grow" style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 26, lineHeight: 1.15 }}>{title}</h1>
        {sub && (
          <div className="small muted" style={{ marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )

  if (error)
    return (
      <div className="stack" style={{ gap: 'var(--s4)' }}>
        {head('Exercise library')}
        <div className="empty">
          <div style={{ fontWeight: 600 }}>The library could not load</div>
          <div className="small muted">Check your connection and try again.</div>
          <button className="btn" onClick={retry}>
            <RotateCw size={16} /> Try again
          </button>
        </div>
      </div>
    )
  if (!list)
    return (
      <div className="stack" style={{ gap: 'var(--s4)' }} aria-busy="true">
        {head('Loading…')}
        <div className="lib-photo" style={{ background: 'var(--card2)' }} />
      </div>
    )
  if (!lib)
    return (
      <div className="stack" style={{ gap: 'var(--s4)' }}>
        {head('Not found')}
        <div className="empty">
          <div style={{ fontWeight: 600 }}>This exercise is not in the library</div>
          <button className="btn primary" onClick={() => nav('/exercises?tab=library')}>
            Browse the library
          </button>
        </div>
      </div>
    )

  const also = lib.secondary.filter((m) => m !== 'Other')
  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      {head(lib.name, `${lib.equipment} · ${TRACKING_LABEL[lib.tracking].toLowerCase()}`)}

      <LibPhoto id={lib.id} name={lib.name} frames={lib.frames} />

      <div className="lib-facts">
        <div>
          <div className="v">{lib.muscles.join(', ')}</div>
          <div className="l">Main muscle</div>
        </div>
        <div>
          <div className="v">{lib.equipment}</div>
          <div className="l">Equipment</div>
        </div>
        <div>
          <div className="v">{lib.level}</div>
          <div className="l">Level</div>
        </div>
      </div>
      {also.length > 0 && (
        <div className="lib-muscle-line">
          Also works <b>{also.join(', ')}</b>
        </div>
      )}

      <div className="lib-actions">
        {mineId ? (
          <>
            <button className="btn primary" onClick={() => setPicking(true)}>
              <Plus size={18} /> Add to workout
            </button>
            <button className="btn" onClick={() => nav(`/exercise/${mineId}`)}>
              <Check size={18} color="var(--ok)" /> In my exercises · see records
            </button>
          </>
        ) : (
          <>
            <button
              className="btn primary"
              onClick={() => {
                ensureLibraryExercise(lib)
                toast({ kind: 'info', text: 'Added to my exercises', sub: lib.name })
              }}
            >
              <Plus size={18} /> Add to my exercises
            </button>
            <button className="btn" onClick={() => setPicking(true)}>
              Add to workout
            </button>
          </>
        )}
      </div>

      <HowToCard id={lib.id} />

      {picking && <AddToWorkoutSheet name={lib.name} getExercise={() => ensureLibraryExercise(lib)} onClose={() => setPicking(false)} />}
    </div>
  )
}
