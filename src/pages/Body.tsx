import { useMemo, useState } from 'react'
import { Camera, Plus, Ruler, Scale, Share2, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Metric } from '../lib/types'
import { LineChart } from '../components/Chart'
import { Confirm, Empty, ImageField, NumInput, Sheet, Thumb, useImageUrl } from '../components/ui'
import { fmtDate, fmtDateLong, fmtKg } from '../lib/format'
import { nowIso, todayStr, uid } from '../lib/uid'
import { renderCompareCard, shareOrDownload } from '../lib/shareCard'
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

function EntrySheet({ entry, onClose, measuresOpen = false }: { entry: Metric | null; onClose: () => void; measuresOpen?: boolean }) {
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
        <button className="btn primary" disabled={weight == null && !photo && !cleaned} onClick={commit}>
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

function PhotoSide({ m, label, photos, onPick, picking }: { m: Metric; label: string; photos: Metric[]; onPick: (m: Metric) => void; picking: boolean }) {
  const u = useImageUrl(m.photo_path)
  return (
    <div className="grow stack" style={{ gap: 4, minWidth: 0, flexBasis: 0 }}>
      <div className="thumb" style={{ width: '100%', height: 'auto', aspectRatio: '3/4', borderRadius: 14 }}>
        {u && <img src={u} alt={`${label} photo, ${fmtDate(m.date, true)}`} />}
      </div>
      <div className="small center">
        <b>{label}</b> · {fmtDate(m.date, true)}
      </div>
      <div className="small center muted">{m.weight_kg != null ? `${fmtKg(m.weight_kg)} kg` : ' '}</div>
      {picking && (
        <div className="cmp-strip" role="listbox" aria-label={`Pick the ${label.toLowerCase()} photo`}>
          {photos.map((p) => (
            <button key={p.id} role="option" aria-selected={p.id === m.id} className={p.id === m.id ? 'on' : ''} onClick={() => onPick(p)}>
              <Thumb path={p.photo_path} size={44} />
              <span className="tiny">{fmtDate(p.date)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Two progress photos side by side; "Compare" picks any two, Share renders the pair to an image. */
function PhotoCompare({ photos }: { photos: Metric[] }) {
  const repo = useStore((s) => s.repo)
  const toast = useStore((s) => s.toast)
  const [aId, setAId] = useState<string | null>(null)
  const [bId, setBId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [sharing, setSharing] = useState(false)
  const a = photos.find((p) => p.id === aId) ?? photos[0]
  const b = photos.find((p) => p.id === bId) ?? photos[photos.length - 1]
  const [older, newer] = a.date <= b.date ? [a, b] : [b, a]
  const days = Math.round((ts(newer.date) - ts(older.date)) / DAY)
  const dKg = older.weight_kg != null && newer.weight_kg != null ? Math.round((newer.weight_kg - older.weight_kg) * 10) / 10 : null
  const caption =
    days > 0
      ? `${dKg != null ? `${dKg > 0 ? '+' : dKg < 0 ? '−' : '±'}${fmtKg(Math.abs(dKg))} kg in ` : ''}${days} day${days === 1 ? '' : 's'}`
      : null

  async function share() {
    if (!repo) return
    setSharing(true)
    try {
      const [ua, ub] = await Promise.all([repo.imageUrl(a.photo_path), repo.imageUrl(b.photo_path)])
      if (!ua || !ub) throw new Error('Photo not available offline')
      const kg = (m: Metric) => (m.weight_kg != null ? `${fmtKg(m.weight_kg)} kg` : null)
      const blob = await renderCompareCard(
        { url: ua, date: fmtDate(a.date, true), weight: kg(a) },
        { url: ub, date: fmtDate(b.date, true), weight: kg(b) },
        caption
      )
      const res = await shareOrDownload(blob, `gymlog-progress-${older.date}-${newer.date}.png`, caption ? `My progress: ${caption}` : 'My progress')
      if (res === 'downloaded') toast({ kind: 'info', text: 'Comparison image saved' })
    } catch (e: any) {
      toast({ kind: 'error', text: 'Could not create the image', sub: String(e?.message ?? e) })
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="card stack">
      <div className="card-head">
        <h2>Progress photos</h2>
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <button className={`btn sm${picking ? ' primary' : ''}`} onClick={() => setPicking(!picking)} aria-pressed={picking}>
            {picking ? 'Done' : 'Compare'}
          </button>
          <button className="btn icon sm" onClick={share} disabled={sharing} aria-label="Share comparison">
            <Share2 size={18} />
          </button>
        </div>
      </div>
      {picking && <div className="small muted">Pick a photo under each side.</div>}
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <PhotoSide m={a} label="Before" photos={photos} onPick={(m) => setAId(m.id)} picking={picking} />
        <PhotoSide m={b} label="After" photos={photos} onPick={(m) => setBId(m.id)} picking={picking} />
      </div>
      {caption && <div className="small center muted">{caption}</div>}
    </div>
  )
}

export default function Body() {
  const metrics = useStore((s) => s.db.metrics)
  const [editing, setEditing] = useState<Metric | 'new' | 'measures' | null>(null)
  const [range, setRange] = useState<'30' | '90' | 'all'>('90')

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

      {withPhotos.length >= 2 && (
        <PhotoCompare photos={withPhotos} />
      )}
      {withPhotos.length > 0 && (
        <section>
          <div className="section-label">
            <span>All photos</span>
            <span className="count">{withPhotos.length}</span>
          </div>
          <div className="photo-grid">
            {[...withPhotos].reverse().map((m) => (
              <button key={m.id} className="stack" style={{ gap: 4 }} onClick={() => setEditing(m)} aria-label={`Photo from ${m.date}`}>
                <Thumb path={m.photo_path} />
                <div className="tiny muted center">{fmtDate(m.date)}</div>
              </button>
            ))}
          </div>
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
