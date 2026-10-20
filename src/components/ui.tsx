import { ReactNode, useEffect, useRef, useState } from 'react'
import { X, Camera, Trash2, ImageIcon } from 'lucide-react'
import { useStore } from '../lib/store'
import { resizeImage } from '../lib/images'

/* ---------- image helpers ---------- */

export function useImageUrl(path: string | null | undefined): string | null {
  const repo = useStore((s) => s.repo)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setUrl(null)
    if (!path || !repo) return
    repo.imageUrl(path).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [path, repo])
  return url
}

export function Thumb({ path, size, className = '' }: { path: string | null | undefined; size?: number; className?: string }) {
  const url = useImageUrl(path)
  return (
    <div className={`thumb ${className}`} style={size ? { width: size, height: size } : undefined}>
      {url ? <img src={url} alt="" loading="lazy" /> : <ImageIcon size={20} />}
    </div>
  )
}

/** Choose / take a photo, resize it, upload it, return the stored path. */
export function ImageField({
  path,
  folder,
  onChange,
  large = false,
  label = 'Add photo',
  autoDelete = true
}: {
  path: string | null
  folder: string
  onChange: (p: string | null) => void
  large?: boolean
  label?: string
  /** delete the replaced / removed file straight away. Turn off when the parent saves later (e.g. a form with a Save button). */
  autoDelete?: boolean
}) {
  const repo = useStore((s) => s.repo)
  const toast = useStore((s) => s.toast)
  const url = useImageUrl(path)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file || !repo) return
    setBusy(true)
    try {
      const blob = await resizeImage(file)
      const newPath = await repo.uploadImage(blob, folder)
      const old = path
      onChange(newPath)
      if (old && autoDelete) void repo.deleteImage(old)
    } catch (e: any) {
      toast({ kind: 'error', text: 'Photo failed', sub: String(e?.message ?? e) })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {url && (
        <div className={large ? 'thumb lg' : 'thumb'} style={large ? undefined : { width: 96, height: 96 }}>
          <img src={url} alt="" />
        </div>
      )}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button className="btn sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Camera size={16} /> {busy ? 'Uploading…' : url ? 'Change photo' : label}
        </button>
        {url && (
          <button
            className="btn sm danger"
            onClick={() => {
              const old = path
              onChange(null)
              if (old && repo && autoDelete) void repo.deleteImage(old)
            }}
          >
            <Trash2 size={16} /> Remove
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- modal ---------- */

export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 className="grow">{title}</h2>
          <button className="btn icon sm ghost" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({
  title,
  text,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onClose
}: {
  title: string
  text?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      {text && <p className="muted" style={{ marginTop: 0 }}>{text}</p>}
      <div className="row">
        <button className="btn grow" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`btn grow ${danger ? 'danger' : 'primary'}`}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}

/* ---------- numeric input that tolerates "62." while typing ---------- */

export function NumInput({
  value,
  onChange,
  placeholder,
  decimal = true,
  className = 'num',
  ariaLabel
}: {
  value: number | null
  onChange: (n: number | null) => void
  placeholder?: string
  decimal?: boolean
  className?: string
  ariaLabel?: string
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value == null ? '' : String(value))
  }, [value])
  return (
    <input
      className={className}
      inputMode={decimal ? 'decimal' : 'numeric'}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onFocus={(e) => {
        focused.current = true
        e.target.select()
      }}
      onBlur={() => {
        focused.current = false
        setText(value == null ? '' : String(value))
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.')
        if (!/^\d*\.?\d*$/.test(raw)) return
        setText(raw)
        if (raw === '' || raw === '.') onChange(null)
        else {
          const n = parseFloat(raw)
          if (!Number.isNaN(n)) onChange(n)
        }
      }}
    />
  )
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} />
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="card center stack" style={{ padding: 28 }}>
      <h2>{title}</h2>
      {text && <div className="muted">{text}</div>}
      {children}
    </div>
  )
}
