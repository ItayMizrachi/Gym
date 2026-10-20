# GymLog

A mobile-first workout tracker you install on your phone (iPhone and Android) straight from the browser.

- Workouts you can edit: exercises, sets, rep ranges, weights, rest times, supersets, drop sets
- Live workout screen with a rest timer (beep and vibration), last-time numbers next to every set, and personal records
- A PR alert when you break a record, and a hint when you are 1-2 reps away from one
- Exercise library with a photo, setup notes (seat / pad / pin positions) and cues for each exercise
- History, per-exercise charts, body-weight log with a 7-day average, trend per week and progress photos
- Sign in with Google. Every user only sees their own data.
- Works offline at the gym; changes sync when the connection is back
- For development it also runs without any setup in **local mode** (data stays in the browser on that device)

Stack: React + TypeScript + Vite, installable PWA, Supabase (Postgres, Auth, Storage).

The live app: **https://itaymizrachi.github.io/Gym/** (once the steps below are done).

---

## 1. Try it locally (local mode, no accounts needed)

```bash
npm install     # downloads the libraries listed in package.json into node_modules
npm run dev     # starts a local dev server (usually http://localhost:5173) with live reload
```

Without a `.env` file the app runs in local mode: everything is stored in your browser on this device.
With a `.env`, the dev server shows the Google sign-in screen plus a small "Continue offline (dev only)" link;
production builds offer Google sign-in only.

