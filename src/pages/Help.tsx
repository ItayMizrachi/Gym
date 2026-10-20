import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Disc, TrendingUp } from 'lucide-react'
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
  const nav = useNavigate()
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <button className="btn icon ghost" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <h1>How it works</h1>
      </div>

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
          Type the reps, then tap <Check size={14} /> to log it. The check turns green and the rest timer starts by itself.
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

      <Sec title="RPE (optional)">
        <p>Rate how hard a set felt from 6 to 10. 10 means nothing left, 8 means 2 reps left. Turn it on in Settings.</p>
      </Sec>

      <Sec title="Rest timer">
        <p>Starts when you log a set. Use −15 / +15 to adjust it. It beeps and vibrates when rest is over.</p>
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
