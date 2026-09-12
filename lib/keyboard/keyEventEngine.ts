/**
 * KeyEventEngine: Screen Piano, Musical Typing (QWERTY), and Web MIDI Input Engine
 *
 * Implements Stage 1 & 2 of the Keyboard-to-Score pipeline:
 * 1. High-resolution performance timestamping (microsecond accuracy via performance.now())
 * 2. Monophonic legato overlap resolution (instant note truncation upon next onset)
 * 3. Rest gap detection (converts idle inter-note pauses >= 80ms into discrete rests)
 * 4. QWERTY musical typing mapping for middle octave (A-K) and accidentals (W-U)
 * 5. Hardware Web MIDI input adapter (0x90 NoteOn, 0x80 NoteOff)
 * 6. Direct integration with ScoreQuantizer for beat-grid snapping and barline packing
 */

import type {
  KeySignature,
  Measure,
  NumberedNotationNote,
  PitchNumber,
  TimeSignature,
} from '../../types/song.ts';
import type { RawNoteSegment } from '../pitch/onsetDetector.ts';
import { midiToFrequency } from '../pitch/scoreQuantizer.ts';
import {
  KEY_SEMITONES,
  computeGridAwareGapMs,
  midiToNumberedPitch,
  transcribeKeyboardSegmentsToMeasures,
  type MeasureLayoutOptions,
  type QuantizeGrid,
  type QuantizeOptions,
  type TranscriptionResult,
} from '../pitch/scoreQuantizer.ts';

export interface QwertyKeyDefinition {
  code: string; // e.g. 'KeyA'
  keyChar: string; // e.g. 'a'
  midiOffset: number; // Semitones relative to C4 (MIDI 60)
  pitch: PitchNumber; // 1-7 in Key of C
  octaveOffset: number; // -1, 0, 1
  accidental: '' | '#' | 'b';
  solfege: string; // e.g. 'Do', 'Re', 'Di'
  isBlack: boolean;
  label: string; // Display label e.g. '1', '♯1', '2'
}

/**
 * Standard DAW / GarageBand / Ableton-style QWERTY musical typing layout
 * Diatonic (White Keys):
 *   A -> 1 (Do, C4)
 *   S -> 2 (Re, D4)
 *   D -> 3 (Mi, E4)
 *   F -> 4 (Fa, F4)
 *   G -> 5 (Sol, G4)
 *   H -> 6 (La, A4)
 *   J -> 7 (Ti, B4)
 *   K -> 1̇ (High Do, C5)
 *   L -> 2̇ (High Re, D5)
 *   Semicolon -> 3̇ (High Mi, E5)
 *   Quote -> 4̇ (High Fa, F5)
 *
 * Chromatic (Black Keys):
 *   W -> ♯1 / ♭2 (C#4/Db4)
 *   E -> ♯2 / ♭3 (D#4/Eb4)
 *   T -> ♯4 / ♭5 (F#4/Gb4)
 *   Y -> ♯5 / ♭6 (G#4/Ab4)
 *   U -> ♯6 / ♭7 (A#4/Bb4)
 *   O -> ♯1̇ / ♭2̇ (C#5/Db5)
 *   P -> ♯2̇ / ♭3̇ (D#5/Eb5)
 */
export const QWERTY_KEY_DEFINITIONS: QwertyKeyDefinition[] = [
  // White keys - Middle Octave
  { code: 'KeyA', keyChar: 'a', midiOffset: 0, pitch: 1, octaveOffset: 0, accidental: '', solfege: 'Do', isBlack: false, label: '1' },
  { code: 'KeyS', keyChar: 's', midiOffset: 2, pitch: 2, octaveOffset: 0, accidental: '', solfege: 'Re', isBlack: false, label: '2' },
  { code: 'KeyD', keyChar: 'd', midiOffset: 4, pitch: 3, octaveOffset: 0, accidental: '', solfege: 'Mi', isBlack: false, label: '3' },
  { code: 'KeyF', keyChar: 'f', midiOffset: 5, pitch: 4, octaveOffset: 0, accidental: '', solfege: 'Fa', isBlack: false, label: '4' },
  { code: 'KeyG', keyChar: 'g', midiOffset: 7, pitch: 5, octaveOffset: 0, accidental: '', solfege: 'Sol', isBlack: false, label: '5' },
  { code: 'KeyH', keyChar: 'h', midiOffset: 9, pitch: 6, octaveOffset: 0, accidental: '', solfege: 'La', isBlack: false, label: '6' },
  { code: 'KeyJ', keyChar: 'j', midiOffset: 11, pitch: 7, octaveOffset: 0, accidental: '', solfege: 'Ti', isBlack: false, label: '7' },
  // White keys - High Octave
  { code: 'KeyK', keyChar: 'k', midiOffset: 12, pitch: 1, octaveOffset: 1, accidental: '', solfege: 'Do', isBlack: false, label: '1̇' },
  { code: 'KeyL', keyChar: 'l', midiOffset: 14, pitch: 2, octaveOffset: 1, accidental: '', solfege: 'Re', isBlack: false, label: '2̇' },
  { code: 'Semicolon', keyChar: ';', midiOffset: 16, pitch: 3, octaveOffset: 1, accidental: '', solfege: 'Mi', isBlack: false, label: '3̇' },
  { code: 'Quote', keyChar: "'", midiOffset: 17, pitch: 4, octaveOffset: 1, accidental: '', solfege: 'Fa', isBlack: false, label: '4̇' },

  // Black keys - Middle Octave
  { code: 'KeyW', keyChar: 'w', midiOffset: 1, pitch: 1, octaveOffset: 0, accidental: '#', solfege: 'Di', isBlack: true, label: '♯1' },
  { code: 'KeyE', keyChar: 'e', midiOffset: 3, pitch: 2, octaveOffset: 0, accidental: '#', solfege: 'Ri', isBlack: true, label: '♯2' },
  { code: 'KeyT', keyChar: 't', midiOffset: 6, pitch: 4, octaveOffset: 0, accidental: '#', solfege: 'Fi', isBlack: true, label: '♯4' },
  { code: 'KeyY', keyChar: 'y', midiOffset: 8, pitch: 5, octaveOffset: 0, accidental: '#', solfege: 'Si', isBlack: true, label: '♯5' },
  { code: 'KeyU', keyChar: 'u', midiOffset: 10, pitch: 6, octaveOffset: 0, accidental: '#', solfege: 'Li', isBlack: true, label: '♯6' },
  // Black keys - High Octave
  { code: 'KeyO', keyChar: 'o', midiOffset: 13, pitch: 1, octaveOffset: 1, accidental: '#', solfege: 'Di', isBlack: true, label: '♯1̇' },
  { code: 'KeyP', keyChar: 'p', midiOffset: 15, pitch: 2, octaveOffset: 1, accidental: '#', solfege: 'Ri', isBlack: true, label: '♯2̇' },
];

