import type { Song } from '../types/song.ts';
import { groupSongIntoVerses } from './taigiUtils.ts';

export type SearchScope = 'all' | 'current';
export type InSongFilter = 'all' | 'measure' | 'verse';

export interface InSongMatchLocation {
  id: string;
  type: 'measure' | 'verse';
  measureIndex: number;
  measureNumber: number;
  verseIndex?: number;
  verseNumber?: number;
  startMeasureNumber?: number;
  endMeasureNumber?: number;
  section?: string;
  chords: string[];
  matchedField: 'hanlo' | 'poj' | 'annotation' | 'title';
  matchedQuery: string;
  matchedSnippet: string;
  previewHanlo: string;
  previewPoj: string;
  noteIndices?: number[];
  matchCount: number;
}

export interface InSongSearchResult {
  query: string;
  songId: string;
  songTitle: string;
  totalMeasureMatches: number;
  totalVerseMatches: number;
  totalMatches: number;
  measureMatches: InSongMatchLocation[];
  verseMatches: InSongMatchLocation[];
  allMatches: InSongMatchLocation[];
}

export interface LyricSearchResult {
  id: string;
  songId: string;
  songTitle: string;
  songSubtitle?: string;
  songKey: string;
  songBpm: number;
  isCurrentSong: boolean;
  measureIndex: number;
  measureNumber: number;
  verseIndex?: number;
  verseNumber?: number;
  startMeasureNumber?: number;
  endMeasureNumber?: number;
  matchType?: 'measure' | 'verse';
  section?: string;
  chord?: string;
  matchedField: 'hanlo' | 'poj' | 'title' | 'metadata';
  matchedQuery: string;
  matchedSnippet: string;
  previewHanlo: string;
  previewPoj: string;
  startNoteIndex?: number;
  endNoteIndex?: number;
}

export interface SearchOptions {
  scope?: SearchScope;
  maxResults?: number;
}

/**
 * Remove combining diacritical marks (tones) from text.
 * e.g., "Ú-iā-hoe" -> "U-ia-hoe", "hō͘" -> "ho", "kìⁿ" -> "kin"
 */
export function stripDiacritics(text: string): string {
  if (!text) return '';
  return text
    // Replace POJ nasal superscript ⁿ / ⁿg with n / ng
    .replace(/ⁿ/g, 'n')
    // Replace right dot or combining dot below / right (o͘ -> o)
    .replace(/[\u0358\u0307\u0359\u00B7\u2022]/g, '')
    // Normalize unicode to NFD (canonical decomposition)
    .normalize('NFD')
    // Strip combining diacritical marks
    .replace(/[\u0300-\u036f]/g, '')
    // Recombine to NFC
    .normalize('NFC');
}

/**
 * Normalize string for fuzzy, diacritic-insensitive, case-insensitive comparison.
 * Hyphens and multiple spaces are collapsed to single spaces.
 */
