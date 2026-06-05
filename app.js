/**
 * MBBS Study Command Center v1.1
 * Modular study-tracking PWA with IndexedDB persistence.
 */

'use strict';

const DB_NAME = 'MBBSStudyDB';
const DB_VERSION = 1;
const THEME_STORAGE_KEY = 'mbbs-theme';

const DEFAULT_SUBJECTS = [
  { id: 'medicine', name: 'Medicine', color: '#3b82f6', isDefault: true },
  { id: 'surgery', name: 'Surgery', color: '#ef4444', isDefault: true },
  { id: 'gynecology', name: 'Gynecology', color: '#ec4899', isDefault: true },
  { id: 'pediatrics', name: 'Pediatrics', color: '#10b981', isDefault: true },
  { id: 'dermatology', name: 'Dermatology', color: '#f59e0b', isDefault: true },
  { id: 'others', name: 'Others', color: '#8b5cf6', isDefault: true }
];

const TIMER_PRESETS = {
  free: 0,
  pomodoro: 25 * 60,
  deepwork: 50 * 60,
  focus: 90 * 60,
  custom: 0
};

// Global Supabase Configurations
const SUPABASE_URL = 'https://gdlfbybyvkvmbyclgswv.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlb3Nia3FmYmJ5ZHFkbHpobnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzQ5MTcsImV4cCI6MjA5NjI1MDkxN30.dTUz1r0YpEIwyDkt9pXAmRi9MbCZ5L6f36LXxj3DgjY';

const supabase = window.supabase.createClient(https://gdlfbybyvkvmbyclgswv.supabase.co, eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlb3Nia3FmYmJ5ZHFkbHpobnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzQ5MTcsImV4cCI6MjA5NjI1MDkxN30.dTUz1r0YpEIwyDkt9pXAmRi9MbCZ5L6f36LXxj3DgjY);

const PRESET_LABELS = {
  free: 'Free Timer (counts up)',
  pomodoro: 'Pomodoro — 25 min',
  deepwork: 'Deep Work — 50 min',
  focus: 'Focus Session — 90 min',
  custom: 'Custom Timer'
};

const MOTIVATION_QUOTES = [
  '"The art of medicine consists of amusing the patient while nature cures the disease." — Voltaire',
  '"Wherever the art of medicine is loved, there is also a love of humanity." — Hippocrates',
  '"Study while others are sleeping; work while others are loafing." — William Arthur Ward',
  '"The good physician treats the disease; the great physician treats the patient." — William Osler',
  '"Medicine is a science of uncertainty and an art of probability." — William Osler',
  '"Success is the sum of small efforts, repeated day in and day out." — Robert Collier'
];

const SECTION_TITLES = {
  dashboard: 'Dashboard',
  timer: 'Study Timer',
  logs: 'Study Logs',
  subjects: 'Subjects',
  syllabus: 'Syllabus Tracker',
  exam: 'Exam Countdown',
  analytics: 'Analytics',
  settings: 'Settings'
};

/* ------------------------------------------------------------------ */
/* Utilities                                                          */
/* ------------------------------------------------------------------ */

const Utils = {
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  },

  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  formatDuration(totalMinutes) {
    const mins = Math.max(0, Math.round(totalMinutes));
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  },

  formatTimer(totalSeconds) {
    const secs = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  },

  toDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  parseDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  endOfWeek(start) {
    const d = new Date(start);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  },

  /** Calendar-accurate countdown from today (local midnight) to target date. */
  examCountdown(targetDateStr) {
    if (!targetDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = Utils.parseDate(targetDateStr);
    const diffMs = target.getTime() - today.getTime();
    const days = Math.round(diffMs / 86400000);

    if (days < 0) return { days, weeks: 0, months: 0, passed: true };

    const weeks = Math.floor(days / 7);
    const months =
      (target.getFullYear() - today.getFullYear()) * 12 +
      (target.getMonth() - today.getMonth()) -
      (target.getDate() < today.getDate() ? 1 : 0);

    return { days, weeks: Math.max(0, weeks), months: Math.max(0, months), passed: false };
  },

  debounce(fn, delay = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
};

/* ------------------------------------------------------------------ */
/* Toast                                                              */
/* ------------------------------------------------------------------ */

const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
  },

  show(message, type = 'info') {
    if (!this.container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    this.container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
};

/* ------------------------------------------------------------------ */
/* IndexedDB                                                          */
/* ------------------------------------------------------------------ */

const Database = {
  db: null,

  open() {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('subjectId', 'subjectId', { unique: false });
        }
        if (!db.objectStoreNames.contains('subjects')) {
          db.createObjectStore('subjects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('topics')) {
          const store = db.createObjectStore('topics', { keyPath: 'id' });
          store.createIndex('subjectId', 'subjectId', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.db.onversionchange = () => {
          this.db.close();
          this.db = null;
        };
        resolve(this.db);
      };

      request.onerror = () => reject(new Error('Failed to open database'));
    });
  },

  getAll(storeName) {
    return this.open().then(
      () =>
        new Promise((resolve, reject) => {
          const tx = this.db.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        })
    );
  },

  put(storeName, data) {
    return this.open().then(
      () =>
        new Promise((resolve, reject) => {
          const tx = this.db.transaction(storeName, 'readwrite');
          tx.onerror = () => reject(tx.error);
          tx.oncomplete = () => resolve();
          tx.objectStore(storeName).put(data);
        })
    );
  },

  delete(storeName, key) {
    return this.open().then(
      () =>
        new Promise((resolve, reject) => {
          const tx = this.db.transaction(storeName, 'readwrite');
          tx.onerror = () => reject(tx.error);
          tx.oncomplete = () => resolve();
          tx.objectStore(storeName).delete(key);
        })
    );
  },

  getSetting(key, defaultValue = null) {
    return this.open().then(
      () =>
        new Promise((resolve) => {
          const req = this.db.transaction('settings', 'readonly').objectStore('settings').get(key);
          req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
          req.onerror = () => resolve(defaultValue);
        })
    );
  },

  setSetting(key, value) {
    return this.put('settings', { key, value });
  },

  async seedDefaults() {
    const subjects = await this.getAll('subjects');
    if (subjects.length === 0) {
      await Promise.all(DEFAULT_SUBJECTS.map((s) => this.put('subjects', { ...s })));
    }
  },

  clearAll() {
    const stores = ['sessions', 'subjects', 'topics', 'settings'];
    return this.open().then(
      () =>
        new Promise((resolve, reject) => {
          const tx = this.db.transaction(stores, 'readwrite');
          tx.onerror = () => reject(tx.error);
          tx.oncomplete = () => resolve();
          stores.forEach((name) => tx.objectStore(name).clear());
        })
    );
  },

  async exportAll() {
    const [sessions, subjects, topics, settings] = await Promise.all([
      this.getAll('sessions'),
      this.getAll('subjects'),
      this.getAll('topics'),
      this.getAll('settings')
    ]);
    return { version: 1, exportedAt: new Date().toISOString(), sessions, subjects, topics, settings };
  },

  async importAll(data) {
    if (!data || data.version !== 1) throw new Error('Invalid backup file format');
    await this.clearAll();
    await Promise.all([
      ...(data.sessions || []).map((s) => this.put('sessions', s)),
      ...(data.subjects || []).map((s) => this.put('subjects', s)),
      ...(data.topics || []).map((t) => this.put('topics', t)),
      ...(data.settings || []).map((s) => this.put('settings', s))
    ]);
    if (!(data.subjects || []).length) await this.seedDefaults();
  }
};

/* ------------------------------------------------------------------ */
/* Theme                                                              */
/* ------------------------------------------------------------------ */

const Theme = {
  isDark: true,

  async init() {
    const saved = await Database.getSetting('theme', localStorage.getItem(THEME_STORAGE_KEY) || 'dark');
    this.isDark = saved === 'dark';
    this.apply(false);
    this.bindEvents();
  },

  apply(refreshChart = true) {
    const theme = this.isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    const toggle = document.getElementById('theme-toggle-settings');
    if (icon) icon.textContent = this.isDark ? '🌙' : '☀️';
    if (label) label.textContent = this.isDark ? 'Dark Mode' : 'Light Mode';
    if (toggle) toggle.setAttribute('aria-pressed', String(this.isDark));

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = this.isDark ? '#0a0a0f' : '#f8f9fc';

    if (refreshChart && Navigation.currentSection === 'analytics') {
      Analytics.render(Analytics.currentType);
    }
  },

  async toggle() {
    this.isDark = !this.isDark;
    await Database.setSetting('theme', this.isDark ? 'dark' : 'light');
    this.apply(true);
  },

  bindEvents() {
    document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggle());
    document.getElementById('theme-toggle-settings')?.addEventListener('click', () => this.toggle());
  }
};

