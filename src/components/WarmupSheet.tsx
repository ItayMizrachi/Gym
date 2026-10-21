import { Sheet } from './ui'
import { addWarmupSets } from '../lib/actions'
import { Exercise, SessionExercise, trackingOf } from '../lib/types'
import { fmtKg } from '../lib/format'
import '../styles/tools.css'

/** "+ Warm-up" on the workout screen: preview a smart warm-up ramp, or add one plain warm-up row. */
export function WarmupSheet({
  se,
  exercise,
  onApply,
  onAddOne,
  onClose
}: {
  se: SessionExercise
  exercise: Exercise | undefined
  onApply: () => void
  onAddOne: () => void
  onClose: () => void
}) {
  const tracking = trackingOf(exercise)
  const firstWork = se.sets.find((s) => s.kind === 'work' || s.kind === 'failure')
  const started = se.sets.some((s) => (s.kind === 'work' || s.kind === 'failure') && s.done)
  const next = tracking === 'weight_reps' ? addWarmupSets(se, exercise) : null
  const known = new Set(se.sets.map((s) => s.id))
  const fresh = next ? next.sets.filter((s) => !known.has(s.id)) : []
  const work = firstWork?.weight ?? 0

  const why =
    tracking !== 'weight_reps'
      ? 'Smart warm-ups need a weight. Add a warm-up row instead.'
      : started
        ? 'You have already started your work sets.'
        : !firstWork || !(work > 0)
          ? 'Enter the weight of your first work set first. Warm-ups are worked out from it.'
          : fresh.length === 0 && se.sets.some((s) => s.kind === 'warmup' && s.done)
            ? 'Your warm-ups are already logged.'
            : `${fmtKg(work)} kg is light enough to start without warming up.`

  return (
    <Sheet title="Warm up" onClose={onClose}>
      <div className="stack">
        {fresh.length > 0 ? (
          <>
            <p className="small muted">
              Built from your first work set of <b style={{ color: 'var(--text)' }}>{fmtKg(work)} kg</b>, rounded to weights you can load. Warm-ups
              don't count for records.
            </p>
            <div className="wu-list">
              {fresh.map((s) => (
                <div key={s.id} className="wu-row">
                  <span className="kind warmup" aria-hidden>
                    W
                  </span>
                  <span className="w">{fmtKg(s.weight)} kg</span>
                  <span className="r">× {s.reps}</span>
                  <span className="p">{Math.round((s.weight / work) * 100)}%</span>
                </div>
              ))}
            </div>
            <button
              className="btn primary"
              onClick={() => {
                onApply()
                onClose()
              }}
            >
              Add warm-up sets
            </button>
          </>
        ) : (
          <p className="small muted">{why}</p>
        )}
        <button
          className={`btn ${fresh.length ? 'ghost' : ''}`}
          onClick={() => {
            onAddOne()
            onClose()
          }}
        >
          Add one warm-up row
        </button>
      </div>
    </Sheet>
  )
}