// Lookup maps for fast O(1) event routing
const QWERTY_BY_CODE = new Map<string, QwertyKeyDefinition>();
const QWERTY_BY_KEY = new Map<string, QwertyKeyDefinition>();
for (const def of QWERTY_KEY_DEFINITIONS) {
  QWERTY_BY_CODE.set(def.code.toLowerCase(), def);
  QWERTY_BY_KEY.set(def.keyChar.toLowerCase(), def);
}

/**
 * Movable Solfege interval offsets from root 1 (semitones)
 */
const MOVABLE_DEGREE_OFFSETS: Record<string, number> = {
  KeyA: 0, // 1
  KeyW: 1, // #1 / b2
  KeyS: 2, // 2
  KeyE: 3, // #2 / b3
  KeyD: 4, // 3
  KeyF: 5, // 4
  KeyT: 6, // #4 / b5
  KeyG: 7, // 5
  KeyY: 8, // #5 / b6
  KeyH: 9, // 6
  KeyU: 10, // #6 / b7
  KeyJ: 11, // 7
  KeyK: 12, // High 1
  KeyO: 13, // High #1
  KeyL: 14, // High 2
  KeyP: 15, // High #2
  Semicolon: 16, // High 3
  Quote: 17, // High 4
};

export type QwertyMappingMode = 'chromatic_piano' | 'movable_solfege';

/**
 * Compute an adaptive silence / rest threshold based on BPM.
 * At 80 BPM, a beat is 750ms -> 750 * 0.35 ≈ 263ms.
 * Clamped between 180ms and 380ms so natural finger release transients
 * are not mistaken for intentional musical rests (0).
 */
export function computeAdaptiveRestThreshold(bpm: number = 80): number {
  const msPerBeat = 60000 / Math.max(20, Math.min(300, bpm));
  return Math.round(Math.max(180, Math.min(380, msPerBeat * 0.35)));
}

export interface KeyEventEngineConfig {
  keySignature: KeySignature;
  timeSignature: TimeSignature;
  bpm: number;
  octaveShift: number; // -2 to +2
  quantizeGrid: QuantizeGrid;
  allowTriplets: boolean;
  accidentalPreference: 'auto' | 'sharp' | 'flat';
  restThresholdMs: number; // Minimum gap in ms to generate a discrete rest
  extendLegatoGaps: boolean; // Auto-extend notes when gap < restThresholdMs (default: true)
  filterOneFingerGaps: boolean; // Auto-bridge single-finger transit movement gaps (default: true)
  oneFingerMaxGapMs: number; // Max gap in ms to bridge; tempo/grid-capped below one rest
  qwertyMappingMode: QwertyMappingMode; // 'chromatic_piano' or 'movable_solfege'
  minNoteDurationMs: number; // Minimum note duration to keep (default: 25ms)
}

export const DEFAULT_KEY_ENGINE_CONFIG: Readonly<KeyEventEngineConfig> = {
  keySignature: 'C',
  timeSignature: '4/4',
  bpm: 80,
  octaveShift: 0,
  quantizeGrid: 'eighth',
  allowTriplets: false,
  accidentalPreference: 'auto',
  restThresholdMs: 260,
  extendLegatoGaps: true,
  filterOneFingerGaps: true,
  oneFingerMaxGapMs: computeGridAwareGapMs(80, 'eighth'),
  qwertyMappingMode: 'chromatic_piano',
  minNoteDurationMs: 25,
};

