import '../styles/insights.css'

/** Tiny bar sparkline. The last bar is highlighted (the current, possibly partial, period). */
export function SparkBars({
  values,
  labels,
  height = 44,
  highlightLast = true
}: {
  values: number[]
  labels?: string[]
  height?: number
  highlightLast?: boolean
}) {
  const max = Math.max(1, ...values)
  const n = values.length
  const gap = 4
  const w = 100 / n
  return (
    <div className="spark">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden>
        {values.map((v, i) => {
          const h = v > 0 ? Math.max(2, (v / max) * (height - 2)) : 1
          const cls = v <= 0 ? 'empty' : highlightLast && i === n - 1 ? 'cur' : ''
          return <rect key={i} className={cls} x={i * w + gap / 8} y={height - h} width={w - gap / 4} height={h} rx={0.8} />
        })}
      </svg>
      {labels && (
        <div className="spark-labels tiny muted">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}
