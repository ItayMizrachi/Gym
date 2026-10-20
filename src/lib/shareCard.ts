/** Draws a finished-workout summary to a PNG and shares it (Web Share with files) or downloads it. */

export interface ShareCardData {
  title: string // workout name
  date: string // already formatted
  duration: string
  sets: string
  volume: string
  prs: { name: string; detail: string }[]
  comparison: string | null // e.g. "+1.2 t vs last Upper A"
  comparisonUp: boolean | null
}

const W = 1080
const H = 1350

function token(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

export async function renderShareCard(d: ShareCardData): Promise<Blob> {
  const C = {
    bg: token('--bg', '#141518'),
    card: token('--card', '#1f2126'),
    card2: token('--card2', '#292c32'),
    line: token('--line', '#34383f'),
    text: token('--text', '#eceae4'),
    muted: token('--muted', '#9b9a94'),
    accent: token('--accent', '#f0b92a'),
    ok: token('--ok', '#5fcf8f'),
    danger: token('--danger', '#f0594f')
  }
  const display = `'Barlow Condensed', 'Arial Narrow', sans-serif`
  const body = `'Barlow', 'Segoe UI', Roboto, Arial, sans-serif`
  try {
    await Promise.all([
      document.fonts.load(`700 120px 'Barlow Condensed'`),
      document.fonts.load(`600 40px 'Barlow Condensed'`),
      document.fonts.load(`500 36px 'Barlow'`),
      document.fonts.load(`600 36px 'Barlow'`)
    ])
  } catch {
    /* fall back to system fonts */
  }

  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)

  // decorative plate, top right
  const px = W - 90
  const py = 110
  ctx.lineWidth = 46
  ctx.strokeStyle = C.card2
  ctx.beginPath()
  ctx.arc(px, py, 230, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 18
  ctx.beginPath()
  ctx.arc(px, py, 150, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = C.card2
  ctx.beginPath()
  ctx.arc(px, py, 46, 0, Math.PI * 2)
  ctx.fill()

  const L = 84
  let y = 150

  // done badge
  ctx.fillStyle = C.ok
  ctx.beginPath()
  ctx.arc(L + 34, y - 12, 34, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#04180f'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(L + 19, y - 12)
  ctx.lineTo(L + 30, y + 1)
  ctx.lineTo(L + 51, y - 24)
  ctx.stroke()
  ctx.fillStyle = C.ok
  ctx.font = `600 40px ${body}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Workout complete', L + 90, y)

  y += 150
  ctx.fillStyle = C.text
  ctx.font = `700 124px ${display}`
  ctx.fillText(fit(ctx, d.title, W - L * 2), L, y)
  y += 64
  ctx.fillStyle = C.muted
  ctx.font = `500 38px ${body}`
  ctx.fillText(d.date, L, y)

  // stats
  y += 70
  const boxW = (W - L * 2 - 2 * 24) / 3
  const stats: [string, string][] = [
    [d.duration, 'duration'],
    [d.sets, 'sets'],
    [d.volume, 'volume']
  ]
  stats.forEach(([v, l], i) => {
    const x = L + i * (boxW + 24)
    ctx.fillStyle = C.card
    ctx.strokeStyle = C.line
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(x, y, boxW, 190, 20)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = C.text
    ctx.font = `600 76px ${display}`
    ctx.fillText(fit(ctx, v, boxW - 48), x + 28, y + 100)
    ctx.fillStyle = C.muted
    ctx.font = `500 32px ${body}`
    ctx.fillText(l, x + 28, y + 152)
  })
  y += 190

  if (d.comparison) {
    y += 70
    ctx.font = `600 36px ${body}`
    ctx.fillStyle = d.comparisonUp == null ? C.muted : d.comparisonUp ? C.ok : C.danger
    ctx.fillText(d.comparison, L, y)
  }

  if (d.prs.length) {
    y += 60
    const shown = d.prs.slice(0, 4)
    const extra = d.prs.length - shown.length
    const boxH = 96 + shown.length * 72 + (extra > 0 ? 50 : 0)
    ctx.fillStyle = '#2b2409'
    ctx.strokeStyle = '#6e5612'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(L, y, W - L * 2, boxH, 20)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = C.accent
    ctx.font = `700 50px ${display}`
    ctx.fillText(`${d.prs.length} personal record${d.prs.length > 1 ? 's' : ''}`, L + 32, y + 70)
    let ry = y + 70
    for (const p of shown) {
      ry += 72
      ctx.font = `600 40px ${display}`
      const dw = ctx.measureText(p.detail).width
      ctx.fillStyle = C.accent
      ctx.fillText(p.detail, W - L - 32 - dw, ry)
      ctx.fillStyle = C.text
      ctx.font = `500 34px ${body}`
      ctx.fillText(fit(ctx, p.name, W - L * 2 - 64 - dw - 30), L + 32, ry)
    }
    if (extra > 0) {
      ctx.fillStyle = C.muted
      ctx.font = `500 30px ${body}`
      ctx.fillText(`+ ${extra} more`, L + 32, ry + 50)
    }
    y += boxH
  }

  // trim unused space at the bottom (never shorter than a square), then draw the footer
  const outH = Math.min(H, Math.max(W, Math.round(y + 260)))
  const out = document.createElement('canvas')
  out.width = W
  out.height = outH
  const o = out.getContext('2d')!
  o.drawImage(cv, 0, 0)
  drawFooter(o, outH, L, C)
  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('Could not draw the image'))), 'image/png'))
}

function drawFooter(ctx: CanvasRenderingContext2D, H: number, L: number, C: { accent: string; bg: string; text: string }) {
  const display = `'Barlow Condensed', 'Arial Narrow', sans-serif`
  ctx.fillStyle = C.accent
  ctx.beginPath()
  ctx.arc(L + 18, H - 92, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = C.bg
  ctx.beginPath()
  ctx.arc(L + 18, H - 92, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = C.text
  ctx.font = `700 44px ${display}`
  ctx.fillText('GymLog', L + 50, H - 77)
}

/** 'shared' | 'downloaded' | 'cancelled' */
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text })
      return 'shared'
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled'
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
