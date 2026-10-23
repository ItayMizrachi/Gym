import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react'
import { X, Camera, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { resizeImage } from '../lib/images'
import { DUR, exitDelay } from '../lib/motion'

/* ---------- image helpers ---------- */

export function useImageUrl(path: string | null | undefined): string | null {
  const repo = useStore((s) => s.repo)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setUrl(null)
    if (!path || !repo) return
    repo.imageUrl(path).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [path, repo])
  return url
}

/** "Bench Press (Barbell)" -> "BP", "Squat" -> "SQ" */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '')
    .replace(/\(.*?\)/g, ' ')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
  if (!words.length) return ''
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Photo thumbnail. Without a photo it shows a plate-shaped tile stamped with the
 * exercise initials (pass `name`), or the muscle group's initials (`muscle`).
 */
export function Thumb({
  path,
  size,
  className = '',
  name,
  muscle
}: {
  path: string | null | undefined
  size?: number
  className?: string
  name?: string | null
  muscle?: string | null
}) {
  const url = useImageUrl(path)
  const style: CSSProperties | undefined = size ? { width: size, height: size, fontSize: size } : undefined
  if (url)
    return (
      <div className={`thumb ${className}`} style={style}>
        <img src={url} alt="" loading="lazy" />
      </div>
    )
  const ini = initials(name) || initials(muscle)
  return (
    <div className={`thumb tile ${ini ? '' : 'plain'} ${className}`} style={style ?? { fontSize: 52 }} aria-hidden>
      {ini && <span className="ini">{ini}</span>}
    </div>
  )
}

/** Choose / take a photo, resize it, upload it, return the stored path. */
export function ImageField({
  path,
  folder,
  onChange,
  large = false,
  label = 'Add photo',
  autoDelete = true
}: {
  path: string | null
  folder: string
  onChange: (p: string | null) => void
  large?: boolean
  label?: string
  /** delete the replaced / removed file straight away. Turn off when the parent saves later (e.g. a form with a Save button). */
  autoDelete?: boolean
}) {
  const repo = useStore((s) => s.repo)
  const toast = useStore((s) => s.toast)
  const url = useImageUrl(path)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file || !repo) return
    setBusy(true)
    try {
      const blob = await resizeImage(file)
      const newPath = await repo.uploadImage(blob, folder)
      const old = path
      onChange(newPath)
      if (old && autoDelete) void repo.deleteImage(old)
    } catch (e: any) {
      toast({ kind: 'error', text: 'Photo failed', sub: String(e?.message ?? e) })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const input = <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />

  // large, empty: one big dashed drop zone instead of a lone small button
  if (large && !url)
    return (
      <>
        {input}
        <button type="button" className="photo-drop" disabled={busy} onClick={() => inputRef.current?.click()}>
          <span className="photo-drop-icon">
            <Camera size={22} />
          </span>
          <span style={{ fontWeight: 600 }}>{busy ? 'Uploading…' : label}</span>
          <span className="tiny muted">{busy ? '' : 'Take one or pick from your library'}</span>
        </button>
      </>
    )

  function remove() {
    const old = path
    onChange(null)
    if (old && repo && autoDelete) void repo.deleteImage(old)
  }

  // a photo with a small X in its corner to remove it, and one full-width button to change or add
  return (
    <div className="stack" style={{ gap: 'var(--s2)' }}>
      {input}
      {url && (
        <div className={`photo-field${large ? ' lg' : ''}`}>
          <img src={url} alt="" />
          <button type="button" className="photo-x" onClick={remove} aria-label="Remove photo">
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
      <button type="button" className="btn block" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Camera size={18} aria-hidden /> {busy ? 'Uploading…' : url ? 'Change photo' : label}
      </button>
    </div>
  )
}

/* ---------- modal ---------- */

/** Bottom sheet with a drag handle: drag it down (or tap the backdrop) to close. */
/**
 * Freeze the page behind a sheet. overflow:hidden alone does not stop iOS Safari, so while a sheet is
 * open any touch drag outside a sheet, or on a sheet with nothing to scroll, is cancelled; the sheet's
 * own scrolling stays (overscroll-behavior keeps it from chaining to the page). The body is not pinned
 * with position:fixed: in the installed iOS app that cut the sheet short of the bottom of the screen.
 * Counted, so a sheet opened from another sheet does not unlock the page early.
 */
let locks = 0
function blockTouch(e: TouchEvent) {
  const sheet = (e.target as Element | null)?.closest?.('.sheet')
  if (!sheet || sheet.scrollHeight <= sheet.clientHeight) e.preventDefault()
}
export function lockScroll() {
  if (locks++ === 0) {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.addEventListener('touchmove', blockTouch, { passive: false })
  }
  return () => {
    if (--locks > 0) return
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.removeEventListener('touchmove', blockTouch)
  }
}

export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y0: number; dy: number; t0: number } | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  // backdrop, X and Escape: let the sheet slide down and the backdrop fade before the parent unmounts it
  const requestClose = useRef(() => {
    if (closingRef.current) return
    closingRef.current = true
    const wait = exitDelay(DUR.base)
    if (!wait) return closeRef.current()
    setClosing(true)
    setTimeout(() => closeRef.current(), wait)
  }).current

  useEffect(() => {
    const unlock = lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose()
    window.addEventListener('keydown', onKey)
    // screen readers and keyboards start inside the sheet, and return to where they were after
    const opener = document.activeElement as HTMLElement | null
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true })
    return () => {
      unlock()
      window.removeEventListener('keydown', onKey)
      opener?.focus?.({ preventScroll: true })
    }
  }, [])

  function start(e: React.PointerEvent) {
    const el = ref.current
    if (!el) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { y0: e.clientY, dy: 0, t0: Date.now() }
    el.classList.add('dragging')
    el.classList.remove('settling')
  }
  function move(e: React.PointerEvent) {
    const d = drag.current
    const el = ref.current
    if (!d || !el) return
    d.dy = Math.max(0, e.clientY - d.y0)
    el.style.transform = `translateY(${d.dy}px)`
  }
  function end() {
    const d = drag.current
    const el = ref.current
    drag.current = null
    if (!d || !el) return
    el.classList.remove('dragging')
    const fast = d.dy / Math.max(1, Date.now() - d.t0) > 0.6
    if (d.dy > el.offsetHeight * 0.3 || (fast && d.dy > 40)) {
      el.classList.add('settling')
      el.style.transform = 'translateY(100%)'
      setTimeout(() => closeRef.current(), 200)
    } else {
      el.classList.add('settling')
      el.style.transform = ''
    }
  }

  return (
    <div className={`overlay${closing ? ' closing' : ''}`} onClick={requestClose}>
      <div
        ref={ref}
        className="sheet"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn icon sm ghost" onClick={requestClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({
  title,
  text,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onClose
}: {
  title: string
  text?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      {text && <p className="confirm-text">{text}</p>}
      <div className="row" style={{ gap: 'var(--s2)' }}>
        <button className="btn grow" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`btn grow ${danger ? 'danger' : 'primary'}`}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}

