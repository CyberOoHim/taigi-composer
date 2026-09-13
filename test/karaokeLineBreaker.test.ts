import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DisplayNote } from '../lib/karaokeLineBreaker.ts';
import {
  segmentDisplayNotesIntoLines,
  estimateDisplayNoteWidth,
} from '../lib/karaokeLineBreaker.ts';

function createMockNote(
  hanlo: string,
  poj: string,
  pitch: number,
  duration: number,
  measureNumber: number,
  globalIdx: number
): DisplayNote {
  return {
    item: {
      note: {
        id: `note-${globalIdx}`,
        pitch,
        duration,
        octave: 0,
        lyric: { hanlo, poj, hanji: hanlo },
      },
      measureIndex: measureNumber - 1,
      noteIndex: globalIdx,
      measureNumber,
      isFirstInMeasure: false,
    },
    globalIdx,
    effectiveTiming: {
      startTimeSec: globalIdx * 0.75,
      durationSec: duration * 0.75,
      endTimeSec: (globalIdx + duration) * 0.75,
    },
  };
}

describe('Karaoke Smart Line Breaker', () => {
  // Test phrase: 「風吹微微 等待的人」
  // Measure 9: 風 (pitch 4, dur 1), 吹 (pitch 3, dur 1), 微 (pitch 4, dur 1)
  // Measure 10: 微 (pitch 5, dur 4) [4-beat whole note!]
  // Measure 11: 等 (pitch 5, dur 0.5), 待 (pitch 6, dur 0.5), 的 (pitch 5, dur 1)
  // Measure 12: 人 (pitch 2, dur 4)
  const yueyechouPhraseNotes: DisplayNote[] = [
    createMockNote('風', 'hong', 4, 1, 9, 0),
    createMockNote('吹', 'chhe', 3, 1, 9, 1),
    createMockNote('微', 'bî', 4, 1, 9, 2),
    createMockNote('微', 'bî', 5, 4, 10, 3), // held 4 beats, reduplication with previous note
    createMockNote('等', 'tán-', 5, 0.5, 11, 4), // hyphenated
    createMockNote('待', 'thāi', 6, 0.5, 11, 5),
    createMockNote('的', 'ê', 5, 1, 11, 6),
    createMockNote('人', 'lâng', 2, 4, 12, 7),
  ];

  it('does NOT auto-break short 7-8 syllable phrase on standard tablet/desktop screen (e.g. iPad at 150% zoom)', () => {
    const lines = segmentDisplayNotesIntoLines(yueyechouPhraseNotes, {
      containerWidth: 960,
      zoomScale: 1.5,
      showNotation: true,
      effectiveMode: 'roman_major_hanlo',
      layoutMode: 'two_line',
    });

    assert.equal(lines.length, 1, 'Should stay on 1 single line without breaking');
    assert.equal(lines[0].notes.length, 8);
    const lyrics = lines[0].notes.map(n => n.item.note.lyric.hanlo).join('');
    assert.equal(lyrics, '風吹微微等待的人');
  });

  it('keeps short phrases intact even in single_line mode at high zoom', () => {
    const lines = segmentDisplayNotesIntoLines(yueyechouPhraseNotes, {
      containerWidth: 1024,
      zoomScale: 1.75,
      showNotation: true,
      effectiveMode: 'roman_major_hanlo',
      layoutMode: 'single_line',
    });

    assert.equal(lines.length, 1);
    assert.equal(lines[0].notes.length, 8);
  });

  it('splits cleanly at 4+3/4+4 on very narrow screen, protecting reduplication 微微 and hyphen tán-thāi', () => {
    const lines = segmentDisplayNotesIntoLines(yueyechouPhraseNotes, {
      containerWidth: 340, // very narrow mobile viewport
      zoomScale: 1.5,
      showNotation: true,
      effectiveMode: 'roman_major_hanlo',
      layoutMode: 'two_line',
    });

    assert.equal(lines.length, 2, 'Should split into 2 lines on very narrow mobile viewport');
    const line1Lyrics = lines[0].notes.map(n => n.item.note.lyric.hanlo).join('');
    const line2Lyrics = lines[1].notes.map(n => n.item.note.lyric.hanlo).join('');

    // Must split at "風吹微微" and "等待的人", NEVER "風吹微" and "微等待的人"!
    assert.equal(line1Lyrics, '風吹微微', 'Line 1 must contain full 微微 without cutting word');
    assert.equal(line2Lyrics, '等待的人', 'Line 2 must contain 等待的人 without breaking tán-thāi');
  });

  it('avoids splitting reduplicated words like 慢慢 or 輕輕 across lines', () => {
    const phraseWithReduplication: DisplayNote[] = [
      createMockNote('行', 'kiâⁿ', 1, 1, 1, 0),
      createMockNote('路', 'lō͘', 2, 1, 1, 1),
      createMockNote('慢', 'bān', 3, 2, 1, 2),
      createMockNote('慢', 'bān', 3, 2, 2, 3), // Across measure boundary 1->2
      createMockNote('行', 'kiâⁿ', 1, 2, 2, 4),
      createMockNote('向', 'hiòng', 2, 1, 3, 5),
      createMockNote('前', 'chiân', 3, 1, 3, 6),
      createMockNote('走', 'cháu', 4, 3, 3, 7),
    ];

    const lines = segmentDisplayNotesIntoLines(phraseWithReduplication, {
      containerWidth: 320,
      zoomScale: 1.0,
      showNotation: true,
      effectiveMode: 'hanlo',
      layoutMode: 'two_line',
    });

    assert.equal(lines.length, 2);
    const line1 = lines[0].notes.map(n => n.item.note.lyric.hanlo).join('');
    const line2 = lines[1].notes.map(n => n.item.note.lyric.hanlo).join('');

    // Neither line should end or start with a split 慢
    assert.ok(
      (line1.includes('慢慢') && !line2.includes('慢')) ||
      (line2.includes('慢慢') && !line1.includes('慢')),
      `Reduplication 慢慢 must remain together on the same line, got line1="${line1}" line2="${line2}"`
    );
  });

  it('correctly calculates visual footprint for notes with duration dashes', () => {
    const quarterNote = createMockNote('字', 'jī', 1, 1, 1, 0);
    const wholeNote = createMockNote('長', 'tn̂g', 1, 4, 1, 1);

    const wQuarter = estimateDisplayNoteWidth(quarterNote, 1.5, true, 'hanlo');
    const wWhole = estimateDisplayNoteWidth(wholeNote, 1.5, true, 'hanlo');

    assert.ok(wWhole > wQuarter + 30, `Whole note with 3 dashes should be noticeably wider than quarter note (${wWhole} vs ${wQuarter})`);
  });

  it('splits long 12-syllable verse symmetrically or at punctuation when in two_line mode', () => {
    const longVerse: DisplayNote[] = [
      createMockNote('一', 'chi̍t', 1, 1, 1, 0),
      createMockNote('步', 'pō͘', 2, 1, 1, 1),
      createMockNote('一', 'chi̍t', 3, 1, 1, 2),
      createMockNote('步', 'pō͘', 2, 1, 1, 3),
      createMockNote('向', 'hiòng', 3, 1, 2, 4),
      createMockNote('前', 'chiân', 5, 2, 2, 5), // held 2 beats
      createMockNote('走', 'cháu', 1, 1, 3, 6),
      createMockNote('不', 'put', 2, 1, 3, 7),
      createMockNote('驚', 'kiaⁿ', 3, 1, 3, 8),
      createMockNote('風', 'hong', 2, 1, 4, 9),
      createMockNote('雨', 'ú', 3, 1, 4, 10),
      createMockNote('阻', 'chó͘', 1, 3, 4, 11),
    ];

    const lines = segmentDisplayNotesIntoLines(longVerse, {
      containerWidth: 600,
      zoomScale: 1.25,
      showNotation: true,
      effectiveMode: 'hanlo',
      layoutMode: 'two_line',
    });

    assert.equal(lines.length, 2, 'Should split 12-syllable phrase into 2 balanced lines');
    assert.equal(lines[0].notes.length, 6);
    assert.equal(lines[1].notes.length, 6);
    const line1 = lines[0].notes.map(n => n.item.note.lyric.hanlo).join('');
    const line2 = lines[1].notes.map(n => n.item.note.lyric.hanlo).join('');
    assert.equal(line1, '一步一步向前');
    assert.equal(line2, '走不驚風雨阻');
  });

  it('prioritizes punctuation mark split over arbitrary syllable count', () => {
    const verseWithComma: DisplayNote[] = [
      createMockNote('心', 'sim', 1, 1, 1, 0),
      createMockNote('內', 'lāi', 2, 1, 1, 1),
      createMockNote('事', 'sū', 3, 1, 1, 2),
      createMockNote('，', '', 0, 1, 1, 3), // comma punctuation note
      createMockNote('無', 'bô', 2, 1, 2, 4),
      createMockNote('人', 'lâng', 3, 1, 2, 5),
      createMockNote('知', 'chai', 5, 3, 2, 6),
    ];

    const lines = segmentDisplayNotesIntoLines(verseWithComma, {
      containerWidth: 320,
      zoomScale: 1.25,
      showNotation: true,
      effectiveMode: 'hanlo',
      layoutMode: 'two_line',
    });

    assert.equal(lines.length, 2);
    const line1 = lines[0].notes.map(n => n.item.note.lyric.hanlo).join('');
    assert.ok(line1.startsWith('心內事'));
  });
});