/* ------------------------------------------------------------------ */
/* Subjects                                                           */
/* ------------------------------------------------------------------ */

const Subjects = {
  list: [],

  async load() {
    this.list = await Database.getAll('subjects');
    this.list.sort((a, b) => a.name.localeCompare(b.name));
    return this.list;
  },

  getById(id) {
    return this.list.find((s) => s.id === id);
  },

  getColor(id) {
    return this.getById(id)?.color || '#8b5cf6';
  },

  /** Repopulate selects while preserving current values. */
  populateSelects() {
    const map = {
      'timer-subject': false,
      'log-subject': false,
      'modal-subject': false,
      'topic-subject': false,
      'log-filter-subject': true,
      'syllabus-filter-subject': true
    };

    Object.entries(map).forEach(([id, isFilter]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const prev = el.value;
      el.innerHTML = isFilter ? '<option value="">All Subjects</option>' : '';
      this.list.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        el.appendChild(opt);
      });
      if (prev && [...el.options].some((o) => o.value === prev)) el.value = prev;
    });
  },

  async render() {
    await this.load();
    const container = document.getElementById('subjects-list');
    if (!container) return;

    const minutesBySubject = {};
    Sessions.list.forEach((s) => {
      minutesBySubject[s.subjectId] = (minutesBySubject[s.subjectId] || 0) + s.durationMinutes;
    });

    container.innerHTML = this.list
      .map(
        (s) => `
      <div class="subject-card">
        ${s.isDefault ? '' : `<button type="button" class="subject-delete" data-delete="${Utils.escapeHtml(s.id)}" aria-label="Delete ${Utils.escapeHtml(s.name)}">✕</button>`}
        <div class="subject-color" style="background:${Utils.escapeHtml(s.color)}"></div>
        <div class="subject-name">${Utils.escapeHtml(s.name)}</div>
        <div class="subject-hours">${Utils.formatDuration(minutesBySubject[s.id] || 0)} studied</div>
      </div>`
      )
      .join('');
  },

  bindEvents() {
    document.getElementById('subjects-list')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-delete]');
      if (!btn) return;
      const id = btn.dataset.delete;
      const name = this.getById(id)?.name || 'subject';
      if (!confirm(`Delete "${name}"? Sessions linked to it will show as Unknown.`)) return;
      await Database.delete('subjects', id);
      Toast.show('Subject deleted', 'success');
      await App.refreshAll();
    });

    document.getElementById('subject-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('new-subject');
      const name = input.value.trim();
      if (!name) return;
      if (this.list.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
        Toast.show('Subject already exists', 'error');
        return;
      }

      const colors = ['#06b6d4', '#84cc16', '#f97316', '#a855f7', '#14b8a6', '#e11d48'];
      await Database.put('subjects', {
        id: Utils.generateId(),
        name,
        color: colors[Math.floor(Math.random() * colors.length)],
        isDefault: false
      });
      input.value = '';
      Toast.show(`"${name}" added`, 'success');
      await App.refreshAll();
    });
  }
};

