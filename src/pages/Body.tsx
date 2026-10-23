import { useMemo, useState } from 'react'
import { Camera, Plus, Ruler, Scale, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Metric } from '../lib/types'
import { LineChart } from '../components/Chart'
import { Confirm, Empty, ImageField, NumInput, Sheet, Thumb } from '../components/ui'
import { fmtDate, fmtDateLong, fmtKg } from '../lib/format'
import { nowIso, todayStr, uid } from '../lib/uid'
import { PhotoCompare } from '../components/PhotoCompare'
import { PhotoTile, PhotoViewer } from '../components/PhotoViewer'
import { useNavigate } from 'react-router-dom'
import { MeasureFields, MeasureValues, MeasuresCard } from '../components/Measures'
import { cleanMeasures, measureInfo, rememberUsedFields } from '../lib/measures'
import '../styles/progress.css'

const DAY = 86400000
const ts = (d: string) => new Date(d + 'T12:00:00').getTime()

function movingAvg(entries: Metric[], days = 7) {
  return entries.map((e) => {
    const t = ts(e.date)
    const win = entries.filter((x) => ts(x.date) <= t && ts(x.date) > t - days * DAY)
    return { t, y: win.reduce((a, x) => a + (x.weight_kg ?? 0), 0) / win.length }
  })
}

/** kg per week from a least-squares line through the last `days` days of entries */
function weeklyRate(entries: Metric[], days = 28): number | null {
  if (!entries.length) return null
  const end = ts(entries[entries.length - 1].date)
  const pts = entries.filter((e) => ts(e.date) >= end - days * DAY).map((e) => ({ x: (ts(e.date) - end) / DAY, y: e.weight_kg! }))
  if (pts.length < 3) return null
  const n = pts.length
  const mx = pts.reduce((a, p) => a + p.x, 0) / n
  const my = pts.reduce((a, p) => a + p.y, 0) / n
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0)
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0)
  if (den === 0) return null
  return (num / den) * 7
}

