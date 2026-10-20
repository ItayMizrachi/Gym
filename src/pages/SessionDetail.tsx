import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, Pencil, Share2, Trash2, Trophy } from 'lucide-react'
import { useStore } from '../lib/store'
import { sessionDate, sessionPRs, PREvent } from '../lib/pr'
import { fmtClock, fmtDate, fmtDateLong, fmtKg } from '../lib/format'
import { Confirm, ImageField, Thumb } from '../components/ui'
import { SessionEditor } from '../components/SessionEditor'
import {
  estimateCalories,
  fmtMinutes,
  fmtSets,
  fmtVolume,
  latestBodyWeight,
  muscleSplit,
  previousOfTemplate,
  prSetIds,
  summarizeSession
} from '../lib/stats'
import { renderShareCard, shareOrDownload } from '../lib/shareCard'
import { SessionSet, Tracking, trackingOf } from '../lib/types'
import '../styles/insights.css'
import '../styles/progress.css'

const KIND: Record<string, string> = { work: '', failure: 'F', drop: 'D', warmup: 'W' }
const PR_LABEL = { weight: 'heaviest weight', e1rm: 'best est. 1-rep max', reps: 'most reps' } as const

/** "80 kg × 8", "12 reps", "+10 kg × 12", "1:30" depending on what the exercise tracks. */
function SetText({ x, tracking }: { x: SessionSet; tracking: Tracking }) {
  if (tracking === 'time' || (x.time_sec != null && x.reps == null)) return <>{fmtClock(x.time_sec ?? 0)}</>
  if (tracking === 'reps')
    return x.weight > 0 ? (
      <>
        +{fmtKg(x.weight)} kg<span className="x">×</span>
        {x.reps ?? 0}
      </>
    ) : (
      <>{x.reps ?? 0} reps</>
    )
  return (
    <>
      {fmtKg(x.weight)} kg<span className="x">×</span>
      {x.reps ?? 0}
    </>
  )
}

