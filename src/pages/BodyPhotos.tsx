import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Metric } from '../lib/types'
import { Empty, PageHeader } from '../components/ui'
import { PhotoTile, PhotoViewer } from '../components/PhotoViewer'
import { EntrySheet } from './Body'
import { weightNear } from '../lib/photos'
import { Camera, Check } from 'lucide-react'
import { useImageUrl } from '../components/ui'

const monthOf = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

/** Every progress photo, newest first, by month. Tap one for the full-screen viewer. */
export default function BodyPhotos() {
  const metrics = useStore((s) => s.db.metrics)
  const photos = useMemo(() => metrics.filter((m) => m.photo_path).sort((a, b) => b.date.localeCompare(a.date)), [metrics])
  const [open, setOpen] = useState<number | null>(null)
  const [editing, setEditing] = useState<Metric | null>(null)
  // compare mode: tap two photos, then see them side by side on Body
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const nav = useNavigate()
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]))

  const months = useMemo(() => {
    const out: { label: string; items: { m: Metric; i: number }[] }[] = []
    photos.forEach((m, i) => {
      const label = monthOf(m.date)
      if (out[out.length - 1]?.label !== label) out.push({ label, items: [] })
      out[out.length - 1].items.push({ m, i })
    })
    return out
  }, [photos])

  return (
    <div className="stack" style={{ gap: 'var(--s5)', paddingBottom: picking ? 72 : 0 }}>
      <PageHeader
        title="Photos"
        sub={picking ? 'Pick two photos to compare' : `${photos.length} progress photo${photos.length === 1 ? '' : 's'}`}
        back="/body"
        action={
          photos.length >= 2 && (
            <button
              className={`btn sm${picking ? ' primary' : ''}`}
              onClick={() => {
                setPicking(!picking)
                setPicked([])
              }}
              aria-pressed={picking}
            >
              {picking ? 'Cancel' : 'Compare'}
            </button>
          )
        }
      />
      {photos.length === 0 && <Empty icon={<Camera size={28} />} title="No photos yet" text="Add a progress photo when you log your weight." />}
      {months.map((g) => (
        <section key={g.label}>
          <div className="section-label">
            <span>{g.label}</span>
            <span className="count">{g.items.length}</span>
          </div>
          <div className="ph-grid">
            {g.items.map(({ m, i }) =>
              picking ? (
                <SelectTile key={m.id} m={m} n={picked.indexOf(m.id)} onTap={() => toggle(m.id)} />
              ) : (
                <PhotoTile key={m.id} m={m} kg={weightNear(m, metrics)} onOpen={() => setOpen(i)} />
              )
            )}
          </div>
        </section>
      ))}
      {picking && (
        <div className="ph-pickbar">
          <button className="btn primary block" disabled={picked.length < 2} onClick={() => nav('/body', { state: { compare: picked } })}>
            {picked.length < 2 ? `Pick ${2 - picked.length} more` : 'Compare these two'}
          </button>
        </div>
      )}
      {open != null && (
        <PhotoViewer
          photos={photos}
          start={open}
          onClose={() => setOpen(null)}
          kgOf={(m) => weightNear(m, metrics)}
          onEdit={(m) => {
            setOpen(null)
            setEditing(m)
          }}
        />
      )}
      {editing && <EntrySheet entry={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** A tile in compare mode: a numbered check once picked. */
function SelectTile({ m, n, onTap }: { m: Metric; n: number; onTap: () => void }) {
  const url = useImageUrl(m.photo_path)
  const on = n >= 0
  return (
    <button className={`ph-tile${on ? ' on' : ''}`} onClick={onTap} aria-pressed={on} aria-label={`Photo from ${m.date}${on ? ', picked' : ''}`}>
      {url && <img src={url} alt="" />}
      <span className="ph-tile-date" aria-hidden>
        {new Date(m.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </span>
      <span className={`ph-tile-check${on ? '' : ' off'}`} aria-hidden>
        {on && <Check size={16} />}
      </span>
    </button>
  )
}
