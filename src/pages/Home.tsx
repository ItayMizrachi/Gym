import { daysFromName, daysLabel, plannedDays, todaysWorkout } from '../lib/plan'
import { lang, t, tm } from '../lib/i18n'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Plus, Zap, ChevronRight, Sparkles, Flame, ArrowUp, ArrowDown, Dumbbell, Trophy, LayoutGrid, ChevronDown, Folder, MoreHorizontal, HelpCircle, BookOpen, PencilLine, Users, Copy, Trash2, Layers } from 'lucide-react'
import { useCoachRole } from '../lib/coach'
import { upNext } from '../lib/upNext'
import { WeeklyRecap } from '../components/WeeklyRecap'

/** "Quads" / "Quads and Glutes" (two at most, the line stays short) */
const listMuscles = (m: string[]) => (m.length <= 1 ? tm(m[0] ?? '') : t('{a} and {b}', { a: tm(m[0]), b: tm(m[1]) }))
import { useStore } from '../lib/store'
import { buildStarterPlan } from '../lib/seed'
import { duplicateWorkout, removeWorkout, startEmptySession, startSessionFromWorkout } from '../lib/actions'
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
import { ProgramUpdateCard } from '../components/ProgramUpdateCard'
import { FolderGroup, groupByFolder, makeCurrent } from '../lib/folders'
import { Confirm, Sheet } from '../components/ui'
import { WeekLine } from '../components/GoalRing'
import { RecoveryLine } from '../components/RecoveryCard'
import { StartChecklist } from '../components/StartChecklist'
import { useAchievementToasts } from '../components/Achievements'
import '../styles/insights.css'
import '../styles/programs-nav.css'
import '../styles/home.css'
import '../styles/coach.css'

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


