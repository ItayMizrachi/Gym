# Train tab: design critique (home-cleanup, 2026-10-21)

Screens: `home-before-{new,program,heavy}(-full).png` (375x812) → `home-after-*.png`.

## Before

**Overall:** the hero card is good, but everything after it shouts at the same volume. A user with a program
scrolls past five full-size cards before reaching their workout list; a heavy user's page is ~2,900px tall.

| Finding | Severity | Fix |
|---|---|---|
| Getting started (4 rows, ~380px) sits straight under the hero and pushes the week and workouts off the first screen | 🔴 | One-line row with progress bar, expands on tap; hidden once done or dismissed |
| "Your first week starts here" repeats the checklist's "Finish your first workout" | 🟡 | Remove |
| Weekly goal (ring card) and muscle recovery (body-map card) are two big cards for two one-line facts | 🔴 | Fold both into the hero: a "this week" row (ring + days, tap = change goal) and a recovery row (tap = body map sheet) |
| New workout / Empty workout are two 52px outlined buttons that look as important as Start | 🟡 | One small "+ New" button next to "Your workouts" opening a sheet (empty workout, build a workout, browse programs) |
| Calendar on Train duplicates Progress | 🟢 | Keep it on Progress only; Train keeps "This week" numbers and sets per muscle below the list |
| New user: welcome card has a 3-step list, 3 full buttons, then an Empty workout button and links: 6 things to tap | 🟡 | One sentence, one primary (Browse programs), one secondary (starter plan), two quiet text actions |

**Hierarchy:** eye goes to the yellow Start (correct), then to the checklist's green bar and the ring (wrong: they are secondary).
**Consistency:** cards had 4 different internal layouts (hero, list, ring row, body map row); action buttons of two sizes.
**Accessibility:** contrast fine; trow "Move" icon 44px ok; checklist rows 48px ok.
**Works well:** plate-coloured Start, "last done 7 days ago", workout rows with one Start each, folders.

## After (ios-review pass)
See the bottom of this file once the after-screens are in.