> Windows: if PowerShell says "running scripts is disabled", run the commands in `cmd`, or once run
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (lets PowerShell run local scripts such as npm's).

---

## 2. Set up the cloud (accounts + sync)

Do these in order. Everything is on free tiers. Replace `YOUR-REF` with your Supabase project reference
(the part before `.supabase.co` in the project URL).

### 2.1 Create the Supabase project

1. Sign in at https://supabase.com → **New project**. Pick a region close to you (e.g. Frankfurt), set a database
   password (save it in your password manager; the app never needs it).
2. Wait until the project says it is ready (about a minute).

### 2.2 Create the database

1. Supabase → **SQL Editor** → **New query**.
2. Paste the whole of [`supabase/schema.sql`](supabase/schema.sql) → **Run**. It should say "Success. No rows returned".

This creates the tables, the row-level security rules (each user can only read and change their own rows) and a
private photo bucket called `gymlog`. The file is safe to run again at any time; do that after app updates that
mention the database (if you forget, the app keeps your changes on the phone and tells you
"The database needs an update").

### 2.3 Google sign-in

**a. Google Cloud Console** (https://console.cloud.google.com)

1. Top bar → project picker → **New project** (name it e.g. `GymLog`) and select it.
2. Menu → **Google Auth Platform** (older consoles: APIs & Services → OAuth consent screen) → **Get started**:
   - App name `GymLog`, user support email = your email
   - Audience: **External**
   - Contact email = your email → Create
3. **Audience** → under *Test users* add your own Google address (and anyone else who will use the app).
   Testing mode is fine for personal use; you can **Publish app** later so you do not need to list users.
4. **Clients** (older consoles: Credentials → Create credentials → OAuth client ID) → **Create client**:
   - Application type: **Web application**, name `GymLog web`
   - Authorized JavaScript origins: `https://itaymizrachi.github.io` and `http://localhost:5173`
   - Authorized redirect URIs: `https://YOUR-REF.supabase.co/auth/v1/callback`
     (Supabase shows this exact URL on its Google provider page, step b)
   - Create → copy the **Client ID** and **Client secret**.

**b. Supabase** → **Authentication** → **Sign In / Providers** → **Google**: switch it on, paste the Client ID and
Client secret, Save.

Optional: in the same list open **Email** and turn off "Allow new users to sign up" if you only want Google.

### 2.4 Tell Supabase where the app lives

Supabase → **Authentication** → **URL Configuration**:

- **Site URL:** `https://itaymizrachi.github.io/Gym/`
- **Redirect URLs** → Add URL, one per line:
  - `https://itaymizrachi.github.io/Gym/**`
  - `http://localhost:5173/**`

After Google sign-in Supabase sends you back to the page you started from (e.g. `https://itaymizrachi.github.io/Gym/`)
with `?code=…`, which the app turns into a session. If that address is not in this list Supabase falls back to the
Site URL, so a wrong list shows up as "sign-in sends me to the wrong page".

### 2.5 Keys for your computer (`.env`)

Supabase → **Project Settings** → **API Keys** (older dashboards: Settings → API). Copy:

- the **Project URL** (`https://YOUR-REF.supabase.co`, also under Project Settings → Data API)
- the **Publishable key** (`sb_publishable_…`), or on the *Legacy* tab the **anon public** key. Either works.

```bash
cp .env.example .env    # copies the template to a real settings file named .env (in cmd: copy .env.example .env)
```

Open `.env` and fill in both lines:

```
VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

The publishable/anon key is meant to be public: it ships inside the app, and the row-level security rules are what
protect the data. **Never** put the `service_role` / secret key in this project. `.env` is git-ignored.

Restart `npm run dev` and sign in with Google at http://localhost:5173 to check everything before deploying.

---

## 3. Deploy to GitHub Pages

The workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the app and publishes it on every
push to `main`.

1. **Pages needs a public repo on a free GitHub plan.** The repo `ItayMizrachi/Gym` is private, so pick one:
   - make it public (Settings → General → Danger Zone → Change visibility). Nothing secret is in the code: the
     Supabase key in the build is public by design, and `.env` is never committed; or
   - keep it private with GitHub Pro; or
   - keep it private and host on Cloudflare Pages / Netlify / Vercel instead (connect the repo, build command
     `npm run build`, output folder `dist`, set the same two environment variables there, and add that address to
     the Supabase redirect URLs and Google JavaScript origins).
2. Repo → **Settings** → **Pages** → *Build and deployment* → Source: **GitHub Actions**.
3. Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, twice:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your publishable/anon key
4. Push to `main` (or Actions → *Deploy to GitHub Pages* → **Run workflow**). When the run is green the app is at
   https://itaymizrachi.github.io/Gym/. If the secrets are missing the run shows a warning and the site runs in
   local mode (data only on that device).

The app uses `#` routes and relative paths, so it works under `/Gym/` without any server rules.

Other hosts: `npm run build` (checks TypeScript, then writes the finished app to `dist/`) and
`npm run preview` (serves `dist/` locally to test the real build) work the same everywhere.

---

## 4. Install on the phone

- **iPhone (Safari):** open the site → Share → **Add to Home Screen**. It opens full-screen with its own launch screen.
- **Android (Chrome):** open the site → ⋮ → **Install app**. Long-press the icon for the shortcuts
  *Start next workout* and *Log body weight*.

When a new version is deployed the app shows **New version available → Reload** (never in the middle of a workout).

### First real test (checklist)

1. Sign in with Google in Safari/Chrome on the phone, add a body-weight entry with a photo.
2. Install to the home screen, open it, check you are still signed in (on iPhone the installed app has its own
   storage, so you may need to sign in once more there).
3. Airplane mode → log a few sets → the top shows *Offline* and "N changes waiting to sync" → airplane mode off →
   it syncs. Check the data on a second device or in Supabase → Table Editor.

---

## Icons and splash screens

`public/icon.svg`, the PNG icons (192, 512, maskable 512, apple-touch 180) and the iPhone launch screens in
`public/splash/` are generated from one drawing:

```bash
npm i --no-save sharp          # installs the image library temporarily, without adding it to package.json
node scripts/pwa-assets.cjs    # redraws everything in public/ and prints the <link> tags for index.html
```

## Project layout

| Path | What it is |
| --- | --- |
| `src/lib/db.ts` | Storage: `LocalRepo` (local mode, IndexedDB) and `SupabaseRepo` (cloud, offline-first outbox) behind one interface |
| `src/lib/supabase.ts` | Supabase client (PKCE sign-in that works with the `#` router), redirect URL |
| `src/lib/store.ts` | App state, debounced saving, ordered writes, rest timer |
| `src/lib/pr.ts` | Record logic: heaviest weight, estimated 1RM (Epley, reps capped at 12), rep records, near-record hints |
| `src/lib/seed.ts` | The starter 4-day plan |
| `src/pages/` | Screens: Home, WorkoutEditor, Session (live workout), Exercises, History, Body, Settings |
| `src/components/UpdateBanner.tsx`, `OfflineBanner.tsx`, `BootScreen.tsx` | Installed-app polish |
| `supabase/schema.sql` | Database, security rules and photo storage (idempotent) |
| `vite.config.ts` | Build, web-app manifest, service worker (offline cache) |

## How records work

Only work sets and failure sets count. Warm-ups and drop sets never create records.
A set is a record when it has the heaviest weight ever, the best estimated 1RM, or more reps than any earlier set
at the same or a heavier weight. The set rows show "N reps at X kg = new PR" when you are within a couple of reps of one.

## Offline at the gym

Signed-in mode keeps a copy of your data on the phone. If there is no signal you can still open the app, run a workout
and log sets: changes wait in a queue ("N changes waiting to sync" at the top) and are sent automatically when the
connection returns (the app also retries every minute and whenever you reopen it). Photos you have already seen
still show offline; new photos need a connection to upload. The first sign-in on a new device needs internet.

## Known limits

- Rest-timer sounds and vibration only run while the app is open (phones pause web pages in the background).
  iPhone web apps cannot vibrate; the beep still plays. The countdown itself survives a reload.
- Backups (Settings → Export) do not include photos.
- If you use the same account on two devices at the same moment, the last device to save a workout wins.
- Google sign-in from the app installed on the iPhone home screen opens Google inside the app and returns to it; if
  it ever lands in Safari instead, sign in there once or use email sign-in.