/* ------------------------------------------------------------------ */
/* Sessions                                                           */
/* ------------------------------------------------------------------ */

complete() {
    const elapsed = this.elapsedSeconds;
    this.resetClock(false);

    // --- Audio Alert Implementation ---
    try {
      // Clean, professional electronic chime sound
      const alertAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav');
      alertAudio.volume = 0.5; // 50% volume so it doesn't startle you
      alertAudio.play();
    } catch (soundError) {
      // Catches and logs errors if the browser blocks background audio
      console.warn('Audio playback blocked or failed:', soundError);
    }
    // ----------------------------------

    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    Toast.show('Timer complete!', 'success');
    this._pendingMinutes = Math.max(1, Math.round(elapsed / 60));
    this.openSaveModal();
  },
const Sessions = {
  list: [],

  async load() {
    this.list = await Database.getAll('sessions');
    this.list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    return this.list;
  },

  getTotalMinutes(filterFn = () => true) {
    return this.list.filter(filterFn).reduce((sum, s) => sum + s.durationMinutes, 0);
  },

  async save(session) {
    let createdAt = session.createdAt || Date.now();
    if (session.id) {
      const existing = this.list.find((s) => s.id === session.id);
      if (existing) createdAt = existing.createdAt;
    }
    await Database.put('sessions', {
      id: session.id || Utils.generateId(),
      date: session.date || Utils.toDateString(),
      subjectId: session.subjectId,
      durationMinutes: session.durationMinutes,
      notes: session.notes || '',
      createdAt
    });
    await this.load();
  },

  async remove(id) {
    await Database.delete('sessions', id);
    await this.load();
  },

  renderItem(session, showActions = false) {
    const subject = Subjects.getById(session.subjectId);
    const name = subject?.name || 'Unknown';
    const color = subject?.color || '#8b5cf6';
    const date = Utils.parseDate(session.date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const notes = session.notes ? Utils.escapeHtml(session.notes) : '';

    return `
      <div class="session-item" data-id="${Utils.escapeHtml(session.id)}">
        <div class="session-subject-dot" style="background:${Utils.escapeHtml(color)}"></div>
        <div class="session-info"><div class="session-subject">${Utils.escapeHtml(name)}</div></div>
        <div class="session-duration">${Utils.formatDuration(session.durationMinutes)}</div>
        <div class="session-meta">${Utils.escapeHtml(date)}${notes ? ' — ' + notes : ''}</div>
        ${
          showActions
            ? `<div class="session-actions">
                <button type="button" data-edit="${Utils.escapeHtml(session.id)}" aria-label="Edit session">✏️</button>
                <button type="button" data-remove="${Utils.escapeHtml(session.id)}" aria-label="Delete session">🗑</button>
              </div>`
            : ''
        }
      </div>`;
  }
};

/* ------------------------------------------------------------------ */
/* Streak                                                             */
/* ------------------------------------------------------------------ */

const Streak = {
  calculate(sessions) {
    if (!sessions.length) return { current: 0, longest: 0 };

    const dates = [...new Set(sessions.map((s) => s.date))].sort();
    let longest = 1;
    let run = 1;

    for (let i = 1; i < dates.length; i++) {
      const prev = Utils.parseDate(dates[i - 1]);
      const curr = Utils.parseDate(dates[i]);
      const diff = Math.round((curr - prev) / 86400000);
      run = diff === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }

    const today = Utils.toDateString();
    const yesterday = Utils.toDateString(new Date(Date.now() - 86400000));
    const dateSet = new Set(dates);
    let current = 0;

    const anchor = dateSet.has(today) ? today : dateSet.has(yesterday) ? yesterday : null;
    if (anchor) {
      current = 1;
      let d = Utils.parseDate(anchor);
      d.setDate(d.getDate() - 1);
      while (dateSet.has(Utils.toDateString(d))) {
        current++;
        d.setDate(d.getDate() - 1);
      }
    }

    return { current, longest: dates.length ? longest : 0 };
  },

  updateUI(sessions) {
    const { current, longest } = this.calculate(sessions);
    const cur = document.getElementById('streak-current');
    const lng = document.getElementById('streak-longest');
    const badge = document.getElementById('streak-badge');
    if (cur) cur.textContent = current;
    if (lng) lng.textContent = longest;
    if (badge) badge.textContent = `🔥 ${current}`;
  }
};

/* ------------------------------------------------------------------ */
/* Exam                                                               */
/* ------------------------------------------------------------------ */

const Exam = {
  cachedDate: '',

  async getDate() {
    this.cachedDate = await Database.getSetting('examDate', '');
    return this.cachedDate;
  },

  async saveDate(dateStr) {
    await Database.setSetting('examDate', dateStr);
    this.cachedDate = dateStr;
    this.renderAll();
  },

  buildHTML(countdown, large = false) {
    if (!countdown) return '<p class="muted">Set your exam date in Settings</p>';
    if (countdown.passed) {
      return large
        ? '<p class="count-big">Done!</p><p class="count-label">Exam date has passed — update in Settings.</p>'
        : '<p class="muted">Exam date has passed</p>';
    }
    if (large) {
      return `
        <p class="count-big">${countdown.days}</p>
        <p class="count-label">days remaining</p>
        <div class="exam-countdown-grid" style="margin-top:20px">
          <div class="exam-countdown-item"><span class="count">${countdown.days}</span><span class="label">Days</span></div>
          <div class="exam-countdown-item"><span class="count">${countdown.weeks}</span><span class="label">Weeks</span></div>
          <div class="exam-countdown-item"><span class="count">${countdown.months}</span><span class="label">Months</span></div>
        </div>`;
    }
    return `
      <div class="exam-countdown-grid">
        <div class="exam-countdown-item"><span class="count">${countdown.days}</span><span class="label">Days</span></div>
        <div class="exam-countdown-item"><span class="count">${countdown.weeks}</span><span class="label">Weeks</span></div>
        <div class="exam-countdown-item"><span class="count">${countdown.months}</span><span class="label">Months</span></div>
      </div>`;
  },

  renderAll() {
    const countdown = Utils.examCountdown(this.cachedDate);
    const display = document.getElementById('exam-countdown-display');
    const preview = document.getElementById('exam-preview');
    if (display) display.innerHTML = this.buildHTML(countdown, true);
    if (preview) preview.innerHTML = this.buildHTML(countdown, false);

    const quote = document.getElementById('motivation-quote');
    if (quote && Navigation.currentSection === 'exam') {
      quote.textContent = MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
    }
  },

  bindEvents() {
    document.getElementById('exam-date-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = document.getElementById('exam-date').value;
      if (!date) {
        Toast.show('Please select an exam date', 'error');
        return;
      }
      await this.saveDate(date);
      Toast.show('Exam date saved', 'success');
    });
  },

  loadDateInput() {
    const input = document.getElementById('exam-date');
    if (input) input.value = this.cachedDate || '';
  }
};

