/**
 * useNotificationStore — Notification logs and stats from IndexedDB.
 */

import { create } from 'zustand';
import { cache } from '../services/cache';
import { syncEngine } from '../services/syncEngine';

export interface NotificationItem {
  _id: string;
  sessionId: string;
  studentId: string;
  parentPhone: string;
  message: string;
  attendanceDate: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'expired';
  retryCount: number;
  errorReason?: string;
  queuedAt: string;
  sentAt?: string;
  updatedAt?: string;
}

export interface NotifStats {
  queued: number;
  sending: number;
  sent: number;
  failed: number;
  expired: number;
}

interface NotificationStore {
  notifications: NotificationItem[];
  stats: NotifStats;
  isLoaded: boolean;
  /** Client-side filter + pagination */
  statusFilter: string;
  page: number;
  filtered: NotificationItem[];
  setFilter: (status: string) => void;
  setPage: (page: number) => void;
  loadFromCache: () => Promise<void>;
  init: () => () => void;
}

const defaultStats: NotifStats = { queued: 0, sending: 0, sent: 0, failed: 0, expired: 0 };

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  stats: defaultStats,
  isLoaded: false,
  statusFilter: '',
  page: 1,
  filtered: [],

  setFilter: (status: string) => {
    set({ statusFilter: status, page: 1 });
    const { notifications } = get();
    const filtered = status
      ? notifications.filter((n) => n.status === status)
      : notifications;
    set({ filtered });
  },

  setPage: (page: number) => set({ page }),

  loadFromCache: async () => {
    const [notifications, stats] = await Promise.all([
      cache.getAll<NotificationItem>('notifications'),
      cache.getMeta<NotifStats>('notifStats'),
    ]);

    // Sort by queuedAt descending (newest first)
    notifications.sort(
      (a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime()
    );

    const { statusFilter } = get();
    const filtered = statusFilter
      ? notifications.filter((n) => n.status === statusFilter)
      : notifications;

    set({
      notifications,
      stats: stats || defaultStats,
      filtered,
      isLoaded: true,
    });
  },

  init: () => {
    get().loadFromCache();

    const unsubscribe = syncEngine.onRefresh(() => {
      get().loadFromCache();
    });

    return unsubscribe;
  },
}));
