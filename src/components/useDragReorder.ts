import { useEffect, useRef, useState } from 'react'

/*
 * Press-and-hold to pick up an item in a vertical list, drag it, let go to drop: the item follows the finger
 * and the others slide out of its way (like Hevy). Items may have different heights.
 * While dragging the page does not scroll by itself under the finger, but it scrolls near the top and bottom
 * edges so a long list can be crossed.
 */

type Rect = { top: number; h: number }
type Drag = { from: number; dy: number; rects: Rect[] }

const HOLD_MS = 400
const SLOP = 8

export function toIndex(rects: Rect[], from: number, dy: number): number {
  const c = rects[from].top + rects[from].h / 2 + dy
  let to = 0
  rects.forEach((r, i) => {
    if (i !== from && r.top + r.h / 2 < c) to++
  })
  return to
}

export function useDragReorder(onDrop: (from: number, to: number) => void, onEnd?: () => void) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const refs = useRef<(HTMLElement | null)[]>([])
  const live = useRef<{ from: number; y0: number; s0: number; rects: Rect[]; y: number } | null>(null)
  const hold = useRef<{ t: number; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const dropRef = useRef(onDrop)
  dropRef.current = onDrop
  const endRef = useRef(onEnd)
  endRef.current = onEnd

  function measure(): Rect[] {
    return refs.current.map((el) => {
      const r = el?.getBoundingClientRect()
      return r ? { top: r.top + window.scrollY, h: r.height } : { top: 0, h: 0 }
    })
  }

  /** start dragging item `from` with the finger at clientY (also used to continue a drag after a re-layout) */
  function start(from: number, clientY: number) {
    const rects = measure()
    live.current = { from, y0: clientY, s0: window.scrollY, rects, y: clientY }
    suppressClick.current = true
    try {
      navigator.vibrate?.(15)
    } catch {
      /* ignore */
    }
    setDrag({ from, dy: 0, rects })
  }

  useEffect(() => {
    if (!drag) return
    let raf = 0
    const update = () => {
      const l = live.current
      if (!l) return
      setDrag({ from: l.from, rects: l.rects, dy: l.y - l.y0 + (window.scrollY - l.s0) })
    }
    const move = (e: PointerEvent) => {
      if (!live.current) return
      live.current.y = e.clientY
      update()
    }
    const end = () => {
      const l = live.current
      live.current = null
      cancelAnimationFrame(raf)
      if (l) {
        const dy = l.y - l.y0 + (window.scrollY - l.s0)
        const to = toIndex(l.rects, l.from, dy)
        if (to !== l.from) dropRef.current(l.from, to)
      }
      setDrag(null)
      endRef.current?.()
      // the click that follows the long press must not open the item
      window.setTimeout(() => (suppressClick.current = false), 50)
    }
    // keep the page still under the finger (iOS would otherwise scroll and cancel the drag)
    const noScroll = (e: TouchEvent) => e.preventDefault()
    // near the edges, scroll the page a little each frame
    const edge = () => {
      const l = live.current
      if (l) {
        const top = 90
        const bottom = window.innerHeight - 120
        const v = l.y < top ? -Math.ceil((top - l.y) / 6) : l.y > bottom ? Math.ceil((l.y - bottom) / 6) : 0
        if (v) {
          window.scrollBy(0, v)
          update()
        }
      }
      raf = requestAnimationFrame(edge)
    }
    raf = requestAnimationFrame(edge)
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

  const to = drag ? toIndex(drag.rects, drag.from, drag.dy) : -1

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
    const { from, dy, rects } = drag
    if (i === from) {
      // the held item follows the finger with a slight tilt, eased in as it lifts (none with Reduce Motion)
      const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      return {
        transform: `translateY(${dy}px)`,
        rotate: calm ? undefined : '2deg',
        scale: calm ? undefined : '1.03',
        zIndex: 20,
        position: 'relative',
        transition: 'rotate 0.15s ease-out, scale 0.15s ease-out'
      } as React.CSSProperties
    }
    // the gap the dragged item leaves: its height plus the spacing to its neighbour
    const next = rects[from + 1] ?? rects[from - 1]
    const gap = next ? Math.abs(next.top - rects[from].top) - (next.top > rects[from].top ? rects[from].h : next.h) : 0
    const room = rects[from].h + Math.max(0, gap)
    let shift = 0
    if (from < to && i > from && i <= to) shift = -room
    if (from > to && i >= to && i < from) shift = room
    return { transform: `translateY(${shift}px)`, transition: 'transform 0.18s ease' }
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