/* ------------------------------------------------------------------ */
/* Dashboard                                                          */
/* ------------------------------------------------------------------ */

const Dashboard = {
  render() {
    const today = Utils.toDateString();
    const now = new Date();
    const weekStart = Utils.toDateString(Utils.startOfWeek(now));

    document.getElementById('stat-today').textContent = Utils.formatDuration(
      Sessions.getTotalMinutes((s) => s.date === today)
    );
    document.getElementById('stat-week').textContent = Utils.formatDuration(
      Sessions.getTotalMinutes((s) => s.date >= weekStart)
    );
    document.getElementById('stat-month').textContent = Utils.formatDuration(
      Sessions.getTotalMinutes((s) => {
        const d = Utils.parseDate(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
    );
    document.getElementById('stat-lifetime').textContent = Utils.formatDuration(
      Sessions.getTotalMinutes()
    );

    Streak.updateUI(Sessions.list);

    const recentEl = document.getElementById('recent-sessions');
    const recent = Sessions.list.slice(0, 5);
    if (recentEl) {
      recentEl.innerHTML = recent.length
        ? recent.map((s) => Sessions.renderItem(s)).join('')
        : '<p class="muted empty-state">No sessions yet. Start the timer!</p>';
    }

    Exam.renderAll();
  }
};

/* ------------------------------------------------------------------ */
/* Timer — uses wall-clock time (accurate in background tabs)         */
/* ------------------------------------------------------------------ */

const Timer = {
  // Existing properties like timerId: null, timeRemaining: 0, etc.
  wakeLock: null, // <-- Add this to track the lock object

  // Add these helper methods inside the Timer object:
  async requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      if (!this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('Screen Wake Lock active.');
        
        // Auto-recover if tab is minimized and returned to
        this.wakeLock.addEventListener('release', () => {
          if (document.visibilityState === 'visible' && this.timerId) {
            this.requestWakeLock();
          }
        });
      }
    } catch (err) {
      console.warn(`Wake Lock request failed: ${err.message}`);
    }
  },

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release()
        .then(() => {
          this.wakeLock = null;
          console.log('Screen Wake Lock released.');
        });
    }
  },
  
  // ... rest of your Timer methods