export interface ActiveNoteState {
  midi: number;
  pitch: PitchNumber;
  octave: number;
  accidental: '' | '#' | 'b';
  velocity: number;
  sourceKeyId?: string;
  startTimeMs: number;
}

export interface KeyEventEngineCallbacks {
  onNoteOn?: (note: ActiveNoteState) => void;
  onNoteOff?: (midi: number, sourceKeyId?: string) => void;
  onSegmentCommitted?: (segment: RawNoteSegment) => void;
  onOctaveShiftChange?: (octaveShift: number) => void;
  onActiveKeysChange?: (activeMidiNotes: number[]) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

/**
 * Resolved key information for UI rendering & hints
 */
export interface ResolvedKeyInfo {
  midi: number;
  pitch: PitchNumber;
  octave: number;
  accidental: '' | '#' | 'b';
  solfege: string;
  isBlack: boolean;
  label: string;
  code: string;
}

/**
 * Helper to resolve the pitch & MIDI note for a QWERTY key code or char.
 */
export function resolveQwertyKey(
  codeOrKey: string,
  keySignature: KeySignature = 'C',
  octaveShift: number = 0,
  mappingMode: QwertyMappingMode = 'chromatic_piano',
  accidentalPreference: 'auto' | 'sharp' | 'flat' = 'auto'
): ResolvedKeyInfo | null {
  const norm = codeOrKey.trim();
  const def = QWERTY_BY_CODE.get(norm.toLowerCase()) || QWERTY_BY_KEY.get(norm.toLowerCase());
  if (!def) return null;

  let baseMidi = 60; // Middle C4 = 60

  if (mappingMode === 'movable_solfege') {
    const tonicSemitone = KEY_SEMITONES[keySignature] ?? 0;
    const interval = MOVABLE_DEGREE_OFFSETS[def.code] ?? def.midiOffset;
    baseMidi = 60 + tonicSemitone + interval;
  } else {
    // Chromatic Piano: A is always C4 (60), S is D4 (62), etc.
    baseMidi = 60 + def.midiOffset;
  }

  const targetMidi = Math.max(21, Math.min(108, baseMidi + octaveShift * 12));
  const pitchInfo = midiToNumberedPitch(targetMidi, keySignature, {
    accidentalPreference,
  });

  return {
    midi: targetMidi,
    pitch: pitchInfo.pitch,
    octave: pitchInfo.octave,
    accidental: pitchInfo.accidental,
    solfege: def.solfege,
    isBlack: def.isBlack,
    label: def.label,
    code: def.code,
  };
}

interface PendingKeyRelease {
  midi: number;
  sourceKeyId: string;
  timestampMs: number;
  timerId?: ReturnType<typeof setTimeout> | null;
}

/**
 * KeyEventEngine
 *
 * Core engine tracking real-time keyboard performances, managing active notes,
 * resolving monophonic legato overlaps, computing inter-note rest segments,
 * and generating standardized RawNoteSegments ready for score quantization.
 */
export class KeyEventEngine {
  private config: KeyEventEngineConfig;
  private callbacks: KeyEventEngineCallbacks;

  // Recording State
  private isRecording = false;
  private isPaused = false;
  private pauseStartedAt = 0;
  private recordingStartTime = 0;
  private lastNoteReleaseTime: number | null = null;
  private activeNote: (ActiveNoteState & { resolved: boolean }) | null = null;
  private segments: RawNoteSegment[] = [];

  // Active key press tracking to suppress OS auto-repeats and handle multi-touch
  private activeSourceKeys = new Set<string>();

  // Debounce window to swallow rapid OS auto-repeat release/press bounces (especially under Linux X11/IBus)
  private pendingKeyReleases = new Map<string, PendingKeyRelease>();

  // Custom high-resolution clock provider for testing/simulation
  private nowProvider: () => number;

