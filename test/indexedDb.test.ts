import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PRESET_SONGS, createFreshSong } from '../lib/presets';
import {
  isSongModifiedFromPreset,
  saveSongToDB,
  getSongFromDB,
  getAllSongsFromDB,
  getCustomSongsFromDB,
  getModifiedPresetsFromDB,
  getModifiedPresetIds,
  resetPresetToFactory,
  saveActiveSongToDB,
  getActiveSongFromDB,
  migrateLocalStorageToDB,
} from '../lib/indexedDb';
import {
  getStoredAutosaveInterval,
  setStoredAutosaveInterval,
} from '../lib/storage';

// Minimal in-memory mock for IndexedDB
class MockIDBRequest {
  result: any = null;
  error: any = null;
  onsuccess: any = null;
  onerror: any = null;

  triggerSuccess(val: any) {
    this.result = val;
    if (this.onsuccess) this.onsuccess({ target: this });
  }

  triggerError(err: any) {
    this.error = err;
    if (this.onerror) this.onerror({ target: this });
  }
}

class MockIDBObjectStore {
  data = new Map<string, any>();

  get(key: string) {
    const req = new MockIDBRequest();
    setTimeout(() => req.triggerSuccess(this.data.get(key)), 0);
    return req;
  }

  put(val: any) {
    const key = val.id || val.key;
    this.data.set(key, JSON.parse(JSON.stringify(val)));
    const req = new MockIDBRequest();
    setTimeout(() => req.triggerSuccess(key), 0);
    return req;
  }

  getAll() {
    const req = new MockIDBRequest();
    setTimeout(() => req.triggerSuccess(Array.from(this.data.values())), 0);
    return req;
  }

  delete(key: string) {
    this.data.delete(key);
    const req = new MockIDBRequest();
    setTimeout(() => req.triggerSuccess(undefined), 0);
    return req;
  }

  createIndex() {}
}

class MockIDBDatabase {
  stores = new Map<string, MockIDBObjectStore>();
  objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };

  createObjectStore(name: string, _opts: any) {
    const s = new MockIDBObjectStore();
    this.stores.set(name, s);
    return s;
  }

  transaction(names: string | string[], _mode: string) {
    const name = Array.isArray(names) ? names[0] : names;
    const store = this.stores.get(name) || new MockIDBObjectStore();
    this.stores.set(name, store);
    return {
      objectStore: (n: string) => {
        if (!this.stores.has(n)) this.stores.set(n, new MockIDBObjectStore());
        return this.stores.get(n)!;
      },
    } as any;
  }
}

describe('Preset Modification Detection', () => {
  it('identifies an untouched preset as not modified', () => {
    const preset = PRESET_SONGS[0];
    assert.strictEqual(isSongModifiedFromPreset(preset), false);
  });

  it('detects note pitch modification on preset', () => {
    const modified = JSON.parse(JSON.stringify(PRESET_SONGS[0]));
    modified.measures[0].notes[0].pitch = 1;
    assert.strictEqual(isSongModifiedFromPreset(modified), true);
  });

  it('detects lyric modification on preset', () => {
    const modified = JSON.parse(JSON.stringify(PRESET_SONGS[0]));
    modified.measures[0].notes[0].lyric.hanlo = '風';
    assert.strictEqual(isSongModifiedFromPreset(modified), true);
  });

  it('detects tempo (bpm) modification on preset', () => {
    const modified = JSON.parse(JSON.stringify(PRESET_SONGS[0]));
    modified.bpm = 120;
    assert.strictEqual(isSongModifiedFromPreset(modified), true);
  });

  it('returns false for newly created custom song', () => {
    const fresh = createFreshSong('My Song');
    assert.strictEqual(isSongModifiedFromPreset(fresh), false);
  });
});

