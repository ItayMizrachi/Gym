import { daysFromName, daysLabel, plannedDays, todaysWorkout } from '../lib/plan'
import { lang, t, tm } from '../lib/i18n'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Plus, Zap, ChevronRight, Sparkles, Flame, ArrowUp, ArrowDown, Dumbbell, Trophy, LayoutGrid, ChevronDown, Folder, MoreHorizontal, HelpCircle, BookOpen, PencilLine, Users } from 'lucide-react'
import { useCoachRole } from '../lib/coach'
import { upNext } from '../lib/upNext'
import { WeeklyRecap } from '../components/WeeklyRecap'

/** "Quads" / "Quads and Glutes" (two at most, the line stays short) */
const listMuscles = (m: string[]) => (m.length <= 1 ? tm(m[0] ?? '') : t('{a} and {b}', { a: tm(m[0]), b: tm(m[1]) }))
import { useStore } from '../lib/store'
import { buildStarterPlan } from '../lib/seed'
import { startEmptySession, startSessionFromWorkout } from '../lib/actions'
import { primeAudio } from '../lib/beep'
import { fmtDate, splitName } from '../lib/format'
import { nowIso, uid } from '../lib/uid'
import { DB, Workout } from '../lib/types'
import { sessionDate } from '../lib/pr'
import {
  addDays,
  compareWeeks,
  finishedSessions,
  fmtMinutes,
  fmtSets,
  fmtVolume,
  guidelineZone,
  muscleSets,
  MUSCLE_SETS_MAX,
  MUSCLE_SETS_MIN,
  plannedMuscles,
  relativeDay,
  summarizeSession,
  weeklyStreak
} from '../lib/stats'
import { RenameFolderSheet } from '../components/FolderSheet'
import { DragList } from '../components/DragList'
import { groupByFolder } from '../lib/folders'
import { WeekLine } from '../components/GoalRing'
import { RecoveryLine } from '../components/RecoveryCard'
import { Sheet } from '../components/ui'
import { StartChecklist } from '../components/StartChecklist'
import { useAchievementToasts } from '../components/Achievements'
import '../styles/insights.css'
import '../styles/programs-nav.css'
import '../styles/home.css'

function templateInfo(db: DB, w: Workout) {
  const wes = db.workout_exercises.filter((x) => x.workout_id === w.id).sort((a, b) => a.position - b.position)
  const names = wes.map((x) => db.exercises.find((e) => e.id === x.exercise_id)?.name ?? '?')
  const sets = wes.reduce((a, x) => a + x.sets + (x.drop_last ? 1 : 0), 0)
  const done = db.sessions.filter((s) => s.finished_at && s.workout_id === w.id)
  const last = done.sort((a, b) => (sessionDate(b) > sessionDate(a) ? 1 : -1))[0]
  // typical length from the last few sessions; ignores sessions that were left open for hours
  const mins = done
    .slice(0, 5)
    .map((s) => summarizeSession(s).minutes)
    .filter((m) => m >= 10 && m <= 240)
  const usual = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length / 5) * 5 : null
  return { wes, names, sets, last, usual }
}

/** "Started at 16:52" today, "Started Thu 22 Oct" for an older one left open */
function startedText(iso: string): string {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today
    ? t('Started at {time}', { time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })
    : t('Started {date}', { date: d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) })
}

