import { get, set, del } from 'idb-keyval'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DB, TableName, emptyDB } from './types'
import { uid } from './uid'

export interface Repo {
  mode: 'local' | 'cloud'
  userId: string
  loadAll(): Promise<DB>
  upsert(table: TableName, row: { id: string }): Promise<void>
  remove(table: TableName, id: string): Promise<void>
  uploadImage(blob: Blob, folder: string): Promise<string>
  imageUrl(path: string | null): Promise<string | null>
  deleteImage(path: string | null): Promise<void>
  /** replace everything (used by import) */
  replaceAll?(db: DB): Promise<void>
  /** cloud only: callbacks for the offline queue */
  setHandlers?(h: { onQueue: (n: number) => void; onError: (msg: string) => void }): void
  /** cloud only: try to send queued changes now */
  flushQueue?(): Promise<void>
}

const TABLES: TableName[] = ['exercises', 'workouts', 'workout_exercises', 'sessions', 'metrics']

/* ------------------------------------------------------------------ */
/* Local (demo) repo: everything lives in IndexedDB on this device      */
/* ------------------------------------------------------------------ */

const LOCAL_KEY = 'gymlog:db:v1'

export class LocalRepo implements Repo {
  mode = 'local' as const
  userId = 'local'
  private db: DB = emptyDB()
  private urlCache = new Map<string, string>()

  async loadAll(): Promise<DB> {
    const saved = await get<DB>(LOCAL_KEY)
    this.db = { ...emptyDB(), ...(saved ?? {}) }
    return structuredClone(this.db)
  }

  private async persist() {
    await set(LOCAL_KEY, this.db)
  }

  async upsert(table: TableName, row: { id: string }) {
    const list = this.db[table] as { id: string }[]
    const i = list.findIndex((r) => r.id === row.id)
    const copy = structuredClone(row)
    if (i >= 0) list[i] = copy
    else list.push(copy)
    await this.persist()
  }

  async remove(table: TableName, id: string) {
    const list = this.db[table] as { id: string }[]
    ;(this.db as any)[table] = list.filter((r) => r.id !== id)
    await this.persist()
  }

  async uploadImage(blob: Blob, folder: string): Promise<string> {
    const path = `local/${folder}/${uid()}.jpg`
    await set('gymlog:img:' + path, blob)
    return path
  }

  async imageUrl(path: string | null): Promise<string | null> {
    if (!path) return null
    const cached = this.urlCache.get(path)
    if (cached) return cached
    const blob = await get<Blob>('gymlog:img:' + path)
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    this.urlCache.set(path, url)
    return url
  }

  async deleteImage(path: string | null) {
    if (!path) return
    await del('gymlog:img:' + path)
    this.urlCache.delete(path)
  }

  async replaceAll(db: DB) {
    this.db = structuredClone(db)
    await this.persist()
  }
}

/* ------------------------------------------------------------------ */
/* Cloud repo: Supabase Postgres (+ row level security) and Storage     */
/*                                                                      */
/* Offline first: every change is applied to a local cache and put in a  */
/* persistent outbox, then sent to Supabase. If the phone has no signal  */
/* the outbox keeps the changes and retries when the network is back.    */
/* ------------------------------------------------------------------ */

const BUCKET = 'gymlog'

type Op =
  | { k: 'up'; table: TableName; id: string; row: any }
  | { k: 'rm'; table: TableName; id: string }

/** Network trouble (retry later) as opposed to a server rejecting the data (retrying will not help). */
export function isRetryable(err: any): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String(err?.message ?? err ?? '')
  if (/jwt|token/i.test(msg) && /expired|invalid/i.test(msg)) return true
  const status = Number(err?.status ?? 0)
  if (status >= 500) return true
  return !err?.code && /fetch|network|load failed|timeout|timed out|aborted|offline/i.test(msg)
}

export class SupabaseRepo implements Repo {
  mode = 'cloud' as const
  private urlCache = new Map<string, { url: string; at: number }>()
  private outbox: Op[] = []
  private cache: DB = emptyDB()
  private flushing: Promise<void> | null = null
  private blocked = false // last attempt hit a network error
  private handlers: { onQueue: (n: number) => void; onError: (msg: string) => void } | null = null

  constructor(private sb: SupabaseClient, public userId: string) {}

  setHandlers(h: { onQueue: (n: number) => void; onError: (msg: string) => void }) {
    this.handlers = h
    h.onQueue(this.outbox.length)
  }

  private k = (name: string) => `gymlog:${name}:${this.userId}`
  private saveCache = () => set(this.k('cache'), this.cache)
  private async saveOutbox() {
    await set(this.k('outbox'), this.outbox)
    this.handlers?.onQueue(this.outbox.length)
  }

