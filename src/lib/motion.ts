/** Motion helpers. The durations match the --dur-* tokens in styles.css. */
export const DUR = { fast: 120, base: 200, slow: 280 } as const
export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** True when the person asked the system for less motion: states then change instantly. */
export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** How long to wait for an exit animation before removing something (0 under reduced motion). */
export function exitDelay(ms: number): number {
  return reducedMotion() ? 0 : ms
}
