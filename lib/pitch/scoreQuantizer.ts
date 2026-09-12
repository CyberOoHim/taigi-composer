/**
 * Score Quantizer & Numbered Notation Converter
 *
 * Converts raw acoustic/voice time-pitch segments (from NoteSegmenter)
 * into quantized NumberedNotationNote objects and structured Measure arrays.
 *
 * Handles:
 * 1. Frequency/MIDI to scale degree mapping (1-7, octaves, accidentals relative to song key)
 * 2. Tempo-synchronized beat-grid duration quantization (whole, half, quarter, eighth, sixteenth, triplets)
 * 3. Measure barline boundary splitting with musical ties (tieToNext: true)
 * 4. Automatic rest merging, noise filtering, and key alignment
 */

import type {
  KeySignature,
  Measure,
  NoteDuration,
  NumberedNotationNote,
  PitchNumber,
  TimeSignature,
} from '../../types/song.ts';
import type { RawNoteSegment } from './onsetDetector.ts';
export function midiToFrequency(midi: number): number { return 440 * Math.pow(2, (midi - 69) / 12); }
export function frequencyToMidi(frequencyHz: number): number { return 69 + 12 * Math.log2(frequencyHz / 440); }
export function frequencyToCents(frequencyHz: number, referenceHz: number): number { return 1200 * Math.log2(frequencyHz / referenceHz); }

// Semitones relative to C (MIDI note 60)
export const KEY_SEMITONES: Record<string, number> = {
  'C': 0,
  'C#': 1,
  'Db': 1,
  'D': 2,
  'D#': 3,
  'Eb': 3,
  'E': 4,
  'F': 5,
  'F#': 6,
  'Gb': 6,
  'G': 7,
  'G#': 8,
  'Ab': 8,
  'A': 9,
  'A#': 10,
  'Bb': 10,
  'B': 11,
};

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

/**
 * Decompose a deficit in beats into a clean set of standard rest note durations
 */
export function getRestDurationsForDeficit(deficit: number): NoteDuration[] {
  let remaining = Math.round(Math.abs(deficit) * 1000) / 1000;
  if (remaining <= 0) return [];

  const exactSupported: NoteDuration[] = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.125];
  if (exactSupported.includes(remaining)) {
    return [remaining];
  }

  const result: NoteDuration[] = [];
  const standardRests: NoteDuration[] = [4, 2, 1, 0.5, 0.25, 0.125];
  for (const r of standardRests) {
    while (remaining >= r - 0.001) {
      result.push(r);
      remaining = Math.round((remaining - r) * 1000) / 1000;
    }
  }
  return result;
}

export type QuantizeGrid = 'quarter' | 'eighth' | 'sixteenth' | 'thirtysecond';
export type ScaleMode = 'diatonic' | 'pentatonic' | 'chromatic';

export interface QuantizeOptions {
  bpm: number;                              // Tempo in beats per minute (default: 80)
  key: KeySignature;                        // Song key (e.g. 'C', 'F', 'G', 'Bb')
  grid?: QuantizeGrid;                      // Grid resolution (default: 'eighth' / 0.5 beat)
  allowTriplets?: boolean;                  // Enable triplet quantization (default: false)
  accidentalPreference?: 'sharp' | 'flat' | 'auto'; // Accidental spelling preference (default: 'auto')
  octaveShift?: number;                     // Manual octave transposition (-2 to +2)
  minDurationMs?: number;                   // Filter out notes shorter than this in ms (default: 70 or 25 in keyboardMode)
  trimSilence?: boolean;                    // Trim leading and trailing rests (default: true)
  keyboardMode?: boolean;                   // Enable crisp keyboard performance mode (disables acoustic noise filters)
  scaleMode?: ScaleMode;                    // Intelligent scale degree attraction (default: 'diatonic' for voice, 'chromatic' for keyboard)
  absorbArticulationGaps?: boolean;         // Absorb short inter-note vocal release/breath gaps (default: true for voice, false for keyboard)
  maxArticulationGapMs?: number;            // Max articulation gap duration in ms to absorb (default: ~240ms or 0.38 beat)
  filterOneFingerGaps?: boolean;            // Auto-bridge single-finger keyboard transit gaps (default: false)
  oneFingerMaxGapMs?: number;               // Max transit silence to bridge; defaults to a grid-aware cap below one rest
}

export interface MeasureLayoutOptions {
  timeSignature: TimeSignature;             // Target time signature (e.g. '4/4', '3/4', '2/4', '6/8')
  startMeasureNumber?: number;              // Initial measure number (default: 1)
  autoFillTrailingRests?: boolean;          // Auto-fill incomplete final measure with rests (default: false)
  idPrefix?: string;                        // ID prefix for generated measures and notes
}

export interface NumberedPitchInfo {
  pitch: PitchNumber;                       // 1-7, 0 (rest), or 'empty'
  octave: number;                           // -2, -1, 0, 1, 2
  accidental: '' | '#' | 'b';
  centsOff: number;                         // Tuning error in cents (-50 to +50)
  degreeIndex: number;                      // Semitone offset from key tonic (0 to 11)
  midi: number | null;
}

export interface QuantizedDurationResult {
  duration: NoteDuration;
  isDotted: boolean;
  isDoubleDotted: boolean;
  isTriplet: boolean;
  rawBeats: number;
  quantizationErrorBeats: number;
}

export interface TranscriptionSummary {
  totalNotes: number;
  totalMeasures: number;
  totalBeats: number;
  totalDurationMs: number;
  averagePitchAccuracyCents: number;
  detectedTonicHint?: KeySignature;
}

export interface TranscriptionResult {
  measures: Measure[];
  notes: NumberedNotationNote[];
  summary: TranscriptionSummary;
}

// Flat-preferring keys in standard music theory
const FLAT_KEYS: ReadonlySet<KeySignature> = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db']);

/**
 * Maps chromatic semitone offset (0-11) relative to tonic into numbered notation degree (1-7) and accidental.
 */
interface ScaleDegreeMapping {
  pitch: PitchNumber;
  accidental: '' | '#' | 'b';
}

const SHARP_MAPPINGS: Record<number, ScaleDegreeMapping> = {
  0: { pitch: 1, accidental: '' },
  1: { pitch: 1, accidental: '#' },
  2: { pitch: 2, accidental: '' },
  3: { pitch: 2, accidental: '#' },
  4: { pitch: 3, accidental: '' },
  5: { pitch: 4, accidental: '' },
  6: { pitch: 4, accidental: '#' },
  7: { pitch: 5, accidental: '' },
  8: { pitch: 5, accidental: '#' },
  9: { pitch: 6, accidental: '' },
  10: { pitch: 6, accidental: '#' },
  11: { pitch: 7, accidental: '' },
};

const FLAT_MAPPINGS: Record<number, ScaleDegreeMapping> = {
  0: { pitch: 1, accidental: '' },
  1: { pitch: 2, accidental: 'b' },
  2: { pitch: 2, accidental: '' },
  3: { pitch: 3, accidental: 'b' },
  4: { pitch: 3, accidental: '' },
  5: { pitch: 4, accidental: '' },
  6: { pitch: 5, accidental: 'b' },
  7: { pitch: 5, accidental: '' },
  8: { pitch: 6, accidental: 'b' },
  9: { pitch: 6, accidental: '' },
  10: { pitch: 7, accidental: 'b' },
  11: { pitch: 7, accidental: '' },
};

