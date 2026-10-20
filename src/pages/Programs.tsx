import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, ChevronRight, Clock, Dumbbell, Link2, Play, Plus, Target, Wand2 } from 'lucide-react'
import { useStore } from '../lib/store'
import {
  GEAR_LABEL,
  Gear,
  LEVELS,
  Level,
  Program,
  ProgramFilter,
  SINGLES,
  SIZE_OPTIONS,
  WEEKLIES,
  estimateMinutes,
  filterPrograms,
  fmtTarget,
  gearOf,
  programById,
  programMeta,
  programMinutes,
  uniqueExercises
} from '../lib/programs'
import { addProgram, startProgramWorkout } from '../lib/programStart'
import { primeAudio } from '../lib/beep'
import { fmtRest } from '../lib/format'
import { PageHeader } from '../components/ui'
import FindProgram from '../components/FindProgram'
import '../styles/programs-nav.css'
import { ExerciseThumb } from '../components/ExerciseImage'
import { ThumbButton } from '../components/ExerciseHowTo'

type Kind = Program['kind']

/** Round exercise photo from the library (initials when there is none). */
function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return <ExerciseThumb exercise={{ name, muscle: '', image_path: null }} size={size} />
}

function Chips({ p }: { p: Program }) {
  return (
    <div className="pg-facts">
      <span className={`pg-level ${p.level.toLowerCase()}`}>{p.level}</span>
      <span>
        {p.kind === 'single' ? <Clock size={15} aria-hidden /> : <CalendarDays size={15} aria-hidden />}
        {p.kind === 'single' ? `About ${programMinutes(p)} min` : `${p.days} days a week`}
      </span>
      <span>
        <Dumbbell size={15} aria-hidden /> {GEAR_LABEL[gearOf(p)]}
      </span>
      <span>
        <Target size={15} aria-hidden /> {p.goal}
      </span>
    </div>
  )
}

