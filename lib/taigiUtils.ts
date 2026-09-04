import { ArticulationType, GraceNote, InstrumentType, JianpuNote, KeySignature, Measure, NoteDuration, PitchNumber, Song, VerseItem, VerseNoteRef } from '@/types/song';

// Semitones relative to C4 (MIDI note 60)
export const KEY_SEMITONES: Record<KeySignature, number> = {
  'C': 0,
  'Db': 1,
  'D': 2,
  'Eb': 3,
  'E': 4,
  'F': 5,
  'F#': 6,
  'G': 7,
  'Ab': 8,
  'A': 9,
  'Bb': 10,
  'B': 11,
};

// Major scale scale degree intervals from root 1 (in semitones)
// 1 = 0, 2 = 2, 3 = 4, 4 = 5, 5 = 7, 6 = 9, 7 = 11
export const SCALE_DEGREE_SEMITONES: Record<string, number> = {
  0: -100, // Rest
  'empty': -100, // Empty notation / spacer / punctuation slot
  1: 0,
  2: 2,
  3: 4,
  4: 5,
  5: 7,
  6: 9,
  7: 11,
};

/**
 * Calculate frequency in Hz for a given Key, Pitch number (1-7), Octave offset, and Accidental.
 */
export function getPitchFrequency(
  key: KeySignature,
  pitch: PitchNumber,
  octave: number = 0,
  accidental: '' | '#' | 'b' = '',
  transposeSemitones: number = 0
): number {
  if (pitch === 0 || pitch === 'empty' || !pitch) return 0; // Rest or empty space


  // Base C4 = 261.63 Hz, MIDI 60
  const baseKeyOffset = KEY_SEMITONES[key] || 0;
  const degreeOffset = SCALE_DEGREE_SEMITONES[pitch] || 0;
  let accidentalOffset = 0;
  if (accidental === '#') accidentalOffset = 1;
  if (accidental === 'b') accidentalOffset = -1;

  const totalSemitonesFromC4 =
    baseKeyOffset + degreeOffset + octave * 12 + accidentalOffset + transposeSemitones;
  const midiNote = 60 + totalSemitonesFromC4;

  // A4 = 440Hz = MIDI 69
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Chord note frequencies for accompaniment synthesis
 */
export function getChordNotes(chordName: string, transposeSemitones: number = 0): number[] {
  if (!chordName || chordName.trim() === '') return [];

  const rootMatch = chordName.match(/^([A-G][#b]?)(.*)$/);
  if (!rootMatch) return [];

  const rootStr = rootMatch[1] as KeySignature;
  const quality = rootMatch[2].toLowerCase();

  const rootSemitone = (KEY_SEMITONES[rootStr] ?? 0) + transposeSemitones;
  const rootMidi = 48 + rootSemitone; // C3 octave range for accompaniment

  let intervals = [0, 4, 7]; // Major triad

  if (quality.includes('m') && !quality.includes('maj')) {
    intervals = [0, 3, 7]; // Minor triad
  } else if (quality.includes('dim')) {
    intervals = [0, 3, 6];
  } else if (quality.includes('aug')) {
    intervals = [0, 4, 8];
  } else if (quality.includes('sus4')) {
    intervals = [0, 5, 7];
  } else if (quality.includes('7')) {
    if (quality.includes('maj7')) {
      intervals = [0, 4, 7, 11];
    } else if (quality.includes('m7')) {
      intervals = [0, 3, 7, 10];
    } else {
      intervals = [0, 4, 7, 10]; // Dominant 7th
    }
  }

  return intervals.map(semitone => 440 * Math.pow(2, (rootMidi + semitone - 69) / 12));
}

// Special Taigi (POJ and Tâi-lô / TL) characters and tone diacritics
export const TAIGI_TONE_CHARS = [
  // Tone marks for vowels
  { label: 'á', char: 'á', desc: 'Tone 2 (Rising)' },
  { label: 'à', char: 'à', desc: 'Tone 3 (Low Falling)' },
  { label: 'â', char: 'â', desc: 'Tone 5 (High Rising)' },
  { label: 'ā', char: 'ā', desc: 'Tone 7 (Mid Level)' },
  { label: 'a̍', char: 'a̍', desc: 'Tone 8 (High Checked / vertical dot)' },
  { label: 'a̋', char: 'a̋', desc: 'Tone 9 (High Level)' },
  { label: 'é', char: 'é', desc: 'Tone 2' },
  { label: 'è', char: 'è', desc: 'Tone 3' },
  { label: 'ê', char: 'ê', desc: 'Tone 5 / POJ e-circumflex' },
  { label: 'ē', char: 'ē', desc: 'Tone 7' },
  { label: 'e̍', char: 'e̍', desc: 'Tone 8' },
  { label: 'í', char: 'í', desc: 'Tone 2' },
  { label: 'ì', char: 'ì', desc: 'Tone 3' },
  { label: 'î', char: 'î', desc: 'Tone 5' },
  { label: 'ī', char: 'ī', desc: 'Tone 7' },
  { label: 'i̍', char: 'i̍', desc: 'Tone 8' },
  { label: 'ó', char: 'ó', desc: 'Tone 2' },
  { label: 'ò', char: 'ò', desc: 'Tone 3' },
  { label: 'ô', char: 'ô', desc: 'Tone 5' },
  { label: 'ō', char: 'ō', desc: 'Tone 7' },
  { label: 'o̍', char: 'o̍', desc: 'Tone 8' },
  { label: 'ú', char: 'ú', desc: 'Tone 2' },
  { label: 'ù', char: 'ù', desc: 'Tone 3' },
  { label: 'û', char: 'û', desc: 'Tone 5' },
  { label: 'ū', char: 'ū', desc: 'Tone 7' },
  { label: 'u̍', char: 'u̍', desc: 'Tone 8' },
  { label: 'o͘', char: 'o͘', desc: 'POJ Open O (dot above right)' },
  { label: 'ó͘', char: 'ó͘', desc: 'POJ Open O Tone 2' },
  { label: 'ò͘', char: 'ò͘', desc: 'POJ Open O Tone 3' },
  { label: 'ô͘', char: 'ô͘', desc: 'POJ Open O Tone 5' },
  { label: 'ō͘', char: 'ō͘', desc: 'POJ Open O Tone 7' },
  { label: 'o̍͘', char: 'o̍͘', desc: 'POJ Open O Tone 8' },
  { label: 'ⁿ', char: 'ⁿ', desc: 'POJ Nasal superscript n' },
  { label: 'm̄', char: 'm̄', desc: 'Syllabic m Tone 7' },
  { label: 'ḿ', char: 'ḿ', desc: 'Syllabic m Tone 2' },
  { label: 'ńg', char: 'ńg', desc: 'Syllabic ng Tone 2' },
  { label: 'n̂g', char: 'n̂g', desc: 'Syllabic ng Tone 5' },
  { label: 'n̄g', char: 'n̄g', desc: 'Syllabic ng Tone 7' },
  { label: 'ê', char: 'ê', desc: 'ê (of / possessive)' },
  { label: 'tio̍h', char: 'tio̍h', desc: 'tio̍h (must / should)' },
  { label: 'bô', char: 'bô', desc: 'bô (not / none)' },
  { label: 'hó', char: 'hó', desc: 'hó (good / well)' },
  { label: 'kui', char: 'kui', desc: 'kui (whole / return)' },
];

// Common Punctuation Marks for Numbered Notation sheet lyrics and notations
export const PUNCTUATION_MARKS = [
  { label: '↵ Break', char: '\n', desc: 'Line Break (splits verse, 0 beats)' },
  { label: '␣ Space', char: ' ', desc: 'Space spacer (0 beats, no verse split)' },
  { label: '，', char: '，', desc: 'Comma (0 beats, no verse split)' },
  { label: '。', char: '。', desc: 'Period (0 beats, no verse split)' },
  { label: '、', char: '、', desc: 'Enumeration comma (0 beats, no verse split)' },
  { label: '！', char: '！', desc: 'Exclamation (0 beats, no verse split)' },
  { label: '？', char: '？', desc: 'Question mark (0 beats, no verse split)' },
  { label: '—', char: '—', desc: 'Em Dash (0 beats, no verse split)' },
  { label: '…', char: '…', desc: 'Ellipsis (0 beats, no verse split)' },
  { label: '「', char: '「', desc: 'Left Quote (0 beats, no verse split)' },
  { label: '」', char: '」', desc: 'Right Quote (0 beats, no verse split)' },
  { label: 'V', char: 'V', desc: 'Breath Mark (0 beats, no verse split)' },
];

// Musical & Vocal Performance Annotations
export const ANNOTATION_MARKS = [
  { label: 'rit.', text: 'rit.', desc: 'Ritardando (slowing down)' },
  { label: '(Chorus)', text: '(Chorus)', desc: 'Choir / Chorus' },
  { label: '(Refrain)', text: '(Refrain)', desc: 'Refrain section' },
  { label: '(Verse)', text: '(Verse)', desc: 'Verse section' },
  { label: '(Inst.)', text: '(Inst.)', desc: 'Instrumental passage' },
  { label: '(Solo)', text: '(Solo)', desc: 'Solo voice' },
  { label: '(Male)', text: '(Male)', desc: 'Male voice' },
  { label: '(Female)', text: '(Female)', desc: 'Female voice' },
  { label: '(Spoken)', text: '(Spoken)', desc: 'Spoken / Recitation' },
  { label: '[Interlude]', text: '[Interlude]', desc: 'Interlude section' },
  { label: '[Outro]', text: '[Outro]', desc: 'Outro ending' },
  { label: 'fine', text: 'fine', desc: 'Fine (end)' },
  { label: 'f', text: 'f', desc: 'Forte (loud)' },
  { label: 'p', text: 'p', desc: 'Piano (soft)' },
  { label: 'mp', text: 'mp', desc: 'Mezzo-piano (medium soft)' },
  { label: 'mf', text: 'mf', desc: 'Mezzo-forte (medium loud)' },
];

/**
 * Split text into Taigi syllables based on whether it's Hanji, POJ/TL (hyphens/spaces), or mixed Han-lo.
 * e.g., "獨夜無伴守燈下" -> ["獨", "夜", "無", "伴", "守", "燈", "下"]
 * e.g., "To̍k-iā bô-phōaⁿ siú teng-ē" -> ["To̍k", "iā", "bô", "phōaⁿ", "siú", "teng", "ē"]
 * e.g., "阮ê故鄉" -> ["阮", "ê", "故", "鄉"]
 */
export function splitTaigiLyricSyllables(text: string): string[] {
  if (!text) return [];

  // Normalize separators: replace full-width punctuation or commas with spaces
  const cleaned = text
    .replace(/[，。！？、；：""''（）(),.!?;:]/g, ' ')
    .trim();

  const tokens: string[] = [];
  const rawWords = cleaned.split(/\s+/).filter(Boolean);

  for (const word of rawWords) {
    // If the word contains hyphens (common in POJ/TL like "bô-phōaⁿ" or "chhun-hong")
    if (word.includes('-')) {
      const parts = word.split('-').filter(Boolean);
      for (const part of parts) {
        tokens.push(...splitTokenCharacters(part));
      }
    } else {
      tokens.push(...splitTokenCharacters(word));
    }
  }

  return tokens;
}

function splitTokenCharacters(token: string): string[] {
  const result: string[] = [];
  let currentLatin = '';

  // Iterate codepoints / characters
  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    const code = char.charCodeAt(0);

    // Hanji character check (CJK Unified Ideographs range)
    const isHan =
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df);

    if (isHan) {
      if (currentLatin.trim()) {
        result.push(currentLatin.trim());
        currentLatin = '';
      }
      result.push(char);
    } else {
      // Latin letters, combining diacritics, superscript n (ⁿ), dot above right (͘)
      currentLatin += char;
    }
  }

  if (currentLatin.trim()) {
    result.push(currentLatin.trim());
  }

  return result;
}

/**
 * Format duration into human readable fraction or symbol
 */
export function formatDurationName(duration: number): string {
  switch (duration) {
    case 4:
      return 'Whole Note (4)';
    case 3:
      return 'Dotted Half (3)';
    case 2:
      return 'Half Note (2)';
    case 1.75:
      return 'Double Dotted Quarter (1.75)';
    case 1.5:
      return 'Dotted Quarter (1.5 / 1½)';
    case 1.25:
      return 'Tied Quarter+16th (1.25)';
    case 1:
      return 'Quarter Note (1)';
    case 0.75:
      return 'Dotted Eighth (0.75 / ¾)';
    case 0.5:
      return '8th Note (1/2)';
    case 0.375:
      return 'Dotted 16th (0.375 / ⅜)';
    case 0.25:
      return '16th Note (1/4)';
    case 0.125:
      return '32nd Note (1/8)';
    case 0:
      return '0 beats (Empty)';
    default:
      return `${duration} beats`;
  }
}

export interface DurationChineseInfo {
  name: string;
  fractionLabel: string;
  beatsLabel: string;
  jianpuSymbol: string;
  description: string;
  isDotted: boolean;
}

export function getDurationChineseInfo(duration: number): DurationChineseInfo {
  switch (duration) {
    case 0:
      return {
        name: '0 beats (Empty)',
        fractionLabel: '0 beats (Empty / Punctuation)',
        beatsLabel: '0 beats',
        jianpuSymbol: '—',
        description: 'Zero duration: pure spacer, punctuation, or line break with no beat value',
        isDotted: false,
      };
    case 1.5:
      return {
        name: 'Dotted Quarter Note',
        fractionLabel: '1½ beats',
        beatsLabel: '1.5 beats',
        jianpuSymbol: '5·',
        description: 'Quarter note (1 beat) + dot (0.5 beats) = 1.5 beats',
        isDotted: true,
      };
    case 0.75:
      return {
        name: 'Dotted 8th Note',
        fractionLabel: '¾ beat',
        beatsLabel: '0.75 beats',
        jianpuSymbol: '5· (1 underline)',
        description: '8th note (0.5 beats) + dot (0.25 beats) = 0.75 beats',
        isDotted: true,
      };
    case 1:
      return {
        name: 'Quarter Note',
        fractionLabel: '1 beat',
        beatsLabel: '1 beat',
        jianpuSymbol: '5',
        description: 'Standard quarter note (1 beat)',
        isDotted: false,
      };
    case 0.5:
      return {
        name: '8th Note',
        fractionLabel: '½ beat',
        beatsLabel: '0.5 beats',
        jianpuSymbol: '5 (1 underline)',
        description: 'Half beat (0.5 beats)',
        isDotted: false,
      };
    case 0.25:
      return {
        name: '16th Note',
        fractionLabel: '¼ beat',
        beatsLabel: '0.25 beats',
        jianpuSymbol: '5 (2 underlines)',
        description: 'Quarter beat (0.25 beats)',
        isDotted: false,
      };
    case 2:
      return {
        name: 'Half Note',
        fractionLabel: '2 beats',
        beatsLabel: '2 beats',
        jianpuSymbol: '5 -',
        description: 'Half note (2 beats, 1 dash to the right)',
        isDotted: false,
      };
    case 3:
      return {
        name: 'Dotted Half Note',
        fractionLabel: '3 beats',
        beatsLabel: '3 beats',
        jianpuSymbol: '5 - -',
        description: 'Half note (2 beats) + dot (1 beat) = 3 beats',
        isDotted: true,
      };
    case 4:
      return {
        name: 'Whole Note',
        fractionLabel: '4 beats',
        beatsLabel: '4 beats',
        jianpuSymbol: '5 - - -',
        description: 'Whole note (4 beats, 3 dashes to the right)',
        isDotted: false,
      };
    case 0.375:
      return {
        name: 'Dotted 16th Note',
        fractionLabel: '⅜ beat',
        beatsLabel: '0.375 beats',
        jianpuSymbol: '5· (2 underlines)',
        description: '16th note (0.25 beats) + dot (0.125 beats) = 0.375 beats',
        isDotted: true,
      };
    case 1.75:
      return {
        name: 'Double Dotted Quarter Note',
        fractionLabel: '1¾ beats',
        beatsLabel: '1.75 beats',
        jianpuSymbol: '5··',
        description: 'Quarter note (1 beat) + double dots (0.75 beats) = 1.75 beats',
        isDotted: true,
      };
    case 3.5:
      return {
        name: 'Double Dotted Half Note',
        fractionLabel: '3½ beats',
        beatsLabel: '3.5 beats',
        jianpuSymbol: '5 - - ··',
        description: 'Half note (2 beats) + double dots (1.5 beats) = 3.5 beats',
        isDotted: true,
      };
    case 0.125:
      return {
        name: '32nd Note',
        fractionLabel: '⅛ beat',
        beatsLabel: '0.125 beats',
        jianpuSymbol: '5 (3 underlines)',
        description: 'Thirty-second note (0.125 beats, 3 underlines)',
        isDotted: false,
      };
    case 0.333:
      return {
        name: '8th Note Triplet',
        fractionLabel: '⅓ beat',
        beatsLabel: '0.333 beats',
        jianpuSymbol: '┌ 3 ┐ (⅓ beat)',
        description: 'Triplet 8th note: 3 notes in the space of 1 beat (0.333 beats each)',
        isDotted: false,
      };
    case 0.667:
      return {
        name: 'Quarter Note Triplet',
        fractionLabel: '⅔ beat',
        beatsLabel: '0.667 beats',
        jianpuSymbol: '┌ 3 ┐ (⅔ beat)',
        description: 'Triplet quarter note: 3 notes in the space of 2 beats (0.667 beats each)',
        isDotted: false,
      };
    default:
      return {
        name: `Custom Duration (${duration} beats)`,
        fractionLabel: `${duration} beats`,
        beatsLabel: `${duration} beats`,
        jianpuSymbol: `${duration} beats`,
        description: `Custom rhythm duration: ${duration} beats`,
        isDotted: duration % 1 !== 0 && duration !== 0.5 && duration !== 0.25,
      };
  }
}

/**
 * Compare two notes to see if they have identical musical pitch (pitch number, octave, accidental).
 */
export function isSamePitch(a: JianpuNote | null | undefined, b: JianpuNote | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.pitch === 'empty' || b.pitch === 'empty') return false;
  if (a.pitch === 0 || b.pitch === 0) return a.pitch === b.pitch;
  return (
    a.pitch === b.pitch &&
    (a.octave || 0) === (b.octave || 0) &&
    (a.accidental || '') === (b.accidental || '')
  );
}

/**
 * Check if a Tie is active from currentNote into nextNote.
 * A Tie (連結音) connects notes of the SAME pitch, combining their sound in playback.
 */
export function isTieActive(currentNote: JianpuNote | null | undefined, nextNote?: JianpuNote | null): boolean {
  if (!currentNote || !nextNote) return false;
  const wantsTie = Boolean(currentNote.tieToNext || currentNote.isTied);
  return wantsTie && isSamePitch(currentNote, nextNote);
}

/**
 * Check if a Slur is active from currentNote into nextNote.
 * A Slur (圓滑音 / 歌唱連線) connects notes across different or arbitrary pitches (legato phrasing / melisma).
 */
export function isSlurActive(currentNote: JianpuNote | null | undefined, nextNote?: JianpuNote | null): boolean {
  if (!currentNote) return false;
  if (currentNote.slurToNext) return true;
  // Backward compatibility: if isTied is set but pitches differ, it's musically a Slur
  if (currentNote.isTied && nextNote && !isSamePitch(currentNote, nextNote)) {
    return true;
  }
  return false;
}

/**
 * Check if a note is a melisma continuation under a slur (following an initial note with lyrics).
 */
export function isMelismaContinuation(note: JianpuNote | null | undefined, prevNote?: JianpuNote | null): boolean {
  if (!note || !prevNote) return false;
  const prevSlurred = isSlurActive(prevNote, note);
  const noteHasOwnLyric = Boolean(
    note.lyric?.hanji?.trim() ||
    note.lyric?.poj?.trim() ||
    note.lyric?.pij?.trim() ||
    note.lyric?.custom?.trim()
  );
  return prevSlurred && !noteHasOwnLyric;
}

/**
 * Format grace notes into compact display string e.g. "(3 5)"
 */
export function formatGraceNotes(notes?: GraceNote[]): string {
  if (!notes || notes.length === 0) return '';
  return notes
    .map(g => {
      let p = `${g.accidental || ''}${g.pitch}`;
      if (g.octave > 0) p += '̇'.repeat(g.octave);
      else if (g.octave < 0) p += '̣'.repeat(Math.abs(g.octave));
      return p;
    })
    .join('');
}

/**
 * Check if a note is punctuation, an annotation, a newline, or whitespace/blank spacer.
 * Punctuation, annotations, newlines, and whitespace are NOT treated as musical notation
 * and do not consume beats in a measure.
 */
export function isNonNotationItem(note: JianpuNote | null | undefined): boolean {
  if (!note) return false;

  // 1. Explicit 0 or negative duration
  if (typeof note.duration === 'number' && note.duration <= 0) return true;

  // 2. Explicit 'empty' pitch (blank notation / spacer for punctuation/annotation/newline)
  if (note.pitch === 'empty') return true;

  const isMusicalPitch = typeof note.pitch === 'number' && note.pitch > 0;

  // 3. Note has an annotation and has no active musical pitch (1-7)
  if (note.annotation && !isMusicalPitch) {
    return true;
  }

  // 4. Note contains punctuation, delimiter, space, or newline in lyrics
  // All delimiters, spaces, and newlines strictly maintain a time value of zero
  const rawHanji = note.lyric?.hanji ?? '';
  const rawCustom = note.lyric?.custom ?? '';
  const rawPoj = note.lyric?.poj ?? '';
  const rawPij = note.lyric?.pij ?? '';

  const hasAnyLyric =
    rawHanji.length > 0 ||
    rawCustom.length > 0 ||
    rawPoj.length > 0 ||
    rawPij.length > 0;

  const isPurePunctuationLyric =
    hasAnyLyric &&
    (!rawHanji || isPunctuationOrSpacer(rawHanji)) &&
    (!rawCustom || isPunctuationOrSpacer(rawCustom)) &&
    (!rawPoj || isPunctuationOrSpacer(rawPoj)) &&
    (!rawPij || isPunctuationOrSpacer(rawPij));

  if (isPurePunctuationLyric) {
    return true;
  }

  return false;
}

/**
 * Check if a note is a zero-time punctuation / delimiter / spacer (not an annotation)
 */
export function isPunctuationZeroNote(note: JianpuNote | null | undefined): boolean {
  if (!note) return false;
  const isZeroTime = isNonNotationItem(note);
  return isZeroTime && !note.annotation;
}

/**
 * Check if a note is a standalone zero-time annotation note (performance/vocal direction)
 */
export function isStandaloneAnnotationNote(note: JianpuNote | null | undefined): boolean {
  if (!note) return false;
  const isZeroTime = isNonNotationItem(note);
  return isZeroTime && Boolean(note.annotation);
}

/**
 * Get clean 1-character display symbol for a zero-time punctuation note
 */
export function getPunctuationDisplayChar(note: JianpuNote | null | undefined): string {
  if (!note) return '';
  const hanji = note.lyric?.hanji ?? '';
  const custom = note.lyric?.custom ?? '';
  const raw = hanji || custom || '';
  if (raw === '\n' || raw === '\r' || raw === '↵') return '↵';
  if (raw === ' ') return '␣';
  if (raw.trim()) return raw.trim().slice(-1);
  return '␣';
}

/**
 * Check if a character or string is a punctuation mark, newline, or spacer
 */
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

/**
 * Check if a string contains newline / line break characters (\n, \r, ↵)
 */
export function isNewlineBreak(str?: string): boolean {
  if (!str) return false;
  return /[\n\r↵]/.test(str);
}

/**
 * Check if a note is an explicit verse separator.
 * ONLY newlines (\n, \r, ↵) split verses.
 * All other delimiters (commas, periods, exclamation marks, question marks, dashes, etc.)
 * nor spaces nor rests split verses.
 */
export function isVerseBreakNote(note: JianpuNote | null | undefined): boolean {
  if (!note) return false;

  const hanji = note.lyric?.hanji || '';
  const custom = note.lyric?.custom || '';
  const poj = note.lyric?.poj || '';
  const pij = note.lyric?.pij || '';
  const annot = note.annotation || '';

  return (
    isNewlineBreak(hanji) ||
    isNewlineBreak(custom) ||
    isNewlineBreak(poj) ||
    isNewlineBreak(pij) ||
    isNewlineBreak(annot)
  );
}

/**
 * Group song into Verses sectioned by newlines or measure section headers.
 * Delimiters and spaces do not split verses.
 * Consecutive newlines act as a single verse separator.
 */
export function groupSongIntoVerses(song: Song): VerseItem[] {
  const verses: VerseItem[] = [];
  let currentNotes: VerseNoteRef[] = [];
  let currentSection: string | undefined = undefined;

  const pushCurrentVerse = () => {
    if (currentNotes.length === 0) return;

    const startMNum = currentNotes[0].measureNumber;
    const endMNum = currentNotes[currentNotes.length - 1].measureNumber;

    const verseChordsList: string[] = [];
    currentNotes.forEach(n => {
      const chordsForNote = n.chord ? getMeasureChords({ chord: n.chord }) : [];
      chordsForNote.forEach(c => {
        if (c && !verseChordsList.includes(c)) {
          verseChordsList.push(c);
        }
      });
    });
    const chords = verseChordsList;

    const hanjiParts: string[] = [];
    const pojParts: string[] = [];
    const pijParts: string[] = [];
    const customParts: string[] = [];

    currentNotes.forEach(n => {
      const h = n.note.lyric.hanji;
      const p = n.note.lyric.poj;
      const tl = n.note.lyric.pij;
      const c = n.note.lyric.custom;
      if (h && !isNewlineBreak(h)) hanjiParts.push(h);
      if (p && !isNewlineBreak(p)) pojParts.push(p);
      if (tl && !isNewlineBreak(tl)) pijParts.push(tl);
      if (c && !isNewlineBreak(c)) customParts.push(c);
    });

    const verseIndex = verses.length;
    verses.push({
      id: `verse-${verseIndex + 1}-${startMNum}-${endMNum}`,
      verseIndex,
      notes: [...currentNotes],
      startMeasureNumber: startMNum,
      endMeasureNumber: endMNum,
      section: currentSection || currentNotes[0].section,
      chords,
      lyricSummary: {
        hanji: hanjiParts.join(''),
        poj: pojParts.join(' '),
        pij: pijParts.join(' '),
        custom: customParts.join(' '),
      },
    });

    currentNotes = [];
  };

  song.measures.forEach((measure, mIdx) => {
    measure.notes.forEach((note, nIdx) => {
      const isFirstInMeasure = nIdx === 0;

      // If a measure has a new explicit section tag and we already have notes in the current verse, close the verse
      if (measure.section && isFirstInMeasure && currentNotes.length > 0 && currentSection !== measure.section) {
        pushCurrentVerse();
        currentSection = measure.section;
      } else if (measure.section && !currentSection) {
        currentSection = measure.section;
      }

      const noteRef: VerseNoteRef = {
        note,
        measureIdx: mIdx,
        noteIdx: nIdx,
        measureIndex: mIdx,
        noteIndex: nIdx,
        measureNumber: measure.measureNumber,
        chord: measure.chord,
        section: measure.section,
        isFirstInMeasure,
      };

      // Check if this note acts as a phrase / verse ending separator (ONLY newlines)
      const isSeparator = isVerseBreakNote(note);

      if (isSeparator) {
        // If we have accumulated at least one pitched/lyrical note before this separator, close the verse here
        const hasContent = currentNotes.some(
          n => (typeof n.note.pitch === 'number' && n.note.pitch > 0) || (n.note.lyric.hanji && !isPunctuationOrSpacer(n.note.lyric.hanji))
        );

        if (hasContent) {
          // Normal case: conclude current verse with this newline separator
          currentNotes.push(noteRef);
          pushCurrentVerse();
          currentSection = undefined;
        } else if (verses.length > 0 && currentNotes.length === 0) {
          // Consecutive newline! Consecutive newlines act as a single one:
          // Absorb into the previously closed verse without creating an empty verse
          verses[verses.length - 1].notes.push(noteRef);
        } else {
          // Leading newline before content: keep in currentNotes until content arrives
          currentNotes.push(noteRef);
        }
      } else {
        currentNotes.push(noteRef);
      }
    });
  });

  // Push remaining notes
  pushCurrentVerse();

  // If for some reason song has no notes or produced empty verses, provide a fallback single verse
  if (verses.length === 0 && song.measures.length > 0) {
    const allNotes: VerseNoteRef[] = [];
    song.measures.forEach((m, mIdx) => {
      m.notes.forEach((n, nIdx) => {
        allNotes.push({
          note: n,
          measureIdx: mIdx,
          noteIdx: nIdx,
          measureIndex: mIdx,
          noteIndex: nIdx,
          measureNumber: m.measureNumber,
          chord: m.chord,
          section: m.section,
          isFirstInMeasure: nIdx === 0,
        });
      });
    });

    if (allNotes.length > 0) {
      verses.push({
        id: 'verse-1',
        verseIndex: 0,
        notes: allNotes,
        startMeasureNumber: 1,
        endMeasureNumber: song.measures[song.measures.length - 1].measureNumber,
        section: song.measures[0]?.section,
        chords: Array.from(new Set(allNotes.map(n => n.chord).filter(Boolean) as string[])),
        lyricSummary: {
          hanji: allNotes.map(n => n.note.lyric.hanji || '').filter(h => !isNewlineBreak(h)).join(''),
          poj: allNotes.map(n => n.note.lyric.poj || '').filter(p => !isNewlineBreak(p)).join(' '),
          pij: allNotes.map(n => n.note.lyric.pij || '').filter(tl => !isNewlineBreak(tl)).join(' '),
          custom: allNotes.map(n => n.note.lyric.custom || '').filter(c => !isNewlineBreak(c)).join(' '),
        },
      });
    }
  }

  return verses;
}

/**
 * Tokenize verse text into syllables while preserving or recognizing punctuation marks.
 * Consecutive newlines act as a single verse separator.
 */
export function splitVerseTextTokens(text: string): { text: string; isPunct: boolean }[] {
  if (!text) return [];

  const tokens: { text: string; isPunct: boolean }[] = [];
  let currentLatin = '';

  const flushLatin = () => {
    if (currentLatin.trim()) {
      tokens.push({ text: currentLatin.trim(), isPunct: false });
      currentLatin = '';
    }
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isPunct = isPunctuationOrSpacer(char);

    if (isPunct) {
      flushLatin();
      if (char === '\n' || char === '\r' || char === '↵') {
        const lastTok = tokens[tokens.length - 1];
        if (!lastTok || lastTok.text !== '↵') {
          tokens.push({ text: '↵', isPunct: true });
        }
      } else if (char.trim()) {
        tokens.push({ text: char, isPunct: true });
      }
      continue;
    }

    const code = char.charCodeAt(0);
    const isHan =
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df);

    if (isHan) {
      flushLatin();
      tokens.push({ text: char, isPunct: false });
    } else if (char === '-' || char === ' ') {
      flushLatin();
    } else {
      currentLatin += char;
    }
  }

  flushLatin();
  return tokens;
}

