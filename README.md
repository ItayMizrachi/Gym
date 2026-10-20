# GymLog

A mobile-first workout tracker you install on your phone (iPhone and Android) straight from the browser.

- Workouts you can edit: exercises, sets, rep ranges, weights, rest times, supersets, drop sets
- Live workout screen with a rest timer (beep and vibration), last-time numbers next to every set, and personal records
- A "🏆 PR" alert when you break a record, and a hint when you are 1-2 reps away from one
- Exercise library with a photo, setup notes (seat / pad / pin positions) and cues for each exercise
- History, per-exercise charts, body-weight log with a 7-day average, trend per week and progress photos
- Sign in with Google (or email). Every user only sees their own data.
- Works without any setup in **demo mode** (data stays in the browser on that device)

Stack: React + TypeScript + Vite, installable PWA, Supabase (Postgres, Auth, Storage).

---

## 1. Try it locally (demo mode, no accounts needed)

```bash
npm install     # downloads the libraries listed in package.json into node_modules
npm run dev     # starts a local dev server (usually http://localhost:5173) with live reload
```

Without a `.env` file the app runs in demo mode: everything is stored in your browser on this device.

## 2. Turn on accounts and cloud sync (Supabase, free tier)

1. Create a project at https://supabase.com (free). Pick a region close to you.
2. **Database:** Supabase → SQL Editor → New query → paste all of `supabase/schema.sql` → Run.
   This creates the tables, the row-level security rules (each user can only touch their own rows) and a private
   photo bucket called `gymlog`.
3. **Google sign-in:**
   1. Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.
   2. Authorised redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
      (Supabase → Authentication → Providers → Google shows the exact URL to copy).
   3. Copy the Client ID and Client secret into Supabase → Authentication → Providers → Google, and enable it.
   4. First time only: Google asks for an OAuth consent screen. Choose "External", add your own email as a test user,
      or publish the app if other people will use it.
4. **Redirect URLs:** Supabase → Authentication → URL Configuration
   - Site URL: the address where you will host the app (for example `https://gymlog.pages.dev/`)
   - Additional redirect URLs: the same address, plus `http://localhost:5173/` for local testing
5. **Keys:** Supabase → Project Settings → API. Copy "Project URL" and the "anon public" key.

```bash
cp .env.example .env    # copies the template to a real settings file named .env
```

Open `.env` and paste the URL and the anon key. (The anon key is meant to be public; the row-level security rules
are what protect the data. Never put the `service_role` key in this project.)

Optional: Supabase → Authentication → Providers → Email → turn off "Allow new users to sign up with email"
if you only want Google sign-in.

## 3. Publish it so it works from your phone

The build output is plain static files, so any static host works (Cloudflare Pages, Netlify, Vercel, GitHub Pages).

```bash
npm run build   # checks the TypeScript, then writes the finished app into the dist/ folder
npm run preview # serves dist/ locally so you can test the real build
```

Upload the `dist/` folder (or connect the repo and use build command `npm run build`, output folder `dist`).
Set the two environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's settings.

GitHub Pages: add both values as repository secrets and use `.github/workflows/deploy.yml`.

The app uses `#` routes, so no special server rules are needed.

## 4. Install on the phone

- iPhone (Safari): Share → Add to Home Screen
- Android (Chrome): ⋮ → Install app

## Project layout

| Path | What it is |
| --- | --- |
| `src/lib/db.ts` | Storage: `LocalRepo` (demo, IndexedDB) and `SupabaseRepo` (cloud) behind one interface |
| `src/lib/store.ts` | App state, debounced saving, ordered writes, rest timer |
| `src/lib/pr.ts` | Record logic: heaviest weight, estimated 1RM (Epley, reps capped at 12), rep records, near-record hints |
| `src/lib/seed.ts` | The starter 4-day plan |
| `src/pages/` | Screens: Home, WorkoutEditor, Session (live workout), Exercises, History, Body, Settings |
| `supabase/schema.sql` | Database, security rules and photo storage |

## How records work

Only work sets and failure sets count. Warm-ups and drop sets never create records.
A set is a record when it has the heaviest weight ever, the best estimated 1RM, or more reps than any earlier set
at the same or a heavier weight. The set rows show "N reps at X kg = new PR" when you are within a couple of reps of one.

## Offline at the gym

Signed-in mode keeps a copy of your data on the phone. If there is no signal, you can still open the app, run a workout
and log sets: changes wait in a queue ("N changes waiting to sync" at the top) and are sent automatically when the
connection returns. Photos need a connection to upload. The first sign-in on a new device needs internet.

## Known limits

- Rest-timer sounds and vibration only run while the app is open (phones pause web pages in the background).
  iPhone web apps cannot vibrate; the beep still plays. The countdown itself survives a reload.
- Backups (Settings → Export) do not include photos.
- If you use the same account on two devices at the same moment, the last device to save a workout wins.
- Google sign-in from an app installed to the iPhone home screen should be tested on a real phone. If the sign-in
  screen returns you to Safari instead of the installed app, sign in once in Safari, or use email sign-in.
