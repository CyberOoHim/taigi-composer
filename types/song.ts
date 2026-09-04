export type TimeSignature = '4/4' | '3/4' | '2/4' | '6/8';

export type KeySignature = 'C' | 'Db' | 'D' | 'Eb' | 'E' | 'F' | 'F#' | 'G' | 'Ab' | 'A' | 'Bb' | 'B';

export type PitchNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'empty';

export type NoteDuration = 4 | 3.5 | 3 | 2 | 1.75 | 1.5 | 1.25 | 1 | 0.75 | 0.667 | 0.5 | 0.375 | 0.333 | 0.25 | 0.125 | number;

export interface GraceNote {
  id?: string;
  pitch: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  octave: number;           // -2, -1, 0, 1, 2 (dots below / above)
  accidental?: '' | '#' | 'b';
}

export type ArticulationType = 'none' | 'staccato' | 'tenuto' | 'accent' | 'fermata' | 'portamento_up' | 'portamento_down';

export interface LyricSyllable {
  poj?: string;     // 羅馬字 (白話字 / POJ / Pe̍h-ōe-jī) e.g. "Bāng", "Ú", "chhun-hong"
  hanlo?: string;   // 漢羅 (Hàn-lô: 純漢字或漢羅合用) e.g. "望", "雨", "阮ê"
  /** @deprecated Legacy Hanji field for backward compatibility */
  hanji?: string;
  /** @deprecated Legacy custom/Hanlo field for backward compatibility */
  custom?: string;
  /** @deprecated Legacy Tâi-lô field for backward compatibility */
  tl?: string;
}

export interface JianpuNote {
  id: string;
  pitch: PitchNumber;       // 1-7 (pitch), 0 (rest), or 'empty' (blank notation / space for punctuation/annotation)
  octave: number;           // -2, -1, 0, 1, 2 (dots below / above)
  accidental?: '' | '#' | 'b'; // Sharp or Flat
  duration: NoteDuration;   // in beats (1 = quarter note, 0.5 = 8th note, etc.)
  isDotted?: boolean;       // Display dot
  isDoubleDotted?: boolean; // Display double dot (e.g. 1.75 or 3.5 beats)
  isTied?: boolean;         // Legacy tie/slur to next note
  tieToNext?: boolean;      // True Tie: combines same pitch into one continuous sustained sound
  slurToNext?: boolean;     // Slur: legato phrasing & melisma across different pitches
  preGraceNotes?: GraceNote[];  // 1 to 3 pre-grace notes (前裝飾音 / 前倚音)
  postGraceNotes?: GraceNote[]; // 1 to 3 post-grace notes (後裝飾音 / 尾裝飾音)
  isTriplet?: boolean;      // Part of a 3-note triplet
  articulation?: ArticulationType; // Performance articulation (e.g. staccato, fermata, accent, etc.)
  lyric: LyricSyllable;     // Aligned lyric or punctuation
  annotation?: string;      // Optional musical / vocal annotation (e.g., 漸慢, 合唱, 間奏, rit., V, etc.)
  instrument?: InstrumentType; // Individual note sound source override
}

export type NumberedNotationNote = JianpuNote;

export type BarlineType = 'single' | 'double' | 'end' | 'repeat_start' | 'repeat_end';

export interface Measure {
  id: string;
  measureNumber: number;
  chord?: string;           // e.g. "F", "C7", "Am", "Dm", "G", "Bb F"
  chords?: string[];        // Multiple chords array e.g. ["Bb", "F"]
  timeSignature?: TimeSignature; // If measure changes time signature
  section?: string;         // e.g. "Intro", "Verse 1", "Chorus", "Bridge"
  notes: JianpuNote[];
  barlineType?: BarlineType; // Custom barline style at end of measure ('single' | 'double' | 'end' | 'repeat_start' | 'repeat_end')
  isLineBreak?: boolean;    // True if this measure marks the end of a line / forces a system break
}

export interface Song {
  id: string;
  title: string;
  subtitle?: string;
  composer?: string;
  lyricist?: string;
  key: KeySignature;
  timeSignature: TimeSignature;
  bpm: number;
  measures: Measure[];
  notesPerLine?: number;    // Measures per line display (default 4)
  description?: string;
}

export type LyricDisplayMode =
  | 'roman'               // 1. 羅馬字
  | 'hanlo'               // 2. 漢羅
  | 'roman_major_hanlo'   // 3. 羅馬字（主）+ 漢羅 (羅馬字 is major, 漢羅 is smaller sub on top)
  | 'hanlo_major_roman'   // 4. 漢羅（主）+ 羅馬字 (漢羅 is major, 羅馬字 is smaller sub on top)
  | 'all'
  | 'hanji_poj'
  | 'hanji_only'
  | 'poj_only'
  | 'custom_only';

export type InstrumentType = 'piano' | 'flute' | 'whistle' | 'guitar' | 'synth' | 'bell';

export type EditorEditMode = 'verse' | 'measure';

export interface VerseNoteRef {
  note: JianpuNote;
  measureIdx: number;
  noteIdx: number;
  measureIndex: number;
  noteIndex: number;
  measureNumber: number;
  chord?: string;
  section?: string;
  isFirstInMeasure: boolean;
}

export interface VerseItem {
  id: string;
  verseIndex: number;
  notes: VerseNoteRef[];
  startMeasureNumber: number;
  endMeasureNumber: number;
  section?: string;
  chords: string[];
  lyricSummary: {
    poj: string;
    hanlo: string;
    hanji?: string;
    custom?: string;
    tl?: string;
  };
}
