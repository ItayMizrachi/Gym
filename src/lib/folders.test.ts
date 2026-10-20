import { describe, expect, it } from 'vitest'
import { groupByFolder, listFolders, NO_FOLDER } from './folders'
import { Workout } from './types'

const w = (id: string, position: number, folder?: string): Workout => ({ id, user_id: 'u', name: id, notes: '', position, created_at: '', folder })

describe('folders', () => {
  const ws = [w('a', 3, 'PPL'), w('b', 0), w('c', 1, ' 5x5 '), w('d', 2, 'PPL'), w('e', 4, '')]

  it('lists folder names in order of first appearance, trimmed', () => {
    expect(listFolders(ws)).toEqual(['5x5', 'PPL'])
  })

  it('groups unfiled workouts first under "My workouts"', () => {
    const g = groupByFolder(ws)
    expect(g.map((x) => x.label)).toEqual([NO_FOLDER, '5x5', 'PPL'])
    expect(g[0].workouts.map((x) => x.id)).toEqual(['b', 'e'])
    expect(g[2].workouts.map((x) => x.id)).toEqual(['d', 'a'])
  })

  it('treats a missing folder field like no folder (old rows)', () => {
    expect(groupByFolder([w('x', 0)])).toEqual([{ folder: '', label: NO_FOLDER, workouts: [w('x', 0)] }])
  })
})