/** collapsed folder headers on the Train tab (this device only) */
const FOLDS_KEY = 'gymlog:folds'
/** "Other programs" starts shut; this key in the fold list means it is open (folder names never start with a space) */
const OTHERS = ' others'
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
  const [renaming, setRenaming] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  /** the program 'Add a workout' was tapped in ('' = single workouts) */
  const [addTo, setAddTo] = useState('')
  /** the workout whose ⋯ menu is open, and one waiting for 'Delete?' */
  const [menuFor, setMenuFor] = useState<Workout | null>(null)
  const [deleting, setDeleting] = useState<Workout | null>(null)
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
  // the current program on top; the rest fold away under "Other programs" (Folder ⋯ → Make this my current program)
  const liveGroups = useMemo(() => groupByFolder(db.workouts.filter((w) => !w.shelved)), [db.workouts])
  const shelvedGroups = useMemo(() => groupByFolder(db.workouts.filter((w) => w.shelved)), [db.workouts])
  const shelvedCount = shelvedGroups.reduce((n, g) => n + g.workouts.length, 0)
  const active = db.sessions.find((s) => !s.finished_at)
  const activeDone = active ? active.data.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0) : 0
  const activeTotal = active ? active.data.exercises.reduce((a, e) => a + e.sets.length, 0) : 0
  const finished = useMemo(() => finishedSessions(db), [db])
  // a workout planned for today wins over the rotation suggestion
  const planned = useMemo(() => todaysWorkout(db), [db])
  // planned for today, else the rotation, unless its muscles are still recovering (src/lib/upNext.ts)
  const next = useMemo(() => upNext(db, now), [db, now])
  const streak = useMemo(() => weeklyStreak(db, now), [db, now])
  // the program Up next comes from leads, single workouts and other folders follow
  const groups = useMemo(() => {
    const i = next ? liveGroups.findIndex((g) => g.workouts.some((w) => w.id === next.workout.id)) : -1
    return i > 0 ? [liveGroups[i], ...liveGroups.filter((_, j) => j !== i)] : liveGroups
  }, [liveGroups, next])
  const othersOpen = folded.includes(OTHERS)

  function loadStarter() {
    const plan = buildStarterPlan(user?.id ?? 'local', db.exercises, db.workouts.length)
    plan.exercises.forEach((e) => save('exercises', e))
    plan.workouts.forEach((w) => save('workouts', w))
    plan.workout_exercises.forEach((w) => save('workout_exercises', w))
  }

  function newWorkout(folder = '') {
    const id = uid()
    save('workouts', { id, user_id: user?.id ?? 'local', name: 'New workout', notes: '', position: db.workouts.length, created_at: nowIso(), ...(folder ? { folder } : {}) })
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

  const [heroName, heroWhen] = next ? splitName(next.workout.name) : ['', '']

  // this week against the goal + muscle recovery: two short lines at the foot of the hero
  const weekRows = workouts.length > 0 && (
    <div className="hm-foot">
      <WeekLine />
      <RecoveryLine />
    </div>
  )

  /** "My workouts" (no folder) reads as single workouts next to programs */
  const groupName = (g: FolderGroup) => (g.folder ? g.folder : t('Single workouts'))

  function folderBlock(g: FolderGroup, withHead: boolean, shelved = false) {
    const shut = false
    return (
      <div key={g.label} className="prog-block">
        {withHead && (
          <div className="prog-head">
            <h2 className="ellipsis grow">{groupName(g)}</h2>
            {shelved && (
              <button className="btn sm accent-soft" onClick={() => makeCurrent(db.workouts, g.folder).forEach((w) => save('workouts', w))}>
                {t('Make current')}
              </button>
            )}
            {/* rename, switch program, put away: everything about the program in one menu */}
            <button className="btn icon sm ghost" onClick={() => setRenaming(g.folder)} aria-label={t('Program options: {f}', { f: groupName(g) })}>
              <MoreHorizontal size={20} />
            </button>
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
                  {/* edit, duplicate, delete: one menu per workout (tapping the name edits too) */}
                  <button className="btn icon sm ghost trow-more" onClick={() => setMenuFor(w)} aria-label={t('Options for {name}', { name: w.name })}>
                    <MoreHorizontal size={18} aria-hidden />
                  </button>
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
        {!shelved && (
          <button
            className="btn ghost sm fold-add"
            onClick={() => {
              setAddTo(g.folder)
              setAdding(true)
            }}
          >
            <Plus size={16} aria-hidden /> {t('Add a workout')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="stack ins-home hm" style={{ gap: 16 }}>
      <div className="page-head">
        <div className="grow">
          <h1>{greeting}</h1>
          <div className="sub">{now.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        {coachRole && (
          // a round icon next to the streak pill: the greeting and date keep the room they need
          <button className="coach-entry" onClick={() => nav('/coach')} aria-label={t('Coaching: your trainees')} title={t('Coaching')}>
            <Users size={18} aria-hidden />
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
            <button className="btn ghost" onClick={() => newWorkout()}>
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
            <button className="btn primary block hm-go" onClick={() => start(next.workout)} disabled={hero.wes.length === 0}>
              <Play size={18} aria-hidden /> {t('Start {name}', { name: heroName })}
            </button>
            {weekRows}
            </div>
        )
      )}

      {!active && <WeeklyRecap />}
      {!active && <ProgramUpdateCard />}
      {workouts.length > 0 && <StartChecklist />}

      {workouts.length > 0 && (
        <section className="stack" style={{ gap: 20 }} aria-label={t("Your workouts")}>
          {groups.map((g) => folderBlock(g, true))}
          {/* other programs open and shut in place; they stay out of Up next until one is made current */}
          {shelvedGroups.length > 0 && (
            <button className="list-group list-row prog-others" onClick={() => toggleFold(OTHERS)} aria-expanded={othersOpen}>
              <span className="ico-tile y"><Layers size={18} aria-hidden /></span>
              <span className="grow">{t('Other programs')}</span>
              <span className="small muted">{shelvedGroups.length}</span>
              <ChevronDown size={18} aria-hidden className={`muted prog-others-chev${othersOpen ? ' open' : ''}`} />
            </button>
          )}
          {othersOpen && shelvedGroups.map((g) => folderBlock(g, true, true))}
        </section>
      )}
      {menuFor && (
        <Sheet title={menuFor.name} onClose={() => setMenuFor(null)}>
          <div className="list-group home-links">
            <button className="list-row" onClick={() => nav(`/workout/${menuFor.id}`)}>
              <span className="ico-tile b"><PencilLine size={18} aria-hidden /></span>
              <span className="grow">
                <span className="home-link-t">{t('Edit workout')}</span>
                <span className="tiny muted">{t('Exercises, sets, rest, days and folder')}</span>
              </span>
            </button>
            <button
              className="list-row"
              onClick={() => {
                duplicateWorkout(menuFor.id)
                setMenuFor(null)
              }}
            >
              <span className="ico-tile g"><Copy size={18} aria-hidden /></span>
              <span className="grow home-link-t">{t('Duplicate')}</span>
            </button>
            <button
              className="list-row danger"
              onClick={() => {
                setDeleting(menuFor)
                setMenuFor(null)
              }}
            >
              <span className="ico-tile r"><Trash2 size={18} aria-hidden /></span>
              <span className="grow home-link-t">{t('Delete')}</span>
            </button>
          </div>
        </Sheet>
      )}
      {deleting && (
        <Confirm
          title={t('Delete this workout?')}
          text={t('Past sessions stay in your history.')}
          confirmLabel={t('Delete')}
          danger
          onConfirm={() => removeWorkout(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
      {renaming !== null && <RenameFolderSheet folder={renaming} onClose={() => setRenaming(null)} />}
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
              <span className="ico-tile y"><Zap size={18} aria-hidden /></span>
              <span className="grow">
                <span className="home-link-t">{t("Start an empty workout")}</span>
                <span className="tiny muted">{active ? 'Finish the workout in progress first' : 'Add exercises as you go'}</span>
              </span>
              <ChevronRight size={18} aria-hidden />
            </button>
            <button className="list-row" onClick={() => newWorkout(addTo)}>
              <span className="ico-tile b"><PencilLine size={18} aria-hidden /></span>
              <span className="grow">
                <span className="home-link-t">{t("Build a new workout")}</span>
                <span className="tiny muted">{t("Pick exercises, sets and rest, then save it")}</span>
              </span>
              <ChevronRight size={18} aria-hidden />
            </button>
            <button className="list-row" onClick={() => nav('/programs')}>
              <span className="ico-tile g"><LayoutGrid size={18} aria-hidden /></span>
              <span className="grow">
                <span className="home-link-t">{t("Browse programs")}</span>
                <span className="tiny muted">{t("Single workouts and weekly plans, ready to go")}</span>
              </span>
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        </Sheet>
      )}

    </div>
  )
}
