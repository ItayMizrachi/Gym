import { ReactNode } from 'react'
import '../styles/workout-live.css'

/**
 * Flat front + back body figure. Each muscle group (names from MUSCLES) is filled with the accent
 * colour at the given intensity (0..1); 0 or missing = not worked. No gradients, just opacity.
 */
export function BodyMap({
  intensity,
  height = 96,
  className = '',
  title
}: {
  intensity: Record<string, number>
  height?: number
  className?: string
  /** accessible label; defaults to a list of the highlighted muscles */
  title?: string
}) {
  const lit = Object.entries(intensity).filter(([, v]) => v > 0)
  const label = title ?? (lit.length ? `Muscles: ${lit.map(([m]) => m).join(', ')}` : 'No muscles yet')
  const m = (name: string) => {
    const v = Math.max(0, Math.min(1, intensity[name] ?? 0))
    return v > 0 ? { className: 'bm-m on', style: { fillOpacity: 0.25 + 0.75 * v } } : { className: 'bm-m' }
  }
  return (
    <svg className={`bodymap ${className}`} viewBox="0 0 210 200" style={{ height }} role="img" aria-label={label}>
      {/* front */}
      <g>
        <Silhouette />
        <Both>
          <ellipse cx="30" cy="39" rx="7" ry="6" {...m('Shoulders')} />
          <ellipse cx="41.5" cy="47" rx="8.5" ry="7" {...m('Chest')} />
          <ellipse cx="24" cy="54" rx="4.2" ry="9.5" {...m('Biceps')} />
          <ellipse cx="20" cy="80" rx="3.8" ry="11" {...m('Forearms')} />
          <ellipse cx="41" cy="130" rx="7" ry="19" {...m('Quads')} />
          <ellipse cx="40" cy="170" rx="3.5" ry="12" {...m('Calves')} />
        </Both>
        <rect x="43" y="57" width="14" height="32" rx="4" {...m('Abs')} />
      </g>
      {/* back */}
      <g transform="translate(110 0)">
        <Silhouette />
        <path d="M37 34 L63 34 L65 70 Q50 84 35 70 Z" {...m('Back')} />
        <Both>
          <ellipse cx="30" cy="39" rx="7" ry="6" {...m('Shoulders')} />
          <ellipse cx="24" cy="54" rx="4.2" ry="9.5" {...m('Triceps')} />
          <ellipse cx="20" cy="80" rx="3.8" ry="11" {...m('Forearms')} />
          <ellipse cx="42.5" cy="101" rx="7.5" ry="8" {...m('Glutes')} />
          <ellipse cx="41" cy="134" rx="7" ry="17" {...m('Hamstrings')} />
          <ellipse cx="41" cy="170" rx="5.5" ry="13" {...m('Calves')} />
        </Both>
      </g>
    </svg>
  )
}

/** Draw a left-side shape and its mirror image around the figure's centre line (x = 50). */
function Both({ children }: { children: ReactNode }) {
  return (
    <>
      <g>{children}</g>
      <g transform="translate(100 0) scale(-1 1)">{children}</g>
    </>
  )
}

function Silhouette() {
  return (
    <g className="bm-body">
      <circle cx="50" cy="15" r="10" />
      <rect x="45" y="23" width="10" height="9" rx="3" />
      <path d="M29 33 Q50 28 71 33 Q76 36 76 44 L70 92 Q50 100 30 92 L24 44 Q24 36 29 33 Z" />
      <path d="M31 90 L69 90 L67 112 Q50 116 33 112 Z" />
      <Both>
        <ellipse cx="24" cy="52" rx="6" ry="15" transform="rotate(8 24 52)" />
        <ellipse cx="19.5" cy="80" rx="5" ry="15" transform="rotate(5 19.5 80)" />
        <circle cx="17.5" cy="99" r="4" />
        <ellipse cx="41" cy="132" rx="9.5" ry="25" />
        <ellipse cx="41" cy="172" rx="6.5" ry="18" />
        <ellipse cx="41" cy="193" rx="6" ry="3.5" />
      </Both>
    </g>
  )
}
