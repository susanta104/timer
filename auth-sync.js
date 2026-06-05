/**
 * MBBS Study Command Center — Supabase Auth, Profile & Cloud Sync
 * Local-first: IndexedDB is primary; cloud syncs when online + signed in.
 */

'use strict';

const CloudSync = {
  client: null,
  user: null,
  profile: null,
  configured: false,
  syncing: false,
  syncTimer: null,
  status: 'offline', // offline | local | syncing | synced | error

  /** Check if Supabase credentials are configured. */
  isConfigured() {
    const cfg = window.MBBS_CONFIG || {};
    return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.includes('YOUR_PROJECT'));
  },

  /** Initialize Supabase client and restore session. */
  async init() {
    this.configured = this.isConfigured();
    this.updateStatusUI();

    if (!this.configured) {
      console.info('[CloudSync] Supabase not configured — local-only mode');
      return;
    }

    if (typeof supabase === 'undefined') {
      console.warn('[CloudSync] Supabase JS library not loaded');
      return;
    }

    const cfg = window.MBBS_CONFIG;
    this.client = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    const { data: { session }, error } = await this.client.auth.getSession();
    if (error) console.warn('[CloudSync] Session error:', error.message);

    if (session?.user) {
      this.user = session.user;
      await this.loadProfile();
      await this.fullSync();
    }

    this.client.auth.onAuthStateChange(async (event, session) => {
      this.user = session?.user || null;
      if (event === 'SIGNED_IN' && this.user) {
        await this.loadProfile();
        if (!this.profile?.college && !this.profile?.study_year) {
          AuthUI.showProfileSetup();
          const setupName = document.getElementById('setup-display-name');
          if (setupName && this.profile?.display_name) setupName.value = this.profile.display_name;
        } else {
          await this.fullSync();
        }
      }
      if (event === 'SIGNED_OUT') {
        this.profile = null;
        this.updateStatusUI();
        AuthUI.renderAccountSection();
      }
      AuthUI.renderAccountSection();
    });

    window.addEventListener('online', () => this.scheduleSync());
    this.updateStatusUI();
  },

  /** Load user profile from Supabase. */
  async loadProfile() {
    if (!this.user) return null;
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', this.user.id)
      .maybeSingle();

    if (error) {
      console.warn('[CloudSync] Profile load error:', error.message);
      return null;
    }

    this.profile = data;
    if (data?.exam_date && typeof Exam !== 'undefined') {
      await Database.setSetting('examDate', data.exam_date);
      Exam.cachedDate = data.exam_date;
    }
    AuthUI.renderProfileCard();
    return data;
  },

  /** Create or update profile after sign-up / edit. */
  async saveProfile({ displayName, college, studyYear, examDate }) {
    if (!this.user) throw new Error('Not signed in');

    const payload = {
      id: this.user.id,
      display_name: displayName.trim(),
      college: (college || '').trim(),
      study_year: (studyYear || '').trim(),
      exam_date: examDate || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.client.from('profiles').upsert(payload).select().single();
    if (error) throw error;

    this.profile = data;
    if (examDate) {
      await Database.setSetting('examDate', examDate);
      if (typeof Exam !== 'undefined') {
        Exam.cachedDate = examDate;
        Exam.renderAll();
      }
    }

    AuthUI.renderProfileCard();
    AuthUI.hideProfileSetup();
    Toast.show('Profile saved', 'success');
    return data;
  },

  /** Sign up with email and password. */
  async signUp(email, password, displayName) {
    const { data, error } = await this.client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } }
    });
    if (error) throw error;

    if (data.user && !data.session) {
      Toast.show('Check your email to confirm your account', 'info');
    } else if (data.user) {
      this.user = data.user;
      await this.loadProfile();
      AuthUI.showProfileSetup();
      const setupName = document.getElementById('setup-display-name');
      if (setupName) setupName.value = displayName.trim();
      await this.pushLocalToCloud();
    }
    AuthUI.hideAuthModal();
    return data;
  },

  /** Sign in with email and password. */
  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) throw error;
    this.user = data.user;
    AuthUI.hideAuthModal();
    Toast.show('Signed in — syncing data…', 'info');
    await this.loadProfile();
    await this.fullSync();
    return data;
  },

  /** Sign out. */
  async signOut() {
    if (this.client) await this.client.auth.signOut();
    this.user = null;
    this.profile = null;
    AuthUI.renderAccountSection();
    Toast.show('Signed out', 'info');
  },

  /** Schedule debounced sync (called after local DB changes). */
  scheduleSync() {
    if (!this.user || !navigator.onLine) return;
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.fullSync(), 1500);
  },

  /** Full bidirectional sync: pull cloud → merge → push local. */
  async fullSync() {
    if (!this.user || !navigator.onLine || this.syncing) return;
    this.syncing = true;
    this.setStatus('syncing');

    try {
      await this.pullFromCloud();
      await this.pushLocalToCloud();
      this.setStatus('synced');
      if (typeof App !== 'undefined') await App.refreshAll();
    } catch (err) {
      console.error('[CloudSync] Sync failed:', err);
      this.setStatus('error');
      Toast.show('Cloud sync failed — data saved locally', 'error');
    } finally {
      this.syncing = false;
    }
  },

  /** Pull all cloud data and merge into IndexedDB (newer updatedAt wins). */
  async pullFromCloud() {
    const uid = this.user.id;
    const [sessionsRes, subjectsRes, topicsRes, settingsRes] = await Promise.all([
      this.client.from('study_sessions').select('*').eq('user_id', uid),
      this.client.from('subjects').select('*').eq('user_id', uid),
      this.client.from('syllabus_topics').select('*').eq('user_id', uid),
      this.client.from('user_settings').select('*').eq('user_id', uid).maybeSingle()
    ]);

    if (sessionsRes.error) throw sessionsRes.error;
    if (subjectsRes.error) throw subjectsRes.error;
    if (topicsRes.error) throw topicsRes.error;

    // Merge subjects
    for (const remote of subjectsRes.data || []) {
      if (remote.deleted) {
        await Database.delete('subjects', remote.id).catch(() => {});
        continue;
      }
      const local = (await Database.getAll('subjects')).find((s) => s.id === remote.id);
      const remoteTs = new Date(remote.updated_at).getTime();
      if (!local || remoteTs >= (local.updatedAt || 0)) {
        await Database.put('subjects', {
          id: remote.id,
          name: remote.name,
          color: remote.color,
          isDefault: remote.is_default,
          updatedAt: remoteTs
        }, true);
      }
    }

    // Merge sessions
    for (const remote of sessionsRes.data || []) {
      if (remote.deleted) {
        await Database.delete('sessions', remote.id).catch(() => {});
        continue;
      }
      const local = (await Database.getAll('sessions')).find((s) => s.id === remote.id);
      const remoteTs = new Date(remote.updated_at).getTime();
      if (!local || remoteTs >= (local.updatedAt || 0)) {
        await Database.put('sessions', {
          id: remote.id,
          date: remote.session_date,
          subjectId: remote.subject_id,
          durationMinutes: remote.duration_minutes,
          notes: remote.notes || '',
          createdAt: remote.created_at,
          updatedAt: remoteTs
        }, true);
      }
    }

    // Merge topics
    for (const remote of topicsRes.data || []) {
      if (remote.deleted) {
        await Database.delete('topics', remote.id).catch(() => {});
        continue;
      }
      const local = (await Database.getAll('topics')).find((t) => t.id === remote.id);
      const remoteTs = new Date(remote.updated_at).getTime();
      if (!local || remoteTs >= (local.updatedAt || 0)) {
        await Database.put('topics', {
          id: remote.id,
          subjectId: remote.subject_id,
          name: remote.name,
          completed: remote.completed,
          createdAt: remote.created_at,
          updatedAt: remoteTs
        }, true);
      }
    }

    // Merge settings
    if (settingsRes.data?.settings) {
      const remoteTs = new Date(settingsRes.data.updated_at).getTime();
      const localTs = await Database.getSetting('settingsUpdatedAt', 0);
      if (remoteTs >= localTs) {
        for (const [key, value] of Object.entries(settingsRes.data.settings)) {
          await Database.setSetting(key, value, true);
        }
        await Database.setSetting('settingsUpdatedAt', remoteTs, true);
      }
    }
  },

  /** Push all local data to Supabase. */
  async pushLocalToCloud() {
    const uid = this.user.id;
    const [sessions, subjects, topics, settingsRows] = await Promise.all([
      Database.getAll('sessions'),
      Database.getAll('subjects'),
      Database.getAll('topics'),
      Database.getAll('settings')
    ]);

    const settingsObj = {};
    settingsRows.forEach((s) => {
      if (s.key !== 'settingsUpdatedAt') settingsObj[s.key] = s.value;
    });

    const subjectRows = subjects.map((s) => ({
      id: s.id,
      user_id: uid,
      name: s.name,
      color: s.color,
      is_default: Boolean(s.isDefault),
      updated_at: new Date(s.updatedAt || Date.now()).toISOString(),
      deleted: false
    }));

    const sessionRows = sessions.map((s) => ({
      id: s.id,
      user_id: uid,
      session_date: s.date,
      subject_id: s.subjectId,
      duration_minutes: s.durationMinutes,
      notes: s.notes || '',
      created_at: s.createdAt || Date.now(),
      updated_at: new Date(s.updatedAt || Date.now()).toISOString(),
      deleted: false
    }));

    const topicRows = topics.map((t) => ({
      id: t.id,
      user_id: uid,
      subject_id: t.subjectId,
      name: t.name,
      completed: Boolean(t.completed),
      created_at: t.createdAt || Date.now(),
      updated_at: new Date(t.updatedAt || Date.now()).toISOString(),
      deleted: false
    }));

    if (subjectRows.length) {
      const { error } = await this.client.from('subjects').upsert(subjectRows);
      if (error) throw error;
    }
    if (sessionRows.length) {
      const { error } = await this.client.from('study_sessions').upsert(sessionRows);
      if (error) throw error;
    }
    if (topicRows.length) {
      const { error } = await this.client.from('syllabus_topics').upsert(topicRows);
      if (error) throw error;
    }

    const settingsUpdatedAt = await Database.getSetting('settingsUpdatedAt', Date.now());
    const { error: settingsError } = await this.client.from('user_settings').upsert({
      user_id: uid,
      settings: settingsObj,
      updated_at: new Date(settingsUpdatedAt).toISOString()
    });
    if (settingsError) throw settingsError;

    // Sync exam date to profile
    const examDate = await Database.getSetting('examDate', '');
    if (this.profile) {
      await this.client.from('profiles').update({
        exam_date: examDate || null,
        updated_at: new Date().toISOString()
      }).eq('id', uid);
    }
  },

  /** Mark a record as deleted in cloud (soft delete). */
  async softDelete(table, id) {
    if (!this.user || !navigator.onLine) return;
    const uid = this.user.id;
    const map = {
      sessions: 'study_sessions',
      subjects: 'subjects',
      topics: 'syllabus_topics'
    };
    const cloudTable = map[table];
    if (!cloudTable) return;

    await this.client.from(cloudTable).upsert({
      id,
      user_id: uid,
      deleted: true,
      updated_at: new Date().toISOString(),
      ...(table === 'sessions' ? { session_date: Utils.toDateString(), subject_id: 'deleted', duration_minutes: 0, created_at: Date.now() } : {}),
      ...(table === 'subjects' ? { name: 'deleted', color: '#000', is_default: false } : {}),
      ...(table === 'topics' ? { subject_id: 'deleted', name: 'deleted', completed: false } : {})
    });
  },

  setStatus(status) {
    this.status = status;
    this.updateStatusUI();
  },

  updateStatusUI() {
    const el = document.getElementById('sync-status');
    if (!el) return;

    if (!this.configured) {
      el.textContent = 'Local only';
      el.className = 'sync-badge sync-local';
      return;
    }
    if (!this.user) {
      el.textContent = 'Not signed in';
      el.className = 'sync-badge sync-guest';
      return;
    }
    const map = {
      syncing: ['Syncing…', 'sync-syncing'],
      synced: ['Synced', 'sync-ok'],
      error: ['Sync error', 'sync-error'],
      offline: ['Offline', 'sync-offline']
    };
    const [text, cls] = map[this.status] || ['Signed in', 'sync-ok'];
    el.textContent = text;
    el.className = `sync-badge ${cls}`;
  }
};