const Timer = {
  state: 'idle',
  mode: 'free',
  elapsedSeconds: 0,
  startedAt: null,
  pausedElapsed: 0,
  tickId: null,
  wakeLock: null,
  _pendingMinutes: 0,

  init() {
    this.bindEvents();
    this.setPreset('free', true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.state === 'running') this.syncElapsed();
    });
  },

  getTargetSeconds() {
    if (this.mode === 'custom') {
      return (parseInt(document.getElementById('custom-minutes')?.value, 10) || 30) * 60;
    }
    return TIMER_PRESETS[this.mode] || 0;
  },

  syncElapsed() {
    if (this.state !== 'running' || !this.startedAt) return;
    this.elapsedSeconds = this.pausedElapsed + Math.floor((Date.now() - this.startedAt) / 1000);
    const target = this.getTargetSeconds();
    if (target > 0 && this.elapsedSeconds >= target) {
      this.complete();
      return;
    }
    this.updateDisplay();
  },

  startTicking() {
    clearInterval(this.tickId);
    this.tickId = setInterval(() => this.syncElapsed(), 1000);
  },

  stopTicking() {
    clearInterval(this.tickId);
    this.tickId = null;
  },

  updateDisplay() {
    const display = document.getElementById('timer-display');
    const modeLabel = document.getElementById('timer-mode-label');
    const progressFill = document.getElementById('timer-progress-fill');
    const target = this.getTargetSeconds();

    if (this.mode === 'free' || target === 0) {
      if (display) display.textContent = Utils.formatTimer(this.elapsedSeconds);
      if (modeLabel) modeLabel.textContent = PRESET_LABELS.free;
      if (progressFill) progressFill.style.width = '0%';
    } else {
      const remaining = Math.max(0, target - this.elapsedSeconds);
      if (display) display.textContent = Utils.formatTimer(remaining);
      if (modeLabel) modeLabel.textContent = PRESET_LABELS[this.mode] || 'Timer';
      if (progressFill) progressFill.style.width = `${Math.min(100, (this.elapsedSeconds / target) * 100)}%`;
    }

    if (display) display.setAttribute('aria-live', this.state === 'running' ? 'polite' : 'off');
  },

  updateButtons() {
    const start = document.getElementById('timer-start');
    const pause = document.getElementById('timer-pause');
    const resume = document.getElementById('timer-resume');
    const stop = document.getElementById('timer-stop');

    const running = this.state === 'running';
    const paused = this.state === 'paused';
    const idle = this.state === 'idle';

    if (start) start.disabled = !idle;
    if (pause) {
      pause.hidden = paused;
      pause.disabled = !running;
    }
    if (resume) {
      resume.hidden = !paused;
      resume.disabled = !paused;
    }
    if (stop) stop.disabled = idle;
  },

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) this.wakeLock = await navigator.wakeLock.request('screen');
    } catch (_) { /* unsupported or denied */ }
  },

  releaseWakeLock() {
    this.wakeLock?.release?.();
    this.wakeLock = null;
  },

  start(isResume = false) {
    if (this.state === 'running') return;
    this.state = 'running';
    this.startedAt = Date.now();
    this.startTicking();
    this.requestWakeLock();
    this.updateButtons();
    if (!isResume) Toast.show('Timer started', 'info');
  },

  pause() {
    if (this.state !== 'running') return;
    this.syncElapsed();
    this.pausedElapsed = this.elapsedSeconds;
    this.state = 'paused';
    this.startedAt = null;
    this.stopTicking();
    this.releaseWakeLock();
    this.updateButtons();
  },

  resume() {
    if (this.state !== 'paused') return;
    this.start(true);
  },

  stop() {
    this.syncElapsed();
    const elapsed = this.elapsedSeconds;
    this.resetClock(false);

    if (elapsed >= 60) {
      this._pendingMinutes = Math.max(1, Math.round(elapsed / 60));
      this.openSaveModal();
    } else if (elapsed > 0) {
      Toast.show('Session too short to save (under 1 min)', 'info');
      this._pendingMinutes = 0;
    }
  },

  complete() {
    const elapsed = this.elapsedSeconds;
    this.resetClock(false);
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    Toast.show('Timer complete!', 'success');
    this._pendingMinutes = Math.max(1, Math.round(elapsed / 60));
    this.openSaveModal();
  },

  resetClock(keepMode = true) {
    this.stopTicking();
    this.releaseWakeLock();
    this.state = 'idle';
    this.elapsedSeconds = 0;
    this.pausedElapsed = 0;
    this.startedAt = null;
    if (!keepMode) this.mode = 'free';
    this.updateDisplay();
    this.updateButtons();
  },

  openSaveModal() {
    const modal = document.getElementById('save-session-modal');
    document.getElementById('modal-duration').textContent = Utils.formatDuration(this._pendingMinutes);
    Subjects.populateSelects();
    const timerSubject = document.getElementById('timer-subject')?.value;
    const modalSubject = document.getElementById('modal-subject');
    if (modalSubject && timerSubject) modalSubject.value = timerSubject;
    modal?.showModal();
  },

  async saveSession(subjectId, notes) {
    if (this._pendingMinutes < 1) return;
    await Sessions.save({
      subjectId,
      durationMinutes: this._pendingMinutes,
      notes,
      date: Utils.toDateString()
    });
    this._pendingMinutes = 0;
    Toast.show('Session saved', 'success');
    await App.refreshAll();
  },

  setPreset(preset, silent = false) {
    if (this.state !== 'idle') {
      if (!silent) Toast.show('Stop the timer before changing preset', 'error');
      return;
    }
    this.mode = preset;
    this.elapsedSeconds = 0;
    this.pausedElapsed = 0;

    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === preset);
    });
    document.getElementById('custom-timer-input')?.classList.toggle('hidden', preset !== 'custom');
    this.updateDisplay();
  },

  bindEvents() {
    document.getElementById('timer-start')?.addEventListener('click', () => this.start(false));
    document.getElementById('timer-pause')?.addEventListener('click', () => this.pause());
    document.getElementById('timer-resume')?.addEventListener('click', () => this.resume());
    document.getElementById('timer-stop')?.addEventListener('click', () => this.stop());

    document.querySelector('.timer-presets')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-preset]');
      if (btn) this.setPreset(btn.dataset.preset);
    });

    document.getElementById('save-session-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveSession(
        document.getElementById('modal-subject').value,
        document.getElementById('modal-notes').value.trim()
      );
      document.getElementById('save-session-modal')?.close();
      document.getElementById('modal-notes').value = '';
      this.resetClock(true);
    });

    document.getElementById('modal-discard')?.addEventListener('click', () => {
      this._pendingMinutes = 0;
      document.getElementById('save-session-modal')?.close();
      this.resetClock(true);
    });

    document.getElementById('save-session-modal')?.addEventListener('cancel', () => {
      this._pendingMinutes = 0;
      this.resetClock(true);
    });
  }
};

/* ------------------------------------------------------------------ */
/* Logs                                                               */
/* ------------------------------------------------------------------ */