/**
 * Get effective beat duration of a note without double scaling.
 * Returns 0 for non-notation items (punctuation, annotations, blank spaces, newlines).
 */
export function getNoteBeatDuration(note: JianpuNote | null | undefined): number {
  if (!note || isNonNotationItem(note) || note.pitch === 'empty') return 0;
  const dur = typeof note.duration === 'number' ? note.duration : 1;
  if (dur <= 0) return 0;
  // If duration is already a dotted value (1.5, 0.75, 3, 0.375, 1.75), do not scale again
  if (note.isDotted && (dur === 1 || dur === 0.5 || dur === 2 || dur === 0.25 || dur === 4)) {
    return Math.round(dur * 1.5 * 1000) / 1000;
  }
  return dur;
}

/**
 * Normalizes a note so that non-notation items (punctuation, annotations, newlines, empty pitches)
 * strictly have duration: 0 and pitch: 'empty', with no unnecessary time duration activated.
 */
export function normalizeNoteDuration(note: JianpuNote): JianpuNote {
  if (
    isNonNotationItem(note) ||
    note.pitch === 'empty' ||
    (typeof note.duration === 'number' && note.duration <= 0)
  ) {
    return {
      ...note,
      pitch: 'empty',
      duration: 0 as NoteDuration,
      isDotted: false,
      isTied: false,
      accidental: '',
      octave: 0,
    };
  }
  return note;
}

