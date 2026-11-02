import { useState } from 'react'
import { ChevronDown, Link2, Unlink } from 'lucide-react'
import { t as tr } from '../lib/i18n'
import { partnersOf } from '../lib/superset'

/**
 * Superset controls for one exercise: who it is paired with and a one-tap Remove, then the other exercises to pair
 * it with. Used in the live workout (⋯ sheet) and the plan editor.
 */
export function SupersetPicker({
  names,
  groups,
  index,
  onLink,
  onUnlink
}: {
  names: string[]
  groups: string[]
  index: number
  onLink: (other: number) => void
  onUnlink: () => void
}) {
  // the other exercises stay folded behind one button until you want to pair
  const [open, setOpen] = useState(false)
  const items = groups.map((superset) => ({ superset }))
  const partners = partnersOf(items, index)
  const others = names.map((n, k) => ({ n, k })).filter((x) => x.k !== index && !partners.includes(x.k))
  return (
    <div className="ssp">
      {partners.length > 0 && (
        <div className="ssp-now">
          <Link2 size={16} aria-hidden className="ssp-ico" />
          <span className="grow">{tr('Superset with {names}', { names: partners.map((k) => names[k]).join(', ') })}</span>
          <button className="btn sm" onClick={onUnlink}>
            <Unlink size={14} aria-hidden /> {tr('Remove')}
          </button>
        </div>
      )}
      {others.length > 0 && (
        <>
          <button className="btn block ssp-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Link2 size={16} aria-hidden />
            <span className="grow" style={{ textAlign: 'start' }}>
              {partners.length ? tr('Add another exercise to it') : tr('Superset with…')}
            </span>
            <ChevronDown size={16} aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined }} />
          </button>
          {open && (
            <div className="list-group">
              {others.map(({ n, k }) => (
                <button
                  key={k}
                  className="list-row ssp-row"
                  onClick={() => {
                    onLink(k)
                    setOpen(false)
                  }}
                >
                  <span className="grow ellipsis" style={{ textAlign: 'start' }}>
                    {n}
                  </span>
                  {groups[k] && <span className="chip blue">{groups[k]}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
