/**
 * YIN Pitch Detection Algorithm
 *
 * Implements time-domain pitch tracking using the Difference Function,
 * Cumulative Mean Normalized Difference Function (CMNDF), absolute thresholding,
 * and parabolic interpolation as described by De Cheveigné & Kawahara (2002).
 *
 * Optimized for real-time monophonic vocal humming and acoustic traditional
 * instruments (Bamboo Flute, Erhu, Acoustic Guitar).
 */

export interface YinDetectorConfig {
  sampleRate: number;         // Audio sample rate in Hz (default: 44100)
  threshold: number;          // Dip threshold for CMNDF (default: 0.15)
  minFrequency: number;       // Lowest expected fundamental f0 in Hz (default: 65 Hz ~ C2)
  maxFrequency: number;       // Highest expected fundamental f0 in Hz (default: 2000 Hz ~ B6)
  silenceThreshold: number;   // Linear RMS energy below which frame is silence (default: 0.008 ~ -42dB)
  fallbackThreshold: number;  // Max CMNDF value allowed when taking global minimum (default: 0.40)
  medianFilterSize: number;   // Sliding window size for micro-vibrato smoothing (default: 5)
}

export interface PitchResult {
  frequency: number | null;   // Detected fundamental frequency f0 in Hz, or null if unvoiced
  probability: number;        // Confidence score between 0.0 and 1.0
  isPitched: boolean;         // True if voiced note above probability & energy threshold
  tau: number | null;         // Fundamental period in sample units
  rms: number;                // Root-mean-square amplitude of analysis window
  centsOffNearestMidi: number;// Tuning deviation in cents (-50 to +50)
  nearestMidi: number | null; // Nearest integer MIDI note number (e.g. 69 for A4)
  noteName: string | null;    // Scientific pitch notation (e.g. "A4", "C#5")
}

export interface MidiNoteInfo {
  midi: number;
  frequency: number;
  noteName: string;
  octave: number;
  pitchClass: string;
  centsOff: number;
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const DEFAULT_YIN_CONFIG: Readonly<YinDetectorConfig> = {
  sampleRate: 44100,
  threshold: 0.15,
  minFrequency: 65,
  maxFrequency: 2000,
  silenceThreshold: 0.008,
  fallbackThreshold: 0.40,
  medianFilterSize: 5,
};

/**
 * Calculate RMS amplitude of an audio buffer.
 */
export function calculateRms(buffer: Float32Array | number[]): number {
  if (buffer.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < buffer.length; i++) {
    sumSq += buffer[i] * buffer[i];
  }
  return Math.sqrt(sumSq / buffer.length);
}

/**
 * Convert frequency in Hz to fractional MIDI note number (A4 = 440Hz -> MIDI 69).
 */
export function frequencyToMidi(frequency: number): number {
  if (frequency <= 0) return 0;
  return 69 + 12 * Math.log2(frequency / 440);
}

/**
 * Convert MIDI note number to frequency in Hz.
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Calculate deviation in cents between two frequencies.
 */
export function frequencyToCents(frequency: number, referenceFrequency: number): number {
  if (frequency <= 0 || referenceFrequency <= 0) return 0;
  return 1200 * Math.log2(frequency / referenceFrequency);
}

/**
 * Resolve detailed pitch information for a frequency in Hz.
 */
export function getMidiNoteInfo(frequency: number): MidiNoteInfo | null {
  if (frequency <= 0 || !Number.isFinite(frequency)) return null;

  const fractionalMidi = frequencyToMidi(frequency);
  const roundedMidi = Math.round(fractionalMidi);
  const exactNoteFreq = midiToFrequency(roundedMidi);
  const centsOff = Math.round(frequencyToCents(frequency, exactNoteFreq) * 10) / 10;

  const pitchClassIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const pitchClass = NOTE_NAMES[pitchClassIndex];
  const noteName = `${pitchClass}${octave}`;

  return {
    midi: roundedMidi,
    frequency: exactNoteFreq,
    noteName,
    octave,
    pitchClass,
    centsOff,
  };
}

/**
 * Compute the running median of an array of numbers.
 */
export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Pure function: Detect pitch on an audio buffer using the YIN algorithm.
 */
export function detectYinPitch(
  buffer: Float32Array | number[],
  options?: Partial<YinDetectorConfig>
): PitchResult {
  const config: YinDetectorConfig = { ...DEFAULT_YIN_CONFIG, ...options };
  const {
    sampleRate,
    threshold,
    minFrequency,
    maxFrequency,
    silenceThreshold,
    fallbackThreshold,
  } = config;

  const emptyResult = (rms: number): PitchResult => ({
    frequency: null,
    probability: 0,
    isPitched: false,
    tau: null,
    rms,
    centsOffNearestMidi: 0,
    nearestMidi: null,
    noteName: null,
  });

  const bufferLength = buffer.length;
  if (bufferLength < 64) {
    return emptyResult(0);
  }

  // Pre-check: RMS energy gating
  const rms = calculateRms(buffer);
  if (rms < silenceThreshold) {
    return emptyResult(rms);
  }

  // Half-buffer integration window size W
  const halfBufferSize = Math.floor(bufferLength / 2);

  // Period tau boundaries in sample units
  // f = sampleRate / tau -> tau = sampleRate / f
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const tauMax = Math.min(halfBufferSize - 1, Math.floor(sampleRate / minFrequency));

  if (tauMax <= tauMin) {
    return emptyResult(rms);
  }

  // Step 1: Difference function d(tau) = sum_{j=0}^{W-1} (x[j] - x[j + tau])^2
  const diff = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < halfBufferSize; j++) {
      const delta = buffer[j] - buffer[j + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Step 2: Cumulative Mean Normalized Difference Function (CMNDF)
  // cmndf[0] = 1
  // cmndf[tau] = diff[tau] / ((1 / tau) * sum_{j=1}^{tau} diff[j])
  const cmndf = new Float32Array(tauMax + 1);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    runningSum += diff[tau];
    if (runningSum <= 1e-12) {
      cmndf[tau] = 1;
    } else {
      cmndf[tau] = (diff[tau] * tau) / runningSum;
    }
  }

  // Step 3: Absolute Thresholding
  // Search for the smallest tau that dips below threshold, then follow to local minimum
  let tauCandidate = -1;
  let minCmndfVal = 1.0;

  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cmndf[tau] < threshold) {
      // Follow the dip to its local trough
      while (tau + 1 <= tauMax && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      tauCandidate = tau;
      minCmndfVal = cmndf[tau];
      break;
    }
  }

