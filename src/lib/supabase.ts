import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudConfigured = Boolean(url && key)

/*
 * Sign-in redirects and the hash router
 * -------------------------------------
 * The app routes with the URL hash (#/history), so auth must not use the hash. PKCE makes Supabase come back
 * with a query string instead:  https://user.github.io/Gym/?code=…#/  (or ?error=…&error_description=…).
 * supabase-js reads ?code= on start-up, swaps it for a session and strips it from the address bar.
 * Errors are left in the URL, so we read them here (for the login screen) and clean them up after start-up,
 * otherwise every reload would show the same error again.
 */
const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description', 'state']

function readRedirectError(): string | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search)
  const desc = q.get('error_description') ?? q.get('error')
  return desc ? desc.replace(/\+/g, ' ') : null
}

/** Set when the browser came back from Google / an email link with an error (e.g. sign-in cancelled). */
export const authRedirectError: string | null = cloudConfigured ? readRedirectError() : null

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url!, key!, {
      auth: {
        flowType: 'pkce', // returns ?code=... so it does not clash with the hash router
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true // also refreshes when the installed app comes back to the foreground
      }
    })
  : null

if (supabase && typeof window !== 'undefined') {
  // initialize() returns the start-up promise supabase-js already began; after it the URL is safe to clean.
  void supabase.auth.initialize().finally(() => {
    const u = new URL(window.location.href)
    if (!AUTH_PARAMS.some((p) => u.searchParams.has(p))) return
    AUTH_PARAMS.forEach((p) => u.searchParams.delete(p))
    window.history.replaceState(window.history.state, '', u.toString())
  })
}

/**
 * Where Google / confirmation emails send the user back to: this page without query or hash, e.g.
 * http://localhost:5173/ or https://itaymizrachi.github.io/Gym/. Every such URL must be listed in
 * Supabase -> Authentication -> URL Configuration -> Redirect URLs, or Supabase falls back to the Site URL.
 */
export function redirectUrl(): string {
  return window.location.origin + window.location.pathname.replace(/index\.html$/, '')
}
