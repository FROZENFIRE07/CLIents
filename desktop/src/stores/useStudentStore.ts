/**
 * useStudentStore — Students loaded from IndexedDB, indexed by classId.
 */

import { create } from 'zustand';
import { cache } from '../services/cache';
import { syncEngine } from '../services/syncEngine';

export interface Student {
  _id: string;
  rollNo: number;
  fullName: string;
  parentName: string;
  parentPhone: string;
  classId: string;
  status: 'active' | 'archived';
  updatedAt?: string;
}

interface StudentStore {
  students: Student[];
  selectedClassId: string | null;
  isLoaded: boolean;
  loadByClass: (classId: string) => Promise<void>;
  init: () => () => void;
}

export const useStudentStore = create<StudentStore>((set, get) => ({
  students: [],
  selectedClassId: null,
  isLoaded: false,

  loadByClass: async (classId: string) => {
    set({ selectedClassId: classId });
    const students = await cache.getByIndex<Student>('students', 'classId', classId);
    // Only active students, sorted by roll number
    const active = students
      .filter((s) => s.status === 'active')
      .sort((a, b) => a.rollNo - b.rollNo);
    set({ students: active, isLoaded: true });
  },

  init: () => {
    // Re-load current class when sync completes
    const unsubscribe = syncEngine.onRefresh(() => {
      const { selectedClassId } = get();
      if (selectedClassId) {
        get().loadByClass(selectedClassId);
      }
    });
    return unsubscribe;
  },
}));
