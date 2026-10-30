import { describe, expect, it } from 'vitest'
import { englishQuery } from './hebrewSearch'
import raw from '../data/library.json'
import { LIBRARY_EXTRA } from '../data/libraryExtra'
import { fromRaw, searchLibrary } from './library'

const all = [...(raw as never[]), ...LIBRARY_EXTRA].map((r) => fromRaw(r as never))
const top = (q: string) => searchLibrary(all, { q }).slice(0, 8).map((e) => e.name)

describe('Hebrew exercise search', () => {
  it('turns gym Hebrew into library words', () => {
    expect(englishQuery('לחיצת חזה')).toBe('bench press')
    expect(englishQuery('סקוואט מוט')).toBe('squat barbell')
    expect(englishQuery('Bench')).toBe('Bench')
  })
  it('finds the lifts', () => {
    expect(top('לחיצת חזה').some((n) => /bench press/i.test(n))).toBe(true)
    expect(top('דדליפט רומני').some((n) => /romanian deadlift/i.test(n))).toBe(true)
    expect(top('תאומים').some((n) => /calf/i.test(n))).toBe(true)
    expect(top('פולי עליון').some((n) => /pulldown/i.test(n))).toBe(true)
  })
})
