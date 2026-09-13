import type { VerseNoteRef } from '../types/song.ts';

export function isPunctuationOrSpacer(str?: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  if (
    trimmed === '' ||
    trimmed === '—' ||
    trimmed === '…' ||
    trimmed === 'V' ||
    trimmed === '↵' ||
    trimmed === '\n' ||
    trimmed === '\r'
  ) {
    return true;
  }
  return /^[，。！？、；：""''（）()「」,.!?;:\s—…\n\r↵]+$/.test(trimmed);
}

export type SubNoteItem = {
  item: VerseNoteRef;
  globalIdx: number;
  effectiveTiming: {
    startTimeSec: number;
    durationSec: number;
    endTimeSec: number;
  };
};

export type DisplayNote = {
  item: VerseNoteRef;
  globalIdx: number;
  effectiveTiming: {
    startTimeSec: number;
    durationSec: number;
    endTimeSec: number;
  };
  subNotes?: SubNoteItem[];
};

export interface VerseLineItem {
  id: string;
  measureNumber: number;
  notes: DisplayNote[];
}

export type LineBreakMode = 'single_line' | 'two_line';
export type DisplayModeVariant = 'roman' | 'hanlo' | 'roman_major_hanlo' | 'hanlo_major_roman';

export interface SmartLineBreakOptions {
  containerWidth: number;
  zoomScale: number;
  showNotation: boolean;
  effectiveMode: DisplayModeVariant;
  layoutMode?: LineBreakMode;
  verseId?: string | number;
}

/**
 * Estimate the visual footprint (in px) of a single display note cell
 */
export function estimateDisplayNoteWidth(
  dn: DisplayNote,
  zoomScale: number,
  showNotation: boolean,
  effectiveMode: DisplayModeVariant
): number {
  if (showNotation) {
    const baseNoteWidth = zoomScale >= 1.75 ? 72 : zoomScale >= 1.5 ? 60 : zoomScale >= 1.25 ? 50 : 42;
    const gap = zoomScale >= 1.5 ? 10 : 6;
    const dashes =
      typeof dn.item.note.duration === 'number' && dn.item.note.duration >= 2
        ? Math.floor(dn.item.note.duration) - 1
        : 0;
    const dashWidth = dashes * 18;
    const subNotesWidth = (dn.subNotes?.length || 0) * (baseNoteWidth * 0.75 + 4);
    return baseNoteWidth + dashWidth + subNotesWidth + gap;
  }

  const n = dn.item.note;
  const rawH = (n.lyric.hanlo ?? n.lyric.hanji ?? n.lyric.custom ?? '').trim();
  const rawR = (n.lyric.poj ?? n.lyric.tl ?? '').trim();

  if (!rawH && !rawR && n.annotation) {
    return 48;
  }
  if (isPunctuationOrSpacer(rawH) || isPunctuationOrSpacer(rawR)) {
    return 24;
  }

  const baseCharWidth = zoomScale >= 1.75 ? 96 : zoomScale >= 1.5 ? 74 : zoomScale >= 1.25 ? 60 : 50;

  if (effectiveMode === 'roman_major_hanlo' || effectiveMode === 'hanlo_major_roman') {
    const romanWidth = Math.max(1, rawR.length) * (baseCharWidth * 0.42);
    const hanjiWidth = Math.max(1, rawH.length) * baseCharWidth;
    return Math.max(hanjiWidth, romanWidth) + 6;
  }
  if (effectiveMode === 'roman') {
    return Math.max(1, rawR.length) * (baseCharWidth * 0.52) + 8;
  }
  return Math.max(1, rawH.length) * baseCharWidth + 4;
}

/**
 * Checks if a note is a vocal syllable (has lyrics or is a pitched vocal event)
 */
export function isVocalNote(dn: DisplayNote): boolean {
  const n = dn.item.note;
  const h = (n.lyric.hanlo ?? n.lyric.hanji ?? n.lyric.custom ?? '').trim();
  const p = (n.lyric.poj ?? n.lyric.tl ?? '').trim();
  return (Boolean(h) && !isPunctuationOrSpacer(h)) || (Boolean(p) && !isPunctuationOrSpacer(p));
}

