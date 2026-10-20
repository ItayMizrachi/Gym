import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { redirectUrl, supabase } from '../lib/supabase'
import { googleClientId, renderGoogleButton } from '../lib/googleSignIn'

export default function Login() {
  const bootError = useStore((s) => s.bootError)
  const enterLocal = useStore((s) => s.enterLocal)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const gsiRef = useRef<HTMLDivElement>(null)
  // Google's own button when a client id is configured; the redirect button below is the fallback
  const [gsi, setGsi] = useState<'loading' | 'ready' | 'off'>(googleClientId ? 'loading' : 'off')

  useEffect(() => {
    if (!googleClientId || !gsiRef.current) return
    let alive = true
    void renderGoogleButton(gsiRef.current, (m) => alive && setMsg(m)).then((ok) => alive && setGsi(ok ? 'ready' : 'off'))
    return () => {
      alive = false
    }
  }, [])

  async function google() {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl() }
    })
    if (error) {
      setMsg(error.message)
      setBusy(false)
    }
  }

  async function emailAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
      if (error) setMsg(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: redirectUrl() } })
      if (error) setMsg(error.message)
      else if (!data.session) setMsg('Check your email to confirm the account, then sign in.')
    }
    setBusy(false)
  }

  return (
    <div className="login">
      <div className="login-brand">
        <img className="logo" src="icon.svg" alt="" width={72} height={72} />
        <h1>
          Gym<span>Log</span>
        </h1>
        <div className="login-plates" aria-hidden>
          <i style={{ height: 30, background: 'var(--danger)' }} />
          <i style={{ height: 26, background: 'var(--plate-blue)' }} />
          <i style={{ height: 22, background: 'var(--accent)' }} />
          <i style={{ height: 18, background: 'var(--ok)' }} />
        </div>
        <div className="tag">Every set, every record, every weigh-in. Your training logbook, synced to your account.</div>
      </div>

      {bootError && <div className="msg err">{bootError}</div>}

      {gsi !== 'off' && <div ref={gsiRef} className="gsi-btn" aria-busy={gsi === 'loading'} />}

      {gsi === 'off' && (
      <button className="btn google block" onClick={google} disabled={busy}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continue with Google
      </button>
      )}

      <div className="divider">or with email</div>

      <form className="stack" style={{ gap: 'var(--s2)' }} onSubmit={emailAuth}>
        <input
          className="input"
          type="email"
          placeholder="Email"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          inputMode="email"
        />
        <input
          className="input"
          type="password"
          placeholder={mode === 'in' ? 'Password' : 'Password (6+ characters)'}
          aria-label="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
        />
        <button className="btn primary block" disabled={busy} style={{ marginTop: 'var(--s1)' }}>
          {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? (
            <span>
              No account yet? <b style={{ color: 'var(--text)' }}>Sign up</b>
            </span>
          ) : (
            <span>
              Have an account? <b style={{ color: 'var(--text)' }}>Sign in</b>
            </span>
          )}
        </button>
      </form>

      {msg && <div className="msg">{msg}</div>}

      <div className="divider">or</div>
      <button className="btn block" onClick={() => enterLocal()}>
        Try the demo
      </button>
      <div className="fine">Demo data stays on this device only.</div>
    </div>
  )
}