function signed(n: number, fmt: (x: number) => string): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n))}`
}

export default function SessionDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const fresh = !!(loc.state as { fresh?: boolean } | null)?.fresh
  const db = useStore((s) => s.db)
  const remove = useStore((s) => s.remove)
  const toast = useStore((s) => s.toast)
  const [confirm, setConfirm] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [allMuscles, setAllMuscles] = useState(false)
  const [editing, setEditing] = useState(false)
  const save = useStore((st) => st.save)
  const s = db.sessions.find((x) => x.id === id)
  const prs = useMemo(() => (s ? sessionPRs(db, s) : []), [db, s])
  const prIds = useMemo(() => (s ? prSetIds(db, s) : new Set<string>()), [db, s])
  const split = useMemo(() => (s ? muscleSplit(db, s) : []), [db, s])
  const bodyKg = useMemo(() => latestBodyWeight(db), [db])
  const prev = useMemo(() => (s ? previousOfTemplate(db, s) : null), [db, s])
  if (!s) return <div className="card">Session not found. <button className="btn sm" onClick={() => nav('/history')}>History</button></div>

  if (editing) return <SessionEditor session={s} onDone={() => setEditing(false)} />

  const m = summarizeSession(s)
  const pm = prev ? summarizeSession(prev) : null
  const nameOf = (exId: string, fallback: string) => db.exercises.find((e) => e.id === exId)?.name ?? fallback
  const prName = (p: PREvent) => nameOf(p.exercise_id, s.data.exercises.find((e) => e.exercise_id === p.exercise_id)?.name ?? '?')
  const volDelta = pm ? m.volume - pm.volume : 0
  const prevLabel = prev ? `${prev.name.replace(/\s*\(.*\)$/, '')} on ${fmtDate(sessionDate(prev))}` : ''

  async function share() {
    if (!s) return
    setSharing(true)
    try {
      const blob = await renderShareCard({
        title: s.name.replace(/\s*\([^)]*\)\s*$/, '') || s.name,
        date: fmtDateLong(sessionDate(s)),
        duration: fmtMinutes(m.minutes),
        sets: String(m.sets),
        volume: fmtVolume(m.volume),
        prs: prs.map((p) => ({ name: prName(p), detail: `${fmtKg(p.weight)} kg × ${p.reps}` })),
        comparison: pm && Math.abs(volDelta) >= 1 ? `${signed(volDelta, fmtVolume)} volume vs last time` : null,
        comparisonUp: pm && Math.abs(volDelta) >= 1 ? volDelta > 0 : null
      })
      const day = sessionDate(s).slice(0, 10)
      const res = await shareOrDownload(blob, `gymlog-${day}.png`, `${s.name} · ${fmtVolume(m.volume)} lifted`)
      if (res === 'downloaded') toast({ kind: 'info', text: 'Summary image saved' })
    } catch (e: any) {
      toast({ kind: 'error', text: 'Could not create the image', sub: String(e?.message ?? e) })
    } finally {
      setSharing(false)
    }
  }

  const kcal = estimateCalories(m.minutes, bodyKg)
  const vol = fmtVolume(m.volume)
  const stats = (
    <div className="card hv-card">
      <div className="hv-stats">
        <div>
          <div className="hv-l">Time</div>
          <div className="hv-v">{m.minutes < 60 ? `${m.minutes} min` : `${Math.floor(m.minutes / 60)}h ${m.minutes % 60}m`}</div>
        </div>
        <div>
          <div className="hv-l">Volume</div>
          <div className="hv-v">{vol}</div>
        </div>
        <div>
          <div className="hv-l">Sets</div>
          <div className="hv-v">{m.sets}</div>
        </div>
        <div>
          <div className="hv-l">Records</div>
          <div className={`hv-v${prs.length ? ' pr' : ''}`}>
            {prs.length > 0 && <Trophy size={16} />} {prs.length}
          </div>
        </div>
      </div>
      <div className="hv-foot">
        <span>
          Calories <b>{kcal} kcal</b> <span className="est">estimate</span>
        </span>
        <span className="tiny">from time and {bodyKg ? `your ${fmtKg(bodyKg)} kg` : 'an average 75 kg'}</span>
      </div>
    </div>
  )

  const shownSplit = allMuscles ? split : split.slice(0, 3)
  const muscles = split.length > 0 && (
    <div className="card">
      <div className="ins-title" style={{ marginBottom: 6 }}>
        Muscle split
      </div>
      {shownSplit.map((x) => (
        <div key={x.muscle} className="split-row">
          <span className="ellipsis">{x.muscle}</span>
          <span className="split-bar">
            <i style={{ width: `${Math.max(2, x.pct)}%` }} />
          </span>
          <span className="pct">{x.pct}%</span>
        </div>
      ))}
      {split.length > 3 && (
        <button className="btn sm ghost" style={{ marginTop: 4 }} onClick={() => setAllMuscles(!allMuscles)}>
          <ChevronDown size={16} style={{ transform: allMuscles ? 'rotate(180deg)' : undefined }} />
          {allMuscles ? 'Show less' : `Show ${split.length - 3} more`}
        </button>
      )}
      <div className="tiny muted" style={{ marginTop: 4 }}>
        Share of working sets. {fmtSets(split.reduce((a, x) => a + x.sets, 0))} sets in total.
      </div>
    </div>
  )

  const photo = (
    <div className="card sd-photo">
      <ImageField
        path={s.data.photo_path ?? null}
        folder="sessions"
        large
        label="Add a workout photo"
        onChange={(p) => save('sessions', { ...s, data: { ...s.data, photo_path: p } })}
      />
    </div>
  )

  const comparison = pm && (
    <div className="card cmp">
      <div className="row">
        <div className="grow">
          <div className="ins-title">Compared with last time</div>
          <div className="small muted">{prevLabel}</div>
        </div>
      </div>
      {(
        [
          ['Volume', m.volume, pm.volume, fmtVolume],
          ['Sets', m.sets, pm.sets, String],
          ['Duration', m.minutes, pm.minutes, fmtMinutes]
        ] as [string, number, number, (n: number) => string][]
      ).map(([k, a, b, f]) => {
        const d = a - b
        // more volume / sets is good; for duration, shorter is neither good nor bad, so it stays neutral
        const cls = k === 'Duration' || Math.abs(d) < 0.5 ? 'muted' : d > 0 ? 'up' : 'down'
        return (
          <div key={k} className="cmp-row">
            <span className="k">{k}</span>
            <span className="v">{f(a)}</span>
            <span className={`d ${cls}`}>
              {Math.abs(d) < 0.5 ? 'same' : (
                <>
                  {k !== 'Duration' && (d > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)} {signed(d, f)}
                </>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <button className="btn icon ghost" onClick={() => nav(fresh ? '/history' : (-1 as any))} aria-label="Back">
          <ChevronLeft size={26} />
        </button>
        <div className="grow">
          <h1 className="ellipsis">{fresh ? 'Summary' : s.name}</h1>
          {!fresh && <div className="sub">{fmtDateLong(sessionDate(s))}</div>}
        </div>
        {!fresh && (
          <button className="btn icon sm" onClick={share} disabled={sharing} aria-label="Share summary">
            <Share2 size={18} />
          </button>
        )}
      </div>

      {fresh && (
        <div className="card done-hero">
          <div className="done-badge">
            <Check size={34} strokeWidth={3} />
          </div>
          <div className="done-title">Workout complete</div>
          <div className="done-sub">
            {s.name} · {fmtDateLong(sessionDate(s))}
          </div>
          {prs.length > 0 ? (
            <span className="chip pr" style={{ marginTop: 6 }}>
              <Trophy size={12} /> {prs.length} new record{prs.length > 1 ? 's' : ''}
            </span>
          ) : pm && volDelta > 0 ? (
            <span className="chip ok" style={{ marginTop: 6 }}>
              {signed(volDelta, fmtVolume)} more than last time
            </span>
          ) : null}
        </div>
      )}

      {stats}

      {prs.length > 0 && (
        <div className="card pr-card">
          <h2>
            <Trophy size={20} /> {prs.length} personal record{prs.length > 1 ? 's' : ''}
          </h2>
          <div style={{ marginTop: 6 }}>
            {prs.map((p, i) => (
              <div key={i} className="pr-item">
                <div className="n">
                  {prName(p)}
                  <div className="tiny muted">{p.types.map((t) => PR_LABEL[t]).join(' · ')}</div>
                </div>
                <div className="w">
                  {fmtKg(p.weight)} kg × {p.reps}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {comparison}

      {photo}

      {muscles}

      {fresh && (
        <div className="row">
          <button className="btn grow" onClick={share} disabled={sharing}>
            <Share2 size={18} /> {sharing ? 'Preparing…' : 'Share'}
          </button>
          <button className="btn primary grow" onClick={() => nav('/', { replace: true })}>
            Done
          </button>
        </div>
      )}

      {s.data.exercises.map((e, i) => {
        const done = e.sets.filter((x) => x.done)
        if (!done.length) return null
        const exOf = db.exercises.find((x) => x.id === e.exercise_id)
        const tracking = trackingOf(exOf)
        const hasPr = done.some((x) => prIds.has(x.id))
        let n = 0
        return (
          <div key={i} className="card">
            <div className="row" style={{ marginBottom: 8 }}>
              <Thumb path={exOf?.image_path} name={nameOf(e.exercise_id, e.name)} muscle={exOf?.muscle} size={44} className="round" />
              <div className="grow hv-exname">{nameOf(e.exercise_id, e.name)}</div>
              {hasPr && (
                <span className="chip pr">
                  <Trophy size={12} /> PR
                </span>
              )}
            </div>
            <div className="sd-sets">
              {done.map((x) => {
                if (x.kind !== 'warmup') n++
                const pr = prIds.has(x.id)
                return (
                  <div key={x.id} className={`sd-set${pr ? ' pr' : ''}`}>
                    <span className="no">{KIND[x.kind] ? <span className={`kind-tag ${x.kind}`}>{KIND[x.kind]}</span> : n}</span>
                    <span className="what">
                      <SetText x={x} tracking={tracking} />
                    </span>
                    {x.rpe != null && <span className="small muted">RPE {x.rpe}</span>}
                    {pr && (
                      <span className="chip pr" aria-label="Record set">
                        <Trophy size={12} />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {s.notes && (
        <div className="card">
          <div className="small muted">Notes</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{s.notes}</div>
        </div>
      )}

      <button className="btn" onClick={() => setEditing(true)}>
        <Pencil size={16} /> Edit workout
      </button>
      <button className="btn danger" onClick={() => setConfirm(true)}>
        <Trash2 size={16} /> Delete this workout
      </button>
      {confirm && (
        <Confirm
          title="Delete this workout from history?"
          text="Records are recalculated without it."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            remove('sessions', s.id)
            nav('/history')
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  )
}
