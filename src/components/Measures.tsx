import { useMemo, useState } from 'react'
import { ChevronDown, Info, Plus, Ruler } from 'lucide-react'
import { Metric } from '../lib/types'
import { LineChart } from './Chart'
import { NumInput, Sheet } from './ui'
import { fmtDate } from '../lib/format'
import {
  MEASURES,
  MEASURE_KEYS,
  MeasureKey,
  fieldsToShow,
  latestMeasure,
  loadUsedFields,
  measureDeltas,
  measureInfo,
  measureSeries,
  measuresWithData
} from '../lib/measures'
import '../styles/measures.css'

const ts = (d: string) => new Date(d + 'T12:00:00').getTime()
const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
const fmtDelta = (v: number | null) => (v == null ? '–' : v === 0 ? '0' : `${v > 0 ? '+' : '−'}${fmtNum(Math.abs(v))}`)

export type MeasureValues = Partial<Record<MeasureKey, number | null>>

/**
 * The optional "Measurements" part of the body log sheet. Collapsed by default; shows the fields you used
 * before (or waist, chest and right arm), with your last value as the placeholder.
 */
export function MeasureFields({
  metrics,
  date,
  values,
  onChange,
  open,
  onToggle
}: {
  metrics: Metric[]
  date: string
  values: MeasureValues
  onChange: (v: MeasureValues) => void
  open: boolean
  onToggle: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const [guide, setGuide] = useState(false)
  // other days only: the entry being edited should not be its own placeholder
  const others = useMemo(() => metrics.filter((m) => m.date !== date), [metrics, date])
  // read once per open sheet, so fields do not jump around while typing
  const [mine] = useState(() =>
    fieldsToShow([...loadUsedFields(), ...MEASURE_KEYS.filter((k) => values[k] != null)], measuresWithData(metrics))
  )
  const keys = showAll ? MEASURE_KEYS : mine
  const count = MEASURE_KEYS.filter((k) => values[k] != null).length

  return (
    <div className="ms-section">
      <button type="button" className="ms-toggle" aria-expanded={open} onClick={onToggle}>
        <Ruler size={18} aria-hidden />
        <span className="grow">Measurements</span>
        <span className="small muted">{count ? `${count} filled` : 'Optional'}</span>
        <ChevronDown size={18} className={`ms-chev${open ? ' open' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="stack" style={{ gap: 'var(--s3)' }}>
          <div className="ms-grid">
            {keys.map((k) => {
              const info = measureInfo(k)!
              const last = latestMeasure(others, k, date) ?? latestMeasure(others, k)
              return (
                <label key={k} className="ms-field">
                  <span>{info.label}</span>
                  <span className="ms-input">
                    <NumInput
                      value={values[k] ?? null}
                      onChange={(n) => onChange({ ...values, [k]: n })}
                      placeholder={last ? fmtNum(last.value) : '0'}
                      ariaLabel={`${info.label} in ${info.unit === '%' ? 'percent' : 'centimetres'}${last ? `, last ${fmtNum(last.value)}` : ''}`}
                    />
                    <span className="ms-unit">{info.unit}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <div className="ms-actions">
            {mine.length < MEASURE_KEYS.length ? (
              <button type="button" className="btn sm ghost" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Fewer' : 'More measurements'}
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="btn sm ghost" onClick={() => setGuide(true)}>
              <Info size={16} /> Where to measure
            </button>
          </div>
        </div>
      )}
      {guide && <MeasureGuide onClose={() => setGuide(false)} />}
    </div>
  )
}

/* Lines on the silhouette, in viewBox units (front view: the person's right side is on the viewer's left). */
const SPOTS: { key: MeasureKey; lines: [number, number, number][] }[] = [
  { key: 'neck', lines: [[52, 68, 41]] },
  { key: 'shoulders', lines: [[13, 107, 52]] },
  { key: 'chest', lines: [[31, 89, 68]] },
  { key: 'arm_r', lines: [[14, 30, 76]] },
  { key: 'arm_l', lines: [[90, 106, 76]] },
  { key: 'waist', lines: [[38, 82, 108]] },
  { key: 'hips', lines: [[33, 87, 134]] },
  { key: 'thigh_r', lines: [[36, 60, 162]] },
  { key: 'thigh_l', lines: [[60, 84, 162]] },
  { key: 'calf', lines: [[37, 59, 204]] }
]

export function BodySilhouette({ active }: { active: string | null }) {
  return (
    <svg className="ms-body" viewBox="0 0 120 244" role="img" aria-label="Body outline with the places to measure">
      <g className="ms-shape">
        <circle cx="60" cy="20" r="13" />
        <rect x="54" y="30" width="12" height="14" rx="4" />
        <path d="M34 46 Q60 40 86 46 L91 54 L82 112 L87 140 L33 140 L38 112 L29 54 Z" />
        <rect x="15" y="50" width="14" height="86" rx="7" transform="rotate(6 22 50)" />
        <rect x="91" y="50" width="14" height="86" rx="7" transform="rotate(-6 98 50)" />
        <rect x="36" y="136" width="23" height="102" rx="10" />
        <rect x="61" y="136" width="23" height="102" rx="10" />
      </g>
      {SPOTS.map((s) =>
        s.lines.map(([x1, x2, y], i) => (
          <line key={s.key + i} x1={x1} x2={x2} y1={y} y2={y} className={`ms-line${active === s.key ? ' on' : ''}`} />
        ))
      )}
      <text x="47" y="243" className="ms-side">R</text>
      <text x="70" y="243" className="ms-side">L</text>
    </svg>
  )
}

/** A small body diagram plus one line per measure on how to take it. */
export function MeasureGuide({ onClose, initial = 'waist' }: { onClose: () => void; initial?: string }) {
  const [active, setActive] = useState<string>(initial)
  return (
    <Sheet title="Where to measure" onClose={onClose}>
      <div className="stack" style={{ gap: 'var(--s3)' }}>
        <div className="small muted">Use a soft tape, snug but not tight. Measure in the morning before eating, once a month.</div>
        <div className="ms-guide">
          <BodySilhouette active={active} />
          <div className="ms-howlist" role="list">
            {MEASURES.map((m) => (
              <button
                key={m.key}
                role="listitem"
                className={`ms-how${active === m.key ? ' on' : ''}`}
                onClick={() => setActive(m.key)}
                aria-current={active === m.key}
              >
                <span className="ms-how-name">{m.label}</span>
                {active === m.key && <span className="ms-how-text">{m.how}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  )
}

/** Body tab card: pick a measure, see its latest value, change and chart. */
export function MeasuresCard({ metrics, onLog }: { metrics: Metric[]; onLog: () => void }) {
  const keys = useMemo(() => measuresWithData(metrics), [metrics])
  const [picked, setPicked] = useState<MeasureKey | null>(null)
  const [guide, setGuide] = useState(false)
  const key = picked && keys.includes(picked) ? picked : keys[0]
  const info = key ? measureInfo(key)! : null
  const d = useMemo(() => (key ? measureDeltas(metrics, key) : null), [metrics, key])
  const points = useMemo(() => (key ? measureSeries(metrics, key).map((p) => ({ t: ts(p.date), y: p.value })) : []), [metrics, key])

  return (
    <div className="card stack">
      <div className="card-head">
        <h2>Measurements</h2>
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <button className="btn icon sm" onClick={() => setGuide(true)} aria-label="Where to measure">
            <Info size={18} />
          </button>
          <button className="btn sm" onClick={onLog}>
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {!key || !d?.latest || !info ? (
        <div className="ms-empty">
          <Ruler size={22} aria-hidden />
          <div>
            <div>Track waist, arms and more with a tape measure.</div>
            <div className="small muted">Measure once a month, same time of day.</div>
          </div>
        </div>
      ) : (
        <>
          {keys.length > 1 && (
            <div className="ms-seg-wrap">
              <div className="seg ms-seg" role="tablist" aria-label="Measurement">
                {keys.map((k) => (
                  <button key={k} role="tab" aria-selected={k === key} className={k === key ? 'on' : ''} onClick={() => setPicked(k)}>
                    {measureInfo(k)!.short}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="body-hero">
            <div>
              <div className="small muted">
                {info.label} · {fmtDate(d.latest.date)}
              </div>
              <div className="big ms-big">
                {fmtNum(d.latest.value)}
                <span className="u">{info.unit}</span>
              </div>
            </div>
          </div>
          {points.length > 1 ? (
            <LineChart unit={` ${info.unit}`} digits={1} series={[{ name: info.label, color: 'var(--accent)', points, width: 2.4 }]} />
          ) : (
            <div className="small muted">Log it again next month to see a trend.</div>
          )}
          <div className="delta-row ms-deltas">
            <div>
              <div className="kpi">
                {fmtDelta(d.vsDays)}
                {d.vsDays != null && <span className="delta-u">{info.unit}</span>}
              </div>
              <div className="l">vs 30 days ago</div>
            </div>
            <div>
              <div className="kpi">
                {fmtDelta(d.sinceFirst)}
                {d.sinceFirst != null && <span className="delta-u">{info.unit}</span>}
              </div>
              <div className="l">since {d.first ? fmtDate(d.first.date) : 'first'}</div>
            </div>
          </div>
        </>
      )}
      {guide && <MeasureGuide onClose={() => setGuide(false)} initial={key ?? 'waist'} />}
    </div>
  )
}