/**
 * Normalizes all notes across all measures of a song to ensure zero-duration rules are strictly enforced.
 */
export function normalizeSongDurations(song: Song): Song {
  return {
    ...song,
    measures: song.measures.map(m => ({
      ...m,
      notes: m.notes.map(normalizeNoteDuration),
    })),
  };
}

/**
 * Calculate the total beats currently inside a measure's notes
 */
export function calculateMeasureBeats(notes: JianpuNote[]): number {
  if (!notes || notes.length === 0) return 0;
  const total = notes.reduce((sum, n) => sum + getNoteBeatDuration(n), 0);
  return Math.round(total * 1000) / 1000;
}

/**
 * Calculate expected beats per measure according to the time signature (e.g. 4/4 -> 4, 3/4 -> 3, 6/8 -> 3, 2/4 -> 2)
 */
export function getExpectedMeasureBeats(timeSignature: string): number {
  if (!timeSignature) return 4;
  const parts = timeSignature.split('/');
  const num = parseInt(parts[0], 10) || 4;
  const den = parseInt(parts[1], 10) || 4;
  return Math.round(num * (4 / den) * 1000) / 1000;
}

export interface MeasureRhythmReport {
  currentBeats: number;
  expectedBeats: number;
  beatDiff: number; // positive = over-beat, negative = under-beat
  absDiff: number;
  isFull: boolean;
  isUnder: boolean;
  isOver: boolean;
  percentage: number; // 0 to 100+
}

