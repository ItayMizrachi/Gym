import { useEffect, useMemo, useState } from 'react'
import { Dumbbell, Flame, Layers, Lock, Sparkles, Sunrise, Target, Trophy, Weight } from 'lucide-react'
import { useStore } from '../lib/store'
import { usePrefs } from '../lib/prefs'
import { fmtDate } from '../lib/format'
import { Achievement, AchievementIcon, achievements, achievementsSeen, freshAchievements, markAchievementsSeen, nextUp } from '../lib/achievements'
import { Sheet } from './ui'
import '../styles/records.css'

const ICONS: Record<AchievementIcon, typeof Trophy> = {
  start: Sparkles,
  count: Dumbbell,
  streak: Flame,
  record: Trophy,
  lift: Weight,
  volume: Layers,
  sun: Sunrise,
  goal: Target
}

export function AchievementIconBadge({ a, size = 44 }: { a: Achievement; size?: number }) {
  const Icon = ICONS[a.icon]
  return (
    <span className={`ach-badge${a.earned ? ' earned' : ''}`} style={{ width: size, height: size }} aria-hidden>
      <Icon size={Math.round(size * 0.46)} />
    </span>
  )
}

const num = (n: number, unit: string) => (unit === 'kg' ? (n >= 1000 ? `${(Math.round(n / 100) / 10).toLocaleString('en-GB')} t` : `${Math.round(n * 10) / 10} kg`) : String(Math.round(n)))

/** "2 of 4 weeks", "85 of 100 kg", "4.2 of 10 t" */
export function progressText(a: Achievement): string {
  if (a.hint) return a.hint
  if (a.unit === 'kg') return `${num(a.current, 'kg')} of ${num(a.target, 'kg')}`
  return `${Math.round(a.current)} of ${a.target} ${a.target === 1 ? a.unit.replace(/s$/, '') : a.unit}`
}

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div className="ach-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <i style={{ width: `${Math.max(value > 0 ? 4 : 0, value * 100)}%` }} />
    </div>
  )
}

/** Progress page: next three to earn, then every achievement (earned in colour, the rest dimmed). */
export function AchievementsSection() {
  const db = useStore((s) => s.db)
  const goal = usePrefs((s) => s.weeklyGoal)
  const list = useMemo(() => achievements(db, { weeklyGoal: goal }), [db, goal])
  const next = useMemo(() => nextUp(list), [list])
  const [open, setOpen] = useState<Achievement | null>(null)
  const earned = list.filter((a) => a.earned).length
  // earned first (newest first), then the rest in their natural order
  const grid = useMemo(
    () => [...list.filter((a) => a.earned).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')), ...list.filter((a) => !a.earned)],
    [list]
  )

  return (
    <section className="stack" style={{ gap: 12 }} aria-labelledby="ach-h">
      <div className="sec-head">
        <h2 id="ach-h">Achievements</h2>
        <span className="small muted">
          {earned} of {list.length} earned
        </span>
      </div>

      {next.length > 0 && (
        <div className="card stack ach-next" style={{ gap: 14 }}>
          <div className="ins-title">Next to earn</div>
          {next.map((a) => (
            <button key={a.id} className="ach-next-row" onClick={() => setOpen(a)}>
              <AchievementIconBadge a={a} size={40} />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="ach-next-t">
                  <span className="ellipsis">{a.title}</span>
                  <span className="small muted ach-num">{a.hint ? '' : progressText(a)}</span>
                </span>
                <Bar value={a.progress} label={`${a.title}: ${progressText(a)}`} />
                {a.hint && <span className="tiny muted">{a.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="ach-grid">
        {grid.map((a) => (
          <button
            key={a.id}
            className={`ach-tile${a.earned ? ' earned' : ''}`}
            onClick={() => setOpen(a)}
            aria-label={`${a.title}. ${a.earned ? `Earned ${fmtDate(a.date!, true)}` : `Not earned yet. ${progressText(a)}`}`}
          >
            <AchievementIconBadge a={a} />
            <span className="ach-tile-t">{a.title}</span>
            <span className="tiny ach-tile-d">
              {a.earned ? (
                fmtDate(a.date!, true)
              ) : (
                <>
                  <Lock size={11} aria-hidden /> {Math.round(a.progress * 100)}%
                </>
              )}
            </span>
          </button>
        ))}
      </div>

      {open && (
        <Sheet title={open.title} onClose={() => setOpen(null)}>
          <div className="stack ach-detail" style={{ gap: 14 }}>
            <AchievementIconBadge a={open} size={72} />
            <div>{open.desc}</div>
            {open.earned ? (
              <div className="chip pr" style={{ alignSelf: 'center' }}>
                Earned {fmtDate(open.date!, true)}
              </div>
            ) : (
              <div className="stack" style={{ gap: 6 }}>
                <Bar value={open.progress} label={`${open.title}: ${progressText(open)}`} />
                <div className="small muted">{progressText(open)}</div>
              </div>
            )}
          </div>
        </Sheet>
      )}
    </section>
  )
}

/**
 * Shows a one-time toast for each newly earned achievement. Which ones were shown is kept per user
 * on this device; the first run records what is already earned without a toast.
 */
export function useAchievementToasts() {
  const db = useStore((s) => s.db)
  const userId = useStore((s) => s.user?.id ?? 'local')
  const phase = useStore((s) => s.phase)
  const toast = useStore((s) => s.toast)
  const goal = usePrefs((s) => s.weeklyGoal)
  useEffect(() => {
    if (phase !== 'ready') return
    const list = achievements(db, { weeklyGoal: goal })
    const seen = achievementsSeen(userId)
    const fresh = freshAchievements(list, seen)
    if (seen == null || fresh.length) markAchievementsSeen(userId, [...(seen ?? []), ...list.filter((a) => a.earned).map((a) => a.id)])
    for (const a of fresh.slice(0, 3)) toast({ kind: 'pr', text: `Achievement: ${a.title}`, sub: 'See all your achievements on the Progress tab.' })
  }, [db, userId, phase, goal, toast])
}
