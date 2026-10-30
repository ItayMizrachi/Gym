import { ComponentProps, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, Copy, Dumbbell, Folder, Info, Link2, Plus, Trash2 } from 'lucide-react'
import '../styles/programs-nav.css'
import { MoveToFolderSheet } from '../components/FolderSheet'
import { moved, useDragReorder } from '../components/useDragReorder'
import { folderOf, NO_FOLDER } from '../lib/folders'
import { DAY_NAME, DAY_SHORT, plannedDays } from '../lib/plan'
import { useStore } from '../lib/store'
import { duplicateWorkout, removeWorkout } from '../lib/actions'
import { ExercisePicker } from '../components/ExercisePicker'
import { Confirm, Empty, NumInput, PageHeader, Toggle } from '../components/ui'
import { ExerciseThumb } from '../components/ExerciseImage'
import { fmtKg, fmtRest, parseRest } from '../lib/format'
import { uid } from '../lib/uid'
import { Exercise, WorkoutExercise, trackingOf } from '../lib/types'

const GROUPS = ['', 'A', 'B', 'C', 'D']

function RestInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(fmtRest(value))
  const [focus, setFocus] = useState(false)
  return (
    <input
      className="num"
      inputMode="numeric"
      value={focus ? text : fmtRest(value)}
      onFocus={(e) => {
        setFocus(true)
        setText(fmtRest(value))
        e.target.select()
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocus(false)
        onChange(parseRest(text))
      }}
      aria-label={tr("Rest (m:ss)")}
    />
  )
}

