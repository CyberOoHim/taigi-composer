'use client';

import { Song } from '@/types/song';
import { PRESET_SONGS } from '@/lib/presets';

export const DB_NAME = 'taigi_composer_db';
export const DB_VERSION = 1;

export const STORES = {
  SONGS: 'songs',
  META: 'meta',
} as const;

export const META_KEYS = {
  ACTIVE_SONG_ID: 'active_song_id',
  LAST_ACTIVE_SONG: 'last_active_song',
  LOCALSTORAGE_MIGRATED: 'localstorage_migrated',
} as const;

export interface StoredSongRecord extends Song {
  updatedAt: number;
  isPresetModified?: boolean;
  originalPresetId?: string;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Check whether IndexedDB is supported in the current environment
 */
export function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * Open and initialize the IndexedDB database instance
 */
export function initDB(): Promise<IDBDatabase> {
  if (!isIndexedDBSupported()) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Store: 'songs' (all user-created songs & modified preset overrides)
      if (!db.objectStoreNames.contains(STORES.SONGS)) {
        const songStore = db.createObjectStore(STORES.SONGS, { keyPath: 'id' });
        songStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        songStore.createIndex('isPresetModified', 'isPresetModified', { unique: false });
        songStore.createIndex('originalPresetId', 'originalPresetId', { unique: false });
      }

      // 2. Store: 'meta' (key-value metadata: active_song_id, last_active_song, etc.)
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      // Clear cached instance if database connection unexpectedly closes
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      dbPromise = null;
      console.error('[IndexedDB] Failed to open database:', request.error);
      reject(request.error || new Error('Failed to open database'));
    };
  });

  return dbPromise;
}

/**
 * Helper to determine whether a given song differs from its original factory preset
 */
export function isSongModifiedFromPreset(song: Song): boolean {
  const preset = PRESET_SONGS.find(p => p.id === song.id);
  if (!preset) return false;

  try {
    if (
      song.title !== preset.title ||
      song.subtitle !== preset.subtitle ||
      song.composer !== preset.composer ||
      song.lyricist !== preset.lyricist ||
      song.key !== preset.key ||
      song.timeSignature !== preset.timeSignature ||
      song.bpm !== preset.bpm ||
      song.notesPerLine !== preset.notesPerLine ||
      song.description !== preset.description
    ) {
      return true;
    }

    return JSON.stringify(song.measures) !== JSON.stringify(preset.measures);
  } catch {
    return true;
  }
}

/**
 * Save a song (newly created or modified preset) into IndexedDB
 */
export async function saveSongToDB(
  song: Song,
  options?: { isPresetModified?: boolean; originalPresetId?: string }
): Promise<void> {
  if (!isIndexedDBSupported()) return;

  const db = await initDB();
  const isPreset = PRESET_SONGS.some(p => p.id === song.id);
  const isModified = options?.isPresetModified ?? (isPreset ? isSongModifiedFromPreset(song) : false);

  const record: StoredSongRecord = {
    ...song,
    updatedAt: Date.now(),
    isPresetModified: isModified,
    originalPresetId: isPreset ? song.id : options?.originalPresetId,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.SONGS], 'readwrite');
    const store = tx.objectStore(STORES.SONGS);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('[IndexedDB] Failed to save song:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Retrieve a song by ID from IndexedDB
 */
export async function getSongFromDB(id: string): Promise<Song | null> {
  if (!isIndexedDBSupported()) return null;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.SONGS], 'readonly');
    const store = tx.objectStore(STORES.SONGS);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result as StoredSongRecord | undefined;
      if (!result) {
        resolve(null);
        return;
      }
      resolve(result);
    };

    request.onerror = () => {
      console.error(`[IndexedDB] Failed to read song "${id}":`, request.error);
      reject(request.error);
    };
  });
}

/**
 * Retrieve all songs stored in IndexedDB, sorted by updatedAt descending (newest first)
 */
export async function getAllSongsFromDB(): Promise<Song[]> {
  if (!isIndexedDBSupported()) return [];

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.SONGS], 'readonly');
    const store = tx.objectStore(STORES.SONGS);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = (request.result as StoredSongRecord[]) || [];
      records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(records);
    };

    request.onerror = () => {
      console.error('[IndexedDB] Failed to get all songs:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Retrieve only custom user songs (not modified preset overrides)
 */
export async function getCustomSongsFromDB(): Promise<Song[]> {
  const all = await getAllSongsFromDB();
  const presetIds = new Set(PRESET_SONGS.map(p => p.id));
  return all.filter(s => !presetIds.has(s.id));
}

/**
 * Retrieve all modified preset songs
 */
export async function getModifiedPresetsFromDB(): Promise<Song[]> {
  const all = await getAllSongsFromDB();
  const presetIds = new Set(PRESET_SONGS.map(p => p.id));
  return all.filter(s => presetIds.has(s.id) && (s as StoredSongRecord).isPresetModified);
}

/**
 * Get set of preset IDs that have user modifications in IndexedDB
 */
export async function getModifiedPresetIds(): Promise<Set<string>> {
  const modifiedPresets = await getModifiedPresetsFromDB();
  return new Set(modifiedPresets.map(p => p.id));
}

/**
 * Delete a song from IndexedDB
 */
export async function deleteSongFromDB(id: string): Promise<void> {
  if (!isIndexedDBSupported()) return;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.SONGS], 'readwrite');
    const store = tx.objectStore(STORES.SONGS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error(`[IndexedDB] Failed to delete song "${id}":`, request.error);
      reject(request.error);
    };
  });
}

