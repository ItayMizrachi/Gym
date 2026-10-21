# Live workout screen: focus pass (2026-10-21)

Goal: calm and fast mid-set, one-handed, sweaty. Screenshots: `workout-before-*.png` and `workout-after-*.png`.

## Audit (design critique + iOS review, 375x812 and 320 wide)

Must fix
1. Empty reps / time boxes were 66px tall instead of 44px: the keypad field used the class `empty`, which also styles
   the page empty state (32px padding). Rows looked broken whenever a reps box had only the grey suggestion.
2. Up to six lines of extras sat above the set table (muscle, rep range + rest, superset chip, note, last time's note,
   setup, progression sentence, best set). On the first card the table started halfway down the screen.
3. The "This device only" sync pill (Layout.tsx, not this screen's file) overlaps the top of Finish. Follow-up for the
   owner of Layout.

Should fix
4. Finished exercises stayed full size, so the page was 5,500px long and you scrolled past done work to reach the next set.
5. Nothing showed which exercise you are on.
6. The rest player (76px ring) covered the next set's row after logging.
7. The rest ring's track had the same colour as the player, so the remaining time was hard to read.
8. Header took 151px of an 812px screen.

Nice to have
9. No feedback motion when a set is logged or a record is hit.

What already worked: set table columns, plate colours for set types, big 44px targets, one-tap logging with the grey suggestion.

## What changed

- Card = photo, name, one summary line, set table, add-set row. The summary line shows rep range and rest, a short
  superset tag (link icon + letter) and a note icon when there are notes. Tap the name or line to fold out: muscle and
  equipment, plan and superset rule, today's note, last time's note, setup, first-time tip, why the weight went up or
  holds, best set and best estimated 1-rep max, and a "How to do it" button. Tapping the photo still opens How to.
- Kept visible because they change what you lift: progression chip (now short: "+2.5 kg today" with Undo, or
  "Hold 60 kg · aim for 8+ reps") and the PR hint on the next set.
- Current exercise (first with a set to do) gets a quiet yellow edge. A finished exercise folds to one line
  ("3 sets · 25×10 · 25×10 · 25×10") with a green check on its photo, 0.7s after the last tick; tap to open it again.
- After logging, the next set to do scrolls clear of the rest player.
- Header 151 → 133px (smaller body map, tighter spacing); rest player ring 76 → 64px, track now visible.
- Motion: the check pops (0.2s scale) as it turns green and the row tints; a new record row gets one light yellow glow;
  folds animate in 0.22s. Everything is off with reduced motion. No confetti, no bounce.
- Page length with the sample workout: 5,486 → 3,780px.

Checked after the change at 375 and 320: one-tap logging, superset hop (no rest until the round ends), replace
exercise, warm-up sheet, GymLog number pad, timed set start/stop + log, fold/unfold, no horizontal scroll at 320.
