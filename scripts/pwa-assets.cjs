// Regenerates the app icons and iOS launch screens in public/ from one drawing of the GymLog mark.
// sharp is not a project dependency; run it without saving:
//   npm i --no-save sharp && node scripts/pwa-assets.cjs
// Prints the <link rel="apple-touch-startup-image"> tags; paste them into index.html if the size list changed.
//
// The mark: a G whose bowl is a weight plate and whose crossbar is the bar. Drawn in a 512 box centred on
// (256,256). The launch lockup (mark + "GymLog" wordmark in Inter Bold, as paths) is the same drawing used by
// the HTML placeholder in index.html and by src/components/BootScreen.tsx, so the three line up exactly.
const MARK =
  '<path d="M 355.0 146.0 A 148 148 0 1 0 404 256" fill="none" stroke="#f0b92a" stroke-width="76"/>' +
  '<circle cx="355.0" cy="146.0" r="38" fill="#f0b92a"/>' +
  '<path d="M 268 224 H 442 V 288 H 268 A 32 32 0 0 1 268 224 Z" fill="#eceae4"/>'
// "Gym" chalk + "Log" yellow, Inter 700 26px, centred on x=100, baseline y=168 of a 200 x 180 CSS-px lockup.
const WORD =
  '<path d="M58.4 168.3Q55.7 168.3 53.7 167.1Q51.7 165.9 50.6 163.7Q49.5 161.6 49.5 158.6Q49.5 155.5 50.7 153.3Q51.8 151.1 53.8 150Q55.8 148.8 58.3 148.8Q59.9 148.8 61.3 149.3Q62.7 149.8 63.7 150.6Q64.8 151.5 65.5 152.6Q66.2 153.8 66.4 155.2L62.4 155.2Q62.2 154.5 61.9 154Q61.5 153.4 61 153Q60.5 152.7 59.8 152.5Q59.2 152.3 58.4 152.3Q56.9 152.3 55.8 153Q54.7 153.7 54.1 155.1Q53.4 156.5 53.4 158.5Q53.4 160.5 54 161.9Q54.7 163.3 55.8 164.1Q56.9 164.8 58.4 164.8Q59.8 164.8 60.8 164.3Q61.7 163.8 62.3 162.9Q62.8 162 62.8 160.9L58.7 160.9L58.7 157.9L66.6 157.9L66.6 160.3Q66.6 162.8 65.5 164.6Q64.4 166.3 62.6 167.3Q60.8 168.3 58.4 168.3M68.8 173L69.7 170.2L70.2 170.3Q70.9 170.5 71.5 170.4Q72.1 170.3 72.5 169.9Q72.8 169.5 72.9 168.8L73 168L67.7 153.8L71.7 153.8L74.1 161.2Q74.6 162.6 74.8 164Q74.9 164.4 75 164.9Q75.1 164.4 75.3 164Q75.6 162.6 76.1 161.2L78.5 153.8L82.5 153.8L76.5 169.7Q76.1 170.8 75.4 171.7Q74.7 172.5 73.7 173Q72.7 173.4 71.3 173.4Q70.5 173.4 69.9 173.3Q69.2 173.2 68.8 173M87.9 168L84.1 168L84.1 153.8L87.6 153.8L87.7 156.6Q88 155.8 88.5 155.2Q89.1 154.4 90 154Q90.8 153.6 91.8 153.6Q93.3 153.6 94.3 154.6Q95 155.3 95.4 156.8Q95.7 155.9 96.2 155.3Q96.9 154.4 97.9 154Q98.9 153.6 100 153.6Q101.3 153.6 102.3 154.2Q103.3 154.7 103.9 155.8Q104.5 156.9 104.5 158.4L104.5 168L100.7 168L100.7 159.2Q100.7 157.9 100.1 157.4Q99.4 156.8 98.5 156.8Q97.7 156.8 97.2 157.1Q96.7 157.4 96.4 158Q96.1 158.5 96.1 159.3L96.1 168L92.4 168L92.4 159Q92.4 158 91.8 157.4Q91.2 156.8 90.2 156.8Q89.6 156.8 89 157.1Q88.5 157.4 88.2 158Q87.9 158.6 87.9 159.4" fill="#eceae4"/>' +
  '<path d="M119.4 168L107.3 168L107.3 149.1L111.2 149.1L111.2 164.8L119.4 164.8M127.8 168.3Q125.7 168.3 124.1 167.4Q122.5 166.4 121.7 164.8Q120.8 163.2 120.8 161Q120.8 158.8 121.7 157.1Q122.5 155.5 124.1 154.5Q125.7 153.6 127.8 153.6Q129.9 153.6 131.5 154.5Q133 155.5 133.9 157.1Q134.7 158.8 134.7 161Q134.7 163.2 133.9 164.8Q133 166.4 131.5 167.4Q129.9 168.3 127.8 168.3M127.8 165.3Q128.8 165.3 129.5 164.7Q130.2 164.2 130.5 163.2Q130.9 162.2 130.9 161Q130.9 159.7 130.5 158.7Q130.2 157.7 129.5 157.2Q128.8 156.6 127.8 156.6Q126.8 156.6 126.1 157.2Q125.4 157.7 125.1 158.7Q124.7 159.7 124.7 161Q124.7 162.2 125.1 163.2Q125.4 164.2 126.1 164.7Q126.8 165.3 127.8 165.3M143.2 173.6Q141.4 173.6 140.1 173.2Q138.8 172.7 137.9 171.9Q137.1 171.1 136.8 170.1L140.1 169.2Q140.2 169.6 140.6 170Q141 170.4 141.6 170.6Q142.2 170.8 143.1 170.8Q144.6 170.8 145.4 170.2Q146.3 169.5 146.3 168.1L146.3 165.5L146 165.5Q145.7 166.1 145.2 166.6Q144.8 167.1 144 167.5Q143.2 167.8 142 167.8Q140.4 167.8 139.1 167Q137.8 166.3 137 164.8Q136.3 163.2 136.3 160.9Q136.3 158.5 137.1 156.9Q137.9 155.3 139.2 154.4Q140.5 153.6 142.1 153.6Q143.3 153.6 144.1 154Q144.9 154.4 145.4 155Q145.9 155.6 146.1 156.2L146.3 156.2L146.3 153.8L150 153.8L150 167.9Q150 169.8 149.2 171.1Q148.3 172.3 146.7 173Q145.2 173.6 143.2 173.6M143.2 164.9Q144.2 164.9 144.9 164.4Q145.6 163.9 145.9 163Q146.3 162.1 146.3 160.9Q146.3 159.6 145.9 158.7Q145.6 157.7 144.9 157.2Q144.2 156.7 143.2 156.7Q142.2 156.7 141.6 157.2Q140.9 157.8 140.5 158.7Q140.2 159.6 140.2 160.9Q140.2 162.1 140.5 163Q140.9 163.9 141.6 164.4Q142.2 164.9 143.2 164.9" fill="#f0b92a"/>'