/**
 * Comprehensive rhythm health check for a measure
 */
export function getMeasureRhythmReport(measure: Measure, fallbackTimeSignature = '4/4'): MeasureRhythmReport {
  const currentBeats = calculateMeasureBeats(measure?.notes || []);
  const timeSig = measure?.timeSignature || fallbackTimeSignature;
  const expectedBeats = getExpectedMeasureBeats(timeSig);
  const rawDiff = currentBeats - expectedBeats;
  const beatDiff = Math.round(rawDiff * 1000) / 1000;
  const absDiff = Math.abs(beatDiff);
  const isFull = absDiff < 0.001;
  const isUnder = beatDiff < -0.001;
  const isOver = beatDiff > 0.001;
  const percentage = expectedBeats > 0 ? Math.min(200, Math.round((currentBeats / expectedBeats) * 100)) : 100;

  return {
    currentBeats,
    expectedBeats,
    beatDiff,
    absDiff,
    isFull,
    isUnder,
    isOver,
    percentage,
  };
}

/**
 * Decompose a deficit in beats into a clean set of standard rest note durations
 * E.g. 1 -> [1], 0.5 -> [0.5], 1.5 -> [1, 0.5] or [1.5], 2 -> [2], 3 -> [2, 1] or [3]
 */
export function getRestDurationsForDeficit(deficit: number): NoteDuration[] {
  let remaining = Math.round(Math.abs(deficit) * 1000) / 1000;
  if (remaining <= 0) return [];

  // Match exact single rest values first
  const exactSupported: NoteDuration[] = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.125];
  if (exactSupported.includes(remaining)) {
    return [remaining];
  }

  const results: NoteDuration[] = [];
  const standardBeats = [4, 2, 1, 0.5, 0.25, 0.125];

  while (remaining >= 0.12) {
    let chosen: number | null = null;
    for (const b of standardBeats) {
      if (remaining >= b - 0.001) {
        chosen = b;
        break;
      }
    }
    if (chosen !== null) {
      results.push(chosen);
      remaining = Math.round((remaining - chosen) * 1000) / 1000;
    } else {
      break;
    }
  }

  return results.length > 0 ? results : [1];
}

