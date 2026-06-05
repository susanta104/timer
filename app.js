{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /**\
 * MBBS Study Command Center v1.1\
 * Modular study-tracking PWA with Integrated Cloud Sync Engine.\
 */\
\
'use strict';\
\
const DB_NAME = 'MBBSStudyDB';\
const DB_VERSION = 1;\
const THEME_STORAGE_KEY = 'mbbs-theme';\
\
// INTEGRATED PROFILE TELEMETRY TARGETS\
const SUPABASE_URL = "https://gdlfbybyvkvmbyclgswv.supabase.co";\
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlb3Nia3FmYmJ5ZHFkbHpobnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzQ5MTcsImV4cCI6MjA5NjI1MDkxN30.dTUz1r0YpEIwyDkt9pXAmRi9MbCZ5L6f36LXxj3DgjY"; \
let supabaseClient = null;\
\
if (typeof supabase !== 'undefined' && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY") \{\
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);\
\}\
\
const DEFAULT_SUBJECTS = [\
  \{ id: 'medicine', name: 'Medicine', color: '#3b82f6', isDefault: true \},\
  \{ id: 'surgery', name: 'Surgery', color: '#ef4444', isDefault: true \},\
  \{ id: 'gynecology', name: 'Gynecology', color: '#ec4899', isDefault: true \},\
  \{ id: 'pediatrics', name: 'Pediatrics', color: '#10b981', isDefault: true \},\
  \{ id: 'dermatology', name: 'Dermatology', color: '#f59e0b', isDefault: true \},\
  \{ id: 'others', name: 'Others', color: '#8b5cf6', isDefault: true \}\
];\
\
const TIMER_PRESETS = \{\
  free: 0,\
  pomodoro: 25 * 60,\
  deepwork: 50 * 60,\
  focus: 90 * 60,\
  custom: 0\
\};\
\
const PRESET_LABELS = \{\
  free: 'Free Timer (counts up)',\
  pomodoro: 'Pomodoro \'97 25 min',\
  deepwork: 'Deep Work \'97 50 min',\
  focus: 'Focus Session \'97 90 min',\
  custom: 'Custom Timer'\
\};\
\
const SECTION_TITLES = \{\
  dashboard: 'Dashboard',\
  timer: 'Study Timer',\
  syllabus: 'Syllabus Tracker',\
  logs: 'Study Logs',\
  analytics: 'Analytics',\
  settings: 'More / Settings'\
\};\
\
/* ------------------------------------------------------------------ */\
/* Database Layer (IndexedDB)                                         */\
/* ------------------------------------------------------------------ */\
const Database = \{\
  db: null,\
  open() \{\
    return new Promise((resolve, reject) => \{\
      const request = indexedDB.open(DB_NAME, DB_VERSION);\
      request.onerror = () => reject(request.error);\
      request.onsuccess = () => \{ this.db = request.result; resolve(this.db); \};\
      request.onupgradeneeded = (e) => \{\
        const db = request.result;\
        if (!db.objectStoreNames.contains('sessions')) \{\
          db.createObjectStore('sessions', \{ keyPath: 'id', autoIncrement: true \});\
        \}\
        if (!db.objectStoreNames.contains('subjects')) \{\
          db.createObjectStore('subjects', \{ keyPath: 'id' \});\
        \}\
        if (!db.objectStoreNames.contains('syllabus')) \{\
          db.createObjectStore('syllabus', \{ keyPath: 'id', autoIncrement: true \});\
        \}\
      \};\
    \});\
  \},\
  async seedDefaults() \{\
    const existing = await this.getAll('subjects');\
    if (existing.length === 0) \{\
      for (const s of DEFAULT_SUBJECTS) \{ await this.put('subjects', s); \}\
    \}\
  \},\
  getAll(storeName) \{\
    return new Promise((resolve, reject) => \{\
      const tx = this.db.transaction(storeName, 'readonly');\
      const store = tx.objectStore(storeName);\
      const req = store.getAll();\
      req.onsuccess = () => resolve(req.result);\
      req.onerror = () => reject(req.error);\
    \});\
  \},\
  put(storeName, item) \{\
    return new Promise((resolve, reject) => \{\
      const tx = this.db.transaction(storeName, 'readwrite');\
      const store = tx.objectStore(storeName);\
      const req = store.put(item);\
      req.onsuccess = () => resolve(req.result);\
      req.onerror = () => reject(req.error);\
    \});\
  \},\
  delete(storeName, key) \{\
    return new Promise((resolve, reject) => \{\
      const tx = this.db.transaction(storeName, 'readwrite');\
      const store = tx.objectStore(storeName);\
      const req = store.delete(key);\
      req.onsuccess = () => resolve();\
      req.onerror = () => reject(req.error);\
    \});\
  \},\
  clearAllStores() \{\
    return new Promise((resolve, reject) => \{\
      const tx = this.db.transaction(['sessions', 'subjects', 'syllabus'], 'readwrite');\
      tx.objectStore('sessions').clear();\
      tx.objectStore('subjects').clear();\
      tx.objectStore('syllabus').clear();\
      tx.oncomplete = () => resolve();\
      tx.onerror = () => reject(tx.error);\
    \});\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Subjects State Management                                         */\
/* ------------------------------------------------------------------ */\
const Subjects = \{\
  cache: [],\
  async load() \{ this.cache = await Database.getAll('subjects'); \},\
  getMap() \{ return new Map(this.cache.map(s => [s.id, s])); \},\
  populateSelects() \{\
    const selects = ['modal-subject', 'topic-subject', 'log-subject'];\
    selects.forEach(id => \{\
      const el = document.getElementById(id);\
      if (!el) return;\
      el.innerHTML = this.cache.map(s => `<option value="$\{s.id\}">$\{s.name\}</option>`).join('');\
    \});\
  \},\
  bindEvents() \{\},\
  async render() \{\}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Study Sessions Logic                                               */\
/* ------------------------------------------------------------------ */\
const Sessions = \{\
  cache: [],\
  async load() \{\
    const all = await Database.getAll('sessions');\
    this.cache = all.sort((a, b) => new Date(b.date) - new Date(a.date));\
  \},\
  async add(subjectId, durationMinutes, notes = '') \{\
    const session = \{ date: new Date().toISOString().split('T')[0], subjectId, duration: durationMinutes, notes: notes.trim() \};\
    await Database.put('sessions', session);\
    await this.load();\
    await App.refreshAll();\
  \},\
  async delete(id) \{\
    if (!confirm('Delete this study log entry?')) return;\
    await Database.delete('sessions', id);\
    await this.load();\
    await App.refreshAll();\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Syllabus Logic                                                     */\
/* ------------------------------------------------------------------ */\
const Syllabus = \{\
  cache: [],\
  async load() \{ this.cache = await Database.getAll('syllabus'); \},\
  bindEvents() \{\
    const form = document.getElementById('add-topic-form');\
    if (!form) return;\
    form.onsubmit = async (e) => \{\
      e.preventDefault();\
      const subjectId = document.getElementById('topic-subject').value;\
      const name = document.getElementById('topic-name').value.trim();\
      if (!name) return;\
      await Database.put('syllabus', \{ subjectId, name, completed: false \});\
      form.reset();\
      await this.load();\
      await App.refreshAll();\
      Toast.show('Topic added successfully.', 'success');\
    \};\
  \},\
  async toggle(id) \{\
    const item = this.cache.find(t => t.id === id);\
    if (!item) return;\
    item.completed = !item.completed;\
    await Database.put('syllabus', item);\
    await this.load();\
    await App.refreshAll();\
  \},\
  async delete(id) \{\
    if (!confirm('Delete this topic?')) return;\
    await Database.delete('syllabus', id);\
    await this.load();\
    await App.refreshAll();\
  \},\
  async render() \{\
    const container = document.getElementById('syllabus-container');\
    if (!container) return;\
    if (this.cache.length === 0) \{\
      container.innerHTML = `<div class="card text-secondary" style="text-align:center; padding:2rem;">No targets added yet. Complete the dashboard entry module above.</div>`;\
      return;\
    \}\
    const map = Subjects.getMap();\
    const groups = \{\};\
    this.cache.forEach(item => \{\
      if (!groups[item.subjectId]) groups[item.subjectId] = [];\
      groups[item.subjectId].push(item);\
    \});\
    let html = '';\
    for (const [subId, items] of Object.entries(groups)) \{\
      const sub = map.get(subId) || \{ name: subId, color: '#94a3b8' \};\
      const completedCount = items.filter(i => i.completed).length;\
      const pct = items.length ? Math.round((completedCount / items.length) * 100) : 0;\
      html += `\
        <div class="card" style="border-left: 4px solid $\{sub.color\};">\
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">\
            <h4 style="margin:0; font-size:1.1rem;">$\{sub.name\}</h4>\
            <small class="text-secondary">$\{completedCount\}/$\{items.length\} ($\{pct\}%)</small>\
          </div>\
          <div style="display:grid; gap:0.5rem;">\
            $\{items.map(item => `\
              <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem; background:var(--bg-tertiary); border-radius:6px;">\
                <label style="display:flex; align-items:center; gap:0.75rem; cursor:pointer; min-width:0; flex:1;">\
                  <input type="checkbox" $\{item.completed ? 'checked' : ''\} onchange="Syllabus.toggle($\{item.id\})" style="width:18px; height:18px; accent-color:$\{sub.color\};">\
                  <span style="$\{item.completed ? 'text-decoration:line-through; color:var(--text-muted);' : ''\}; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">$\{item.name\}</span>\
                </label>\
                <button type="button" class="text-secondary" onclick="Syllabus.delete($\{item.id\})" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:0.25rem 0.5rem;">\uc0\u10005 </button>\
              </div>\
            `).join('')\}\
          </div>\
        </div>\
      `;\
    \}\
    container.innerHTML = html;\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Dashboard Summary Presentation                                      */\
/* ------------------------------------------------------------------ */\
const Dashboard = \{\
  render() \{\
    const summary = this.calculateSummary();\
    document.getElementById('dash-today').innerText = this.formatHrsMins(summary.today);\
    document.getElementById('dash-week').innerText = this.formatHrsMins(summary.week);\
    document.getElementById('dash-month').innerText = this.formatHrsMins(summary.month);\
    document.getElementById('dash-lifetime').innerText = this.formatHrsMins(summary.lifetime);\
\
    const totalTopics = Syllabus.cache.length;\
    const doneTopics = Syllabus.cache.filter(t => t.completed).length;\
    const pct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;\
    \
    const bar = document.getElementById('dash-syllabus-progress');\
    if (bar) bar.style.width = pct + '%';\
    const text = document.getElementById('dash-syllabus-text');\
    if (text) text.innerText = `Syllabus Metrics: $\{pct\}% Complete ($\{doneTopics\}/$\{totalTopics\} topics completed)`;\
\
    const streakCount = this.calculateStreak();\
    document.getElementById('streak-count').innerText = streakCount;\
  \},\
  calculateSummary() \{\
    const now = new Date();\
    const todayStr = now.toISOString().split('T')[0];\
    \
    const currentDay = now.getDay();\
    const distanceToMonday = (currentDay === 0 ? 6 : currentDay - 1);\
    const monday = new Date(now);\
    monday.setDate(now.getDate() - distanceToMonday);\
    const weekStartStr = monday.toISOString().split('T')[0];\
    \
    const monthStartStr = `$\{now.getFullYear()\}-$\{String(now.getMonth() + 1).padStart(2, '0')\}-01`;\
    \
    let today = 0, week = 0, month = 0, lifetime = 0;\
    Sessions.cache.forEach(s => \{\
      lifetime += s.duration;\
      if (s.date === todayStr) today += s.duration;\
      if (s.date >= weekStartStr) week += s.duration;\
      if (s.date >= monthStartStr) month += s.duration;\
    \});\
    return \{ today, week, month, lifetime \};\
  \},\
  calculateStreak() \{\
    const dates = Array.from(new Set(Sessions.cache.map(s => s.date))).sort().reverse();\
    if (dates.length === 0) return 0;\
    const todayStr = new Date().toISOString().split('T')[0];\
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];\
    if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;\
    let streak = 0;\
    let current = new Date(dates[0]);\
    for (let i = 0; i < dates.length; i++) \{\
      const expectedStr = current.toISOString().split('T')[0];\
      if (dates[i] === expectedStr) \{ streak++; current.setDate(current.getDate() - 1); \}\
      else \{ break; \}\
    \}\
    return streak;\
  \},\
  formatHrsMins(m) \{ const hrs = Math.floor(m / 60); const mins = m % 60; return `$\{hrs\}h $\{mins\}m`; \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Study Logging Interface Actions                                    */\
/* ------------------------------------------------------------------ */\
const Logs = \{\
  bindEvents() \{\
    const inputDate = document.getElementById('log-date');\
    if (inputDate) inputDate.value = new Date().toISOString().split('T')[0];\
    const form = document.getElementById('manual-log-form');\
    if (!form) return;\
    form.onsubmit = async (e) => \{\
      e.preventDefault();\
      const date = document.getElementById('log-date').value;\
      const subjectId = document.getElementById('log-subject').value;\
      const duration = parseInt(document.getElementById('log-duration').value, 10);\
      const notes = document.getElementById('log-notes').value;\
      if (!date || !subjectId || !duration || duration <= 0) return;\
      const s = \{ date, subjectId, duration, notes: notes.trim() \};\
      await Database.put('sessions', s);\
      form.reset();\
      if (inputDate) inputDate.value = new Date().toISOString().split('T')[0];\
      await Sessions.load();\
      await App.refreshAll();\
      Toast.show('Session log created successfully.', 'success');\
    \};\
  \},\
  render() \{\
    const tbody = document.getElementById('logs-tbody');\
    if (!tbody) return;\
    if (Sessions.cache.length === 0) \{\
      tbody.innerHTML = `<tr><td colspan="5" class="text-secondary" style="text-align:center; padding:2rem;">No operational logs saved.</td></tr>`;\
      return;\
    \}\
    const map = Subjects.getMap();\
    tbody.innerHTML = Sessions.cache.map(s => \{\
      const sub = map.get(s.subjectId) || \{ name: s.subjectId, color: '#94a3b8' \};\
      return `\
        <tr>\
          <td style="white-space:nowrap;">$\{s.date\}</td>\
          <td><span class="subject-badge" style="background:$\{sub.color\}20; color:$\{sub.color\}; padding:0.25rem 0.5rem; border-radius:4px; font-weight:500;">$\{sub.name\}</span></td>\
          <td>$\{s.duration\}m</td>\
          <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="$\{s.notes || ''\}">$\{s.notes || '-'\}</td>\
          <td><button type="button" onclick="Sessions.delete($\{s.id\})" style="background:none; border:none; color:var(--danger); cursor:pointer;">Delete</button></td>\
        </tr>\
      `;\
    \}).join('');\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Core Navigation Controls                                           */\
/* ------------------------------------------------------------------ */\
const Navigation = \{\
  currentSection: 'dashboard',\
  init() \{\
    const items = document.querySelectorAll('.nav-item, .bottom-nav-item');\
    const menuToggle = document.getElementById('menu-toggle');\
    const sidebar = document.getElementById('sidebar');\
    \
    items.forEach(btn => \{\
      btn.onclick = () => \{\
        const target = btn.getAttribute('data-section');\
        this.navigate(target);\
        if (sidebar) sidebar.classList.remove('open');\
        if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');\
      \};\
    \});\
\
    if (menuToggle && sidebar) \{\
      menuToggle.onclick = () => \{\
        const open = sidebar.classList.toggle('open');\
        menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');\
      \};\
    \}\
  \},\
  navigate(sectionId) \{\
    if (!SECTION_TITLES[sectionId]) return;\
    this.currentSection = sectionId;\
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));\
    const targetSection = document.getElementById(sectionId);\
    if (targetSection) targetSection.classList.add('active');\
\
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(btn => \{\
      if (btn.getAttribute('data-section') === sectionId) btn.classList.add('active');\
      else btn.classList.remove('active');\
    \});\
\
    const titleEl = document.getElementById('current-section-title');\
    if (titleEl) titleEl.innerText = SECTION_TITLES[sectionId];\
    if (sectionId === 'analytics') Analytics.render();\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Analytics Layer Logic (Chart.js Interface)                         */\
/* ------------------------------------------------------------------ */\
const Analytics = \{\
  charts: \{\},\
  bindEvents() \{\},\
  render() \{\
    this.destroyCharts();\
    const map = Subjects.getMap();\
    this.renderWeeklyChart(map);\
    this.renderSubjectChart(map);\
  \},\
  destroyCharts() \{ Object.values(this.charts).forEach(c => c.destroy()); this.charts = \{\}; \},\
  renderWeeklyChart(subMap) \{\
    const canvas = document.getElementById('chart-weekly');\
    if (!canvas) return;\
    const labels = [];\
    const totals = [];\
    for (let i = 6; i >= 0; i--) \{\
      const d = new Date(); d.setDate(d.getDate() - i);\
      const str = d.toISOString().split('T')[0];\
      labels.push(d.toLocaleDateString(undefined, \{ weekday: 'short', month: 'numeric', day: 'numeric' \}));\
      const dayTotal = Sessions.cache.filter(s => s.date === str).reduce((sum, s) => sum + s.duration, 0);\
      totals.push(Math.round((dayTotal / 60) * 10) / 10);\
    \}\
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';\
    const gridColor = isDark ? '#22222f' : '#e2e6ef';\
    const textColor = isDark ? '#8b92a8' : '#5a6178';\
\
    this.charts.weekly = new Chart(canvas, \{\
      type: 'bar',\
      data: \{\
        labels,\
        datasets: [\{ label: 'Hours Studied', data: totals, backgroundColor: '#2563eb', borderRadius: 6 \}]\
      \},\
      options: \{\
        responsive: true, maintainAspectRatio: false,\
        plugins: \{ legend: \{ display: false \} \},\
        scales: \{\
          x: \{ grid: \{ color: gridColor \}, ticks: \{ color: textColor \} \},\
          y: \{ grid: \{ color: gridColor \}, ticks: \{ color: textColor \}, title: \{ display: true, text: 'Hours', color: textColor \} \}\
        \}\
      \}\
    \});\
  \},\
  renderSubjectChart(subMap) \{\
    const canvas = document.getElementById('chart-subjects');\
    if (!canvas) return;\
    const subTotals = \{\};\
    Sessions.cache.forEach(s => \{ subTotals[s.subjectId] = (subTotals[s.subjectId] || 0) + s.duration; \});\
    const labels = [];\
    const data = [];\
    const colors = [];\
    Object.entries(subTotals).forEach(([id, mins]) => \{\
      const sub = subMap.get(id) || \{ name: id, color: '#94a3b8' \};\
      labels.push(sub.name);\
      data.push(Math.round((mins / 60) * 10) / 10);\
      colors.push(sub.color);\
    \});\
    if (labels.length === 0) \{ labels.push('No Operational Logs'); data.push(1); colors.push('#22222f'); \}\
    this.charts.subjects = new Chart(canvas, \{\
      type: 'doughnut',\
      data: \{ labels, datasets: [\{ data, backgroundColor: colors, borderWidth: 0 \}] \},\
      options: \{\
        responsive: true, maintainAspectRatio: false,\
        plugins: \{ legend: \{ position: 'right', labels: \{ color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#8b92a8' : '#5a6178' \} \} \}\
      \}\
    \});\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Countdowns Execution Engine                                        */\
/* ------------------------------------------------------------------ */\
const Exam = \{\
  storageKey: 'mbbs-exam-date',\
  getDate() \{\
    const saved = localStorage.getItem(this.storageKey);\
    const input = document.getElementById('settings-exam-date');\
    if (saved && input) input.value = saved;\
    this.updateDisplay(saved);\
  \},\
  bindEvents() \{\
    const form = document.getElementById('settings-exam-form');\
    if (!form) return;\
    form.onsubmit = (e) => \{\
      e.preventDefault();\
      const val = document.getElementById('settings-exam-date').value;\
      if (!val) \{ localStorage.removeItem(this.storageKey); \}\
      else \{ localStorage.setItem(this.storageKey, val); \}\
      this.updateDisplay(val);\
      Toast.show('Exam countdown configuration updated.', 'success');\
    \};\
  \},\
  updateDisplay(dateStr) \{\
    const el = document.getElementById('countdown-display');\
    if (!el) return;\
    if (!dateStr) \{\
      el.innerHTML = `<span class="text-secondary" style="font-size:0.95rem;">Configuration unassigned. Access settings to calibrate countdown telemetry.</span>`;\
      return;\
    \}\
    const diff = new Date(dateStr) - new Date();\
    if (diff <= 0) \{ el.innerHTML = `<strong style="color:var(--success); font-size:1.5rem;">Exam Completed!</strong>`; return; \}\
    const days = Math.ceil(diff / 86400000);\
    const weeks = Math.floor(days / 7);\
    const remDays = days % 7;\
    let html = `<div style="font-size:2.2rem; font-weight:800; color:var(--accent);">$\{days\} <small style="font-size:1rem; color:var(--text-secondary);">Days Remaining</small></div>`;\
    if (weeks > 0) \{ html += `<div style="margin-top:0.25rem;" class="text-secondary">Equivalent to: <strong>$\{weeks\}w $\{remDays\}d</strong></div>`; \}\
    el.innerHTML = html;\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Visual Aesthetics Configuration Control (Themes)                  */\
/* ------------------------------------------------------------------ */\
const Theme = \{\
  init() \{\
    const btn = document.getElementById('theme-toggle');\
    if (!btn) return;\
    btn.onclick = () => \{\
      const current = document.documentElement.getAttribute('data-theme') || 'dark';\
      const target = current === 'dark' ? 'light' : 'dark';\
      document.documentElement.setAttribute('data-theme', target);\
      localStorage.setItem(THEME_STORAGE_KEY, target);\
      const metaTheme = document.querySelector('meta[name="theme-color"]');\
      if (metaTheme) metaTheme.content = target === 'dark' ? '#0a0a0f' : '#f8f9fc';\
      if (Navigation.currentSection === 'analytics') Analytics.render();\
      Toast.show(`Interface theme set to $\{target\}.`, 'info');\
    \};\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Backup Data Import/Export Modules                                  */\
/* ------------------------------------------------------------------ */\
const Backup = \{\
  bindEvents() \{\
    const btnExp = document.getElementById('btn-export');\
    if (btnExp) btnExp.onclick = () => this.exportBackup();\
    const btnImp = document.getElementById('btn-import');\
    const fileImp = document.getElementById('file-import');\
    if (btnImp && fileImp) \{\
      btnImp.onclick = () => fileImp.click();\
      fileImp.onchange = (e) => \{\
        const file = e.target.files[0];\
        if (!file) return;\
        const reader = new FileReader();\
        reader.onload = async (evt) => \{\
          try \{\
            const data = JSON.parse(evt.target.result);\
            await this.restoreFromBackupData(data);\
            Toast.show('Backup loaded successfully.', 'success');\
            setTimeout(() => location.reload(), 1000);\
          \} catch (err) \{ Toast.show('Invalid file layout.', 'error'); \}\
        \};\
        reader.readAsText(file);\
      \};\
    \}\
  \},\
  async generateBackupData() \{\
    const sessions = await Database.getAll('sessions');\
    const subjects = await Database.getAll('subjects');\
    const syllabus = await Database.getAll('syllabus');\
    return \{ version: 1, exportDate: new Date().toISOString(), sessions, subjects, syllabus \};\
  \},\
  async exportBackup() \{\
    try \{\
      const data = await this.generateBackupData();\
      const blob = new Blob([JSON.stringify(data, null, 2)], \{ type: 'application/json' \});\
      const url = URL.createObjectURL(blob);\
      const a = document.createElement('a');\
      a.href = url;\
      a.download = `mbbs_study_backup_$\{new Date().toISOString().split('T')[0]\}.json`;\
      a.click();\
      Toast.show('JSON file downloaded.', 'success');\
    \} catch (e) \{ Toast.show('Export structural error.', 'error'); \}\
  \},\
  async restoreFromBackupData(data) \{\
    if (!data || !data.sessions || !data.subjects || !data.syllabus) throw new Error('Invalid layout structural markers');\
    await Database.clearAllStores();\
    for (const s of data.subjects) \{ await Database.put('subjects', s); \}\
    for (const s of data.sessions) \{ delete s.id; await Database.put('sessions', s); \}\
    for (const t of data.syllabus) \{ delete t.id; await Database.put('syllabus', t); \}\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Stopwatches Engine Operations                                      */\
/* ------------------------------------------------------------------ */\
const Timer = \{\
  seconds: 0,\
  interval: null,\
  type: 'free',\
  init() \{\
    const select = document.getElementById('timer-preset');\
    if (!select) return;\
    select.innerHTML = Object.entries(PRESET_LABELS).map(([k, v]) => `<option value="$\{k\}">$\{v\}</option>`).join('');\
    select.onchange = () => \{ this.type = select.value; this.reset(); \};\
\
    document.getElementById('timer-start').onclick = () => this.start();\
    document.getElementById('timer-pause').onclick = () => this.pause();\
    document.getElementById('timer-stop').onclick = () => this.stop();\
    this.reset();\
  \},\
  start() \{\
    document.getElementById('timer-start').disabled = true;\
    document.getElementById('timer-pause').disabled = false;\
    document.getElementById('timer-stop').disabled = false;\
    document.getElementById('timer-preset').disabled = true;\
    \
    this.interval = setInterval(() => \{\
      if (this.type === 'free' || this.type === 'custom' && TIMER_PRESETS[this.type] === 0) \{\
        this.seconds++;\
        this.render();\
      \} else \{\
        if (this.seconds <= 0) \{ this.complete(); \}\
        else \{ this.seconds--; this.render(); \}\
      \}\
    \}, 1000);\
  \},\
  pause() \{\
    document.getElementById('timer-start').disabled = false;\
    document.getElementById('timer-pause').disabled = true;\
    clearInterval(this.interval);\
  \},\
  reset() \{\
    this.pause();\
    document.getElementById('timer-stop').disabled = true;\
    document.getElementById('timer-preset').disabled = false;\
    if (this.type === 'custom') \{\
      const val = prompt('Enter custom session minutes:', '45');\
      const mins = parseInt(val, 10);\
      this.seconds = (!isNaN(mins) && mins > 0) ? mins * 60 : 45 * 60;\
    \} else \{\
      this.seconds = TIMER_PRESETS[this.type];\
    \}\
    this.render();\
  \},\
  stop() \{\
    this.pause();\
    const elapsedMins = this.calculateElapsedMinutes();\
    if (elapsedMins >= 1) \{\
      document.getElementById('modal-duration').innerText = `$\{elapsedMins\}m`;\
      Subjects.populateSelects();\
      const modal = document.getElementById('save-session-modal');\
      modal.showModal();\
      document.getElementById('save-session-form').onsubmit = async (e) => \{\
        e.preventDefault();\
        const subId = document.getElementById('modal-subject').value;\
        const notes = document.getElementById('modal-notes').value;\
        await Sessions.add(subId, elapsedMins, notes);\
        document.getElementById('save-session-form').reset();\
        modal.close();\
        this.reset();\
        Toast.show('Study session cataloged.', 'success');\
      \};\
      document.getElementById('modal-cancel').onclick = () => \{ modal.close(); this.reset(); \};\
    \} else \{\
      Toast.show('Session under 1 minute discarded.', 'info');\
      this.reset();\
    \}\
  \},\
  complete() \{\
    this.pause();\
    try \{\
      navigator.vibrate([200, 100, 200]);\
    \} catch (e) \{\}\
    const targetMins = Math.round(TIMER_PRESETS[this.type] / 60);\
    this.seconds = 0; this.render();\
    document.getElementById('modal-duration').innerText = `$\{targetMins\}m`;\
    const modal = document.getElementById('save-session-modal');\
    modal.showModal();\
    document.getElementById('save-session-form').onsubmit = async (e) => \{\
      e.preventDefault();\
      const subId = document.getElementById('modal-subject').value;\
      const notes = document.getElementById('modal-notes').value;\
      await Sessions.add(subId, targetMins, notes);\
      document.getElementById('save-session-form').reset();\
      modal.close();\
      this.reset();\
    \};\
    document.getElementById('modal-cancel').onclick = () => \{ modal.close(); this.reset(); \};\
  \},\
  calculateElapsedMinutes() \{\
    if (this.type === 'free') return Math.floor(this.seconds / 60);\
    const initial = TIMER_PRESETS[this.type];\
    return Math.max(0, Math.floor((initial - this.seconds) / 60));\
  \},\
  render() \{\
    const hrs = Math.floor(this.seconds / 3600);\
    const mins = Math.floor((this.seconds % 3600) / 60);\
    const secs = this.seconds % 60;\
    document.getElementById('timer-clock').innerText = \
      `$\{String(hrs).padStart(2, '0')\}:$\{String(mins).padStart(2, '0')\}:$\{String(secs).padStart(2, '0')\}`;\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* PWA Core Framework Registration                                    */\
/* ------------------------------------------------------------------ */\
const PWA = \{\
  init() \{\
    if ('serviceWorker' in navigator) \{\
      window.addEventListener('load', () => \{\
        navigator.serviceWorker.register('./service-worker.js')\
          .then(reg => console.log('SW deployed successfully:', reg.scope))\
          .catch(err => console.error('SW registration broken:', err));\
      \});\
    \}\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Flash Notifications Handler (Toast API)                            */\
/* ------------------------------------------------------------------ */\
const Toast = \{\
  container: null,\
  init() \{ this.container = document.getElementById('toast-container'); \},\
  show(message, type = 'info') \{\
    if (!this.container) return;\
    const toast = document.createElement('div');\
    toast.className = `toast $\{type\}`;\
    let icon = '\uc0\u8505 \u65039 ';\
    if (type === 'success') icon = '\uc0\u9989 ';\
    if (type === 'error') icon = '\uc0\u10060 ';\
    toast.innerHTML = `<span aria-hidden="true">$\{icon\}</span><div>$\{message\}</div>`;\
    this.container.appendChild(toast);\
    setTimeout(() => \{ toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); \}, 3000);\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* Cloud Sync Engine Logic (Newly Added)                              */\
/* ------------------------------------------------------------------ */\
const CloudSync = \{\
  async init() \{\
    if (!supabaseClient) return;\
    const \{ data: \{ user \} \} = await supabaseClient.auth.getUser();\
    this.updateUI(user);\
  \},\
  updateUI(user) \{\
    const formContainer = document.getElementById('cloud-auth-form');\
    const statusContainer = document.getElementById('cloud-active-status');\
    const userDisplay = document.getElementById('cloud-user-display');\
    const msg = document.getElementById('cloud-status-message');\
    if (!formContainer || !statusContainer) return;\
    if (user) \{\
      formContainer.style.display = 'none';\
      statusContainer.style.display = 'block';\
      if (userDisplay) userDisplay.innerText = user.email;\
      if (msg) msg.innerText = "";\
    \} else \{\
      formContainer.style.display = 'block';\
      statusContainer.style.display = 'none';\
      if (msg) msg.innerText = "";\
    \}\
  \},\
  async handleAuth() \{\
    const email = document.getElementById('cloud-email').value;\
    const password = document.getElementById('cloud-password').value;\
    const msg = document.getElementById('cloud-status-message');\
    if (!email || !password) \{\
      if (msg) \{ msg.style.color = 'var(--danger)'; msg.innerText = "Please complete all fields."; \}\
      return;\
    \}\
    if (msg) \{ msg.style.color = 'var(--accent)'; msg.innerText = "Connecting to secure cloud link..."; \}\
    \
    let \{ data, error \} = await supabaseClient.auth.signInWithPassword(\{ email, password \});\
    \
    if (error && error.message.includes("Invalid login credentials")) \{\
      if (msg) msg.innerText = "Setting up a fresh cloud sync profile...";\
      const signup = await supabaseClient.auth.signUp(\{ email, password \});\
      data = signup.data;\
      error = signup.error;\
      if (!error) Toast.show("Account registration complete!", "success");\
    \}\
    if (error) \{\
      if (msg) \{ msg.style.color = 'var(--danger)'; msg.innerText = error.message; \}\
    \} else if (data.user) \{\
      this.updateUI(data.user);\
      Toast.show("Cloud engine synchronized successfully.", "success");\
    \}\
  \},\
  async logout() \{\
    if (!supabaseClient) return;\
    await supabaseClient.auth.signOut();\
    this.updateUI(null);\
    document.getElementById('cloud-email').value = "";\
    document.getElementById('cloud-password').value = "";\
    Toast.show("Cloud sync disconnected.", "info");\
  \},\
  async pushToCloud() \{\
    if (!supabaseClient) return;\
    const \{ data: \{ user \} \} = await supabaseClient.auth.getUser();\
    if (!user) return;\
    const msg = document.getElementById('cloud-status-message');\
    if (msg) \{ msg.style.color = 'var(--accent)'; msg.innerText = "Exporting data stores to cloud..."; \}\
    \
    try \{\
      const dbBackup = await Backup.generateBackupData();\
      const stringData = JSON.stringify(dbBackup);\
      const \{ data: existing \} = await supabaseClient.from('user_sync_data').select('id').limit(1);\
      \
      let resError;\
      if (existing && existing.length > 0) \{\
        const \{ error \} = await supabaseClient.from('user_sync_data').update(\{ payload: stringData \}).eq('id', existing[0].id);\
        resError = error;\
      \} else \{\
        const \{ error \} = await supabaseClient.from('user_sync_data').insert([\{ user_id: user.id, payload: stringData \}]);\
        resError = error;\
      \}\
      if (resError) throw resError;\
      if (msg) \{ msg.style.color = 'var(--success)'; msg.innerText = "Backup complete! \uc0\u55357 \u56548 "; \}\
      Toast.show("Cloud backup successful.", "success");\
    \} catch (err) \{\
      if (msg) \{ msg.style.color = 'var(--danger)'; msg.innerText = "Sync failure: " + err.message; \}\
    \}\
  \},\
  async pullFromCloud() \{\
    if (!supabaseClient) return;\
    if (!confirm("This will replace current browser records with your cloud-saved sync profile. Proceed?")) return;\
    const msg = document.getElementById('cloud-status-message');\
    if (msg) \{ msg.style.color = 'var(--accent)'; msg.innerText = "Fetching cloud records map..."; \}\
    \
    try \{\
      const \{ data, error \} = await supabaseClient.from('user_sync_data').select('payload').limit(1);\
      if (error) throw error;\
      if (!data || data.length === 0) \{\
        if (msg) \{ msg.style.color = 'var(--warning)'; msg.innerText = "No database instances discovered on this account profile."; \}\
        return;\
      \}\
      const parsed = JSON.parse(data[0].payload);\
      await Backup.restoreFromBackupData(parsed);\
      if (msg) \{ msg.style.color = 'var(--success)'; msg.innerText = "System data synchronized! \uc0\u55357 \u56549 "; \}\
      Toast.show("Data sync loaded.", "success");\
      setTimeout(() => location.reload(), 1000);\
    \} catch (err) \{\
      if (msg) \{ msg.style.color = 'var(--danger)'; msg.innerText = "Sync restoration error: " + err.message; \}\
    \}\
  \}\
\};\
\
/* ------------------------------------------------------------------ */\
/* App Bootstrap Manager                                              */\
/* ------------------------------------------------------------------ */\
const App = \{\
  async init() \{\
    try \{\
      Toast.init();\
      await Database.open();\
      await Database.seedDefaults();\
      await Exam.getDate();\
      await Theme.init();\
      await Subjects.load();\
      Subjects.populateSelects();\
\
      Timer.init();\
      Navigation.init();\
      PWA.init();\
      \
      if (typeof CloudSync !== 'undefined') await CloudSync.init();\
\
      Subjects.bindEvents();\
      Logs.bindEvents();\
      Syllabus.bindEvents();\
      Exam.bindEvents();\
      Analytics.bindEvents();\
      Backup.bindEvents();\
\
      await this.refreshAll();\
\
      const params = new URLSearchParams(window.location.search);\
      const section = params.get('section');\
      if (section && SECTION_TITLES[section]) \{\
        Navigation.navigate(section);\
        window.history.replaceState(\{\}, '', window.location.pathname);\
      \}\
    \} catch (err) \{\
      console.error('Init failed:', err);\
      Toast.show('Failed to initialize. Please refresh.', 'error');\
    \}\
  \},\
\
  async refreshAll() \{\
    await Sessions.load();\
    await Subjects.load();\
    Subjects.populateSelects();\
    Dashboard.render();\
    Logs.render();\
    await Subjects.render();\
    await Syllabus.render();\
    if (Navigation.currentSection === 'analytics') Analytics.render();\
  \}\
\};\
\
document.addEventListener('DOMContentLoaded', () => App.init());}