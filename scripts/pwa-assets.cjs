// Regenerates the app icons and iOS launch screens in public/ from one drawing of the GymLog mark.
// sharp is not a project dependency; run it without saving:
//   npm i --no-save sharp && node scripts/pwa-assets.cjs
// Prints the <link rel="apple-touch-startup-image"> tags; paste them into index.html if the size list changed.
// The GymLog mark: a loaded barbell seen from the side, drawn in a 512 box centred on (256,256).
// s scales the mark (maskable safe zone, splash screens).
function plate(cx, cy, s) {
  const Y = '#f0b92a', C = '#e9e6df', D = '#9a978f'
  const R = (x, y, w, h, rx, fill) =>
    `<rect x="${(cx + x * s).toFixed(2)}" y="${(cy + y * s).toFixed(2)}" width="${(w * s).toFixed(2)}" height="${(h * s).toFixed(2)}" rx="${(rx * s).toFixed(2)}" fill="${fill}"/>`
  return (
    R(-212, -14, 424, 28, 14, C) + // bar
    R(-150, -150, 62, 300, 22, Y) + // big plates
    R(88, -150, 62, 300, 22, Y) +
    R(-196, -96, 38, 192, 16, Y) + // smaller outer plates
    R(158, -96, 38, 192, 16, Y) +
    R(-82, -30, 20, 60, 6, D) + // collars
    R(62, -30, 20, 60, 6, D)
  )
}
function svg(w, h, s = 1, rx = 0) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''} fill="#141518"/>${plate(w / 2, h / 2, s)}</svg>`
}
const sharp = require('sharp'); const fs = require('fs'); const path = require('path')

const out = path.join(__dirname, '..', 'public')
const png = (s, file, w) => sharp(Buffer.from(s)).resize(w).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(path.join(out, file))
// Splash: the mark is drawn 160 CSS px wide-box (same as the in-app boot screen), centred.
const SPLASH = [ // [css w, css h, dpr]
  [440, 956, 3], [430, 932, 3], [420, 912, 3], [402, 874, 3], [393, 852, 3], [428, 926, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2]
]
;(async () => {
  fs.writeFileSync(path.join(out, 'icon.svg'), svg(512, 512, 1, 112).replace(/ width="512" height="512"/, '') + '\n')
  await png(svg(512, 512, 1, 112), 'icon-192.png', 192)
  await png(svg(512, 512, 1, 112), 'icon-512.png', 512)
  await png(svg(512, 512, 0.76), 'icon-maskable-512.png', 512)
  await png(svg(512, 512, 0.86), 'apple-touch-icon.png', 180)
  fs.mkdirSync(path.join(out, 'splash'), { recursive: true })
  const media = []
  for (const [w, h, d] of SPLASH) {
    const W = w * d, H = h * d, file = `splash/iphone-${W}x${H}.png`
    await png(svg(W, H, (160 * d) / 512), file, W)
    media.push(`<link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)" href="${file}" />`)
  }
  console.log(media.join('\n'))
})()
