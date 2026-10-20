/**
 * Tiny calculator for the number keypad: + − × ÷ (also - * / x), decimals with . or ,
 * normal precedence, unary minus and brackets. "20+2*10" -> 40. Returns null for anything it cannot read.
 * A trailing operator is ignored, so the result can be shown live while typing ("20+2*" -> 22).
 */
export function evalExpr(input: string): number | null {
  const src = input
    .replace(/[×xX]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/[-+*/]+$/, '')
  if (!src) return null
  let i = 0
  const peek = () => src[i]
  function num(): number | null {
    const m = /^\d*\.?\d*/.exec(src.slice(i))
    const t = m ? m[0] : ''
    if (!t || t === '.') return null
    i += t.length
    return parseFloat(t)
  }
  function factor(): number | null {
    if (peek() === '-') {
      i++
      const v = factor()
      return v == null ? null : -v
    }
    if (peek() === '+') {
      i++
      return factor()
    }
    if (peek() === '(') {
      i++
      const v = expr()
      if (peek() === ')') i++
      return v
    }
    return num()
  }
  function term(): number | null {
    let v = factor()
    while (v != null && (peek() === '*' || peek() === '/')) {
      const op = src[i++]
      const r = factor()
      if (r == null) return null
      if (op === '/' && r === 0) return null
      v = op === '*' ? v * r : v / r
    }
    return v
  }
  function expr(): number | null {
    let v = term()
    while (v != null && (peek() === '+' || peek() === '-')) {
      const op = src[i++]
      const r = term()
      if (r == null) return null
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  const v = expr()
  if (v == null || i !== src.length || !Number.isFinite(v)) return null
  return Math.round(v * 1000) / 1000
}

/** True when the text has an operator after the first character (so it is a sum, not a plain number). */
export const isExpr = (t: string) => /[-+*/×÷−x]/.test(t.slice(1))
