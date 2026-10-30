import { useState } from 'react'
import { t as tr } from '../lib/i18n'
import { Download, Trash2 } from 'lucide-react'
import { Sheet } from './ui'
import { AccountError, deleteAccount } from '../lib/account'
import '../styles/account.css'

const WORD = 'DELETE'

/** Confirm sheet for Settings -> Account -> Delete account. */
export default function DeleteAccountSheet({ email, onExport, onClose }: { email: string; onExport: () => void; onClose: () => void }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = typed.trim().toUpperCase() === WORD && !busy

  async function run() {
    setBusy(true)
    setError(null)
    try {
      await deleteAccount() // on success the app returns to the sign-in screen and this sheet unmounts
    } catch (e: any) {
      setError(e instanceof AccountError ? e.message : `Something went wrong. Nothing was deleted. (${String(e?.message ?? e)})`)
      setBusy(false)
    }
  }

  return (
    <Sheet title={tr("Delete your account?")} onClose={busy ? () => undefined : onClose}>
      <div className="stack del-acct">
        <p className="confirm-text">
          This permanently deletes <b>{email}</b> from GymLog, on every device. It cannot be undone.
        </p>
        <ul className="del-acct-list small">
          <li>{tr("All workouts, folders and exercises, with their setup notes")}</li>
          <li>{tr("Your whole workout history and personal records")}</li>
          <li>{tr("Body weight entries")}</li>
          <li>{tr("Every photo: exercise, workout and progress photos")}</li>
          <li>{tr("Your sign-in. Signing in with Google again starts a new, empty account.")}</li>
        </ul>
        <button className="btn block" onClick={onExport} disabled={busy}>
          <Download size={16} aria-hidden /> {tr("Export a backup first")}
        </button>
        <div className="tiny muted">{tr("The backup has your workouts, history and body weight. Photos are not included.")}</div>
        <label className="field">
          Type {WORD} to confirm
          <input
            className="input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={WORD}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            disabled={busy}
          />
        </label>
        {error && (
          <p className="del-acct-error small" role="alert">
            {error}
          </p>
        )}
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <button className="btn grow" onClick={onClose} disabled={busy}>
            {tr("Cancel")}
          </button>
          <button className="btn grow del-acct-go" onClick={run} disabled={!ready} aria-disabled={!ready}>
            <Trash2 size={16} aria-hidden /> {busy ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
