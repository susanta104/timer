# MBBS Study Command Center v2.0

Professional study-tracking PWA for medical students with **offline-first storage** and **free cloud sync** via Supabase.

## Features

- Dashboard, timer (Pomodoro / Deep Work / Focus), study logs, subjects, syllabus tracker
- Exam countdown, analytics charts, study streaks
- AMOLED dark mode, PWA installable, works offline
- **Profile system** — display name, college, year, exam date
- **Cloud sync** — sign in on any device, data syncs automatically

## Project Structure

```
/
├── index.html
├── style.css
├── app.js              # Core app logic
├── auth-sync.js        # Supabase auth, profile & sync
├── config.js           # Your Supabase credentials (do not commit secrets)
├── config.example.js   # Template for config.js
├── supabase-schema.sql # Database setup script
├── manifest.json
├── service-worker.js
├── README.md
└── assets/
    ├── icon-192.png
    └── icon-512.png
```

---

## Quick Start (Local)

```bash
cd mbbs-study-command-center
python3 -m http.server 8080
```

Open http://localhost:8080 — works offline without Supabase (local-only mode).

---

## Supabase Setup (Free Cloud Sync)

### 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) → **Start your project**
2. Create a new project (free tier is sufficient)
3. Wait for the database to provision (~2 minutes)

### 2. Run the database schema

1. In Supabase Dashboard → **SQL Editor** → **New query**
2. Paste the contents of `supabase-schema.sql`
3. Click **Run**

This creates `profiles`, `study_sessions`, `subjects`, `syllabus_topics`, `user_settings` with Row Level Security.

### 3. Configure authentication

1. Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Email** provider
3. For development, disable **Confirm email** under Email settings (optional — enables instant sign-up)
4. For production, keep email confirmation enabled

### 4. Add your credentials to the app

```bash
cp config.example.js config.js
```

Edit `config.js`:

```javascript
window.MBBS_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT_ID.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY'   // Settings → API → anon public key
};
```

> **Never commit `config.js` with real keys to a public repo.** Add `config.js` to `.gitignore` or use GitHub Secrets for CI.

### 5. Test cloud sync

1. Open the app → **Settings** → **Create Account**
2. Complete your profile (name, college, year)
3. Add a study log or start the timer
4. Open the app on another device/browser → **Sign In**
5. Data syncs automatically (or tap **Sync Now**)

---

## GitHub Pages Deployment

```bash
git add .
git commit -m "Deploy MBBS Study Command Center v2"
git push origin main
```

Enable **Settings → Pages → Deploy from branch → main / (root)**.

Live URL: `https://YOUR_USERNAME.github.io/mbbs-study-command-center/`

### Important for GitHub Pages + Supabase

1. In Supabase → **Authentication** → **URL Configuration**, add your GitHub Pages URL to **Site URL** and **Redirect URLs**
2. Include `config.js` with your anon key in the deployed repo, OR inject credentials at build time

---

## How Sync Works

| Layer | Role |
|-------|------|
| **IndexedDB** | Primary storage — instant saves, works offline |
| **Supabase** | Cloud backup — syncs when signed in + online |

- **Local-first**: every change saves to IndexedDB immediately
- **Background sync**: changes push to Supabase after 1.5s debounce
- **Conflict resolution**: newest `updatedAt` timestamp wins
- **Deletes**: soft-deleted in cloud, removed locally on next pull

---

## Install on Devices

| Device | Steps |
|--------|-------|
| **Android** | Chrome → menu → Install app |
| **iPhone/iPad** | Safari → Share → Add to Home Screen |
| **MacBook** | Chrome/Edge → address bar install icon |

---

## Updating the App

1. Edit files locally and test
2. Bump `CACHE_NAME` in `service-worker.js` (e.g. `v3` → `v4`) when static assets change
3. Push to GitHub — Pages redeploys automatically

---

## License

Free for personal study. Built for MBBS students.

**Study smart. Sync everywhere. Ace your exams.**
