import { useRef, useState } from 'react'
import { ChevronRight, Download, HelpCircle, LogOut, PlayCircle, Sparkles, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { reopenWelcome } from '../components/Welcome'
import { useStore } from '../lib/store'
import { buildStarterPlan } from '../lib/seed'
import { DB, emptyDB } from '../lib/types'
import { Confirm, Toggle } from '../components/ui'
import { uid } from '../lib/uid'
import { primeAudio, beep } from '../lib/beep'
import { cloudConfigured } from '../lib/supabase'
import { usePrefs } from '../lib/prefs'
import { notifyPermission, notifySupported, requestNotify } from '../lib/notify'
import { fmtKg } from '../lib/format'
import '../styles/workout-flow.css'

const INCREMENTS = [1, 1.25, 2.5, 5]
const BARS = [20, 15, 10, 0]
const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5]

const flag = (k: string) => localStorage.getItem(k) !== 'off'
const setFlag = (k: string, v: boolean) => localStorage.setItem(k, v ? 'on' : 'off')

/** Re-id everything so importing the same file into two accounts never collides. */
function remap(raw: any, userId: string): DB {
  const db = emptyDB()
  const map = new Map<string, string>()
  const nid = (old: string) => {
    if (!map.has(old)) map.set(old, uid())
    return map.get(old)!
  }
  for (const e of raw.exercises ?? []) db.exercises.push({ ...e, id: nid(e.id), user_id: userId })
  for (const w of raw.workouts ?? []) db.workouts.push({ ...w, id: nid(w.id), user_id: userId })
  const hasEx = new Set((raw.exercises ?? []).map((e: any) => e.id))
  const hasW = new Set((raw.workouts ?? []).map((w: any) => w.id))
  for (const x of raw.workout_exercises ?? []) {
    if (!hasW.has(x.workout_id) || !hasEx.has(x.exercise_id)) continue // would break the database link
    db.workout_exercises.push({ ...x, id: nid(x.id), user_id: userId, workout_id: nid(x.workout_id), exercise_id: nid(x.exercise_id) })
  }
  for (const s of raw.sessions ?? [])
    db.sessions.push({
      ...s,
      id: nid(s.id),
      user_id: userId,
      workout_id: s.workout_id ? nid(s.workout_id) : null,
      data: { exercises: (s.data?.exercises ?? []).map((e: any) => ({ ...e, exercise_id: nid(e.exercise_id) })) }
    })
  for (const m of raw.metrics ?? []) db.metrics.push({ ...m, id: nid(m.id), user_id: userId, photo_path: null })
  return db
}

