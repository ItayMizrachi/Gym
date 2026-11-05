import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Flame } from 'lucide-react'
import { t } from '../lib/i18n'
import { useStore } from '../lib/store'
import { RecoveryLine } from './RecoveryCard'
import { fmtDate } from '../lib/format'
import { addDays, compareWeeks, fmtSets, fmtVolume, guidelineZone, muscleSets, MUSCLE_SETS_MAX, MUSCLE_SETS_MIN, plannedMuscles, weeklyStreak } from '../lib/stats'
import '../styles/insights.css'
import '../styles/home.css'

function Delta({ now, before, fmt }: { now: number; before: number; fmt: (n: number) => string }) {
  const d = now - before
  // nothing last week: no comparison to make, so the tile is just the number
  if (before === 0) return null
  if (Math.abs(d) < 0.5) return <div className="delta muted">{t('same as last wk')}</div>
  // the header says "vs last week" once; each box only shows how much. Less is grey, not red (red means failure)
  return (
    <div className={`delta ${d > 0 ? 'up' : 'muted'}`} aria-label={t(d > 0 ? '{v} more than last week' : '{v} less than last week', { v: fmt(Math.abs(d)) })}>
      {d > 0 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
      {fmt(Math.abs(d))}
    </div>
  )
}

/** Progress: this week against last week, and sets per muscle (moved off Train so Train is only "what now"). */
export function WeekSummary() {
  const db = useStore((s) => s.db)
  const now = useMemo(() => new Date(), [db])
  const [muscleWeek, setMuscleWeek] = useState<'this' | 'last'>('this')
  const weeks = useMemo(() => compareWeeks(db, now), [db, now])
  const streak = useMemo(() => weeklyStreak(db, now), [db, now])
  const muscles = useMemo(() => {
    const from = muscleWeek === 'this' ? weeks.weekStart : addDays(weeks.weekStart, -7)
    return muscleSets(db, from, addDays(from, 7), plannedMuscles(db))
  }, [db, weeks.weekStart, muscleWeek])
  const tw = weeks.thisWeek
  const lw = weeks.lastWeekToDate
  const scaleMax = Math.max(MUSCLE_SETS_MAX + 4, ...muscles.map((m) => m.sets + 1))
  // only muscles with sets; the rest would be a column of dashes
  const [allMuscles, setAllMuscles] = useState(false)
  const trained = muscles.filter((m) => m.sets > 0)
  const untrained = muscles.length - trained.length
  const shown = allMuscles ? muscles : trained
  const pct = (n: number) => `${(n / scaleMax) * 100}%`
  return (
    <>
      <section className="stack" style={{ gap: 10 }} aria-label={t("This week")}>
        <div className="sec-head">
          <h2>{t("This week")}</h2>
          <span className="small muted">
            {fmtDate(weeks.weekStart.toISOString())} – {fmtDate(addDays(weeks.weekStart, 6).toISOString())} · {t('vs last week')}
          </span>
        </div>
        <div className="stat-grid two">
          <div className="stat">
            <div className="v">{tw.sets}</div>
            <div className="l">{t('sets')}</div>
            <Delta now={tw.sets} before={lw.sets} fmt={String} />
          </div>
          <div className="stat">
            <div className="v">{fmtVolume(tw.volume).replace(/ (kg|t)$/, '')}</div>
            <div className="l">{t(tw.volume >= 1000 ? 'tonnes lifted' : 'kg lifted')}</div>
            <Delta now={tw.volume} before={lw.volume} fmt={fmtVolume} />
          </div>
        </div>
        {!streak.thisWeekDone && streak.current > 0 && (
          <div className="small muted nudge">
            <Flame size={14} /> {t('Train once this week to keep your {n}-week streak.', { n: streak.current })}
          </div>
        )}
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <RecoveryLine />
        <div>
          <div className="row">
            <div className="ins-title grow" style={{ whiteSpace: 'nowrap' }}>{t("Sets per muscle")}</div>
            <div className="seg sm">
              <button className={muscleWeek === 'this' ? 'on' : ''} onClick={() => setMuscleWeek('this')}>
                {t("This wk")}
              </button>
              <button className={muscleWeek === 'last' ? 'on' : ''} onClick={() => setMuscleWeek('last')}>
                {t("Last wk")}
              </button>
            </div>
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {t('Shaded: {a}–{b} sets a week', { a: MUSCLE_SETS_MIN, b: MUSCLE_SETS_MAX })}
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="small muted">{t("No sets logged yet.")}</div>
        ) : (
          <div className="mbars">
            {shown.map((m) => (
              <div key={m.muscle} className={`mbar ${guidelineZone(m.sets)}`}>
                <div className="mbar-name">{m.muscle}</div>
                <div className="mbar-track">
                  <div className="mbar-band" style={{ left: pct(MUSCLE_SETS_MIN), width: pct(MUSCLE_SETS_MAX - MUSCLE_SETS_MIN) }} />
                  <div className="mbar-fill" style={{ width: pct(m.sets) }} />
                </div>
                <div className="mbar-v">{m.sets === 0 ? '–' : fmtSets(m.sets)}</div>
              </div>
            ))}
            <div className="mbar legend">
              <div />
              <div className="mbar-track bare">
                <span style={{ left: pct(MUSCLE_SETS_MIN) }}>{MUSCLE_SETS_MIN}</span>
                <span style={{ left: pct(MUSCLE_SETS_MAX) }}>{MUSCLE_SETS_MAX}</span>
              </div>
              <div />
            </div>
          </div>
        )}
        {untrained > 0 && (
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} aria-expanded={allMuscles} onClick={() => setAllMuscles((v) => !v)}>
            <ChevronDown size={16} aria-hidden style={{ transform: allMuscles ? 'rotate(180deg)' : undefined }} />
            {allMuscles ? t('Only muscles you trained') : t('All muscles (+{n} not trained)', { n: untrained })}
          </button>
        )}
      </section>

    </>
  )
}
