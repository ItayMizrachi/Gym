import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { Calculator, ChevronDown, Delete, Disc, Keyboard } from 'lucide-react'
import { evalExpr, isExpr } from '../lib/calc'
import { fmtKg, parseNum } from '../lib/format'
import { fmtTime, parseTime } from '../lib/tracking'
import { PlateCalc } from './PlateCalc'
import '../styles/workout-live.css'

export type KpKind = 'kg' | 'reps' | 'time'

export interface KpFieldSpec {
  /** unique on the page; "Next" walks fields in page order */
  id: string
  kind: KpKind
  value: number | null
  /** used as the starting point for −/+ when the field is empty */
  placeholder?: number | null
  /** e.g. "Set 2 · kg" */
  label: string
  onChange: (n: number | null) => void
}

/* ---------- which keyboard to use (per device) ---------- */

const MODE_KEY = 'gymlog:keypad'
type Mode = 'app' | 'native'
const listeners = new Set<(m: Mode) => void>()

export function getKeypadMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'native' ? 'native' : 'app'
  } catch {
    return 'app'
  }
}
export function setKeypadMode(m: Mode) {
  try {
    localStorage.setItem(MODE_KEY, m)
  } catch {
    /* private mode: still switch for this visit */
  }
  listeners.forEach((l) => l(m))
}
/** [mode, setMode] — Settings can use this for a "Use the GymLog number pad" switch. */
export function useKeypadMode(): [Mode, (m: Mode) => void] {
  const [mode, set] = useState<Mode>(getKeypadMode)
  useEffect(() => {
    listeners.add(set)
    return () => void listeners.delete(set)
  }, [])
  return [mode, setKeypadMode]
}

/* ---------- text <-> number ---------- */

const STEP: Record<KpKind, number> = { kg: 2.5, reps: 1, time: 15 }
const fmtVal = (kind: KpKind, n: number | null | undefined) => (n == null ? '' : kind === 'time' ? fmtTime(n) : fmtKg(n))

/** undefined = the text is not a finished value yet (e.g. "20+"), so leave the field alone */
function parseText(kind: KpKind, text: string): number | null | undefined {
  if (text === '') return null
  if (kind === 'time') return parseTime(text) ?? undefined
  const n = isExpr(text) ? evalExpr(text) : parseNum(text)
  if (n == null) return undefined
  const v = Math.max(0, n)
  return kind === 'reps' ? Math.round(v) : Math.round(v * 100) / 100
}

/* ---------- context ---------- */

interface Ctx {
  mode: Mode
  activeId: string | null
  text: string
  open: (f: KpFieldSpec) => void
}
const KpCtx = createContext<Ctx | null>(null)

