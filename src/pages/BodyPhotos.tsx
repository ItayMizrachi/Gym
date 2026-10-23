import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Metric } from '../lib/types'
import { Empty, PageHeader } from '../components/ui'
import { PhotoTile, PhotoViewer } from '../components/PhotoViewer'
import { EntrySheet } from './Body'
import { Camera } from 'lucide-react'

const monthOf = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

/** Every progress photo, newest first, by month. Tap one for the full-screen viewer. */
export default function BodyPhotos() {
  const metrics = useStore((s) => s.db.metrics)
  const photos = useMemo(() => metrics.filter((m) => m.photo_path).sort((a, b) => b.date.localeCompare(a.date)), [metrics])
  const [open, setOpen] = useState<number | null>(null)
  const [editing, setEditing] = useState<Metric | null>(null)

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
    <div className="stack" style={{ gap: 'var(--s5)' }}>
      <PageHeader title="Photos" sub={`${photos.length} progress photo${photos.length === 1 ? '' : 's'}`} back="/body" />
      {photos.length === 0 && <Empty icon={<Camera size={28} />} title="No photos yet" text="Add a progress photo when you log your weight." />}
      {months.map((g) => (
        <section key={g.label}>
          <div className="section-label">
            <span>{g.label}</span>
            <span className="count">{g.items.length}</span>
          </div>
          <div className="ph-grid">
            {g.items.map(({ m, i }) => (
              <PhotoTile key={m.id} m={m} onOpen={() => setOpen(i)} />
            ))}
          </div>
        </section>
      ))}
      {open != null && (
        <PhotoViewer
          photos={photos}
          start={open}
          onClose={() => setOpen(null)}
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
