# MBBS Study Command Center

A professional, offline-capable Progressive Web App (PWA) for medical students to track study hours, manage syllabus progress, and prepare for exams.

![MBBS Study Command Center](assets/icon-512.png)

## Features

- **Dashboard** — Today, weekly, monthly, and lifetime study hours at a glance
- **Study Timer** — Pomodoro (25 min), Deep Work (50 min), Focus (90 min), custom, and free timers
- **Study Logging** — Manual logs with date, subject, duration, and notes
- **Subject Management** — Medicine, Surgery, Gynecology, Pediatrics, Dermatology, Others (+ custom subjects)
- **Syllabus Tracker** — Add topics, mark complete, track progress percentage
- **Exam Countdown** — Days, weeks, and months until your exam
- **Analytics** — Chart.js charts (daily, weekly, monthly, subject-wise)
- **Study Streak** — Current and longest consecutive study-day streaks
- **Data Backup** — Export/import JSON backups via IndexedDB
- **Dark Mode** — AMOLED-optimized dark theme
- **Offline Mode** — Works without internet after first load
- **Installable** — Add to home screen on Android, iOS, and macOS

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- IndexedDB (local data storage)
- Chart.js (analytics charts)
- Service Worker (offline caching)
- Web App Manifest (installability)

## Quick Start (Local)

```bash
# Clone or download the repository, then serve locally
cd mbbs-study-command-center
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

> **Note:** PWAs require HTTPS or `localhost` to register the service worker.

## GitHub Pages Deployment (Free Hosting)

### Step 1: Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it `mbbs-study-command-center` (or any name)
3. Set visibility to **Public**
4. Click **Create repository**

### Step 2: Push Your Code

```bash
cd mbbs-study-command-center
git add .
git commit -m "Initial release: MBBS Study Command Center PWA"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mbbs-study-command-center.git
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Open your repo on GitHub
2. Go to **Settings → Pages**
3. Under **Build and deployment → Source**, select **Deploy from a branch**
4. Choose branch: `main`, folder: `/ (root)`
5. Click **Save**

Your app will be live at:

```
https://YOUR_USERNAME.github.io/mbbs-study-command-center/
```

Deployment usually takes 1–3 minutes.

## How to Update Later

1. Edit files locally (`index.html`, `style.css`, `app.js`, etc.)
2. Test locally with `python3 -m http.server 8080`
3. Commit and push:

```bash
git add .
git commit -m "Describe your changes"
git push
```

4. GitHub Pages redeploys automatically within a few minutes
5. **Important:** After updating `service-worker.js`, bump `CACHE_NAME` (e.g., `mbbs-study-v2`) so users get fresh assets

## Install on Devices

### Android (Chrome)

1. Open your GitHub Pages URL in Chrome
2. Tap the **⋮** menu → **Install app** or **Add to Home screen**
3. Confirm — the app icon appears on your home screen
4. Opens fullscreen like a native app

### iPhone / iPad (Safari)

1. Open your GitHub Pages URL in **Safari**
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **Add to Home Screen**
4. Name it "MBBS Study" and tap **Add**
5. Launch from your home screen

> iOS installs PWAs via Safari only (not Chrome).

### MacBook (Chrome or Edge)

1. Open your GitHub Pages URL
2. Click the **install icon** in the address bar (or ⋮ → **Install MBBS Study Command Center**)
3. Click **Install**
4. The app opens in its own window and appears in Applications

## Data & Privacy

- All data is stored **locally** in your browser (IndexedDB)
- Nothing is sent to any server
- Use **Export Backup** in Settings to save your data as JSON
- Use **Import Backup** to restore on a new device

## Project Structure

```
/
├── index.html          # Main HTML shell
├── style.css           # Styles (AMOLED dark mode)
├── app.js              # Application logic
├── manifest.json       # PWA manifest
├── service-worker.js   # Offline caching
├── README.md           # This file
└── assets/
    ├── icon-192.png    # App icon (192×192)
    └── icon-512.png    # App icon (512×512)
```

## License

Free to use for personal study. Built for MBBS students.

---

**Study smart. Track progress. Ace your exams.** ⚕
