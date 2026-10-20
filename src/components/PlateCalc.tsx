import { useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { NumInput, Sheet } from './ui'
import { loadBar, plateColor } from '../lib/plates'
import { usePrefs } from '../lib/prefs'
import { fmtKg } from '../lib/format'
import '../styles/workout-flow.css'

function plateSize(kg: number) {
  if (kg >= 20) return { h: 132, w: kg >= 25 ? 24 : 21 }
  if (kg >= 15) return { h: 114, w: 19 }
  if (kg >= 10) return { h: 98, w: 17 }
  if (kg >= 5) return { h: 74, w: 13 }
  if (kg >= 2.5) return { h: 58, w: 11 }
  return { h: 46, w: 9 }
}

/** Plates per side for a barbell weight. `onUse` lets the caller take over the nearest loadable weight. */
export function PlateCalc({ weight, onClose, onUse }: { weight: number; onClose: () => void; onUse?: (kg: number) => void }) {
  const barKg = usePrefs((s) => s.barKg)
  const plates = usePrefs((s) => s.plates)
  const [target, setTarget] = useState<number>(weight || barKg)
  const load = useMemo(() => loadBar(target, barKg, plates), [target, barKg, plates])
  const step = Math.min(...plates, 2.5) * 2

  const counts = new Map<number, number>()
  for (const p of load.perSide) counts.set(p, (counts.get(p) ?? 0) + 1)

  return (
    <Sheet title="Plate calculator" onClose={onClose}>
      <div className="stack">
        <div className="pc-target">
          <button className="btn icon" onClick={() => setTarget((t) => Math.max(barKg, Math.round((t - step) * 100) / 100))} aria-label="Less weight">
            <Minus size={18} />
          </button>
          <NumInput value={target} onChange={(n) => setTarget(n ?? 0)} ariaLabel="Target weight kg" />
          <button className="btn icon" onClick={() => setTarget((t) => Math.round((t + step) * 100) / 100)} aria-label="More weight">
            <Plus size={18} />
          </button>
        </div>

        <div className="pc-bar" aria-label={`Each side: ${load.perSide.map(fmtKg).join(', ') || 'no plates'}`}>
          <div className="pc-shaft" />
          <div className="pc-collar" />
          {load.perSide.map((p, i) => {
            const { h, w } = plateSize(p)
            const c = plateColor(p)
            const light = p >= 20 || (p >= 10 && p < 15) // red, blue, green plates get white text
            return (
              <div key={i} className={`pc-plate ${light ? 'dark' : ''}`} style={{ height: h, width: w, background: c }}>
                {w >= 13 && <span>{fmtKg(p)}</span>}
              </div>
            )
          })}
          <div className="pc-sleeve" />
        </div>

        <div className="row" style={{ alignItems: 'baseline' }}>
          <div className="grow">
            <div className="small muted">Each side</div>
            <div className="pc-list">
              {load.perSide.length
                ? [...counts.entries()].map(([p, n]) => `${n > 1 ? `${n} × ` : ''}${fmtKg(p)}`).join('  ·  ')
                : 'Empty bar'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="small muted">Bar</div>
            <div className="pc-list">{fmtKg(barKg)} kg</div>
          </div>
        </div>

        {!load.exact && (
          <div className="small" style={{ color: 'var(--warn)' }}>
            {fmtKg(target)} kg can't be loaded with your plates. Nearest: <b>{fmtKg(load.achieved)} kg</b>.
          </div>
        )}

        {onUse && (
          <button
            className="btn primary"
            onClick={() => {
              onUse(load.achieved)
              onClose()
            }}
          >
            Use {fmtKg(load.achieved)} kg
          </button>
        )}
        <div className="tiny muted">Bar weight and available plates can be changed in Settings.</div>
      </div>
    </Sheet>
  )
}