export default function WorkoutEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const save = useStore((s) => s.save)
  const user = useStore((s) => s.user)
  const [picking, setPicking] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [movingFolder, setMovingFolder] = useState(false)
  const [help, setHelp] = useState(false)
  // hold an exercise's header and drag it to a new place; positions are renumbered 0, 1, 2…
  const dl = useDragReorder((a, b) => {
    const list = useStore.getState().db.workout_exercises.filter((x) => x.workout_id === id).sort((p, q) => p.position - q.position)
    moved(list, a, b).forEach((we, k) => we.position !== k && save('workout_exercises', { ...we, position: k }))
  })

  const w = db.workouts.find((x) => x.id === id)
  if (!w)
    return (
      <div className="stack">
        <PageHeader title={tr("Workout not found")} sub={tr("It may have been deleted.")} back="/" />
      </div>
    )
  const wes = db.workout_exercises.filter((x) => x.workout_id === w.id).sort((a, b) => a.position - b.position)

  function patch(we: WorkoutExercise, p: Partial<WorkoutExercise>) {
    save('workout_exercises', { ...we, ...p }, { debounce: 400 })
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= wes.length) return
    const a = wes[i]
    const b = wes[j]
    save('workout_exercises', { ...a, position: b.position })
    save('workout_exercises', { ...b, position: a.position })
  }

  const totalSets = wes.reduce((a, x) => a + x.sets, 0)

  /** add picked exercises at the end, with sensible starting values */
  function addExercises(list: Exercise[]) {
    let pos = wes.length ? Math.max(...wes.map((x) => x.position)) + 1 : 0
    let last = ''
    for (const ex of list) {
      last = uid()
      const timed = trackingOf(ex) === 'time'
      save('workout_exercises', {
        id: last,
        user_id: user?.id ?? 'local',
        workout_id: w!.id,
        exercise_id: ex.id,
        position: pos++,
        sets: 3,
        rep_min: timed ? 30 : 8,
        rep_max: timed ? 60 : 12,
        weight: 0,
        rest_sec: ex.rest_sec,
        superset: '',
        drop_last: false,
        note: ''
      })
    }
    // one exercise: open it so the sets and reps can be set straight away
    setOpen(list.length === 1 ? last : null)
    setPicking(false)
  }
  // onPickMany (several at once) is used when the picker offers it; onPick is the fallback
  const pickerProps = {
    onClose: () => setPicking(false),
    onPick: (ex: Exercise) => addExercises([ex]),
    onPickMany: (list: Exercise[]) => addExercises(list)
  }

  // consecutive exercises sharing a superset label are drawn as one group on a blue rail
  const blocks: { label: string; items: { we: WorkoutExercise; i: number }[] }[] = []
  wes.forEach((we, i) => {
    const prev = blocks[blocks.length - 1]
    if (we.superset && prev && prev.label === we.superset) prev.items.push({ we, i })
    else blocks.push({ label: we.superset, items: [{ we, i }] })
  })

  const drag = (i: number) => dl.item(i)
  // the hold-to-drag handlers without ref and style (those go on the whole card)
  const holdOnly = ({ ref: _r, style: _s, ...h }: ReturnType<typeof dl.item>) => h
  const row = (we: WorkoutExercise, i: number) => {
    const ex = db.exercises.find((e) => e.id === we.exercise_id)
    const timed = trackingOf(ex) === 'time'
    const reps = (we.rep_min === we.rep_max ? `${we.rep_min}` : `${we.rep_min}–${we.rep_max}`) + (timed ? ' s' : '')
    return (
      <div
        key={we.id}
        ref={drag(i).ref}
        style={drag(i).style}
        className={`we-card ${we.superset ? 'ss' : ''} ${open === we.id ? 'open' : ''}${dl.dragging === i ? ' lifted' : ''}`}
      >
        <div className="we-head" {...holdOnly(drag(i))}>
          <button className="we-toggle" onClick={() => setOpen(open === we.id ? null : we.id)} aria-expanded={open === we.id}>
            <ExerciseThumb exercise={ex} size={44} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="we-name">
                {ex?.name ?? 'Deleted exercise'}
              </div>
              <div className="we-sum">
                <bdi dir="ltr">{we.sets} × {reps}</bdi>
                {we.weight ? ` · ${fmtKg(we.weight)} ${tr('kg')}` : ''} · {tr('rest {t}', { t: fmtRest(we.rest_sec) })}
                {we.drop_last ? ` · ${tr('drop')}` : ''}
              </div>
              {we.note && open !== we.id && (
                <div className="tiny muted ellipsis" style={{ marginTop: 2 }}>
                  {we.note}
                </div>
              )}
            </div>
            <ChevronDown size={18} className="we-caret" />
          </button>
          {/* drag (hold the header) moves an exercise; these stay for keyboards and screen readers */}
          <div className="reorder sr-only">
            <button className="btn ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={tr("Move up")}>
              <ChevronUp size={22} />
            </button>
            <button className="btn ghost" onClick={() => move(i, 1)} disabled={i === wes.length - 1} aria-label={tr("Move down")}>
              <ChevronDown size={22} />
            </button>
          </div>
        </div>
        {open === we.id && (
          <div className="we-body">
            <button className="btn ghost sm we-help" onClick={() => setHelp(!help)} aria-expanded={help}>
              <Info size={16} aria-hidden /> {tr("What do these mean?")}
            </button>
            {help && (
              <dl className="info-pop we-gloss">
                <dt>{tr("Sets")}</dt>
                <dd>{tr("How many times you do the exercise, with rest in between.")}</dd>
                <dt>{timed ? 'Secs from / to' : 'Reps from / to'}</dt>
                <dd>{timed ? 'Seconds to hold or keep going, for example 30 to 60.' : 'Aim for this many reps. When you reach the top on every set, GymLog suggests more weight.'}</dd>
                <dt>{tr("Rest")}</dt>
                <dd>{tr("The timer that starts after you log a set, in minutes:seconds.")}</dd>
                <dt>{tr("Drop set")}</dt>
                <dd>{tr("One extra set right after the last one, with lighter weight and no rest.")}</dd>
                <dt>{tr("Superset")}</dt>
                <dd>{tr("Exercises with the same letter are done in turns: one set of each, then rest.")}</dd>
              </dl>
            )}
            <div className="we-grid">
              <label className="field">
                {tr("Sets")}
                <NumInput decimal={false} value={we.sets} onChange={(n) => patch(we, { sets: Math.max(0, Math.round(n ?? 0)) })} />
              </label>
              <label className="field">
                {timed ? 'Secs from' : 'Reps from'}
                <NumInput decimal={false} value={we.rep_min} onChange={(n) => patch(we, { rep_min: Math.round(n ?? 0) })} />
              </label>
              <label className="field">
                {timed ? 'Secs to' : 'Reps to'}
                <NumInput decimal={false} value={we.rep_max} onChange={(n) => patch(we, { rep_max: Math.round(n ?? 0) })} />
              </label>
              <label className="field">
                kg
                <NumInput value={we.weight} onChange={(n) => patch(we, { weight: n ?? 0 })} />
              </label>
            </div>
            <div className="row" style={{ gap: 'var(--s3)', alignItems: 'flex-end' }}>
              <label className="field" style={{ width: 96 }}>
                {tr("Rest (m:ss)")}
                <RestInput value={we.rest_sec} onChange={(n) => patch(we, { rest_sec: n })} />
              </label>
              <div className="grow">
                <Toggle blue label={tr("Drop set at the end")} on={we.drop_last} onChange={(v) => patch(we, { drop_last: v })} />
              </div>
            </div>
            <div className="field">
              Superset with
              <div className="group-pick" role="radiogroup" aria-label={tr("Superset group")}>
                {(GROUPS.includes(we.superset) ? GROUPS : [...GROUPS, we.superset]).map((g) => (
                  <button
                    key={g || 'none'}
                    role="radio"
                    aria-checked={we.superset === g}
                    className={`${g ? '' : 'none'} ${we.superset === g ? 'on' : ''}`}
                    onClick={() => patch(we, { superset: g })}
                  >
                    {g || 'None'}
                  </button>
                ))}
              </div>
            </div>
            <input
              className="input"
              placeholder={tr("Note shown during the workout")}
              aria-label={`Note for ${ex?.name ?? 'this exercise'}, shown during the workout`}
              value={we.note}
              onChange={(e) => patch(we, { note: e.target.value })}
            />
            <div className="we-foot">
              <button
                className="btn ghost sm"
                style={{ color: 'var(--danger)', marginLeft: -8 }}
                onClick={() => useStore.getState().remove('workout_exercises', we.id)}
              >
                <Trash2 size={16} /> {tr("Remove from workout")}
              </button>
              <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setOpen(null)}>
                {tr("Done")}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 'var(--s3)' }}>
      <PageHeader
        title={w.name || 'Untitled workout'}
        sub={tr('{e} · {s} sets. Changes save by themselves.', { e: tr(wes.length === 1 ? '{n} exercise' : '{n} exercises', { n: wes.length }), s: totalSets })}
        back="/"
      />

      <div className="card stack">
        <label className="field">
          {tr("Name")}
          <input className="input" value={w.name} onChange={(e) => save('workouts', { ...w, name: e.target.value }, { debounce: 400 })} />
        </label>
        <div className="field">
          {tr("Folder")}
          <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => setMovingFolder(true)} aria-label={`Folder: ${folderOf(w) || NO_FOLDER}. Move to folder`}>
            <Folder size={16} aria-hidden />
            <span className="grow ellipsis" style={{ textAlign: 'left' }}>
              {folderOf(w) || tr('{f} (no folder)', { f: tr(NO_FOLDER) })}
            </span>
            <span className="small muted">{tr("Move")}</span>
          </button>
        </div>
        <div className="field">
          {tr("Planned days")}
          <div className="day-pick" role="group" aria-label={tr("Planned days")}>
            {DAY_SHORT.map((l, d) => {
              const on = plannedDays(w).includes(d)
              return (
                <button
                  key={d}
                  className={`day-chip ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  aria-label={DAY_NAME[d]}
                  onClick={() => save('workouts', { ...w, days: on ? plannedDays(w).filter((x) => x !== d) : [...plannedDays(w), d].sort((a, b) => a - b) })}
                >
                  {l}
                </button>
              )
            })}
          </div>
          <span className="small muted">{tr("On these days the Train tab shows it as today's workout.")}</span>
        </div>
        <label className="field">
          {tr("Notes")}
          <textarea
            className="textarea"
            style={{ minHeight: 64 }}
            placeholder={tr("Focus, tempo, anything to remember")}
            value={w.notes}
            onChange={(e) => save('workouts', { ...w, notes: e.target.value }, { debounce: 400 })}
          />
        </label>
      </div>

      {wes.length > 0 && (
        <div style={{ marginBottom: 0 }}>
          <div className="section-label" style={{ marginBottom: 2 }}>
            <span>{tr("Exercises")}</span>
            <span className="count">{wes.length}</span>
          </div>
          <div className="small muted">{tr("Tap one to change or remove it. Hold and drag to move it.")}</div>
        </div>
      )}

      {blocks.map((b) =>
        b.label && b.items.length > 1 ? (
          <div key={b.items[0].we.id}>
            <div className="ss-label">
              <Link2 size={14} /> Superset {b.label}
            </div>
            <div className="ss-group" style={{ marginTop: 8 }}>
              {b.items.map(({ we, i }) => row(we, i))}
            </div>
          </div>
        ) : (
          b.items.map(({ we, i }) => row(we, i))
        )
      )}

      {!wes.length && (
        <Empty
          icon={<Dumbbell size={24} />}
          title={tr("No exercises yet")}
          text={tr("Add the exercises for this workout. You can set sets, reps, rest and supersets for each.")}
        />
      )}

      <button className="btn primary block we-add" onClick={() => setPicking(true)}>
        <Plus size={18} /> {tr("Add exercises")}
      </button>

      <div className="row" style={{ gap: 'var(--s2)', marginTop: 'var(--s3)' }}>
        <button
          className="btn grow"
          onClick={() => {
            duplicateWorkout(w.id)
            nav('/')
          }}
        >
          <Copy size={16} /> {tr("Duplicate")}
        </button>
        <button className="btn danger grow" onClick={() => setConfirmDel(true)}>
          <Trash2 size={16} /> {tr("Delete")}
        </button>
      </div>

      {picking && <ExercisePicker {...(pickerProps as ComponentProps<typeof ExercisePicker>)} />}
      {movingFolder && <MoveToFolderSheet workoutId={w.id} onClose={() => setMovingFolder(false)} />}
      {confirmDel && (
        <Confirm
          title={tr("Delete this workout?")}
          text={tr("Past sessions stay in your history.")}
          confirmLabel={tr("Delete")}
          danger
          onConfirm={() => {
            removeWorkout(w.id)
            nav('/')
          }}
          onClose={() => setConfirmDel(false)}
        />
      )}
    </div>
  )
}
