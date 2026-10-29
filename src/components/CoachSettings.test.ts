import { describe, expect, it } from 'vitest'
import { cleanCode } from './CoachSettings'

describe('coach code field', () => {
  it('keeps a typed code', () => expect(cleanCode('a1b2c3')).toBe('A1B2C3'))
  it('takes the code out of a pasted invite message', () =>
    expect(cleanCode('Join me on GymLog so I can coach you: open https://x.y/, go to Settings → My coach and enter the code 9F3KQ2')).toBe('9F3KQ2'))
})