/**
 * Standard hybrid mapping optimal for Taiwanese folk and pentatonic music:
 * - Uses #4 (tritone / Lydian)
 * - Uses b7 (subtonic / Mixolydian)
 * - Uses b3 (minor third / pentatonic variation)
 */
const CANONICAL_MAPPINGS: Record<number, ScaleDegreeMapping> = {
  0: { pitch: 1, accidental: '' },
  1: { pitch: 1, accidental: '#' },
  2: { pitch: 2, accidental: '' },
  3: { pitch: 3, accidental: 'b' },
  4: { pitch: 3, accidental: '' },
  5: { pitch: 4, accidental: '' },
  6: { pitch: 4, accidental: '#' },
  7: { pitch: 5, accidental: '' },
  8: { pitch: 6, accidental: 'b' },
  9: { pitch: 6, accidental: '' },
  10: { pitch: 7, accidental: 'b' },
  11: { pitch: 7, accidental: '' },
};

/**
 * Intelligent scale degree attraction:
 * Snaps continuous pitch deviations toward diatonic (or pentatonic) scale degrees,
 * suppressing unintentional vocal intonation errors (e.g. humming Do +50 cents -> #1)
 * while preserving authentic Taiwanese folk inflections (b7, #4, b3) when held intentionally.
 */
export function applyScaleDegreeAttraction(
  semitoneInOctave: number,
  scaleMode: ScaleMode = 'diatonic',
  accidentalPref: 'sharp' | 'flat' | 'auto' = 'auto'
): number {
  if (scaleMode === 'chromatic') {
    return Math.round(semitoneInOctave) % 12;
  }

  // Normalize into [0, 12)
  const norm = ((semitoneInOctave % 12) + 12) % 12;

  if (scaleMode === 'diatonic') {
    // 1 (0) to 2 (2): Semitone 1 (#1 / b2) is virtually never used in diatonic humming.
    if (norm < 2.0) {
      if (accidentalPref === 'sharp' && norm >= 0.80 && norm <= 1.20) return 1;
      return norm < 1.35 ? 0 : 2;
    }

    // 2 (2) to 3 (4): Semitone 3 is b3 (minor 3rd pentatonic / blues inflection).
    if (norm < 4.0) {
      if (norm >= 2.75 && norm <= 3.25) return 3; // Intentional b3
      return norm < 2.75 ? 2 : 4;
    }

    // 3 (4) to 4 (5): Natural diatonic half step.
    if (norm < 5.0) {
      return norm < 4.5 ? 4 : 5;
    }

    // 4 (5) to 5 (7): Semitone 6 is #4 (Lydian / folk tritone).
    if (norm < 7.0) {
      if (norm >= 5.75 && norm <= 6.25) return 6; // Intentional #4
      return norm < 5.75 ? 5 : 7;
    }

    // 5 (7) to 6 (9): Semitone 8 (#5 / b6) is non-scale.
    if (norm < 9.0) {
      if (accidentalPref === 'sharp' && norm >= 7.80 && norm <= 8.20) return 8;
      return norm < 8.0 ? 7 : 9;
    }

    // 6 (9) to 7 (11): Semitone 10 is b7 (very common Taiwanese folk subtonic!).
    if (norm < 11.0) {
      if (norm >= 9.65 && norm <= 10.35) return 10; // Intentional b7
      return norm < 9.65 ? 9 : 11;
    }

    // 7 (11) to high 1 (12 -> 0): Natural diatonic half step.
    return norm < 11.5 ? 11 : 0;
  }

  if (scaleMode === 'pentatonic') {
    // Pentatonic scale degrees: 1 (0), 2 (2), 3 (4), 5 (7), 6 (9).
    if (norm < 2.0) return norm < 1.0 ? 0 : 2;
    if (norm < 4.0) {
      if (norm >= 2.75 && norm <= 3.25) return 3; // Folk b3
      return norm < 3.0 ? 2 : 4;
    }
    // Snap 4 (Fa, 5) to 3 (4) or 5 (7)
    if (norm < 7.0) {
      if (norm >= 5.75 && norm <= 6.25) return 6; // Folk #4
      return norm < 5.5 ? 4 : 7;
    }
    if (norm < 9.0) return norm < 8.0 ? 7 : 9;
    // Snap 7 (Ti, 11) to 6 (9) or high 1 (0)
    if (norm < 12.0) {
      if (norm >= 9.65 && norm <= 10.35) return 10; // Folk b7
      return norm < 10.5 ? 9 : 0;
    }
  }

  return Math.round(norm) % 12;
}

/**
 * Map an integer MIDI note number to Numbered Notation pitch (1-7), octave (-2..2), and accidental.
 *
 * @param midi MIDI note number (e.g. 60 = C4, 69 = A4). If null, treated as rest (pitch 0).
 * @param key Song key signature (e.g. 'C', 'F', 'G')
 * @param options Mapping configuration (accidental preference, octave shift, scaleMode)
 */
export function midiToNumberedPitch(
  midi: number | null,
  key: KeySignature = 'C',
  options?: {
    accidentalPreference?: 'sharp' | 'flat' | 'auto';
    octaveShift?: number;
    scaleMode?: ScaleMode;
  }
): NumberedPitchInfo {
  if (midi === null || isNaN(midi) || midi <= 0) {
    return {
      pitch: 0,
      octave: 0,
      accidental: '',
      centsOff: 0,
      degreeIndex: 0,
      midi: null,
    };
  }

  const tonicSemitone = KEY_SEMITONES[key] ?? 0;
  const octaveShift = options?.octaveShift ?? 0;
  const pref = options?.accidentalPreference ?? 'auto';
  const scaleMode = options?.scaleMode;

  // Base tonic MIDI note in octave 4 (e.g. C4 = 60, D4 = 62, F4 = 65, G4 = 67)
  const baseTonicMidi = 60 + tonicSemitone;

  let roundedMidi = Math.round(midi);
  let offsetFromTonic = roundedMidi - baseTonicMidi;

  // If fractional MIDI is passed and scale attraction is active, apply attraction
  if (scaleMode && scaleMode !== 'chromatic' && Math.abs(midi - roundedMidi) > 0.05) {
    const rawOffset = midi - baseTonicMidi;
    const semitoneInOct = ((rawOffset % 12) + 12) % 12;
    const snapped = applyScaleDegreeAttraction(semitoneInOct, scaleMode, pref);
    let delta = snapped - semitoneInOct;
    if (delta > 6) delta -= 12;
    else if (delta < -6) delta += 12;
    roundedMidi = Math.round(midi + delta);
    offsetFromTonic = roundedMidi - baseTonicMidi;
  }

  // Degree index in [0..11] semitones above the tonic
  const degreeIndex = ((offsetFromTonic % 12) + 12) % 12;

  // Octave relative to octave 4 tonic
  const calculatedOctave = Math.floor(offsetFromTonic / 12) + octaveShift;
  const clampedOctave = Math.max(-2, Math.min(2, calculatedOctave));

  // Determine accidental mapping table
  let mappingTable = CANONICAL_MAPPINGS;
  if (pref === 'sharp') {
    mappingTable = SHARP_MAPPINGS;
  } else if (pref === 'flat') {
    mappingTable = FLAT_MAPPINGS;
  } else if (FLAT_KEYS.has(key)) {
    mappingTable = FLAT_MAPPINGS;
  }

  const mapped = mappingTable[degreeIndex] || { pitch: 1, accidental: '' };

  return {
    pitch: mapped.pitch,
    octave: clampedOctave,
    accidental: mapped.accidental,
    centsOff: 0,
    degreeIndex,
    midi: roundedMidi,
  };
}

