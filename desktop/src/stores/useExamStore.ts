/**
 * useExamStore — Exams and marks from IndexedDB, indexed by classId/examId.
 */

import { create } from 'zustand';
import { cache } from '../services/cache';
import { syncEngine } from '../services/syncEngine';

export interface Exam {
  _id: string;
  name: string;
  classId: string;
  subject: string;
  maxMarks: number;
  date: string;
  updatedAt?: string;
}

export interface Mark {
  _id: string;
  examId: string;
  studentId: string;
  marksObtained: number;
  updatedAt?: string;
}

interface ExamStore {
  exams: Exam[];
  marks: Mark[];
  selectedClassId: string | null;
  isLoaded: boolean;
  loadByClass: (classId: string) => Promise<void>;
  loadMarksByExam: (examId: string) => Promise<void>;
  init: () => () => void;
}

export const useExamStore = create<ExamStore>((set, get) => ({
  exams: [],
  marks: [],
  selectedClassId: null,
  isLoaded: false,

  loadByClass: async (classId: string) => {
    set({ selectedClassId: classId });
    const exams = await cache.getByIndex<Exam>('exams', 'classId', classId);
    exams.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    set({ exams, isLoaded: true });
  },

  loadMarksByExam: async (examId: string) => {
    const marks = await cache.getByIndex<Mark>('marks', 'examId', examId);
    set({ marks });
  },

  init: () => {
    const unsubscribe = syncEngine.onRefresh(() => {
      const { selectedClassId } = get();
      if (selectedClassId) {
        get().loadByClass(selectedClassId);
      }
    });
    return unsubscribe;
  },
}));
