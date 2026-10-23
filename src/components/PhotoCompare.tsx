import { useRef, useState } from 'react'
import { ArrowLeftRight, Check, Share2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Metric } from '../lib/types'
import { fmtDate, fmtKg } from '../lib/format'
import { renderCompareCard, shareOrDownload } from '../lib/shareCard'
import { Sheet, useImageUrl } from './ui'
import '../styles/photos.css'

const DAY = 86400000
const ts = (d: string) => new Date(d + 'T12:00:00').getTime()
const kg = (m: Metric) => (m.weight_kg != null ? `${fmtKg(m.weight_kg)} kg` : null)

function Chip({ label, m, side }: { label: string; m: Metric; side: 'l' | 'r' }) {
  return (
    <span className={`pc-chip ${side}`}>
      <b>{label}</b>
      <span>
        {fmtDate(m.date, true)}
        {m.weight_kg != null && ` · ${fmtKg(m.weight_kg)} kg`}
      </span>
    </span>
  )
}

/** Before / after: side by side, or one over the other with a slider to wipe between them. */
export function PhotoCompare({ photos, onOpen }: { photos: Metric[]; onOpen: (m: Metric) => void }) {
  const repo = useStore((s) => s.repo)
  const toast = useStore((s) => s.toast)
  const [aId, setAId] = useState<string | null>(null)
  const [bId, setBId] = useState<string | null>(null)
  const [mode, setMode] = useState<'side' | 'slide'>('side')
  const [pos, setPos] = useState(50)
  const [picking, setPicking] = useState<null | 'a' | 'b'>(null)
  const [sharing, setSharing] = useState(false)
  const frame = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const a0 = photos.find((p) => p.id === aId) ?? photos[0]
  const b0 = photos.find((p) => p.id === bId) ?? photos[photos.length - 1]
  const [a, b] = a0.date <= b0.date ? [a0, b0] : [b0, a0]
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
    <section className="card stack pc">
      <div className="card-head">
        <h2>Progress photos</h2>
        <button className="btn icon sm" onClick={share} disabled={sharing} aria-label="Share comparison">
          <Share2 size={18} aria-hidden />
        </button>
      </div>

      <div className="seg block" role="radiogroup" aria-label="Compare view">
        <button role="radio" aria-checked={mode === 'side'} className={mode === 'side' ? 'on' : ''} onClick={() => setMode('side')}>
          Side by side
        </button>
        <button role="radio" aria-checked={mode === 'slide'} className={mode === 'slide' ? 'on' : ''} onClick={() => setMode('slide')}>
          Slider
        </button>
      </div>

      {mode === 'side' ? (
        <div className="pc-frame side">
          <button className="pc-half" onClick={() => onOpen(a)} aria-label={`Open before photo, ${fmtDate(a.date, true)}`}>
            {ua && <img src={ua} alt="" />}
            <Chip label="Before" m={a} side="l" />
          </button>
          <button className="pc-half" onClick={() => onOpen(b)} aria-label={`Open after photo, ${fmtDate(b.date, true)}`}>
            {ub && <img src={ub} alt="" />}
            <Chip label="After" m={b} side="l" />
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
          <Chip label="Before" m={a} side="l" />
          <Chip label="After" m={b} side="r" />
          <input
            className="sr-only"
            type="range"
            min={0}
            max={100}
            value={Math.round(pos)}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Slide between before and after"
          />
        </div>
      )}

      {caption && (
        <div className="pc-stats">
          <div>
            <div className="pc-k">Time between</div>
            <div className="pc-v">
              {days} <span>day{days === 1 ? '' : 's'}</span>
            </div>
          </div>
          {dKg != null && (
            <div>
              <div className="pc-k">Weight change</div>
              <div className="pc-v tnum">
                {dKg > 0 ? '+' : dKg < 0 ? '−' : '±'}
                {fmtKg(Math.abs(dKg))} <span>kg</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="row" style={{ gap: 'var(--s2)' }}>
        <button className="btn grow" onClick={() => setPicking('a')}>
          Change before
        </button>
        <button className="btn grow" onClick={() => setPicking('b')}>
          Change after
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
            Done
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