/**
 * Map an analog frequency (in Hz) directly to Numbered Notation pitch, octave, accidental, and cents error.
 */
export function frequencyToNumberedPitch(
  frequencyHz: number | null,
  key: KeySignature = 'C',
  options?: {
    accidentalPreference?: 'sharp' | 'flat' | 'auto';
    octaveShift?: number;
    scaleMode?: ScaleMode;
  }
): NumberedPitchInfo {
  if (!frequencyHz || frequencyHz <= 0) {
    return {
      pitch: 0,
      octave: 0,
      accidental: '',
      centsOff: 0,
      degreeIndex: 0,
      midi: null,
    };
  }

  const exactMidi = frequencyToMidi(frequencyHz);
  const tonicSemitone = KEY_SEMITONES[key] ?? 0;
  const scaleMode = options?.scaleMode ?? 'diatonic';
  const pref = options?.accidentalPreference ?? 'auto';

  // Base tonic MIDI note in octave 4 (e.g. C4 = 60, D4 = 62, F4 = 65, G4 = 67)
  const baseTonicMidi = 60 + tonicSemitone;
  const offsetFromTonic = exactMidi - baseTonicMidi;
  const semitoneInOctave = ((offsetFromTonic % 12) + 12) % 12;

  // Apply intelligent scale attraction to avoid accidental false sharps/flats
  const snappedSemitone = applyScaleDegreeAttraction(semitoneInOctave, scaleMode, pref);
  let semitoneDelta = snappedSemitone - semitoneInOctave;
  if (semitoneDelta > 6) semitoneDelta -= 12;
  else if (semitoneDelta < -6) semitoneDelta += 12;

  const targetMidi = Math.round(exactMidi + semitoneDelta);
  const targetFrequency = midiToFrequency(targetMidi);
  const centsOff = Math.round(frequencyToCents(frequencyHz, targetFrequency) * 10) / 10;

  const baseInfo = midiToNumberedPitch(targetMidi, key, options);

  return {
    ...baseInfo,
    centsOff,
  };
}

/**
 * Returns the grid unit in musical beats for a given QuantizeGrid setting.
 */
export function getGridBeatValue(grid: QuantizeGrid = 'eighth'): number {
  switch (grid) {
    case 'quarter':
      return 1.0;
    case 'eighth':
      return 0.5;
    case 'sixteenth':
      return 0.25;
    case 'thirtysecond':
      return 0.125;
    default:
      return 0.5;
  }
}

/**
 * Snap a beat position to the nearest quantization grid line.
 */
export function snapBeatsToGrid(beats: number, grid: QuantizeGrid = 'eighth'): number {
  const step = getGridBeatValue(grid);
  if (step <= 0) return Math.max(0, beats);
  return Math.round(Math.max(0, beats) / step) * step;
}

/**
 * Max inter-note silence to treat as finger transit / staccato release rather
 * than a written rest. Always strictly below one grid rest so an 8th rest at
 * 80 BPM (375ms) is not swallowed by a fixed 450ms one-finger window.
 */
export function computeGridAwareGapMs(
  bpm: number = 80,
  grid: QuantizeGrid = 'eighth',
  configuredMaxMs: number = 450
): number {
  const msPerBeat = 60000 / Math.max(20, Math.min(300, bpm));
  const gridMs = msPerBeat * getGridBeatValue(grid);
  return Math.round(Math.min(configuredMaxMs, Math.max(80, gridMs * 0.65)));
}

/**
 * Rebuild keyboard segments so each event starts on the metronome grid beat
 * that matches the real key-press time, not the independently quantized hold.
 *
 * Duration:
 * - Onset always comes from key-down.
 * - If the player held at least one grid unit and then waited at least one
 *   grid unit, keep the rest (♪ 0).
 * - If the hold or the gap is shorter than that (staccato tap, finger hop),
 *   write the duration through to the next key-down so on-beat taps become
 *   beat-length notes instead of a pile of eighths and rests.
 */
export function alignSegmentsToOnsetGrid(
  segments: RawNoteSegment[],
  bpm: number,
  grid: QuantizeGrid = 'eighth',
  minDurationMs: number = 25
): RawNoteSegment[] {
  if (segments.length === 0) return [];

  const msPerBeat = 60000 / Math.max(20, Math.min(300, bpm));
  const step = getGridBeatValue(grid);
  const gapThresholdMs = computeGridAwareGapMs(bpm, grid);
  const beatsToMs = (beats: number) => Math.round(beats * msPerBeat);
  const snapBeat = (ms: number) => snapBeatsToGrid(Math.max(0, ms) / msPerBeat, grid);

  const filtered = segments.filter(seg => seg.midi === null || seg.durationMs >= minDurationMs);
  if (filtered.length === 0) return [];

  const pitched = filtered.filter(seg => seg.midi !== null);
  if (pitched.length === 0) {
    return filtered.map(seg => {
      const startBeat = snapBeat(seg.startTimeMs);
      const endBeat = Math.max(snapBeat(seg.endTimeMs), startBeat + step);
      const startTimeMs = beatsToMs(startBeat);
      const endTimeMs = beatsToMs(endBeat);
      return {
        ...seg,
        startTimeMs,
        endTimeMs,
        durationMs: Math.max(1, endTimeMs - startTimeMs),
        pitchSamples: seg.pitchSamples ? [...seg.pitchSamples] : [],
      };
    });
  }

  type AlignedEvent = {
    startBeat: number;
    endBeat: number;
    rawStartMs: number;
    rawEndMs: number;
    midi: number | null;
    frequencyHz: number | null;
    avgRms: number;
    pitchSamples: number[];
  };

  const events: AlignedEvent[] = pitched.map(seg => ({
    startBeat: snapBeat(seg.startTimeMs),
    endBeat: snapBeat(seg.endTimeMs),
    rawStartMs: seg.startTimeMs,
    rawEndMs: seg.endTimeMs,
    midi: seg.midi,
    frequencyHz: seg.frequencyHz,
    avgRms: seg.avgRms,
    pitchSamples: seg.pitchSamples ? [...seg.pitchSamples] : [],
  }));

  for (let i = 1; i < events.length; i++) {
    const minStart = Math.round((events[i - 1].startBeat + step) * 1000) / 1000;
    if (events[i].startBeat < minStart - 0.001) {
      const shift = minStart - events[i].startBeat;
      events[i].startBeat = minStart;
      events[i].endBeat = Math.round((events[i].endBeat + shift) * 1000) / 1000;
    }
  }

  for (const ev of events) {
    if (ev.endBeat <= ev.startBeat + 0.001) {
      ev.endBeat = Math.round((ev.startBeat + step) * 1000) / 1000;
    }
  }

  const aligned: RawNoteSegment[] = [];
  const pushRange = (startBeat: number, endBeat: number, src: AlignedEvent | null) => {
    const durBeats = Math.round((endBeat - startBeat) * 1000) / 1000;
    if (durBeats <= 0.001) return;
    const startTimeMs = beatsToMs(startBeat);
    const endTimeMs = beatsToMs(endBeat);
    aligned.push({
      startTimeMs,
      endTimeMs,
      durationMs: Math.max(1, endTimeMs - startTimeMs),
      midi: src?.midi ?? null,
      frequencyHz: src?.midi != null ? src.frequencyHz : null,
      avgRms: src?.midi != null ? src.avgRms : 0,
      pitchSamples: src?.midi != null ? src.pitchSamples : [],
    });
  };

  const firstStart = events[0].startBeat;
  if (firstStart > 0.001) {
    pushRange(0, firstStart, null);
  }

  let trailEndMs = 0;
  for (const seg of filtered) {
    trailEndMs = Math.max(trailEndMs, seg.endTimeMs);
  }

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const startBeat = ev.startBeat;
    const holdEnd = Math.max(ev.endBeat, Math.round((startBeat + step) * 1000) / 1000);

    if (i < events.length - 1) {
      const nextStart = events[i + 1].startBeat;
      const rawHoldMs = ev.rawEndMs - ev.rawStartMs;
      const rawGapMs = events[i + 1].rawStartMs - ev.rawEndMs;
      const keepRest = rawHoldMs >= gapThresholdMs && rawGapMs >= gapThresholdMs;
      if (keepRest) {
        const noteEnd = Math.min(nextStart, holdEnd);
        pushRange(startBeat, noteEnd, ev);
        pushRange(noteEnd, nextStart, null);
      } else {
        pushRange(startBeat, nextStart, ev);
      }
    } else {
      pushRange(startBeat, holdEnd, ev);
      const trailEndBeat = snapBeat(trailEndMs);
      if (trailEndBeat > holdEnd + 0.001) {
        pushRange(holdEnd, trailEndBeat, null);
      }
    }
  }

  return aligned;
}