/**
 * Smart lyric line break segmentation engine:
 * 1. Never prematurely breaks short phrases (<= 8-9 vocal syllables remain single-line whenever they fit).
 * 2. In single_line mode, avoids line breaks unless total width physically exceeds container.
 * 3. When breaking is needed, chooses natural musical cadences (after sustained held notes, rests, punctuation).
 * 4. Strictly protects compound words and reduplications (e.g. 微微, 慢慢, tán-thāi) from being cut in half.
 */
export function segmentDisplayNotesIntoLines(
  displayNotes: DisplayNote[],
  options: SmartLineBreakOptions
): VerseLineItem[] {
  if (!displayNotes || displayNotes.length === 0) {
    return [];
  }

  const {
    containerWidth,
    zoomScale,
    showNotation,
    effectiveMode,
    layoutMode = 'two_line',
    verseId = 'default',
  } = options;

  // 1. Calculate footprints and count vocal syllables
  const noteWidths = displayNotes.map(dn => estimateDisplayNoteWidth(dn, zoomScale, showNotation, effectiveMode));
  const totalEstimatedWidth = noteWidths.reduce((sum, w) => sum + w, 0);
  const vocalCount = displayNotes.filter(isVocalNote).length;

  const availableWidth = Math.max(300, containerWidth - (zoomScale >= 1.5 ? 64 : 48));

  // 2. Short Phrase & Single-Line Determination:
  // Short phrases of <= 8 vocal syllables (e.g. 「風吹微微 等待的人」 with 7 syllables, or 「月色照在 三線路」)
  // are complete musical clauses. They should NEVER be split when they fit horizontally!
  const isShortPhrase = vocalCount <= 8;
  const fitsInAvailableWidth = totalEstimatedWidth <= availableWidth;

  if (layoutMode === 'single_line') {
    // Single line mode: stay single-line whenever it fits
    if (fitsInAvailableWidth || vocalCount <= 12) {
      return [
        {
          id: `line-single-${verseId}`,
          measureNumber: displayNotes[0]?.item.measureNumber ?? 1,
          notes: displayNotes,
        },
      ];
    }
  } else {
    // Two line mode:
    // A) If short phrase and it fits -> keep on single line!
    if (isShortPhrase && fitsInAvailableWidth) {
      return [
        {
          id: `line-single-${verseId}`,
          measureNumber: displayNotes[0]?.item.measureNumber ?? 1,
          notes: displayNotes,
        },
      ];
    }

    // B) If medium phrase (<= 10 syllables) and fits comfortably with margin -> keep single line!
    if (vocalCount <= 10 && totalEstimatedWidth <= availableWidth * 0.92) {
      return [
        {
          id: `line-single-${verseId}`,
          measureNumber: displayNotes[0]?.item.measureNumber ?? 1,
          notes: displayNotes,
        },
      ];
    }
  }

  // 3. Smart Music-Aware & Linguistic-Aware 2-Line Split
  let bestSplit = -1;
  let bestScore = -Infinity;

  // Minimum syllables per line to prevent awkward 1- or 2-syllable orphan lines
  const minVocal = vocalCount >= 9 ? 3 : 2;

  for (let i = 1; i < displayNotes.length; i++) {
    const leftNotes = displayNotes.slice(0, i);
    const rightNotes = displayNotes.slice(i);

    const leftVocal = leftNotes.filter(isVocalNote).length;
    const rightVocal = rightNotes.filter(isVocalNote).length;

    if (leftVocal < minVocal || rightVocal < minVocal) {
      continue;
    }

    const prevNote = displayNotes[i - 1].item.note;
    const nextNote = displayNotes[i].item.note;

    const prevHan = (prevNote.lyric.hanlo ?? prevNote.lyric.hanji ?? prevNote.lyric.custom ?? '').trim();
    const nextHan = (nextNote.lyric.hanlo ?? nextNote.lyric.hanji ?? nextNote.lyric.custom ?? '').trim();
    const prevRom = (prevNote.lyric.poj ?? prevNote.lyric.tl ?? '').trim();
    const nextRom = (nextNote.lyric.poj ?? nextNote.lyric.tl ?? '').trim();

    let score = 0;

    // A. Linguistic Protection: Reduplications and Compound Words
    // e.g., 微微, 慢慢, 陣陣, 輕輕 -> Severe penalty for splitting identical adjacent characters
    const isReduplication = Boolean(prevHan && nextHan && prevHan === nextHan && !isPunctuationOrSpacer(prevHan));
    if (isReduplication) {
      score -= 300;
    }

    // Romanization Hyphen Protection: e.g. bî-bî, tán-thāi
    const isHyphenSplit = prevRom.endsWith('-') || prevRom.endsWith('~') || nextRom.startsWith('-');
    if (isHyphenSplit) {
      score -= 300;
    }

    // B. Musical Cadence: Sustained / Held Note Priority
    // Singers naturally pause/breathe AFTER holding a sustained note
    const prevDur = typeof prevNote.duration === 'number' ? prevNote.duration : 1;
    if (prevDur >= 3.0) {
      score += 130; // 3 or 4 beat held note (e.g. 微 5 - - -)
    } else if (prevDur >= 2.0) {
      score += 85; // 2 beat half note
    } else if (prevDur >= 1.5) {
      score += 45; // Dotted quarter note
    }

    // Penalize splitting immediately before an isolated long note if it's within the same measure
    const nextDur = typeof nextNote.duration === 'number' ? nextNote.duration : 1;
    if (nextDur >= 3.0 && displayNotes[i - 1].item.measureNumber === displayNotes[i].item.measureNumber) {
      score -= 60;
    }

    // C. Musical Rests and Breathing Spaces
    const isPunctSplit = isPunctuationOrSpacer(prevHan) || isPunctuationOrSpacer(prevRom);
    const isRestSplit =
      (prevNote.pitch === 0 || prevNote.pitch === 'empty') ||
      (nextNote.pitch === 0 || nextNote.pitch === 'empty');

    if (isPunctSplit) score += 160;
    if (isRestSplit) score += 80;

    // D. Measure Boundary (conditioned on not breaking words)
    const isMeasureSplit = displayNotes[i - 1].item.measureNumber !== displayNotes[i].item.measureNumber;
    if (isMeasureSplit && !isReduplication && !isHyphenSplit) {
      score += 35;
    }

    // E. Metric Symmetry & Poetic Balance
    score -= Math.abs(leftVocal - rightVocal) * 12;

    // Canonical poetic meter bonuses
    if (vocalCount === 8 && leftVocal === 4 && rightVocal === 4) {
      score += 40; // 4 + 4 classic balance
    } else if (vocalCount === 7 && leftVocal === 4 && rightVocal === 3) {
      score += 35; // 4 + 3 classic lyric cadence
    } else if (vocalCount === 7 && leftVocal === 3 && rightVocal === 4) {
      score += 25;
    } else if (vocalCount === 10 && leftVocal === 5 && rightVocal === 5) {
      score += 40; // 5 + 5 balance
    } else if (vocalCount === 12 && leftVocal === 6 && rightVocal === 6) {
      score += 35; // 6 + 6 balance
    }

    // F. Horizontal Fit Check for Both Lines
    const leftWidth = noteWidths.slice(0, i).reduce((sum, w) => sum + w, 0);
    const rightWidth = noteWidths.slice(i).reduce((sum, w) => sum + w, 0);

    if (leftWidth > availableWidth) score -= 250;
    if (rightWidth > availableWidth) score -= 250;

    if (score > bestScore) {
      bestScore = score;
      bestSplit = i;
    }
  }

  // Fallback if no valid split found
  if (bestSplit === -1) {
    bestSplit = Math.floor(displayNotes.length / 2);
  }

  const line1Notes = displayNotes.slice(0, bestSplit);
  const line2Notes = displayNotes.slice(bestSplit);

  return [
    {
      id: `line-1-${verseId}`,
      measureNumber: line1Notes[0]?.item.measureNumber ?? 1,
      notes: line1Notes,
    },
    {
      id: `line-2-${verseId}`,
      measureNumber: line2Notes[0]?.item.measureNumber ?? 2,
      notes: line2Notes,
    },
  ];
}