function Detail({ p }: { p: Program }) {
  const nav = useNavigate()
  const toast = useStore((s) => s.toast)
  const active = useStore((s) => s.db.sessions.find((x) => !x.finished_at))
  const [added, setAdded] = useState<{ folder: string; count: number } | null>(null)
  const single = p.kind === 'single'

  function add() {
    const rows = addProgram(p)
    setAdded({ folder: rows.folder, count: rows.workouts.length })
    toast({
      kind: 'info',
      text: single ? `${p.name} saved` : `${p.name} added`,
      sub: single ? 'It is on the Train tab under My workouts.' : `${rows.workouts.length} workouts are in the "${rows.folder}" folder on Train.`
    })
  }
  function startNow() {
    primeAudio()
    nav(`/session/${startProgramWorkout(p)}`)
  }

  return (
    <div className="stack pg" style={{ gap: 20 }}>
      <PageHeader title={p.name} sub={single ? 'Single workout' : 'Weekly program'} back={`/programs${single ? '' : '?tab=weekly'}`} />
      <Chips p={p} />
      <p className="pg-desc">{p.description}</p>

      {added ? (
        <div className="pg-added" role="status">
          <Check size={22} aria-hidden />
          <div className="grow">
            <b>{single ? 'Saved to your workouts' : 'Added to your workouts'}</b>
            <div className="small">
              {single ? 'Find it on Train under My workouts.' : `Find the ${added.count} workouts on Train in the "${added.folder}" folder.`} Weights
              start empty: pick one that feels hard by the last rep.
            </div>
          </div>
        </div>
      ) : null}

      <div className="pg-actions">
        {single && (
          <button className="btn primary pg-big" onClick={startNow} disabled={!!active}>
            <Play size={20} aria-hidden /> Start now
          </button>
        )}
        {added ? (
          <button className={`btn pg-big ${single ? '' : 'primary'}`} onClick={() => nav('/')}>
            Go to Train <ChevronRight size={20} aria-hidden />
          </button>
        ) : (
          <button className={`btn pg-big ${single ? '' : 'primary'}`} onClick={add}>
            <Plus size={20} aria-hidden /> {single ? 'Save to my workouts' : 'Add program'}
          </button>
        )}
        {single && active && <div className="small muted pg-center">Finish or leave your current workout first to start this one.</div>}
        {!single && !added && <div className="small muted pg-center">Adds {p.workouts.length} workouts to Train. You can change anything after.</div>}
      </div>

      {p.workouts.map((w) => {
        const sets = w.exercises.reduce((a, e) => a + e.sets, 0)
        return (
          <section key={w.name} className="pg-workout" aria-label={w.name}>
            <div className="pg-workout-head">
              <h2>{single ? 'Exercises' : w.name}</h2>
              <span className="small muted">
                {w.exercises.length} exercises · {sets} sets · about {estimateMinutes(w)} min
              </span>
            </div>
            {w.notes && <div className="pg-note">{w.notes}</div>}
            <ul className="pg-ex">
              {w.exercises.map((e, j) => (
                <li key={j} className={e.superset ? 'ss' : ''}>
                  <ThumbButton exercise={{ name: e.name, muscle: e.muscle, equipment: e.equipment, image_path: null }} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="pg-ex-name">{e.name}</div>
                    <div className="pg-ex-meta">
                      {e.sets} {e.sets === 1 ? 'set' : 'sets'} × {fmtTarget(e)} · rest {fmtRest(e.rest_sec)}
                    </div>
                    {(e.superset || e.note) && (
                      <div className="pg-ex-meta">
                        {e.superset && (
                          <span className="pg-ss">
                            <Link2 size={12} aria-hidden /> Superset {e.superset}
                          </span>
                        )}
                        {e.superset && e.note && ' · '}
                        {e.note}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: { id: T; label: string }[]
  value: T | null
  onChange: (v: T | null) => void
}) {
  return (
    <div className="pg-filter" role="group" aria-label={label}>
      <div className="chips">
        <button className={`chip ${value == null ? 'active' : ''}`} aria-pressed={value == null} onClick={() => onChange(null)}>
          {label === 'Level' ? 'Any level' : label === 'Equipment' ? 'Any equipment' : label === 'Length' ? 'Any length' : 'Any days'}
        </button>
        {options.map((o) => (
          <button key={o.id} className={`chip ${value === o.id ? 'active' : ''}`} aria-pressed={value === o.id} onClick={() => onChange(value === o.id ? null : o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Card({ p, have }: { p: Program; have: boolean }) {
  const nav = useNavigate()
  const ex = uniqueExercises(p)
  return (
    <button className="pg-card" onClick={() => nav(`/programs?p=${p.id}`)}>
      <div className="pg-card-top">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="pg-name">{p.name}</div>
          <div className="pg-meta">{programMeta(p)}</div>
        </div>
        <span className={`pg-level ${p.level.toLowerCase()}`}>{p.level}</span>
      </div>
      <div className="pg-blurb">{p.description}</div>
      <div className="pg-foot">
        <span className="pg-avs" aria-hidden>
          {ex.slice(0, 4).map((e) => (
            <Avatar key={e.name} name={e.name} size={32} />
          ))}
          {ex.length > 4 && <span className="pg-more">+{ex.length - 4}</span>}
        </span>
        <span className="grow small muted ellipsis">
          {p.kind === 'single' ? `${ex.length} exercises` : `${p.workouts.length} workouts`}
        </span>
        {have && (
          <span className="small pg-have">
            <Check size={14} aria-hidden /> Added
          </span>
        )}
        <ChevronRight size={20} aria-hidden className="pg-arrow" />
      </div>
    </button>
  )
}

const NO_FILTER: ProgramFilter = { level: null, gear: null, size: null }

export default function Programs() {
  const [params, setParams] = useSearchParams()
  const workouts = useStore((s) => s.db.workouts)
  const kind: Kind = params.get('tab') === 'weekly' ? 'weekly' : 'single'
  const [filters, setFilters] = useState<Record<Kind, ProgramFilter>>({ single: NO_FILTER, weekly: NO_FILTER })
  const [finder, setFinder] = useState(false)
  const f = filters[kind]
  const setF = (patch: Partial<ProgramFilter>) => setFilters({ ...filters, [kind]: { ...f, ...patch } })
  const all = kind === 'single' ? SINGLES : WEEKLIES
  const list = useMemo(() => filterPrograms(all, f), [all, f])
  const p = programById(params.get('p'))
  if (p) return <Detail p={p} />

  const folders = new Set(workouts.map((w) => (w.folder ?? '').toLowerCase()))
  const names = new Set(workouts.map((w) => w.name.toLowerCase()))
  const have = (x: Program) => (x.kind === 'weekly' ? folders.has(x.name.toLowerCase()) : names.has(x.name.toLowerCase()))
  const filtered = f.level || f.gear || f.size

  return (
    <div className="stack pg" style={{ gap: 16 }}>
      <PageHeader title="Programs" sub="Pick a ready-made plan instead of building your own." back="/" />

      <button className="pg-finder" onClick={() => setFinder(true)}>
        <Wand2 size={22} aria-hidden />
        <span className="grow">
          <span className="pg-finder-t">Not sure where to start?</span>
          <span className="pg-finder-d">Answer 4 quick questions and get the program that fits you.</span>
        </span>
        <ChevronRight size={18} aria-hidden />
      </button>
      {finder && <FindProgram onDone={() => setFinder(false)} />}

      <div className="pg-tabs" role="tablist" aria-label="Kind of plan">
        {(['single', 'weekly'] as Kind[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            className={kind === k ? 'on' : ''}
            onClick={() => setParams(k === 'weekly' ? { tab: 'weekly' } : {}, { replace: true })}
          >
            {k === 'single' ? 'Single workouts' : 'Weekly programs'}
            <span className="pg-tab-sub">{k === 'single' ? 'One session, start now' : 'A plan for the whole week'}</span>
          </button>
        ))}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <FilterRow<Level> label="Level" options={LEVELS.map((l) => ({ id: l, label: l }))} value={f.level} onChange={(v) => setF({ level: v })} />
        <FilterRow<Gear>
          label="Equipment"
          options={(['gym', 'home', 'none'] as Gear[]).map((g) => ({ id: g, label: GEAR_LABEL[g] }))}
          value={f.gear}
          onChange={(v) => setF({ gear: v })}
        />
        <FilterRow<string>
          label={kind === 'single' ? 'Length' : 'Days'}
          options={SIZE_OPTIONS[kind].map((o) => ({ id: o.id, label: o.label }))}
          value={f.size}
          onChange={(v) => setF({ size: v })}
        />
      </div>

      <div className="pg-count" aria-live="polite">
        <span>
          {list.length} {kind === 'single' ? (list.length === 1 ? 'workout' : 'workouts') : list.length === 1 ? 'program' : 'programs'}
        </span>
        {filtered && (
          <button className="btn ghost sm" onClick={() => setF(NO_FILTER)}>
            Clear filters
          </button>
        )}
      </div>

      {list.map((x) => (
        <Card key={x.id} p={x} have={have(x)} />
      ))}
      {list.length === 0 && <div className="pg-empty">Nothing matches these filters. Try “Clear filters”.</div>}
    </div>
  )
}