const Logs = {
  render() {
    const filterSubject = document.getElementById('log-filter-subject')?.value || '';
    const filterMonth = document.getElementById('log-filter-month')?.value || '';

    let filtered = Sessions.list;
    if (filterSubject) filtered = filtered.filter((s) => s.subjectId === filterSubject);
    if (filterMonth) filtered = filtered.filter((s) => s.date.startsWith(filterMonth));

    const container = document.getElementById('logs-list');
    if (!container) return;

    container.innerHTML = filtered.length
      ? filtered.map((s) => Sessions.renderItem(s, true)).join('')
      : '<p class="muted empty-state">No study logs found.</p>';
  },

  showForm(editing = false) {
    document.getElementById('log-form')?.classList.remove('hidden');
    document.getElementById('log-form-title').textContent = editing ? 'Edit Study Log' : 'Add Study Log';
    if (!editing) {
      document.getElementById('log-id').value = '';
      document.getElementById('log-date').value = Utils.toDateString();
      document.getElementById('log-hours').value = '0';
      document.getElementById('log-minutes').value = '30';
      document.getElementById('log-notes').value = '';
    }
    document.getElementById('log-date')?.focus();
  },

  hideForm() {
    document.getElementById('log-form')?.classList.add('hidden');
  },

  edit(id) {
    const session = Sessions.list.find((s) => s.id === id);
    if (!session) return;
    this.showForm(true);
    document.getElementById('log-id').value = id;
    document.getElementById('log-date').value = session.date;
    document.getElementById('log-subject').value = session.subjectId;
    document.getElementById('log-hours').value = Math.floor(session.durationMinutes / 60);
    document.getElementById('log-minutes').value = session.durationMinutes % 60;
    document.getElementById('log-notes').value = session.notes || '';
  },

  bindEvents() {
    document.getElementById('add-log-btn')?.addEventListener('click', () => this.showForm());
    document.getElementById('log-cancel')?.addEventListener('click', () => this.hideForm());

    document.getElementById('study-log-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const totalMinutes =
        (parseInt(document.getElementById('log-hours').value, 10) || 0) * 60 +
        (parseInt(document.getElementById('log-minutes').value, 10) || 0);

      if (totalMinutes < 1) {
        Toast.show('Duration must be at least 1 minute', 'error');
        return;
      }

      try {
        await Sessions.save({
          id: document.getElementById('log-id').value || undefined,
          date: document.getElementById('log-date').value,
          subjectId: document.getElementById('log-subject').value,
          durationMinutes: totalMinutes,
          notes: document.getElementById('log-notes').value.trim()
        });
        this.hideForm();
        Toast.show('Study log saved', 'success');
        await App.refreshAll();
      } catch (err) {
        Toast.show('Failed to save log', 'error');
        console.error(err);
      }
    });

    document.getElementById('logs-list')?.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit]');
      const removeBtn = e.target.closest('[data-remove]');
      if (editBtn) return this.edit(editBtn.dataset.edit);
      if (removeBtn && confirm('Delete this study log?')) {
        await Sessions.remove(removeBtn.dataset.remove);
        Toast.show('Log deleted', 'success');
        await App.refreshAll();
      }
    });

    const debouncedRender = Utils.debounce(() => this.render(), 200);
    document.getElementById('log-filter-subject')?.addEventListener('change', debouncedRender);
    document.getElementById('log-filter-month')?.addEventListener('change', debouncedRender);
    document.getElementById('log-filter-clear')?.addEventListener('click', () => {
      document.getElementById('log-filter-subject').value = '';
      document.getElementById('log-filter-month').value = '';
      this.render();
    });
  }
};

/* ------------------------------------------------------------------ */
/* Syllabus                                                           */
/* ------------------------------------------------------------------ */

const Syllabus = {
  topics: [],

  async load() {
    this.topics = await Database.getAll('topics');
    return this.topics;
  },

  getProgress() {
    if (!this.topics.length) return 0;
    return Math.round((this.topics.filter((t) => t.completed).length / this.topics.length) * 100);
  },

  async render() {
    await this.load();
    const filterSubject = document.getElementById('syllabus-filter-subject')?.value || '';
    const filtered = filterSubject ? this.topics.filter((t) => t.subjectId === filterSubject) : this.topics;

    document.getElementById('syllabus-overall-progress').textContent = `${this.getProgress()}% Complete`;

    const container = document.getElementById('syllabus-list');
    if (!container) return;

    container.innerHTML = filtered.length
      ? filtered
          .map((t) => {
            const subject = Subjects.getById(t.subjectId);
            return `
          <div class="syllabus-item ${t.completed ? 'completed' : ''}">
            <button type="button" class="syllabus-check ${t.completed ? 'checked' : ''}" data-toggle="${Utils.escapeHtml(t.id)}" aria-label="Mark ${Utils.escapeHtml(t.name)} complete" aria-pressed="${t.completed}">${t.completed ? '✓' : ''}</button>
            <div class="syllabus-info">
              <div class="syllabus-topic">${Utils.escapeHtml(t.name)}</div>
              <div class="syllabus-subject-tag">${Utils.escapeHtml(subject?.name || 'Unknown')}</div>
            </div>
            <button type="button" class="syllabus-delete" data-delete="${Utils.escapeHtml(t.id)}" aria-label="Delete topic">✕</button>
          </div>`;
          })
          .join('')
      : '<p class="muted empty-state">No topics added yet.</p>';
  },

  bindEvents() {
    document.getElementById('topic-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('topic-name').value.trim();
      const subjectId = document.getElementById('topic-subject').value;
      if (!name || !subjectId) return;

      await Database.put('topics', {
        id: Utils.generateId(),
        name,
        subjectId,
        completed: false,
        createdAt: Date.now()
      });
      document.getElementById('topic-name').value = '';
      Toast.show('Topic added', 'success');
      await this.render();
    });

    document.getElementById('syllabus-list')?.addEventListener('click', async (e) => {
      const toggle = e.target.closest('[data-toggle]');
      const del = e.target.closest('[data-delete]');
      if (toggle) {
        const topic = this.topics.find((t) => t.id === toggle.dataset.toggle);
        if (!topic) return;
        topic.completed = !topic.completed;
        await Database.put('topics', topic);
        await this.render();
      } else if (del && confirm('Delete this topic?')) {
        await Database.delete('topics', del.dataset.delete);
        Toast.show('Topic deleted', 'success');
        await this.render();
      }
    });

    document.getElementById('syllabus-filter-subject')?.addEventListener('change', () => this.render());
  }
};

/* ------------------------------------------------------------------ */
/* Analytics                                                          */
/* ------------------------------------------------------------------ */

