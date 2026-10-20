let ctx: AudioContext | null = null

/** Must be called from a user gesture once so iOS lets us play sounds later. */
export function primeAudio() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    if (!ctx) ctx = new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* ignore */
  }
}

export function beep(times = 3) {
  try {
    if (!ctx) primeAudio()
    if (!ctx) return
    const c = ctx
    for (let i = 0; i < times; i++) {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.value = i === times - 1 ? 1100 : 800
      const t = c.currentTime + i * 0.22
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      o.connect(g).connect(c.destination)
      o.start(t)
      o.stop(t + 0.2)
    }
  } catch {
    /* ignore */
  }
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    /* ignore */
  }
}