/**
 * Allowed standard discrete musical durations based on quantization grid.
 */
function getStandardDurationsForGrid(grid: QuantizeGrid, allowTriplets = false): NoteDuration[] {
  let list: NoteDuration[] = [];

  switch (grid) {
    case 'quarter':
      list = [4, 3, 2, 1];
      break;
    case 'eighth':
      list = [4, 3.5, 3, 2.5, 2, 1.5, 1, 0.75, 0.5];
      break;
    case 'sixteenth':
      list = [4, 3.75, 3.5, 3.25, 3, 2.75, 2.5, 2.25, 2, 1.75, 1.5, 1.25, 1, 0.75, 0.5, 0.375, 0.25];
      break;
    case 'thirtysecond':
      list = [4, 3.75, 3.5, 3.25, 3, 2.75, 2.5, 2.25, 2, 1.75, 1.5, 1.25, 1, 0.75, 0.5, 0.375, 0.25, 0.125];
      break;
    default:
      list = [4, 3.5, 3, 2.5, 2, 1.5, 1, 0.75, 0.5];
  }

  if (allowTriplets) {
    list.push(0.333, 0.667);
    list.sort((a, b) => b - a);
  }

  return list;
}

/**
 * Quantize a raw duration (in milliseconds or beats) to the nearest standard musical duration.
 *
 * @param durationMs Duration of segment in milliseconds
 * @param bpm Beats per minute (e.g. 80)
 * @param grid Resolution grid ('quarter', 'eighth', 'sixteenth', 'thirtysecond')
 * @param allowTriplets Whether to consider triplet values (0.333, 0.667)
 */
