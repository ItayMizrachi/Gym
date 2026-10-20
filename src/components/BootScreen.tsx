/** The GymLog mark: a loaded barbell. Same drawing as public/icon.svg and the iOS launch screens. */
export function BrandMark({ size = 160 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true">
      <rect x="44" y="242" width="424" height="28" rx="14" fill="#e9e6df" />
      <rect x="106" y="106" width="62" height="300" rx="22" fill="#f0b92a" />
      <rect x="344" y="106" width="62" height="300" rx="22" fill="#f0b92a" />
      <rect x="60" y="160" width="38" height="192" rx="16" fill="#f0b92a" />
      <rect x="414" y="160" width="38" height="192" rx="16" fill="#f0b92a" />
      <rect x="174" y="226" width="20" height="60" rx="6" fill="#9a978f" />
      <rect x="318" y="226" width="20" height="60" rx="6" fill="#9a978f" />
    </svg>
  )
}

/**
 * Shown while data loads. The mark sits exactly where the iOS launch screen and the HTML placeholder in
 * index.html draw it, so launch → placeholder → boot screen → app has no jump and no white flash.
 */
export default function BootScreen() {
  return (
    <div className="pwa-boot" role="status" aria-label="GymLog is loading">
      <BrandMark />
      <div className="pwa-boot-below">
        <div className="pwa-boot-name">GymLog</div>
        <div className="pwa-boot-bar">
          <span />
        </div>
      </div>
    </div>
  )
}
