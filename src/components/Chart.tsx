import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtDate } from '../lib/format'

export interface Pt {
  t: number // ms timestamp
  y: number
}
export interface Series {
  name: string
  color: string
  points: Pt[]
  dots?: boolean
  dashed?: boolean
  width?: number
}

const H = 196
const PAD = { l: 34, r: 14, t: 26, b: 24 }
const DAY = 86400000

function niceTicks(min: number, max: number, n = 4): number[] {
  if (min === max) return [min]
  const span = max - min
  const raw = span / n
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / pow
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * pow
  const start = Math.ceil(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000)
  return out
}

/** Monotone cubic interpolation (Fritsch–Carlson): smooth, never overshoots the data. */
function smoothPath(p: [number, number][]): string {
  const n = p.length
  if (n === 0) return ''
  if (n < 3) return p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(p[i + 1][0] - p[i][0])
    m.push(dx[i] === 0 ? 0 : (p[i + 1][1] - p[i][1]) / dx[i])
  }
  const t: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  t.push(m[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      t[i] = k * a * m[i]
      t[i + 1] = k * b * m[i]
    }
  }
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${(p[i][0] + h).toFixed(1)},${(p[i][1] + t[i] * h).toFixed(1)} ${(p[i + 1][0] - h).toFixed(1)},${(p[i + 1][1] - t[i + 1] * h).toFixed(1)} ${p[i + 1][0].toFixed(1)},${p[i + 1][1].toFixed(1)}`
  }
  return d
}

const fmtTick = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

export function LineChart({ series, unit = '', digits = 1 }: { series: Series[]; unit?: string; digits?: number }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(340)
  const [hover, setHover] = useState<{ t: number; vals: { name: string; color: string; y: number }[] } | null>(null)

  // draw at the real pixel width so text and strokes stay crisp instead of being scaled
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => el.clientWidth && setW(Math.round(el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sorted = useMemo(() => series.map((s) => ({ ...s, points: [...s.points].sort((a, b) => a.t - b.t) })), [series])
  const all = sorted.flatMap((s) => s.points)

  const geo = useMemo(() => {
    if (!all.length) return null
    const tMin = Math.min(...all.map((p) => p.t))
    let tMax = Math.max(...all.map((p) => p.t))
    if (tMax === tMin) tMax = tMin + DAY
    let yMin = Math.min(...all.map((p) => p.y))
    let yMax = Math.max(...all.map((p) => p.y))
    // a flat line (same value every time) gets a roomy axis in whole numbers, not 71.6 / 71.8 / 72 / 72.2
    const padY = yMax === yMin ? Math.max(2, Math.abs(yMax) * 0.08) : (yMax - yMin) * 0.15
    yMin -= padY
    yMax += padY
    const x = (t: number) => PAD.l + ((t - tMin) / (tMax - tMin)) * (W - PAD.l - PAD.r)
    const y = (v: number) => H - PAD.b - ((v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)
    return { tMin, tMax, yMin, yMax, x, y, ticks: niceTicks(yMin, yMax) }
  }, [all.length, sorted, W])

  // clear a stale tooltip when the data changes (e.g. switching range)
  const dataKey = `${series.map((s) => s.name).join('|')}:${all.length}:${all[0]?.t ?? 0}`
  useEffect(() => setHover(null), [dataKey])

  if (!geo) return <div className="muted small center" style={{ padding: 20 }}>No data yet</div>
  const { x, y, ticks, tMin, tMax } = geo

  function scrub(clientX: number) {
    const el = wrap.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = clientX - r.left
    const t = tMin + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (tMax - tMin)
    // snap to the nearest point of the main (last) series
    const base = (sorted.find((s, i) => i === sorted.length - 1 && s.points.length) ?? sorted.find((s) => s.points.length))!.points
    let best = base[0]
    for (const p of base) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p
    const vals = sorted
      .map((s) => {
        if (!s.points.length) return null
        const near = s.points.reduce((a, b) => (Math.abs(b.t - best.t) < Math.abs(a.t - best.t) ? b : a))
        return Math.abs(near.t - best.t) < DAY * 1.5 ? { name: s.name, color: s.color, y: near.y } : null
      })
      .filter(Boolean) as { name: string; color: string; y: number }[]
    if (!hover || hover.t !== best.t) {
      if (hover && 'vibrate' in navigator) navigator.vibrate?.(4)
      setHover({ t: best.t, vals })
    }
  }

  const main = sorted[sorted.length - 1]
  const last = main.points[main.points.length - 1]
  const midT = (tMin + tMax) / 2
  const showMid = W > 260 && tMax - tMin > DAY * 6
  const tipX = hover ? Math.min(Math.max(x(hover.t), 70), W - 70) : 0

  return (
    <div>
      <div className="chart-wrap" ref={wrap}>
        <svg
          className="chart"
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          onPointerDown={(e) => scrub(e.clientX)}
          onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && scrub(e.clientX)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
          role="img"
          aria-label={`${main.name} chart, latest ${last ? last.y.toFixed(digits) + unit : 'none'}`}
        >
          {/* horizontal gridlines + y labels */}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Math.round(y(v)) + 0.5} y2={Math.round(y(v)) + 0.5} style={{ stroke: 'var(--line)' }} strokeWidth={1} strokeDasharray="2 4" />
              <text x={PAD.l - 8} y={y(v) + 4} fontSize={11} textAnchor="end" style={{ fill: 'var(--faint)' }}>
                {fmtTick(v)}
              </text>
            </g>
          ))}
          {/* baseline */}
          <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b + 0.5} y2={H - PAD.b + 0.5} style={{ stroke: 'var(--line-strong)' }} />
          {/* x labels */}
          <text x={PAD.l} y={H - 6} fontSize={11} style={{ fill: 'var(--muted)' }}>
            {fmtDate(new Date(tMin).toISOString())}
          </text>
          {showMid && (
            <text x={x(midT)} y={H - 6} fontSize={11} textAnchor="middle" style={{ fill: 'var(--faint)' }}>
              {fmtDate(new Date(midT).toISOString())}
            </text>
          )}
          <text x={W - PAD.r} y={H - 6} fontSize={11} textAnchor="end" style={{ fill: 'var(--muted)' }}>
            {fmtDate(new Date(tMax).toISOString())}
          </text>

          {sorted.map((s, si) => {
            if (!s.points.length) return null
            const xy = s.points.map((p) => [x(p.t), y(p.y)] as [number, number])
            const d = smoothPath(xy)
            const isMain = si === sorted.length - 1
            const area = isMain && sorted.length === 1 && xy.length > 1
              ? `${d} L${xy[xy.length - 1][0].toFixed(1)},${H - PAD.b} L${xy[0][0].toFixed(1)},${H - PAD.b} Z`
              : null
            const showDots = (s.dots ?? true) && xy.length <= 40
            return (
              <g key={s.name}>
                {area && <path d={area} fill={s.color} opacity={0.08} />}
                <path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.width ?? 2.4}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={s.dashed ? '4 4' : undefined}
                />
                {showDots &&
                  xy.map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r={xy.length > 20 ? 2 : 3} fill={s.color} style={{ stroke: 'var(--card)' }} strokeWidth={1.5} />
                  ))}
              </g>
            )
          })}

          {/* last-value label on the main series */}
          {last && !hover && (
            <g>
              <circle cx={x(last.t)} cy={y(last.y)} r={5} fill={main.color} style={{ stroke: 'var(--card)' }} strokeWidth={2.5} />
              <text
                x={Math.min(x(last.t), W - PAD.r)}
                y={Math.max(y(last.y) - 12, 14)}
                fontSize={14}
                fontWeight={600}
                textAnchor="end"
                // a halo in the card colour keeps the number readable where it crosses the line
                style={{ fill: 'var(--text)', fontFamily: 'var(--display)', stroke: 'var(--card)', strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' }}
              >
                {last.y.toFixed(digits)}
                {unit}
              </text>
            </g>
          )}

          {/* scrubber */}
          {hover && (
            <g>
              <line x1={Math.round(x(hover.t)) + 0.5} x2={Math.round(x(hover.t)) + 0.5} y1={PAD.t - 6} y2={H - PAD.b} style={{ stroke: 'var(--muted)' }} strokeWidth={1} />
              {hover.vals.map((v) => (
                <circle key={v.name} cx={x(hover.t)} cy={y(v.y)} r={5} fill={v.color} style={{ stroke: 'var(--card)' }} strokeWidth={2.5} />
              ))}
            </g>
          )}
        </svg>
        {hover && (
          <div className="chart-tip" style={{ left: tipX }}>
            <div className="d">{fmtDate(new Date(hover.t).toISOString(), true)}</div>
            {hover.vals.map((v) => (
              <div key={v.name} className="row" style={{ gap: 6 }}>
                <span className="val" style={{ color: v === hover.vals[hover.vals.length - 1] ? 'var(--text)' : v.color }}>
                  {v.y.toFixed(digits)}
                  <span className="muted" style={{ fontSize: 12, marginLeft: 1 }}>{unit}</span>
                </span>
                {hover.vals.length > 1 && <span className="muted">{v.name}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.name}>
              <span className="sw" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
