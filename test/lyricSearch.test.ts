import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  stripDiacritics,
  normalizeForSearch,
  normalizeDense,
  highlightMatch,
  searchSongLyrics,
  searchLibraryLyrics,
  searchWithinSong,
} from '../lib/lyricSearch.ts';
import type { Song } from '../types/song.ts';

const SAMPLE_UIAHOE: Song = {
  id: 'u-ia-hoe',
  title: '雨夜花 (Ú-iā-hoe)',
  subtitle: '周添旺 詞 / 鄧雨賢 曲',
  composer: '鄧雨賢',
  lyricist: '周添旺',
  key: 'Bb',
  timeSignature: '4/4',
  bpm: 72,
  measures: [
    {
      id: 'm1',
      measureNumber: 1,
      chord: 'Bb',
      section: 'Verse 1',
      notes: [
        { id: 'n1', pitch: 5, octave: -1, duration: 0.5, lyric: { poj: 'Ú', hanlo: '雨' } },
        { id: 'n2', pitch: 6, octave: -1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
        { id: 'n3', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'iā', hanlo: '夜' } },
        { id: 'n4', pitch: 3, octave: 0, duration: 2.0, lyric: { poj: 'hoe', hanlo: '花' } },
      ],
    },
    {
      id: 'm2',
      measureNumber: 2,
      chord: 'Gm',
      notes: [
        { id: 'n5', pitch: 1, octave: 0, duration: 0.5, lyric: { poj: 'siū', hanlo: '受' } },
        { id: 'n6', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'hong', hanlo: '風' } },
        { id: 'n7', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'hō͘', hanlo: '雨' } },
        { id: 'n8', pitch: 2, octave: 0, duration: 1.5, lyric: { poj: 'tē', hanlo: '地' } },
      ],
    },
    {
      id: 'm3',
      measureNumber: 3,
      chord: 'Eb',
      section: 'Verse 2',
      notes: [
        { id: 'n9', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'Hoe', hanlo: '花' } },
        { id: 'n10', pitch: 6, octave: -1, duration: 1.0, lyric: { poj: 'siā', hanlo: '謝' } },
        { id: 'n11', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'lo̍h', hanlo: '落' } },
        { id: 'n12', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'thô͘', hanlo: '土' } },
      ],
    },
  ],
};

const SAMPLE_BAOBEI: Song = {
  id: 'i-si-lan-e-po-poe',
  title: '伊是咱的寶貝 (I sī Lán ê Pó-pòe)',
  subtitle: '陳明章 詞曲',
  composer: '陳明章',
  lyricist: '陳明章',
  key: 'C',
  timeSignature: '4/4',
  bpm: 80,
  measures: [
    {
      id: 'b_m1',
      measureNumber: 1,
      chord: 'C',
      section: 'Chorus',
      notes: [
        { id: 'b_n1', pitch: 1, octave: 0, duration: 1.0, lyric: { poj: 'I', hanlo: '伊' } },
        { id: 'b_n2', pitch: 2, octave: 0, duration: 1.0, lyric: { poj: 'sī', hanlo: '是' } },
        { id: 'b_n3', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'pó', hanlo: '寶' } },
        { id: 'b_n4', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'pòe', hanlo: '貝' } },
      ],
    },
  ],
};

describe('Lyric Search - Text Normalization', () => {
  it('correctly strips diacritics and tone marks from POJ', () => {
    assert.equal(stripDiacritics('Ú-iā-hoe'), 'U-ia-hoe');
    assert.equal(stripDiacritics('hō͘'), 'ho');
    assert.equal(stripDiacritics('kìⁿ'), 'kin');
    assert.equal(stripDiacritics('chhun-hông'), 'chhun-hong');
    assert.equal(stripDiacritics('siū-hong-hō͘'), 'siu-hong-ho');
  });

  it('normalizes search queries and lyric texts for fuzzy matching', () => {
    assert.equal(normalizeForSearch('Ú-iā-hoe'), 'u ia hoe');
    assert.equal(normalizeForSearch('  Chhun - hông ! '), 'chhun hong');
    assert.equal(normalizeDense('Ú-iā-hoe'), 'uiahoe');
    assert.equal(normalizeDense('u ia hoe'), 'uiahoe');
  });

  it('splits matched text into highlighted segments', () => {
    const res = highlightMatch('雨夜花受風雨吹落地', '花');
    assert.equal(res.length, 3);
    assert.equal(res[0].text, '雨夜');
    assert.equal(res[0].isMatch, false);
    assert.equal(res[1].text, '花');
    assert.equal(res[1].isMatch, true);
    assert.equal(res[2].text, '受風雨吹落地');
    assert.equal(res[2].isMatch, false);

    // Diacritic-insensitive highlight
    const pojRes = highlightMatch('Ú-iā-hoe', 'hoe');
    const matchedSegment = pojRes.find(s => s.isMatch);
    assert.ok(matchedSegment, 'Should find matched segment');
    assert.equal(matchedSegment.text, 'hoe');
  });
});

