import { useEffect, useRef, useState } from 'react'
import { scrollToY, scrollY } from '../lib/scroll'

/*
 * Press-and-hold to pick up an item in a vertical list, drag it, let go to drop: the item follows the finger
 * and the others slide out of its way (like Hevy). Items may have different heights.
 * While dragging the page does not scroll by itself under the finger, but it scrolls near the top and bottom
 * edges so a long list can be crossed.
 *
 * Smoothness: the held item is moved by writing its transform straight onto the element, once per frame, so a
 * finger move does not re-render the list (with full workout cards that re-render made the drag stutter). React
 * only re-renders when the slot under the finger changes, to slide the other items. On release the item glides
 * into its slot before the list is reordered, so nothing jumps.
 */

type Rect = { top: number; h: number }
/** `to` is where the held item would land; `settle` is set while it glides into that slot after the finger lifts */
type Drag = { from: number; to: number; rects: Rect[]; settle?: boolean }

const HOLD_MS = 400
const SLOP = 8
const EASE = 'cubic-bezier(0.2, 0, 0, 1)'
const SETTLE_MS = 200

export function toIndex(rects: Rect[], from: number, dy: number): number {
  const c = rects[from].top + rects[from].h / 2 + dy
  let to = 0
  rects.forEach((r, i) => {
    if (i !== from && r.top + r.h / 2 < c) to++
  })
  return to
}

/** how far the held item moves to sit exactly in slot `to` (the others have slid out of its way) */
export function slotOffset(rects: Rect[], from: number, to: number): number {
  if (to === from) return 0
  if (to > from) return rects[to].top + rects[to].h - (rects[from].top + rects[from].h)
  return rects[to].top - rects[from].top
}

type Live = { from: number; y0: number; s0: number; rects: Rect[]; y: number; off: number; to: number }
const dyOf = (l: Live) => l.y - l.y0 + l.off + (scrollY() - l.s0)

