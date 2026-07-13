/**
 * useClassStore — Classes loaded from IndexedDB cache.
 * Replaces 5 independent api.get('/classes') calls across pages.
 */

import { create } from 'zustand';
import { cache } from '../services/cache';
import { syncEngine } from '../services/syncEngine';

export interface ClassItem {
  _id: string;
  name: string;
  standard: string;
  academicYear: string;
  studentCount: number;
  isActive: boolean;
  updatedAt?: string;
}

interface ClassStore {
  classes: ClassItem[];
  isLoaded: boolean;
  loadFromCache: () => Promise<void>;
  init: () => () => void;
}

export const useClassStore = create<ClassStore>((set) => ({
  classes: [],
  isLoaded: false,

  loadFromCache: async () => {
    const classes = await cache.getAll<ClassItem>('classes');
    // Sort by name for consistent display
    classes.sort((a, b) => a.name.localeCompare(b.name));
    set({ classes, isLoaded: true });
  },

  init: () => {
    // Load immediately from IndexedDB
    useClassStore.getState().loadFromCache();

    // Re-load whenever SyncEngine completes a sync
    const unsubscribe = syncEngine.onRefresh(() => {
      useClassStore.getState().loadFromCache();
    });

    return unsubscribe;
  },
}));
