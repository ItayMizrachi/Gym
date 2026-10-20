import { useEffect, useState } from 'react'
import '../styles/progress.css'

/** Weekly bar chart. Tap a bar to read its value; the current week (last bar) is picked by default. */
export function WeekBars({
  values,
  starts,
  format
}: {
  values: number[]
  starts: Date[]
  format: (v: number) => string
}) {
  const [sel, setSel] = useState(values.length - 1)
  useEffect(() => setSel(values.length - 1), [values.length])
  const W = 340
  const H = 150
  const top = 18
  const bottom = 22
  const max = Math.max(1, ...values)
  const n = values.length
  const slot = W / n
  const bw = Math.max(2, Math.min(28, slot * 0.68))
  const chartH = H - top - bottom
  const label = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  // a few evenly spaced date labels, always including the first and last week
  const every = n <= 4 ? 1 : n <= 13 ? 4 : 13
  const cur = Math.min(sel, n - 1)

  return (
    <div className="wbars">
      <div className="wbars-read">
        <span className="kpi">{format(values[cur] ?? 0)}</span>
        <span className="small muted">{cur === n - 1 ? 'this week' : `week of ${label(starts[cur])}`}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Weekly totals">
        <line x1="0" x2={W} y1={top + chartH} y2={top + chartH} className="wbars-axis" />
        <line x1="0" x2={W} y1={top} y2={top} className="wbars-grid" />
        {values.map((v, i) => {
          const h = v > 0 ? Math.max(3, (v / max) * chartH) : 0
          const x = i * slot + (slot - bw) / 2
          return (
            <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
              <rect x={i * slot} y={top} width={slot} height={chartH} fill="transparent" />
              <rect
                x={x}
                y={top + chartH - h}
                width={bw}
                height={h}
                rx={Math.min(4, bw / 3)}
                className={`wbars-bar${i === cur ? ' on' : ''}`}
              />
            </g>
          )
        })}
        {starts.map((d, i) =>
          i % every === 0 || i === n - 1 ? (
            <text
              key={i}
              x={Math.min(W - 2, Math.max(2, i * slot + slot / 2))}
              y={H - 6}
              className="wbars-label"
              textAnchor={i === 0 && n > 4 ? 'start' : i === n - 1 && n > 4 ? 'end' : 'middle'}
            >
              {label(d)}
            </text>
          ) : null
        )}
        <text x={W - 2} y={12} className="wbars-label" textAnchor="end">
          {format(max)}
        </text>
      </svg>
    </div>
  )
}
