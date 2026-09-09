import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getChordNotes, getEffectiveMeasureChords, getMeasureChords, formatMeasureChords } from '@/lib/taigiUtils';
import { getStoredChordEnabled, setStoredChordEnabled, getStoredBackingVolume, setStoredBackingVolume, STORAGE_KEYS } from '@/lib/storage';
import { Song, Measure } from '@/types/song';

function makeMockSong(measures: Measure[], key = 'C'): Song {
  return {
    id: 'test-song',
    title: 'Test Song',
    composer: 'Test Composer',
    key: key as any,
    bpm: 90,
    timeSignature: '4/4',
    measures,
  };
}

describe('Chord Playback & taigiUtils: getChordNotes', () => {
  it('computes accurate frequencies for C Major triad', () => {
    const freqs = getChordNotes('C');
    assert.ok(freqs.length >= 3, 'C chord should have at least 3 notes');
    // Root bass note should be low frequency (around C2: 65.4Hz)
    assert.ok(freqs[0] > 60 && freqs[0] < 70, `Bass frequency should be around C2 (65.4Hz), got ${freqs[0]}`);
  });

  it('computes accurate frequencies for Am minor chord', () => {
    const freqs = getChordNotes('Am');
    assert.ok(freqs.length >= 3, 'Am chord should have at least 3 notes');
    // Root bass note should be A1/A2
    assert.ok(freqs[0] > 50 && freqs[0] < 120, `Bass note in expected range, got ${freqs[0]}`);
  });

  it('computes accurate frequencies for G7 dominant seventh chord', () => {
    const freqs = getChordNotes('G7');
    assert.ok(freqs.length >= 4, 'G7 chord should have at least 4 harmonic notes');
  });

  it('handles empty or unrecognized chords gracefully', () => {
    const freqs = getChordNotes('');
    assert.deepStrictEqual(freqs, []);
  });
});

describe('Effective Measure Chords: getEffectiveMeasureChords', () => {
  it('returns direct chord on measure if present', () => {
    const song = makeMockSong([
      { id: 'm1', measureNumber: 1, chord: 'F', notes: [] },
      { id: 'm2', measureNumber: 2, chord: 'G', notes: [] },
    ]);
    const chordsM1 = getEffectiveMeasureChords(song, 0);
    const chordsM2 = getEffectiveMeasureChords(song, 1);
    assert.deepStrictEqual(chordsM1, ['F']);
    assert.deepStrictEqual(chordsM2, ['G']);
  });

  it('propagates harmonic continuation to measures without explicit chords', () => {
    const song = makeMockSong([
      { id: 'm1', measureNumber: 1, chord: 'C', notes: [] },
      { id: 'm2', measureNumber: 2, notes: [] }, // no chord
      { id: 'm3', measureNumber: 3, notes: [] }, // no chord
      { id: 'm4', measureNumber: 4, chord: 'G', notes: [] },
    ]);
    assert.deepStrictEqual(getEffectiveMeasureChords(song, 0), ['C']);
    assert.deepStrictEqual(getEffectiveMeasureChords(song, 1), ['C']); // sustained from m1
    assert.deepStrictEqual(getEffectiveMeasureChords(song, 2), ['C']); // sustained from m1
    assert.deepStrictEqual(getEffectiveMeasureChords(song, 3), ['G']); // new chord at m4
  });

  it('respects explicit N.C. (No Chord) and silences chord playback', () => {
    const song = makeMockSong([
      { id: 'm1', measureNumber: 1, chord: 'C', notes: [] },
      { id: 'm2', measureNumber: 2, chord: 'N.C.', notes: [] },
      { id: 'm3', measureNumber: 3, notes: [] },
    ]);
    assert.deepStrictEqual(getEffectiveMeasureChords(song, 0), ['C']);
    assert.deepStrictEqual(getEffectiveMeasureChords(song, 1), []); // silenced by N.C.
    assert.deepStrictEqual(getEffectiveMeasureChords(song, 2), []); // continued silence from N.C.
  });

  it('falls back to Song Key tonic when measures have no chords defined', () => {
    const song = makeMockSong([
      { id: 'm1', measureNumber: 1, notes: [] },
      { id: 'm2', measureNumber: 2, notes: [] },
    ], 'D');
    assert.deepStrictEqual(getEffectiveMeasureChords(song, 0), ['D']);
    assert.deepStrictEqual(getEffectiveMeasureChords(song, 1), ['D']);
  });
});

describe('Chord Storage & Persistence', () => {
  const store: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    (globalThis as any).window = {
      localStorage: mockLocalStorage,
      dispatchEvent: () => true,
    };
    (globalThis as any).localStorage = mockLocalStorage;
    (globalThis as any).Event = class { constructor(public type: string) {} };
  });

  it('defaults chordEnabled to true', () => {
    const enabled = getStoredChordEnabled();
    assert.strictEqual(enabled, true, 'Default chordEnabled must be true');
  });

  it('defaults backingVolume to 0.6', () => {
    const vol = getStoredBackingVolume();
    assert.strictEqual(vol, 0.6, 'Default backingVolume should be 0.6');
  });

  it('stores and retrieves chordEnabled toggle', () => {
    setStoredChordEnabled(false);
    assert.strictEqual(getStoredChordEnabled(), false);

    setStoredChordEnabled(true);
    assert.strictEqual(getStoredChordEnabled(), true);
  });

  it('stores and retrieves backingVolume', () => {
    setStoredBackingVolume(0.85);
    assert.strictEqual(getStoredBackingVolume(), 0.85);
  });
});
