import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { recoveryView } from '../lib/recovery'
import { finishedSessions } from '../lib/stats'
import { BodyMap } from './BodyMap'
import { Sheet } from './ui'

const list = (ms: string[], n = 2) => (ms.length > n ? `${ms.slice(0, n).join(', ')} +${ms.length - n}` : ms.join(', '))

/** Muscle recovery on Train, folded into one tappable line; the body map and the details open in a sheet. */
export function RecoveryLine() {
  const db = useStore((s) => s.db)
  const [open, setOpen] = useState(false)
  const v = useMemo(() => recoveryView(db), [db])
  const trained = useMemo(() => finishedSessions(db).length > 0, [db])
  if (!trained) return null
  const allReady = v.recovering.length === 0
  return (
    <>
      <button
        className="hm-row"
        onClick={() => setOpen(true)}
        aria-label={
          allReady
            ? 'Muscle recovery: every muscle is rested. Show body map'
            : `Muscle recovery. Ready: ${v.ready.join(', ') || 'none'}. Recovering: ${v.recovering.join(', ')}. Show body map`
        }
      >
        <BodyMap intensity={v.load} height={42} className="hm-map" title="" />
        <span className="hm-row-body" aria-hidden>
          {allReady ? (
            <span className="hm-row-t">
              <span className="hm-dot" /> Every muscle is rested
            </span>
          ) : (
            <>
              {v.ready.length > 0 && (
                <span className="hm-row-t ellipsis">
                  <span className="hm-dot" /> Ready: <b>{list(v.ready)}</b>
                </span>
              )}
              <span className="hm-row-t ellipsis">
                <span className="hm-dot work" /> Recovering: <b>{list(v.recovering)}</b>
              </span>
            </>
          )}
        </span>
        <ChevronRight size={18} className="hm-row-end" aria-hidden />
      </button>
      {open && (
        <Sheet title="Muscle recovery" onClose={() => setOpen(false)}>
          <div className="stack" style={{ gap: 16 }}>
            <BodyMap intensity={v.load} height={180} className="hm-map-lg" title={v.recovering.length ? `Recently worked: ${v.recovering.join(', ')}` : 'No muscles worked in the last days'} />
            <div className="stack" style={{ gap: 8 }}>
              <div className="hm-rec-line">
                <span className="hm-dot work" aria-hidden /> Recovering: <b>{v.recovering.join(', ') || 'none'}</b>
              </div>
              <div className="hm-rec-line">
                <span className="hm-dot" aria-hidden /> Ready: <b>{v.ready.join(', ') || 'none'}</b>
              </div>
            </div>
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
          </div>
        </Sheet>
      )}
    </>
  )
}
