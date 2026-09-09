import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDiatonicCandidateChords,
  suggestChordsForMeasure,
  autoArrangeSongChords,
  autoArrangeVerseChords,
} from '@/lib/chordArranger';
import { Measure, NumberedNotationNote, Song, VerseItem } from '@/types/song';

function makeNote(pitch: number | 'empty', duration: number, lyricText: string = ''): NumberedNotationNote {
  return {
    id: `note-${Math.random().toString(36).substring(2, 9)}`,
    pitch: pitch as any,
    octave: 0,
    duration,
    lyric: { hanlo: lyricText, poj: lyricText },
  };
}

function makeMeasure(notes: NumberedNotationNote[], mNumber: number = 1): Measure {
  return {
    id: `m-${mNumber}`,
    measureNumber: mNumber,
    notes,
  };
}

describe('Chord Arranger: Diatonic Candidate Chords', () => {
  it('generates accurate diatonic chords for Key of C', () => {
    const candidates = getDiatonicCandidateChords('C');
    const chords = candidates.map(c => c.chord);
    assert.deepStrictEqual(chords, ['C', 'Dm', 'Em', 'F', 'G', 'G7', 'Am']);
  });

  it('generates accurate diatonic chords for Key of F (flat key)', () => {
    const candidates = getDiatonicCandidateChords('F');
    const chords = candidates.map(c => c.chord);
    assert.deepStrictEqual(chords, ['F', 'Gm', 'Am', 'Bb', 'C', 'C7', 'Dm']);
  });

  it('generates accurate diatonic chords for Key of G (sharp key)', () => {
    const candidates = getDiatonicCandidateChords('G');
    const chords = candidates.map(c => c.chord);
    assert.deepStrictEqual(chords, ['G', 'Am', 'Bm', 'C', 'D', 'D7', 'Em']);
  });
});

describe('Chord Arranger: Measure Chord Suggestion', () => {
  it('suggests Tonic (I) chord for melody notes 1, 3, 5 in C Major', () => {
    // Notes: 1 (1 beat), 3 (1 beat), 5 (2 beats)
    const m = makeMeasure([
      makeNote(1, 1),
      makeNote(3, 1),
      makeNote(5, 2),
    ]);
    const result = suggestChordsForMeasure(m, 'C', '4/4');
    assert.ok(result.chords.includes('C'));
    assert.ok(result.confidence >= 70);
    assert.ok(result.rationale.includes('C'));
  });

  it('suggests Dominant (V or V7) for melody notes 2, 5, 7 in C Major', () => {
    // Notes: 5 (1 beat), 7 (1 beat), 2 (2 beats)
    const m = makeMeasure([
      makeNote(5, 1),
      makeNote(7, 1),
      makeNote(2, 2),
    ]);
    const result = suggestChordsForMeasure(m, 'C', '4/4');
    assert.ok(result.chords[0] === 'G' || result.chords[0] === 'G7');
    assert.ok(result.confidence >= 70);
  });

  it('suggests Subdominant (IV) for melody notes 4, 6, 1 in C Major', () => {
    // Notes: 4 (2 beats), 6 (1 beat), 1 (1 beat)
    const m = makeMeasure([
      makeNote(4, 2),
      makeNote(6, 1),
      makeNote(1, 1),
    ]);
    const result = suggestChordsForMeasure(m, 'C', '4/4');
    assert.ok(result.chords.includes('F'));
  });

  it('enforces Tonic (I) resolution for the final measure on note 1', () => {
    const m = makeMeasure([
      makeNote(1, 4),
    ], 16);
    const result = suggestChordsForMeasure(m, 'C', '4/4', { isLast: true, prevChord: 'G7' });
    assert.deepStrictEqual(result.chords, ['C']);
    assert.ok(result.rationale.includes('終止'));
  });

  it('detects dual chords when a 4-beat measure splits clearly between two harmonies', () => {
    // Beat 1-2: notes 1, 3 (C major tones)
    // Beat 3-4: notes 2, 7 (G major / V tones)
    const m = makeMeasure([
      makeNote(1, 1),
      makeNote(3, 1),
      makeNote(2, 1),
      makeNote(7, 1),
    ]);
    const result = suggestChordsForMeasure(m, 'C', '4/4', { allowDualChords: true });
    assert.strictEqual(result.chords.length, 2);
    assert.strictEqual(result.chords[0], 'C');
    assert.ok(result.chords[1] === 'G' || result.chords[1] === 'G7');
  });
});

describe('Chord Arranger: Song and Verse Harmonization', () => {
  const sampleSong: Song = {
    id: 'test-song-1',
    title: 'Test Song',
    key: 'C',
    timeSignature: '4/4',
    bpm: 80,
    measures: [
      makeMeasure([makeNote(1, 2), makeNote(3, 2)], 1),
      makeMeasure([makeNote(4, 2), makeNote(6, 2)], 2),
      makeMeasure([makeNote(5, 2), makeNote(2, 2)], 3),
      makeMeasure([makeNote(1, 4)], 4),
    ],
  };

  it('auto-arranges chords across the entire song', () => {
    const harmonized = autoArrangeSongChords(sampleSong);
    assert.strictEqual(harmonized.measures.length, 4);
    harmonized.measures.forEach(m => {
      assert.ok(m.chord !== undefined);
      assert.strictEqual(typeof m.chord, 'string');
      assert.ok(m.chord.length > 0);
      assert.ok(m.chords !== undefined);
      assert.ok(m.chords.length > 0);
    });
    // First measure starts with C (I)
    assert.strictEqual(harmonized.measures[0].chord, 'C');
    // Last measure ends on C (I)
    assert.strictEqual(harmonized.measures[3].chord, 'C');
  });

  it('auto-arranges only the targeted verse without altering other measures', () => {
    const verseItem: VerseItem = {
      id: 'v-1',
      verseIndex: 0,
      startMeasureNumber: 1,
      endMeasureNumber: 2,
      chords: [],
      lyricSummary: { poj: '', hanlo: '' },
      notes: [
        {
          note: sampleSong.measures[0].notes[0],
          measureIdx: 0,
          noteIdx: 0,
          measureIndex: 0,
          noteIndex: 0,
          measureNumber: 1,
          isFirstInMeasure: true,
        },
        {
          note: sampleSong.measures[1].notes[0],
          measureIdx: 1,
          noteIdx: 0,
          measureIndex: 1,
          noteIndex: 0,
          measureNumber: 2,
          isFirstInMeasure: true,
        },
      ],
    };

    // Pre-assign chords to measure 3 and 4
    const songWithExistingChords: Song = {
      ...sampleSong,
      measures: sampleSong.measures.map((m, idx) => ({
        ...m,
        chord: idx >= 2 ? 'ORIGINAL' : '',
        chords: idx >= 2 ? ['ORIGINAL'] : [],
      })),
    };

    const result = autoArrangeVerseChords(songWithExistingChords, 0, [verseItem]);
    // Measures 0 and 1 got harmonized
    assert.strictEqual(result.measures[0].chord, 'C');
    assert.strictEqual(result.measures[1].chord, 'F');
    // Measures 2 and 3 remained untouched
    assert.strictEqual(result.measures[2].chord, 'ORIGINAL');
    assert.strictEqual(result.measures[3].chord, 'ORIGINAL');
  });
});
