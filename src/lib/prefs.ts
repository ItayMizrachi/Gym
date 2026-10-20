import { create } from 'zustand'

/** Per-device workout preferences (kept in localStorage, like the other Settings flags). */
export interface Prefs {
  /** weight added when every work set reached the top of the rep range */
  increment: number
  barKg: number
  /** plate sizes available in the gym, per side, largest first */
  plates: number[]
  showRpe: boolean
  restNotify: boolean
  /** show the running workout on the lock screen ("now playing" card) */
  lockScreen: boolean
}

export const DEFAULT_PREFS: Prefs = {
  increment: 2.5,
  barKg: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  showRpe: false,
  restNotify: false,
  lockScreen: false
}

const KEY = 'gymlog:prefs'

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (raw && typeof raw === 'object') return { ...DEFAULT_PREFS, ...raw }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PREFS }
}

interface PrefsState extends Prefs {
  setPrefs: (p: Partial<Prefs>) => void
}

export const usePrefs = create<PrefsState>((set, get) => ({
  ...(typeof localStorage !== 'undefined' ? load() : DEFAULT_PREFS),
  setPrefs(p) {
    set(p)
    const { setPrefs, ...rest } = { ...get() }
    try {
      localStorage.setItem(KEY, JSON.stringify(rest))
    } catch {
      /* ignore */
    }
  }
}))

export const getPrefs = (): Prefs => usePrefs.getState()
