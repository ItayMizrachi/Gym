import { Calculator, Check, Disc, FolderInput, MoreHorizontal, Play, TrendingUp } from 'lucide-react'
import { PageHeader } from '../components/ui'
import '../styles/onboarding.css'

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card stack help-sec" style={{ gap: 8 }}>
      <h2>{title}</h2>
      {children}
    </div>
  )
}

export default function Help() {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader title="How it works" sub="Short answers about every part of GymLog." back={true} />

      <Sec title="Getting started">
        <p>
          On <b>Train</b>, tap <b>Browse programs</b>. Pick a single workout and tap <b>Start now</b>, or add a weekly program. Its workouts
          appear on Train: tap <Play size={13} aria-label="Start" /> to begin, and log each set as you go.
        </p>
      </Sec>

      <Sec title="Programs">
        <p>
          <b>Single workouts</b> are one session you can start right away, or save to your workouts. <b>Weekly programs</b> are plans for 2 to 6
          days a week. Tap <b>Add program</b> and their workouts appear on Train in their own folder. Filter by level, equipment and length. You
          can change anything afterwards.
        </p>
      </Sec>

      <Sec title="Folders">
        <p>
          Folders group your workouts on Train. A program goes into its own folder. Tap a folder name to fold it away. Use{' '}
          <FolderInput size={13} aria-label="Move to folder" /> or the Folder field in a workout to move it. Tap{' '}
          <MoreHorizontal size={13} aria-label="Folder options" /> next to a folder to rename it.
        </p>
      </Sec>

      <Sec title="Timed exercises">
        <p>
          Some exercises, like a plank, are done for time instead of reps. Their sets show seconds and a stopwatch. They do not count for weight
          records.
        </p>
      </Sec>

      <Sec title="Editing a finished workout">
        <p>
          Forgot a set or typed the wrong weight? Open the workout in <b>History</b> and tap <b>Edit workout</b>. Records update to match.
        </p>
      </Sec>

      <Sec title="Progress">
        <p>
          The <b>Progress</b> tab shows how you are doing over time: your records, charts and how often you train. Your exercise list is there
          too.
        </p>
      </Sec>

      <Sec title="Set types">
        <div className="help-legend">
          <span className="kind work">1</span>
          <span>Work set. These count for records.</span>
          <span className="kind warmup">W</span>
          <span>Warm-up. Short rest, no records.</span>
          <span className="kind drop">D</span>
          <span>Drop set. Lighter weight right after a set.</span>
          <span className="kind failure">F</span>
          <span>To failure. Counts for records.</span>
        </div>
        <p>Tap the set number to change its type.</p>
      </Sec>

      <Sec title="Logging a set">
        <p>
          Type the reps, then tap <Check size={14} /> to log it. If you did exactly the grey number shown in the box (last time,
          or the bottom of the rep range), just tap <Check size={14} />: it logs that number. The check turns green and the rest
          timer starts by itself.
        </p>
        <p>
          <b>Prev</b> shows what you did on the same set last time. Weights fill in from last time too.
        </p>
      </Sec>

      <Sec title="Records">
        <div className="help-ex">
          <span className="chip pr">🏆 100×5</span>
          <span className="chip pr">1RM ~117</span>
        </div>
        <p>
          A record is your heaviest weight, best estimated one-rep max, or most reps at a weight. You get a 🏆 alert when you beat one, and a
          “So close” alert when you reach 95% of your best.
        </p>
      </Sec>

      <Sec title="Weight suggestions">
        <div className="help-ex">
          <span className="prog" style={{ margin: 0 }}>
            <TrendingUp size={14} /> <span>+2.5 kg: you hit 10/10/10 last time</span>
          </span>
        </div>
        <p>When you reach the top of the rep range on every work set, the next workout adds weight. Tap Undo to keep the old weight.</p>
      </Sec>

      <Sec title="Plate calculator">
        <p>
          Tap <b>kg <Disc size={12} /></b> above the sets, or hold a weight, to see which plates go on each side. Set your bar and plates in
          Settings.
        </p>
      </Sec>

      <Sec title="Warm-up sets">
        <p>
          Tap <b>+ Warm-up</b> under an exercise, then <b>Add warm-up sets</b>. GymLog builds 2 to 4 lighter sets from your first work
          weight, like the empty bar × 10, then 50%, 70% and 85%, rounded to plates you have. Machines and dumbbells get fewer sets, very light
          weights none. Warm-ups never count for records.
        </p>
      </Sec>

      <Sec title="Tools">
        <p>
          Tap <Calculator size={13} aria-label="Tools" /> at the top of a workout. <b>1-rep max</b> guesses the most you could lift once from
          a set, and shows what you could lift for 1 to 12 reps at the same effort. <b>Percent</b> turns “80% of max” into a weight you can
          load. <b>Plates</b> opens the plate calculator.
        </p>
      </Sec>

      <Sec title="RPE (optional)">
        <p>Rate how hard a set felt from 6 to 10. 10 means nothing left, 8 means 2 reps left. Turn it on in Settings.</p>
      </Sec>

      <Sec title="Rest timer">
        <p>Starts when you log a set. Use −15 / +15 to adjust it. It beeps and vibrates when rest is over.</p>
      </Sec>

      <Sec title="Supersets">
        <p>
          Exercises with the same superset letter (blue rail) are done back to back. Log a set and GymLog skips the rest and
          scrolls to the paired exercise; the rest timer starts once every exercise in the round has its set logged.
        </p>
      </Sec>

      <Sec title="Swapping an exercise">
        <p>
          Machine taken? In a workout, tap ⋯ on the exercise → <b>Replace exercise</b>. Sets you already logged stay with the
          original; the sets still to do move to the new exercise, with weights from the last time you did it.
        </p>
      </Sec>

      <Sec title="Stalled lifts">
        <p>
          On Progress, an exercise you train regularly shows up here when your best estimated 1-rep max has not improved for 4
          sessions. Plateaus are normal: an easier week or a different rep range usually gets it moving again.
        </p>
      </Sec>

      <Sec title="Muscle recovery">
        <p>
          The Train tab shows which muscles you worked in the last days (brighter = worked harder) and which are rested and
          ready. Big muscles show as recovering for about 3 days, smaller ones for about 2. Use it to pick today's workout.
        </p>
      </Sec>

      <Sec title="Workout on the lock screen">
        <p>
          Turn on <b>Show workout on lock screen</b> in Settings. While you train, the lock screen shows the current exercise,
          the set you are on and the rest countdown.
        </p>
        <p className="muted">
          It uses the same card as music, so it replaces Spotify or other audio while it is on. A true iPhone Live Activity
          needs an App Store app; this is the closest a web app can get.
        </p>
      </Sec>

      <Sec title="Saving and offline">
        <div>
          <span className="help-dot">
            <span className="dot" /> saved
          </span>
          <span className="help-dot">
            <span className="dot busy" /> saving
          </span>
          <span className="help-dot">
            <span className="dot err" /> not saved
          </span>
        </div>
        <p>The dot in the top corner shows sync status. With no signal, keep logging. Changes sync when you are back online.</p>
      </Sec>

      <Sec title="Install on your phone">
        <p>
          <b>iPhone (Safari):</b> Share → Add to Home Screen.
          <br />
          <b>Android (Chrome):</b> ⋮ menu → Install app.
        </p>
      </Sec>
    </div>
  )
}