function Delta({ now, before, fmt }: { now: number; before: number; fmt: (n: number) => string }) {
  const d = now - before
  // nothing last week: "↑ 17 vs last wk" says nothing new, so say it plainly
  if (before === 0) return now > 0 ? <div className="delta muted">none last wk</div> : null
  if (Math.abs(d) < 0.5) return <div className="delta muted">same as last wk</div>
  return (
    <div className={`delta ${d > 0 ? 'up' : 'down'}`}>
      {d > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {fmt(Math.abs(d))} vs last wk
    </div>
  )
}

/** collapsed folder headers on the Train tab (this device only) */
const FOLDS_KEY = 'gymlog:folds'
function loadFolds(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FOLDS_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export default function Home() {
  const nav = useNavigate()
  const coachRole = useCoachRole()
  const db = useStore((s) => s.db)
  const save = useStore((s) => s.save)
  /** a folder's workouts in their new order: they take over that folder's places, then every workout is numbered 0, 1, 2… */
  function reorderWorkouts(list: Workout[]) {
    const all = [...useStore.getState().db.workouts].sort((a, b) => a.position - b.position)
    const ids = new Set(list.map((w) => w.id))
    let k = 0
    const next = all.map((w) => (ids.has(w.id) ? list[k++] : w))
    next.forEach((w, i) => {
      if (w.position !== i) save('workouts', { ...w, position: i })
    })
  }
  const user = useStore((s) => s.user)
  const [muscleWeek, setMuscleWeek] = useState<'this' | 'last'>('this')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [folded, setFolded] = useState<string[]>(loadFolds)
  useAchievementToasts()
  function toggleFold(label: string) {
    const next = folded.includes(label) ? folded.filter((f) => f !== label) : [...folded, label]
    setFolded(next)
    try {
      localStorage.setItem(FOLDS_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const now = useMemo(() => new Date(), [db])
  const workouts = useMemo(() => [...db.workouts].sort((a, b) => a.position - b.position), [db.workouts])
  const groups = useMemo(() => groupByFolder(db.workouts), [db.workouts])
  const active = db.sessions.find((s) => !s.finished_at)
  const activeDone = active ? active.data.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0) : 0
  const activeTotal = active ? active.data.exercises.reduce((a, e) => a + e.sets.length, 0) : 0
  const finished = useMemo(() => finishedSessions(db), [db])
  // a workout planned for today wins over the rotation suggestion
  const planned = useMemo(() => todaysWorkout(db), [db])
  // planned for today, else the rotation, unless its muscles are still recovering (src/lib/upNext.ts)
  const next = useMemo(() => upNext(db, now), [db, now])
  const weeks = useMemo(() => compareWeeks(db, now), [db, now])
  const streak = useMemo(() => weeklyStreak(db, now), [db, now])
  const muscles = useMemo(() => {
    const from = muscleWeek === 'this' ? weeks.weekStart : addDays(weeks.weekStart, -7)
    return muscleSets(db, from, addDays(from, 7), plannedMuscles(db))
  }, [db, weeks.weekStart, muscleWeek])

  function loadStarter() {
    const plan = buildStarterPlan(user?.id ?? 'local', db.exercises, db.workouts.length)
    plan.exercises.forEach((e) => save('exercises', e))
    plan.workouts.forEach((w) => save('workouts', w))
    plan.workout_exercises.forEach((w) => save('workout_exercises', w))
  }

  function newWorkout() {
    const id = uid()
    save('workouts', { id, user_id: user?.id ?? 'local', name: 'New workout', notes: '', position: db.workouts.length, created_at: nowIso() })
    nav(`/workout/${id}`)
  }

  function emptyWorkout() {
    primeAudio()
    nav(`/session/${startEmptySession()}`)
  }

  function start(w: Workout) {
    primeAudio()
    const id = startSessionFromWorkout(w)
    nav(`/session/${id}`)
  }

  const hour = now.getHours()
  const greeting = t(hour < 5 ? 'Late session?' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
  const hero = next && !active ? templateInfo(db, next.workout) : null
  const tw = weeks.thisWeek
  const lw = weeks.lastWeekToDate
  const scaleMax = Math.max(MUSCLE_SETS_MAX + 4, ...muscles.map((m) => m.sets + 1))
  const pct = (n: number) => `${(n / scaleMax) * 100}%`

  const [heroName, heroWhen] = next ? splitName(next.workout.name) : ['', '']
  // this week + recovery: inside the hero, or inside the "in progress" card while a workout is open
  const weekRows = workouts.length > 0 && (
    <div className="hm-foot">
      <WeekLine />
      <RecoveryLine />
    </div>
  )

  return (
    <div className="stack ins-home hm" style={{ gap: 16 }}>
      <div className="page-head">
        <div className="grow">
          <h1>{greeting}</h1>
          <div className="sub">{now.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        {coachRole && (
          <button className="btn sm coach-entry" onClick={() => nav('/coach')} aria-label={t("Coaching: your trainees")}>
            <Users size={16} aria-hidden /> {t('Coaching')}
          </button>
        )}
        {streak.current > 0 && (
          <div
            className={`streak-pill${streak.thisWeekDone ? '' : ' pending'}`}
            title={`Best streak: ${streak.best} weeks`}
            aria-label={`${streak.current}-week training streak`}
          >
            <Flame size={16} aria-hidden />
            <span>{streak.current}</span>
            <span className="u">wk</span>
          </div>
        )}
      </div>

      {active && (
        <div className="card hm-hero">
          <div className="hm-label">{t('Workout in progress')}</div>
          {/* the day in the name ("Monday") says nothing about a workout already running: show how far along it is */}
          <div className="hm-name">{splitName(active.name)[0]}</div>
          <div className="hm-meta">
            {startedText(active.started_at)} · {t('{a} of {b} sets', { a: activeDone, b: activeTotal })}
          </div>
          <button
            className="btn primary block hm-go"
            onClick={() => {
              primeAudio()
              nav(`/session/${active.id}`)
            }}
          >
            <Play size={18} aria-hidden /> {t('Resume workout')}
          </button>
          {weekRows}
        </div>
      )}

      {workouts.length === 0 ? (
        <div className="card hm-welcome">
          <div className="welcome-mark" aria-hidden>
            <Dumbbell size={26} />
          </div>
          <h2>{t('Pick a program to begin')}</h2>
          <p className="muted">{t('Choose a ready-made plan, start it, and tick each set as you go. Weights fill in from last time.')}</p>
          <button className="btn primary block" onClick={() => nav('/programs')}>
            <LayoutGrid size={18} aria-hidden /> {t('Browse programs')}
          </button>
          <button className="btn secondary block" onClick={loadStarter}>
            <Sparkles size={18} aria-hidden /> {t('Load my starter plan (4 days)')}
          </button>
          <div className="hm-welcome-more">
            <button className="btn ghost" onClick={newWorkout}>
              {t('Build your own')}
            </button>
            <button className="btn ghost" disabled={!!active} onClick={emptyWorkout}>
              {t('Empty workout')}
            </button>
          </div>
        </div>
      ) : (
        hero &&
        next && (
          <div className="card hm-hero">
            <div className="hm-label">
              {t(planned ? "Today's workout" : 'Up next')}
              {next.reason === 'fresh' && next.tired?.length ? (
                <span className="muted"> · {t('{m} still recovering', { m: listMuscles(next.tired) })}</span>
              ) : (
                next.lastDone && <span className="muted"> · {t('last done {when}', { when: relativeDay(next.lastDone, now) })}</span>
              )}
            </div>
            <div className="hm-name">
              {heroName}
              {/* "(Wednesday)" in the name only helps on a Wednesday: then it reads "Today", other days nothing */}
              {heroWhen && heroWhen.toLowerCase() === new Date().toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase() && (
                <span className="hm-when">{t('Today')}</span>
              )}
            </div>
            <div className="hm-meta">
              <span>
                <b>{hero.wes.length}</b> {t(hero.wes.length === 1 ? 'exercise' : 'exercises')}
              </span>
              <span>
                <b>{hero.sets}</b> {t('sets')}
              </span>
              {hero.usual != null && (
                <span>
                  {t('about')} <b>{fmtMinutes(hero.usual)}</b>
                </span>
              )}
            </div>
            {hero.names.length > 0 && <div className="hm-preview">{hero.names.join(' · ')}</div>}
            <button className="btn primary block hm-go" onClick={() => start(next.workout)} disabled={hero.wes.length === 0}>
              <Play size={18} aria-hidden /> {t('Start {name}', { name: heroName })}
            </button>
            {weekRows}
          </div>
        )
      )}

      {!active && <WeeklyRecap />}
      {workouts.length > 0 && <StartChecklist />}

      {workouts.length > 0 && (
        <section className="stack" style={{ gap: 8 }} aria-label={t("Your workouts")}>
          <div className="sec-head hm-sec">
            <h2>{t('Your workouts')}</h2>
            <button className="btn sm secondary hm-new" onClick={() => setAdding(true)} aria-haspopup="dialog">
              <Plus size={16} aria-hidden /> {t('New')}
            </button>
          </div>
          {groups.map((g) => {
            const shut = folded.includes(g.label)
            return (
              <div key={g.label} className="fold">
                {groups.length > 1 && (
                  <div className="row" style={{ gap: 4 }}>
                    <button className="fold-head grow" aria-expanded={!shut} onClick={() => toggleFold(g.label)}>
                      <ChevronDown size={18} className="fold-caret" aria-hidden />
                      {g.folder ? <Folder size={16} className="fold-icon" aria-hidden /> : null}
                      <h3 className="ellipsis">{t(g.label)}</h3>
                      <span className="small muted">{g.workouts.length}</span>
                    </button>
                    {g.folder && (
                      <button className="btn icon sm ghost" onClick={() => setRenaming(g.folder)} aria-label={`Rename folder ${g.folder}`}>
                        <MoreHorizontal size={18} />
                      </button>
                    )}
                  </div>
                )}
                {!shut && (
                  // hold a workout and drag it to a new place in its folder
                  <DragList className="tlist" items={g.workouts} onReorder={(list) => reorderWorkouts(list)}>
                    {(w, _i, drag, lifted) => {
                      const info = templateInfo(db, w)
                      const isNext = next?.workout.id === w.id
                      return (
                        <div key={w.id} {...drag} className={`trow${isNext ? ' next' : ''}${lifted ? ' lifted' : ''}`}>
                          <button className="trow-main" onClick={() => nav(`/workout/${w.id}`)} aria-label={`Edit ${w.name}`}>
                            <div className="trow-name ellipsis">{splitName(w.name)[0]}</div>
                            <div className="small muted ellipsis">
                              {/* "Lower B (Wednesday)": the day goes on this line so the name is never cut */}
                              {splitName(w.name)[1] && <span className="trow-days">{t(splitName(w.name)[1])} · </span>}
                              {plannedDays(w).length > 0 && !daysFromName(w.name).length && <span className="trow-days">{daysLabel(plannedDays(w))} · </span>}
                              {t(info.wes.length === 1 ? '{n} exercise' : '{n} exercises', { n: info.wes.length })}
                              {info.last ? ` · ${relativeDay(sessionDate(info.last), now)}` : ` · ${t('new')}`}
                            </div>
                          </button>
                          {/* moving to a folder lives in the workout editor (Folder → Move), not on every row */}
                          <button
                            className="btn sm trow-start"
                            disabled={!!active || info.wes.length === 0}
                            onClick={() => start(w)}
                            aria-label={`Start ${w.name}`}
                          >
                            <Play size={14} aria-hidden /> {t('Start')}
                          </button>
                        </div>
                      )
                    }}
                  </DragList>
                )}
              </div>
            )
          })}
        </section>
      )}
      {renaming && <RenameFolderSheet folder={renaming} onClose={() => setRenaming(null)} />}
      {adding && (
        <Sheet title={t("Add a workout")} onClose={() => setAdding(false)}>
          <div className="list-group home-links">
            <button
              className="list-row"
              disabled={!!active}
              onClick={() => {
                setAdding(false)
                emptyWorkout()
              }}
            >
              <Zap size={20} aria-hidden />
              <span className="grow">
                <span className="home-link-t">{t("Start an empty workout")}</span>
                <span className="tiny muted">{active ? 'Finish the workout in progress first' : 'Add exercises as you go'}</span>
              </span>
              <ChevronRight size={18} aria-hidden />
            </button>
            <button className="list-row" onClick={newWorkout}>
              <PencilLine size={20} aria-hidden />
              <span className="grow">
                <span className="home-link-t">{t("Build a new workout")}</span>
                <span className="tiny muted">{t("Pick exercises, sets and rest, then save it")}</span>
              </span>
              <ChevronRight size={18} aria-hidden />
            </button>
            <button className="list-row" onClick={() => nav('/programs')}>
              <LayoutGrid size={20} aria-hidden />
              <span className="grow">
                <span className="home-link-t">{t("Browse programs")}</span>
                <span className="tiny muted">{t("Single workouts and weekly plans, ready to go")}</span>
              </span>
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        </Sheet>
      )}

      {finished.length > 0 && (
        <>
          <section className="stack" style={{ gap: 10 }} aria-label={t("This week")}>
            <div className="sec-head">
              <h2>{t("This week")}</h2>
              <span className="small muted">
                {fmtDate(weeks.weekStart.toISOString())} – {fmtDate(addDays(weeks.weekStart, 6).toISOString())}
              </span>
            </div>
            <div className="stat-grid">
              <div className="stat">
                <div className="v">{tw.workouts}</div>
                <div className="l">workouts</div>
                <Delta now={tw.workouts} before={lw.workouts} fmt={String} />
              </div>
              <div className="stat">
                <div className="v">{tw.sets}</div>
                <div className="l">sets</div>
                <Delta now={tw.sets} before={lw.sets} fmt={String} />
              </div>
              <div className="stat">
                <div className="v">{fmtVolume(tw.volume).replace(/ (kg|t)$/, '')}</div>
                <div className="l">{tw.volume >= 1000 ? 'tonnes' : 'kg'} lifted</div>
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
                Shaded band: {MUSCLE_SETS_MIN}–{MUSCLE_SETS_MAX} sets a week, a good range to grow.
              </div>
            </div>
            {muscles.length === 0 ? (
              <div className="small muted">{t("No sets logged yet.")}</div>
            ) : (
              <div className="mbars">
                {muscles.map((m) => (
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
          </section>
        </>
      )}

      <div className="list-group home-links">
        {workouts.length > 0 && (
          <button className="list-row" onClick={() => nav('/programs')}>
            <LayoutGrid size={20} aria-hidden />
            <span className="grow">
              <span className="home-link-t">{t("Browse programs")}</span>
              <span className="tiny muted">{t("Single workouts and weekly plans, ready to go")}</span>
            </span>
            <ChevronRight size={18} aria-hidden />
          </button>
        )}
        {finished.length > 0 && (
          <button className="list-row" onClick={() => nav('/records')}>
            <Trophy size={20} aria-hidden />
            <span className="grow">
              <span className="home-link-t">{t("Records")}</span>
              <span className="tiny muted">{t("Your best lifts for every exercise")}</span>
            </span>
            <ChevronRight size={18} aria-hidden />
          </button>
        )}
        <button className="list-row" onClick={() => nav('/exercises')}>
          <BookOpen size={20} aria-hidden />
          <span className="grow">
            <span className="home-link-t">{t("Exercises")}</span>
            <span className="tiny muted">{t("Your exercise list, photos, setup notes and records")}</span>
          </span>
          <ChevronRight size={18} aria-hidden />
        </button>
        <button className="list-row" onClick={() => nav('/help')}>
          <HelpCircle size={20} aria-hidden />
          <span className="grow">
            <span className="home-link-t">{t("How it works")}</span>
            <span className="tiny muted">{t("Short answers about every part of GymLog")}</span>
          </span>
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  )
}
