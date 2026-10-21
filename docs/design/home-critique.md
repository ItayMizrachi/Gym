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

## After

First screen now: greeting → one hero (workout, one Start, then "2 of 3 this week" row and a recovery row) → workouts list.
Heavy user page height 2,930px → ~2,000px; program user sees their workouts on the first screen.

Checked at 320, 375 and 440 wide for the three users, plus "workout in progress" and the three sheets
(`home-after-*.png`).

### ios-review findings
| Finding | Level | Status |
|---|---|---|
| In-progress card showed "Lower B (Wednesday)" on two huge lines | Should fix | Fixed: same name/day split as the hero |
| 320px: starter-plan button label clipped; "Empty workout" text button overflowed at 375 | Should fix | Fixed: icons drop at ≤360px, text actions without icons |
| Hero label wrapped behind the plate decoration | Should fix | Fixed: label no longer padded for the plate |
| Getting started still shown to a 40-workout user who never dismissed it | Should fix | Fixed: hidden after 5 finished workouts |
| Font sizes are px, so they ignore iOS text size settings | Should fix | App-wide (styles.css), not changed here |
| Mini body map in the recovery row is a hint, not readable at 42px | Nice to have | Kept: the text says it, tap opens the full map |
| Main Start sits in the upper half of the screen | Nice to have | Kept: it is the first thing on the page; each workout row has its own Start lower down |
| Touch targets: + New 38px + 4px hit slop, rows 60px, Move/Start 44px | OK | |
| Colour alone: recovery dots always have "Ready"/"Recovering" text; trained days are filled circles and listed in the row's label | OK | |
