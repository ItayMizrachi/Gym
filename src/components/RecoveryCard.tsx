import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { useStore } from '../lib/store'
import { recoveryView } from '../lib/recovery'
import { BodyMap } from './BodyMap'
import { Sheet } from './ui'

const list = (ms: string[]) => (ms.length > 3 ? `${ms.slice(0, 3).join(', ')} +${ms.length - 3}` : ms.join(', '))

/** "Muscle recovery" on Train: which groups were worked in the last days and which are rested. */
export function RecoveryCard() {
  const db = useStore((s) => s.db)
  const [info, setInfo] = useState(false)
  // refresh roughly hourly is plenty; recompute when data changes
  const v = useMemo(() => recoveryView(db), [db])
  if (!v.recovering.length) return null
  return (
    <div className="card rec-card">
      <BodyMap intensity={v.load} height={112} title={`Recently worked: ${v.recovering.join(', ')}`} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="rec-head">
          <span className="rec-title">Muscle recovery</span>
          <button className="btn icon ghost sm" onClick={() => setInfo(true)} aria-label="How muscle recovery works">
            <Info size={16} />
          </button>
        </div>
        <div className="rec-line">
          <span className="rec-dot work" aria-hidden /> Recovering: <b>{list(v.recovering)}</b>
        </div>
        {v.ready.length > 0 && (
          <div className="rec-line">
            <span className="rec-dot" aria-hidden /> Ready: <b>{list(v.ready)}</b>
          </div>
        )}
      </div>
      {info && (
        <Sheet title="Muscle recovery" onClose={() => setInfo(false)}>
          <div className="stack small" style={{ color: 'var(--text-2)' }}>
            <p style={{ margin: 0 }}>
              The brighter a muscle, the harder you worked it in the last days. Each working set counts; drop sets count half
              and warm-ups not at all.
            </p>
            <p style={{ margin: 0 }}>
              Big muscles (legs, back, chest) are shown recovering for about 3 days, smaller ones for about 2. Training a muscle
              that is still bright is fine; it is a guide for choosing today's workout, not a rule.
            </p>
          </div>
        </Sheet>
      )}
    </div>
  )
}
