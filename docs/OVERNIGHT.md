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

## In progress
- Next from the roadmap: import from Hevy / Strong (CSV).

## Needs you
- Nothing blocking. When you wake up: open the app on the phone, sign in with Google, try one workout.
