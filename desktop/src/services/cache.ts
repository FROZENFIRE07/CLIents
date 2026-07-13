/**
 * cache.ts — IndexedDB wrapper for offline-first local storage.
 *
 * The UI never reads from the API. It reads from here.
 * SyncEngine writes here after fetching deltas from the server.
 *
 * Database: 'cmslite-cache'
 * Stores:  classes, students, sessions, exams, marks, notifications, _meta
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'cmslite-cache';
const DB_VERSION = 1;

interface MetaEntry {
  key: string;
  value: unknown;
}

// ── Open / Create database ──────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Entity stores — keyPath is MongoDB _id
        if (!db.objectStoreNames.contains('classes')) {
          db.createObjectStore('classes', { keyPath: '_id' });
        }

        if (!db.objectStoreNames.contains('students')) {
          const store = db.createObjectStore('students', { keyPath: '_id' });
          store.createIndex('classId', 'classId', { unique: false });
        }

        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: '_id' });
          store.createIndex('classId', 'classId', { unique: false });
        }

        if (!db.objectStoreNames.contains('exams')) {
          const store = db.createObjectStore('exams', { keyPath: '_id' });
          store.createIndex('classId', 'classId', { unique: false });
        }

        if (!db.objectStoreNames.contains('marks')) {
          const store = db.createObjectStore('marks', { keyPath: '_id' });
          store.createIndex('examId', 'examId', { unique: false });
        }

        if (!db.objectStoreNames.contains('notifications')) {
          db.createObjectStore('notifications', { keyPath: '_id' });
        }

        // Meta store — sync timestamps, dashboard analytics, etc.
        if (!db.objectStoreNames.contains('_meta')) {
          db.createObjectStore('_meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// ── Generic helpers ─────────────────────────────────────────────

/** Get all records from a store */
async function getAll<T = unknown>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return db.getAll(storeName) as Promise<T[]>;
}

/** Get records by an index value */
async function getByIndex<T = unknown>(
  storeName: string,
  indexName: string,
  value: string
): Promise<T[]> {
  const db = await getDB();
  return db.getAllFromIndex(storeName, indexName, value) as Promise<T[]>;
}

/** Bulk upsert — put many records into a store */
async function putMany(storeName: string, items: unknown[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  for (const item of items) {
    tx.store.put(item);
  }
  await tx.done;
}

/** Clear a single store */
async function clearStore(storeName: string): Promise<void> {
  const db = await getDB();
  await db.clear(storeName);
}

/** Wipe the entire database — used on logout */
async function clearAll(): Promise<void> {
  const db = await getDB();
  const storeNames = Array.from(db.objectStoreNames);
  for (const name of storeNames) {
    await db.clear(name);
  }
}

// ── Meta helpers (sync timestamp, dashboard data, etc.) ─────────

async function getMeta<T = unknown>(key: string): Promise<T | null> {
  const db = await getDB();
  const entry = (await db.get('_meta', key)) as MetaEntry | undefined;
  return entry ? (entry.value as T) : null;
}

async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('_meta', { key, value });
}

// ── Exports ─────────────────────────────────────────────────────

export const cache = {
  getAll,
  getByIndex,
  putMany,
  clearStore,
  clearAll,
  getMeta,
  setMeta,
  // Alias for consistency with syncEngine
  putMeta: setMeta,
};

export default cache;
