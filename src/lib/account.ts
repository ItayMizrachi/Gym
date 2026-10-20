import { del, keys } from 'idb-keyval'
import { supabase } from './supabase'
import { useStore } from './store'
import { emptyDB } from './types'

/*
 * Delete account and data (Settings -> Account -> Delete account).
 * The server side is public.delete_my_account() in supabase/schema.sql.
 */

/** Device-wide localStorage keys that hold something from the signed-in person's training. */
const SHARED_LOCAL_KEYS = ['gymlog:rest', 'gymlog:folds', 'gymlog:no-library-photo', 'gymlog:mode']

/** IndexedDB keys of this user: cache, outbox and signed photo links, all named `gymlog:<name>:<userId>`. */
export function idbKeysToWipe(all: IDBValidKey[], userId: string): string[] {
  if (!userId) return []
  return all.filter((k): k is string => typeof k === 'string' && k.startsWith('gymlog:') && k.endsWith(':' + userId))
}

/**
 * localStorage keys to remove: per-user flags (`gymlog:welcome:<id>`, `gymlog:tips:<tip>:<id>`) plus the shared
 * keys that hold workout data. Device settings (sound, keep awake, plates, keypad) stay.
 */
export function localKeysToWipe(all: string[], userId: string): string[] {
  return all.filter((k) => (userId && k.startsWith('gymlog:') && k.endsWith(':' + userId)) || SHARED_LOCAL_KEYS.includes(k))
}

export class AccountError extends Error {}

const OFFLINE = 'Deleting your account needs an internet connection. Connect and try again. Nothing was deleted.'

/** Photo files in the private bucket live at `<userId>/<folder>/<file>.jpg`. Remove them through the Storage API. */
async function removePhotos(userId: string) {
  const bucket = supabase!.storage.from('gymlog')
  const { data: top } = await bucket.list(userId, { limit: 1000 })
  const paths: string[] = []
  for (const item of top ?? []) {
    if (item.id) {
      paths.push(`${userId}/${item.name}`)
      continue
    }
    // a folder: list its files page by page
    for (let offset = 0; ; offset += 1000) {
      const { data } = await bucket.list(`${userId}/${item.name}`, { limit: 1000, offset })
      if (!data?.length) break
      for (const f of data) if (f.id) paths.push(`${userId}/${item.name}/${f.name}`)
      if (data.length < 1000) break
    }
  }
  for (let i = 0; i < paths.length; i += 100) await bucket.remove(paths.slice(i, i + 100))
}

/** Drop changes waiting to be sent: the account they belong to is gone. */
function discardQueue(repo: unknown) {
  const r = repo as { outbox?: unknown[]; retryTimer?: ReturnType<typeof setTimeout> | null } | null
  if (!r) return
  if (Array.isArray(r.outbox)) r.outbox = []
  if (r.retryTimer) clearTimeout(r.retryTimer)
  r.retryTimer = null
}

async function wipeDevice(userId: string) {
  try {
    await Promise.all(idbKeysToWipe(await keys(), userId).map((k) => del(k)))
  } catch {
    /* storage unavailable: nothing to wipe */
  }
  try {
    const all = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => !!k)
    localKeysToWipe(all, userId).forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
  try {
    // photos the service worker kept for offline use (vite.config.ts, 'gymlog-photos')
    if (typeof caches !== 'undefined') await caches.delete('gymlog-photos')
  } catch {
    /* ignore */
  }
}

/**
 * Permanently delete the signed-in account: photos, every row, the sign-in itself, then this device's copy.
 * Throws an AccountError with a plain message when it cannot; in that case nothing on the device was removed.
 */
export async function deleteAccount(): Promise<void> {
  const { repo, user } = useStore.getState()
  if (!supabase || repo?.mode !== 'cloud' || !user) throw new AccountError('Only a signed-in account can be deleted.')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AccountError(OFFLINE)

  try {
    await removePhotos(user.id)
  } catch {
    /* the database function removes what is left */
  }

  let error: { message?: string } | null = null
  try {
    ;({ error } = await supabase.rpc('delete_my_account'))
  } catch (e: any) {
    error = { message: String(e?.message ?? e) }
  }
  if (error) {
    const msg = String(error.message ?? '')
    if (/fetch|network|load failed|timeout|offline/i.test(msg)) throw new AccountError(OFFLINE)
    throw new AccountError(`Your account could not be deleted. Nothing was deleted. Please try again later. (${msg})`)
  }

  // The account is gone: stop sending queued changes and forget everything on this device.
  discardQueue(repo)
  useStore.setState({ repo: null, user: null, db: emptyDB(), queued: 0, phase: 'login', rest: null })
  await wipeDevice(user.id)
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* the session is already invalid; local sign-out still clears it */
  }
  if (typeof window !== 'undefined') window.location.hash = '#/'
}