export function EntrySheet({ entry, onClose, measuresOpen = false }: { entry: Metric | null; onClose: () => void; measuresOpen?: boolean }) {
  const metrics = useStore((s) => s.db.metrics)
  const save = useStore((s) => s.save)
  const remove = useStore((s) => s.remove)
  const user = useStore((s) => s.user)
  const [date, setDate] = useState(entry?.date ?? todayStr())
  const [weight, setWeight] = useState<number | null>(entry?.weight_kg ?? metrics.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.weight_kg ?? null)
  const [note, setNote] = useState(entry?.note ?? '')
  const [photo, setPhoto] = useState<string | null>(entry?.photo_path ?? null)
  const [measures, setMeasures] = useState<MeasureValues>(entry?.measures ?? {})
  const [showMeasures, setShowMeasures] = useState(measuresOpen || !!cleanMeasures(entry?.measures ?? {}))
  const [confirm, setConfirm] = useState(false)
  const cleaned = cleanMeasures(measures)
  const repo = useStore((s) => s.repo)
  const original = entry?.photo_path ?? null

  /** closing without saving: throw away a photo uploaded in this sheet */
  function cancel() {
    if (photo && photo !== original) void repo?.deleteImage(photo)
    onClose()
  }

  function commit() {
    // one entry per day: logging the same date again updates it
    const existing = entry ?? metrics.find((m) => m.date === date)
    // logging a new entry on a day that has one adds to its measurements instead of dropping them
    const merged = entry ? cleaned : cleanMeasures({ ...(existing?.measures ?? {}), ...(cleaned ?? {}) })
    const row: Metric = {
      id: existing?.id ?? uid(),
      user_id: existing?.user_id ?? user?.id ?? 'local',
      date,
      weight_kg: weight,
      note,
      photo_path: photo,
      // only send the column when there is something to store, so saves keep working before the
      // database upgrade (supabase/schema.sql) has been run
      ...(merged || existing?.measures ? { measures: merged } : {}),
      created_at: existing?.created_at ?? nowIso()
    }
    if (cleaned) rememberUsedFields(Object.keys(cleaned))
    save('metrics', row)
    if (original && original !== photo) void repo?.deleteImage(original)
    onClose()
  }

  return (
    <Sheet title={entry ? 'Edit entry' : measuresOpen ? 'Log measurements' : 'Log body weight'} onClose={cancel}>
      <div className="stack">
        <div className="weigh-in">
          <NumInput className="weigh-num" value={weight} onChange={setWeight} placeholder="0.0" ariaLabel="Weight in kg" />
          <span className="weigh-unit">kg</span>
        </div>
        <label className="field">
          Date
          <input className="input" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} />
        </label>
        <label className="field">
          Note
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="morning, after breakfast, flexed…" />
        </label>
        <ImageField path={photo} folder="body" onChange={(p) => {
          // a photo uploaded earlier in this same sheet is replaced: remove it now, the saved one stays until Save
          if (photo && photo !== original) void repo?.deleteImage(photo)
          setPhoto(p)
        }} label="Add progress photo" autoDelete={false} />
        <MeasureFields
          metrics={metrics}
          date={date}
          values={measures}
          onChange={setMeasures}
          open={showMeasures}
          onToggle={() => setShowMeasures(!showMeasures)}
        />
        <button className="btn primary block" disabled={weight == null && !photo && !cleaned} onClick={commit}>
          Save
        </button>
        {entry && (
          <button className="btn danger" onClick={() => setConfirm(true)}>
            <Trash2 size={16} /> Delete entry
          </button>
        )}
      </div>
      {confirm && entry && (
        <Confirm
          title="Delete this entry?"
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            remove('metrics', entry.id)
            if (original) void repo?.deleteImage(original)
            if (photo && photo !== original) void repo?.deleteImage(photo)
            onClose()
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </Sheet>
  )
}

/** "Waist 84 · Chest 102 · note" line under an entry */
function entryMeta(m: Metric): string {
  const parts = Object.entries(cleanMeasures(m.measures ?? {}) ?? {}).map(([k, v]) => {
    const info = measureInfo(k)
    return `${info?.short ?? k} ${v}${info?.unit === '%' ? '%' : ''}`
  })
  return [...parts, m.note].filter(Boolean).join(' · ')
}

export default function Body() {
  const metrics = useStore((s) => s.db.metrics)
  const [editing, setEditing] = useState<Metric | 'new' | 'measures' | null>(null)
  const [range, setRange] = useState<'30' | '90' | 'all'>('90')
  const [viewing, setViewing] = useState<number | null>(null)
  const nav = useNavigate()

  const entries = useMemo(
    () => metrics.filter((m) => m.weight_kg != null).sort((a, b) => a.date.localeCompare(b.date)),
    [metrics]
  )
  const shown = useMemo(() => {
    if (range === 'all' || !entries.length) return entries
    const cut = Date.now() - Number(range) * DAY
    return entries.filter((e) => ts(e.date) >= cut)
  }, [entries, range])
  const withPhotos = useMemo(() => metrics.filter((m) => m.photo_path).sort((a, b) => a.date.localeCompare(b.date)), [metrics])
  const newestFirst = useMemo(() => [...withPhotos].reverse(), [withPhotos])
  const all = useMemo(() => [...metrics].sort((a, b) => b.date.localeCompare(a.date)), [metrics])

  const cur = entries[entries.length - 1]
  const first = entries[0]
  const avgNow = entries.length ? movingAvg(entries).slice(-1)[0].y : null
  const ago = (days: number) => {
    if (!cur) return null
    const target = ts(cur.date) - days * DAY
    const older = entries.filter((e) => ts(e.date) <= target)
    return older.length ? older[older.length - 1] : null
  }
  const d7 = ago(7)
  const d30 = ago(30)
  const rate = weeklyRate(entries)
  const delta = (a: number | null | undefined, b: number | null | undefined) =>
    a != null && b != null ? Math.round((a - b) * 10) / 10 : null
  const fmtDelta = (v: number | null) => (v == null ? '–' : `${v > 0 ? '+' : ''}${v}`)

  const prevOf = (m: Metric) => {
    const i = entries.findIndex((e) => e.id === m.id)
    return i > 0 ? entries[i - 1] : null
  }
  // gaining or losing weight is not good or bad by itself (it depends on the goal): keep the rate neutral, not green/red
  const rateClass = ''

  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>Body</h1>
        <button className="btn primary" onClick={() => setEditing('new')}>
          <Plus size={18} /> Log weight
        </button>
      </div>

      {!entries.length ? (
        <Empty
          icon={<Scale size={24} />}
          title="Track your weight"
          text="Log your weight every day. The chart smooths it with a 7-day average so one salty dinner does not scare you."
        >
          <button className="btn primary" onClick={() => setEditing('new')}>
            <Plus size={18} /> Log first entry
          </button>
        </Empty>
      ) : (
        <>
          <div className="card stack" style={{ gap: 'var(--s3)' }}>
            <div className="body-hero">
              <div>
                <div className="small muted">Latest · {fmtDate(cur.date)}</div>
                <div className="big">
                  {fmtKg(cur.weight_kg)}
                  <span className="u">kg</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="kpi" style={{ fontSize: 26 }}>
                  {avgNow != null ? fmtKg(Math.round(avgNow * 10) / 10) : '–'}
                </div>
                <div className="tiny muted">7-day average</div>
                <div className={`kpi ${rateClass}`} style={{ fontSize: 18, marginTop: 6 }}>
                  {rate == null ? '–' : `${rate > 0 ? '+' : ''}${(Math.round(rate * 100) / 100).toFixed(2)}`}
                  <span className="tiny muted" style={{ fontFamily: 'var(--body)', marginLeft: 4 }}>kg/wk</span>
                </div>
              </div>
            </div>
            <div className="delta-row">
              <div>
                <div className="kpi">{fmtDelta(delta(cur.weight_kg, d7?.weight_kg))}</div>
                <div className="l">vs 7 days ago</div>
              </div>
              <div>
                <div className="kpi">{fmtDelta(delta(cur.weight_kg, d30?.weight_kg))}</div>
                <div className="l">vs 30 days ago</div>
              </div>
              <div>
                <div className="kpi">{fmtDelta(delta(cur.weight_kg, first.weight_kg))}</div>
                <div className="l">since {fmtDate(first.date)}</div>
              </div>
            </div>
          </div>

          <div className="card stack">
            <div className="card-head">
              <h2>Trend</h2>
              <div className="seg">
                {(['30', '90', 'all'] as const).map((r) => (
                  <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
                    {r === 'all' ? 'All' : `${r}d`}
                  </button>
                ))}
              </div>
            </div>
            <LineChart
              unit=" kg"
              digits={1}
              series={[
                { name: 'Daily', color: '#6f6e69', points: shown.map((e) => ({ t: ts(e.date), y: e.weight_kg! })), width: 1.4 },
                {
                  name: '7-day avg',
                  color: '#f0b92a',
                  points: movingAvg(entries).filter((p) => shown.some((s) => ts(s.date) === p.t)),
                  dots: false,
                  width: 2.6
                }
              ]}
            />
          </div>
        </>
      )}

      <MeasuresCard metrics={metrics} onLog={() => setEditing('measures')} />

      {withPhotos.length >= 2 && <PhotoCompare photos={withPhotos} onOpen={(m) => setViewing(newestFirst.indexOf(m))} />}
      {withPhotos.length > 0 && (
        <section>
          <div className="section-label">
            <span>Photos</span>
            <span className="count">{withPhotos.length}</span>
          </div>
          <div className="ph-grid">
            {newestFirst.slice(0, 3).map((m, i) => (
              <PhotoTile key={m.id} m={m} onOpen={() => setViewing(i)} />
            ))}
          </div>
          {withPhotos.length > 3 && (
            <button className="btn block" style={{ marginTop: 'var(--s3)' }} onClick={() => nav('/body/photos')}>
              See all {withPhotos.length} photos
            </button>
          )}
        </section>
      )}

      {all.length > 0 && (
        <section>
          <div className="section-label">
            <span>Entries</span>
            <span className="count">{all.length}</span>
          </div>
          <div className="list-group">
            {all.map((m) => {
              const p = m.weight_kg != null ? prevOf(m) : null
              const d = p ? delta(m.weight_kg, p.weight_kg) : null
              return (
                <button key={m.id} className="list-row" style={{ minHeight: 56 }} onClick={() => setEditing(m)}>
                  {m.photo_path && <Thumb path={m.photo_path} size={40} />}
                  <div className="grow">
                    <div className="title entry-date">{fmtDateLong(m.date)}</div>
                    {(m.note || m.measures) && <div className="meta ellipsis">{entryMeta(m)}</div>}
                  </div>
                  <div className="trail">
                    <div className="kpi">
                      {m.weight_kg != null ? (
                        fmtKg(m.weight_kg)
                      ) : m.photo_path ? (
                        <Camera size={18} className="muted" aria-label="Photo only" />
                      ) : (
                        <Ruler size={18} className="muted" aria-label="Measurements only" />
                      )}
                      {m.weight_kg != null && <span className="muted" style={{ fontSize: 13, marginLeft: 2 }}>kg</span>}
                    </div>
                    {d != null && d !== 0 && <div className="tiny muted tnum">{fmtDelta(d)}</div>}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {viewing != null && (
        <PhotoViewer
          photos={newestFirst}
          start={viewing}
          onClose={() => setViewing(null)}
          onEdit={(m) => {
            setViewing(null)
            setEditing(m)
          }}
        />
      )}
      {editing && (
        <EntrySheet
          entry={editing === 'new' || editing === 'measures' ? null : editing}
          measuresOpen={editing === 'measures'}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
