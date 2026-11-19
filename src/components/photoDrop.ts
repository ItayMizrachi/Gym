import { useEffect, useRef } from 'react'

/*
 * Body: hold a photo in the carousel, drag it onto the before / after photo of the comparison, let go to put it
 * there. A sideways swipe still scrolls the carousel and a tap still opens the photo: the drag starts only after
 * the finger has stayed still for a moment. While dragging, a small copy of the photo follows the finger and the
 * half it would replace lights up.
 */

export const PHOTO_DROP = 'gymlog:photo-drop'
export type PhotoDropDetail = { id: string; side: 'a' | 'b' }

const HOLD_MS = 320
const SLOP = 8

/** which half of the comparison is under the finger: 'a' (before, left) or 'b' (after, right) */
function sideAt(x: number, y: number): { side: 'a' | 'b'; el: HTMLElement } | null {
  const hit = document.elementFromPoint(x, y)
  const frame = hit?.closest<HTMLElement>('.pc-frame')
  if (!frame) return null
  const half = hit?.closest<HTMLElement>('.pc-half')
  if (half) {
    const halves = [...frame.querySelectorAll<HTMLElement>('.pc-half')]
    return { side: halves.indexOf(half) === 0 ? 'a' : 'b', el: half }
  }
  const r = frame.getBoundingClientRect()
  // the slider view: the half of the frame (before is always on the left, in Hebrew too)
  return { side: x < r.left + r.width / 2 ? 'a' : 'b', el: frame }
}

/** attach to the carousel: `idAt(i)` gives the photo id of the i-th tile */
export function usePhotoDrag(idAt: (i: number) => string | undefined, enabled: boolean) {
  const strip = useRef<HTMLDivElement>(null)
  const idRef = useRef(idAt)
  idRef.current = idAt

  useEffect(() => {
    const box = strip.current
    if (!enabled || !box) return
    let hold: { t: number; x: number; y: number; i: number; tile: HTMLElement } | null = null
    let drag: { id: string; ghost: HTMLElement; on: HTMLElement | null; side: 'a' | 'b' | null } | null = null
    let suppress = false

    const noScroll = (e: TouchEvent) => drag && e.preventDefault()
    const place = (x: number, y: number) => {
      if (!drag) return
      drag.ghost.style.transform = `translate3d(${x - 40}px, ${y - 53}px, 0) rotate(-3deg) scale(1.05)`
      const t = sideAt(x, y)
      if (drag.on !== (t?.el ?? null)) {
        drag.on?.classList.remove('pc-drop-on')
        t?.el.classList.add('pc-drop-on')
        drag.on = t?.el ?? null
      }
      drag.side = t?.side ?? null
    }
    const begin = (x: number, y: number) => {
      const h = hold
      hold = null
      if (!h) return
      const id = idRef.current(h.i)
      if (!id) return
      const img = h.tile.querySelector('img')
      const ghost = document.createElement('div')
      ghost.className = 'ph-ghost'
      if (img) ghost.style.backgroundImage = `url("${img.src}")`
      document.body.appendChild(ghost)
      drag = { id, ghost, on: null, side: null }
      document.querySelector('.pc-frame')?.classList.add('pc-drop-ready')
      h.tile.classList.add('ph-lifted')
      try {
        navigator.vibrate?.(15)
      } catch {
        /* ignore */
      }
      place(x, y)
    }
    const end = (drop: boolean) => {
      if (hold) window.clearTimeout(hold.t)
      hold = null
      if (!drag) return
      const d = drag
      drag = null
      d.ghost.remove()
      d.on?.classList.remove('pc-drop-on')
      document.querySelector('.pc-frame')?.classList.remove('pc-drop-ready')
      box.querySelector('.ph-lifted')?.classList.remove('ph-lifted')
      suppress = true
      window.setTimeout(() => (suppress = false), 80)
      if (drop && d.side) {
        window.dispatchEvent(new CustomEvent<PhotoDropDetail>(PHOTO_DROP, { detail: { id: d.id, side: d.side } }))
        document.getElementById('photo-compare')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const tile = (e.target as Element).closest<HTMLElement>('.ph-tile')
      if (!tile) return
      const i = [...box.children].indexOf(tile)
      const x = e.clientX
      const y = e.clientY
      hold = { x, y, i, tile, t: window.setTimeout(() => begin(x, y), HOLD_MS) }
    }
    const move = (e: PointerEvent) => {
      if (drag) return place(e.clientX, e.clientY)
      if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > SLOP) end(false)
    }
    const up = () => end(true)
    const cancel = () => end(false)
    // the tap that ends a drag must not open the photo
    const click = (e: MouseEvent) => {
      if (suppress) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const menu = (e: Event) => e.preventDefault()

    box.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    box.addEventListener('click', click, true)
    box.addEventListener('contextmenu', menu)
    document.addEventListener('touchmove', noScroll, { passive: false })
    return () => {
      end(false)
      box.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      box.removeEventListener('click', click, true)
      box.removeEventListener('contextmenu', menu)
      document.removeEventListener('touchmove', noScroll)
    }
  }, [enabled])

  return strip
}
