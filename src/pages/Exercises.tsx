import { useEffect, useMemo, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RotateCw, Search, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { EQUIPMENT, Exercise, MUSCLES, trackingOf } from '../lib/types'
import { NewExerciseForm } from '../components/ExercisePicker'
import { filterExercises, recentExerciseIds } from '../lib/exerciseFilters'
import { Sheet } from '../components/ui'
import { ThumbButton } from '../components/ExerciseHowTo'
import { FilterPill, LibRow, LibSkeleton } from '../components/Library'
import { LIB_LEVELS, linkedLibIds, searchLibrary, useLibrary } from '../lib/library'
import { ensureLibraryExercise } from '../lib/libraryActions'
import { priorSets, recordsFor } from '../lib/pr'
import { fmtKg } from '../lib/format'
import '../styles/library.css'

type Tab = 'all' | 'mine' | 'library'
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'library', label: 'Library' }
]
const PAGE = 40

export default function Exercises() {
  const nav = useNavigate()
  const db = useStore((s) => s.db)
  const toast = useStore((s) => s.toast)
  // search and filters live in the URL, so coming back from a detail page keeps them
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'all'
  const q = params.get('q') ?? ''
  const muscle = params.get('muscle') ?? 'All'
  const eq = params.get('eq') ?? 'All'
  const level = params.get('level') ?? 'All'
  const set = (k: string, v: string, empty: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (v === empty) n.delete(k)
        else n.set(k, v)
        return n
      },
      { replace: true }
    )
  const [creating, setCreating] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  useEffect(() => setLimit(PAGE), [q, muscle, eq, level, tab])

  const { list: lib, error: libError, retry } = useLibrary(tab !== 'mine')
  const added = useMemo(() => linkedLibIds(db.exercises), [db.exercises])

  const records = useMemo(() => {
    const m = new Map<string, ReturnType<typeof recordsFor>>()
    for (const e of db.exercises) m.set(e.id, recordsFor(priorSets(db, e.id)))
    return m
  }, [db])

  const filtering = !!q.trim() || muscle !== 'All' || eq !== 'All'
  const mine = useMemo(() => filterExercises(db.exercises, { q, muscle, equipment: eq }), [db.exercises, q, muscle, eq])
  const recent = useMemo(
    () =>
      filtering || tab !== 'mine'
        ? []
        : recentExerciseIds(db.sessions, 4)
            .map((id) => db.exercises.find((e) => e.id === id))
            .filter((e): e is Exercise => !!e),
    [db.sessions, db.exercises, filtering, tab]
  )
  const groups = useMemo(() => {
    const sorted = [...mine].sort((a, b) => a.name.localeCompare(b.name))
    const order = [...MUSCLES, ...new Set(sorted.map((e) => e.muscle).filter((m) => !MUSCLES.includes(m)))]
    return order.map((m) => ({ muscle: m, items: sorted.filter((e) => e.muscle === m) })).filter((g) => g.items.length)
  }, [mine])
  const libMatches = useMemo(() => (lib ? searchLibrary(lib, { q, muscle, equipment: eq, level }) : []), [lib, q, muscle, eq, level])

  const row = (e: Exercise, withMuscle = false) => {
    const rec = records.get(e.id)
    const best = trackingOf(e) === 'weight_reps' && rec?.bestE1rm ? Math.round(rec.bestE1rm.value) : null
    const bestSet = rec?.heaviest
      ? rec.heaviest.weight > 0
        ? `Best ${fmtKg(rec.heaviest.weight)} kg × ${rec.heaviest.reps}`
        : `Best ${Math.max(...rec.repTable.map((r) => r.reps))} reps`
      : ''
    // the best set is on the right (est. max) or, for reps-only moves, the only extra on this line
    const meta = [withMuscle ? e.muscle : '', e.equipment, best == null ? bestSet : ''].filter(Boolean).join(' · ')
    return (
      <div key={e.id} className="lib-row">
        <ThumbButton exercise={e} size={48} />
        <button className="list-row" onClick={() => nav(`/exercise/${e.id}`)}>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="title clamp2">{e.name}</div>
          <div className="meta ellipsis">{meta || 'Not logged yet'}</div>
        </div>
        {best != null && (
          <div className="trail">
            <div className="kpi">
              {best}
              <span className="muted" style={{ fontSize: 13, marginLeft: 2 }}>
                kg
              </span>
            </div>
            <div className="tiny muted">est. max</div>
          </div>
        )}
        </button>
      </div>
    )
  }

  const showMine = tab !== 'library'
  const showLib = tab !== 'mine'
  // only while searching or filtering: an empty list without a search has its own empty state above
  const nothing = (filtering || level !== 'All') && (!showMine || !mine.length) && (!showLib || (lib && !libMatches.length))

  return (
    <div className="stack xl-page" style={{ gap: 'var(--s3)' }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div className="grow">
          <h1>{tr("Exercises")}</h1>
          <div className="small muted" style={{ marginTop: 2 }}>
            Your exercises and a library of {lib ? lib.length : '870+'} with photos.
          </div>
        </div>
        <button className="btn primary icon" onClick={() => setCreating(true)} aria-label={tr("Create your own exercise")}>
          <Plus size={22} />
        </button>
      </div>

      <div className="search">
        <Search size={18} />
        <input
          className="input"
          type="search"
          enterKeyHint="search"
          placeholder={tr("Search exercises")}
          aria-label={tr("Search exercises")}
          value={q}
          onChange={(e) => set('q', e.target.value, '')}
        />
        {q && (
          <button className="clear" onClick={() => set('q', '', '')} aria-label={tr("Clear search")}>
            <X size={18} />
          </button>
        )}
      </div>

      <div className="seg lib-seg" role="group" aria-label={tr("Which exercises")}>
        {TABS.map((t) => (
          <button key={t.id} aria-pressed={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => set('tab', t.id, 'all')} style={{ flex: 1 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="lib-filter-row" role="group" aria-label={tr("Filters")}>
        <FilterPill label={tr("Muscle")} allLabel="All muscles" value={muscle} options={MUSCLES} onChange={(v) => set('muscle', v, 'All')} />
        <FilterPill label={tr("Equipment")} allLabel="All equipment" value={eq} options={EQUIPMENT} onChange={(v) => set('eq', v, 'All')} />
        {showLib && <FilterPill label={tr("Level")} allLabel="All levels" value={level} options={LIB_LEVELS} onChange={(v) => set('level', v, 'All')} />}
        {(muscle !== 'All' || eq !== 'All' || level !== 'All') && (
          <button
            className="lib-pill"
            onClick={() =>
              setParams(
                (p) => {
                  const n = new URLSearchParams(p)
                  ;['muscle', 'eq', 'level'].forEach((k) => n.delete(k))
                  return n
                },
                { replace: true }
              )
            }
          >
            <X size={16} aria-hidden /> {tr("Clear")}
          </button>
        )}
      </div>

      {showMine && (
        <>
          {tab === 'all' && (
            <div className="section-label" style={{ marginBottom: 0 }}>
              <span>{tr("My exercises")}</span>
              <span className="count lib-count">{mine.length}</span>
            </div>
          )}
          {!db.exercises.length ? (
            filtering ? null : tab === 'all' ? (
              <div className="row small muted" style={{ justifyContent: 'space-between', padding: '0 2px' }}>
                <span>{tr("None yet. Tap Add on any exercise below.")}</span>
                <button className="btn sm" onClick={() => setCreating(true)}>
                  <Plus size={16} /> {tr("Create your own")}
                </button>
              </div>
            ) : (
              <div className="empty">
                <div style={{ fontWeight: 600 }}>{tr("No exercises of your own yet")}</div>
                <div className="small muted">{tr("Add any exercise from the library, or create your own with a photo of the machine.")}</div>
                <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button className="btn primary" onClick={() => set('tab', 'library', 'all')}>
                    {tr("Browse the library")}
                  </button>
                  <button className="btn" onClick={() => setCreating(true)}>
                    <Plus size={18} /> {tr("Create your own")}
                  </button>
                </div>
              </div>
            )
          ) : tab === 'mine' ? (
            <>
              {recent.length > 0 && (
                <section>
                  <div className="section-label">
                    <span>{tr("Recent")}</span>
                  </div>
                  <div className="list-group" style={{ ['--inset' as string]: '74px' }}>
                    {recent.map((e) => row(e, true))}
                  </div>
                </section>
              )}
              {groups.map((g) => (
                <section key={g.muscle}>
                  <div className="section-label">
                    <span>{g.muscle}</span>
                    <span className="count lib-count">{g.items.length}</span>
                  </div>
                  <div className="list-group" style={{ ['--inset' as string]: '74px' }}>
                    {g.items.map((e) => row(e))}
                  </div>
                </section>
              ))}
            </>
          ) : (
            mine.length > 0 && (
              <div className="list-group" style={{ ['--inset' as string]: '74px' }}>
                {mine.map((e) => row(e, true))}
              </div>
            )
          )}
          {tab === 'all' && db.exercises.length > 0 && !mine.length && !nothing && <div className="small muted" style={{ padding: '0 2px' }}>{tr("None of yours match.")}</div>}
        </>
      )}

      {showLib && (
        <section>
          <div className="section-label" style={{ marginTop: tab === 'all' ? 'var(--s3)' : undefined }}>
            <span>{tr("Library")}</span>
            {lib && <span className="count lib-count">{libMatches.length}</span>}
          </div>
          {libError ? (
            <div className="empty">
              <div style={{ fontWeight: 600 }}>{tr("The library could not load")}</div>
              <div className="small muted">{tr("Check your connection and try again.")}</div>
              <button className="btn" onClick={retry}>
                <RotateCw size={16} /> {tr("Try again")}
              </button>
            </div>
          ) : !lib ? (
            <LibSkeleton />
          ) : (
            libMatches.length > 0 && (
              <>
                <div className="list-group" style={{ ['--inset' as string]: '74px' }}>
                  {libMatches.slice(0, limit).map((e) => (
                    <LibRow
                      key={e.id}
                      e={e}
                      added={added.has(e.id)}
                      onOpen={() => nav(`/exercise/lib:${encodeURIComponent(e.id)}`)}
                      onAdd={() => {
                        ensureLibraryExercise(e)
                        toast({ kind: 'info', text: 'Added to my exercises', sub: e.name })
                      }}
                    />
                  ))}
                </div>
                {libMatches.length > limit && (
                  <button className="btn lib-more" onClick={() => setLimit((l) => l + PAGE)}>
                    Show more ({libMatches.length - limit} left)
                  </button>
                )}
                <div className="lib-note">
                  Library photos and instructions from{' '}
                  <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">
                    free-exercise-db
                  </a>{' '}
                  (public domain).
                </div>
              </>
            )
          )}
        </section>
      )}

      {nothing && (
        <div className="empty">
          <div style={{ fontWeight: 600 }}>No exercise matches{q.trim() ? ` “${q.trim()}”` : ' these filters'}</div>
          <div className="small muted">{tr("Try fewer words or clear a filter, or create it yourself.")}</div>
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Plus size={18} /> {q.trim() ? `Create “${q.trim()}”` : 'Create your own'}
          </button>
        </div>
      )}

      {creating && (
        <Sheet title={tr("New exercise")} onClose={() => setCreating(false)}>
          <NewExerciseForm
            initialName={q}
            onCreated={(e) => {
              setCreating(false)
              nav(`/exercise/${e.id}`)
            }}
          />
        </Sheet>
      )}
    </div>
  )
}