export interface TaigiToneInfo {
  toneNumber: number;
  superscript: string; // e.g. '¹', '²', '³', '⁴', '⁵', '⁷', '⁸', '⁹'
  contour: string;     // e.g. '55', '51', '21', '32', '24', '33', '4', '55'
  symbol: string;      // e.g. '˥', '˥˩', '˨˩', '˨', '˨˦', '˧', '˦', '˥'
  name: string;        // e.g. 'Tone 1', 'Tone 2', 'Tone 3', etc.
}

/**
 * Extract Taiwanese Hokkien tone number and contour for learning aids.
 * Supports Pe̍h-ōe-jī (POJ), Tâi-lô (TL), and numeric tone notations.
 */
export function extractTaigiTone(syllable: string): TaigiToneInfo | null {
  if (!syllable || !syllable.trim()) return null;
  const s = syllable.trim();

  // If purely punctuation or CJK characters, return null
  if (/^[\p{P}\p{S}\s]+$/u.test(s) || /^[\u4e00-\u9fa5]+$/u.test(s)) return null;

  // 1. Check explicit digit tone (1-9) inside or at end of syllable
  const digitMatch = s.match(/([1-9])/);
  if (digitMatch) {
    const num = parseInt(digitMatch[1], 10);
    return getToneInfoByNumber(num);
  }

  // 2. Decompose unicode (NFD) to check combining diacritics
  const nfd = s.normalize('NFD');

  // Tone 8: vertical line \u030D, or explicit ̍ or vertical dot / bar
  if (nfd.includes('\u030D') || nfd.includes('\u0308') || /\|/.test(s) || /[a-z]+̍/i.test(s)) {
    return getToneInfoByNumber(8);
  }
  // Tone 9: double acute \u030B
  if (nfd.includes('\u030B')) {
    return getToneInfoByNumber(9);
  }
  // Tone 2: acute \u0301 (á, é, í, ó, ú, ḿ, ńg)
  if (nfd.includes('\u0301')) {
    return getToneInfoByNumber(2);
  }
  // Tone 3: grave \u0300 (à, è, ì, ò, ù)
  if (nfd.includes('\u0300')) {
    return getToneInfoByNumber(3);
  }
  // Tone 5: circumflex \u0302 (â, ê, î, ô, û)
  if (nfd.includes('\u0302')) {
    return getToneInfoByNumber(5);
  }
  // Tone 7: macron \u0304 (ā, ē, ī, ō, ū, m̄, n̄g)
  if (nfd.includes('\u0304')) {
    return getToneInfoByNumber(7);
  }

  // 3. No diacritic: check coda (ends with p, t, k, h)
  const cleanAlpha = s.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (/[ptkh]$/.test(cleanAlpha)) {
    return getToneInfoByNumber(4);
  }

  // If contains English letters, default unchecked tone is Tone 1
  if (/[a-zA-Z]/.test(s)) {
    return getToneInfoByNumber(1);
  }

  return null;
}

