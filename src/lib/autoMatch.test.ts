import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from './store'
import { autoMatchNow, declineLibraryPhoto } from './autoMatch'
import { emptyDB, Exercise } from './types'

const ex = (id: string, name: string, muscle: string, image_path: string | null = null, equipment = ''): Exercise => ({
  id,
  user_id: 'u',
  name,
  muscle,
  notes: '',
  setup: '',
  image_path,
  rest_sec: 90,
  created_at: '',
  equipment
})

describe('autoMatchNow', () => {
  let saved: Exercise[]
  beforeEach(() => {
    saved = []
    const mem = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) })
    useStore.setState({ save: ((_t: string, row: Exercise) => saved.push(row)) as any })
  })

  it('gives photo-less exercises their closest library picture and leaves photos alone', async () => {
    useStore.setState({
      db: {
        ...emptyDB(),
        exercises: [
          ex('a', 'Bench Press (Barbell)', 'Chest'),
          ex('b', 'Incline Dumbbell Press', 'Chest', null, 'Dumbbell'),
          ex('c', 'My Weird Machine', 'Back', null, 'Machine'),
          ex('d', 'Leg Press', 'Quads', 'exercises/mine.jpg'),
          ex('e', 'Something', 'Chest', 'lib:Pushups')
        ]
      }
    })
    await autoMatchNow()
    const by = new Map(saved.map((e) => [e.id, e.image_path]))
    expect(by.get('a')).toBe('lib:Barbell_Bench_Press_-_Medium_Grip')
    expect(by.get('b')).toBe('lib:Incline_Dumbbell_Press')
    expect(by.get('c')).toMatch(/^lib:/) // falls back to a well-known back machine
    expect(by.has('d')).toBe(false)
    expect(by.has('e')).toBe(false)
  })

  it('respects "no thanks"', async () => {
    declineLibraryPhoto('z')
    useStore.setState({ db: { ...emptyDB(), exercises: [ex('z', 'Squat (Barbell)', 'Quads')] } })
    await autoMatchNow()
    expect(saved).toEqual([])
  })
})
