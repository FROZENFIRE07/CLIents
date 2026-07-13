/**
 * syncEngine.ts — Background sync orchestrator.
 *
 * Bridges: API ↔ IndexedDB cache ↔ Zustand stores.
 *
 * Startup flow:
 *   1. Read cache → UI renders instantly with cached data
 *   2. If first sync ever → GET /bootstrap (one request, all data + user)
 *   3. If returning user → GET /sync?since=... (delta only)
 *   4. Periodic delta sync every 60s
 *   5. Auto-sync on reconnect
 *
 * The user never waits for the network. Cache is truth until sync updates it.
 */

import api from './api';
import { cache } from './cache';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';
export type StatusListener = (status: SyncStatus, lastSync: Date | null) => void;

// Listeners that stores can register to be notified after each sync
type RefreshCallback = () => void;

class SyncEngine {
  private status: SyncStatus = 'idle';
  private lastSync: Date | null = null;
  private statusListeners = new Set<StatusListener>();
  private refreshCallbacks = new Set<RefreshCallback>();
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  // ── Lifecycle ───────────────────────────────────────────────

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Restore last sync timestamp from IndexedDB
    const saved = await cache.getMeta<string>('lastSyncTimestamp');
    if (saved) this.lastSync = new Date(saved);

    // Network listeners
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Initial state
    if (!navigator.onLine) {
      this.setStatus('offline');
    } else {
      // Background sync — don't await, let UI render cached data immediately
      this.syncNow();
    }

    // Periodic sync every 60s
    this.syncIntervalId = setInterval(() => {
      if (navigator.onLine && this.status !== 'syncing') {
        this.syncNow();
      }
    }, 60_000);
  }

  stop() {
    this.isRunning = false;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  // ── Sync logic ──────────────────────────────────────────────

  async syncNow(): Promise<boolean> {
    if (!navigator.onLine || this.status === 'syncing') return false;

    this.setStatus('syncing');

    try {
      let result: any;

      if (!this.lastSync) {
        // ── First sync: use /bootstrap (one request, everything) ──
        console.log('[SyncEngine] First sync → GET /bootstrap');
        const { data } = await api.get('/bootstrap');
        result = data.data;

        // Cache the user object too
        if (result.user) {
          localStorage.setItem('user', JSON.stringify(result.user));
        }
      } else {
        // ── Delta sync: only changed records ──
        const since = this.lastSync.toISOString();
        const { data } = await api.get(`/sync?since=${since}`);
        result = data.data;
      }

      // Upsert all records into IndexedDB
      const writes: Promise<void>[] = [];
      if (result.classes?.length) writes.push(cache.putMany('classes', result.classes));
      if (result.students?.length) writes.push(cache.putMany('students', result.students));
      if (result.sessions?.length) writes.push(cache.putMany('sessions', result.sessions));
      if (result.exams?.length) writes.push(cache.putMany('exams', result.exams));
      if (result.marks?.length) writes.push(cache.putMany('marks', result.marks));
      if (result.notifications?.length) writes.push(cache.putMany('notifications', result.notifications));

      // Dashboard analytics + notification stats → _meta
      if (result.dashboard) writes.push(cache.setMeta('dashboard', result.dashboard));
      if (result.notifStats) writes.push(cache.setMeta('notifStats', result.notifStats));

      await Promise.all(writes);

      // Update sync timestamp
      const serverTime = result.serverTimestamp || new Date().toISOString();
      this.lastSync = new Date(serverTime);
      await cache.setMeta('lastSyncTimestamp', serverTime);

      this.setStatus('idle');

      // Notify all stores to re-read from cache
      this.refreshCallbacks.forEach((cb) => {
        try { cb(); } catch { /* don't let one store crash others */ }
      });

      return true;
    } catch (err) {
      console.warn('[SyncEngine] Sync failed:', err);
      this.setStatus(navigator.onLine ? 'error' : 'offline');
      return false;
    }
  }

  // ── Network handlers ────────────────────────────────────────

  private handleOnline = () => {
    console.log('[SyncEngine] Network online — syncing...');
    this.syncNow();
  };

  private handleOffline = () => {
    console.log('[SyncEngine] Network offline');
    this.setStatus('offline');
  };

  // ── Status management ───────────────────────────────────────

  private setStatus(status: SyncStatus) {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(this.status, this.lastSync));
  }

  /** Subscribe to status changes (used by useSyncStatus store) */
  subscribe(listener: StatusListener) {
    this.statusListeners.add(listener);
    // Fire immediately with current state
    listener(this.status, this.lastSync);
    return () => { this.statusListeners.delete(listener); };
  }

  /** Register a refresh callback (used by Zustand stores to re-read cache) */
  onRefresh(callback: RefreshCallback) {
    this.refreshCallbacks.add(callback);
    return () => { this.refreshCallbacks.delete(callback); };
  }

  getStatus() { return this.status; }
  getLastSync() { return this.lastSync; }
}

export const syncEngine = new SyncEngine();
export default syncEngine;
