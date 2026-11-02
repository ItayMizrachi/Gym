/**
 * Rest-over notification for when the app is in the background.
 * Uses the service worker registration when there is one (required on Android, and on iOS 16.4+
 * for installed home-screen apps); otherwise falls back to a page Notification. Where neither
 * exists (iOS Safari tab), it quietly does nothing and the in-app beep/vibrate remains.
 */

import { cancelPush, pushReady, schedulePush } from './push'

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window

export const notifyPermission = (): NotificationPermission | 'unsupported' =>
  notifySupported() ? Notification.permission : 'unsupported'

/** Must run from a user gesture (a tap on the Settings toggle). */
export async function requestNotify(): Promise<boolean> {
  if (!notifySupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
const TAG = 'gymlog-rest'

async function show(title: string, body: string) {
  const opts: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body,
    tag: TAG,
    renotify: true,
    vibrate: [200, 100, 200],
    icon: 'icon-192.png',
    badge: 'icon-192.png'
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, opts)
      return
    }
  } catch {
    /* fall through */
  }
  try {
    new Notification(title, opts)
  } catch {
    /* some browsers only allow notifications through a service worker */
  }
}

/** Schedule (or reschedule) the alert for `endsAt`. Only fires if the page is hidden at that moment. */
export function scheduleRestNotification(endsAt: number, label: string) {
  // not cancelRestNotification(): its server delete could land after the new alert below (the upsert replaces it)
  if (timer) clearTimeout(timer)
  timer = null
  if (notifyPermission() !== 'granted') return
  // the server sends it (arrives even while the phone keeps the app asleep, src/lib/push.ts); the timer below is
  // only for devices without push
  if (pushReady()) {
    void schedulePush(endsAt, 'Rest over', label ? `Next set: ${label}` : 'Time for the next set')
    return
  }
  timer = setTimeout(() => {
    timer = null
    if (document.visibilityState === 'visible') return // the in-app beep covers this
    void show('Rest over', label ? `Next set: ${label}` : 'Time for the next set')
  }, Math.max(0, endsAt - Date.now()))
}

export function cancelRestNotification() {
  if (timer) clearTimeout(timer)
  timer = null
  void cancelPush()
  void navigator.serviceWorker
    ?.getRegistration()
    .then((reg) => reg?.getNotifications({ tag: TAG }))
    .then((ns) => ns?.forEach((n) => n.close()))
    .catch(() => {})
}
