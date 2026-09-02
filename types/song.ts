export type TimeSignature = '4/4' | '3/4' | '2/4' | '6/8';

export type KeySignature = 'C' | 'Db' | 'D' | 'Eb' | 'E' | 'F' | 'F#' | 'G' | 'Ab' | 'A' | 'Bb' | 'B';

export type PitchNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'empty';

export type NoteDuration = 4 | 3 | 2 | 1.75 | 1.5 | 1.25 | 1 | 0.75 | 0.5 | 0.375 | 0.25 | 0.125 | number;

export interface LyricSyllable {
  hanji?: string;   // 漢字 e.g. "望"
  poj?: string;     // 白話字 e.g. "Bāng"
  pij?: string;     // 臺灣閩南語羅馬字 (臺羅) e.g. "Bāng"
  custom?: string;  // 漢羅合用 / 自訂 e.g. "阮ê", "chhun-hong", 標點 "，", "—"
}

export interface JianpuNote {
  id: string;
  pitch: PitchNumber;       // 1-7 (pitch), 0 (rest), or 'empty' (blank notation / space for punctuation/annotation)
  octave: number;           // -2, -1, 0, 1, 2 (dots below / above)
  accidental?: '' | '#' | 'b'; // Sharp or Flat
  duration: NoteDuration;   // in beats (1 = quarter note, 0.5 = 8th note, etc.)
  isDotted?: boolean;       // Display dot
  isTied?: boolean;         // Slur/Tie to next note
  lyric: LyricSyllable;     // Aligned lyric or punctuation
  annotation?: string;      // Optional musical / vocal annotation (e.g., 漸慢, 合唱, 間奏, rit., V, etc.)
}

export interface Measure {
  id: string;
  measureNumber: number;
  chord?: string;           // e.g. "F", "C7", "Am", "Dm", "G"
  timeSignature?: TimeSignature; // If measure changes time signature
  section?: string;         // e.g. "Intro", "Verse 1", "Chorus", "Bridge"
  notes: JianpuNote[];
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

export type LyricDisplayMode = 'all' | 'hanji_poj' | 'hanji_pij' | 'hanji_only' | 'poj_only' | 'pij_only' | 'custom_only';

export type InstrumentType = 'piano' | 'flute' | 'guitar' | 'synth' | 'bell';
