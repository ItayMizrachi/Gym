import { useRef, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { ArrowLeftRight, Check, Columns2, Share2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Metric } from '../lib/types'
import { fmtDate, fmtKg } from '../lib/format'
import { renderCompareCard, shareOrDownload } from '../lib/shareCard'
import { Sheet, useImageUrl } from './ui'
import { weightNear } from '../lib/photos'
import '../styles/photos.css'

const DAY = 86400000
const ts = (d: string) => new Date(d + 'T12:00:00').getTime()
const kg = (m: Metric) => (m.weight_kg != null ? `${fmtKg(m.weight_kg)} kg` : null)

/** a small date label on a photo (the weights and the gap between them are in the line under the photos) */
function Chip({ m, side }: { m: Metric; side: 'l' | 'r' }) {
  return <span className={`pc-chip ${side}`}>{fmtDate(m.date)}</span>
}

const t2days = (n: number) => tr(n === 1 ? '{n} day apart' : '{n} days apart', { n })

/** Before / after: side by side, or one over the other with a slider to wipe between them. */
export function PhotoCompare({
  photos,
  all = photos,
  initial,
  onOpen
}: {
  photos: Metric[]
  all?: Metric[]
  /** two photo ids picked in the gallery */
  initial?: string[]
  onOpen: (m: Metric) => void
}) {
  const repo = useStore((s) => s.repo)
  const toast = useStore((s) => s.toast)
  const [aId, setAId] = useState<string | null>(initial?.[0] ?? null)
  const [bId, setBId] = useState<string | null>(initial?.[1] ?? null)
  const [mode, setMode] = useState<'side' | 'slide'>('side')
  const [pos, setPos] = useState(50)
  const [picking, setPicking] = useState<null | 'a' | 'b'>(null)
  const [sharing, setSharing] = useState(false)
  const frame = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const a0 = photos.find((p) => p.id === aId) ?? photos[0]
  const b0 = photos.find((p) => p.id === bId) ?? photos[photos.length - 1]
  const [pa, pb] = a0.date <= b0.date ? [a0, b0] : [b0, a0]
  // chips, stats and the share card all use the weight nearest to each photo
  const a = { ...pa, weight_kg: weightNear(pa, all) }
  const b = { ...pb, weight_kg: weightNear(pb, all) }
  const ua = useImageUrl(a.photo_path)
  const ub = useImageUrl(b.photo_path)
  const days = Math.round((ts(b.date) - ts(a.date)) / DAY)
  const dKg = a.weight_kg != null && b.weight_kg != null ? Math.round((b.weight_kg - a.weight_kg) * 10) / 10 : null
  const caption =
    days > 0 ? `${dKg != null ? `${dKg > 0 ? '+' : dKg < 0 ? '−' : '±'}${fmtKg(Math.abs(dKg))} kg in ` : ''}${days} day${days === 1 ? '' : 's'}` : null

  async function share() {
    if (!repo) return
    setSharing(true)
    try {
      const [sa, sb] = await Promise.all([repo.imageUrl(a.photo_path), repo.imageUrl(b.photo_path)])
      if (!sa || !sb) throw new Error('Photo not available offline')
      const blob = await renderCompareCard(
        { url: sa, date: fmtDate(a.date, true), weight: kg(a) },
        { url: sb, date: fmtDate(b.date, true), weight: kg(b) },
        caption
      )
      const res = await shareOrDownload(blob, `gymlog-progress-${a.date}-${b.date}.png`, caption ? `My progress: ${caption}` : 'My progress')
      if (res === 'downloaded') toast({ kind: 'info', text: 'Comparison image saved' })
    } catch (e: any) {
      toast({ kind: 'error', text: 'Could not create the image', sub: String(e?.message ?? e) })
    } finally {
      setSharing(false)
    }
  }

  function slideTo(clientX: number) {
    const r = frame.current?.getBoundingClientRect()
    if (!r) return
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }

  const pickFrom = picking === 'a' ? a : b
  const pick = (m: Metric) => {
    // keep the two picks as the user meant them: Before replaces the older one, After the newer one
    if (picking === 'a') {
      setAId(m.id)
      setBId(b.id)
    } else {
      setAId(a.id)
      setBId(m.id)
    }
  }

  return (
    <section className="card stack pc" id="photo-compare" style={{ scrollMarginTop: 12 }}>
      {/* header: title, then the two views as small icons and share — no big segmented control */}
      <div className="card-head pc-head">
        <h2 className="grow">{tr("Progress photos")}</h2>
        <div className="pc-modes" role="radiogroup" aria-label={tr("Compare view")}>
          <button role="radio" aria-checked={mode === 'side'} className={mode === 'side' ? 'on' : ''} onClick={() => setMode('side')} aria-label={tr("Side by side")}>
            <Columns2 size={17} aria-hidden />
          </button>
          <button role="radio" aria-checked={mode === 'slide'} className={mode === 'slide' ? 'on' : ''} onClick={() => setMode('slide')} aria-label={tr("Slider")}>
            <ArrowLeftRight size={17} aria-hidden />
          </button>
        </div>
        <button className="btn icon sm ghost" onClick={share} disabled={sharing} aria-label={tr("Share comparison")}>
          <Share2 size={18} aria-hidden />
        </button>
      </div>

      {mode === 'side' ? (
        <div className="pc-frame side">
          <button className="pc-half" onClick={() => onOpen(a)} aria-label={`Open before photo, ${fmtDate(a.date, true)}`}>
            {ua && <img src={ua} alt="" />}
            <Chip m={a} side="l" />
          </button>
          <button className="pc-half" onClick={() => onOpen(b)} aria-label={`Open after photo, ${fmtDate(b.date, true)}`}>
            {ub && <img src={ub} alt="" />}
            <Chip m={b} side="l" />
          </button>
        </div>
      ) : (
        <div
          className="pc-frame slide"
          ref={frame}
          onPointerDown={(e) => {
            dragging.current = true
            try {
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    } catch {
      /* capture is a nicety: the gesture works without it */
    }
            slideTo(e.clientX)
          }}
          onPointerMove={(e) => dragging.current && slideTo(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {ub && <img src={ub} alt={`After, ${fmtDate(b.date, true)}`} />}
          {ua && <img src={ua} alt={`Before, ${fmtDate(a.date, true)}`} className="pc-top" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />}
          <span className="pc-line" style={{ left: `${pos}%` }} aria-hidden>
            <span className="pc-knob">
              <ArrowLeftRight size={16} />
            </span>
          </span>
          <Chip m={a} side="l" />
          <Chip m={b} side="r" />
          <input
            className="sr-only"
            type="range"
            min={0}
            max={100}
            value={Math.round(pos)}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label={tr("Slide between before and after")}
          />
        </div>
      )}

      {/* one quiet line: how long between the photos and how the weight moved */}
      {caption && (
        <div className="pc-line-sum">
          <span>{t2days(days)}</span>
          {dKg != null && (
            <span className="tnum">
              {dKg > 0 ? '+' : dKg < 0 ? '−' : '±'}
              {fmtKg(Math.abs(dKg))} kg
            </span>
          )}
        </div>
      )}

      {/* change either photo: a quiet link under each one */}
      <div className="pc-change">
        <button className="btn ghost sm" onClick={() => setPicking('a')}>
          {tr("Change")}
        </button>
        <button className="btn ghost sm" onClick={() => setPicking('b')}>
          {tr("Change")}
        </button>
      </div>

      {picking && (
        <Sheet title={picking === 'a' ? 'Before photo' : 'After photo'} onClose={() => setPicking(null)}>
          <div className="ph-grid">
            {[...photos].reverse().map((p) => (
              <PickTile key={p.id} m={p} on={p.id === pickFrom.id} onPick={() => pick(p)} />
            ))}
          </div>
          <button className="btn primary block" style={{ marginTop: 'var(--s4)' }} onClick={() => setPicking(null)}>
            {tr("Done")}
          </button>
        </Sheet>
      )}
    </section>
  )
}

function PickTile({ m, on, onPick }: { m: Metric; on: boolean; onPick: () => void }) {
  const url = useImageUrl(m.photo_path)
  return (
    <button className={`ph-tile${on ? ' on' : ''}`} onClick={onPick} aria-pressed={on} aria-label={`Photo from ${fmtDate(m.date, true)}`}>
      {url && <img src={url} alt="" />}
      <span className="ph-tile-date" aria-hidden>
        {fmtDate(m.date)}
      </span>
      {on && (
        <span className="ph-tile-check" aria-hidden>
          <Check size={16} />
        </span>
      )}
    </button>
  )
}
