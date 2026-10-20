import { useMemo, useRef, useState } from 'react'
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

const W = 340
const H = 190
const PAD = { l: 38, r: 12, t: 14, b: 26 }

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

export function LineChart({ series, unit = '', digits = 1 }: { series: Series[]; unit?: string; digits?: number }) {
  const [hover, setHover] = useState<{ t: number; vals: { name: string; color: string; y: number }[] } | null>(null)
  const ref = useRef<SVGSVGElement>(null)

  const all = series.flatMap((s) => s.points)
  const geo = useMemo(() => {
    if (!all.length) return null
    const tMin = Math.min(...all.map((p) => p.t))
    let tMax = Math.max(...all.map((p) => p.t))
    if (tMax === tMin) tMax = tMin + 86400000
    let yMin = Math.min(...all.map((p) => p.y))
    let yMax = Math.max(...all.map((p) => p.y))
    const padY = (yMax - yMin || Math.max(1, yMax * 0.05)) * 0.18
    yMin -= padY
    yMax += padY
    const x = (t: number) => PAD.l + ((t - tMin) / (tMax - tMin)) * (W - PAD.l - PAD.r)
    const y = (v: number) => H - PAD.b - ((v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)
    return { tMin, tMax, yMin, yMax, x, y, ticks: niceTicks(yMin, yMax) }
  }, [all.length, series])

  if (!geo) return <div className="muted small center" style={{ padding: 20 }}>No data yet</div>
  const { x, y, ticks, tMin, tMax } = geo

  function onMove(clientX: number) {
    const svg = ref.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const px = ((clientX - r.left) / r.width) * W
    const t = tMin + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (tMax - tMin)
    const base = series[0].points
    if (!base.length) return
    let best = base[0]
    for (const p of base) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p
    const vals = series
      .map((s) => {
        const near = s.points.reduce((a, b) => (Math.abs(b.t - best.t) < Math.abs(a.t - best.t) ? b : a), s.points[0])
        return near && Math.abs(near.t - best.t) < 86400000 * 1.5 ? { name: s.name, color: s.color, y: near.y } : null
      })
      .filter(Boolean) as { name: string; color: string; y: number }[]
    setHover({ t: best.t, vals })
  }

  return (
    <div>
      <svg
        ref={ref}
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#34383f" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(v) + 4} fontSize={10} fill="#8b94a7" textAnchor="end">
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 6} fontSize={10} fill="#8b94a7">
          {fmtDate(new Date(tMin).toISOString())}
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize={10} fill="#8b94a7" textAnchor="end">
          {fmtDate(new Date(tMax).toISOString())}
        </text>
        {series.map((s) => {
          if (!s.points.length) return null
          const pts = [...s.points].sort((a, b) => a.t - b.t)
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')
          return (
            <g key={s.name}>
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width ?? 2.2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? '4 4' : undefined}
              />
              {(s.dots ?? true) &&
                pts.map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.y)} r={pts.length > 40 ? 1.8 : 3} fill={s.color} />)}
            </g>
          )
        })}
        {hover && (
          <line x1={x(hover.t)} x2={x(hover.t)} y1={PAD.t} y2={H - PAD.b} stroke="#8b94a7" strokeDasharray="3 3" />
        )}
      </svg>
      <div className="small center" style={{ minHeight: 20, color: 'var(--muted)' }}>
        {hover ? (
          <>
            <b style={{ color: 'var(--text)' }}>{fmtDate(new Date(hover.t).toISOString(), true)}</b>
            {hover.vals.map((v) => (
              <span key={v.name} style={{ marginLeft: 10, color: v.color }}>
                {v.name}: {v.y.toFixed(digits)}
                {unit}
              </span>
            ))}
          </>
        ) : (
          series.length > 1 && (
            <>
              {series.map((s) => (
                <span key={s.name} style={{ marginRight: 12 }}>
                  <span style={{ color: s.color }}>●</span> {s.name}
                </span>
              ))}
            </>
          )
        )}
      </div>
    </div>
  )
}
