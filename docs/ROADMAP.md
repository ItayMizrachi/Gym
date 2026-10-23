# GymLog roadmap and working brief

## The goal (owner's brief, refined)
Make GymLog the best workout app there is: the one people see and immediately feel they have to use.
- **Experience first.** UX/UI is what wins users. Every screen must be beautiful, calm and obvious.
  A brand-new user understands any screen in 3 seconds and can log a set with one thumb, mid-workout, sweaty.
- **Accessible and easy.** Big targets, high contrast, plain words, no jargon without a plain hint, no dead ends.
- **Professional at all times.** No "demo", no placeholder copy, no half-finished screens in production.
  Sign-in is Google only.
- **Fast and reliable.** Opens instantly, works offline at the gym, never loses a set.
- **Identity.** Keep the colours (graphite + plate accents). Improve typography, spacing and structure (see
  `.claude/skills/gymlog-ui`). Benchmark: Hevy and Strong; beat them on clarity and polish.

## How we work (for every session)
1. Read `C:\Gym\CLAUDE.md`, this file, and the skills `gymlog-ui` (design rules + UX checklist) and `gymlog-verify`.
2. Use the installed design plugins: `design:design-critique`, `mobile-app-design:ios-review`,
   `a11y-enforcer:a11y-check`, `frontend-design`.
3. Small, finished steps. Commit after each one, so a usage-limit stop never loses work.
4. Done means: `npx tsc --noEmit`, `npx vitest run`, `npx vite build` pass, and the screen was checked at 375x812
   in the browser and looked at critically.
5. Parallel sessions own separate files. Never edit another session's files.
6. The coordinator merges, re-verifies on a production build, and deploys to main (owner approved automatic deploys
   after all checks pass).

## Never idle (owner's rule)
Always keep something in progress. When the "Next" list runs low:
1. Self-review the live app: walk every screen at 375x812 as a new user and as a heavy user, run
   `design:design-critique`, `mobile-app-design:ios-review`, `a11y-enforcer:a11y-check` and `/code-review` on recent
   changes, and check bundle size and startup time.
2. Turn every real finding into a task and add it to "Next" (fixes first, then upgrades to existing features, then
   new features), with a one-line reason.
3. Re-check shipped work: anything that looks unfinished or inconsistent goes back on the list.

## Now (in progress)
- Design pass: Inter font, type scale, structure of every screen, accessibility, no demo wording, Google-only login.
- Exercise library: free-exercise-db (876 exercises with photos and instructions), search/filters, photos on
  every exercise in plans and programs, add your own.

## Next (priority order)
1. ~~**Lock-screen workout status.**~~ Shipped 21 Oct (Media Session card, opt-in). While a workout runs, show the current exercise and the rest countdown on the
   phone's lock screen. In a PWA this is done with the Media Session API (a "now playing" card, opt-in because it
   takes over the music card), plus a rest-over notification where the platform allows it (Android; iOS needs
   web push). Real iOS Live Activities need a native app; note this honestly in Help.
2. ~~**Personalised start.**~~ Shipped 21 Oct ("Find my program"). First-run questions (goal, experience, days per week, equipment) → recommend one of the
   ready-made programs, one tap to add it.
3. ~~**Import from Hevy / Strong (CSV).**~~ Shipped 21 Oct (Settings → Data & backup). Lets people switch without losing history.
4. ~~**Speed.**~~ First pass shipped 21 Oct (secondary screens lazy-loaded: main bundle 306 → 200 KB, 86 → 64 KB gzip). Lazy-load routes, keep the first screen tiny, render from the local cache immediately, lazy images.
   Measure bundle size before/after.
5. ~~**Account deletion in the app**~~ Shipped 21 Oct (PR #1). (Settings → Delete account and data), required for Google and app-store policy.
6. ~~**Weekly goal and plan.**~~ Goal shipped 21 Oct (PR #4); planned days shipped 21 Oct. Set a weekly target (e.g. 4 workouts), see the planned days, gentle progress ring.
7. ~~**Records & achievements.**~~ Shipped 21 Oct (PR #4). A records page per exercise and badges (first 100 kg bench, 10-week streak…),
   tasteful, never noisy.
8. ~~**Body measurements**~~ Shipped 21 Oct (PR #2). beyond weight (waist, chest, arms, thighs) with charts.
9. ~~**Smart warm-ups.**~~ Shipped 21 Oct (PR #3). One tap generates warm-up sets ramping to the first work weight.
10. ~~**Tools.**~~ Shipped 21 Oct (PR #3). 1RM calculator and plate calculator reachable from anywhere.
11. **Google verification readiness** — checked 21 Oct: GymLog only asks for name and email (non-sensitive scopes), so a published app shows the normal Google sign-in with no "unverified" warning; verification is only needed to show a logo on that screen. Needs the owner: verify itaymizrachi.github.io in Google Search Console, then submit branding for review. Original note: so the "unverified app" notice disappears (privacy/terms pages exist).

## Found in self-review
- ~~Program cards grey thumbs~~ — checked: photos were still loading, all resolve.
- ~~Google button overlap~~ — fixed: logo on the left (Google still shows the account's language, e.g. Hebrew).

- ~~History: "1 sets", "8-week avg 0 kg" for new users~~ — fixed.

- ~~Body: weight change shown in red when going down~~ — fixed: neutral (losing can be the goal).
- ~~Workout title cut to "Lower ..." on 320px phones~~ — fixed: wraps to two lines.
- ~~Search placeholder cut off~~ — fixed: "Search exercises".
- ~~Exercises list long names cut at 320px~~ — fixed: names wrap to two lines.
- ~~Achievement toast listing everything after an import~~ — fixed: "You've earned N achievements".

- ~~Toasts covering Finish on the workout screen~~ — fixed: shown under the header there.

## Later / ideas
- **Native iPhone app** (App Store, $99/year developer account): real lock-screen Live Activity for the rest timer, Apple Health heart rate during workouts (AirPods / Apple Watch), reliable rest-over alerts. The web lock-screen card was removed on 23 Oct because Apple only offers a music-style card that freezes while locked; its code is kept in src/lib/lockscreen.ts.
- Pounds as a unit (Settings → Units): store kg, show and type lb everywhere. Touches every weight display and input, so plan it as one careful pass with tests.
- Rest-day suggestions and deload hints from training load.
- Exercise animations (two-frame from the library images).
- Light theme option (only if it reaches the same polish).
