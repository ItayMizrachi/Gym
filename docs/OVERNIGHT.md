# Overnight log (20–21 Oct 2026)

## Shipped to https://itaymizrachi.github.io/Gym/
- **Design pass:** Inter font everywhere with a clear type scale; near-black floor with graphite cards; 52px
  buttons; roomier lists, sheets and nav; iOS-style back chevron; fixes for small (320px) phones; better contrast
  (4.5:1) on coloured chips; pinch-zoom allowed. Before/after screenshots: `docs/design/`.
- **Google-only sign-in, no "demo" anywhere.** The login screen is one Google button with a short privacy line.
  (Email sign-in is also switched off in Supabase.)
- **Exercise library:** 876 exercises with photos and step-by-step instructions (free-exercise-db), search and
  filters, add any of them to your exercises or a workout.
- **A picture for every exercise:** starter plan and all 30 ready-made programs show real photos; your own
  exercises get a matching picture automatically; tapping any picture opens "How to do it".

- **Workout on the lock screen:** Settings → "Show workout on lock screen". While you train, the lock screen shows
  the exercise, which set you are on and the rest countdown with a progress bar; ⏭ skips rest, ⏮ adds 15 s.
  It uses the music card, so it replaces Spotify while on (that's why it's off by default). Explained in Help.

- **Find my program:** 4 quick questions (goal, experience, days a week, equipment) → the best-fitting ready-made
  program plus two alternatives, added in one tap. It's the main button at the end of the welcome tour and a card at
  the top of the Programs page.

- **Import from Hevy or Strong:** Settings → Data & backup → "Import from Hevy or Strong". Pick the CSV export;
  workouts, sets (warm-up / drop / failure), notes, RPE and timed sets come over, exercises get matching photos,
  and importing the same file twice skips what is already there. Strong pounds can be converted.
- Small fixes: Google button logo no longer overlaps its label; History says "1 set" and hides an empty weekly
  average.

- **Faster start:** the first download is about a quarter smaller (secondary screens load when first opened and
  are still cached for offline use).

- **Delete account and data:** Settings → Account → Delete account. Explains what goes, offers a backup first,
  needs DELETE typed. The database function is installed in Supabase and only works for the signed-in user.
- **Body measurements:** log waist, chest, arms, thighs, body fat and more with your weight; a chart per measure,
  change vs 30 days ago, and a "where to measure" body guide.

- **Records, achievements and a weekly goal:** a Records page with every exercise's best set, estimated 1-rep max
  and rep records; ~15 achievements on Progress (earned in colour, next ones with progress bars); a weekly goal
  ring on Train ("0 of 3 workouts this week").
- **Smart warm-ups and tools:** "+ Warm-up" can add ramped warm-up sets rounded to your plates; a Tools sheet in
  the workout has a 1-rep-max calculator, a percent table and the plate calculator.

- **Self-review fixes:** weight trend no longer red when you lose weight; workout title wraps on small phones;
  exercise names wrap instead of cutting; shorter search hint; a calmer toast when many achievements arrive at once.

- **Weekly plan:** each workout can have planned days (workout editor → "Planned days"). On those days the Train
  tab says "Today's workout". The starter plan and the weekly programs come with their days filled in.

## In progress (parallel sessions, each opens a PR that the coordinator merges)
- Next: self-review pass of the whole app (design critique, accessibility, code review) and the fixes it finds.

- The Train tab shows each workout's planned days (e.g. "Mon · 5 exercises").
- Correction from yesterday: because GymLog only asks Google for name and email, new users get Google's normal
  sign-in screen with no "unverified app" warning. Verification is only needed if you want the GymLog logo on that
  screen (it needs you to verify the site in Google Search Console).

- **Reliability:** exercise photos are now kept for offline use (they show at the gym without signal); the first
  install is ~0.4 MB lighter; a screen that can't load after an update reloads itself, and offline shows a calm
  "Try again" card instead of a blank page.

- **New: muscle recovery on Train.** A body figure shows which muscles you worked in the last days (brighter =
  harder) and lists what is recovering and what is ready, so picking today's workout is easier. Explained in Help.

- **A number to beat:** during a workout the volume label shows last time's total for the same workout
  ("Last 9.8 t") and turns green with "Beat last time" once you pass it.

## Needs you
- Optional: try Delete account once with a spare Google account to confirm it end to end (I can't sign in).
- Nothing blocking. When you wake up: open the app on the phone, sign in with Google, try one workout.
