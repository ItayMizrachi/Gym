import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, ChevronRight, Dumbbell, Folder, Plus, Target, Timer } from 'lucide-react'
import { useStore } from '../lib/store'
import { PROGRAMS, Program, buildProgram, fmtTarget, programById, programMeta } from '../lib/programs'
import { fmtRest } from '../lib/format'
import { PageHeader } from '../components/ui'
import '../styles/programs.css'

/** Save a program's exercises, workouts and links (parents first, so the cloud sync keeps them in order). */
export function addProgram(p: Program) {
  const { db, save, user } = useStore.getState()
  const rows = buildProgram(p, user?.id ?? 'local', db.exercises, db.workouts)
  rows.exercises.forEach((e) => save('exercises', e))
  rows.workouts.forEach((w) => save('workouts', w))
  rows.workout_exercises.forEach((w) => save('workout_exercises', w))
  return rows
}

function Chips({ p }: { p: Program }) {
  return (
    <div className="chips pg-chips">
      <span className={`chip pg-level ${p.level.toLowerCase()}`}>{p.level}</span>
      <span className="chip">
        <CalendarDays size={14} aria-hidden /> {p.days} days a week
      </span>
      <span className="chip">
        <Dumbbell size={14} aria-hidden /> {p.equipment}
      </span>
      <span className="chip">
        <Target size={14} aria-hidden /> {p.goal}
      </span>
    </div>
  )
}

function Detail({ p }: { p: Program }) {
  const nav = useNavigate()
  const toast = useStore((s) => s.toast)
  const [added, setAdded] = useState<string | null>(null)
  const sets = (i: number) => p.workouts[i].exercises.reduce((a, e) => a + e.sets, 0)

  function add() {
    const rows = addProgram(p)
    setAdded(rows.folder)
    toast({ kind: 'info', text: `${p.name} added`, sub: `${rows.workouts.length} workouts are in the "${rows.folder}" folder on Train.` })
  }

  return (
    <div className="stack pg" style={{ gap: 14 }}>
      <PageHeader title={p.name} sub={programMeta(p)} back="/programs" />
      <Chips p={p} />
      <p className="pg-desc">{p.description}</p>

      {added ? (
        <div className="card pg-added stack" role="status">
          <div className="row">
            <Check size={20} aria-hidden />
            <div className="grow">
              <b>Added to your workouts</b>
              <div className="small muted">Find them on Train in the "{added}" folder. Weights start empty: pick one that feels hard by the last rep.</div>
            </div>
          </div>
          <button className="btn primary block" onClick={() => nav('/')}>
            Go to Train <ChevronRight size={18} />
          </button>
        </div>
      ) : (
        <button className="btn primary block" onClick={add}>
          <Plus size={18} /> Add to my workouts
        </button>
      )}

      <div className="section-label" style={{ marginBottom: 0 }}>
        <span>
          {p.workouts.length} workout{p.workouts.length === 1 ? '' : 's'}
        </span>
        <span className="count">You can change anything after adding</span>
      </div>
      {p.workouts.map((w, i) => (
        <section key={w.name} className="card pg-workout" aria-label={w.name}>
          <div className="row">
            <h2 className="grow">{w.name}</h2>
            <span className="small muted">
              {w.exercises.length} exercises · {sets(i)} sets
            </span>
          </div>
          {w.notes && <div className="small muted">{w.notes}</div>}
          <ul className="pg-ex">
            {w.exercises.map((e, j) => (
              <li key={j} className={e.superset ? 'ss' : ''}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="pg-ex-name">{e.name}</div>
                  <div className="tiny muted">
                    {e.muscle}
                    {e.superset && ` · superset ${e.superset}`}
                    {e.note && ` · ${e.note}`}
                  </div>
                </div>
                <div className="pg-ex-target">
                  <div>
                    {e.sets} × {fmtTarget(e)}
                  </div>
                  <div className="tiny muted">
                    <Timer size={11} aria-hidden /> rest {fmtRest(e.rest_sec)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default function Programs() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const workouts = useStore((s) => s.db.workouts)
  const folders = new Set(workouts.map((w) => w.folder ?? ''))
  const p = programById(params.get('p'))
  if (p) return <Detail p={p} />

  return (
    <div className="stack pg" style={{ gap: 12 }}>
      <PageHeader title="Programs" sub="Ready-made plans. Tap one to see it, then add it in one tap." back="/" />
      {PROGRAMS.map((p) => (
        <button key={p.id} className="card pg-card" onClick={() => nav(`/programs?p=${p.id}`)}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="pg-name">{p.name}</div>
              <div className="small muted">
                {programMeta(p)} · {p.goal}
              </div>
            </div>
            <span className={`chip pg-level ${p.level.toLowerCase()}`}>{p.level}</span>
          </div>
          <div className="pg-blurb">{p.description}</div>
          <div className="pg-foot">
            <span className="small muted">{p.workouts.map((w) => w.name).join(' · ')}</span>
            {folders.has(p.name) && (
              <span className="small pg-have">
                <Folder size={13} aria-hidden /> Added
              </span>
            )}
            <ChevronRight size={18} aria-hidden className="pg-arrow" />
          </div>
        </button>
      ))}
    </div>
  )
}
