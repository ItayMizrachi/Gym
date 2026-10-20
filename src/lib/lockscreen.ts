import type { Session } from './types'
import type { RestTimer } from './store'
import { fmtClock } from './format'

/*
 * Workout on the lock screen
 * --------------------------
 * A web app cannot draw an iPhone Live Activity, but it can fill the "now playing" card that iOS and Android show
 * on the lock screen and in the control centre. That card only appears while audio is playing, so we loop a
 * silent sound while a workout runs (opt-in in Settings, because it replaces the music card). The card shows the
 * current exercise and set, the rest countdown with a progress bar, and its buttons control the rest timer.
 */

export interface LockInfo {
  title: string
  artist: string
  album: string
  /** progress bar: rest length and how far into it we are (seconds); null = no bar */
  duration: number | null
  position: number | null
  exerciseId: string | null
}

/** The set the lifter is on: the first set not yet logged, across the workout in order. */
export function currentSet(session: Session) {
  for (const ex of session.data.exercises) {
    const i = ex.sets.findIndex((s) => !s.done)
    if (i >= 0) return { ex, index: i, count: ex.sets.length }
  }
  return null
}

/** Text for the lock-screen card. Pure, so it can be tested. */
export function lockInfo(session: Session, rest: RestTimer | null, now: number): LockInfo {
  const cur = currentSet(session)
  const elapsed = Math.max(0, Math.floor((now - new Date(session.started_at).getTime()) / 1000))
  const title = cur ? `${cur.ex.name} · Set ${cur.index + 1} of ${cur.count}` : 'All sets done · tap Finish'
  let artist: string
  let duration: number | null = null
  let position: number | null = null
  if (rest && !rest.finished) {
    const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000))
    artist = `Rest ${fmtClock(left)} left`
    duration = Math.max(1, rest.total)
    position = Math.min(duration, Math.max(0, rest.total - left))
  } else if (rest && rest.finished) {
    artist = 'Rest over · time for the next set'
  } else {
    artist = `Workout ${fmtClock(elapsed)}`
  }
  return { title, artist, album: session.name, duration, position, exerciseId: cur?.ex.exercise_id ?? null }
}

/* ---------------------------------------------------------------- browser side */

export const lockScreenSupported = () =>
  typeof navigator !== 'undefined' && 'mediaSession' in navigator && typeof (window as any).MediaMetadata === 'function'

let audio: HTMLAudioElement | null = null
let silentUrl: string | null = null

/** One second of silence as a tiny WAV, built once. */
function silence(): string {
  if (silentUrl) return silentUrl
  const rate = 8000
  const n = rate
  const buf = new ArrayBuffer(44 + n)
  const v = new DataView(buf)
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  v.setUint32(4, 36 + n, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true) // 8-bit
  w(36, 'data')
  v.setUint32(40, n, true)
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128) // 128 = silence for 8-bit PCM
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  return silentUrl
}

export const lockScreenActive = () => !!audio && !audio.paused

/** Must be called from a user gesture (a tap), or the browser refuses to play. */
export async function startLockScreen(): Promise<boolean> {
  if (!lockScreenSupported()) return false
  try {
    if (!audio) {
      audio = new Audio(silence())
      audio.loop = true
      audio.setAttribute('playsinline', '')
    }
    await audio.play()
    return true
  } catch {
    return false
  }
}

export function stopLockScreen() {
  try {
    audio?.pause()
  } catch {
    /* ignore */
  }
  if (!lockScreenSupported()) return
  try {
    navigator.mediaSession.metadata = null
    navigator.mediaSession.playbackState = 'none'
    for (const a of ['play', 'pause', 'nexttrack', 'previoustrack'] as MediaSessionAction[]) navigator.mediaSession.setActionHandler(a, null)
  } catch {
    /* ignore */
  }
}

let lastKey = ''

export function updateLockScreen(info: LockInfo, artworkUrl: string | null) {
  if (!lockScreenSupported() || !lockScreenActive()) return
  const ms = navigator.mediaSession
  const key = `${info.title}|${info.artist}|${info.album}|${artworkUrl}`
  if (key !== lastKey) {
    lastKey = key
    try {
      ms.metadata = new MediaMetadata({
        title: info.title,
        artist: info.artist,
        album: info.album,
        artwork: [
          ...(artworkUrl ? [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : []),
          { src: new URL('icon-512.png', document.baseURI).href, sizes: '512x512', type: 'image/png' }
        ]
      })
    } catch {
      /* ignore */
    }
  }
  try {
    ms.playbackState = 'playing'
    if (info.duration != null && info.position != null && 'setPositionState' in ms) {
      ms.setPositionState({ duration: info.duration, position: info.position, playbackRate: 1 })
    }
  } catch {
    /* some browsers reject position updates; the text still shows */
  }
}

export function setLockScreenActions(h: { skip: () => void; more: () => void }) {
  if (!lockScreenSupported()) return
  const ms = navigator.mediaSession
  const set = (a: MediaSessionAction, fn: (() => void) | null) => {
    try {
      ms.setActionHandler(a, fn)
    } catch {
      /* action not supported here */
    }
  }
  set('nexttrack', h.skip) // ⏭ skip rest
  set('previoustrack', h.more) // ⏮ +15 s
  // pause/play on the card would otherwise stop our silent audio and hide the card: keep it alive
  set('pause', () => void audio?.play())
  set('play', () => void audio?.play())
}
