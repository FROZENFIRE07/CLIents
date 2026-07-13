/**
 * useDashboardStore — Dashboard analytics + attendance sessions from IndexedDB.
 * Used by both DashboardPage and LandingPage.
 */

import { create } from 'zustand';
import { cache } from '../services/cache';
import { syncEngine } from '../services/syncEngine';

export interface DashboardAnalytics {
  totalStudents: number;
  averageAttendance: number;
  totalSessions: number;
  msgsSent: number;
  pendingAttendance: number;
  upcomingExams: number;
}

export interface AttendanceSession {
  _id: string;
  classId: string;
  date: string;
  status: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  createdAt?: string;
  updatedAt?: string;
}

interface NotifStats {
  queued: number;
  sending: number;
  sent: number;
  failed: number;
  expired: number;
}

interface DashboardStore {
  analytics: DashboardAnalytics | null;
  notifStats: NotifStats | null;
  sessions: AttendanceSession[];
  isLoaded: boolean;
  loadFromCache: () => Promise<void>;
  init: () => () => void;
}

const defaultAnalytics: DashboardAnalytics = {
  totalStudents: 0,
  averageAttendance: 0,
  totalSessions: 0,
  msgsSent: 0,
  pendingAttendance: 0,
  upcomingExams: 0,
};

export const useDashboardStore = create<DashboardStore>((set) => ({
  analytics: null,
  notifStats: null,
  sessions: [],
  isLoaded: false,

  loadFromCache: async () => {
    const [analytics, notifStats, sessions] = await Promise.all([
      cache.getMeta<DashboardAnalytics>('dashboard'),
      cache.getMeta<NotifStats>('notifStats'),
      cache.getAll<AttendanceSession>('sessions'),
    ]);

    // Sort sessions by date descending
    sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    set({
      analytics: analytics || defaultAnalytics,
      notifStats: notifStats || { queued: 0, sending: 0, sent: 0, failed: 0, expired: 0 },
      sessions,
      isLoaded: true,
    });
  },

  init: () => {
    useDashboardStore.getState().loadFromCache();

    const unsubscribe = syncEngine.onRefresh(() => {
      useDashboardStore.getState().loadFromCache();
    });

    return unsubscribe;
  },
}));