export function quantizeDurationToBeats(
  durationMs: number,
  bpm: number = 80,
  grid: QuantizeGrid = 'eighth',
  allowTriplets: boolean = false,
  keyboardMode: boolean = false
): QuantizedDurationResult {
  const msPerBeat = 60000 / Math.max(20, Math.min(300, bpm));
  const rawBeats = durationMs / msPerBeat;

  // In keyboardMode (live screen piano, QWERTY typing, Web MIDI), human key press duration
  // should naturally map to standard musical beat lengths (0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4+ beats)
  // with human performance tolerance, preventing tenuto notes (e.g. 0.70-0.95 beat)
  // from erroneously fragmenting into dotted eighths and rests.
  if (keyboardMode) {
    let kbDuration: NoteDuration | null = null;
    if (grid === 'quarter') {
      if (rawBeats >= 4.4) kbDuration = Math.round(rawBeats) as NoteDuration;
      else if (rawBeats >= 3.6) kbDuration = 4;
      else if (rawBeats >= 2.6) kbDuration = 3;
      else if (rawBeats >= 1.6) kbDuration = 2;
      else kbDuration = 1;
    } else if (grid === 'eighth') {
      if (rawBeats >= 4.4) {
        // Multi-measure or ultra-long held notes snap to half-beat grid
        kbDuration = (Math.round(rawBeats * 2) / 2) as NoteDuration;
      }
      else if (rawBeats >= 3.65) kbDuration = 4;
      else if (rawBeats >= 3.25 && rawBeats < 3.65) kbDuration = 3.5;
      else if (rawBeats >= 2.65 && rawBeats < 3.25) kbDuration = 3;
      else if (rawBeats >= 2.25 && rawBeats < 2.65) kbDuration = 2.5;
      else if (rawBeats >= 1.65 && rawBeats < 2.25) kbDuration = 2;
      else if (rawBeats >= 1.35 && rawBeats < 1.65) kbDuration = 1.5;
      else if (rawBeats >= 0.70) kbDuration = 1;
      else if (allowTriplets && rawBeats >= 0.58 && rawBeats < 0.75) kbDuration = 0.667;
      else if (allowTriplets && rawBeats >= 0.28 && rawBeats < 0.42) kbDuration = 0.333;
      else if (rawBeats >= 0.35) kbDuration = 0.5;
      else kbDuration = 0.5;
    } else if (grid === 'sixteenth' || grid === 'thirtysecond') {
      if (rawBeats >= 4.4) {
        const step = getGridBeatValue(grid);
        kbDuration = (Math.round(rawBeats / step) * step) as NoteDuration;
      }
      else if (rawBeats >= 3.75) kbDuration = 4;
      else if (rawBeats >= 3.35 && rawBeats < 3.75) kbDuration = 3.5;
      else if (rawBeats >= 2.75 && rawBeats < 3.35) kbDuration = 3;
      else if (rawBeats >= 2.35 && rawBeats < 2.75) kbDuration = 2.5;
      else if (rawBeats >= 1.80 && rawBeats < 2.35) kbDuration = 2;
      else if (rawBeats >= 1.65 && rawBeats < 1.80) kbDuration = 1.75;
      else if (rawBeats >= 1.35 && rawBeats < 1.65) kbDuration = 1.5;
      else if (rawBeats >= 1.15 && rawBeats < 1.35) kbDuration = 1.25;
      else if (rawBeats >= 0.85 && rawBeats <= 1.15) kbDuration = 1;
      else if (rawBeats >= 0.65 && rawBeats < 0.85) kbDuration = 0.75;
      else if (rawBeats >= 0.38 && rawBeats < 0.65) kbDuration = 0.5;
      else if (rawBeats >= 0.18 && rawBeats < 0.38) kbDuration = 0.25;
      else kbDuration = getGridBeatValue(grid);
    }

    if (kbDuration !== null) {
      const isDotted =
        kbDuration === 1.5 ||
        kbDuration === 0.75 ||
        kbDuration === 3 ||
        kbDuration === 0.375;
      const isDoubleDotted = kbDuration === 1.75 || kbDuration === 3.5;
      const isTriplet = kbDuration === 0.333 || kbDuration === 0.667;
      return {
        duration: kbDuration,
        isDotted,
        isDoubleDotted,
        isTriplet,
        rawBeats: Math.round(rawBeats * 1000) / 1000,
        quantizationErrorBeats: Math.round((kbDuration - rawBeats) * 1000) / 1000,
      };
    }
  }

  // Vocal & acoustic duration curves with human articulation tolerance
  if (!keyboardMode && rawBeats <= 4.3) {
    const formatRes = (d: NoteDuration): QuantizedDurationResult => {
      const isDotted = d === 1.5 || d === 0.75 || d === 3 || d === 0.375;
      const isDoubleDotted = d === 1.75 || d === 3.5;
      const isTriplet = d === 0.333 || d === 0.667;
      return {
        duration: d,
        isDotted,
        isDoubleDotted,
        isTriplet,
        rawBeats: Math.round(rawBeats * 1000) / 1000,
        quantizationErrorBeats: Math.round((d - rawBeats) * 1000) / 1000,
      };
    };

    if (grid === 'quarter') {
      if (rawBeats >= 3.65) return formatRes(4);
      if (rawBeats >= 2.65) return formatRes(3);
      if (rawBeats >= 1.65) return formatRes(2);
      return formatRes(1);
    }

    if (grid === 'eighth') {
      if (rawBeats >= 3.65) return formatRes(4);
      if (rawBeats >= 3.25 && rawBeats < 3.65) return formatRes(3.5);
      if (rawBeats >= 2.65 && rawBeats < 3.25) return formatRes(3);
      if (rawBeats >= 2.25 && rawBeats < 2.65) return formatRes(2.5);
      if (rawBeats >= 1.68 && rawBeats < 2.25) return formatRes(2);
      if (rawBeats >= 1.28 && rawBeats < 1.68) return formatRes(1.5);
      if (allowTriplets && rawBeats >= 0.58 && rawBeats < 0.72) return formatRes(0.667);
      if (allowTriplets && rawBeats >= 0.28 && rawBeats < 0.42) return formatRes(0.333);
      // Preserve benchmark exact 0.75 in [0.72, 0.78)
      if (rawBeats >= 0.72 && rawBeats < 0.78) return formatRes(0.75);
      // Human vocal quarter note window (e.g. 0.78 to 1.28 beats)
      if (rawBeats >= 0.78) return formatRes(1.0);
      if (rawBeats >= 0.35) return formatRes(0.5);
      return formatRes(0.5);
    }

    if (grid === 'sixteenth' || grid === 'thirtysecond') {
      if (rawBeats >= 3.75) return formatRes(4);
      if (rawBeats >= 3.35 && rawBeats < 3.75) return formatRes(3.5);
      if (rawBeats >= 2.75 && rawBeats < 3.35) return formatRes(3);
      if (rawBeats >= 2.35 && rawBeats < 2.75) return formatRes(2.5);
      if (rawBeats >= 1.85 && rawBeats < 2.35) return formatRes(2);
      if (rawBeats >= 1.68 && rawBeats < 1.85) return formatRes(1.75);
      if (rawBeats >= 1.35 && rawBeats < 1.68) return formatRes(1.5);
      if (rawBeats >= 1.18 && rawBeats < 1.35) return formatRes(1.25);
      if (rawBeats >= 0.85 && rawBeats <= 1.18) return formatRes(1);
      if (rawBeats >= 0.65 && rawBeats < 0.85) return formatRes(0.75);
      if (allowTriplets && rawBeats >= 0.58 && rawBeats < 0.65) return formatRes(0.667);
      if (rawBeats >= 0.42 && rawBeats < 0.65) return formatRes(0.5);
      if (rawBeats >= 0.32 && rawBeats < 0.42) return formatRes(0.375);
      if (allowTriplets && rawBeats >= 0.28 && rawBeats < 0.32) return formatRes(0.333);
      if (rawBeats >= 0.18 && rawBeats < 0.32) return formatRes(0.25);
      return formatRes(getGridBeatValue(grid));
    }
  }

  const minGridUnit = getGridBeatValue(grid);
  const candidates = getStandardDurationsForGrid(grid, allowTriplets);

  // If raw duration is smaller than half the minimum grid unit, snap to the minimum grid unit
  if (rawBeats < minGridUnit * 0.5) {
    return {
      duration: minGridUnit,
      isDotted: minGridUnit === 0.75 || minGridUnit === 1.5 || minGridUnit === 3,
      isDoubleDotted: minGridUnit === 1.75 || minGridUnit === 3.5,
      isTriplet: false,
      rawBeats: Math.round(rawBeats * 1000) / 1000,
      quantizationErrorBeats: Math.round((minGridUnit - rawBeats) * 1000) / 1000,
    };
  }

  // If raw duration exceeds 4 beats, allow sustained continuous notes across multiple measures
  if (rawBeats > 4) {
    const step = getGridBeatValue(grid);
    const quantizedBeats = Math.round(rawBeats / step) * step;
    return {
      duration: quantizedBeats as NoteDuration,
      isDotted: false,
      isDoubleDotted: false,
      isTriplet: false,
      rawBeats: Math.round(rawBeats * 1000) / 1000,
      quantizationErrorBeats: Math.round((quantizedBeats - rawBeats) * 1000) / 1000,
    };
  }

  // Find candidate with smallest absolute distance
  let bestDuration = candidates[0];
  let minError = Math.abs(rawBeats - bestDuration);

  for (const candidate of candidates) {
    const error = Math.abs(rawBeats - candidate);
    if (error < minError) {
      minError = error;
      bestDuration = candidate;
    }
  }

  const isDotted =
    bestDuration === 1.5 ||
    bestDuration === 0.75 ||
    bestDuration === 3 ||
    bestDuration === 0.375;

  const isDoubleDotted = bestDuration === 1.75 || bestDuration === 3.5;
  const isTriplet = bestDuration === 0.333 || bestDuration === 0.667;

  return {
    duration: bestDuration,
    isDotted,
    isDoubleDotted,
    isTriplet,
    rawBeats: Math.round(rawBeats * 1000) / 1000,
    quantizationErrorBeats: Math.round((bestDuration - rawBeats) * 1000) / 1000,
  };
}

/**
 * Merge consecutive rests, merge adjacent same-pitch continuous segments,
 * filter out transient micro-glitches, absorb short vocal articulation release/breath gaps,
 * and optionally filter out inter-note transition gaps from one-finger keyboard playing.
 */
