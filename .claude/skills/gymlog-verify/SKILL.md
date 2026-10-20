---
name: gymlog-verify
description: Run GymLog locally and check a change in the real app (local mode, phone viewport). Use after editing any page, component, store or PR logic in this repo, or when asked to run, screenshot or test the app.
---

# Verify a GymLog change

1. Type-check first: `npx tsc --noEmit` (the build script does this too; `npm run build` = tsc + vite build).
   On Windows PowerShell may block npm scripts; run through the Bash tool or `cmd /c`.
2. Start the dev server with `preview_start` name `gymlog` (config in `.claude/launch.json`).
   The port may shift (5173 → 5174…); use the port the tool reports.
3. `resize_window` preset `mobile`. The app is phone-first; desktop width hides layout bugs.
4. With no `.env`, the app boots straight into local mode (LocalRepo / IndexedDB). No login needed.
   With a `.env` (cloud config), the dev server shows the Google sign-in screen: use the small
   "Continue offline (dev only)" link at the bottom. That link exists only in dev builds (`import.meta.env.DEV`);
   production builds offer Google sign-in only, so never verify local mode against `vite preview`.
   To reset local data: `indexedDB.deleteDatabase('keyval-store'); localStorage.clear(); location.reload()`.
5. Clicking in the mobile-emulated pane is unreliable (clicks may not reach React). Drive the UI with
   `javascript_tool`, e.g.
   `[...document.querySelectorAll('button')].find(b => b.textContent.includes('Start workout')).click()`,
   then `screenshot` to look at the result.
6. Typical smoke path: Home → "Load my starter plan" → "Start workout" → type reps → tick a set
   (rest bar appears) → Finish → History shows the session and any PRs.
7. Set the viewport back to `desktop` when done.

Design rules to keep (from CLAUDE.md): graphite bg, chalk text, plate colours only as accents
(yellow = brand/PR, blue = drop/superset, red = failure, green = done), no gradients, no ALL-CAPS labels.