function getToneInfoByNumber(num: number): TaigiToneInfo {
  switch (num) {
    case 1:
      return { toneNumber: 1, superscript: '¹', contour: '55', symbol: '˥', name: 'Tone 1' };
    case 2:
      return { toneNumber: 2, superscript: '²', contour: '51', symbol: '˥˩', name: 'Tone 2' };
    case 3:
      return { toneNumber: 3, superscript: '³', contour: '21', symbol: '˨˩', name: 'Tone 3' };
    case 4:
      return { toneNumber: 4, superscript: '⁴', contour: '32', symbol: '˨', name: 'Tone 4' };
    case 5:
      return { toneNumber: 5, superscript: '⁵', contour: '24', symbol: '˨˦', name: 'Tone 5' };
    case 6:
      return { toneNumber: 6, superscript: '⁶', contour: '22', symbol: '˨', name: 'Tone 6' };
    case 7:
      return { toneNumber: 7, superscript: '⁷', contour: '33', symbol: '˧', name: 'Tone 7' };
    case 8:
      return { toneNumber: 8, superscript: '⁸', contour: '4', symbol: '˦', name: 'Tone 8' };
    case 9:
      return { toneNumber: 9, superscript: '⁹', contour: '55', symbol: '˥', name: 'Tone 9' };
    default:
      return { toneNumber: num, superscript: `${num}`, contour: '', symbol: '', name: `Tone ${num}` };
  }
}