/** Wrap a screen with this; KpField inside it opens the keypad. */
export function KeypadProvider({ children }: { children: ReactNode }) {
  const [mode] = useKeypadMode()
  const [field, setField] = useState<KpFieldSpec | null>(null)
  const [text, setText] = useState('')
  const [fresh, setFresh] = useState(true)
  const [calc, setCalc] = useState(false)
  const [plates, setPlates] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  // handlers read the latest state through this ref (the keydown / pointerdown listeners outlive renders)
  const st = useRef({ field, text, fresh, calc, plates })
  st.current = { field, text, fresh, calc, plates }

  const open = useCallback((f: KpFieldSpec) => {
    setField(f)
    setText(fmtVal(f.kind, f.value))
    setFresh(true)
    setCalc(false)
    st.current = { ...st.current, field: f, text: fmtVal(f.kind, f.value), fresh: true, calc: false }
    // bring the field into the part of the screen the keypad does not cover
    setTimeout(() => {
      const el = document.querySelector(`[data-kp="${CSS.escape(f.id)}"]`)
      const kpH = panel.current?.offsetHeight ?? 300
      if (!el) return
      const r = el.getBoundingClientRect()
      const target = 150 + (window.innerHeight - kpH - 150) / 2
      window.scrollBy({ top: r.top + r.height / 2 - target, behavior: 'smooth' })
    }, 30)
  }, [])

  function apply(next: string, keepFresh = false) {
    const f = st.current.field
    if (!f) return
    setText(next)
    st.current.text = next
    if (!keepFresh) {
      setFresh(false)
      st.current.fresh = false
    }
    const n = parseText(f.kind, next)
    if (n !== undefined) f.onChange(n)
  }

  /** settle a sum into its result before leaving the field */
  function commit() {
    const { field: f, text: t } = st.current
    if (!f) return
    if (f.kind !== 'time' && isExpr(t)) {
      const n = parseText(f.kind, t)
      if (n != null) apply(fmtVal(f.kind, n))
    }
  }

  function close() {
    commit()
    setField(null)
    setPlates(false)
  }

  function next() {
    const f = st.current.field
    commit()
    const all = [...document.querySelectorAll<HTMLElement>('[data-kp]')].filter((el) => !(el as HTMLButtonElement).disabled)
    const i = all.findIndex((el) => el.dataset.kp === f?.id)
    const nxt = i >= 0 ? all[i + 1] : undefined
    if (nxt) nxt.click()
    else close()
  }

  function press(k: string) {
    const { field: f, text: t, fresh: isFresh } = st.current
    if (!f) return
    const base = isFresh ? '' : t
    if (/^\d$/.test(k)) {
      const cand = base + k
      // keep plain numbers sane: two decimals for kg, 4 digits for reps
      if (!isExpr(cand) && f.kind === 'kg' && /\.\d{3,}$/.test(cand)) return
      if (f.kind === 'reps' && !isExpr(cand) && cand.length > 4) return
      if (f.kind === 'time' && cand.replace(':', '').length > 5) return
      return apply(cand)
    }
    if (k === '.') {
      const seg = base.split(/[-+*/×÷−]/).pop() ?? ''
      if (seg.includes('.')) return
      return apply(base + (seg === '' ? '0.' : '.'))
    }
    if (k === ':') {
      if (base.includes(':')) return
      return apply((base || '0') + ':')
    }
    if (k === 'back') return apply(isFresh ? '' : t.slice(0, -1))
    if ('+−×÷'.includes(k)) {
      const cur = isFresh ? fmtVal(f.kind, f.value) || '0' : t
      return apply(/[-+*/×÷−]$/.test(cur) ? cur.slice(0, -1) + k : cur + k)
    }
    if (k === '=') {
      const n = parseText(f.kind, t)
      if (n != null) apply(fmtVal(f.kind, n), true)
      setFresh(true)
      st.current.fresh = true
      return
    }
    if (k === 'dec' || k === 'inc') {
      const cur = parseText(f.kind, t)
      const start = cur ?? f.placeholder ?? 0
      const v = Math.max(0, Math.round((start + (k === 'inc' ? 1 : -1) * STEP[f.kind]) * 100) / 100)
      apply(fmtVal(f.kind, v), true)
      setFresh(true)
      st.current.fresh = true
    }
  }

  // hardware keys (desktop, Bluetooth keyboards) and tap-outside to dismiss
  useEffect(() => {
    if (!field) return
    const onKey = (e: KeyboardEvent) => {
      if (st.current.plates) return
      const k = e.key
      if (/^\d$/.test(k) || k === '.' || k === ',') press(k === ',' ? '.' : k)
      else if (k === ':' && st.current.field?.kind === 'time') press(':')
      else if (k === 'Backspace') press('back')
      else if (k === '+' || k === '-' || k === '*' || k === '/') {
        if (st.current.field?.kind === 'time') return
        setCalc(true)
        press({ '+': '+', '-': '−', '*': '×', '/': '÷' }[k]!)
      } else if (k === 'Enter' || k === 'Tab') next()
      else if (k === 'Escape') close()
      else return
      e.preventDefault()
    }
    const onDown = (e: PointerEvent) => {
      if (st.current.plates) return
      const t = e.target as Element
      if (panel.current?.contains(t) || t.closest?.('[data-kp]')) return
      close()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [field?.id])

  const kind = field?.kind
  const result = calc && field && kind !== 'time' && isExpr(text) ? parseText(field.kind, text) : undefined
  const unit = kind === 'kg' ? 'kg' : kind === 'reps' ? 'rep' : 's'
  const stepTxt = kind === 'time' ? '15s' : kind === 'kg' ? `2.5` : '1'

  const keys: { k: string; label: ReactNode; cls?: string; aria?: string }[] = calc
    ? [
        ...['1', '2', '3'].map((k) => ({ k, label: k })),
        { k: 'back', label: <Delete size={22} />, cls: 'fn', aria: 'Delete' },
        { k: '÷', label: '÷', cls: 'op' },
        ...['4', '5', '6'].map((k) => ({ k, label: k })),
        { k: '−', label: '−', cls: 'op' },
        { k: '×', label: '×', cls: 'op' },
        ...['7', '8', '9'].map((k) => ({ k, label: k })),
        { k: '+', label: '+', cls: 'op' },
        { k: '=', label: '=', cls: 'op' },
        { k: '.', label: '.' },
        { k: '0', label: '0' },
        { k: 'next', label: 'Next', cls: 'next span3' }
      ]
    : [
        ...['1', '2', '3'].map((k) => ({ k, label: k })),
        { k: 'back', label: <Delete size={22} />, cls: 'fn', aria: 'Delete' },
        ...['4', '5', '6'].map((k) => ({ k, label: k })),
        { k: 'dec', label: `−${stepTxt}`, cls: 'fn', aria: `Minus ${stepTxt} ${unit}` },
        ...['7', '8', '9'].map((k) => ({ k, label: k })),
        { k: 'inc', label: `+${stepTxt}`, cls: 'fn', aria: `Plus ${stepTxt} ${unit}` },
        kind === 'time' ? { k: ':', label: ':' } : kind === 'reps' ? { k: '', label: '', cls: 'blank' } : { k: '.', label: '.' },
        { k: '0', label: '0' },
        { k: 'next', label: 'Next', cls: 'next span2' }
      ]

  return (
    <KpCtx.Provider value={{ mode, activeId: field?.id ?? null, text: result != null ? fmtVal(kind!, result) : text, open }}>
      {children}
      {field && <div className="kp-spacer" aria-hidden />}
      {field && !plates && (
        <div ref={panel} className="kp" role="group" aria-label={`Number pad: ${field.label}`}>
          <div className="kp-bar">
            {kind !== 'time' && (
              <button className={`kp-tool ${calc ? 'on' : ''}`} onClick={() => setCalc((c) => !c)} aria-pressed={calc}>
                <Calculator size={17} /> {tr("Calculator")}
              </button>
            )}
            {kind === 'kg' && (
              <button className="kp-tool" onClick={() => setPlates(true)}>
                <Disc size={17} /> {tr("Plates")}
              </button>
            )}
            <button
              className="kp-tool"
              aria-label={tr("Use the phone keyboard")}
              onClick={() => {
                const id = field.id
                close()
                setKeypadMode('native')
                setTimeout(() => document.querySelector<HTMLInputElement>(`[data-kp-native="${CSS.escape(id)}"] input`)?.focus(), 50)
              }}
            >
              <Keyboard size={17} />
            </button>
            <div className="grow kp-label ellipsis">{calc && isExpr(text) ? `${text} = ${result != null ? fmtVal(kind!, result) : '…'}` : field.label}</div>
            <button className="kp-tool" onClick={close} aria-label={tr("Close number pad")}>
              <ChevronDown size={20} />
            </button>
          </div>
          <div className={`kp-grid ${calc ? 'calc' : ''}`}>
            {keys.map((x, i) =>
              x.cls === 'blank' ? (
                <div key={i} />
              ) : (
                <button
                  key={x.k + i}
                  className={`kp-key ${x.cls ?? ''}`}
                  aria-label={x.aria}
                  onClick={() => (x.k === 'next' ? next() : press(x.k))}
                >
                  {x.label}
                </button>
              )
            )}
          </div>
        </div>
      )}
      {field && plates && (
        <PlateCalc
          weight={parseText('kg', text) ?? field.value ?? 0}
          onClose={() => setPlates(false)}
          onUse={(kg) => {
            apply(fmtVal('kg', kg), true)
            setFresh(true)
          }}
        />
      )}
    </KpCtx.Provider>
  )
}

/**
 * A number field that opens the GymLog keypad. Outside a KeypadProvider, or when the user picked the
 * phone keyboard, it renders `native` instead.
 */
export function KpField({
  spec,
  native,
  className = 'num',
  disabled,
  display
}: {
  spec: KpFieldSpec
  native: ReactNode
  className?: string
  disabled?: boolean
  /** text to show instead of the formatted value (e.g. a running stopwatch) */
  display?: string
}) {
  const ctx = useContext(KpCtx)
  if (!ctx || ctx.mode === 'native')
    return (
      <div className="kp-native" data-kp-native={spec.id}>
        {native}
      </div>
    )
  const active = ctx.activeId === spec.id
  const shown = display ?? (active ? ctx.text : fmtVal(spec.kind, spec.value))
  const ph = spec.placeholder != null ? fmtVal(spec.kind, spec.placeholder) : spec.kind === 'time' ? '0:00' : ''
  return (
    <button
      type="button"
      className={`${className} kp-field ${active ? 'active' : ''} ${shown ? '' : 'kp-empty'}`}
      data-kp={spec.id}
      disabled={disabled}
      aria-label={`${spec.label}: ${shown || 'empty'}`}
      onClick={() => ctx.open(spec)}
    >
      {shown || ph}
    </button>
  )
}