  private async fetchAll(): Promise<DB> {
    const db = emptyDB()
    for (const t of TABLES) {
      const rows: any[] = []
      const page = 1000
      // keep going until an empty page (a project may cap rows per request below 1000)
      for (let from = 0; ; from += page) {
        const { data, error } = await this.sb
          .from(t)
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + page - 1)
        if (error) throw Object.assign(new Error(`${t}: ${error.message}`), { code: (error as any).code, status: (error as any).status })
        if (!data || data.length === 0) break
        rows.push(...data)
      }
      ;(db as any)[t] = rows
    }
    return db
  }

  async loadAll(): Promise<DB> {
    this.outbox = (await get<Op[]>(this.k('outbox'))) ?? []
    const saved = await get<DB>(this.k('cache'))
    this.cache = { ...emptyDB(), ...(saved ?? {}) }
    this.handlers?.onQueue(this.outbox.length)
    await this.flushQueue()
    if (this.outbox.length === 0) {
      try {
        const db = await this.fetchAll()
        this.cache = db
        await this.saveCache()
        return structuredClone(db)
      } catch (e: any) {
        // offline at the gym: fall back to the last copy we saw, if there is one
        if (!saved || !isRetryable(e)) throw e
      }
    } else if (!saved) {
      throw new Error('Offline and nothing saved on this device yet. Connect once to load your data.')
    }
    return structuredClone(this.cache)
  }

  private applyToCache(op: Op) {
    const list = this.cache[op.table] as { id: string }[]
    if (op.k === 'up') {
      const i = list.findIndex((r) => r.id === op.id)
      if (i >= 0) list[i] = structuredClone(op.row)
      else list.push(structuredClone(op.row))
    } else {
      ;(this.cache as any)[op.table] = list.filter((r) => r.id !== op.id)
    }
  }

  private async enqueueOp(op: Op) {
    this.applyToCache(op)
    if (op.k === 'up') {
      // update in place so parents always stay ahead of their children in the queue
      const i = this.outbox.findIndex((o) => o.k === 'up' && o.table === op.table && o.id === op.id)
      if (i >= 0) this.outbox[i] = op
      else this.outbox.push(op)
    } else {
      this.outbox = this.outbox.filter((o) => !(o.k === 'up' && o.table === op.table && o.id === op.id))
      this.outbox.push(op)
    }
    await Promise.all([this.saveCache(), this.saveOutbox()])
    await this.flushQueue()
    // a change added while a run was finishing may still be waiting
    if (this.outbox.length && !this.blocked) await this.flushQueue()
  }

  async upsert(table: TableName, row: { id: string }) {
    await this.enqueueOp({ k: 'up', table, id: row.id, row: { ...row, user_id: this.userId } })
  }

  async remove(table: TableName, id: string) {
    await this.enqueueOp({ k: 'rm', table, id })
  }

  /** Send queued changes, one at a time and in order. Only one run at a time; callers share it. */
  flushQueue(): Promise<void> {
    if (this.flushing) return this.flushing
    // .finally() runs after this assignment, so `flushing` is always cleared (a try/finally inside an
    // async function that never awaits would clear it too early)
    const p: Promise<void> = this.runFlush().finally(() => {
      if (this.flushing === p) this.flushing = null
    })
    this.flushing = p
    return p
  }

  private async runFlush(): Promise<void> {
    while (this.outbox.length) {
      const op = this.outbox[0]
      let error: any = null
      try {
        const res =
          op.k === 'up'
            ? await this.sb.from(op.table).upsert(op.row)
            : await this.sb.from(op.table).delete().eq('id', op.id)
        error = res.error
      } catch (e) {
        error = e
      }
      if (!error) {
        this.blocked = false
        this.outbox.shift()
        await this.saveOutbox()
        continue
      }
      if (isRetryable(error)) {
        this.blocked = true
        return // keep everything, try again when the network is back
      }
      this.outbox.shift() // the server refused this change; retrying will not help
      await this.saveOutbox()
      this.handlers?.onError(`${op.table}: ${error.message ?? error}`)
    }
  }

  async uploadImage(blob: Blob, folder: string): Promise<string> {
    const path = `${this.userId}/${folder}/${uid()}.jpg`
    const { error } = await this.sb.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false
    })
    if (error) throw new Error(`Photo upload failed (${error.message}). Photos need a connection.`)
    return path
  }

  async imageUrl(path: string | null): Promise<string | null> {
    if (!path) return null
    const c = this.urlCache.get(path)
    if (c && Date.now() - c.at < 45 * 60 * 1000) return c.url
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrl(path, 3600)
    if (error || !data) return null
    this.urlCache.set(path, { url: data.signedUrl, at: Date.now() })
    return data.signedUrl
  }

  async deleteImage(path: string | null) {
    if (!path) return
    try {
      await this.sb.storage.from(BUCKET).remove([path])
    } catch {
      /* best effort */
    }
    this.urlCache.delete(path)
  }
}
