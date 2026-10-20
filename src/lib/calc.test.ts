import { describe, expect, it } from 'vitest'
import { evalExpr, isExpr } from './calc'

describe('keypad calculator', () => {
  it('does simple sums with normal precedence', () => {
    expect(evalExpr('20+2*10')).toBe(40)
    expect(evalExpr('20+2×10')).toBe(40)
    expect(evalExpr('(20+2)*10')).toBe(220)
    expect(evalExpr('100-2.5*2')).toBe(95)
    expect(evalExpr('60÷4')).toBe(15)
    expect(evalExpr('7,5+7,5')).toBe(15)
  })
  it('handles plain numbers, unary minus and a trailing operator', () => {
    expect(evalExpr('42')).toBe(42)
    expect(evalExpr('2.5')).toBe(2.5)
    expect(evalExpr('-5+10')).toBe(5)
    expect(evalExpr('20+2*')).toBe(22)
    expect(evalExpr('20−5')).toBe(15)
  })
  it('rounds float noise', () => {
    expect(evalExpr('0.1+0.2')).toBe(0.3)
  })
  it('returns null for junk', () => {
    expect(evalExpr('')).toBeNull()
    expect(evalExpr('.')).toBeNull()
    expect(evalExpr('5/0')).toBeNull()
    expect(evalExpr('2..3')).toBeNull()
    expect(evalExpr('abc')).toBeNull()
  })
  it('knows a sum from a number', () => {
    expect(isExpr('20+2')).toBe(true)
    expect(isExpr('-5')).toBe(false)
    expect(isExpr('60')).toBe(false)
  })
})
