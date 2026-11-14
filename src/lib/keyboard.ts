/*
 * On-screen keyboard helpers, installed once for the whole app:
 * - starting to scroll closes the keyboard (as in native iOS lists), unless the drag starts on the field itself
 * - --vvh holds the visible height above the keyboard and --kb the part of the screen the keyboard covers,
 *   so sheets can sit on top of the keyboard instead of behind it
 */

function isField(el: Element | null): el is HTMLElement {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return !/^(button|checkbox|radio|range|file|submit|reset|color)$/.test(el.type)
  return (el as HTMLElement).isContentEditable
}

/** largest fixed-layer drift seen on this device (see pin() below) */
export const DRIFT_KEY = 'gymlog:drift'

export function installKeyboardHelpers() {
  let y0: number | null = null
  document.addEventListener(
    'touchstart',
    (e) => {
      const a = document.activeElement
      y0 = isField(a) && !a.contains(e.target as Node) ? e.touches[0].clientY : null
    },
    { passive: true, capture: true }
  )
  document.addEventListener(
    'touchmove',
    (e) => {
      if (y0 == null) return
      if (Math.abs(e.touches[0].clientY - y0) > 10) {
        y0 = null
        const a = document.activeElement
        if (isField(a)) a.blur()
      }
    },
    { passive: true, capture: true }
  )

  const vv = window.visualViewport
  if (!vv) return
  const root = document.documentElement.style
  const last = { vvh: '', kb: '' }
  const sync = () => {
    // only while a field is focused: iPhone does not always report the viewport growing back after the keyboard
    // closes, and a stale value would push sheets up and cut off their bottom
    const typing = isField(document.activeElement)
    const vvh = `${Math.round(typing ? vv.height : window.innerHeight)}px`
    const kb = `${typing ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0}px`
    // write only on a change: this runs on every scroll frame, and touching a root variable restyles the whole
    // page (on iPhone that made scrolling stutter and the header and tab bar lag behind)
    if (vvh !== last.vvh) root.setProperty('--vvh', (last.vvh = vvh))
    if (kb !== last.kb) root.setProperty('--kb', (last.kb = kb))
    pin(typing)
  }

  /*
   * iPhone (installed app, iOS 26) sometimes slides the whole fixed layer up while the page scrolls: the rest
   * player and the number pad float mid-screen and the sticky header leaves the top. The visual viewport says
   * by how much, so the pinned pieces are moved back by that amount. Written on the elements themselves (not a
   * root variable, which would restyle the page on every scroll frame), and only when the amount changes.
   */
  const PINNED_BOTTOM = '.rp, .kp, .nav'
  const PINNED_TOP = '.sp-head'
  // how much taller the visible area is than the layout viewport when nothing is wrong (62px on the owner's phone)
  const base = vv.height - window.innerHeight
  const shown = { top: 0, bottom: 0 }
  const pin = (typing: boolean) => {
    const top = typing ? 0 : Math.max(0, Math.round(vv.offsetTop))
    const bottom = typing ? 0 : Math.max(0, Math.round(vv.offsetTop + vv.height - window.innerHeight - base))
    if (top > shown.top || bottom > shown.bottom) noteDrift(top, bottom)
    if (top === shown.top && bottom === shown.bottom && !top && !bottom) return
    shown.top = top
    shown.bottom = bottom
    document.querySelectorAll<HTMLElement>(PINNED_TOP).forEach((el) => (el.style.translate = top ? `0 ${top}px` : ''))
    document.querySelectorAll<HTMLElement>(PINNED_BOTTOM).forEach((el) => (el.style.translate = bottom ? `0 ${bottom}px` : ''))
  }
  /** the largest drift seen, for Settings → 5 taps on "GymLog" (so a report from the phone carries numbers) */
  const noteDrift = (top: number, bottom: number) => {
    try {
      const was = JSON.parse(localStorage.getItem(DRIFT_KEY) ?? '{}')
      if (top <= (was.top ?? 0) && bottom <= (was.bottom ?? 0)) return
      localStorage.setItem(
        DRIFT_KEY,
        JSON.stringify({
          top: Math.max(top, was.top ?? 0),
          bottom: Math.max(bottom, was.bottom ?? 0),
          inner: window.innerHeight,
          vvh: Math.round(vv.height),
          vvTop: Math.round(vv.offsetTop),
          base: Math.round(base),
          at: new Date().toISOString().slice(0, 16)
        })
      )
    } catch {
      /* ignore */
    }
  }
  vv.addEventListener('resize', sync)
  vv.addEventListener('scroll', sync)
  // the keyboard opens and closes a moment after focus moves: check right away and again once it has settled
  const later = () => {
    sync()
    setTimeout(sync, 120)
    setTimeout(sync, 450)
  }
  document.addEventListener('focusin', later)
  document.addEventListener('focusout', later)
  sync()
}