// Lockup (CSS px): 200 x 180, the mark's 512 box drawn 144 wide at (28,0), so its centre is (100,72).
// On screen the lockup sits at left 50% - 100px, top 50% - 72px: the mark is dead centre.
const LOCKUP = `<g transform="translate(28 0) scale(0.28125)">${MARK}</g>${WORD}`

const TILE = '#141518' // icon background, a touch lighter than the app so it holds on black wallpapers
const BG = '#0f1013' // app background (--bg), used for launch screens

/** Square icon. rx: rounded tile for 'any' icons (0 = full bleed for iOS and maskable). s: mark scale. */
function icon(size, s, rx = 0) {
  const k = size / 512, t = (256 - 256 * s) * k
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}"${rx ? ` rx="${rx * k}"` : ''} fill="${TILE}"/><g transform="translate(${t.toFixed(2)} ${t.toFixed(2)}) scale(${(s * k).toFixed(5)})">${MARK}</g></svg>`
}
/** Launch screen: device pixels W x H at dpr d, lockup centred like the boot screen. */
function splash(W, H, d) {
  const x = W / 2 - 100 * d, y = H / 2 - 72 * d
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${BG}"/><g transform="translate(${x} ${y}) scale(${d})">${LOCKUP}</g></svg>`
}

const sharp = require('sharp'); const fs = require('fs'); const path = require('path')
const out = path.join(__dirname, '..', 'public')
const png = (svg, file, w, flat = false) => {
  let p = sharp(Buffer.from(svg)).resize(w)
  if (flat) p = p.flatten({ background: TILE }) // iOS home-screen icons must not be transparent
  return p.png({ compressionLevel: 9, palette: true, quality: 95 }).toFile(path.join(out, file))
}
const SPLASH = [ // [css w, css h, dpr]
  [440, 956, 3], [430, 932, 3], [420, 912, 3], [402, 874, 3], [393, 852, 3], [428, 926, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2]
]
;(async () => {
  // 'any' icons: rounded tile, mark ~64% wide. iOS: full bleed (iOS rounds it), same proportion.
  // Maskable: full bleed, mark inside the 80% safe circle (furthest point ~150 of 205 px).
  fs.writeFileSync(path.join(out, 'icon.svg'), icon(512, 0.88, 112).replace(/ width="512" height="512"/, '') + '\n')
  await png(icon(512, 0.88, 112), 'icon-192.png', 192)
  await png(icon(512, 0.88, 112), 'icon-512.png', 512)
  await png(icon(512, 0.8), 'icon-maskable-512.png', 512)
  await png(icon(512, 0.88), 'apple-touch-icon.png', 180, true)
  // favicon: a little bigger in the tile so it survives 16-32 px browser tabs
  await png(icon(512, 0.96, 96), 'favicon-32.png', 32)
  fs.mkdirSync(path.join(out, 'splash'), { recursive: true })
  const media = []
  for (const [w, h, d] of SPLASH) {
    const W = w * d, H = h * d, file = `splash/iphone-${W}x${H}.png`
    await png(splash(W, H, d), file, W, true)
    media.push(`<link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)" href="${file}" />`)
  }
  console.log(media.join('\n'))
})()