export function cleanRawSegments(
  segments: RawNoteSegment[],
  minDurationMs: number = 60,
  trimSilence: boolean = true,
  absorbGaps: boolean = false,
  bpm: number = 80,
  maxGapMs?: number,
  filterOneFingerGaps: boolean = false,
  oneFingerMaxGapMs: number = 450
): RawNoteSegment[] {
  if (segments.length === 0) return [];

  // Filter out spurious voiced notes below minimum duration threshold
  const filtered = segments.filter(seg => {
    if (seg.midi === null) return true; // Keep rests for now to preserve timing
    return seg.durationMs >= minDurationMs;
  });

  if (filtered.length === 0) return [];

  // Merge consecutive silence / rest segments OR consecutive voiced segments with the same pitch
  const merged: RawNoteSegment[] = [];
  for (const seg of filtered) {
    const prev = merged[merged.length - 1];
    if (prev && prev.midi === null && seg.midi === null) {
      prev.endTimeMs = seg.endTimeMs;
      prev.durationMs += seg.durationMs;
      prev.avgRms = Math.max(prev.avgRms, seg.avgRms);
    } else if (
      prev &&
      prev.midi !== null &&
      seg.midi !== null &&
      Math.abs(prev.midi - seg.midi) <= 0.5 &&
      seg.startTimeMs - prev.endTimeMs <= (maxGapMs ?? 180)
    ) {
      // Merge consecutive voiced segments of same pitch (prevents splitting continuous sound)
      prev.endTimeMs = seg.endTimeMs;
      prev.durationMs = seg.endTimeMs - prev.startTimeMs;
      prev.avgRms = Math.max(prev.avgRms, seg.avgRms);
      if (prev.pitchSamples && seg.pitchSamples) {
        prev.pitchSamples = [...prev.pitchSamples, ...seg.pitchSamples];
      }
      if (prev.frequencyHz && seg.frequencyHz) {
        prev.frequencyHz = (prev.frequencyHz + seg.frequencyHz) / 2;
      }
    } else {
      merged.push({ ...seg });
    }
  }

  // Trim leading and trailing rests if requested
  let startIndex = 0;
  let endIndex = merged.length - 1;

  if (trimSilence) {
    while (startIndex < merged.length && merged[startIndex].midi === null) {
      startIndex++;
    }
    while (endIndex >= startIndex && merged[endIndex].midi === null) {
      endIndex--;
    }
  }

  if (startIndex > endIndex) return [];
  const trimmed = merged.slice(startIndex, endIndex + 1);

  if ((!absorbGaps && !filterOneFingerGaps) || trimmed.length <= 1) {
    return trimmed;
  }

  // Articulation gap absorption & One-finger transit gap filtering:
  // 1. When filterOneFingerGaps is ON: transit silence between keys (<= oneFingerMaxGapMs)
  //    is absorbed into the previous note to eliminate redundant '0' rests from lifting fingers.
  // 2. When absorbGaps is ON (hum mode): vocal breath/syllable gaps are absorbed.
  const msPerBeat = 60000 / Math.max(20, Math.min(300, bpm));
  const maxThresholdMs = filterOneFingerGaps
    ? oneFingerMaxGapMs
    : (maxGapMs ?? Math.min(260, Math.max(120, msPerBeat * 0.38)));

  const result: RawNoteSegment[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    const current = trimmed[i];

    // Check if current is a silence segment between two voiced segments
    if (
      current.midi === null &&
      result.length > 0 &&
      result[result.length - 1].midi !== null &&
      i + 1 < trimmed.length &&
      trimmed[i + 1].midi !== null
    ) {
      const prevVoiced = result[result.length - 1];
      const nextVoiced = trimmed[i + 1];

      // If next note has the same pitch and gap is small, merge them into one continuous note!
      if (
        prevVoiced.midi !== null &&
        nextVoiced.midi !== null &&
        Math.abs(prevVoiced.midi - nextVoiced.midi) <= 0.5 &&
        current.durationMs <= maxThresholdMs
      ) {
        prevVoiced.endTimeMs = nextVoiced.endTimeMs;
        prevVoiced.durationMs = nextVoiced.endTimeMs - prevVoiced.startTimeMs;
        if (prevVoiced.pitchSamples && nextVoiced.pitchSamples) {
          prevVoiced.pitchSamples = [...prevVoiced.pitchSamples, ...nextVoiced.pitchSamples];
        }
        i++; // Skip both current rest and nextVoiced note because it was merged
        continue;
      }

      if (current.durationMs <= maxThresholdMs) {
        // Absorb gap entirely into previous note (bridges one-finger move time)
        prevVoiced.endTimeMs = current.endTimeMs;
        prevVoiced.durationMs += current.durationMs;
        continue;
      } else {
        // Long gap represents an intentional musical rest.
        if (filterOneFingerGaps) {
          // Keep explicit rest as-is when exceeding oneFingerMaxGapMs
          result.push({ ...current });
          continue;
        }

        // Vocal mode: absorb standard articulation release padding so previous note ends on beat boundary
        const releasePadding = Math.min(140, Math.max(0, current.durationMs - (msPerBeat * 0.5)));
        if (releasePadding > 40) {
          prevVoiced.endTimeMs += releasePadding;
          prevVoiced.durationMs += releasePadding;
          current.startTimeMs += releasePadding;
          current.durationMs -= releasePadding;
        }
      }
    }

    result.push({ ...current });
  }

  return result;
}

/**
 * Converts raw pitch segments into a sequence of NumberedNotationNote objects.
 *
 * @param segments Raw acoustic segments from onset detector
 * @param options Quantization configuration
 */
export function quantizeRawSegments(
  segments: RawNoteSegment[],
  options: QuantizeOptions
): NumberedNotationNote[] {
  const bpm = options.bpm || 80;
  const key = options.key || 'C';
  const grid = options.grid || 'eighth';
  const allowTriplets = Boolean(options.allowTriplets);
  const minDurationMs = options.minDurationMs ?? (options.keyboardMode ? 25 : 60);
  const trimSilence = options.trimSilence ?? true;
  const absorbGaps = options.absorbArticulationGaps ?? (!options.keyboardMode);
  const scaleMode = options.scaleMode ?? (options.keyboardMode ? 'chromatic' : 'diatonic');
  const filterOneFingerGaps = Boolean(options.filterOneFingerGaps);
  const oneFingerMaxGapMs = options.oneFingerMaxGapMs ?? computeGridAwareGapMs(bpm, grid);

  const cleaned = cleanRawSegments(
    segments,
    minDurationMs,
    trimSilence,
    absorbGaps,
    bpm,
    options.maxArticulationGapMs,
    filterOneFingerGaps,
    oneFingerMaxGapMs
  );
  if (cleaned.length === 0) return [];

  const notes: NumberedNotationNote[] = [];

  cleaned.forEach((seg, index) => {
    const quant = quantizeDurationToBeats(
      seg.durationMs,
      bpm,
      grid,
      allowTriplets,
      options.keyboardMode
    );

    let pitch: PitchNumber = 0;
    let octave = 0;
    let accidental: '' | '#' | 'b' = '';

    if (seg.midi !== null && typeof seg.midi === 'number') {
      let pitchInfo: NumberedPitchInfo;
      if (seg.frequencyHz && seg.frequencyHz > 0) {
        pitchInfo = frequencyToNumberedPitch(seg.frequencyHz, key, {
          accidentalPreference: options.accidentalPreference,
          octaveShift: options.octaveShift,
          scaleMode,
        });
      } else {
        pitchInfo = midiToNumberedPitch(seg.midi, key, {
          accidentalPreference: options.accidentalPreference,
          octaveShift: options.octaveShift,
          scaleMode,
        });
      }
      pitch = pitchInfo.pitch;
      octave = pitchInfo.octave;
      accidental = pitchInfo.accidental;
    }

    notes.push({
      id: `transcribed-note-${index + 1}-${Date.now()}`,
      pitch,
      octave,
      accidental,
      duration: quant.duration,
      isDotted: quant.isDotted,
      isDoubleDotted: quant.isDoubleDotted,
      isTriplet: quant.isTriplet,
      lyric: {}, // Empty lyric ready for text entry or alignment
    });
  });

  return notes;
}

