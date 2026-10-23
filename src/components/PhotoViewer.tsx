import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react'
import { Metric } from '../lib/types'
import { fmtDateLong, fmtKg } from '../lib/format'
import { lockScroll, useImageUrl } from './ui'
import { reducedMotion } from '../lib/motion'
import '../styles/photos.css'

type Pt = { x: number; y: number }
/** Anything with a photo: a body-weight entry, or a single photo from a workout or an exercise. */
export type ViewerPhoto = Pick<Metric, 'id' | 'photo_path'> & { date?: string; weight_kg?: number | null; note?: string }

function Slide({ m, offset, dx, zoom }: { m: ViewerPhoto | undefined; offset: number; dx: number; zoom: { s: number; x: number; y: number } | null }) {
  const url = useImageUrl(m?.photo_path)
  const [failed, setFailed] = useState(false)
  // no picture after a while (offline, not cached) or a broken file: say so instead of spinning forever
  useEffect(() => {
    setFailed(false)
    if (url) return
    const t = window.setTimeout(() => setFailed(true), 8000)
    return () => window.clearTimeout(t)
  }, [url, m?.photo_path])
  if (!m) return null
  const z = offset === 0 && zoom ? `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` : ''
  return (
    <div className="pv-slide" style={{ transform: `translateX(calc(${offset * 100}% + ${offset * 16}px + ${dx}px))` }} aria-hidden={offset !== 0}>
      {failed ? (
        <div className="pv-fail">This photo cannot load right now. Check your connection and try again.</div>
      ) : url ? (
        <img
          src={url}
          alt={offset === 0 ? (m.date ? `Photo, ${fmtDateLong(m.date)}` : 'Photo') : ''}
          style={{ transform: z }}
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="pv-wait" />
      )}
    </div>
  )
}

/**
 * Full-screen photo viewer: swipe or arrows for the next photo, pinch or double-tap to zoom (then drag to look
 * around), swipe down or X to close. Photos come in the order given.
 */