/**
 * Reset a preset song to factory default (removes user modification from IndexedDB)
 */
export async function resetPresetToFactory(presetId: string): Promise<Song | null> {
  const original = PRESET_SONGS.find(p => p.id === presetId);
  if (!original) return null;

  await deleteSongFromDB(presetId);
  return original;
}

/**
 * Save current active song snapshot and ID to meta store
 */
export async function saveActiveSongToDB(song: Song): Promise<void> {
  if (!isIndexedDBSupported()) return;

  // Also ensure it is saved in the songs store
  await saveSongToDB(song);

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.META], 'readwrite');
    const store = tx.objectStore(STORES.META);

    store.put({ key: META_KEYS.ACTIVE_SONG_ID, value: song.id });
    const req = store.put({ key: META_KEYS.LAST_ACTIVE_SONG, value: song });

    req.onsuccess = () => resolve();
    req.onerror = () => {
      console.error('[IndexedDB] Failed to save active song metadata:', req.error);
      reject(req.error);
    };
  });
}

/**
 * Retrieve the last active song from IndexedDB
 */
export async function getActiveSongFromDB(): Promise<Song | null> {
  if (!isIndexedDBSupported()) return null;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.META, STORES.SONGS], 'readonly');
    const metaStore = tx.objectStore(STORES.META);
    const idReq = metaStore.get(META_KEYS.ACTIVE_SONG_ID);

    idReq.onsuccess = () => {
      const activeId = idReq.result?.value as string | undefined;
      if (activeId) {
        const songStore = tx.objectStore(STORES.SONGS);
        const songReq = songStore.get(activeId);
        songReq.onsuccess = () => {
          if (songReq.result) {
            resolve(songReq.result as Song);
            return;
          }
          // Fallback to last_active_song snapshot if not found in songs store
          const snapshotReq = metaStore.get(META_KEYS.LAST_ACTIVE_SONG);
          snapshotReq.onsuccess = () => {
            resolve((snapshotReq.result?.value as Song) || null);
          };
          snapshotReq.onerror = () => resolve(null);
        };
        songReq.onerror = () => resolve(null);
      } else {
        // Try fallback snapshot
        const snapshotReq = metaStore.get(META_KEYS.LAST_ACTIVE_SONG);
        snapshotReq.onsuccess = () => {
          resolve((snapshotReq.result?.value as Song) || null);
        };
        snapshotReq.onerror = () => resolve(null);
      }
    };

    idReq.onerror = () => {
      console.error('[IndexedDB] Failed to get active song ID:', idReq.error);
      reject(idReq.error);
    };
  });
}

/**
 * Automatically migrate any legacy songs from localStorage into IndexedDB on first load
 */
export async function migrateLocalStorageToDB(): Promise<{ migratedSongs: number }> {
  if (!isIndexedDBSupported() || typeof window === 'undefined') {
    return { migratedSongs: 0 };
  }

  try {
    const db = await initDB();

    // Check if migration has already been executed
    const alreadyMigrated = await new Promise<boolean>((resolve) => {
      const tx = db.transaction([STORES.META], 'readonly');
      const store = tx.objectStore(STORES.META);
      const req = store.get(META_KEYS.LOCALSTORAGE_MIGRATED);
      req.onsuccess = () => resolve(Boolean(req.result?.value));
      req.onerror = () => resolve(false);
    });

    if (alreadyMigrated) {
      return { migratedSongs: 0 };
    }

    let count = 0;

    // 1. Read custom library from localStorage
    const rawLibrary = localStorage.getItem('taigi_composer_custom_library');
    if (rawLibrary) {
      try {
        const parsed = JSON.parse(rawLibrary);
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            if (s && s.id && Array.isArray(s.measures)) {
              await saveSongToDB(s);
              count++;
            }
          }
        }
      } catch (err) {
        console.warn('[IndexedDB] Failed to parse custom library during migration:', err);
      }
    }

    // 2. Read current active song from localStorage if present
    const rawCurrent = localStorage.getItem('taigi_composer_current_song');
    if (rawCurrent) {
      try {
        const parsed = JSON.parse(rawCurrent);
        if (parsed && parsed.id && Array.isArray(parsed.measures)) {
          await saveSongToDB(parsed);
          await saveActiveSongToDB(parsed);
          count++;
        }
      } catch (err) {
        console.warn('[IndexedDB] Failed to parse current song during migration:', err);
      }
    }

    // 3. Mark migration as complete in meta store
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORES.META], 'readwrite');
      const store = tx.objectStore(STORES.META);
      const req = store.put({ key: META_KEYS.LOCALSTORAGE_MIGRATED, value: true, timestamp: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (count > 0) {
      console.info(`[IndexedDB] Successfully migrated ${count} song(s) from localStorage.`);
    }

    return { migratedSongs: count };
  } catch (err) {
    console.error('[IndexedDB] Error during localStorage migration:', err);
    return { migratedSongs: 0 };
  }
}
