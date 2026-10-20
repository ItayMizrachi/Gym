import { useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { RefreshCw, X } from 'lucide-react'
import { registerSW } from 'virtual:pwa-register'
import { useStore } from '../lib/store'

/* A new build is downloaded in the background; the user decides when to switch. The banner never shows on the
   workout screen, so an update can never interrupt a set. */

let needRefresh = false
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function announce() {
  needRefresh = true
  listeners.forEach((fn) => fn())
}

/** Call once at startup (main.tsx). */
export function registerUpdates() {
  // dev has no service worker: `__gymlogShowUpdate()` in the console previews the banner
  if (import.meta.env.DEV) (window as any).__gymlogShowUpdate = announce
  if (!('serviceWorker' in navigator)) return
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh: announce,
    onRegisteredSW(_url, reg) {
      if (!reg) return
      // An installed app can stay open for days: look for a new build when it comes back to the front, and hourly.
      const check = () => {
        if (navigator.onLine && !reg.installing) void reg.update().catch(() => undefined)
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      setInterval(check, 60 * 60 * 1000)
    }
  })
}

export default function UpdateBanner() {
  const available = useSyncExternalStore(subscribe, () => needRefresh)
  const [later, setLater] = useState(false)
  const [busy, setBusy] = useState(false)
  const loc = useLocation()
  const hasRest = useStore((s) => Boolean(s.rest))

  if (!available || later || loc.pathname.startsWith('/session')) return null

  async function reload() {
    setBusy(true)
    try {
      await useStore.getState().flush() // send debounced edits before the page goes away
    } finally {
      if (applyUpdate) await applyUpdate(true)
      else location.reload()
    }
  }

  return (
    <div className={`pwa-update ${hasRest ? 'above-rest' : ''}`} role="status">
      <div className="pwa-update-text">
        <b>New version available</b>
        <span>Reload to get the latest GymLog.</span>
      </div>
      <button className="btn primary sm" onClick={reload} disabled={busy}>
        <RefreshCw size={16} className={busy ? 'pwa-spin' : ''} /> Reload
      </button>
      <button className="pwa-update-close" onClick={() => setLater(true)} aria-label="Later">
        <X size={18} />
      </button>
    </div>
  )
}
