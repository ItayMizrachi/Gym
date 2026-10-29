import { ReactNode, useRef, useState } from 'react'
import { BookOpen, ChevronRight, Download, HelpCircle, LayoutGrid, LogIn, LogOut, PlayCircle, Sparkles, Trash2, Upload, ArrowRightLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { reopenWelcome } from '../components/Welcome'
import ImportOther from '../components/ImportOther'
import DeleteAccountSheet from '../components/DeleteAccount'
import { SuggestedExercises } from '../components/SuggestedExercises'
import { CoachSettings } from '../components/CoachSettings'
import '../styles/library.css'
import { useStore } from '../lib/store'
import { buildStarterPlan } from '../lib/seed'
import { DB, emptyDB } from '../lib/types'
import { Confirm, PageHeader, Toggle } from '../components/ui'
import { uid } from '../lib/uid'
import { primeAudio, beep } from '../lib/beep'
import { cloudConfigured } from '../lib/supabase'
import { usePrefs } from '../lib/prefs'
import { notifyPermission, notifySupported, requestNotify } from '../lib/notify'
import { fmtKg } from '../lib/format'
import { plateColor } from '../lib/plates'
import '../styles/workout-flow.css'
import '../styles/programs-nav.css'

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
  const [importOther, setImportOther] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmImport, setConfirmImport] = useState<DB | null>(null)
  const prefs = usePrefs()
  const nav = useNavigate()
  const [perm, setPerm] = useState(notifyPermission())

  function loadStarter() {
    const plan = buildStarterPlan(user?.id ?? 'local', db.exercises, db.workouts.length)
    plan.exercises.forEach((e) => save('exercises', e))
    plan.workouts.forEach((w) => save('workouts', w))
    plan.workout_exercises.forEach((w) => save('workout_exercises', w))
    toast({ kind: 'info', text: 'Starter plan added', sub: '4 workouts are on the Train tab.' })
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

  const group = (title: string, sub: string, children: ReactNode) => (
    <section className="card stack" aria-label={title}>
      {/* the heading says it; the old one-line sub per group only added noise (kept for screen readers) */}
      <h2 aria-description={sub}>{title}</h2>
      {children}
    </section>
  )
  const link = (label: string, sub: string, icon: ReactNode, onClick: () => void, primary = false) => (
    <button className={`btn set-link ${primary ? 'primary' : ''}`} onClick={onClick}>
      {icon}
      <span className="grow set-link-t">
        {label}
        {sub && <span className="tiny set-link-sub">{sub}</span>}
      </span>
      <ChevronRight size={16} aria-hidden />
    </button>
  )
  const toggleRow = (label: string, sub: ReactNode, on: boolean, onChange: (v: boolean) => void) => (
    <div className="row set-tog">
      {/* the whole row flips the switch, like iOS Settings; the switch itself is the labelled control */}
      <div className="grow" onClick={() => onChange(!on)} style={{ cursor: 'pointer' }}>
        <div>{label}</div>
        <div className="small muted">{sub}</div>
      </div>
      <Toggle on={on} onChange={onChange} ariaLabel={label} />
    </div>
  )

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader title="Settings" sub="Workout options, plates, backups and your account." />

      {/* who you are, at a glance; signing out and deleting live at the very bottom */}
      {repo?.mode === 'cloud' ? (
        <section className="card acct-card" aria-label="Account">
          <div className="acct-avatar" aria-hidden>
            {(user?.email ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="acct-email ellipsis">{user?.email ?? user?.id}</div>
            <div className="small muted acct-sync">
              <span className="acct-dot" aria-hidden /> Signed in with Google · synced
            </div>
          </div>
        </section>
      ) : (
        <section className="card stack" aria-label="Account">
          <div className="small muted">Not signed in. Workouts are saved on this device only.</div>
          {cloudConfigured && (
            <button className="btn primary block" onClick={() => signOut()}>
              <LogIn size={18} aria-hidden /> Sign in with Google
            </button>
          )}
        </section>
      )}
      {repo?.mode === 'cloud' && <CoachSettings />}
      {repo?.mode === 'cloud' && <SuggestedExercises />}

      {group(
        'Workout',
        'How a workout behaves while you train.',
        <>
          {link('Exercises', 'Your exercise list, photos and setup notes', <BookOpen size={18} aria-hidden />, () => nav('/exercises'))}
          {toggleRow('Rest timer sound', 'Beeps and vibrates when rest is over', sound, (v) => {
            setSound(v)
            setFlag('gymlog:sound', v)
            if (v) {
              primeAudio()
              beep(1)
            }
          })}
          {toggleRow(
            'Rest-over notification',
            !notifySupported()
              ? 'Not available in this browser. On iPhone, add GymLog to the Home Screen first (iOS 16.4+).'
              : perm === 'denied'
              ? 'Blocked. Allow notifications for this site in your browser settings.'
              : 'Alerts you when rest ends while the app is in the background',
            prefs.restNotify && perm === 'granted',
            async (v) => {
              if (!v) return prefs.setPrefs({ restNotify: false })
              const ok = await requestNotify()
              setPerm(notifyPermission())
              prefs.setPrefs({ restNotify: ok })
              if (!ok) toast({ kind: 'info', text: 'Notifications are not allowed', sub: 'The beep and vibration still work while the app is open.' })
            }
          )}
          {toggleRow('Keep screen awake', 'During a workout, where the phone allows it', awake, (v) => {
            setAwake(v)
            setFlag('gymlog:awake', v)
          })}
          {toggleRow('Log RPE', 'Rate how hard each set felt, from 6 to 10', prefs.showRpe, (v) => prefs.setPrefs({ showRpe: v }))}
          {toggleRow('Warm-up sets automatically', 'Before the first heavy barbell or plate-loaded lift for each muscle', prefs.autoWarmup, (v) => prefs.setPrefs({ autoWarmup: v }))}
          <div>
            <div>Weight increase</div>
            <div className="small muted">Suggested when you reach the top of the rep range on every work set</div>
            <div className="seg block set-seg" style={{ marginTop: 8 }} role="group" aria-label="Weight increase">
              {INCREMENTS.map((v) => (
                <button
                  key={v}
                  className={prefs.increment === v ? 'on' : ''}
                  aria-pressed={prefs.increment === v}
                  onClick={() => prefs.setPrefs({ increment: v })}
                >
                  +{fmtKg(v)} kg
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {group(
        'Units & plates',
        'Weights are in kilograms. Set your bar and plates for the plate calculator.',
        <>
          <div>
            <div>Bar</div>
            <div className="seg block set-seg" style={{ marginTop: 8 }} role="group" aria-label="Bar weight">
              {BARS.map((v) => (
                <button
                  key={v}
                  className={prefs.barKg === v ? 'on' : ''}
                  aria-pressed={prefs.barKg === v}
                  onClick={() => prefs.setPrefs({ barKg: v })}
                >
                  {v ? `${v} kg` : 'No bar'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div>Plates in your gym</div>
            <div className="small muted">Tap to switch a size on or off</div>
            <div className="plate-pick" style={{ marginTop: 8 }} role="group" aria-label="Plates in your gym">
              {ALL_PLATES.map((v) => {
                const on = prefs.plates.includes(v)
                return (
                  <button
                    key={v}
                    className={`chip ${on ? 'active' : ''}`}
                    // an owned plate shows in its real colour, like on the bar in the plate calculator
                    style={on ? { background: plateColor(v), borderColor: plateColor(v), color: v >= 20 || (v >= 10 && v < 15) ? '#fff' : '#17181b' } : undefined}
                    aria-pressed={on}
                    aria-label={`${fmtKg(v)} kg plate`}
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
        </>
      )}

      {group(
        'Data & backup',
        'Add ready-made workouts, or save and restore everything.',
        <>
          {link('Browse programs', '20 single workouts and 10 weekly plans', <LayoutGrid size={18} aria-hidden />, () => nav('/programs'))}
          {link('Add the starter plan', '4 workouts, Upper / Lower twice a week', <Sparkles size={18} aria-hidden />, loadStarter)}
          {link('Export backup', 'Everything as one JSON file', <Download size={18} aria-hidden />, exportJson)}
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          {link('Import backup', 'Restore from a GymLog JSON file', <Upload size={18} aria-hidden />, () => fileRef.current?.click())}
          {link('Import from Hevy or Strong', 'Bring your history from a CSV export', <ArrowRightLeft size={18} aria-hidden />, () => setImportOther(true))}
          <div className="tiny muted">Backups include workouts, exercises, history and body weight. Photos stay in your account storage.</div>
        </>
      )}

      {group(
        'Help',
        'Answers, the welcome tour and how to install.',
        <>
          {link('How GymLog works', 'Short answers about every screen', <HelpCircle size={18} aria-hidden />, () => nav('/help'))}
          {link('Show the welcome tour', '', <PlayCircle size={18} aria-hidden />, reopenWelcome)}
          <div className="tiny muted">
            <b>Install on your phone.</b> iPhone (Safari): Share, then Add to Home Screen. Android (Chrome): the ⋮ menu, then Install app. It then
            opens full screen and keeps working with a weak signal.
          </div>
        </>
      )}

      {repo?.mode === 'cloud' && (
        <section className="card set-danger" aria-label="Sign out or delete account">
          <button className="set-row-btn" onClick={() => signOut()}>
            <LogOut size={18} aria-hidden /> Sign out
          </button>
          <button className="set-row-btn danger-text" onClick={() => setDeleting(true)}>
            <Trash2 size={18} aria-hidden /> Delete account
          </button>
        </section>
      )}
      <div className="tiny muted center set-version">GymLog</div>

      {importOther && <ImportOther onClose={() => setImportOther(false)} />}
      {deleting && <DeleteAccountSheet email={user?.email ?? 'your account'} onExport={exportJson} onClose={() => setDeleting(false)} />}
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
