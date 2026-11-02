import { describe, expect, it } from 'vitest'
import { buildProgram, programById } from './programs'
import { keepMine, outdatedPrograms, programChanges, programUpdate } from './programUpdates'
import { emptyDB, type DB } from './types'

const p = programById('ultimate-4')!

function savedAt(version: number): DB {
  const rows = buildProgram(p, 'u', [], [])
  const db = { ...emptyDB(), exercises: rows.exercises, workouts: rows.workouts.map((w) => ({ ...w, program_version: version })), workout_exercises: rows.workout_exercises }
  return db
}

describe('ready-made program updates', () => {
  it('a fresh copy is up to date and remembers where it came from', () => {
    const db = savedAt(p.version ?? 1)
    expect(db.workouts.every((w) => w.program === 'ultimate-4')).toBe(true)
    expect(outdatedPrograms(db)).toEqual([])
  })

  it('an older copy is offered the update; changes are listed; nothing changes until they choose', () => {
    const db = savedAt(1)
    // their copy differs: one exercise less in Upper A
    const upperA = db.workouts.find((w) => w.name === 'Upper A')!
    const first = db.workout_exercises.find((r) => r.workout_id === upperA.id && r.position === 1)!
    db.workout_exercises = db.workout_exercises.filter((r) => r.id !== first.id)
    const [o] = outdatedPrograms(db)
    expect(o.program.id).toBe('ultimate-4')
    const ch = programChanges(db, o)
    expect(ch.find((c) => c.name === 'Upper A')!.lines[0]).toMatch(/^Added /)
  })

  it('updating rebuilds each workout from the new version, reusing their exercises; keep mine only stops asking', () => {
    const db = savedAt(1)
    const [o] = outdatedPrograms(db)
    const u = programUpdate(db, o, 'u')
    expect(u.exercises).toEqual([])
    expect(u.remove.length).toBe(db.workout_exercises.length)
    expect(u.rows.length).toBe(p.workouts.reduce((n, w) => n + w.exercises.length, 0))
    expect(u.workouts.every((w) => w.program_version === p.version)).toBe(true)
    expect(u.rows.some((r) => r.warmup)).toBe(true)
    expect(keepMine(o).every((w) => w.program_version === p.version)).toBe(true)
  })
})
