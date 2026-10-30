import { useEffect, useRef, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { WifiOff } from 'lucide-react'
import { useStore } from '../lib/store'

type View = 'hidden' | 'offline-full' | 'offline-chip' | 'back'

/** Going offline shows a short explanation, then shrinks to a small "Offline" chip until the connection returns. */
export default function OfflineBanner() {
  const [view, setView] = useState<View>(() => (navigator.onLine ? 'hidden' : 'offline-chip'))
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const cloud = useStore((s) => s.repo?.mode === 'cloud')
  const queued = useStore((s) => s.queued)

  useEffect(() => {
    const later = (v: View, ms: number) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setView(v), ms)
    }
    const off = () => {
      setView('offline-full')
      later('offline-chip', 4000)
    }
    const on = () => {
      setView('back')
      later('hidden', 2500)
    }
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
      clearTimeout(timer.current)
    }
  }, [])

  if (view === 'hidden') return null

  if (view === 'back')
    return (
      <div className="pwa-net back" role="status">
        <span className="pwa-net-dot" />
        {cloud && queued ? 'Back online · syncing' : 'Back online'}
      </div>
    )

  const full = view === 'offline-full'
  return (
    <div
      className={`pwa-net ${full ? 'full' : 'chip'}`}
      role="status"
      onClick={() => setView(full ? 'offline-chip' : 'offline-full')}
    >
      <WifiOff size={full ? 16 : 12} />
      {full ? (
        <span>
          <b>{tr("You're offline.")}</b> {cloud ? 'Keep logging, changes sync when you reconnect.' : 'Everything still works.'}
        </span>
      ) : (
        'Offline'
      )}
    </div>
  )
}
