/*
 * Code that scrolls the app goes through these helpers (the page itself scrolls). A scroll container was tried for
 * the iPhone tab bar drifting while scrolling, but an installed iPhone app then cannot draw below the reported
 * screen height, so the bar sat too high or was cut off.
 */

export const scroller = (): HTMLElement => (document.scrollingElement as HTMLElement) ?? document.documentElement

export const scrollY = () => scroller().scrollTop

export function scrollByY(top: number, behavior: ScrollBehavior = 'auto') {
  scroller().scrollBy({ top, behavior })
}

export function scrollToY(top: number, behavior: ScrollBehavior = 'auto') {
  scroller().scrollTo({ top, behavior })
}