describe('IndexedDB Persistence Operations', () => {
  let mockDb: MockIDBDatabase;

  beforeEach(() => {
    mockDb = new MockIDBDatabase();
    mockDb.createObjectStore('songs', {});
    mockDb.createObjectStore('meta', {});

    const mockStorage = new Map<string, string>();
    (globalThis as any).window = {
      indexedDB: {
        open: () => {
          const req = new MockIDBRequest();
          setTimeout(() => {
            req.result = mockDb;
            req.triggerSuccess(mockDb);
          }, 0);
          return req;
        },
      },
      localStorage: {
        getItem: (k: string) => mockStorage.get(k) || null,
        setItem: (k: string, v: string) => mockStorage.set(k, v),
        removeItem: (k: string) => mockStorage.delete(k),
        clear: () => mockStorage.clear(),
      },
    };
    (globalThis as any).localStorage = (globalThis as any).window.localStorage;
  });

  it('saves and retrieves a newly created song', async () => {
    const fresh = createFreshSong('Test Composition');
    await saveSongToDB(fresh);

    const retrieved = await getSongFromDB(fresh.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.title, 'Test Composition');
    assert.strictEqual(retrieved?.measures.length, fresh.measures.length);
  });

  it('saves an edited preset and lists it under modified presets', async () => {
    const editedPreset = JSON.parse(JSON.stringify(PRESET_SONGS[0]));
    editedPreset.measures[0].notes[0].pitch = 3;

    await saveSongToDB(editedPreset);

    const modifiedPresets = await getModifiedPresetsFromDB();
    assert.strictEqual(modifiedPresets.length, 1);
    assert.strictEqual(modifiedPresets[0].id, PRESET_SONGS[0].id);

    const modifiedIds = await getModifiedPresetIds();
    assert.ok(modifiedIds.has(PRESET_SONGS[0].id));
  });

  it('differentiates custom songs from modified presets', async () => {
    const fresh = createFreshSong('Custom 1');
    await saveSongToDB(fresh);

    const customSongs = await getCustomSongsFromDB();
    assert.ok(customSongs.some(s => s.id === fresh.id));
    assert.strictEqual(customSongs.some(s => s.id === PRESET_SONGS[0].id), false);
  });

  it('resets a modified preset to factory default', async () => {
    const editedPreset = JSON.parse(JSON.stringify(PRESET_SONGS[0]));
    editedPreset.title = '雨夜花 (Modified)';
    await saveSongToDB(editedPreset);

    const pristine = await resetPresetToFactory(PRESET_SONGS[0].id);
    assert.ok(pristine);
    assert.strictEqual(pristine?.title, PRESET_SONGS[0].title);

    const modifiedIds = await getModifiedPresetIds();
    assert.strictEqual(modifiedIds.has(PRESET_SONGS[0].id), false);
  });

  it('saves and retrieves active song metadata', async () => {
    const song = createFreshSong('Active Working Song');
    await saveActiveSongToDB(song);

    const active = await getActiveSongFromDB();
    assert.ok(active);
    assert.strictEqual(active?.title, 'Active Working Song');
  });

  it('migrates legacy songs from localStorage into IndexedDB', async () => {
    const legacySong = createFreshSong('Legacy Local Song');
    localStorage.setItem('taigi_composer_custom_library', JSON.stringify([legacySong]));

    const result = await migrateLocalStorageToDB();
    assert.ok(result.migratedSongs >= 1);

    const retrieved = await getSongFromDB(legacySong.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.title, 'Legacy Local Song');
  });
});

describe('Autosave Interval Storage', () => {
  it('defaults to 0 (manual save)', () => {
    localStorage.clear();
    assert.strictEqual(getStoredAutosaveInterval(), 0);
  });

  it('persists and retrieves configured interval', () => {
    setStoredAutosaveInterval(300000);
    assert.strictEqual(getStoredAutosaveInterval(), 300000);

    setStoredAutosaveInterval(60000);
    assert.strictEqual(getStoredAutosaveInterval(), 60000);
  });
});
