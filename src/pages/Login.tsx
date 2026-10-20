import { useState } from 'react'
import { useStore } from '../lib/store'
import { redirectUrl, supabase } from '../lib/supabase'

export default function Login() {
  const bootError = useStore((s) => s.bootError)
  const enterLocal = useStore((s) => s.enterLocal)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
      <img className="logo" src="icon.svg" alt="" />
      <div>
        <h1 style={{ fontSize: 32, letterSpacing: -0.6 }}>GymLog</h1>
        <div className="muted">Workouts, personal records and body weight. Your data, your account.</div>
      </div>
      {bootError && <div className="card" style={{ borderColor: '#6b2a31', color: 'var(--danger)' }}>{bootError}</div>}
      <button className="btn primary block" onClick={google} disabled={busy}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#fff" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
        </svg>
        Continue with Google
      </button>
      <div className="divider">or email</div>
      <form className="stack" onSubmit={emailAuth}>
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input className="input" type="password" placeholder="Password (6+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        <button className="btn block" disabled={busy}>
          {mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'No account yet? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
      {msg && <div className="small" style={{ color: 'var(--warn)' }}>{msg}</div>}
      <div className="divider">or</div>
      <button className="btn block" onClick={() => enterLocal()}>
        Try demo (data stays on this device)
      </button>
    </div>
  )
}