export default function SettingsPage() {
  const user = useStore((s) => s.user)
  const repo = useStore((s) => s.repo)
  const db = useStore((s) => s.db)
  const save = useStore((s) => s.save)
  const signOut = useStore((s) => s.signOut)
  const toast = useStore((s) => s.toast)
  const fileRef = useRef<HTMLInputElement>(null)
  const [sound, setSound] = useState(flag('gymlog:sound'))
  const [awake, setAwake] = useState(flag('gymlog:awake'))
  const [confirmImport, setConfirmImport] = useState<DB | null>(null)
  const prefs = usePrefs()
  const nav = useNavigate()
  const [perm, setPerm] = useState(notifyPermission())

  function loadStarter() {
    const plan = buildStarterPlan(user?.id ?? 'local', db.exercises, db.workouts.length)
    plan.exercises.forEach((e) => save('exercises', e))
    plan.workouts.forEach((w) => save('workouts', w))
    plan.workout_exercises.forEach((w) => save('workout_exercises', w))
    toast({ kind: 'info', text: 'Starter plan added', sub: '4 workouts are on the Workouts tab.' })
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `gymlog-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  async function onFile(f: File | undefined) {
    if (!f) return
    try {
      const raw = JSON.parse(await f.text())
      setConfirmImport(remap(raw, user?.id ?? 'local'))
    } catch {
      toast({ kind: 'error', text: 'Not a valid GymLog backup file' })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function doImport(incoming: DB) {
    incoming.exercises.forEach((e) => save('exercises', e))
    incoming.workouts.forEach((e) => save('workouts', e))
    incoming.workout_exercises.forEach((e) => save('workout_exercises', e))
    incoming.sessions.forEach((e) => save('sessions', e))
    incoming.metrics.forEach((e) => save('metrics', e))
    toast({ kind: 'info', text: 'Import done', sub: 'Photos are not included in backups.' })
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <div className="card stack">
        <h2>Help</h2>
        <div className="small muted">New here? Start with these.</div>
        <button className="btn primary" onClick={() => nav('/help')}>
          <HelpCircle size={16} /> How GymLog works <ChevronRight size={16} />
        </button>
        <button className="btn" onClick={reopenWelcome}>
          <PlayCircle size={16} /> Show the welcome tour
        </button>
      </div>

      <div className="card stack">
        <h2>Account</h2>
        {repo?.mode === 'cloud' ? (
          <div className="small muted">
            Signed in as <b style={{ color: 'var(--text)' }}>{user?.email ?? user?.id}</b>. Your data syncs across devices and is only visible to you.
          </div>
        ) : (
          <div className="small muted">
            Demo mode: your data lives only in this browser.
            {cloudConfigured ? ' Sign in to sync it across devices.' : ' Cloud sync is not configured for this install (see README).'}
          </div>
        )}
        <button className="btn" onClick={() => signOut()}>
          <LogOut size={16} /> {repo?.mode === 'cloud' ? 'Sign out' : cloudConfigured ? 'Leave demo / sign in' : 'Reload demo'}
        </button>
      </div>

      <div className="card stack">
        <h2>Workout</h2>
        <div className="row">
          <div className="grow">
            <div>Rest timer sound</div>
            <div className="small muted">Beeps + vibrates when rest is over</div>
          </div>
          <Toggle
            on={sound}
            onChange={(v) => {
              setSound(v)
              setFlag('gymlog:sound', v)
              if (v) {
                primeAudio()
                beep(1)
              }
            }}
          />
        </div>
        <div className="row">
          <div className="grow">
            <div>Keep screen awake</div>
            <div className="small muted">During a workout, where the phone allows it</div>
          </div>
          <Toggle
            on={awake}
            onChange={(v) => {
              setAwake(v)
              setFlag('gymlog:awake', v)
            }}
          />
        </div>
      </div>

      <div className="card stack">
        <h2>Training</h2>
        <div>
          <div>Weight increase</div>
          <div className="small muted">Added when you hit the top of the rep range on every work set</div>
          <div className="chips" style={{ marginTop: 8 }}>
            {INCREMENTS.map((v) => (
              <button key={v} className={`chip ${prefs.increment === v ? 'active' : ''}`} onClick={() => prefs.setPrefs({ increment: v })}>
                +{fmtKg(v)} kg
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <div className="grow">
            <div>Log RPE</div>
            <div className="small muted">Rate effort (6–10) after each set</div>
          </div>
          <Toggle on={prefs.showRpe} onChange={(v) => prefs.setPrefs({ showRpe: v })} />
        </div>
        <div className="row">
          <div className="grow">
            <div>Rest-over notification</div>
            <div className="small muted">
              {!notifySupported()
                ? 'Not available in this browser. On iPhone, add GymLog to the Home Screen first (iOS 16.4+).'
                : perm === 'denied'
                ? 'Blocked. Allow notifications for this site in your browser settings.'
                : 'Alerts you when rest ends while the app is in the background'}
            </div>
          </div>
          <Toggle
            on={prefs.restNotify && perm === 'granted'}
            onChange={async (v) => {
              if (!v) return prefs.setPrefs({ restNotify: false })
              const ok = await requestNotify()
              setPerm(notifyPermission())
              prefs.setPrefs({ restNotify: ok })
              if (!ok) toast({ kind: 'info', text: 'Notifications are not allowed', sub: 'The beep and vibration still work while the app is open.' })
            }}
          />
        </div>
      </div>

      <div className="card stack">
        <h2>Plate calculator</h2>
        <div>
          <div>Bar</div>
          <div className="chips" style={{ marginTop: 8 }}>
            {BARS.map((v) => (
              <button key={v} className={`chip ${prefs.barKg === v ? 'active' : ''}`} onClick={() => prefs.setPrefs({ barKg: v })}>
                {v ? `${v} kg` : 'No bar'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div>Plates in your gym</div>
          <div className="small muted">Tap to switch a size on or off</div>
          <div className="plate-pick" style={{ marginTop: 8 }}>
            {ALL_PLATES.map((v) => {
              const on = prefs.plates.includes(v)
              return (
                <button
                  key={v}
                  className={`chip ${on ? 'active' : ''}`}
                  aria-pressed={on}
                  onClick={() => {
                    const next = on ? prefs.plates.filter((p) => p !== v) : [...prefs.plates, v].sort((a, b) => b - a)
                    if (next.length) prefs.setPrefs({ plates: next })
                  }}
                >
                  {fmtKg(v)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="tiny muted">In a workout, tap the kg header or hold a weight to see the plates per side.</div>
      </div>

      <div className="card stack">
        <h2>Data</h2>
        <button className="btn" onClick={loadStarter}>
          <Sparkles size={16} /> Add the starter plan (4 workouts)
        </button>
        <button className="btn" onClick={exportJson}>
          <Download size={16} /> Export backup (JSON)
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> Import backup
        </button>
        <div className="tiny muted">Backups include workouts, exercises, history and body weight. Photos stay in your account storage.</div>
      </div>

      <div className="card stack">
        <h2>Install on your phone</h2>
        <div className="small">
          <b>iPhone (Safari):</b> Share → Add to Home Screen.
          <br />
          <b>Android (Chrome):</b> ⋮ menu → Install app / Add to Home screen.
        </div>
        <div className="tiny muted">It then opens full screen like a normal app and keeps working with a weak signal at the gym.</div>
      </div>

      {confirmImport && (
        <Confirm
          title="Import backup?"
          text={`${confirmImport.workouts.length} workouts, ${confirmImport.exercises.length} exercises, ${confirmImport.sessions.length} sessions and ${confirmImport.metrics.length} weight entries will be added to your current data.`}
          confirmLabel="Import"
          onConfirm={() => doImport(confirmImport)}
          onClose={() => setConfirmImport(null)}
        />
      )}
    </div>
  )
}
