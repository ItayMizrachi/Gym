import { create } from 'zustand'
import { t as tr } from './i18n'
import { DB, TableName, emptyDB } from './types'
import { LocalRepo, Repo, SupabaseRepo } from './db'
import { cloudConfigured, supabase } from './supabase'
import { uid } from './uid'

export interface ToastMsg {
  id: string
  text: string
  sub?: string
  kind: 'info' | 'pr' | 'near' | 'error'
}

export interface RestTimer {
  endsAt: number
  total: number
  label: string
  finished: boolean
}

interface State {
  queued: number
  phase: 'booting' | 'login' | 'ready'
  repo: Repo | null
  user: { id: string; email: string | null } | null
  db: DB
  bootError: string | null
  toasts: ToastMsg[]
  rest: RestTimer | null
  pending: number
  syncError: string | null

  boot: () => Promise<void>
  enterLocal: () => Promise<void>
  leaveLocal: () => void
  signOut: () => Promise<void>
  save: <T extends { id: string }>(table: TableName, row: T, opts?: { debounce?: number }) => void
  saveMany: (table: TableName, rows: { id: string }[]) => void
  remove: (table: TableName, id: string) => void
  replaceDb: (db: DB) => Promise<void>
  toast: (t: Omit<ToastMsg, 'id'>) => void
  dismissToast: (id: string) => void
  startRest: (sec: number, label: string) => void
  adjustRest: (deltaSec: number) => void
  clearRest: () => void
  flush: () => Promise<void>
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
// All database writes run one after another, so a workout is always saved before its exercises.
let writeChain: Promise<unknown> = Promise.resolve()
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn)
  writeChain = run.catch(() => undefined)
  return run
}
const LOCAL_FLAG = 'gymlog:mode'
const REST_KEY = 'gymlog:rest'
let bootStarted = false

function loadRest(): RestTimer | null {
  try {
    const r = JSON.parse(localStorage.getItem(REST_KEY) ?? 'null') as RestTimer | null
    if (!r) return null
    const over = Date.now() - r.endsAt
    if (over > 90_000) return null // stale
    return { ...r, finished: over >= 0 }
  } catch {
    return null
  }
}
function storeRest(r: RestTimer | null) {
  try {
    if (r) localStorage.setItem(REST_KEY, JSON.stringify(r))
    else localStorage.removeItem(REST_KEY)
  } catch {
    /* ignore */
  }
}

