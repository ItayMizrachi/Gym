import { useRef, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { FileUp } from 'lucide-react'
import { Sheet, Toggle } from './ui'
import { useStore } from '../lib/store'
import { BodyRow, ParseResult, isMeasurementExport, parseExport, parseMeasurements, planBodyImport, planImport } from '../lib/importCsv'
import { nowIso, uid } from '../lib/uid'
import { loadLibrary } from '../lib/library'

const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Import workout history from a Hevy or Strong CSV export, or body weight from Hevy's measurements export. */
export default function ImportOther({ onClose }: { onClose: () => void }) {
  const toast = useStore((s) => s.toast)
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState<string | null>(null)
  const [pounds, setPounds] = useState(false)
  const [res, setRes] = useState<ParseResult | null>(null)
  // Hevy's measurement_data.csv: body weight and tape measures, one row per day
  const [body, setBody] = useState<BodyRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function read(t: string, lb: boolean) {
    try {
      if (isMeasurementExport(t)) {
        setRes(null)
        setBody(parseMeasurements(t))
        setErr(null)
        return
      }
      setBody(null)
      setRes(parseExport(t, lb))
      setErr(null)
    } catch (e: any) {
      setRes(null)
      setErr(String(e?.message ?? e))
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return
    const t = await f.text()
    setText(t)
    read(t, pounds)
    if (fileRef.current) fileRef.current.value = ''
  }

  function runBody() {
    if (!body) return
    const { db, save, user } = useStore.getState()
    const plan = planBodyImport(body, db.metrics, user?.id ?? 'local', nowIso(), uid)
    plan.save.forEach((m) => save('metrics', m))
    toast({
      kind: 'info',
      text: plan.added + plan.updated ? `${plan.added + plan.updated} weigh-ins imported` : 'Nothing new to import',
      sub: plan.skipped ? `${plan.skipped} days were already in GymLog and kept as they are.` : 'They are on the Body tab.'
    })
    onClose()
  }

  async function run() {
    if (body) return runBody()
    if (!res) return
    setBusy(true)
    let lib: Awaited<ReturnType<typeof loadLibrary>> = []
    try {
      lib = await loadLibrary()
    } catch {
      /* offline: exercises still import, photos get matched later */
    }
    const { db, save, user } = useStore.getState()
    const plan = planImport(res.workouts, user?.id ?? 'local', db, lib)
    plan.exercises.forEach((e) => save('exercises', e)) // parents first, so the cloud keeps them in order
    plan.sessions.forEach((s) => save('sessions', s))
    setBusy(false)
    toast({
      kind: 'info',
      text: plan.sessions.length ? `${plan.sessions.length} workouts imported` : 'Nothing new to import',
      sub: plan.skipped ? `${plan.skipped} were already in GymLog and were skipped.` : 'They are in History, and your records include them.'
    })
    onClose()
  }

  const sets = res?.workouts.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.length, 0), 0) ?? 0
  const first = res?.workouts[0]?.start
  const last = res?.workouts[res.workouts.length - 1]?.start

  return (
    <Sheet title={tr("Import from Hevy or Strong")} onClose={onClose}>
      <div className="stack">
        <div className="small muted">
          <b style={{ color: 'var(--text)' }}>Hevy:</b> Profile → Settings → Export &amp; import data → Export workouts, and Export
          measurements for your body weight.
          <br />
          <b style={{ color: 'var(--text)' }}>Strong:</b> Settings → Export Strong data.
          <br />
          {tr("Then pick the CSV file here. Your history, sets and records come with you.")}
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <FileUp size={18} aria-hidden /> {text ? 'Choose another file' : 'Choose CSV file'}
        </button>

        {err && <div className="msg err">{err}</div>}

        {body && (
          <div className="card stack" style={{ gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Hevy measurements · {body.length} days</div>
            {body.length > 0 && (
              <div className="small muted">
                {fmtDay(new Date(body[0].date + 'T12:00:00'))} – {fmtDay(new Date(body[body.length - 1].date + 'T12:00:00'))} · {body.filter((b) => b.weight_kg != null).length}{' '}
                weigh-ins
              </div>
            )}
          </div>
        )}

        {res && (
          <div className="card stack" style={{ gap: 8 }}>
            <div style={{ fontWeight: 600 }}>
              {res.source === 'hevy' ? 'Hevy' : 'Strong'} export · {res.workouts.length} workouts · {sets} sets
            </div>
            {first && last && (
              <div className="small muted">
                {fmtDay(first)} – {fmtDay(last)}
              </div>
            )}
            {res.source === 'strong' && (
              <div className="row">
                <div className="grow">
                  <div>{tr("Weights are in pounds")}</div>
                  <div className="small muted">{tr("Strong's file has no unit. Turn on if you log in lb.")}</div>
                </div>
                <Toggle
                  on={pounds}
                  ariaLabel="Weights are in pounds"
                  onChange={(v) => {
                    setPounds(v)
                    if (text) read(text, v)
                  }}
                />
              </div>
            )}
            {res.source === 'hevy' && res.pounds && <div className="small muted">{tr("Weights were in pounds and are converted to kg.")}</div>}
          </div>
        )}

        <button className="btn primary block" disabled={body ? !body.length : !res || !res.workouts.length || busy} onClick={run}>
          {busy ? 'Importing…' : body ? `Import ${body.length} days` : res ? `Import ${res.workouts.length} workouts` : 'Import'}
        </button>
        <div className="tiny muted">{tr("Importing the same file again is safe: workouts and days already in GymLog are skipped.")}</div>
      </div>
    </Sheet>
  )
}
