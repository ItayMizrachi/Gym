import { ReactNode, useRef, useState } from 'react'
import { BookOpen, ChevronRight, Download, HelpCircle, LayoutGrid, LogOut, PlayCircle, Sparkles, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { reopenWelcome } from '../components/Welcome'
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
import '../styles/workout-flow.css'
import '../styles/programs.css'

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
      <div>
        <h2>{title}</h2>
        <div className="small muted">{sub}</div>
      </div>
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
    <div className="row">
      <div className="grow">
        <div>{label}</div>
        <div className="small muted">{sub}</div>
      </div>
      <Toggle on={on} onChange={onChange} ariaLabel={label} />
    </div>
  )

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader title="Settings" sub="Your account, workout options, plates and backups." />

      {group(
        'Help',
        'New here? Start with these.',
        <>
          {link('How GymLog works', '', <HelpCircle size={18} aria-hidden />, () => nav('/help'), true)}
          {link('Show the welcome tour', '', <PlayCircle size={18} aria-hidden />, reopenWelcome)}
          <div className="tiny muted">
            <b>Install on your phone.</b> iPhone (Safari): Share, then Add to Home Screen. Android (Chrome): the ⋮ menu, then Install app. It then
            opens full screen and keeps working with a weak signal.
          </div>
        </>
      )}

      {group(
        'Account',
        repo?.mode === 'cloud' ? 'Who you are signed in as.' : 'Where your data is kept.',
        <>
          {repo?.mode === 'cloud' ? (
            <div className="small muted">
              Signed in as <b style={{ color: 'var(--text)' }}>{user?.email ?? user?.id}</b>. Your data syncs across devices and is only visible to
              you.
            </div>
          ) : (
            <div className="small muted">
              Demo mode: your data lives only in this browser.
              {cloudConfigured ? ' Sign in to sync it across devices.' : ' Cloud sync is not configured for this install (see README).'}
            </div>
          )}
          <button className="btn" onClick={() => signOut()}>
            <LogOut size={16} aria-hidden /> {repo?.mode === 'cloud' ? 'Sign out' : cloudConfigured ? 'Leave demo / sign in' : 'Reload demo'}
          </button>
        </>
      )}

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
          <div>
            <div>Weight increase</div>
            <div className="small muted">Suggested when you reach the top of the rep range on every work set</div>
            <div className="chips" style={{ marginTop: 8 }} role="group" aria-label="Weight increase">
              {INCREMENTS.map((v) => (
                <button
                  key={v}
                  className={`chip ${prefs.increment === v ? 'active' : ''}`}
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
            <div className="chips" style={{ marginTop: 8 }} role="group" aria-label="Bar weight">
              {BARS.map((v) => (
                <button
                  key={v}
                  className={`chip ${prefs.barKg === v ? 'active' : ''}`}
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
          {link('Browse programs', 'Ready-made plans for 3 to 6 days a week', <LayoutGrid size={18} aria-hidden />, () => nav('/programs'))}
          <button className="btn" onClick={loadStarter}>
            <Sparkles size={16} aria-hidden /> Add the starter plan (4 workouts)
          </button>
          <button className="btn" onClick={exportJson}>
            <Download size={16} aria-hidden /> Export backup (JSON)
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={16} aria-hidden /> Import backup
          </button>
          <div className="tiny muted">Backups include workouts, exercises, history and body weight. Photos stay in your account storage.</div>
        </>
      )}

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
