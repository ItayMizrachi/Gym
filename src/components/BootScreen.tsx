import { LOCKUP_SVG } from './brandLockup'

/** The GymLog mark: a G whose bowl is a plate and whose crossbar is the bar. Same drawing as public/icon.svg. */
export function BrandMark({ size = 144 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true">
      <path d="M 355.0 146.0 A 148 148 0 1 0 404 256" fill="none" stroke="var(--accent)" strokeWidth="76" />
      <circle cx="355.0" cy="146.0" r="38" fill="var(--accent)" />
      <path d="M 268 224 H 442 V 288 H 268 A 32 32 0 0 1 268 224 Z" fill="var(--text)" />
    </svg>
  )
}

/**
 * Shown while data loads. The lockup (mark + wordmark) sits exactly where the iOS launch screen and the HTML
 * placeholder in index.html draw it, so launch → placeholder → boot screen → app has no jump and no flash.
 * A thin progress line fades in under it only if loading takes a moment.
 */
export default function BootScreen() {
  return (
    <div className="pwa-boot" role="status" aria-label="GymLog is loading">
      <svg className="pwa-boot-lockup" viewBox="0 0 200 180" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOCKUP_SVG }} />
      <div className="pwa-boot-bar">
        <span />
      </div>
    </div>
  )
}
