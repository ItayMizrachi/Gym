import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Pencil, Plus, Zap, ChevronRight, Sparkles, Flame, ArrowUp, ArrowDown, Dumbbell, CalendarDays, Trophy, LayoutGrid, ChevronDown, Folder, FolderInput, MoreHorizontal, HelpCircle, BookOpen } from 'lucide-react'
import { useStore } from '../lib/store'
import { buildStarterPlan } from '../lib/seed'
import { startEmptySession, startSessionFromWorkout } from '../lib/actions'
import { primeAudio } from '../lib/beep'
import { fmtDate } from '../lib/format'
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
  suggestNextWorkout,
  summarizeSession,
  trainingDays,
  weeklyStreak
} from '../lib/stats'
import { CalendarHeat } from '../components/CalendarHeat'
import { MoveToFolderSheet, RenameFolderSheet } from '../components/FolderSheet'
import { groupByFolder } from '../lib/folders'
import '../styles/insights.css'
import '../styles/programs.css'

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

/** "Lower A (Sunday)" → ["Lower A", "Sunday"] */
function splitName(name: string): [string, string] {
  const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/)
  return m && m[1] ? [m[1], m[2]] : [name, '']
}

function Delta({ now, before, fmt }: { now: number; before: number; fmt: (n: number) => string }) {
  const d = now - before
  if (Math.abs(d) < 0.5) return <div className="delta muted">same as last week</div>
  return (
    <div className={`delta ${d > 0 ? 'up' : 'down'}`}>
      {d > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {fmt(Math.abs(d))} vs last week
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
  const db = useStore((s) => s.db)
  const save = useStore((s) => s.save)
  const user = useStore((s) => s.user)
  const repoMode = useStore((s) => s.repo?.mode)
  const [muscleWeek, setMuscleWeek] = useState<'this' | 'last'>('this')
  const [moving, setMoving] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [folded, setFolded] = useState<string[]>(loadFolds)
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
  const finished = useMemo(() => finishedSessions(db), [db])
  const next = useMemo(() => suggestNextWorkout(db), [db])
  const weeks = useMemo(() => compareWeeks(db, now), [db, now])
  const streak = useMemo(() => weeklyStreak(db, now), [db, now])
  const days = useMemo(() => trainingDays(db), [db])
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

  function start(w: Workout) {
    primeAudio()
    const id = startSessionFromWorkout(w)
    nav(`/session/${id}`)
  }

  const hour = now.getHours()
  const greeting = hour < 5 ? 'Late session?' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const hero = next && !active ? templateInfo(db, next.workout) : null
  const tw = weeks.thisWeek
  const lw = weeks.lastWeekToDate
  const scaleMax = Math.max(MUSCLE_SETS_MAX + 4, ...muscles.map((m) => m.sets + 1))
  const pct = (n: number) => `${(n / scaleMax) * 100}%`

  return (
    <div className="stack ins-home" style={{ gap: 16 }}>
      <div className="page-head">
        <div className="grow">
          <h1>{greeting}</h1>
          <div className="sub">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        {streak.current > 0 && (
          <div
            className={`streak-pill${streak.thisWeekDone ? '' : ' pending'}`}
            title={`Best streak: ${streak.best} weeks`}
            aria-label={`${streak.current}-week training streak`}
          >
            <Flame size={16} aria-hidden />
            <span>{streak.current}</span>
            <span className="u">wk streak</span>
          </div>
        )}
        <button className="btn icon ghost ph-help" onClick={() => nav('/help')} aria-label="How it works">
          <HelpCircle size={22} />
        </button>
      </div>

      {repoMode === 'local' && (
        <div className="card small" style={{ borderColor: '#5c4a0f', color: 'var(--warn)' }}>
          Demo mode: data is saved only on this device. Sign in (Settings) to sync across devices.
        </div>
      )}

      {active && (
        <div className="banner stack" style={{ gap: 8 }}>
          <div className="row">
            <div className="grow">
              <div style={{ fontWeight: 750, fontSize: 17 }}>{active.name}</div>
              <div className="small muted">Workout in progress · started {fmtDate(active.started_at)}</div>
            </div>
          </div>
          <button
            className="btn primary block"
            onClick={() => {
              primeAudio()
              nav(`/session/${active.id}`)
            }}
          >
            <Play size={18} /> Resume workout
          </button>
        </div>
      )}

      {workouts.length === 0 ? (
        <div className="card welcome stack">
          <div className="welcome-mark">
            <Dumbbell size={26} />
          </div>
          <h2>Pick a program to begin</h2>
          <div className="muted">Choose a ready-made program, or build your own workouts. Then start one and log each set as you go.</div>
          <ol className="welcome-steps">
            <li>
              <b>Pick a program.</b> Ready-made plans for 3 to 6 days a week, at the gym or at home.
            </li>
            <li>
              <b>Train.</b> Weights fill in from last time; tick each set to start the rest timer.
            </li>
            <li>
              <b>Watch it add up.</b> Weekly sets, streaks and records appear here.
            </li>
          </ol>
          <button className="btn primary block" onClick={() => nav('/programs')}>
            <LayoutGrid size={18} /> Browse programs
          </button>
          <button className="btn block" onClick={loadStarter}>
            <Sparkles size={18} /> Load my starter plan (4 days)
          </button>
          <button className="btn block" onClick={newWorkout}>
            <Plus size={18} /> Create a workout
          </button>
        </div>
      ) : (
        hero &&
        next && (
          <div className="card hero">
            <div className="hero-label">
              Start your next workout
              {next.lastDone && <span className="muted"> · last done {relativeDay(next.lastDone, now)}</span>}
            </div>
            <div className="hero-name">
              {splitName(next.workout.name)[0]}
              {splitName(next.workout.name)[1] && <span className="hero-when">{splitName(next.workout.name)[1]}</span>}
            </div>
            <div className="hero-meta">
              <span>
                <b>{hero.wes.length}</b> exercises
              </span>
              <span>
                <b>{hero.sets}</b> sets
              </span>
              {hero.usual != null && (
                <span>
                  about <b>{fmtMinutes(hero.usual)}</b>
                </span>
              )}
            </div>
            <div className="hero-preview">{hero.names.join(' · ')}</div>
            <button className="btn primary block" onClick={() => start(next.workout)}>
              <Play size={18} /> Start {splitName(next.workout.name)[0]}
            </button>
          </div>
        )
      )}

      {workouts.length > 0 && finished.length === 0 && (
        <div className="card first-week">
          <CalendarDays size={22} />
          <div className="grow">
            <div style={{ fontWeight: 650 }}>Your first week starts here</div>
            <div className="small muted">Finish a workout and your weekly sets, streak and training calendar show up on this page.</div>
          </div>
        </div>
      )}

      {finished.length > 0 && (
        <>
          <section className="stack" style={{ gap: 10 }}>
            <div className="sec-head">
              <h2>This week</h2>
              <span className="small muted">
                {fmtDate(weeks.weekStart.toISOString())} – {fmtDate(addDays(weeks.weekStart, 6).toISOString())}
                {streak.best > streak.current && ` · best streak ${streak.best} wk`}
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
                <Flame size={14} /> Train once this week to keep your {streak.current}-week streak.
              </div>
            )}
          </section>

          <section className="card stack" style={{ gap: 12 }}>
            <div>
              <div className="row">
                <div className="ins-title grow">Sets per muscle</div>
                <div className="seg">
                <button className={muscleWeek === 'this' ? 'on' : ''} onClick={() => setMuscleWeek('this')}>
                  This wk
                </button>
                <button className={muscleWeek === 'last' ? 'on' : ''} onClick={() => setMuscleWeek('last')}>
                  Last wk
                  </button>
                </div>
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                Shaded band: {MUSCLE_SETS_MIN}–{MUSCLE_SETS_MAX} hard sets a week, a common growth range. Drop sets count half.
              </div>
            </div>
            {muscles.length === 0 ? (
              <div className="small muted">No sets logged yet.</div>
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

          <section className="card">
            <CalendarHeat
              days={days}
              now={now}
              onDay={(_, d) => nav(d.sessionIds.length === 1 ? `/history/${d.sessionIds[0]}` : '/history')}
            />
          </section>
        </>
      )}

      {workouts.length > 0 && (
        <section className="stack" style={{ gap: 8 }} aria-label="Your workouts">
          <div className="sec-head">
            <h2>Your workouts</h2>
            <span className="small muted">
              {workouts.length} workout{workouts.length === 1 ? '' : 's'}
            </span>
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
                      <h2 className="ellipsis">{g.label}</h2>
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
                  <div className="tlist">
                    {g.workouts.map((w) => {
                      const info = templateInfo(db, w)
                      const isNext = next?.workout.id === w.id
                      return (
                        <div key={w.id} className={`trow${isNext ? ' next' : ''}`}>
                          <button className="trow-main" onClick={() => nav(`/workout/${w.id}`)} aria-label={`Edit ${w.name}`}>
                            <div className="trow-name ellipsis">{w.name}</div>
                            <div className="small muted ellipsis">
                              {info.wes.length} exercises · {info.sets} sets
                              {info.last ? ` · last done ${relativeDay(sessionDate(info.last), now)}` : ' · not done yet'}
                            </div>
                          </button>
                          <button className="btn icon sm ghost" onClick={() => setMoving(w.id)} aria-label={`Move ${w.name} to a folder`}>
                            <FolderInput size={16} />
                          </button>
                          <button className="btn icon sm ghost" onClick={() => nav(`/workout/${w.id}`)} aria-label={`Edit ${w.name}`}>
                            <Pencil size={16} />
                          </button>
                          <button
                            className="btn icon sm"
                            disabled={!!active || info.wes.length === 0}
                            onClick={() => start(w)}
                            aria-label={`Start ${w.name}`}
                          >
                            <Play size={16} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}
      {moving && <MoveToFolderSheet workoutId={moving} onClose={() => setMoving(null)} />}
      {renaming && <RenameFolderSheet folder={renaming} onClose={() => setRenaming(null)} />}

      <div className="row ins-actions">
        {workouts.length > 0 && (
          <button className="btn grow" onClick={newWorkout}>
            <Plus size={18} /> New workout
          </button>
        )}
        <button
          className="btn grow"
          disabled={!!active}
          onClick={() => {
            primeAudio()
            nav(`/session/${startEmptySession()}`)
          }}
        >
          <Zap size={18} /> Empty workout
        </button>
      </div>
      <div className="list-group home-links">
        {workouts.length > 0 && (
          <button className="list-row" onClick={() => nav('/programs')}>
            <LayoutGrid size={20} aria-hidden />
            <span className="grow">
              <span className="home-link-t">Browse programs</span>
              <span className="tiny muted">Add a ready-made plan to your workouts</span>
            </span>
            <ChevronRight size={18} aria-hidden />
          </button>
        )}
        <button className="list-row" onClick={() => nav('/exercises')}>
          <BookOpen size={20} aria-hidden />
          <span className="grow">
            <span className="home-link-t">Exercises</span>
            <span className="tiny muted">Your exercise list, photos, setup notes and records</span>
          </span>
          <ChevronRight size={18} aria-hidden />
        </button>
        <button className="list-row" onClick={() => nav('/help')}>
          <HelpCircle size={20} aria-hidden />
          <span className="grow">
            <span className="home-link-t">How it works</span>
            <span className="tiny muted">Short answers about every part of GymLog</span>
          </span>
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
      {finished.length > 0 && (
        <button className="btn ghost sm" onClick={() => nav('/history')}>
          <Trophy size={16} /> See history and records <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
