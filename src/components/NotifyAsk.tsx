import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { t as tr } from '../lib/i18n'
import { notifyPermission, notifySupported, requestNotify } from '../lib/notify'
import { usePrefs } from '../lib/prefs'
import { Sheet } from './ui'

const ASKED = 'gymlog:notify-asked'

/** Ask once (after the welcome tour) when the phone can show alerts and nobody has answered yet. */
export function shouldAskNotify(): boolean {
  try {
    if (localStorage.getItem(ASKED)) return false
  } catch {
    return false
  }
  return notifySupported() && notifyPermission() === 'default'
}

/**
 * First visit: "Know when rest is over" with one button. A phone only shows its own permission prompt after a tap,
 * so the app cannot pop it by itself; this sheet is that tap.
 */
export function NotifyAsk({ onDone }: { onDone: () => void }) {
  const setPrefs = usePrefs((s) => s.setPrefs)
  const [busy, setBusy] = useState(false)
  const done = () => {
    try {
      localStorage.setItem(ASKED, '1')
    } catch {
      /* ignore */
    }
    onDone()
  }
  return (
    <Sheet title={tr('Know when rest is over')} onClose={done}>
      <div className="stack" style={{ gap: 14, textAlign: 'center' }}>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <span className="ico-tile y" style={{ width: 56, height: 56, borderRadius: 16 }}>
            <BellRing size={26} aria-hidden />
          </span>
        </div>
        <div className="muted">{tr('GymLog can tell you when your rest is over, even with the phone locked.')}</div>
        <button
          className="btn primary block"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const ok = await requestNotify()
            setPrefs({ restNotify: ok })
            done()
          }}
        >
          {tr('Allow notifications')}
        </button>
        <button className="btn ghost block" onClick={done}>
          {tr('Not now')}
        </button>
      </div>
    </Sheet>
  )
}
