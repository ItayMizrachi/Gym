import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Check, Share2, Trash2, Trophy } from 'lucide-react'
import { useStore } from '../lib/store'
import { sessionDate, sessionPRs, PREvent } from '../lib/pr'
import { fmtDate, fmtDateLong, fmtKg } from '../lib/format'
import { Confirm } from '../components/ui'
import { fmtMinutes, fmtVolume, previousOfTemplate, summarizeSession } from '../lib/stats'
import { renderShareCard, shareOrDownload } from '../lib/shareCard'
import '../styles/insights.css'

const KIND: Record<string, string> = { work: '', failure: 'F', drop: 'D', warmup: 'W' }
const PR_LABEL = { weight: 'heaviest', e1rm: 'est. 1RM', reps: 'rep record' } as const

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
  const s = db.sessions.find((x) => x.id === id)
  const prs = useMemo(() => (s ? sessionPRs(db, s) : []), [db, s])
  const prev = useMemo(() => (s ? previousOfTemplate(db, s) : null), [db, s])
  if (!s) return <div className="card">Session not found. <button className="btn sm" onClick={() => nav('/history')}>History</button></div>

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

  const stats = (
    <div className="stat-grid">
      <div className="stat">
        <div className="v">{m.minutes}</div>
        <div className="l">minutes</div>
      </div>
      <div className="stat">
        <div className="v">{m.sets}</div>
        <div className="l">sets</div>
      </div>
      <div className="stat">
        <div className="v">{fmtVolume(m.volume).replace(/ (kg|t)$/, '')}</div>
        <div className="l">{m.volume >= 1000 ? 'tonnes' : 'kg'} lifted</div>
      </div>
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
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <button className="btn icon ghost" onClick={() => nav(fresh ? '/history' : (-1 as any))} aria-label="Back">
          <ArrowLeft size={22} />
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
        let n = 0
        return (
          <div key={i} className="card">
            <div className="row" style={{ marginBottom: 6 }}>
              <div className="grow" style={{ fontWeight: 700 }}>
                {nameOf(e.exercise_id, e.name)}
              </div>
              {prs.some((p) => p.exercise_id === e.exercise_id) && (
                <span className="chip pr">
                  <Trophy size={12} /> PR
                </span>
              )}
            </div>
            <table className="t">
              <thead>
                <tr>
                  <th>Set</th>
                  <th>kg</th>
                  <th>Reps</th>
                </tr>
              </thead>
              <tbody>
                {done.map((x) => {
                  if (x.kind === 'work') n++
                  return (
                    <tr key={x.id}>
                      <td>{KIND[x.kind] ? <span className={`kind-tag ${x.kind}`}>{KIND[x.kind]}</span> : n}</td>
                      <td>{fmtKg(x.weight)}</td>
                      <td>{x.reps}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      {s.notes && (
        <div className="card">
          <div className="small muted">Notes</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{s.notes}</div>
        </div>
      )}

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
