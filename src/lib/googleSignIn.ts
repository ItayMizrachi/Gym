import { supabase } from './supabase'

/*
 * Google sign-in with Google's own button (Google Identity Services)
 * -----------------------------------------------------------------
 * The classic OAuth redirect makes Google's screen say "continue to <project>.supabase.co", which looks odd.
 * With this button Google signs the user in on our own page (Google shows itaymizrachi.github.io) and hands
 * back an ID token, which Supabase checks against the client IDs listed under Auth -> Providers -> Google.
 * No redirect, so it also works offline-first without leaving the installed app.
 */
export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || null

const GSI_SRC = 'https://accounts.google.com/gsi/client'
let loading: Promise<void> | null = null

function loadGsi(): Promise<void> {
  if ((window as any).google?.accounts?.id) return Promise.resolve()
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      loading = null
      reject(new Error('Could not load Google sign-in'))
    }
    document.head.appendChild(s)
  })
  return loading
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Draw Google's button into `el`. Resolves false when the button cannot be shown (no client id, offline,
 * script blocked), so the caller can fall back to the redirect flow.
 */
export async function renderGoogleButton(el: HTMLElement, onError: (msg: string) => void): Promise<boolean> {
  if (!googleClientId || !supabase) return false
  try {
    await loadGsi()
  } catch {
    return false
  }
  // Google gets the hash of the nonce; Supabase gets the nonce itself and checks that they match.
  const nonce = crypto.randomUUID()
  const hashed = await sha256Hex(nonce)
  const gid = (window as any).google.accounts.id
  gid.initialize({
    client_id: googleClientId,
    nonce: hashed,
    ux_mode: 'popup',
    // FedCM is not available everywhere (Safari, some embedded browsers); the classic popup works on all of them
    use_fedcm_for_button: false,
    callback: async (res: { credential?: string }) => {
      if (!res.credential) return onError('Google sign-in was cancelled.')
      const { error } = await supabase!.auth.signInWithIdToken({ provider: 'google', token: res.credential, nonce })
      if (error) onError(error.message)
      // success: the store's onAuthStateChange('SIGNED_IN') loads the account
    }
  })
  el.innerHTML = ''
  gid.renderButton(el, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    // the UI is English; without this Google follows the browser language and RTL text collides with the logo
    locale: 'en',
    logo_alignment: 'left',
    width: Math.min(400, Math.max(200, Math.round(el.getBoundingClientRect().width)))
  })
  return true
}