export function PhotoViewer<T extends ViewerPhoto>({
  photos,
  start,
  onClose,
  onEdit,
  kgOf
}: {
  photos: T[]
  start: number
  onClose: () => void
  onEdit?: (m: T) => void
  /** weight to show under a photo (e.g. the closest weigh-in); defaults to the entry's own */
  kgOf?: (m: T) => number | null
}) {
  const [i, setI] = useState(Math.min(Math.max(0, start), photos.length - 1))
  const [dx, setDx] = useState(0)
  const [dy, setDy] = useState(0)
  const [anim, setAnim] = useState(false)
  const [zoom, setZoom] = useState<{ s: number; x: number; y: number } | null>(null)
  const ptrs = useRef(new Map<number, Pt>())
  const g = useRef<{ start: Pt; pinch0?: number; zoom0?: { s: number; x: number; y: number }; axis?: 'x' | 'y'; dx?: number; dy?: number }>({ start: { x: 0, y: 0 } })
  const lastTap = useRef(0)
  const root = useRef<HTMLDivElement>(null)
  const m = photos[i]

  useEffect(() => {
    const unlock = lockScroll()
    const opener = document.activeElement as HTMLElement | null
    root.current?.focus({ preventScroll: true })
    return () => {
      unlock()
      opener?.focus?.({ preventScroll: true })
    }
  }, [])

  function go(dir: number) {
    const n = i + dir
    if (n < 0 || n >= photos.length) {
      setAnim(true)
      setDx(0)
      return
    }
    setZoom(null)
    if (reducedMotion()) {
      setI(n)
      setDx(0)
      return
    }
    // slide the strip a full screen, then swap the index with no animation
    setAnim(true)
    setDx(-dir * (window.innerWidth + 16))
    window.setTimeout(() => {
      setAnim(false)
      setI(n)
      setDx(0)
    }, 220)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && root.current) {
        // keep keyboard focus inside the viewer while it is open
        const f = [...root.current.querySelectorAll<HTMLElement>('button:not([disabled])')].filter((b) => b.offsetParent !== null)
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      } else if (e.key === 'Escape') {
        // a viewer opened from a sheet closes on its own; the sheet under it stays
        e.stopPropagation()
        onClose()
      }
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const dist = () => {
    const [a, b] = [...ptrs.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function down(e: React.PointerEvent) {
    try {
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    } catch {
      /* capture is a nicety: the gesture works without it */
    }
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setAnim(false)
    if (ptrs.current.size === 2) {
      g.current = { start: { x: e.clientX, y: e.clientY }, pinch0: dist(), zoom0: zoom ?? { s: 1, x: 0, y: 0 } }
      setDx(0)
      setDy(0)
    } else if (ptrs.current.size === 1) {
      g.current = { start: { x: e.clientX, y: e.clientY }, zoom0: zoom ?? undefined }
    }
  }

  function move(e: React.PointerEvent) {
    if (!ptrs.current.has(e.pointerId)) return
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const st = g.current
    if (ptrs.current.size === 2 && st.pinch0 && st.zoom0) {
      const s = Math.min(5, Math.max(1, (st.zoom0.s * dist()) / st.pinch0))
      setZoom(s <= 1.01 ? null : { ...st.zoom0, s })
      return
    }
    const mx = e.clientX - st.start.x
    const my = e.clientY - st.start.y
    if (zoom && st.zoom0) {
      setZoom({ ...st.zoom0, x: st.zoom0.x + mx, y: st.zoom0.y + my })
      return
    }
    if (!st.axis && Math.hypot(mx, my) > 8) st.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
    if (st.axis === 'x') {
      // resist at the first and last photo
      const edge = (mx > 0 && i === 0) || (mx < 0 && i === photos.length - 1)
      st.dx = edge ? mx / 3 : mx
      setDx(st.dx)
    } else if (st.axis === 'y' && my > 0) {
      st.dy = my
      setDy(my)
    }
  }

  function up(e: React.PointerEvent) {
    if (!ptrs.current.has(e.pointerId)) return
    ptrs.current.delete(e.pointerId)
    const st = g.current
    if (ptrs.current.size > 0) {
      // one finger of a pinch lifted: carry on as a pan from here
      const [p] = [...ptrs.current.values()]
      g.current = { start: p, zoom0: zoom ?? undefined }
      return
    }
    const moved = Math.hypot(e.clientX - st.start.x, e.clientY - st.start.y)
    if (moved < 10 && !st.pinch0) {
      const now = Date.now()
      if (now - lastTap.current < 300) {
        lastTap.current = 0
        setAnim(true)
        if (zoom) setZoom(null)
        else {
          // zoom in on the spot that was tapped
          const r = root.current!.getBoundingClientRect()
          const cx = e.clientX - (r.left + r.width / 2)
          const cy = e.clientY - (r.top + r.height / 2)
          setZoom({ s: 2.5, x: -cx * 1.5, y: -cy * 1.5 })
        }
        return
      }
      lastTap.current = now
      return
    }
    if (zoom) return
    // read the gesture, not state: the last move may not have rendered yet
    if (st.axis === 'x') {
      if ((st.dx ?? 0) < -60) return go(1)
      if ((st.dx ?? 0) > 60) return go(-1)
    }
    if (st.axis === 'y' && (st.dy ?? 0) > 110) return onClose()
    setAnim(true)
    setDx(0)
    setDy(0)
  }

  if (!m) return null
  const fade = Math.max(0.35, 1 - dy / 400)
  const kgShown = kgOf ? kgOf(m) : m.weight_kg ?? null

  return (
    <div className="pv" role="dialog" aria-modal="true" aria-label="Photo viewer" tabIndex={-1} ref={root} style={{ background: `rgba(0,0,0,${fade})` }}>
      <div className="pv-top">
        <button className="pv-btn" onClick={onClose} aria-label="Close">
          <X size={22} aria-hidden />
        </button>
        <div className="pv-count" aria-live="polite">
          {photos.length > 1 ? `${i + 1} of ${photos.length}` : ''}
        </div>
        {onEdit ? (
          <button className="pv-btn" onClick={() => onEdit(m)} aria-label="Edit entry">
            <Pencil size={19} aria-hidden />
          </button>
        ) : (
          <span className="pv-btn" aria-hidden />
        )}
      </div>

      <div
        className={`pv-stage${anim ? ' anim' : ''}`}
        style={{ transform: dy ? `translateY(${dy}px) scale(${1 - dy / 2000})` : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <Slide m={photos[i - 1]} offset={-1} dx={dx} zoom={null} />
        <Slide m={m} offset={0} dx={dx} zoom={zoom} />
        <Slide m={photos[i + 1]} offset={1} dx={dx} zoom={null} />
      </div>

      {photos.length > 1 && (
        <>
          <button className="pv-btn pv-prev" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous photo">
            <ChevronLeft size={24} aria-hidden />
          </button>
          <button className="pv-btn pv-next" onClick={() => go(1)} disabled={i === photos.length - 1} aria-label="Next photo">
            <ChevronRight size={24} aria-hidden />
          </button>
        </>
      )}

      <div className="pv-cap">
        {m.date && <div className="pv-date">{fmtDateLong(m.date)}</div>}
        <div className="pv-meta">
          {[kgShown != null ? `${fmtKg(kgShown)} kg` : null, m.note || null].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
  )
}

/** A photo tile that opens the viewer: date in the corner, cover-cropped. */
export function PhotoTile({ m, onOpen, label, kg }: { m: Metric; onOpen: () => void; label?: string; kg?: number | null }) {
  const url = useImageUrl(m.photo_path)
  return (
    <button className="ph-tile" onClick={onOpen} aria-label={`Open photo from ${fmtDateLong(m.date)}`}>
      {url && <img src={url} alt="" />}
      <span className="ph-tile-date" aria-hidden>
        {label ?? new Date(m.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        {kg != null && ` · ${fmtKg(kg)} kg`}
      </span>
    </button>
  )
}
