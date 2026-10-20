# Design pass (2026-10-20): before and after

Screens captured at iPhone size (375 × 812) with 9 weeks of sample workouts and an open workout.
Each image shows the old version on the left and the new one on the right. The small "This device only"
label in the "after" shots appears only in the developer build; the live site never shows it.

| Screen | File |
|---|---|
| Train (home) | [home.png](home.png) |
| Workout in progress | [session-top.png](session-top.png) |
| Workout summary | [session-detail.png](session-detail.png) |
| History | [history.png](history.png) |
| Body | [body.png](body.png) |
| Settings | [settings.png](settings.png) |
| Workout editor | [workout-editor.png](workout-editor.png) |
| Sign-in (new, Google only) | [login-after.png](login-after.png) |

## What changed, in plain words

- **New font.** Barlow and Barlow Condensed (narrow, a bit cramped) are replaced by Inter, one clean
  and very readable font used everywhere. Big numbers use Inter's tighter display cut automatically.
  Sizes follow one scale: 12 small notes, 14 secondary text, 16 normal text, 18 card titles,
  22 section titles, 28 page titles, 34+ big numbers. Every number lines up (tabular digits).
- **Same colours, more contrast.** The page floor is now almost black, cards stay graphite, so text and
  the yellow / blue / red / green plate colours stand out more. Blue and red text on tinted labels was
  lifted slightly so it is easy to read.
- **Bigger, clearer buttons.** Full-width buttons are 52 px tall. One yellow button per screen for the
  main action; the second choice is outlined, so it never competes.
- **Train tab reorganised.** Your workouts and the start buttons come first, each row has one clear
  "Start" (the next workout's is solid yellow); the weekly stats, sets per muscle and calendar follow.
- **Workout screen.** The set table fits even the smallest iPhones (320 px wide) without cutting off the
  tick button. Instead of the "🏆 67.5×8 · 1RM ~85.5" chips each exercise shows one plain line:
  "Best 67.5 kg × 8 · est. 1-rep max 85.5 kg". The workout title has more room.
- **Back buttons** are the iPhone-style chevron. Page titles are 28 px with a one-line explanation.
- **Sign-in is Google only** and nothing says "demo" any more. Settings shows your Google account and
  Sign out.
- **Accessibility.** Pinch-to-zoom works again, every text colour passes 4.5:1, the page has a main
  landmark for screen readers, and buttons are at least 44 px to tap.