export interface DiatonicChordOption {
  chord: string;
  degree: string;
  label: string;
  colorClass: string;
}

/**
 * Generate diatonic chords for any key signature (I, ii, iii, IV, V, vi, vii°, V7)
 */
export function getDiatonicChords(key: KeySignature): DiatonicChordOption[] {
  const flatKeys: KeySignature[] = ['F', 'Bb', 'Eb', 'Ab', 'Db'];
  const preferFlats = flatKeys.includes(key);

  const getRootName = (semitone: number): string => {
    const mod = ((semitone % 12) + 12) % 12;
    if (preferFlats) {
      const flatMap: Record<number, string> = {
        0: 'C', 1: 'Db', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F',
        6: 'Gb', 7: 'G', 8: 'Ab', 9: 'A', 10: 'Bb', 11: 'B'
      };
      return flatMap[mod];
    } else {
      const sharpMap: Record<number, string> = {
        0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E', 5: 'F',
        6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'A#', 11: 'B'
      };
      return sharpMap[mod];
    }
  };

  const base = KEY_SEMITONES[key] ?? 0;

  return [
    {
      chord: getRootName(base),
      degree: 'I',
      label: 'Tonic (I)',
      colorClass: 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    },
    {
      chord: `${getRootName(base + 2)}m`,
      degree: 'ii',
      label: 'Supertonic (ii)',
      colorClass: 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    },
    {
      chord: `${getRootName(base + 4)}m`,
      degree: 'iii',
      label: 'Mediant (iii)',
      colorClass: 'bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-900 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700',
    },
    {
      chord: getRootName(base + 5),
      degree: 'IV',
      label: 'Subdominant (IV)',
      colorClass: 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    },
    {
      chord: getRootName(base + 7),
      degree: 'V',
      label: 'Dominant (V)',
      colorClass: 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-950/60 dark:hover:bg-orange-900/60 text-orange-900 dark:text-orange-300 border-orange-300 dark:border-orange-700',
    },
    {
      chord: `${getRootName(base + 9)}m`,
      degree: 'vi',
      label: 'Submediant (vi)',
      colorClass: 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700',
    },
    {
      chord: `${getRootName(base + 7)}7`,
      degree: 'V7',
      label: 'Dominant 7th (V7)',
      colorClass: 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-700',
    },
  ];
}

// Instrument labels and options with bilingual Chinese / English descriptions
export const INSTRUMENT_LABELS: Record<InstrumentType, { en: string; zh: string }> = {
  piano: { en: 'Grand Piano', zh: '鋼琴' },
  flute: { en: 'Bamboo Flute', zh: '竹笛' },
  whistle: { en: 'Whistle', zh: '口笛' },
  guitar: { en: 'Acoustic Guitar', zh: '吉他' },
  synth: { en: '80s Synth', zh: '合成器' },
  bell: { en: 'Glockenspiel', zh: '鐘琴' },
};

