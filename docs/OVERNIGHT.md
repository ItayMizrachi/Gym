# Overnight log (20–21 Oct 2026)

Everything below is live at https://itaymizrachi.github.io/Gym/ and passed type-check, 1,150+ tests, a production
build and a phone-size browser check before it went up.

## The big ones
- **New look:** Inter font with a clear type scale, near-black background with graphite cards, big 52px buttons,
  roomier lists, iOS-style back arrows, fixes for small phones, better contrast. Your colours are unchanged.
  Before/after screenshots: `docs/design/`.
- **Exercise library:** 876 exercises, each with photos and step-by-step instructions, search and filters. Every
  exercise in the starter plan and all 30 ready-made programs has a real photo; your own exercises get a matching one
  automatically; tap any photo for "How to do it".
- **Sign-in is Google only,** with no "demo" anywhere. (Email sign-in is also off in Supabase.) The sign-in screen
  now shows three short reasons to join (one-tap logging, 876 exercises with photos, records and streaks).
- **Find my program:** 4 questions (goal, experience, days a week, equipment) → the best-fitting ready-made program,
  added in one tap.

## During a workout
- **One-tap sets:** tapping ✓ on an empty reps box logs the grey suggested number.
- **A number to beat:** the volume label shows last time's total and turns green with "Beat last time".
- **Replace an exercise** (machine taken): ⋯ → Replace exercise. Logged sets stay; the rest move over.
- **Supersets that flow:** log a set and GymLog skips the rest and scrolls to the paired exercise; the rest timer
  starts at the end of the round.
- **Smart warm-ups:** "+ Warm-up" can add ramped warm-up sets rounded to your plates.
- **Tools:** 1-rep-max calculator, percent table and plate calculator (calculator icon in the header).
- **Lock screen:** Settings → "Show workout on lock screen" shows the exercise, set and rest countdown on the lock
  screen (⏭ skips rest, ⏮ adds 15 s). It uses the music card, so it's off by default.
- Messages (records, achievements) no longer cover the Finish button.

## Progress and planning
- **Weekly plan:** give workouts planned days (workout editor → Planned days); the Train tab then says
  "Today's workout". The starter plan and weekly programs come with days filled in.
- **Weekly goal** ring on Train ("2 of 3 workouts this week").
- **Muscle recovery** on Train: a body figure of what you worked recently, plus what's ready to train.
- **Records page** (best set and estimated 1-rep max for every exercise) and **~15 achievements** on Progress.
- **Stalled lifts** on Progress: exercises with no new best for 4 sessions, with a plain suggestion.
- **Body measurements:** waist, chest, arms, thighs, body fat and more, with a chart per measure and a
  "where to measure" guide.

## Data and account
- **Import from Hevy or Strong** (Settings → Data & backup): bring your whole history over.
- **Delete account and data** (Settings → Account), as Google requires.

## Speed and reliability
- First download about 25% smaller; the first install ~0.4 MB lighter.
- Exercise photos stay available offline at the gym.
- After an update, a screen that can't load reloads itself; offline it shows a calm "Try again" card.
- Fixed: editing exercises during a workout could drop the workout photo field.

## Good to know
- Because GymLog only asks Google for name and email, new users see Google's normal sign-in, with no
  "unverified app" warning. (Showing the GymLog logo there would need you to verify the site in Google Search Console.)
- Database changes made tonight in Supabase: `metrics.measures`, `workouts.days`, and the `delete_my_account` function.

## Needs you
- Open the app on your phone, sign in with Google and do one short workout: that's the one thing I can't test.
- Optional: try Delete account once with a spare Google account to confirm it end to end.
