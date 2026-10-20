export function fmtKg(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '–'
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

export function fmtDate(iso: string, withYear = false): string {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {})
  })
}

export function fmtDateLong(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDuration(startIso: string, endIso: string | null): string {
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const mins = Math.max(0, Math.round((end - new Date(startIso).getTime()) / 60000))
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function fmtRest(sec: number): string {
  return fmtClock(sec)
}

/** "2:45" or "165" -> seconds */
export function parseRest(input: string): number {
  const t = input.trim()
  if (t.includes(':')) {
    const [m, s] = t.split(':')
    return Math.max(0, (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0))
  }
  return Math.max(0, parseInt(t, 10) || 0)
}

export function parseNum(input: string): number | null {
  const t = input.replace(',', '.').trim()
  if (t === '') return null
  const n = parseFloat(t)
  return Number.isNaN(n) ? null : n
}

export function roundTo(n: number, step = 0.5): number {
  return Math.round(n / step) * step
}
