import { supabase } from './supabase'
import { useStore } from './store'

/*
 * Rest-over alerts from the server (Web Push). A phone puts a web app to sleep soon after you leave it, so a timer
 * inside the app often fires late. Instead the app tells the server when the rest ends (public.rest_pushes) and the
 * server pushes the alert (supabase/functions/rest-push, run by pg_cron every 5 seconds).
 * Needs: notifications allowed, and on iPhone the app installed on the home screen (iOS 16.4+).
 */

/** public half of the server's VAPID key pair (the private half is a Supabase function secret) */
const VAPID_PUBLIC = 'BBm-Mpd3nCiAwwmWbwwtt78Dbc2QyfkpxQXW9uFj1qPHdyLke7O82F4DJAf60XvcunRCzl1jgQ7iVbYyB1UDdgc'

let ready = false

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && !!supabase

/** the signed-in account (not the trainee while coaching: the alert is for the phone in your hand) */
const me = () => useStore.getState().self?.id ?? null

function keyBytes(b64: string) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

/** Subscribe this device and save it on the account. Quietly does nothing where push is not available. */
export async function ensurePush(): Promise<boolean> {
  if (ready) return true
  if (!pushSupported() || Notification.permission !== 'granted' || !me()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }))
    const j = sub.toJSON()
    if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false
    const { error } = await supabase!.from('push_subs').upsert({ endpoint: j.endpoint, user_id: me(), p256dh: j.keys.p256dh, auth: j.keys.auth })
    ready = !error
  } catch {
    ready = false
  }
  return ready
}

export const pushReady = () => ready

/** Ask the server for an alert at `endsAt` (replaces the one pending). */
export async function schedulePush(endsAt: number, title: string, body: string) {
  if (!ready || !me()) return
  await supabase!.from('rest_pushes').upsert({ user_id: me(), send_at: new Date(endsAt).toISOString(), title, body })
}

/** No alert after all (Skip, or the app is open at the end and beeps itself). */
export async function cancelPush() {
  if (!ready || !me()) return
  await supabase!.from('rest_pushes').delete().eq('user_id', me())
}