export function useDragReorder(onDrop: (from: number, to: number) => void, onEnd?: () => void) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const refs = useRef<(HTMLElement | null)[]>([])
  const live = useRef<Live | null>(null)
  const hold = useRef<{ t: number; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const dropRef = useRef(onDrop)
  dropRef.current = onDrop
  const endRef = useRef(onEnd)
  endRef.current = onEnd

  function measure(): Rect[] {
    return refs.current.map((el) => {
      const r = el?.getBoundingClientRect()
      return r ? { top: r.top + scrollY(), h: r.height } : { top: 0, h: 0 }
    })
  }

  /** start dragging item `from` with the finger at clientY (also used to continue a drag after a re-layout).
   *  With `snap`, the item jumps to sit centred under the finger even when the re-layout left its slot elsewhere. */
  function start(from: number, clientY: number, snap = false) {
    const rects = measure()
    const r = rects[from]
    const off = snap && r ? clientY - (r.top - scrollY() + r.h / 2) : 0
    live.current = { from, y0: clientY, s0: scrollY(), rects, y: clientY, off, to: from }
    suppressClick.current = true
    const el = refs.current[from]
    if (el) {
      el.style.transition = `rotate 0.15s ${EASE}, scale 0.15s ${EASE}`
      el.style.transform = `translate3d(0, ${off}px, 0)`
    }
    try {
      navigator.vibrate?.(15)
    } catch {
      /* ignore */
    }
    setDrag({ from, to: from, rects })
  }

  useEffect(() => {
    if (!drag) return
    let raf = 0
    let dirty = false
    // one write per frame: the held item follows the finger; the list re-renders only when the slot changes
    const paint = () => {
      const l = live.current
      if (!l || !dirty) return
      dirty = false
      const dy = dyOf(l)
      const el = refs.current[l.from]
      if (el) el.style.transform = `translate3d(0, ${dy}px, 0)`
      const to = toIndex(l.rects, l.from, dy)
      if (to !== l.to) {
        l.to = to
        setDrag({ from: l.from, to, rects: l.rects })
      }
    }
    const move = (e: PointerEvent) => {
      if (!live.current) return
      live.current.y = e.clientY
      dirty = true
    }
    const end = () => {
      const l = live.current
      live.current = null
      if (!l) return
      const to = toIndex(l.rects, l.from, dyOf(l))
      const el = refs.current[l.from]
      // glide into the slot, then reorder for real
      if (el) {
        el.style.transition = `transform ${SETTLE_MS}ms ${EASE}, rotate ${SETTLE_MS}ms ${EASE}, scale ${SETTLE_MS}ms ${EASE}`
        el.style.transform = `translate3d(0, ${slotOffset(l.rects, l.from, to)}px, 0)`
      }
      setDrag({ from: l.from, to, rects: l.rects, settle: true })
      window.setTimeout(() => {
        if (el) {
          el.style.transition = ''
          el.style.transform = ''
        }
        if (to !== l.from) dropRef.current(l.from, to)
        setDrag(null)
        endRef.current?.()
        // the click that follows the long press must not open the item
        window.setTimeout(() => (suppressClick.current = false), 50)
      }, SETTLE_MS)
    }
    // keep the page still under the finger (iOS would otherwise scroll and cancel the drag)
    const noScroll = (e: TouchEvent) => e.preventDefault()
    // every frame: near the edges scroll the page a little, then draw the held item
    const frame = () => {
      const l = live.current
      if (l) {
        // the zones start just inside the sticky header and above the rest bar, so they are easy to reach
        const head = document.querySelector('.sp-head')?.getBoundingClientRect().bottom ?? 0
        const top = Math.max(90, head + 70)
        const bottom = window.innerHeight - 140
        const v = l.y < top ? -Math.ceil((top - l.y) / 6) : l.y > bottom ? Math.ceil((l.y - bottom) / 6) : 0
        if (v) {
          scrollToY(scrollY() + v, 'instant' as ScrollBehavior)
          dirty = true
        }
        paint()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    document.addEventListener('touchmove', noScroll, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      document.removeEventListener('touchmove', noScroll)
    }
  }, [drag != null])

  /** props for item i: hold to pick it up (or pass `onHold` to do something else on hold, e.g. switch to a compact list) */
  function item(i: number, onHold?: (clientY: number) => void) {
    const cancel = () => {
      if (hold.current) window.clearTimeout(hold.current.t)
      hold.current = null
    }
    return {
      ref: (el: HTMLElement | null) => {
        refs.current[i] = el
      },
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        if (drag) return
        const y = e.clientY
        hold.current = {
          x: e.clientX,
          y,
          t: window.setTimeout(() => {
            hold.current = null
            if (onHold) onHold(y)
            else start(i, y)
          }, HOLD_MS)
        }
      },
      onPointerMove: (e: React.PointerEvent) => {
        const h = hold.current
        if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > SLOP) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      onClickCapture: (e: React.MouseEvent) => {
        if (suppressClick.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      },
      style: styleFor(i)
    }
  }

  function styleFor(i: number): React.CSSProperties | undefined {
    if (!drag) return undefined
    const { from, to, rects, settle } = drag
    if (i === from) {
      // the held item: its position is written directly (see paint); here only the lift — a slight tilt and
      // grow, eased in, and eased out again while it settles (none with Reduce Motion)
      const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      return {
        rotate: calm || settle ? '0deg' : '2deg',
        scale: calm || settle ? '1' : '1.03',
        zIndex: 20,
        position: 'relative',
        willChange: 'transform'
      } as React.CSSProperties
    }
    // the gap the dragged item leaves: its height plus the spacing to its neighbour
    const next = rects[from + 1] ?? rects[from - 1]
    const gap = next ? Math.abs(next.top - rects[from].top) - (next.top > rects[from].top ? rects[from].h : next.h) : 0
    const room = rects[from].h + Math.max(0, gap)
    let shift = 0
    if (from < to && i > from && i <= to) shift = -room
    if (from > to && i >= to && i < from) shift = room
    return { transform: `translate3d(0, ${shift}px, 0)`, transition: `transform 0.22s ${EASE}` }
  }

  return { item, start, dragging: drag?.from ?? null }
}

/** move one element of an array */
export function moved<T>(arr: T[], from: number, to: number): T[] {
  const n = [...arr]
  const [x] = n.splice(from, 1)
  n.splice(to, 0, x)
  return n
}
