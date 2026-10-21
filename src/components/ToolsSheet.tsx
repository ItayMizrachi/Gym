import { useState } from 'react'
import { NumInput, Sheet } from './ui'
import { PlateCalc } from './PlateCalc'
import { e1rm } from '../lib/pr'
import { percentTable, repTable } from '../lib/oneRepMax'
import { usePrefs } from '../lib/prefs'
import { fmtKg, roundTo } from '../lib/format'
import '../styles/tools.css'

type Tab = 'max' | 'pct' | 'plates'
const TABS: { id: Tab; label: string }[] = [
  { id: 'max', label: '1-rep max' },
  { id: 'pct', label: 'Percent' },
  { id: 'plates', label: 'Plates' }
]

const one = (n: number) => fmtKg(roundTo(n, 0.5))

/** Quick gym maths: one-rep max from a set, percent-of-max table, and the plate calculator. */
export function ToolsSheet({ onClose, weight = 0 }: { onClose: () => void; weight?: number }) {
  const barKg = usePrefs((s) => s.barKg)
  const plates = usePrefs((s) => s.plates)
  const [tab, setTab] = useState<Tab>('max')
  const [w, setW] = useState<number | null>(weight > 0 ? weight : 100)
  const [reps, setReps] = useState<number | null>(5)
  const est = e1rm(w ?? 0, reps ?? 0)
  const [max, setMax] = useState<number | null>(null)
  const pctMax = max ?? (est > 0 ? roundTo(est, 0.5) : null)

  // the plate calculator is its own sheet; it takes over this one
  if (tab === 'plates') return <PlateCalc weight={weight || barKg} onClose={onClose} />

  return (
    <Sheet title="Tools" onClose={onClose}>
      <div className="stack">
        <div className="seg block" role="tablist" aria-label="Tool">
          {TABS.map((t) => (
            <button key={t.id} role="tab" className={tab === t.id ? 'on' : ''} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'max' && (
          <>
            <div className="tl-inputs">
              <label className="tl-field">
                <span>Weight (kg)</span>
                <NumInput value={w} onChange={setW} ariaLabel="Weight lifted in kg" className="num tl-num" />
              </label>
              <span className="tl-x" aria-hidden>
                ×
              </span>
              <label className="tl-field">
                <span>Reps</span>
                <NumInput value={reps} onChange={(n) => setReps(n == null ? null : Math.round(n))} decimal={false} ariaLabel="Reps done" className="num tl-num" />
              </label>
            </div>

            <div className="tl-hero" aria-live="polite">
              <div className="v">
                {est > 0 ? one(est) : '–'}
                <span className="u">kg</span>
              </div>
              <div className="l">Estimated 1-rep max</div>
            </div>
            <p className="small muted">
              The most you could probably lift once, worked out from your set (Epley formula).
              {reps != null && reps > 12 ? ' Above 12 reps the guess gets rough, so it counts as 12.' : ''}
            </p>

            {est > 0 && (
              <div className="tl-table" role="table" aria-label="Weight for each rep count at the same effort">
                <div className="tl-tr head" role="row">
                  <span role="columnheader">Reps</span>
                  <span role="columnheader">Weight</span>
                </div>
                {repTable(est).map((r) => (
                  <div key={r.reps} className={`tl-tr ${r.reps === reps ? 'on' : ''}`} role="row">
                    <span role="cell">{r.reps}</span>
                    <span role="cell">{one(r.weight)} kg</span>
                  </div>
                ))}
              </div>
            )}
            <p className="tiny muted">Each row is about as hard as your set: the same effort, for that many reps.</p>
          </>
        )}

        {tab === 'pct' && (
          <>
            <label className="tl-field">
              <span>Your 1-rep max (kg)</span>
              <NumInput value={pctMax} onChange={setMax} ariaLabel="One-rep max in kg" className="num tl-num" />
            </label>
            <p className="small muted">Programs often say “5 × 5 at 80%”. This shows that weight, rounded to what you can load on a {fmtKg(barKg)} kg bar.</p>
            {pctMax != null && pctMax > 0 && (
              <div className="tl-table three" role="table" aria-label="Percent of max">
                <div className="tl-tr head" role="row">
                  <span role="columnheader">Percent</span>
                  <span role="columnheader">Exact</span>
                  <span role="columnheader">On the bar</span>
                </div>
                {percentTable(pctMax, barKg, plates).map((r) => (
                  <div key={r.pct} className="tl-tr" role="row">
                    <span role="cell">{r.pct}%</span>
                    <span role="cell" className="muted">{fmtKg(Math.round(r.weight * 10) / 10)}</span>
                    <span role="cell">{fmtKg(r.loadable)} kg</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
