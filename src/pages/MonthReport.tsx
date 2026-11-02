import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronRight, Share2, Trophy } from 'lucide-react'
import { lang, t as tr, tm } from '../lib/i18n'
import { useStore } from '../lib/store'
import { fullMonthReport, MonthNumbers } from '../lib/monthReport'
import { fmtMinutes, fmtVolume, muscleSets } from '../lib/stats'
import { fmtKg } from '../lib/format'
import { renderShareCard, shareOrDownload } from '../lib/shareCard'
import { PageHeader, useImageUrl } from '../components/ui'
import '../styles/report.css'

/**
 * A month in review (like Hevy's monthly report): the numbers against the month before, workouts per month,
 * the days you trained, sets per muscle, the exercises you did most, records, the month's photos, and a share image.
 * Opened from History (/report/2026-10).
 */
export default function MonthReportPage() {
  const { ym } = useParams()
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const toast = useStore((s) => s.toast)
  const month = useMemo(() => {
    const [y, m] = (ym ?? '').split('-').map(Number)
    return y && m ? new Date(y, m - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  }, [ym])
  const r = useMemo(() => fullMonthReport(db, month), [db, month])
  const muscles = useMemo(() => muscleSets(db, month, new Date(month.getFullYear(), month.getMonth() + 1, 1)).filter((m) => m.sets > 0), [db, month])
  const [allTop, setAllTop] = useState(false)
  const [sharing, setSharing] = useState(false)
  const loc = lang === 'he' ? 'he-IL' : 'en-GB'
  const monthName = month.toLocaleDateString(loc, { month: 'long', year: 'numeric' })
  const prevName = new Date(month.getFullYear(), month.getMonth() - 1, 1).toLocaleDateString(loc, { month: 'long' })
  const maxTrend = Math.max(1, ...r.trend.map((x) => x.workouts))
  const maxMuscle = Math.max(1, ...muscles.map((m) => m.sets))
  const nameOf = (id: string) => db.exercises.find((e) => e.id === id)?.name ?? ''

  async function share() {
    setSharing(true)
    try {
      const blob = await renderShareCard({
        heading: tr('Monthly report'),
        title: monthName,
        date: tr('{n} workouts', { n: r.now.workouts }),
        duration: fmtMinutes(r.now.minutes),
        sets: String(r.now.sets),
        volume: r.now.volume > 0 ? fmtVolume(r.now.volume) : '–',
        prs: r.records.map((p) => ({ name: nameOf(p.exerciseId), detail: `${fmtKg(p.weight)} kg × ${p.reps}` })),
        comparison: r.before.volume > 0 ? tr('{p}% volume vs {m}', { p: signedPct(r.now.volume, r.before.volume), m: prevName }) : null,
        comparisonUp: r.before.volume > 0 ? r.now.volume >= r.before.volume : null
      })
      const res = await shareOrDownload(blob, `gymlog-${ym ?? 'month'}.png`, monthName)
      if (res === 'downloaded') toast({ kind: 'info', text: 'Summary image saved' })
    } catch (e) {
      toast({ kind: 'error', text: 'Could not create the image', sub: String((e as Error)?.message ?? e) })
    } finally {
      setSharing(false)
    }
  }

  // the calendar: weeks start on Sunday, as on Progress
  const first = month.getDay()
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)]
  const trained = new Set(r.days)

  return (
    <div className="stack rep" style={{ gap: 16 }}>
      <PageHeader title={tr('{m} report', { m: month.toLocaleDateString(loc, { month: 'long' }) })} sub={monthName} back />

      {r.now.workouts === 0 ? (
        <div className="card small muted">{tr('No workouts this month yet.')}</div>
      ) : (
        <>
          <section className="rep-stats">
            <Stat label={tr('Workouts')} v={String(r.now.workouts)} now={r.now} before={r.before} k="workouts" fmt={String} />
            <Stat label={tr('Time')} v={fmtMinutes(r.now.minutes)} now={r.now} before={r.before} k="minutes" fmt={fmtMinutes} />
            <Stat label={tr('Volume')} v={fmtVolume(r.now.volume)} now={r.now} before={r.before} k="volume" fmt={fmtVolume} />
            <Stat label={tr('Sets')} v={String(r.now.sets)} now={r.now} before={r.before} k="sets" fmt={String} />
          </section>
          <div className="tiny muted" style={{ marginTop: -8 }}>
            {tr('Arrows compare with {m}.', { m: prevName })}
          </div>

          <section className="card stack" style={{ gap: 10 }}>
            <h2 className="rep-h">{tr('Workouts per month')}</h2>
            <div className="rep-trend">
              {r.trend.map((x, i) => (
                <div key={i} className={`rep-bar${i === r.trend.length - 1 ? ' on' : ''}`}>
                  <span className="rep-bar-n">{x.workouts || ''}</span>
                  <span className="rep-bar-fill" style={{ height: `${(x.workouts / maxTrend) * 100}%` }} />
                  <span className="rep-bar-l">{x.month.toLocaleDateString(loc, { month: 'narrow' })}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card stack" style={{ gap: 10 }}>
            <h2 className="rep-h">{tr('{n} training days', { n: r.days.length })}</h2>
            <div className="rep-cal">
              {cells.map((d, i) =>
                d && trained.has(d) ? (
                  // a training day opens its workout (the last one, if there were two)
                  <button key={i} className="rep-day on" onClick={() => nav(`/history/${r.byDay[d][r.byDay[d].length - 1]}`)} aria-label={tr('Open the workout of the {d}th', { d })}>
                    {d}
                  </button>
                ) : (
                  <span key={i} className={`rep-day${d ? '' : ' blank'}`}>
                    {d ?? ''}
                  </span>
                )
              )}
            </div>
          </section>

          {muscles.length > 0 && (
            <section className="card stack" style={{ gap: 8 }}>
              <h2 className="rep-h">{tr('Sets per muscle')}</h2>
              {muscles.map((m) => (
                <div key={m.muscle} className="rep-m">
                  <span className="rep-m-n">{tm(m.muscle)}</span>
                  <span className="rep-m-track">
                    <span className="rep-m-fill" style={{ width: `${(m.sets / maxMuscle) * 100}%` }} />
                  </span>
                  <span className="rep-m-v">{Math.round(m.sets * 10) / 10}</span>
                </div>
              ))}
            </section>
          )}

          {r.top.length > 0 && (
            <section className="card stack" style={{ gap: 4 }}>
              <h2 className="rep-h">{tr('Most done')}</h2>
              <div className="list-group rep-top">
                {(allTop ? r.top : r.top.slice(0, 3)).map((x) => (
                  <button key={x.exerciseId} className="list-row" onClick={() => nav(`/exercise/${x.exerciseId}`)}>
                    <span className="grow ellipsis">{x.name}</span>
                    <span className="small muted">{tr(x.times === 1 ? '{n} time' : '{n} times', { n: x.times })}</span>
                    <ChevronRight size={16} aria-hidden className="muted" />
                  </button>
                ))}
              </div>
              {r.top.length > 3 && (
                <button className="btn ghost sm" style={{ alignSelf: 'center' }} onClick={() => setAllTop((v) => !v)}>
                  {allTop ? tr('Show less') : tr('See {n} more', { n: r.top.length - 3 })}
                </button>
              )}
            </section>
          )}

          {r.records.length > 0 && (
            <section className="card stack" style={{ gap: 6 }}>
              <h2 className="rep-h">
                <Trophy size={18} aria-hidden className="accent-ico" /> {tr(r.records.length === 1 ? '{n} new record' : '{n} new records', { n: r.records.length })}
              </h2>
              {r.records.slice(0, 5).map((p) => (
                <div key={p.exerciseId} className="rep-pr">
                  <span className="grow ellipsis">{nameOf(p.exerciseId)}</span>
                  <b>
                    {fmtKg(p.weight)} kg × {p.reps}
                  </b>
                </div>
              ))}
            </section>
          )}

          {r.photos.length > 0 && (
            <section className="stack" style={{ gap: 8 }}>
              <h2 className="rep-h">{tr('Photos')}</h2>
              <div className="rep-photos">
                {r.photos.slice(0, 6).map((p) => (
                  <Photo key={p} path={p} />
                ))}
              </div>
            </section>
          )}

          <section className="card rep-end">
            <div className="rep-end-t">{tr('Nice work in {m}!', { m: month.toLocaleDateString(loc, { month: 'long' }) })}</div>
            <div className="small muted">{tr('Share your month with friends or your coach.')}</div>
            <button className="btn primary block" onClick={share} disabled={sharing}>
              <Share2 size={18} aria-hidden /> {tr('Share')}
            </button>
          </section>
        </>
      )}
    </div>
  )
}

const signedPct = (a: number, b: number) => {
  const p = Math.round(((a - b) / b) * 100)
  return (p > 0 ? '+' : '') + p
}

function Stat({ label, v, now, before, k, fmt }: { label: string; v: string; now: MonthNumbers; before: MonthNumbers; k: keyof MonthNumbers; fmt: (n: number) => string }) {
  const d = now[k] - before[k]
  return (
    <div className="card rep-stat">
      <div className="rep-stat-v">{v}</div>
      <div className="small muted">{label}</div>
      {before[k] > 0 && Math.abs(d) >= 0.5 && (
        <div className={`rep-delta ${d > 0 ? 'up' : ''}`}>
          {d > 0 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
          {fmt(Math.abs(d))}
        </div>
      )}
    </div>
  )
}

function Photo({ path }: { path: string }) {
  const url = useImageUrl(path)
  return <div className="rep-photo">{url && <img src={url} alt="" loading="lazy" />}</div>
}