export const useStore = create<State>((set, get) => {
  async function initRepo(repo: Repo, user: State['user']) {
    try {
      set({ phase: 'booting', bootError: null })
      repo.setHandlers?.({
        onQueue: (n) => set({ queued: n }),
        onError: (msg) => get().toast({ kind: 'error', text: 'A change could not be saved', sub: msg })
      })
      const db = await repo.loadAll()
      set({ repo, user, db, phase: 'ready' })
    } catch (e: any) {
      set({ bootError: String(e?.message ?? e), phase: 'login', repo: null })
    }
  }

  async function persist(table: TableName, id: string) {
    const { repo, db } = get()
    if (!repo) return
    const row = (db[table] as { id: string }[]).find((r) => r.id === id)
    if (!row) return
    set((s) => ({ pending: s.pending + 1 }))
    try {
      await enqueue(() => repo.upsert(table, row))
      set({ syncError: null })
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      set({ syncError: msg })
      get().toast({ kind: 'error', text: 'Could not save', sub: msg })
    } finally {
      set((s) => ({ pending: Math.max(0, s.pending - 1) }))
    }
  }

  return {
    queued: 0,
    phase: 'booting',
    repo: null,
    user: null,
    db: emptyDB(),
    bootError: null,
    toasts: [],
    rest: typeof window !== 'undefined' ? loadRest() : null,
    pending: 0,
    syncError: null,

    async boot() {
      if (bootStarted) return
      bootStarted = true
      if (!cloudConfigured || !supabase) {
        await get().enterLocal()
        return
      }
      supabase.auth.onAuthStateChange((event, session) => {
        const cur = get()
        if (event === 'SIGNED_IN' && session?.user && cur.user?.id !== session.user.id) {
          localStorage.removeItem(LOCAL_FLAG)
          // defer: calling supabase inside this callback can deadlock
          setTimeout(() => {
            void initRepo(new SupabaseRepo(supabase!, session.user.id), {
              id: session.user.id,
              email: session.user.email ?? null
            })
          }, 0)
        }
        if (event === 'SIGNED_OUT') {
          set({ phase: 'login', repo: null, user: null, db: emptyDB() })
        }
      })
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        const u = data.session.user
        await initRepo(new SupabaseRepo(supabase, u.id), { id: u.id, email: u.email ?? null })
      } else if (localStorage.getItem(LOCAL_FLAG) === 'local' && import.meta.env.DEV) {
        await get().enterLocal()
      } else {
        // production is Google sign-in only: a "this device only" flag left by an old build is dropped
        localStorage.removeItem(LOCAL_FLAG)
        set({ phase: 'login' })
      }
    },

    async enterLocal() {
      localStorage.setItem(LOCAL_FLAG, 'local')
      await initRepo(new LocalRepo(), { id: 'local', email: null })
    },

    leaveLocal() {
      localStorage.removeItem(LOCAL_FLAG)
      set({ phase: 'login', repo: null, user: null, db: emptyDB() })
    },

    async signOut() {
      await get().flush()
      if (get().repo?.mode === 'cloud' && supabase) {
        try {
          // 'local' signs out this device even when there is no network
          await supabase.auth.signOut({ scope: 'local' })
        } catch {
          /* ignore */
        }
        set({ phase: 'login', repo: null, user: null, db: emptyDB(), queued: 0 })
      } else {
        get().leaveLocal()
      }
    },

    save(table, row, opts) {
      set((s) => {
        const list = (s.db[table] as { id: string }[]).slice()
        const i = list.findIndex((r) => r.id === row.id)
        if (i >= 0) list[i] = row
        else list.push(row)
        return { db: { ...s.db, [table]: list } as DB }
      })
      const key = `${table}:${row.id}`
      const prev = timers.get(key)
      if (prev) clearTimeout(prev)
      const wait = opts?.debounce ?? 0
      if (wait <= 0) {
        timers.delete(key)
        void persist(table, row.id)
      } else {
        timers.set(
          key,
          setTimeout(() => {
            timers.delete(key)
            void persist(table, row.id)
          }, wait)
        )
      }
    },

    saveMany(table, rows) {
      for (const r of rows) get().save(table, r)
    },

    remove(table, id) {
      const key = `${table}:${id}`
      const prev = timers.get(key)
      if (prev) clearTimeout(prev)
      timers.delete(key)
      set((s) => ({
        db: { ...s.db, [table]: (s.db[table] as { id: string }[]).filter((r) => r.id !== id) } as DB
      }))
      const repo = get().repo
      if (!repo) return
      set((s) => ({ pending: s.pending + 1 }))
      enqueue(() => repo.remove(table, id))
        .catch((e) => get().toast({ kind: 'error', text: 'Could not delete', sub: String(e?.message ?? e) }))
        .finally(() => set((s) => ({ pending: Math.max(0, s.pending - 1) })))
    },

    async replaceDb(db) {
      const repo = get().repo
      if (!repo) return
      if (repo.replaceAll) await repo.replaceAll(db)
      else {
        // cloud: upsert everything row by row (tables are small for one person)
        const order: TableName[] = ['exercises', 'workouts', 'workout_exercises', 'sessions', 'metrics']
        for (const t of order) for (const r of db[t] as { id: string }[]) await repo.upsert(t, r)
      }
      set({ db })
    },

    toast(t) {
      const id = uid()
      // fixed messages are translated here (Hebrew); ones built from data pass through unchanged
      const msg = { ...t, text: tr(t.text), sub: t.sub ? tr(t.sub) : t.sub }
      set((s) => ({ toasts: [...s.toasts.slice(-3), { ...msg, id }] }))
      setTimeout(() => get().dismissToast(id), t.kind === 'pr' ? 7000 : 4500)
    },
    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
    },

    startRest(sec, label) {
      if (sec <= 0) {
        storeRest(null)
        set({ rest: null })
        return
      }
      const rest = { endsAt: Date.now() + sec * 1000, total: sec, label, finished: false }
      storeRest(rest)
      set({ rest })
    },
    adjustRest(delta) {
      const cur = get().rest
      if (!cur) return
      const rest = { ...cur, endsAt: cur.endsAt + delta * 1000, total: Math.max(5, cur.total + delta), finished: false }
      storeRest(rest)
      set({ rest })
    },
    clearRest() {
      storeRest(null)
      set({ rest: null })
    },

    async flush() {
      const keys = [...timers.keys()]
      for (const k of keys) {
        clearTimeout(timers.get(k)!)
        timers.delete(k)
        const [table, id] = k.split(':') as [TableName, string]
        await persist(table, id)
      }
    }
  }
})

if (typeof window !== 'undefined') {
  // back online: send everything that was saved while offline
  window.addEventListener('online', () => void useStore.getState().repo?.flushQueue?.())
  const f = () => void useStore.getState().flush()
  window.addEventListener('pagehide', f)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') f()
  })
}