/* ------------------------------------------------------------------ */
/* Auth & Profile UI                                                  */
/* ------------------------------------------------------------------ */

const AuthUI = {
  authMode: 'signin',

  init() {
    this.bindEvents();
    this.renderAccountSection();
  },

  renderAccountSection() {
    const guest = document.getElementById('auth-guest');
    const signedIn = document.getElementById('auth-signed-in');
    const profileCard = document.getElementById('profile-card');
    if (!guest || !signedIn) return;

    const isLoggedIn = Boolean(CloudSync.user);
    guest.hidden = isLoggedIn;
    signedIn.hidden = !isLoggedIn;

    if (isLoggedIn) {
      document.getElementById('account-email').textContent = CloudSync.user.email || '';
      this.renderProfileCard();
    }
    if (profileCard) profileCard.hidden = !isLoggedIn;
  },

  renderProfileCard() {
    const p = CloudSync.profile;
    const nameEl = document.getElementById('profile-display-name');
    const metaEl = document.getElementById('profile-meta');
    const avatarEl = document.getElementById('profile-avatar');

    if (!nameEl) return;

    const name = p?.display_name || 'Student';
    nameEl.textContent = name;
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

    const parts = [];
    if (p?.college) parts.push(p.college);
    if (p?.study_year) parts.push(p.study_year);
    if (metaEl) metaEl.textContent = parts.join(' · ') || 'Complete your profile below';
  },

  showAuthModal(mode = 'signin') {
    this.authMode = mode;
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('auth-modal-title');
    const submit = document.getElementById('auth-submit');
    const nameGroup = document.getElementById('auth-name-group');

    if (title) title.textContent = mode === 'signup' ? 'Create Account' : 'Sign In';
    if (submit) submit.textContent = mode === 'signup' ? 'Create Account' : 'Sign In';
    if (nameGroup) nameGroup.hidden = mode !== 'signup';
    const nameInput = document.getElementById('auth-display-name');
    if (nameInput) nameInput.required = mode === 'signup';
    const switchBtn = document.getElementById('auth-switch');
    if (switchBtn) switchBtn.textContent = mode === 'signup' ? 'Already have an account?' : 'Create account instead';

    document.getElementById('auth-error').hidden = true;
    modal?.showModal();
  },

  hideAuthModal() {
    document.getElementById('auth-modal')?.close();
    document.getElementById('auth-form')?.reset();
  },

  showProfileSetup() {
    document.getElementById('profile-setup-modal')?.showModal();
  },

  hideProfileSetup() {
    document.getElementById('profile-setup-modal')?.close();
  },

  showProfileEdit() {
    const p = CloudSync.profile || {};
    document.getElementById('edit-display-name').value = p.display_name || '';
    document.getElementById('edit-college').value = p.college || '';
    document.getElementById('edit-study-year').value = p.study_year || '';
    document.getElementById('edit-exam-date').value = p.exam_date || Exam.cachedDate || '';
    document.getElementById('profile-edit-modal')?.showModal();
  },

  bindEvents() {
    document.getElementById('btn-sign-in')?.addEventListener('click', () => this.showAuthModal('signin'));
    document.getElementById('btn-sign-up')?.addEventListener('click', () => this.showAuthModal('signup'));
    document.getElementById('auth-switch')?.addEventListener('click', () => {
      this.showAuthModal(this.authMode === 'signin' ? 'signup' : 'signin');
    });

    document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      const name = document.getElementById('auth-display-name').value;
      const errEl = document.getElementById('auth-error');

      try {
        if (this.authMode === 'signup') {
          if (!name.trim()) throw new Error('Display name is required');
          if (password.length < 6) throw new Error('Password must be at least 6 characters');
          await CloudSync.signUp(email, password, name);
        } else {
          await CloudSync.signIn(email, password);
        }
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || 'Authentication failed';
          errEl.hidden = false;
        }
      }
    });

    document.getElementById('btn-sign-out')?.addEventListener('click', () => CloudSync.signOut());
    document.getElementById('btn-sync-now')?.addEventListener('click', () => CloudSync.fullSync());
    document.getElementById('btn-edit-profile')?.addEventListener('click', () => this.showProfileEdit());

    document.getElementById('profile-setup-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await CloudSync.saveProfile({
          displayName: document.getElementById('setup-display-name').value,
          college: document.getElementById('setup-college').value,
          studyYear: document.getElementById('setup-study-year').value,
          examDate: document.getElementById('setup-exam-date').value || null
        });
        await CloudSync.pushLocalToCloud();
        await CloudSync.fullSync();
        await App.refreshAll();
      } catch (err) {
        Toast.show(err.message || 'Failed to save profile', 'error');
      }
    });

    document.getElementById('profile-edit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await CloudSync.saveProfile({
          displayName: document.getElementById('edit-display-name').value,
          college: document.getElementById('edit-college').value,
          studyYear: document.getElementById('edit-study-year').value,
          examDate: document.getElementById('edit-exam-date').value || null
        });
        document.getElementById('profile-edit-modal')?.close();
        await CloudSync.scheduleSync();
      } catch (err) {
        Toast.show(err.message || 'Failed to update profile', 'error');
      }
    });
  }
};