  constructor(
    config?: Partial<KeyEventEngineConfig>,
    callbacks?: KeyEventEngineCallbacks,
    nowProvider?: () => number
  ) {
    const bpm = config?.bpm ?? DEFAULT_KEY_ENGINE_CONFIG.bpm;
    const grid = config?.quantizeGrid ?? DEFAULT_KEY_ENGINE_CONFIG.quantizeGrid;
    const effectiveRestThreshold =
      config?.restThresholdMs !== undefined
        ? config.restThresholdMs
        : computeAdaptiveRestThreshold(bpm);

    this.config = {
      ...DEFAULT_KEY_ENGINE_CONFIG,
      ...config,
      restThresholdMs: effectiveRestThreshold,
      oneFingerMaxGapMs:
        config?.oneFingerMaxGapMs !== undefined
          ? config.oneFingerMaxGapMs
          : computeGridAwareGapMs(bpm, grid),
    };
    this.callbacks = callbacks || {};
    this.nowProvider =
      nowProvider ||
      (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  }

  /**
   * Update configuration parameters (tempo, key signature, quantize grid, etc.)
   */
  public updateConfig(config: Partial<KeyEventEngineConfig>): void {
    const newBpm = config.bpm ?? this.config.bpm;
    const newGrid = config.quantizeGrid ?? this.config.quantizeGrid;
    const newRestThreshold =
      config.restThresholdMs !== undefined
        ? config.restThresholdMs
        : config.bpm !== undefined
        ? computeAdaptiveRestThreshold(newBpm)
        : this.config.restThresholdMs;
    const newOneFingerMaxGapMs =
      config.oneFingerMaxGapMs !== undefined
        ? config.oneFingerMaxGapMs
        : config.bpm !== undefined || config.quantizeGrid !== undefined
          ? computeGridAwareGapMs(newBpm, newGrid)
          : this.config.oneFingerMaxGapMs;

    this.config = {
      ...this.config,
      ...config,
      restThresholdMs: newRestThreshold,
      oneFingerMaxGapMs: newOneFingerMaxGapMs,
    };
  }

  /**
   * Get the current duration (in milliseconds and estimated beats) of the actively held note, if any.
   */
  public getActiveNoteHeldDuration(nowMs?: number): {
    midi: number;
    pitch: PitchNumber;
    octave: number;
    accidental: '' | '#' | 'b';
    durationMs: number;
    estimatedBeats: number;
  } | null {
    if (!this.activeNote || this.activeNote.resolved) return null;
    const now = nowMs ?? this.nowProvider();
    const durationMs = Math.max(0, now - this.activeNote.startTimeMs);
    const msPerBeat = 60000 / Math.max(20, Math.min(300, this.config.bpm));
    const rawBeats = durationMs / msPerBeat;

    return {
      midi: this.activeNote.midi,
      pitch: this.activeNote.pitch,
      octave: this.activeNote.octave,
      accidental: this.activeNote.accidental,
      durationMs,
      estimatedBeats: Math.round(rawBeats * 100) / 100,
    };
  }

  public getConfig(): Readonly<KeyEventEngineConfig> {
    return this.config;
  }

  public setCallbacks(callbacks: Partial<KeyEventEngineCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Start recording a new performance.
   * If a startTimeMs is provided, uses it as the t=0 origin.
   */
  public startRecording(startTimeMs?: number): void {
    const now = startTimeMs ?? this.nowProvider();
    this.flushPendingKeyReleases();
    this.isRecording = true;
    this.isPaused = false;
    this.pauseStartedAt = 0;
    this.recordingStartTime = now;
    this.lastNoteReleaseTime = null;
    this.activeNote = null;
    this.activeSourceKeys.clear();
    this.segments = [];
    this.callbacks.onRecordingStateChange?.(true);
    this.notifyActiveKeys();
  }

  /**
   * Pause an in-progress take without quantizing. Hidden tabs / Control Center
   * should call this instead of stopRecording so the buffer is not truncated.
   */
  public pauseRecording(timestampMs?: number): void {
    if (!this.isRecording || this.isPaused) return;
    this.flushPendingKeyReleases();
    const now = timestampMs ?? this.nowProvider();
    if (this.activeNote && !this.activeNote.resolved) {
      this.commitActiveNote(now);
    }
    this.isPaused = true;
    this.pauseStartedAt = now;
    this.notifyActiveKeys();
  }

  /**
   * Resume after pauseRecording. Shifts the recording origin so the paused
   * interval is not transcribed as a rest.
   */
  public resumeRecording(timestampMs?: number): void {
    if (!this.isRecording || !this.isPaused) return;
    const now = timestampMs ?? this.nowProvider();
    this.recordingStartTime += now - this.pauseStartedAt;
    this.lastNoteReleaseTime = now;
    this.isPaused = false;
    this.pauseStartedAt = 0;
    this.notifyActiveKeys();
  }

  public isRecordingPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Stop recording and resolve any currently sustained note.
   */
  public stopRecording(stopTimeMs?: number): void {
    this.flushPendingKeyReleases();
    if (!this.isRecording) return;
    const now = stopTimeMs ?? this.nowProvider();

    // Resolve any note still held at the moment of recording termination
    if (this.activeNote && !this.activeNote.resolved) {
      this.commitActiveNote(now);
    }

    this.isRecording = false;
    this.isPaused = false;
    this.pauseStartedAt = 0;
    this.callbacks.onRecordingStateChange?.(false);
    this.notifyActiveKeys();
  }

  public isRecordingActive(): boolean {
    return this.isRecording;
  }

  public getRecordingStartTime(): number {
    return this.recordingStartTime;
  }

  public getSegments(): RawNoteSegment[] {
    this.flushPendingKeyReleases();
    return [...this.segments];
  }

  public clearSegments(): void {
    for (const [, pending] of this.pendingKeyReleases) {
      if (pending.timerId) clearTimeout(pending.timerId);
    }
    this.pendingKeyReleases.clear();
    this.activeSourceKeys.clear();
    this.segments = [];
    this.lastNoteReleaseTime = null;
    if (this.activeNote) {
      this.activeNote.resolved = true;
      this.activeNote = null;
    }
    this.notifyActiveKeys();
  }

  /**
   * Primary Note On trigger (from Touch Piano, QWERTY typing, or Web MIDI).
   *
   * Handles:
   * 1. Monophonic Legato Overlap Resolution:
   *    If note A is still held when note B starts, note A is immediately truncated
   *    at timestamp(B) and committed without waiting for its late keyup.
   * 2. Rest Gap Detection:
   *    If gap since last note release >= restThresholdMs, generates an explicit rest segment.
   *    If gap < restThresholdMs and extendLegatoGaps is enabled, extends previous note.
   */
  public noteOn(
    midi: number,
    velocity: number = 0.85,
    timestampMs?: number,
    sourceKeyId?: string
  ): void {
    if (this.isPaused) return;
    const now = timestampMs ?? this.nowProvider();

    // Auto-start recording on first key press if not explicitly started
    if (!this.isRecording) {
      this.startRecording(now);
    }

    if (sourceKeyId) {
      // Flush any pending release for OTHER keys immediately before starting new note
      this.flushPendingKeyReleases(sourceKeyId);

      // Guard against duplicate noteOn for an already active key (e.g. repeated KeyDown)
      if (this.activeSourceKeys.has(sourceKeyId)) {
        return;
      }
      this.activeSourceKeys.add(sourceKeyId);
    } else if (
      this.activeNote &&
      !this.activeNote.resolved &&
      this.activeNote.midi === midi &&
      now - this.activeNote.startTimeMs < 45
    ) {
      // Guard against rapid duplicate noteOn without sourceKeyId within 45ms
      return;
    }

    // 1. Monophonic Legato Overlap Resolution:
    // If a previous note is still sounding, instantly resolve and truncate it!
    if (this.activeNote && !this.activeNote.resolved) {
      this.commitActiveNote(now);
    } else {
      // 2. Inter-Note Rest Gap Detection & One-Finger Transit Gap Filtering:
      // If there was a silence gap between previous note release and this note onset:
      if (this.lastNoteReleaseTime !== null) {
        const gapMs = now - this.lastNoteReleaseTime;

        if (this.config.filterOneFingerGaps) {
          if (gapMs > 0 && gapMs <= this.config.oneFingerMaxGapMs && this.segments.length > 0) {
            // One-Finger transit movement: extend previous note across gap to eliminate accidental '0' rest
            const lastSeg = this.segments[this.segments.length - 1];
            if (lastSeg && lastSeg.midi !== null) {
              lastSeg.endTimeMs = Math.round(now - this.recordingStartTime);
              lastSeg.durationMs = Math.round(lastSeg.endTimeMs - lastSeg.startTimeMs);
            }
          } else if (gapMs > this.config.oneFingerMaxGapMs) {
            // Intentional rest exceeding gap threshold: generate a discrete Rest Segment
            const restSegment: RawNoteSegment = {
              startTimeMs: Math.round(this.lastNoteReleaseTime - this.recordingStartTime),
              endTimeMs: Math.round(now - this.recordingStartTime),
              durationMs: Math.round(gapMs),
              midi: null, // null indicates musical rest
              frequencyHz: null,
              avgRms: 0,
              pitchSamples: [],
            };
            this.segments.push(restSegment);
            this.callbacks.onSegmentCommitted?.(restSegment);
          }
        } else {
          if (gapMs >= this.config.restThresholdMs) {
            // Intentional rest: generate a discrete Rest Segment
            const restSegment: RawNoteSegment = {
              startTimeMs: Math.round(this.lastNoteReleaseTime - this.recordingStartTime),
              endTimeMs: Math.round(now - this.recordingStartTime),
              durationMs: Math.round(gapMs),
              midi: null, // null indicates musical rest
              frequencyHz: null,
              avgRms: 0,
              pitchSamples: [],
            };
            this.segments.push(restSegment);
            this.callbacks.onSegmentCommitted?.(restSegment);
          } else if (gapMs > 0 && this.config.extendLegatoGaps && this.segments.length > 0) {
            // Articulation transient (< 80ms): extend previous note for continuous legato line
            const lastSeg = this.segments[this.segments.length - 1];
            if (lastSeg && lastSeg.midi !== null) {
              lastSeg.endTimeMs = Math.round(now - this.recordingStartTime);
              lastSeg.durationMs = Math.round(lastSeg.endTimeMs - lastSeg.startTimeMs);
            }
          }
        }
      }
    }

    // 3. Map MIDI pitch to Numbered Notation scale degree
    const pitchInfo = midiToNumberedPitch(midi, this.config.keySignature, {
      accidentalPreference: this.config.accidentalPreference,
    });

    // 4. Set active note state
    this.activeNote = {
      midi,
      pitch: pitchInfo.pitch,
      octave: pitchInfo.octave,
      accidental: pitchInfo.accidental,
      velocity: Math.max(0.1, Math.min(1.0, velocity)),
      sourceKeyId,
      startTimeMs: now,
      resolved: false,
    };

    // Emit live audio and UI callbacks
    this.callbacks.onNoteOn?.(this.activeNote);
    this.notifyActiveKeys();
  }

  /**
   * Primary Note Off trigger.
   *
   * Commits the active note segment if it hasn't already been resolved
   * by a subsequent note's onset (legato overlap).
   */
  public noteOff(midi: number, timestampMs?: number, sourceKeyId?: string): void {
    if (this.isPaused) return;
    const now = timestampMs ?? this.nowProvider();

    if (sourceKeyId) {
      const pending = this.pendingKeyReleases.get(sourceKeyId);
      if (pending?.timerId) {
        clearTimeout(pending.timerId);
      }
      this.pendingKeyReleases.delete(sourceKeyId);
      this.activeSourceKeys.delete(sourceKeyId);
    }

    // If there is an active, unresolved note matching this MIDI (or source)
    if (this.activeNote && !this.activeNote.resolved) {
      const isMatch =
        this.activeNote.midi === midi ||
        (sourceKeyId && this.activeNote.sourceKeyId === sourceKeyId) ||
        !sourceKeyId;

      if (isMatch) {
        this.commitActiveNote(now);
      }
    }

    this.callbacks.onNoteOff?.(midi, sourceKeyId);
    this.notifyActiveKeys();
  }

  /**
   * Immediately commit/execute any pending deferred key releases.
   */
  public flushPendingKeyReleases(exceptKeyId?: string): void {
    if (this.pendingKeyReleases.size === 0) return;
    const keysToFlush: string[] = [];
    for (const [keyId] of this.pendingKeyReleases) {
      if (!exceptKeyId || keyId !== exceptKeyId) {
        keysToFlush.push(keyId);
      }
    }
    for (const keyId of keysToFlush) {
      this.executePendingKeyRelease(keyId);
    }
  }

  /**
   * Execute a single deferred key release with its recorded release timestamp.
   */
  private executePendingKeyRelease(sourceKeyId: string): void {
    const pending = this.pendingKeyReleases.get(sourceKeyId);
    if (!pending) return;

    if (pending.timerId) {
      clearTimeout(pending.timerId);
    }
    this.pendingKeyReleases.delete(sourceKeyId);

    // Call noteOff using the exact timestamp captured when the key was released
    this.noteOff(pending.midi, pending.timestampMs, sourceKeyId);
  }

  /**
   * Release all currently active keys (e.g. on window blur or mode change).
   */
  public releaseAllActiveKeys(timestampMs?: number): void {
    const now = timestampMs ?? this.nowProvider();
    this.flushPendingKeyReleases();
    if (this.activeNote && !this.activeNote.resolved) {
      this.commitActiveNote(now);
    }
    for (const sourceKeyId of Array.from(this.activeSourceKeys)) {
      const resolved = resolveQwertyKey(
        sourceKeyId,
        this.config.keySignature,
        this.config.octaveShift,
        this.config.qwertyMappingMode,
        this.config.accidentalPreference
      );
      if (resolved) {
        this.callbacks.onNoteOff?.(resolved.midi, sourceKeyId);
      }
    }
    this.activeSourceKeys.clear();
    this.notifyActiveKeys();
  }

  /**
   * Cleanup any active debounce timers on unmount.
   */
  public destroy(): void {
    for (const [, pending] of this.pendingKeyReleases) {
      if (pending.timerId) clearTimeout(pending.timerId);
    }
    this.pendingKeyReleases.clear();
    this.activeSourceKeys.clear();
  }

  /**
   * Commit the currently active note into the segment list.
   */
  private commitActiveNote(endTimestampMs: number): void {
    if (!this.activeNote || this.activeNote.resolved) return;

    const rawDuration = Math.max(10, endTimestampMs - this.activeNote.startTimeMs);
    const relStart = Math.max(0, this.activeNote.startTimeMs - this.recordingStartTime);
    const relEnd = Math.max(relStart + 10, endTimestampMs - this.recordingStartTime);

    // Filter out micro-glitches below minNoteDurationMs
    if (rawDuration >= this.config.minNoteDurationMs) {
      const segment: RawNoteSegment = {
        startTimeMs: Math.round(relStart),
        endTimeMs: Math.round(relEnd),
        durationMs: Math.round(rawDuration),
        midi: this.activeNote.midi,
        frequencyHz: midiToFrequency(this.activeNote.midi),
        avgRms: this.activeNote.velocity,
        pitchSamples: [this.activeNote.midi],
      };
      this.segments.push(segment);
      this.callbacks.onSegmentCommitted?.(segment);
    }

    this.activeNote.resolved = true;
    this.lastNoteReleaseTime = endTimestampMs;
    this.callbacks.onNoteOff?.(this.activeNote.midi, this.activeNote.sourceKeyId);
  }

  /**
   * Handle computer keyboard KeyDown event.
   * Includes e.repeat guard, activeSourceKeys deduplication, Linux X11 auto-repeat release
   * bounce filtering, octave shifts (Z/X), rest trigger (Space), and Backspace undo.
   *
   * @returns true if the key was handled by the musical typing engine
   */
  public handleKeyDown(
    e: { code?: string; key?: string; repeat?: boolean; preventDefault?: () => void },
    timestampMs?: number
  ): boolean {
    if (this.isPaused) return false;
    const code = e.code || '';
    const key = (e.key || '').toLowerCase();

    // 1. Auxiliary control: Octave Down (Z)
    if (code === 'KeyZ' || key === 'z') {
      if (e.repeat) return true;
      e.preventDefault?.();
      this.shiftOctave(-1);
      return true;
    }

    // 2. Auxiliary control: Octave Up (X)
    if (code === 'KeyX' || key === 'x') {
      if (e.repeat) return true;
      e.preventDefault?.();
      this.shiftOctave(1);
      return true;
    }

    // 3. Auxiliary control: Rest (Spacebar)
    if (code === 'Space' || key === ' ') {
      if (e.repeat) return true;
      e.preventDefault?.();
      this.triggerRestKey(timestampMs);
      return true;
    }

    // 4. Auxiliary control: Undo last note (Backspace)
    if (code === 'Backspace' || key === 'backspace') {
      if (e.repeat) return true;
      e.preventDefault?.();
      this.undoLastNote();
      return true;
    }

    // 5. Musical typing keys (White and Black keys)
    const resolved = resolveQwertyKey(
      code || key,
      this.config.keySignature,
      this.config.octaveShift,
      this.config.qwertyMappingMode,
      this.config.accidentalPreference
    );

    if (resolved) {
      const sourceKeyId = resolved.code;
      const now = timestampMs ?? this.nowProvider();

      // Check if there is a pending release for THIS key (OS auto-repeat release/press bounce)
      const pending = this.pendingKeyReleases.get(sourceKeyId);
      if (pending) {
        const gap = now - pending.timestampMs;
        if (gap <= 45) {
          // OS auto-repeat bounce detected! Cancel deferred release and keep sustaining note
          if (pending.timerId) clearTimeout(pending.timerId);
          this.pendingKeyReleases.delete(sourceKeyId);
          e.preventDefault?.();
          return true;
        } else {
          // Real re-press after debounce interval: execute pending release first
          this.executePendingKeyRelease(sourceKeyId);
        }
      }

      // Check if key is already physically active (OS auto-repeat without keyup, or e.repeat)
      if (e.repeat || this.activeSourceKeys.has(sourceKeyId)) {
        e.preventDefault?.();
        return true;
      }

      // Flush any pending releases for OTHER keys before starting this note
      this.flushPendingKeyReleases(sourceKeyId);

      e.preventDefault?.();
      this.noteOn(resolved.midi, 0.85, now, sourceKeyId);
      return true;
    }

    return false;
  }

  /**
   * Handle computer keyboard KeyUp event.
   * Defers note release by 45ms to filter out rapid Linux X11 auto-repeat keyup bounces.
   */
  public handleKeyUp(
    e: { code?: string; key?: string; preventDefault?: () => void },
    timestampMs?: number
  ): boolean {
    const code = e.code || '';
    const key = (e.key || '').toLowerCase();

    if (
      code === 'KeyZ' ||
      key === 'z' ||
      code === 'KeyX' ||
      key === 'x' ||
      code === 'Space' ||
      key === ' ' ||
      code === 'Backspace' ||
      key === 'backspace'
    ) {
      return true;
    }

    const resolved = resolveQwertyKey(
      code || key,
      this.config.keySignature,
      this.config.octaveShift,
      this.config.qwertyMappingMode,
      this.config.accidentalPreference
    );

    if (resolved) {
      e.preventDefault?.();
      const sourceKeyId = resolved.code;
      const now = timestampMs ?? this.nowProvider();

      // If key is not recorded as active, still trigger safety callback to halt any dangling voice
      if (!this.activeSourceKeys.has(sourceKeyId) && !this.pendingKeyReleases.has(sourceKeyId)) {
        this.callbacks.onNoteOff?.(resolved.midi, sourceKeyId);
        return true;
      }

      // Cancel any existing timer for this key
      const existing = this.pendingKeyReleases.get(sourceKeyId);
      if (existing?.timerId) {
        clearTimeout(existing.timerId);
      }

      // Stage deferred release with 45ms window to absorb Linux X11 auto-repeat release bounce
      const timerId = typeof setTimeout !== 'undefined' ? setTimeout(() => {
        this.executePendingKeyRelease(sourceKeyId);
      }, 45) : null;

      this.pendingKeyReleases.set(sourceKeyId, {
        midi: resolved.midi,
        sourceKeyId,
        timestampMs: now,
        timerId,
      });

      return true;
    }

    return false;
  }

  /**
   * Handle standard Web MIDI API message event.
   * Supports NoteOn (0x90) and NoteOff (0x80 / 0x90 with velocity 0).
   *
   * @returns true if the MIDI message was processed
   */
  public handleMidiMessage(
    event: { data: Uint8Array | number[] },
    timestampMs?: number
  ): boolean {
    const data = event.data;
    if (!data || data.length < 2) return false;

    const status = data[0];
    const command = status & 0xf0;
    const midi = data[1];
    const velocity = data.length > 2 ? (data[2] ?? 0) / 127 : 0.8;
    const sourceId = `midi-${midi}`;

    // Note On (command 0x90 with velocity > 0)
    if (command === 0x90 && data[2] > 0) {
      this.noteOn(midi, velocity, timestampMs, sourceId);
      return true;
    }

    // Note Off (command 0x80 or command 0x90 with velocity 0)
    if (command === 0x80 || (command === 0x90 && data[2] === 0)) {
      this.noteOff(midi, timestampMs, sourceId);
      return true;
    }

    return false;
  }

  /**
   * Spacebar rest handler: If a note is sounding, release it immediately.
   */
  private triggerRestKey(timestampMs?: number): void {
    this.flushPendingKeyReleases();
    const now = timestampMs ?? this.nowProvider();
    if (this.activeNote && !this.activeNote.resolved) {
      this.commitActiveNote(now);
      this.notifyActiveKeys();
    }
  }

  /**
   * Trigger an explicit musical rest interval.
   */
  public triggerRest(durationMs: number = 500, timestampMs?: number): void {
    this.flushPendingKeyReleases();
    const now = timestampMs ?? this.nowProvider();
    if (this.activeNote && !this.activeNote.resolved) {
      this.commitActiveNote(now);
    }

    const start = this.lastNoteReleaseTime ?? now;
    const restSeg: RawNoteSegment = {
      startTimeMs: Math.round(start - this.recordingStartTime),
      endTimeMs: Math.round(start + durationMs - this.recordingStartTime),
      durationMs: Math.round(durationMs),
      midi: null,
      frequencyHz: null,
      avgRms: 0,
      pitchSamples: [],
    };
    this.segments.push(restSeg);
    this.lastNoteReleaseTime = start + durationMs;
    this.callbacks.onSegmentCommitted?.(restSeg);
    this.notifyActiveKeys();
  }

  /**
   * Undo / delete the last performed note or current active note.
   */
  public undoLastNote(): RawNoteSegment | null {
    this.flushPendingKeyReleases();
    // If a note is currently held, cancel it without committing
    if (this.activeNote && !this.activeNote.resolved) {
      this.activeNote.resolved = true;
      this.callbacks.onNoteOff?.(this.activeNote.midi, this.activeNote.sourceKeyId);
      this.activeNote = null;
      this.notifyActiveKeys();
      return null;
    }

    // If we have committed segments, pop the last note
    if (this.segments.length > 0) {
      const popped = this.segments.pop() ?? null;

      // If the preceding segment was a rest leading into this note, remove it too
      if (this.segments.length > 0 && this.segments[this.segments.length - 1].midi === null) {
        this.segments.pop();
      }

      if (this.segments.length > 0) {
        this.lastNoteReleaseTime =
          this.recordingStartTime + this.segments[this.segments.length - 1].endTimeMs;
      } else {
        this.lastNoteReleaseTime = null;
      }

      this.notifyActiveKeys();
      return popped;
    }

    return null;
  }

  /**
   * Shift octave transposition (-2 to +2).
   */
  public shiftOctave(delta: number): number {
    const newShift = Math.max(-2, Math.min(2, this.config.octaveShift + delta));
    this.config.octaveShift = newShift;
    this.callbacks.onOctaveShiftChange?.(newShift);
    return newShift;
  }

  public getOctaveShift(): number {
    return this.config.octaveShift;
  }

  /**
   * Finalize recording and return all committed raw note segments.
   */
  public finalize(timestampMs?: number): RawNoteSegment[] {
    if (this.isRecording) {
      this.stopRecording(timestampMs);
    }
    return [...this.segments];
  }

  /**
   * Direct transcription pipeline:
   * Finalizes the recorded segments and feeds them into the ScoreQuantizer
   * to produce beat-quantized Measures and NumberedNotationNotes.
   */
  public transcribe(
    options?: Partial<QuantizeOptions & MeasureLayoutOptions & { keyboardMode?: boolean }>
  ): TranscriptionResult {
    const segments = this.finalize();

    return transcribeKeyboardSegmentsToMeasures(segments, {
      key: options?.key ?? this.config.keySignature,
      timeSignature: options?.timeSignature ?? this.config.timeSignature,
      bpm: options?.bpm ?? this.config.bpm,
      grid: options?.grid ?? this.config.quantizeGrid,
      allowTriplets: options?.allowTriplets ?? this.config.allowTriplets,
      octaveShift: options?.octaveShift ?? 0,
      accidentalPreference: options?.accidentalPreference ?? this.config.accidentalPreference,
      autoFillTrailingRests: options?.autoFillTrailingRests ?? false,
      startMeasureNumber: options?.startMeasureNumber ?? 1,
      minDurationMs: options?.minDurationMs ?? this.config.minNoteDurationMs,
      trimSilence: false,
    });
  }

  private notifyActiveKeys(): void {
    const activeMidis: number[] = [];
    if (this.activeNote && !this.activeNote.resolved) {
      activeMidis.push(this.activeNote.midi);
    }
    this.callbacks.onActiveKeysChange?.(activeMidis);
  }
}
