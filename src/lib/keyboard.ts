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
  const sync = () => {
    root.setProperty('--vvh', `${Math.round(vv.height)}px`)
    root.setProperty('--kb', `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`)
  }
  vv.addEventListener('resize', sync)
  vv.addEventListener('scroll', sync)
  sync()
}
