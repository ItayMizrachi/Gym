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
export const DRIFT_KEY = 'gymlog:drift2'

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
   * player and the number pad float mid-screen and the sticky header leaves the top.
   */
  // how much taller the visible area is than the layout viewport when nothing is wrong (62px on the owner's phone)
  const base = vv.height - window.innerHeight
  const shown = { top: 0, bottom: 0 }
  /*
   * Moving the pieces back by what the visual viewport reports (deployed 2026-11-14) made things worse on the
   * phone: right after the keyboard closed, and while the page was pulled past its end, iPhone still reports
   * an offset although the fixed pieces are in place, so the header slid down the screen. Now it only records
   * the drift (Settings → 5 taps on "GymLog"); the fix for the keyboard case is settle() below.
   */
  const pin = (typing: boolean) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (typing || window.scrollY < -1 || window.scrollY > max + 1) return
    const top = Math.max(0, Math.round(vv.offsetTop))
    const bottom = Math.max(0, Math.round(vv.offsetTop + vv.height - window.innerHeight - base))
    if (top > shown.top || bottom > shown.bottom) {
      shown.top = Math.max(top, shown.top)
      shown.bottom = Math.max(bottom, shown.bottom)
      noteDrift(top, bottom)
    }
  }
  /*
   * After the iPhone keyboard closes, the visual viewport can stay shifted by part of the keyboard's height and
   * the fixed layer (rest player, header) floats until the next scroll. Scrolling to where the page already is
   * makes iPhone settle the viewport and draw the fixed pieces in place again.
   */
  const settle = () => {
    if (isField(document.activeElement)) return
    if (Math.abs(vv.offsetTop) < 1 && Math.abs(vv.height - window.innerHeight - base) < 1) return
    window.scrollTo(window.scrollX, window.scrollY)
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
  // the pull past the end is over once the page stops: look again then
  window.addEventListener('scrollend', () => {
    sync()
    settle()
  })
  // the keyboard opens and closes a moment after focus moves: check right away and again once it has settled
  const later = () => {
    sync()
    setTimeout(sync, 120)
    setTimeout(sync, 450)
  }
  const closed = () => {
    later()
    setTimeout(settle, 80)
    setTimeout(settle, 400)
    setTimeout(settle, 800)
  }
  document.addEventListener('focusin', later)
  document.addEventListener('focusout', closed)
  sync()
}