/* ---------- numeric input that tolerates "62." while typing ---------- */

export function NumInput({
  value,
  onChange,
  placeholder,
  decimal = true,
  className = 'num',
  ariaLabel
}: {
  value: number | null
  onChange: (n: number | null) => void
  placeholder?: string
  decimal?: boolean
  className?: string
  ariaLabel?: string
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value == null ? '' : String(value))
  }, [value])
  return (
    <input
      className={className}
      inputMode={decimal ? 'decimal' : 'numeric'}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onFocus={(e) => {
        focused.current = true
        e.target.select()
      }}
      onBlur={() => {
        focused.current = false
        setText(value == null ? '' : String(value))
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.')
        if (!/^\d*\.?\d*$/.test(raw)) return
        setText(raw)
        if (raw === '' || raw === '.') onChange(null)
        else {
          const n = parseFloat(raw)
          if (!Number.isNaN(n)) onChange(n)
        }
      }}
    />
  )
}

export function Toggle({
  on,
  onChange,
  label,
  ariaLabel,
  blue
}: {
  on: boolean
  onChange: (v: boolean) => void
  /** accessible name when the visible label lives elsewhere */
  ariaLabel?: string
  /** accessible name; also rendered beside the switch when given */
  label?: string
  /** use the blue plate colour (drop sets / supersets) instead of brand yellow */
  blue?: boolean
}) {
  const sw = (
    <button
      type="button"
      className={`toggle ${blue ? 'blue' : ''} ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      aria-label={label ?? ariaLabel}
    />
  )
  if (!label) return sw
  return (
    <div className="toggle-row">
      <span className="grow" onClick={() => onChange(!on)}>
        {label}
      </span>
      {sw}
    </div>
  )
}

export function Empty({
  title,
  text,
  icon,
  children
}: {
  title: string
  text?: string
  icon?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h2>{title}</h2>
      {text && <div className="empty-text">{text}</div>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  )
}

/** Placeholder block while something loads. */
export function Skeleton({
  w = '100%',
  h = 16,
  r,
  className = '',
  style
}: {
  w?: number | string
  h?: number | string
  r?: number | string
  className?: string
  style?: CSSProperties
}) {
  return <span className={`skeleton ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden />
}

/** A few list-row skeletons. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="list-group" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="list-row">
          <Skeleton w={44} h={44} r={12} />
          <div className="grow stack" style={{ gap: 6 }}>
            <Skeleton w="60%" h={14} />
            <Skeleton w="35%" h={12} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Shared screen header: title, one plain line on what the screen is for, an optional
 * back arrow (sub-screens) and the primary action on the right.
 */
export function PageHeader({
  title,
  sub,
  back,
  action
}: {
  title: ReactNode
  sub?: ReactNode
  /** route to go back to; true = browser back */
  back?: string | true
  action?: ReactNode
}) {
  const nav = useNavigate()
  return (
    <div className="page-head ph">
      {back && (
        <button
          className="btn icon ghost ph-back"
          aria-label="Back"
          onClick={() => (back === true ? nav(-1) : nav(back))}
        >
          <ChevronLeft size={26} />
        </button>
      )}
      <div className="grow" style={{ minWidth: 0 }}>
        <h1 className="ellipsis">{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {action}
    </div>
  )
}