const Analytics = {
  chart: null,
  currentType: 'daily',

  render(type = this.currentType) {
    this.currentType = type;

    document.querySelectorAll('.chart-tab').forEach((tab) => {
      const active = tab.dataset.chart === type;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    const { labels, data, colors } = this.getChartData(type);
    const hasData = data.some((v) => v > 0);
    const emptyEl = document.getElementById('chart-empty');
    const canvas = document.getElementById('analytics-chart');

    if (emptyEl) emptyEl.classList.toggle('hidden', hasData);
    if (canvas) canvas.classList.toggle('hidden', !hasData);

    if (hasData) this.renderChart(labels, data, colors);
    else if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    this.renderStats();
  },

  getChartData(type) {
    const sessions = Sessions.list;

    if (type === 'daily') {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return Utils.toDateString(d);
      });
      return {
        labels: days.map((d) => Utils.parseDate(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })),
        data: days.map((d) => Sessions.getTotalMinutes((s) => s.date === d) / 60),
        colors: ['#3b82f6']
      };
    }

    if (type === 'weekly') {
      const weeks = Array.from({ length: 4 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (3 - i) * 7);
        return Utils.startOfWeek(d);
      });
      return {
        labels: weeks.map((_, i) => `Week ${i + 1}`),
        data: weeks.map((w) => {
          const start = Utils.toDateString(w);
          const end = Utils.toDateString(Utils.endOfWeek(w));
          return Sessions.getTotalMinutes((s) => s.date >= start && s.date <= end) / 60;
        }),
        colors: ['#10b981']
      };
    }

    if (type === 'monthly') {
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return d;
      });
      return {
        labels: months.map((m) => m.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })),
        data: months.map(
          (m) =>
            Sessions.getTotalMinutes((s) => {
              const d = Utils.parseDate(s.date);
              return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
            }) / 60
        ),
        colors: ['#8b5cf6']
      };
    }

    const totals = {};
    sessions.forEach((s) => {
      totals[s.subjectId] = (totals[s.subjectId] || 0) + s.durationMinutes;
    });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return {
      labels: sorted.map(([id]) => Subjects.getById(id)?.name || 'Unknown'),
      data: sorted.map(([, mins]) => mins / 60),
      colors: sorted.map(([id]) => Subjects.getColor(id))
    };
  },

  renderChart(labels, data, colors) {
    const canvas = document.getElementById('analytics-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const textColor = Theme.isDark ? '#a0a4b8' : '#5a6178';
    const gridColor = Theme.isDark ? '#1a1a24' : '#e2e6ef';
    const isSubject = this.currentType === 'subject';

    if (this.chart) this.chart.destroy();

    this.chart = new Chart(canvas, {
      type: isSubject ? 'doughnut' : 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Study Hours',
            data,
            backgroundColor: isSubject ? colors : colors[0],
            borderRadius: isSubject ? 0 : 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: isSubject, labels: { color: textColor } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = isSubject ? ctx.parsed : ctx.parsed.y;
                return `${(val ?? 0).toFixed(1)}h`;
              }
            }
          }
        },
        scales: isSubject
          ? {}
          : {
              x: { ticks: { color: textColor, maxRotation: 0 }, grid: { display: false } },
              y: {
                ticks: { color: textColor, callback: (v) => v + 'h' },
                grid: { color: gridColor },
                beginAtZero: true
              }
            }
      }
    });
  },

  renderStats() {
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return Utils.toDateString(d);
    });
    const weekMins = Sessions.getTotalMinutes((s) => last7.includes(s.date));

    const totals = {};
    Sessions.list.forEach((s) => {
      totals[s.subjectId] = (totals[s.subjectId] || 0) + s.durationMinutes;
    });
    const topId = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0];

    const dayTotals = {};
    Sessions.list.forEach((s) => {
      dayTotals[s.date] = (dayTotals[s.date] || 0) + s.durationMinutes;
    });
    const best = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0];

    document.getElementById('analytics-avg-day').textContent = Utils.formatDuration(weekMins / 7);
    document.getElementById('analytics-top-subject').textContent = topId
      ? Subjects.getById(topId)?.name || '—'
      : '—';
    document.getElementById('analytics-total-sessions').textContent = Sessions.list.length;
    document.getElementById('analytics-best-day').textContent = best
      ? `${Utils.formatDuration(best[1])} (${Utils.parseDate(best[0]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`
      : '—';
  },

  bindEvents() {
    document.querySelector('.chart-tabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-chart]');
      if (tab) this.render(tab.dataset.chart);
    });
  }
};

/* ------------------------------------------------------------------ */
/* Backup                                                             */
/* ------------------------------------------------------------------ */

const Backup = {
  bindEvents() {
    document.getElementById('export-data')?.addEventListener('click', async () => {
      try {
        const data = await Database.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mbbs-study-backup-${Utils.toDateString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Toast.show('Backup exported', 'success');
      } catch (err) {
        Toast.show('Export failed', 'error');
        console.error(err);
      }
    });

    document.getElementById('import-data')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!confirm('Import replaces ALL existing data. Continue?')) return;
        await Database.importAll(data);
        Toast.show('Backup imported', 'success');
        await App.refreshAll();
      } catch (err) {
        Toast.show('Import failed — invalid file', 'error');
        console.error(err);
      } finally {
        e.target.value = '';
      }
    });

    document.getElementById('clear-data')?.addEventListener('click', async () => {
      if (!confirm('Delete ALL study data permanently?')) return;
      if (!confirm('This cannot be undone. Proceed?')) return;
      await Database.clearAll();
      await Database.seedDefaults();
      Toast.show('All data cleared', 'success');
      await App.refreshAll();
    });
  }
};

/* ------------------------------------------------------------------ */
/* Navigation                                                         */
/* ------------------------------------------------------------------ */