/**
 * Split a note duration across a measure boundary into two valid musical pieces.
 * Returns [part1Duration, part2Duration].
 */
export function splitDurationAtBarline(
  duration: number,
  remainingInMeasure: number
): [NoteDuration, NoteDuration] {
  const roundedRemaining = Math.round(remainingInMeasure * 1000) / 1000;
  const roundedDeficit = Math.round((duration - remainingInMeasure) * 1000) / 1000;

  return [roundedRemaining as NoteDuration, roundedDeficit as NoteDuration];
}

/**
 * Segment and layout notes into Measures, splitting notes that cross measure boundaries
 * and linking pitched notes with tieToNext: true.
 *
 * @param notes Sequence of quantized NumberedNotationNotes
 * @param options Measure layout options (timeSignature, startMeasureNumber, autoFillTrailingRests)
 */
export function segmentNotesIntoMeasures(
  notes: NumberedNotationNote[],
  options: MeasureLayoutOptions
): Measure[] {
  if (!notes || notes.length === 0) return [];

  const timeSig = options.timeSignature || '4/4';
  const targetBeats = getExpectedMeasureBeats(timeSig);
  const startMeasureNumber = options.startMeasureNumber ?? 1;
  const autoFillTrailing = Boolean(options.autoFillTrailingRests);
  const idPrefix = options.idPrefix || `trans-m-${Date.now()}`;

  const measures: Measure[] = [];
  let currentNotes: NumberedNotationNote[] = [];
  let currentBeats = 0;

  const pushCurrentMeasure = () => {
    if (currentNotes.length === 0) return;

    measures.push({
      id: `${idPrefix}-${startMeasureNumber + measures.length}`,
      measureNumber: startMeasureNumber + measures.length,
      timeSignature: timeSig,
      notes: [...currentNotes],
    });

    currentNotes = [];
    currentBeats = 0;
  };

  for (let i = 0; i < notes.length; i++) {
    const rawNote = notes[i];
    let noteToPlace: NumberedNotationNote = { ...rawNote };
    let noteDur = typeof noteToPlace.duration === 'number' ? noteToPlace.duration : 1;

    // Zero-duration spacers or punctuation pass directly into current measure
    if (noteDur <= 0) {
      currentNotes.push(noteToPlace);
      continue;
    }

    // Keep placing pieces of this note until its full duration is consumed
    while (noteDur > 0.001) {
      const remainingBeatsInMeasure = Math.round((targetBeats - currentBeats) * 1000) / 1000;

      // If current measure is completely filled or has microscopic space (< 0.06 beat), flush it first
      if (remainingBeatsInMeasure <= 0.06) {
        pushCurrentMeasure();
        continue;
      }

      // Case 1: Note fits completely inside remaining measure space
      if (noteDur <= remainingBeatsInMeasure + 0.001) {
        currentNotes.push({
          ...noteToPlace,
          duration: Math.round(noteDur * 1000) / 1000 as NoteDuration,
          isDotted: noteDur === 1.5 || noteDur === 0.75 || noteDur === 3 || noteDur === 0.375,
          isDoubleDotted: noteDur === 1.75 || noteDur === 3.5,
        });
        currentBeats = Math.round((currentBeats + noteDur) * 1000) / 1000;
        noteDur = 0;

        // If measure reached exact capacity, flush it
        if (Math.abs(currentBeats - targetBeats) < 0.001) {
          pushCurrentMeasure();
        }
      }
      // Case 2: Note overflows current measure boundary -> Split across barline!
      else {
        const overflow = Math.round((noteDur - remainingBeatsInMeasure) * 1000) / 1000;

        // Micro-overflow snap: if human timing overshot barline by less than 0.08 beat,
        // snap cleanly to barline rather than creating a tiny phantom tied fragment!
        if (overflow < 0.08) {
          currentNotes.push({
            ...noteToPlace,
            duration: Math.round(remainingBeatsInMeasure * 1000) / 1000 as NoteDuration,
            isDotted: remainingBeatsInMeasure === 1.5 || remainingBeatsInMeasure === 0.75 || remainingBeatsInMeasure === 3 || remainingBeatsInMeasure === 0.375,
            isDoubleDotted: remainingBeatsInMeasure === 1.75 || remainingBeatsInMeasure === 3.5,
            tieToNext: false,
          });
          currentBeats = targetBeats;
          pushCurrentMeasure();
          noteDur = 0;
          continue;
        }

        const dur1 = remainingBeatsInMeasure;
        const dur2 = overflow;

        const isPitchedNote =
          typeof noteToPlace.pitch === 'number' &&
          noteToPlace.pitch > 0;

        // Part 1 fills the remaining beats of the current measure
        const part1: NumberedNotationNote = {
          ...noteToPlace,
          id: `${noteToPlace.id}-tie1`,
          duration: dur1 as NoteDuration,
          isDotted: dur1 === 1.5 || dur1 === 0.75 || dur1 === 3 || dur1 === 0.375,
          isDoubleDotted: dur1 === 1.75 || dur1 === 3.5,
          // Pitched notes are tied across the barline; rests are NOT tied
          tieToNext: isPitchedNote ? true : false,
        };

        currentNotes.push(part1);
        currentBeats = targetBeats;
        pushCurrentMeasure();

        // Part 2 prepares for placement into the next measure
        noteToPlace = {
          ...noteToPlace,
          id: `${noteToPlace.id}-tie2`,
          duration: dur2 as NoteDuration,
          isDotted: dur2 === 1.5 || dur2 === 0.75 || dur2 === 3 || dur2 === 0.375,
          isDoubleDotted: dur2 === 1.75 || dur2 === 3.5,
          tieToNext: false,
          lyric: {}, // Clear lyric from continuation note to avoid double singing
        };
        noteDur = dur2;
      }
    }
  }

  // Handle any remaining notes in the last measure
  if (currentNotes.length > 0) {
    if (autoFillTrailing && currentBeats < targetBeats - 0.001) {
      const deficit = targetBeats - currentBeats;
      const restDurs = getRestDurationsForDeficit(deficit);
      restDurs.forEach((rDur, rIdx) => {
        currentNotes.push({
          id: `${idPrefix}-autorest-${rIdx + 1}`,
          pitch: 0,
          octave: 0,
          duration: rDur,
          lyric: {},
        });
      });
    }
    pushCurrentMeasure();
  }

  return measures;
}

