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

## In progress (parallel sessions, each opens a PR that the coordinator merges)
- Delete account and data (Settings → Account), body measurements (Body tab), records + achievements + weekly goal,
  smart warm-ups + 1RM tools.

## Needs you
- Nothing blocking. When you wake up: open the app on the phone, sign in with Google, try one workout.