export const INSTRUMENT_OPTIONS: { value: InstrumentType; labelZh: string; labelEn: string }[] = [
  { value: 'whistle', labelZh: '口笛', labelEn: 'Whistle (口笛)' },
  { value: 'flute', labelZh: '竹笛', labelEn: 'Bamboo Flute (竹笛)' },
  { value: 'piano', labelZh: '鋼琴', labelEn: 'Grand Piano (鋼琴)' },
  { value: 'guitar', labelZh: '吉他', labelEn: 'Acoustic Guitar (吉他)' },
  { value: 'synth', labelZh: '合成器', labelEn: '80s Synth (合成器)' },
  { value: 'bell', labelZh: '鐘琴', labelEn: 'Glockenspiel (鐘琴)' },
];

/**
 * Extract all chords from a measure, supporting both measure.chords array and measure.chord string
 * (space-, dash-, pipe-, or comma-separated, e.g. "Bb F", "Bb - F", "C | G", "Dm, G7")
 */
export function getMeasureChords(measure?: Partial<Measure> | { chord?: string; chords?: string[] } | null): string[] {
  if (!measure) return [];
  if (Array.isArray(measure.chords) && measure.chords.length > 0) {
    const list = measure.chords.map(c => c.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }
  if (measure.chord && typeof measure.chord === 'string') {
    return measure.chord
      .split(/[\s,\-|]+/)
      .map(c => c.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Format an array of chords for measure.chord string storage and clean display
 */
export function formatMeasureChords(chords: string[]): string {
  return chords.map(c => c.trim()).filter(Boolean).join(' ');
}

/**
 * Scales a note duration down by half (÷2), preserving dotted relationships and non-notation spacers.
 * e.g., 4 -> 2, 3 -> 1.5 (dotted), 2 -> 1, 1.5 -> 0.75 (dotted), 1 -> 0.5, 0.75 -> 0.375 (dotted), 0.5 -> 0.25, 0.25 -> 0.125
 */
export function halveNoteDuration(note: JianpuNote): JianpuNote {
  if (isNonNotationItem(note) || note.pitch === 'empty' || (typeof note.duration === 'number' && note.duration <= 0)) {
    return note;
  }
  const curDur = typeof note.duration === 'number' ? note.duration : 1;
  let nextDur: NoteDuration = 0.5;
  let isDotted = false;

  if (curDur >= 4) {
    nextDur = 2;
  } else if (curDur >= 3) {
    nextDur = 1.5;
    isDotted = true;
  } else if (curDur >= 2) {
    nextDur = 1;
  } else if (curDur >= 1.75) {
    nextDur = 0.75;
    isDotted = true;
  } else if (curDur >= 1.5) {
    nextDur = 0.75;
    isDotted = true;
  } else if (curDur >= 1) {
    nextDur = 0.5;
  } else if (curDur >= 0.75) {
    nextDur = 0.375;
    isDotted = true;
  } else if (curDur >= 0.5) {
    nextDur = 0.25;
  } else if (curDur >= 0.375) {
    nextDur = 0.125;
  } else if (curDur >= 0.25) {
    nextDur = 0.125;
  } else {
    nextDur = 0.125;
  }

  return {
    ...note,
    duration: nextDur,
    isDotted,
    isDoubleDotted: false,
  };
}

/**
 * Doubles a note duration (×2), preserving dotted relationships and non-notation spacers.
 * e.g., 0.125 -> 0.25, 0.25 -> 0.5, 0.375 -> 0.75 (dotted), 0.5 -> 1, 0.75 -> 1.5 (dotted), 1 -> 2, 1.5 -> 3 (dotted), 2 -> 4
 */
export function doubleNoteDuration(note: JianpuNote): JianpuNote {
  if (isNonNotationItem(note) || note.pitch === 'empty' || (typeof note.duration === 'number' && note.duration <= 0)) {
    return note;
  }
  const curDur = typeof note.duration === 'number' ? note.duration : 1;
  let nextDur: NoteDuration = 1;
  let isDotted = false;

  if (curDur <= 0.125) {
    nextDur = 0.25;
  } else if (curDur <= 0.25) {
    nextDur = 0.5;
  } else if (curDur <= 0.375) {
    nextDur = 0.75;
    isDotted = true;
  } else if (curDur <= 0.5) {
    nextDur = 1;
  } else if (curDur <= 0.75) {
    nextDur = 1.5;
    isDotted = true;
  } else if (curDur <= 1) {
    nextDur = 2;
  } else if (curDur <= 1.5) {
    nextDur = 3;
    isDotted = true;
  } else if (curDur <= 2) {
    nextDur = 4;
  } else {
    nextDur = 4;
  }

  return {
    ...note,
    duration: nextDur,
    isDotted,
    isDoubleDotted: false,
  };
}

/**
 * Sets uniform duration for a note, preserving lyrics, pitches, and zero-beat spacers.
 */
export function setUniformNoteDuration(note: JianpuNote, targetDur: NoteDuration): JianpuNote {
  if (isNonNotationItem(note) || note.pitch === 'empty' || (typeof note.duration === 'number' && note.duration <= 0)) {
    return note;
  }
  const isDotted = targetDur === 1.5 || targetDur === 0.75 || targetDur === 3 || targetDur === 0.375;
  const isDoubleDotted = targetDur === 1.75 || targetDur === 3.5;
  return {
    ...note,
    duration: targetDur,
    isDotted,
    isDoubleDotted,
  };
}

/**
 * Determines whether a measure (or set of measures) should toggle to 0.5 (8th note) or 1.0 (quarter note).
 * If most pitched/rest notes are >= 0.8, toggles to 0.5. Otherwise, toggles to 1.0.
 */
export function determineTargetQuarterEighthDuration(measures: Measure[]): 0.5 | 1.0 {
  let quarterOrHigherCount = 0;
  let eighthOrLowerCount = 0;

  for (const m of measures) {
    for (const n of m.notes) {
      if (isNonNotationItem(n) || n.pitch === 'empty' || (typeof n.duration === 'number' && n.duration <= 0)) continue;
      const dur = typeof n.duration === 'number' ? n.duration : 1;
      if (dur >= 0.8) {
        quarterOrHigherCount++;
      } else {
        eighthOrLowerCount++;
      }
    }
  }

  // If mostly quarter or longer, toggle to eighth note (0.5); else toggle to quarter note (1.0)
  return quarterOrHigherCount >= eighthOrLowerCount ? 0.5 : 1.0;
}