/**
 * End-to-end transcription pipeline:
 * Converts raw audio segments from onset detector into fully formed, quantized measures.
 */
export function transcribeAudioSegmentsToMeasures(
  segments: RawNoteSegment[],
  config: {
    key: KeySignature;
    timeSignature: TimeSignature;
    bpm: number;
    grid?: QuantizeGrid;
    allowTriplets?: boolean;
    octaveShift?: number;
    accidentalPreference?: 'sharp' | 'flat' | 'auto';
    autoFillTrailingRests?: boolean;
    startMeasureNumber?: number;
    minDurationMs?: number;
    trimSilence?: boolean;
    keyboardMode?: boolean;
    scaleMode?: ScaleMode;
    absorbArticulationGaps?: boolean;
    maxArticulationGapMs?: number;
    filterOneFingerGaps?: boolean;
    oneFingerMaxGapMs?: number;
  }
): TranscriptionResult {
  const minDur = config.minDurationMs ?? (config.keyboardMode ? 25 : 60);
  const quantNotes = quantizeRawSegments(segments, {
    key: config.key,
    bpm: config.bpm,
    grid: config.grid || 'eighth',
    allowTriplets: config.allowTriplets,
    octaveShift: config.octaveShift,
    accidentalPreference: config.accidentalPreference,
    minDurationMs: minDur,
    trimSilence: config.trimSilence ?? true,
    keyboardMode: config.keyboardMode,
    scaleMode: config.scaleMode,
    absorbArticulationGaps: config.absorbArticulationGaps,
    maxArticulationGapMs: config.maxArticulationGapMs,
    filterOneFingerGaps: config.filterOneFingerGaps,
    oneFingerMaxGapMs: config.oneFingerMaxGapMs,
  });

  const measures = segmentNotesIntoMeasures(quantNotes, {
    timeSignature: config.timeSignature,
    startMeasureNumber: config.startMeasureNumber ?? 1,
    autoFillTrailingRests: config.autoFillTrailingRests,
  });

  // Calculate audio accuracy telemetry
  const voicedSegments = segments.filter(s => s.midi !== null && s.frequencyHz !== null);
  let totalCentsError = 0;
  voicedSegments.forEach(s => {
    if (s.frequencyHz && s.midi) {
      const targetFreq = midiToFrequency(s.midi);
      totalCentsError += Math.abs(frequencyToCents(s.frequencyHz, targetFreq));
    }
  });

  const avgCentsError =
    voicedSegments.length > 0
      ? Math.round((totalCentsError / voicedSegments.length) * 10) / 10
      : 0;

  const totalBeats = measures.reduce((sum, m) => {
    return sum + m.notes.reduce((nSum, n) => nSum + (typeof n.duration === 'number' ? n.duration : 0), 0);
  }, 0);

  const totalDurationMs =
    segments.length > 0
      ? segments[segments.length - 1].endTimeMs - segments[0].startTimeMs
      : 0;

  return {
    measures,
    notes: quantNotes,
    summary: {
      totalNotes: quantNotes.length,
      totalMeasures: measures.length,
      totalBeats: Math.round(totalBeats * 1000) / 1000,
      totalDurationMs,
      averagePitchAccuracyCents: avgCentsError,
    },
  };
}

/**
 * Specialized transcription pipeline for keyboard performances (screen piano, QWERTY typing, Web MIDI):
 * Snaps notes to rhythmic grid with responsive keyboard articulation thresholds.
 */
export function transcribeKeyboardSegmentsToMeasures(
  segments: RawNoteSegment[],
  config: {
    key: KeySignature;
    timeSignature: TimeSignature;
    bpm: number;
    grid?: QuantizeGrid;
    allowTriplets?: boolean;
    octaveShift?: number;
    accidentalPreference?: 'sharp' | 'flat' | 'auto';
    autoFillTrailingRests?: boolean;
    startMeasureNumber?: number;
    minDurationMs?: number;
    trimSilence?: boolean;
    filterOneFingerGaps?: boolean;
    oneFingerMaxGapMs?: number;
  }
): TranscriptionResult {
  const grid = config.grid || 'eighth';
  const minDur = config.minDurationMs ?? 25;
  const aligned = alignSegmentsToOnsetGrid(segments, config.bpm, grid, minDur);

  return transcribeAudioSegmentsToMeasures(aligned, {
    ...config,
    keyboardMode: true,
    minDurationMs: minDur,
    // Keep the leading rest so a key pressed on beat 3 stays on beat 3.
    trimSilence: false,
    // Onsets already encode real press times; do not merge repeated pitches
    // or absorb gaps (that would slide later notes off the metronome).
    absorbArticulationGaps: false,
    filterOneFingerGaps: false,
    maxArticulationGapMs: -1,
  });
}

/**
 * Transpose a list of NumberedNotationNotes by an integer number of octaves (-2 to +2).
 */
export function shiftOctaves(
  notes: NumberedNotationNote[],
  octaveDelta: number
): NumberedNotationNote[] {
  if (octaveDelta === 0) return notes;

  return notes.map(n => {
    if (typeof n.pitch !== 'number' || n.pitch <= 0) return n;
    const newOctave = Math.max(-2, Math.min(2, (n.octave || 0) + octaveDelta));
    return {
      ...n,
      octave: newOctave,
    };
  });
}

/**
 * Transpose NumberedNotationNotes when changing the reference key signature
 * while keeping identical sound pitches.
 */
export function transposeTranscribedNotes(
  notes: NumberedNotationNote[],
  fromKey: KeySignature,
  toKey: KeySignature
): NumberedNotationNote[] {
  if (fromKey === toKey) return notes;

  const fromSemitone = KEY_SEMITONES[fromKey] ?? 0;
  const toSemitone = KEY_SEMITONES[toKey] ?? 0;
  const semitoneShift = ((fromSemitone - toSemitone) % 12 + 12) % 12;

  if (semitoneShift === 0) return notes;

  return notes.map(n => {
    if (typeof n.pitch !== 'number' || n.pitch <= 0) return n;

    // Convert to relative semitones above old tonic
    const DEGREE_SEMITONES: Record<number, number> = {
      1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11,
    };
    let semi = DEGREE_SEMITONES[n.pitch] ?? 0;
    if (n.accidental === '#') semi += 1;
    if (n.accidental === 'b') semi -= 1;
    semi += (n.octave || 0) * 12;

    // Equivalent semitones relative to new key
    const newAbsoluteOffset = semi + (fromSemitone - toSemitone);
    const newDegreeIdx = ((newAbsoluteOffset % 12) + 12) % 12;
    const newOctave = Math.max(-2, Math.min(2, Math.floor(newAbsoluteOffset / 12)));

    const mapping = CANONICAL_MAPPINGS[newDegreeIdx] || { pitch: 1, accidental: '' };

    return {
      ...n,
      pitch: mapping.pitch,
      accidental: mapping.accidental,
      octave: newOctave,
    };
  });
}
