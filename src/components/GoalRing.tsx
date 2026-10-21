import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useStore } from '../lib/store'
import { usePrefs } from '../lib/prefs'
import { GOAL_MAX, GOAL_MIN, goalWeeksInRow, weekGoal } from '../lib/achievements'
import { Sheet } from './ui'
import '../styles/records.css'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Progress ring: yellow while on the way, green once the goal is reached. */
export function GoalRing({ done, goal, size = 64, count = true }: { done: number; goal: number; size?: number; count?: boolean }) {
  const stroke = size < 48 ? 5 : 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = Math.min(1, done / goal)
  return (
    <div className="goal-ring" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="goal-ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={`goal-ring-fill${done >= goal ? ' hit' : ''}`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {count && (
        <span className="goal-ring-n">
          {done}
          <span className="goal-ring-of">/{goal}</span>
        </span>
      )}
    </div>
  )
}

/** Pick 1–7 workouts a week. Tapping a number saves it. */
export function GoalSheet({ onClose }: { onClose: () => void }) {
  const goal = usePrefs((s) => s.weeklyGoal)
  const setPrefs = usePrefs((s) => s.setPrefs)
  const options = Array.from({ length: GOAL_MAX - GOAL_MIN + 1 }, (_, i) => GOAL_MIN + i)
  return (
    <Sheet title="Weekly goal" onClose={onClose}>
      <div className="stack" style={{ gap: 16 }}>
        <div className="muted">How many workouts a week do you aim for? Pick a number you can reach most weeks.</div>
        <div className="goal-pick" role="radiogroup" aria-label="Workouts per week">
          {options.map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={goal === n}
              aria-label={`${n} workout${n === 1 ? '' : 's'} a week`}
              className={goal === n ? 'on' : ''}
              onClick={() => {
                setPrefs({ weeklyGoal: n })
                onClose()
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="small muted">Workouts a week. You can change this any time.</div>
      </div>
    </Sheet>
  )
}

/** Train hero: one tappable line, "2 of 3 workouts this week" with the days trained. Tap to change the goal. */
export function WeekLine() {
  const db = useStore((s) => s.db)
  const goal = usePrefs((s) => s.weeklyGoal)
  const [editing, setEditing] = useState(false)
  const g = useMemo(() => weekGoal(db, goal), [db, goal])
  const inRow = useMemo(() => goalWeeksInRow(db, goal), [db, goal])
  const trained = g.days.flatMap((on, i) => (on ? [DAY_NAMES[(g.weekStart.getDay() + i) % 7]] : []))
  const note = g.hit ? (inRow > 1 ? `Goal reached, ${inRow} weeks in a row` : 'Goal reached') : `Goal ${g.goal} a week`
  return (
    <>
      <button
        className="hm-row"
        onClick={() => setEditing(true)}
        aria-label={`${g.done} of ${g.goal} workouts this week${trained.length ? ` (${trained.join(', ')})` : ''}. ${note}. Change weekly goal`}
      >
        <GoalRing done={g.done} goal={g.goal} size={40} count={false} />
        <span className="hm-row-body">
          <span className="hm-row-t">
            <b>
              {g.done} of {g.goal}
            </b>{' '}
            this week
          </span>
          <span className="hm-days" aria-hidden>
            {g.days.map((on, i) => (
              <i key={i} className={`${on ? 'on' : ''}${i === g.today ? ' today' : ''}`}>
                {DAY_LETTERS[(g.weekStart.getDay() + i) % 7]}
              </i>
            ))}
          </span>
        </span>
        <Pencil size={16} className="hm-row-end" aria-hidden />
      </button>
      {editing && <GoalSheet onClose={() => setEditing(false)} />}
    </>
  )
}
