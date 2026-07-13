/**
 * useSyncStatus — Reactive sync status for UI.
 * Drives the SystemStatus component in the sidebar footer.
 */

import { create } from 'zustand';
import { syncEngine, type SyncStatus } from '../services/syncEngine';

interface SyncStatusState {
  status: SyncStatus;
  lastSync: Date | null;
  freshnessLabel: string;
  init: () => () => void;
}

function computeFreshness(lastSync: Date | null): string {
  if (!lastSync) return 'Never synced';
  const diff = Date.now() - lastSync.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 30) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'Yesterday';
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
  status: 'idle',
  lastSync: null,
  freshnessLabel: 'Never synced',

  init: () => {
    // Subscribe to SyncEngine status changes
    const unsubscribe = syncEngine.subscribe((status, lastSync) => {
      set({
        status,
        lastSync,
        freshnessLabel: computeFreshness(lastSync),
      });
    });

    // Update freshness label every 15s (for "2 min ago" → "3 min ago")
    const interval = setInterval(() => {
      set((state) => ({
        freshnessLabel: computeFreshness(state.lastSync),
      }));
    }, 15_000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  },
}));
