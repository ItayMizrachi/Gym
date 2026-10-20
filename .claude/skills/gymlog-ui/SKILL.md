---
name: gymlog-ui
description: GymLog's design system and UX checklist. Use before building or changing any screen, component or CSS in this repo, and to review a screen's UX/UI. Pairs with gymlog-verify for checking the result at phone size.
---

# GymLog UI/UX

The owner's bar: it must feel as easy and polished as Hevy or Strong. UX/UI is what wins users.
A brand-new user should understand every screen in 3 seconds without reading help text.

## Identity (do not change)
- Colours: graphite background, chalk text, plate colours as the only accents.
  Yellow `--accent` = brand, primary action, records. Blue `--plate-blue` = drop sets, supersets.
  Red `--danger` = failure, destructive. Green `--ok` = done / completed sets.
- No gradients. No ALL-CAPS labels. English UI, short plain sentences.

## Typography
- One clean UI font with a clear scale (target: Inter, self-hosted via @fontsource; fall back to the system stack).
  Avoid condensed faces for body text or small labels.
- Scale (px): 12 caption, 14 secondary, 16 body, 18 card title, 22 section title, 28 page title, 34+ hero number.
- Weights: 400 body, 500 labels, 600 titles, 700 big numbers. Line height 1.4 body, 1.15 headings.
- Every weight, rep, time and counter uses `font-variant-numeric: tabular-nums`.
- Numbers lead, labels follow small and muted underneath (Hevy's "Time / Volume / Sets" row).

## Layout and components
- 16px side gutter, 8px spacing grid (8/12/16/24/32). Cards: 16px padding, 14–16px radius, subtle border, no heavy shadow.
- One primary action per screen: full-width, 52px tall, accent background, dark text. Secondary: outlined or tonal.
- Touch targets at least 44x44. Bottom nav: 5 items max, icon + label, active state obvious, safe-area padding.
- Exercise rows: round thumbnail (40–48px) + name + "muscle · equipment" muted line.
- Set table: SET / PREVIOUS / KG / REPS / ✓. A completed row gets a green tint, the check turns solid green.
- Sheets slide up with a drag handle; destructive actions confirm and sit at the bottom in red.
- Empty states: one sentence saying what this screen is for + one clear button.
- Every sub-screen has a back arrow and a title; every page title has a one-line plain subtitle.

## UX checklist (run before calling a screen done)
1. Can a new user tell what this screen is for and what to tap next, in 3 seconds?
2. Is there exactly one obvious primary action?
3. Is every number labelled in plain words (no bare "e1RM": say "best estimated 1-rep max")?
4. Do empty, loading, offline and error states look intentional?
5. Can it be used one-handed at the gym: big targets, key actions in the bottom half?
6. Is text at least 4.5:1 contrast (3:1 for large text) and are icon buttons labelled for screen readers?
7. Does it still look right at 320px wide and with long exercise names?
8. Did you check it in the browser at 375x812 (skill `gymlog-verify`) and look at the screenshot critically?

## Code conventions
- Colours and spacing only through CSS variables in `src/styles.css`; do not hard-code hex values in components.
- Shared pieces live in `src/components/ui.tsx` (PageHeader, Sheet, Thumb, Empty, Toggle, Confirm, Skeleton).
- Respect `prefers-reduced-motion`; keep animations short (150–250ms).