  // If no dip was below the threshold, find the global minimum in range
  if (tauCandidate === -1) {
    let globalMinTau = tauMin;
    let globalMinVal = cmndf[tauMin];
    for (let tau = tauMin + 1; tau <= tauMax; tau++) {
      if (cmndf[tau] < globalMinVal) {
        globalMinVal = cmndf[tau];
        globalMinTau = tau;
      }
    }

    if (globalMinVal <= fallbackThreshold) {
      tauCandidate = globalMinTau;
      minCmndfVal = globalMinVal;
    }
  }

  // If no candidate met reliability criteria, return unpitched
  if (tauCandidate === -1 || tauCandidate <= 0) {
    return emptyResult(rms);
  }

  // Step 4: Parabolic Interpolation for Sub-Bin Pitch Resolution
  let refinedTau: number = tauCandidate;
  if (tauCandidate > 1 && tauCandidate < tauMax) {
    const alpha = cmndf[tauCandidate - 1];
    const beta = cmndf[tauCandidate];
    const gamma = cmndf[tauCandidate + 1];
    const denominator = 2 * (alpha - 2 * beta + gamma);

    if (Math.abs(denominator) > 1e-9) {
      const delta = (alpha - gamma) / denominator;
      if (Math.abs(delta) <= 1.0) {
        refinedTau = tauCandidate + delta;
      }
    }
  }

  if (refinedTau <= 0) {
    return emptyResult(rms);
  }

  const frequency = sampleRate / refinedTau;

  // Validate bounds
  if (frequency < minFrequency || frequency > maxFrequency) {
    return emptyResult(rms);
  }

  // Periodicity / confidence score
  const probability = Math.max(0, Math.min(1, 1 - minCmndfVal));
  const isPitched = probability >= (1 - fallbackThreshold);

  const noteInfo = getMidiNoteInfo(frequency);

  return {
    frequency: Math.round(frequency * 100) / 100,
    probability: Math.round(probability * 1000) / 1000,
    isPitched,
    tau: Math.round(refinedTau * 100) / 100,
    rms: Math.round(rms * 10000) / 10000,
    centsOffNearestMidi: noteInfo?.centsOff ?? 0,
    nearestMidi: noteInfo?.midi ?? null,
    noteName: noteInfo?.noteName ?? null,
  };
}

/**
 * Stateful YIN Pitch Detector with micro-vibrato median smoothing
 * and historical continuity tracking.
 */
export class YinDetector {
  private config: YinDetectorConfig;
  private recentPitches: number[] = [];
  private consecutiveUnpitchedCount = 0;

  constructor(options?: Partial<YinDetectorConfig>) {
    this.config = { ...DEFAULT_YIN_CONFIG, ...options };
  }

  public updateConfig(options: Partial<YinDetectorConfig>): void {
    this.config = { ...this.config, ...options };
  }

  public getConfig(): Readonly<YinDetectorConfig> {
    return this.config;
  }

  /**
   * Reset internal pitch tracking history.
   */
  public reset(): void {
    this.recentPitches = [];
    this.consecutiveUnpitchedCount = 0;
  }

  /**
   * Detect raw instantaneous pitch on an audio buffer.
   */
  public detect(buffer: Float32Array | number[]): PitchResult {
    return detectYinPitch(buffer, this.config);
  }

  /**
   * Detect pitch with median smoothing to suppress micro-vibrato (4-7Hz)
   * and isolated octave-jump glitches.
   */
  public detectSmoothed(buffer: Float32Array | number[]): PitchResult {
    const rawResult = this.detect(buffer);

    if (!rawResult.isPitched || rawResult.frequency === null) {
      this.consecutiveUnpitchedCount++;
      // If unpitched for 2 or more consecutive frames, clear history
      if (this.consecutiveUnpitchedCount >= 2) {
        this.recentPitches = [];
      }
      return rawResult;
    }

    this.consecutiveUnpitchedCount = 0;
    this.recentPitches.push(rawResult.frequency);

    // Keep sliding window within configured size
    if (this.recentPitches.length > this.config.medianFilterSize) {
      this.recentPitches.shift();
    }

    // Compute median of recent frames
    const smoothedFreq = computeMedian(this.recentPitches);
    const noteInfo = getMidiNoteInfo(smoothedFreq);

    return {
      ...rawResult,
      frequency: Math.round(smoothedFreq * 100) / 100,
      nearestMidi: noteInfo?.midi ?? rawResult.nearestMidi,
      noteName: noteInfo?.noteName ?? rawResult.noteName,
      centsOffNearestMidi: noteInfo?.centsOff ?? rawResult.centsOffNearestMidi,
    };
  }
}