describe('Lyric Search - Single Song Search', () => {
  it('finds lyrics by Hanlo characters across multiple notes', () => {
    const results = searchSongLyrics(SAMPLE_UIAHOE, '雨夜花');
    assert.ok(results.length > 0, 'Should find matches for 雨夜花');
    const firstMatch = results.find(r => r.matchedField === 'hanlo' || r.matchedField === 'title');
    assert.ok(firstMatch, 'Should have Hanlo or title match');
    assert.equal(firstMatch.songId, SAMPLE_UIAHOE.id);
  });

  it('finds lyrics by unaccented POJ query (e.g. "u-ia-hoe" -> "Ú-iā-hoe")', () => {
    const results = searchSongLyrics(SAMPLE_UIAHOE, 'u-ia-hoe');
    assert.ok(results.length > 0, 'Should find matches for unaccented u-ia-hoe');
  });

  it('finds lyrics by specific phrase in verse 2 (e.g. "落土")', () => {
    const results = searchSongLyrics(SAMPLE_UIAHOE, '落土');
    assert.ok(results.length > 0, 'Should find matches for 落土');
    const measureIndices = results.map(r => r.measureIndex);
    assert.ok(measureIndices.includes(2), 'Should match at measure index 2 (Measure 3)');
  });

  it('matches song composer and metadata', () => {
    const results = searchSongLyrics(SAMPLE_UIAHOE, '鄧雨賢');
    assert.ok(results.length > 0, 'Should find matches for composer');
    const metaMatch = results.find(r => r.matchedField === 'metadata' || r.matchedField === 'title');
    assert.ok(metaMatch);
  });
});

describe('Lyric Search - Library Search Across Songs', () => {
  const library = [SAMPLE_UIAHOE, SAMPLE_BAOBEI];

  it('searches across presets and custom songs, returning correct song ids', () => {
    const results = searchLibraryLyrics(library, '寶貝');
    assert.ok(results.length > 0, 'Should find matches for 寶貝');
    const babySongMatch = results.find(r => r.songTitle.includes('寶貝'));
    assert.ok(babySongMatch, 'Should match 伊是咱的寶貝');
  });

  it('filters by scope="current" when currentSongId is provided', () => {
    const currentId = SAMPLE_UIAHOE.id;
    const allResults = searchLibraryLyrics(library, '雨');
    const currentResults = searchLibraryLyrics(library, '雨', currentId, { scope: 'current' });

    assert.ok(allResults.length > 0);
    assert.ok(currentResults.every(r => r.songId === currentId));
  });
});

describe('Lyric Search - In-Song Search (searchWithinSong)', () => {
  it('locates all measures and verses matching a keyword occurring multiple times', () => {
    // "花" appears in Measure 1 (Verse 1) and Measure 3 (Verse 2)
    const res = searchWithinSong(SAMPLE_UIAHOE, '花');
    assert.equal(res.songId, SAMPLE_UIAHOE.id);
    assert.ok(res.totalMeasureMatches >= 2, 'Should match at least 2 measures containing 花');
    assert.ok(res.totalVerseMatches >= 2, 'Should match at least 2 verses containing 花');

    const matchedMeasureNums = res.measureMatches.map(m => m.measureNumber);
    assert.ok(matchedMeasureNums.includes(1), 'Measure 1 should be matched');
    assert.ok(matchedMeasureNums.includes(3), 'Measure 3 should be matched');

    const matchedVerseIndices = res.verseMatches.map(v => v.verseIndex);
    assert.ok(matchedVerseIndices.includes(0), 'Verse 1 should be matched');
    assert.ok(matchedVerseIndices.includes(1), 'Verse 2 should be matched');
  });

  it('correctly filters by measure only and verse only', () => {
    const measureOnly = searchWithinSong(SAMPLE_UIAHOE, '花', 'measure');
    assert.ok(measureOnly.allMatches.every(m => m.type === 'measure'));
    assert.equal(measureOnly.allMatches.length, measureOnly.totalMeasureMatches);

    const verseOnly = searchWithinSong(SAMPLE_UIAHOE, '花', 'verse');
    assert.ok(verseOnly.allMatches.every(m => m.type === 'verse'));
    assert.equal(verseOnly.allMatches.length, verseOnly.totalVerseMatches);
  });

  it('locates measures with unaccented POJ tone marks (e.g. "siu hong ho")', () => {
    // Measure 2 has "siū hong hō͘"
    const res = searchWithinSong(SAMPLE_UIAHOE, 'siu hong ho');
    assert.ok(res.totalMeasureMatches > 0, 'Should find measure match for unaccented query');
    const m2Match = res.measureMatches.find(m => m.measureNumber === 2);
    assert.ok(m2Match, 'Should match Measure 2');
    assert.equal(m2Match.matchedField, 'poj');
  });

  it('locates measures by performance annotation', () => {
    const songWithAnnot: Song = {
      ...SAMPLE_UIAHOE,
      measures: [
        ...SAMPLE_UIAHOE.measures,
        {
          id: 'm4',
          measureNumber: 4,
          chord: 'Bb',
          notes: [
            { id: 'n13', pitch: 1, octave: 0, duration: 2.0, annotation: '過門 Solo', lyric: { poj: '', hanlo: '' } },
          ],
        },
      ],
    };

    const res = searchWithinSong(songWithAnnot, '過門');
    assert.ok(res.totalMeasureMatches > 0, 'Should find measure with annotation 過門');
    const annotMeasure = res.measureMatches.find(m => m.measureNumber === 4);
    assert.ok(annotMeasure, 'Measure 4 should be found by annotation');
    assert.equal(annotMeasure.matchedField, 'annotation');
  });

  it('handles empty or whitespace queries gracefully', () => {
    const res = searchWithinSong(SAMPLE_UIAHOE, '   ');
    assert.equal(res.totalMatches, 0);
    assert.equal(res.measureMatches.length, 0);
    assert.equal(res.verseMatches.length, 0);
  });
});

