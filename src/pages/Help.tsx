import { useState } from 'react'
import { Calculator, Check, ChevronDown, Disc, MoreHorizontal, Play, TrendingUp } from 'lucide-react'
import { PageHeader } from '../components/ui'
import '../styles/onboarding.css'

/** One question: a row you tap to open, so the whole list fits on a couple of screens. */
function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = 'help-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return (
    <div className={`help-sec${open ? ' open' : ''}`}>
      <h2>
        <button className="help-q" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          <span className="grow">{title}</span>
          <ChevronDown size={18} aria-hidden className="help-caret" />
        </button>
      </h2>
      {open && (
        <div className="help-a stack" id={id} style={{ gap: 8 }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function Help() {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader title="How it works" sub="Short answers about every part of GymLog." back={true} />

      <div className="help-list">
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
          Folders group your workouts on Train. A program goes into its own folder. Tap a folder name to fold it away. Hold a workout and drag it to change the order. To move a workout, open it and tap <b>Move</b> next to Folder. Tap{' '}
          <MoreHorizontal size={13} aria-label="Folder options" /> next to a folder to rename it.
        </p>
      </Sec>

      <Sec title="Timed exercises">
        <p>
          Some exercises, like a plank, are done for time instead of reps. Their sets show seconds and a stopwatch. They do not count for weight
          records.
        </p>
      </Sec>

      <Sec title="Workouts imported from Hevy or Strong">
        <p>
          Imported workouts land in History. Open one and tap <b>Save as a workout</b> to make it a plan on Train, with the same
          exercises, sets and rep range. From then on, Previous and Up next use it.
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
        <p>Tap the set number to change its type or remove the set.</p>
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
          <span className="chip pr">Est. 1-rep max ~117</span>
        </div>
        <p>
          A record is your heaviest weight, best estimated one-rep max, or most reps at a weight. You get a 🏆 alert when you beat one, and a
          “So close” alert when you reach 95% of your best. Warm-up and drop sets never count. The estimated 1-rep max uses the Epley
          formula, with reps capped at 12.
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
          Exercises with the same superset letter (blue rail) are done back to back. The rest timer starts after every set; when
          you go straight on to the paired exercise, tap <b>Skip</b>.
        </p>
      </Sec>

      <Sec title="Changing a workout as you go">
        <p>
          Tap a set number to make it a warm-up, drop or failure set, or to remove it. The timer button on each exercise sets its rest.
          Hold an exercise's name for a moment: the cards fold to one line each and you can drag it to a new place. When you finish, GymLog asks whether to save these
          changes to the plan or keep the plan as it was.
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


      <Sec title="Saving and offline">
        <div>
          <span className="help-dot">
            <span className="dot busy" /> saving
          </span>
          <span className="help-dot">
            <span className="dot err" /> not saved
          </span>
        </div>
        <p>
          Everything saves by itself. A note appears in the top corner only while something is saving, waiting for a signal, or did not save.
          With no signal, keep logging: changes sync when you are back online.
        </p>
      </Sec>

      <Sec title="Install on your phone">
        <p>
          <b>iPhone (Safari):</b> Share → Add to Home Screen.
          <br />
          <b>Android (Chrome):</b> ⋮ menu → Install app.
        </p>
      </Sec>
      </div>
    </div>
  )
}
