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
import { frequencyToMidi, midiToFrequency, frequencyToCents } from './yinDetector.ts';

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
 * Map an integer MIDI note number to Numbered Notation pitch (1-7), octave (-2..2), and accidental.
 *
 * @param midi MIDI note number (e.g. 60 = C4, 69 = A4). If null, treated as rest (pitch 0).
 * @param key Song key signature (e.g. 'C', 'F', 'G')
 * @param options Mapping configuration (accidental preference, octave shift)
 */
export function midiToNumberedPitch(
  midi: number | null,
  key: KeySignature = 'C',
  options?: {
    accidentalPreference?: 'sharp' | 'flat' | 'auto';
    octaveShift?: number;
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

  const roundedMidi = Math.round(midi);
  const tonicSemitone = KEY_SEMITONES[key] ?? 0;
  const octaveShift = options?.octaveShift ?? 0;

  // Base tonic MIDI note in octave 4 (e.g. C4 = 60, D4 = 62, F4 = 65, G4 = 67)
  const baseTonicMidi = 60 + tonicSemitone;

  // Interval difference in semitones from the base tonic note
  const offsetFromTonic = roundedMidi - baseTonicMidi;

  // Degree index in [0..11] semitones above the tonic
  const degreeIndex = ((offsetFromTonic % 12) + 12) % 12;

  // Octave relative to octave 4 tonic
  const calculatedOctave = Math.floor(offsetFromTonic / 12) + octaveShift;
  const clampedOctave = Math.max(-2, Math.min(2, calculatedOctave));

  // Determine accidental mapping table
  const pref = options?.accidentalPreference ?? 'auto';
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
  const nearestMidi = Math.round(exactMidi);
  const targetFrequency = midiToFrequency(nearestMidi);
  const centsOff = Math.round(frequencyToCents(frequencyHz, targetFrequency) * 10) / 10;

  const baseInfo = midiToNumberedPitch(nearestMidi, key, options);

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
 * Allowed standard discrete musical durations based on quantization grid.
 */
function getStandardDurationsForGrid(grid: QuantizeGrid, allowTriplets = false): NoteDuration[] {
  let list: NoteDuration[] = [];

  switch (grid) {
    case 'quarter':
      list = [4, 3, 2, 1];
      break;
    case 'eighth':
      list = [4, 3, 2, 1.5, 1, 0.75, 0.5];
      break;
    case 'sixteenth':
      list = [4, 3.5, 3, 2, 1.75, 1.5, 1.25, 1, 0.75, 0.5, 0.375, 0.25];
      break;
    case 'thirtysecond':
      list = [4, 3.5, 3, 2, 1.75, 1.5, 1.25, 1, 0.75, 0.5, 0.375, 0.25, 0.125];
      break;
    default:
      list = [4, 3, 2, 1.5, 1, 0.75, 0.5];
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
  allowTriplets: boolean = false
): QuantizedDurationResult {
  const msPerBeat = 60000 / Math.max(20, Math.min(300, bpm));
  const rawBeats = durationMs / msPerBeat;

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

  // If raw duration exceeds 4 beats, allow sustained notes across multiple measures
  if (rawBeats > 4) {
    const wholeBeats = Math.round(rawBeats);
    const subFrac = rawBeats - Math.floor(rawBeats);
    const fracCandidates = candidates.filter(c => c < 1);
    let bestFrac = 0;
    let minFracErr = Math.abs(subFrac);
    for (const fc of fracCandidates) {
      const err = Math.abs(subFrac - fc);
      if (err < minFracErr) {
        minFracErr = err;
        bestFrac = fc;
      }
    }

    const option1 = wholeBeats;
    const option2 = Math.floor(rawBeats) + bestFrac;
    const err1 = Math.abs(rawBeats - option1);
    const err2 = Math.abs(rawBeats - option2);
    const bestDuration = err1 <= err2 ? option1 : option2;

    return {
      duration: bestDuration,
      isDotted: false,
      isDoubleDotted: false,
      isTriplet: false,
      rawBeats: Math.round(rawBeats * 1000) / 1000,
      quantizationErrorBeats: Math.round((bestDuration - rawBeats) * 1000) / 1000,
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
 * Merge consecutive rests and filter out transient micro-glitches.
 */
export function cleanRawSegments(
  segments: RawNoteSegment[],
  minDurationMs: number = 60,
  trimSilence: boolean = true
): RawNoteSegment[] {
  if (segments.length === 0) return [];

  // Filter out spurious voiced notes below minimum duration threshold
  const filtered = segments.filter(seg => {
    if (seg.midi === null) return true; // Keep rests for now to preserve timing
    return seg.durationMs >= minDurationMs;
  });

  if (filtered.length === 0) return [];

  // Merge consecutive silence / rest segments
  const merged: RawNoteSegment[] = [];
  for (const seg of filtered) {
    const prev = merged[merged.length - 1];
    if (prev && prev.midi === null && seg.midi === null) {
      prev.endTimeMs = seg.endTimeMs;
      prev.durationMs += seg.durationMs;
      prev.avgRms = Math.max(prev.avgRms, seg.avgRms);
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
  return merged.slice(startIndex, endIndex + 1);
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

  const cleaned = cleanRawSegments(segments, minDurationMs, trimSilence);
  if (cleaned.length === 0) return [];

  const notes: NumberedNotationNote[] = [];

  cleaned.forEach((seg, index) => {
    const quant = quantizeDurationToBeats(seg.durationMs, bpm, grid, allowTriplets);

    let pitch: PitchNumber = 0;
    let octave = 0;
    let accidental: '' | '#' | 'b' = '';

    if (seg.midi !== null && typeof seg.midi === 'number') {
      const pitchInfo = midiToNumberedPitch(seg.midi, key, {
        accidentalPreference: options.accidentalPreference,
        octaveShift: options.octaveShift,
      });
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

      // If current measure is completely filled, flush it first
      if (remainingBeatsInMeasure <= 0.001) {
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
        const dur1 = remainingBeatsInMeasure;
        const dur2 = Math.round((noteDur - remainingBeatsInMeasure) * 1000) / 1000;

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
  }
): TranscriptionResult {
  return transcribeAudioSegmentsToMeasures(segments, {
    ...config,
    keyboardMode: true,
    minDurationMs: config.minDurationMs ?? 25,
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