const Navigation = {
  currentSection: 'dashboard',

  init() {
    document.querySelector('.sidebar-nav')?.addEventListener('click', (e) => this.handleNavClick(e));
    document.getElementById('bottom-nav')?.addEventListener('click', (e) => this.handleNavClick(e));
    document.querySelector('.quick-links')?.addEventListener('click', (e) => this.handleNavClick(e));
    document.getElementById('menu-toggle')?.addEventListener('click', () => this.toggleSidebar(true));
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => this.toggleSidebar(false));
  },

  handleNavClick(e) {
    const btn = e.target.closest('[data-section]');
    if (btn) this.navigate(btn.dataset.section);
  },

  navigate(sectionId) {
    if (!SECTION_TITLES[sectionId]) return;
    this.currentSection = sectionId;

    document.querySelectorAll('.section').forEach((el) => {
      const active = el.dataset.section === sectionId;
      el.hidden = !active;
      el.classList.toggle('active', active);
    });

    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach((el) => {
      const active = el.dataset.section === sectionId;
      el.classList.toggle('active', active);
      if (el.matches('.nav-item')) el.setAttribute('aria-current', active ? 'page' : 'false');
      if (el.matches('.bottom-nav-item')) el.setAttribute('aria-current', active ? 'page' : 'false');
    });

    document.getElementById('page-title').textContent = SECTION_TITLES[sectionId];
    this.toggleSidebar(false);

    if (sectionId === 'analytics') Analytics.render();
    if (sectionId === 'exam') Exam.renderAll();
    if (sectionId === 'settings') Exam.loadDateInput();
  },

  toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle = document.getElementById('menu-toggle');
    sidebar?.classList.toggle('open', open);
    overlay?.classList.toggle('hidden', !open);
    overlay?.setAttribute('aria-hidden', String(!open));
    toggle?.setAttribute('aria-expanded', String(open));
  }
};

/* ------------------------------------------------------------------ */
/* PWA                                                                */
/* ------------------------------------------------------------------ */

const PWA = {
  deferredPrompt: null,
  waitingWorker: null,

  init() {
    this.registerServiceWorker();
    this.bindInstallPrompt();
    this.bindOnlineStatus();
    this.bindUpdateBanner();
  },

  registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('./service-worker.js').then((reg) => {
      if (reg.waiting) this.showUpdateBanner(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            this.showUpdateBanner(worker);
          }
        });
      });
    }).catch((err) => console.warn('SW registration failed:', err));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  },

  showUpdateBanner(worker) {
    this.waitingWorker = worker;
    document.getElementById('sw-update-banner')?.classList.remove('hidden');
    document.body.classList.add('has-sw-banner');
  },

  bindUpdateBanner() {
    document.getElementById('sw-update-btn')?.addEventListener('click', () => {
      this.waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
    });
    document.getElementById('sw-update-dismiss')?.addEventListener('click', () => {
      document.getElementById('sw-update-banner')?.classList.add('hidden');
      document.body.classList.remove('has-sw-banner');
    });
  },

  bindInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (!localStorage.getItem('install-dismissed')) {
        document.getElementById('install-banner')?.classList.remove('hidden');
      }
    });

    document.getElementById('install-btn')?.addEventListener('click', async () => {
      if (!this.deferredPrompt) return;
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') Toast.show('App installed', 'success');
      this.deferredPrompt = null;
      document.getElementById('install-banner')?.classList.add('hidden');
    });

    document.getElementById('install-dismiss')?.addEventListener('click', () => {
      localStorage.setItem('install-dismissed', '1');
      document.getElementById('install-banner')?.classList.add('hidden');
    });
  },

  bindOnlineStatus() {
    const update = () => {
      const online = navigator.onLine;
      const banner = document.getElementById('offline-banner');
      banner?.classList.toggle('hidden', online);
      document.body.classList.toggle('has-offline-banner', !online);
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }
};

const Auth = {
  user: null,

  async init() {
    // Check if a user session is already active on load
    const { data: { session } } = await supabase.auth.getSession();
    this.user = session?.user || null;
    
    // Listen for auth state modifications (sign in, sign out, etc.)
    supabase.auth.onAuthStateChange((_event, session) => {
      this.user = session?.user || null;
      this.updateUI();
    });
  },

  async signUp(email, password, fullName) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
      if (error) throw error;
      Toast.show('Signup successful! Check your email for validation.', 'success');
      return data;
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      Toast.show('Logged in successfully!', 'success');
      return data;
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      Toast.show('Logged out successfully.', 'info');
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  updateUI() {
    // This is where you can hide or show login forms, update profile names,
    // and sync your IndexedDB logs up to your Supabase tables if a user is online.
    if (this.user) {
      console.log('User logged in:', this.user.email);
    } else {
      console.log('User is a guest.');
    }
  }
};

/* ------------------------------------------------------------------ */
/* App bootstrap                                                      */
/* ------------------------------------------------------------------ */

const App = {
  async init() {
    try {
      Toast.init();
      await Database.open();
      await Database.seedDefaults();
      await Auth.init();
      await Exam.getDate();
      await Theme.init();
      await Subjects.load();
      Subjects.populateSelects();

      Timer.init();
      Navigation.init();
      PWA.init();

      Subjects.bindEvents();
      Logs.bindEvents();
      Syllabus.bindEvents();
      Exam.bindEvents();
      Analytics.bindEvents();
      Backup.bindEvents();

      await this.refreshAll();

      const params = new URLSearchParams(window.location.search);
      const section = params.get('section');
      if (section && SECTION_TITLES[section]) {
        Navigation.navigate(section);
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) {
      console.error('Init failed:', err);
      Toast.show('Failed to initialize. Please refresh.', 'error');
    }
  },

  async refreshAll() {
    await Sessions.load();
    await Subjects.load();
    Subjects.populateSelects();
    Dashboard.render();
    Logs.render();
    await Subjects.render();
    await Syllabus.render();
    if (Navigation.currentSection === 'analytics') Analytics.render();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