export function normalizeForSearch(text: string): string {
  if (!text) return '';
  const stripped = stripDiacritics(text).toLowerCase();
  // Replace hyphens, dashes, and underscores with space, remove common punctuation
  return stripped
    .replace(/[–—_\-\t\r\n]+/g, ' ')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»“”‘’、。，！？；：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compact normalization (no spaces or hyphens) for dense phrase matching.
 * e.g. "u ia hoe" and "u-ia-hoe" both become "uiahoe".
 */
export function normalizeDense(text: string): string {
  if (!text) return '';
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/[\s–—_\-\t\r\n.,/#!$%^&*;:{}=`~()?"'«»“”‘’、。，！？；：]/g, '');
}

/**
 * Highlight matching query parts in a text string for UI rendering.
 * Returns an array of slices with `isMatch: boolean`.
 */
export function highlightMatch(text: string, query: string): Array<{ text: string; isMatch: boolean }> {
  if (!text) return [];
  if (!query || !query.trim()) return [{ text, isMatch: false }];

  const cleanQuery = query.trim();
  const lowerText = text.toLowerCase();
  const lowerQuery = cleanQuery.toLowerCase();

  // 1. Direct case-insensitive substring search
  const directIdx = lowerText.indexOf(lowerQuery);
  if (directIdx !== -1) {
    const before = text.slice(0, directIdx);
    const matched = text.slice(directIdx, directIdx + cleanQuery.length);
    const after = text.slice(directIdx + cleanQuery.length);
    const res: Array<{ text: string; isMatch: boolean }> = [];
    if (before) res.push({ text: before, isMatch: false });
    res.push({ text: matched, isMatch: true });
    if (after) {
      // Recurse for subsequent matches
      const sub = highlightMatch(after, query);
      res.push(...sub);
    }
    return res;
  }

  // 2. Diacritic-insensitive search
  const normQuery = normalizeDense(cleanQuery);
  if (!normQuery) return [{ text, isMatch: false }];

  // Scan text characters comparing dense normalized prefixes
  let bestStart = -1;
  let bestEnd = -1;

  for (let i = 0; i < text.length; i++) {
    for (let j = i + 1; j <= text.length; j++) {
      const candidate = text.slice(i, j);
      const denseCandidate = normalizeDense(candidate);
      if (denseCandidate === normQuery) {
        bestStart = i;
        bestEnd = j;
        break;
      }
    }
    if (bestStart !== -1) break;
  }

  if (bestStart !== -1 && bestEnd !== -1) {
    const before = text.slice(0, bestStart);
    const matched = text.slice(bestStart, bestEnd);
    const after = text.slice(bestEnd);
    const res: Array<{ text: string; isMatch: boolean }> = [];
    if (before) res.push({ text: before, isMatch: false });
    res.push({ text: matched, isMatch: true });
    if (after) {
      res.push(...highlightMatch(after, query));
    }
    return res;
  }

  return [{ text, isMatch: false }];
}

/**
 * Searches a single song for lyric or metadata matches.
 */
export function searchSongLyrics(
  song: Song,
  rawQuery: string,
  options?: SearchOptions & { isCurrentSong?: boolean }
): LyricSearchResult[] {
  if (!song || !rawQuery || !rawQuery.trim()) return [];

  const query = rawQuery.trim();
  const normQuery = normalizeForSearch(query);
  const denseQuery = normalizeDense(query);
  const isCurrentSong = options?.isCurrentSong ?? false;
  const results: LyricSearchResult[] = [];

  // Helper to prevent duplicate results for the exact same measure & text
  const seenKeys = new Set<string>();
  const addResult = (res: LyricSearchResult) => {
    const key = `${res.songId}_m${res.measureIndex}_${res.matchedField}_${res.matchedSnippet}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      results.push(res);
    }
  };

  // 1. Metadata Search (Title, Subtitle, Composer, Lyricist)
  const normTitle = normalizeForSearch(song.title || '');
  const denseTitle = normalizeDense(song.title || '');
  const normSub = normalizeForSearch(song.subtitle || '');
  const denseSub = normalizeDense(song.subtitle || '');
  const normComposer = normalizeForSearch(song.composer || '');
  const normLyricist = normalizeForSearch(song.lyricist || '');

  const titleMatch =
    (song.title && song.title.toLowerCase().includes(query.toLowerCase())) ||
    normTitle.includes(normQuery) ||
    denseTitle.includes(denseQuery);

  const subMatch =
    (song.subtitle && song.subtitle.toLowerCase().includes(query.toLowerCase())) ||
    normSub.includes(normQuery) ||
    denseSub.includes(denseQuery);

  const composerMatch =
    (song.composer && song.composer.toLowerCase().includes(query.toLowerCase())) ||
    normComposer.includes(normQuery);

  const lyricistMatch =
    (song.lyricist && song.lyricist.toLowerCase().includes(query.toLowerCase())) ||
    normLyricist.includes(normQuery);

  if (titleMatch || subMatch || composerMatch || lyricistMatch) {
    const matchedSnippet = titleMatch
      ? song.title
      : subMatch
      ? song.subtitle || ''
      : composerMatch
      ? `曲: ${song.composer}`
      : `詞: ${song.lyricist}`;

    const firstMeasure = song.measures?.[0];
    const firstHanlo = firstMeasure?.notes
      ?.map(n => n.lyric?.hanlo || n.lyric?.custom || n.lyric?.hanji || '')
      .filter(Boolean)
      .join('') || '';
    const firstPoj = firstMeasure?.notes
      ?.map(n => n.lyric?.poj || n.lyric?.tl || '')
      .filter(Boolean)
      .join(' ') || '';

    addResult({
      id: `${song.id}-meta-0`,
      songId: song.id,
      songTitle: song.title,
      songSubtitle: song.subtitle,
      songKey: song.key,
      songBpm: song.bpm,
      isCurrentSong,
      measureIndex: 0,
      measureNumber: 1,
      section: firstMeasure?.section || 'Intro',
      chord: firstMeasure?.chord,
      matchedField: titleMatch ? 'title' : 'metadata',
      matchedQuery: query,
      matchedSnippet,
      previewHanlo: firstHanlo || song.title,
      previewPoj: firstPoj || song.subtitle || '',
    });
  }

  // 2. Verse & Phrase Search (cross-note continuous lyrics)
  const verses = groupSongIntoVerses(song);

  verses.forEach((verse, vIdx) => {
    const vHanlo = verse.lyricSummary.hanlo || '';
    const vPoj = verse.lyricSummary.poj || '';

    const normHanlo = normalizeForSearch(vHanlo);
    const denseHanlo = normalizeDense(vHanlo);
    const normPoj = normalizeForSearch(vPoj);
    const densePoj = normalizeDense(vPoj);

    // Check Hanlo match
    const hanloMatches =
      vHanlo.toLowerCase().includes(query.toLowerCase()) ||
      normHanlo.includes(normQuery) ||
      denseHanlo.includes(denseQuery);

    // Check POJ / Romanization match
    const pojMatches =
      vPoj.toLowerCase().includes(query.toLowerCase()) ||
      normPoj.includes(normQuery) ||
      densePoj.includes(denseQuery);

    if (hanloMatches || pojMatches) {
      // Pinpoint the first note in this verse that triggered the match
      let matchedNoteRef = verse.notes[0];
      let matchedField: 'hanlo' | 'poj' = hanloMatches ? 'hanlo' : 'poj';

      // Attempt note-level location
      for (const nRef of verse.notes) {
        const noteHanlo = nRef.note.lyric?.hanlo || nRef.note.lyric?.custom || nRef.note.lyric?.hanji || '';
        const notePoj = nRef.note.lyric?.poj || nRef.note.lyric?.tl || '';

        if (
          (hanloMatches && (noteHanlo.includes(query) || normalizeDense(noteHanlo).includes(denseQuery))) ||
          (pojMatches && (notePoj.toLowerCase().includes(query.toLowerCase()) || normalizeDense(notePoj).includes(denseQuery)))
        ) {
          matchedNoteRef = nRef;
          matchedField = hanloMatches && (noteHanlo.includes(query) || normalizeDense(noteHanlo).includes(denseQuery)) ? 'hanlo' : 'poj';
          break;
        }
      }

      const targetMeasureIdx = matchedNoteRef ? matchedNoteRef.measureIndex : (verse.startMeasureNumber - 1);
      const targetMeasureNum = matchedNoteRef ? matchedNoteRef.measureNumber : verse.startMeasureNumber;
      const targetMeasure = song.measures[targetMeasureIdx];

      addResult({
        id: `${song.id}-v${vIdx}-m${targetMeasureIdx}-${matchedField}`,
        songId: song.id,
        songTitle: song.title,
        songSubtitle: song.subtitle,
        songKey: song.key,
        songBpm: song.bpm,
        isCurrentSong,
        measureIndex: targetMeasureIdx,
        measureNumber: targetMeasureNum,
        verseIndex: vIdx,
        verseNumber: vIdx + 1,
        startMeasureNumber: verse.startMeasureNumber,
        endMeasureNumber: verse.endMeasureNumber,
        matchType: 'verse',
        section: verse.section || targetMeasure?.section,
        chord: targetMeasure?.chord || verse.chords[0],
        matchedField,
        matchedQuery: query,
        matchedSnippet: matchedField === 'hanlo' ? vHanlo : vPoj,
        previewHanlo: vHanlo,
        previewPoj: vPoj,
        startNoteIndex: matchedNoteRef?.noteIndex,
      });
    }
  });

  // 3. Per-Measure Lyrics & Annotation Search
  song.measures.forEach((measure, mIdx) => {
    let mHanlo = '';
    let mPoj = '';
    let mAnnotation = '';

    measure.notes.forEach(n => {
      const h = n.lyric?.hanlo || n.lyric?.custom || n.lyric?.hanji || '';
      const p = n.lyric?.poj || n.lyric?.tl || '';
      if (h && !/[\r\n]/.test(h)) mHanlo += h;
      if (p && !/[\r\n]/.test(p)) mPoj += (mPoj ? ' ' : '') + p;
      if (n.annotation) mAnnotation += (mAnnotation ? ' ' : '') + n.annotation;
    });

    const normHanlo = normalizeForSearch(mHanlo);
    const denseHanlo = normalizeDense(mHanlo);
    const normPoj = normalizeForSearch(mPoj);
    const densePoj = normalizeDense(mPoj);
    const normAnnotation = normalizeForSearch(mAnnotation);

    const hanloMatch = mHanlo && (mHanlo.toLowerCase().includes(query.toLowerCase()) || normHanlo.includes(normQuery) || denseHanlo.includes(denseQuery));
    const pojMatch = mPoj && (mPoj.toLowerCase().includes(query.toLowerCase()) || normPoj.includes(normQuery) || densePoj.includes(denseQuery));
    const annotMatch = mAnnotation && (mAnnotation.toLowerCase().includes(query.toLowerCase()) || normAnnotation.includes(normQuery));

    if (hanloMatch || pojMatch || annotMatch) {
      const matchedField: 'hanlo' | 'poj' | 'metadata' = hanloMatch ? 'hanlo' : (pojMatch ? 'poj' : 'metadata');
      addResult({
        id: `${song.id}-m${mIdx}-${matchedField}`,
        songId: song.id,
        songTitle: song.title,
        songSubtitle: song.subtitle,
        songKey: song.key,
        songBpm: song.bpm,
        isCurrentSong,
        measureIndex: mIdx,
        measureNumber: measure.measureNumber || mIdx + 1,
        section: measure.section,
        chord: measure.chord,
        matchedField,
        matchedQuery: query,
        matchedSnippet: matchedField === 'hanlo' ? mHanlo : (matchedField === 'poj' ? mPoj : mAnnotation),
        previewHanlo: mHanlo || mAnnotation,
        previewPoj: mPoj,
        matchType: 'measure',
      });
    }
  });

  return results;
}

/**
 * Searches strictly within a single song and groups matches into
 * all matching measures, all matching verses, and chronological combined matches.
 */
export function searchWithinSong(
  song: Song,
  rawQuery: string,
  filter: InSongFilter = 'all'
): InSongSearchResult {
  const emptyResult: InSongSearchResult = {
    query: rawQuery || '',
    songId: song?.id || '',
    songTitle: song?.title || '',
    totalMeasureMatches: 0,
    totalVerseMatches: 0,
    totalMatches: 0,
    measureMatches: [],
    verseMatches: [],
    allMatches: [],
  };

  if (!song || !song.measures || song.measures.length === 0 || !rawQuery || !rawQuery.trim()) {
    return emptyResult;
  }

  const query = rawQuery.trim();
  const lowerQuery = query.toLowerCase();
  const normQuery = normalizeForSearch(query);
  const denseQuery = normalizeDense(query);

  const checkMatch = (text: string | undefined): boolean => {
    if (!text) return false;
    if (text.toLowerCase().includes(lowerQuery)) return true;
    if (normQuery && normalizeForSearch(text).includes(normQuery)) return true;
    if (denseQuery && normalizeDense(text).includes(denseQuery)) return true;
    return false;
  };

  const measureMatches: InSongMatchLocation[] = [];
  const verseMatches: InSongMatchLocation[] = [];

  // 1. Collect all matching measures
  song.measures.forEach((measure, mIdx) => {
    let mHanlo = '';
    let mPoj = '';
    let mAnnotation = '';
    const matchedNoteIndices: number[] = [];

    measure.notes.forEach((n, nIdx) => {
      const h = n.lyric?.hanlo || n.lyric?.custom || n.lyric?.hanji || '';
      const p = n.lyric?.poj || n.lyric?.tl || '';
      const a = n.annotation || '';

      if (h && !/[\r\n]/.test(h)) mHanlo += h;
      if (p && !/[\r\n]/.test(p)) mPoj += (mPoj ? ' ' : '') + p;
      if (a) mAnnotation += (mAnnotation ? ' ' : '') + a;

      if (checkMatch(h) || checkMatch(p) || checkMatch(a)) {
        matchedNoteIndices.push(nIdx);
      }
    });

    const hanloMatched = checkMatch(mHanlo);
    const pojMatched = checkMatch(mPoj);
    const annotMatched = checkMatch(mAnnotation);

    if (hanloMatched || pojMatched || annotMatched || matchedNoteIndices.length > 0) {
      const matchedField: 'hanlo' | 'poj' | 'annotation' = hanloMatched
        ? 'hanlo'
        : pojMatched
        ? 'poj'
        : 'annotation';

      const matchedSnippet =
        matchedField === 'hanlo'
          ? mHanlo
          : matchedField === 'poj'
          ? mPoj
          : (mAnnotation || mHanlo);

      measureMatches.push({
        id: `${song.id}-measure-${mIdx}`,
        type: 'measure',
        measureIndex: mIdx,
        measureNumber: measure.measureNumber || (mIdx + 1),
        section: measure.section,
        chords: measure.chord ? [measure.chord] : [],
        matchedField,
        matchedQuery: query,
        matchedSnippet,
        previewHanlo: mHanlo,
        previewPoj: mPoj,
        noteIndices: matchedNoteIndices,
        matchCount: Math.max(1, matchedNoteIndices.length),
      });
    }
  });

  // 2. Collect all matching verses
  const verses = groupSongIntoVerses(song);
  verses.forEach((verse, vIdx) => {
    const vHanlo = verse.lyricSummary.hanlo || verse.lyricSummary.hanji || '';
    const vPoj = verse.lyricSummary.poj || verse.lyricSummary.tl || '';
    let vAnnotation = '';
    const matchedNoteIndices: number[] = [];

    verse.notes.forEach((nRef, nIdx) => {
      const h = nRef.note.lyric?.hanlo || nRef.note.lyric?.custom || nRef.note.lyric?.hanji || '';
      const p = nRef.note.lyric?.poj || nRef.note.lyric?.tl || '';
      const a = nRef.note.annotation || '';
      if (a) vAnnotation += (vAnnotation ? ' ' : '') + a;

      if (checkMatch(h) || checkMatch(p) || checkMatch(a)) {
        matchedNoteIndices.push(nIdx);
      }
    });

    const hanloMatched = checkMatch(vHanlo);
    const pojMatched = checkMatch(vPoj);
    const annotMatched = checkMatch(vAnnotation);

    if (hanloMatched || pojMatched || annotMatched || matchedNoteIndices.length > 0) {
      const matchedField: 'hanlo' | 'poj' | 'annotation' = hanloMatched
        ? 'hanlo'
        : pojMatched
        ? 'poj'
        : 'annotation';

      const matchedSnippet =
        matchedField === 'hanlo'
          ? vHanlo
          : matchedField === 'poj'
          ? vPoj
          : (vAnnotation || vHanlo);

      const targetMeasureIdx = verse.notes[0]?.measureIndex ?? Math.max(0, verse.startMeasureNumber - 1);

      verseMatches.push({
        id: `${song.id}-verse-${vIdx}`,
        type: 'verse',
        measureIndex: targetMeasureIdx,
        measureNumber: verse.startMeasureNumber,
        verseIndex: vIdx,
        verseNumber: vIdx + 1,
        startMeasureNumber: verse.startMeasureNumber,
        endMeasureNumber: verse.endMeasureNumber,
        section: verse.section,
        chords: verse.chords,
        matchedField,
        matchedQuery: query,
        matchedSnippet,
        previewHanlo: vHanlo,
        previewPoj: vPoj,
        noteIndices: matchedNoteIndices,
        matchCount: Math.max(1, matchedNoteIndices.length),
      });
    }
  });

  // 3. Assemble allMatches ordered by measure timeline
  const combined: InSongMatchLocation[] = [];
  if (filter === 'measure') {
    combined.push(...measureMatches);
  } else if (filter === 'verse') {
    combined.push(...verseMatches);
  } else {
    // Interleave/sort by measureIndex. If same measure, verse comes first to establish context
    const sorted = [...verseMatches, ...measureMatches].sort((a, b) => {
      if (a.measureIndex !== b.measureIndex) {
        return a.measureIndex - b.measureIndex;
      }
      if (a.type !== b.type) {
        return a.type === 'verse' ? -1 : 1;
      }
      return 0;
    });
    combined.push(...sorted);
  }

  return {
    query,
    songId: song.id,
    songTitle: song.title,
    totalMeasureMatches: measureMatches.length,
    totalVerseMatches: verseMatches.length,
    totalMatches: combined.length,
    measureMatches,
    verseMatches,
    allMatches: combined,
  };
}

/**
 * Searches across an array of songs (presets + custom saved songs).
 * Places current song matches and exact title matches at the top.
 */
export function searchLibraryLyrics(
  songs: Song[],
  rawQuery: string,
  currentSongId?: string,
  options?: SearchOptions
): LyricSearchResult[] {
  if (!Array.isArray(songs) || songs.length === 0 || !rawQuery || !rawQuery.trim()) {
    return [];
  }

  const allResults: LyricSearchResult[] = [];

  for (const song of songs) {
    if (options?.scope === 'current' && currentSongId && song.id !== currentSongId) {
      continue;
    }

    const songResults = searchSongLyrics(song, rawQuery, {
      ...options,
      isCurrentSong: song.id === currentSongId,
    });

    allResults.push(...songResults);
  }

  // Sort results:
  // 1. Current song first
  // 2. Title matches
  // 3. Ascending measure number
  allResults.sort((a, b) => {
    if (a.isCurrentSong !== b.isCurrentSong) {
      return a.isCurrentSong ? -1 : 1;
    }
    if (a.matchedField === 'title' && b.matchedField !== 'title') return -1;
    if (b.matchedField === 'title' && a.matchedField !== 'title') return 1;
    if (a.songId !== b.songId) return a.songTitle.localeCompare(b.songTitle, 'zh-Hant');
    return a.measureIndex - b.measureIndex;
  });

  if (options?.maxResults && options.maxResults > 0) {
    return allResults.slice(0, options.maxResults);
  }

  return allResults;
}
