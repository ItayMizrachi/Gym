/*
 * The app scrolls inside one container (.pwa-enter, see styles/pwa.css), not the page itself: on iPhone a fixed
 * tab bar floated mid-screen during a fast scroll of the page. Code that scrolls goes through these helpers.
 */

export const scroller = (): HTMLElement => (document.querySelector('.pwa-enter') as HTMLElement | null) ?? (document.scrollingElement as HTMLElement) ?? document.documentElement

export const scrollY = () => scroller().scrollTop

export function scrollByY(top: number, behavior: ScrollBehavior = 'auto') {
  scroller().scrollBy({ top, behavior })
}

export function scrollToY(top: number, behavior: ScrollBehavior = 'auto') {
  scroller().scrollTo({ top, behavior })
}
