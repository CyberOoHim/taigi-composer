/**
 * Acoustic Onset & Note Transition Detector
 *
 * Implements dual-gate note segmentation:
 * 1. Spectral Flux & RMS Energy Derivative: Detects percussive attacks, consonant bursts,
 *    and tonguing transients (Flute, Guitar, Vocal syllables).
 * 2. Silence Gate & Pitch Stability Gate: Differentiates held notes from rests and
 *    detects legato pitch transitions (Erhu bow-changes, vocal portamento).
 */

export interface OnsetDetectorConfig {
  sampleRate: number;                // Audio sample rate in Hz (default: 44100)
  frameSize: number;                 // Frame size for spectral analysis (default: 512 or 1024)
  silenceThresholdRms: number;       // RMS threshold below which audio is silence (default: 0.008 ~ -42dB)
  attackRmsDeltaThreshold: number;   // Absolute RMS increase (RMS_t - RMS_prev) to trigger onset (default: 0.02)
  attackRelativeRiseThreshold: number;// Relative RMS ratio increase (RMS_t / RMS_prev) (default: 1.8)
  spectralFluxThreshold: number;     // Normalized positive spectral flux threshold (default: 0.08)
  refractoryPeriodMs: number;        // Minimum time in ms between onsets (default: 70ms)
  pitchStabilityCents: number;       // Max pitch deviation in cents to consider note continuous (default: 35 cents)
  legatoPitchThresholdCents: number; // Minimum pitch change in cents to trigger legato note transition (default: 75 cents)
  minNoteDurationMs: number;         // Minimum duration for a note to be kept (default: 60ms)
}

export const DEFAULT_ONSET_CONFIG: Readonly<OnsetDetectorConfig> = {
  sampleRate: 44100,
  frameSize: 512,
  silenceThresholdRms: 0.008,
  attackRmsDeltaThreshold: 0.02,
  attackRelativeRiseThreshold: 1.8,
  spectralFluxThreshold: 0.08,
  refractoryPeriodMs: 70,
  pitchStabilityCents: 35,
  legatoPitchThresholdCents: 75,
  minNoteDurationMs: 60,
};

export type NoteState = 'SILENCE' | 'ATTACK' | 'SUSTAIN' | 'RELEASE';

export interface FrameAnalysisResult {
  rms: number;
  rmsDelta: number;
  spectralFlux: number;
  isSilent: boolean;
  isOnset: boolean;
  isLegatoChange: boolean;
  state: NoteState;
  timestampMs: number;
  detectedPitchHz: number | null;
  detectedMidi: number | null;
}

export interface RawNoteSegment {
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  midi: number | null;      // null represents a rest / silence
  frequencyHz: number | null;
  avgRms: number;
  pitchSamples: number[];
}

/**
 * In-place Radix-2 Cooley-Tukey Fast Fourier Transform.
 * Operates on power-of-2 arrays of real and imaginary numbers.
 */
export function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if ((n & (n - 1)) !== 0) {
    throw new Error(`FFT size must be a power of 2, received ${n}`);
  }

  // Bit reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = real[i];
      real[i] = real[j];
      real[j] = tempR;

      const tempI = imag[i];
      imag[i] = imag[j];
      imag[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey decimation-in-time
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wR = 1.0;
      let wI = 0.0;

      for (let k = 0; k < halfLen; k++) {
        const uR = real[i + k];
        const uI = imag[i + k];

        const vR = real[i + k + halfLen] * wR - imag[i + k + halfLen] * wI;
        const vI = real[i + k + halfLen] * wI + imag[i + k + halfLen] * wR;

        real[i + k] = uR + vR;
        imag[i + k] = uI + vI;

        real[i + k + halfLen] = uR - vR;
        imag[i + k + halfLen] = uI - vI;

        const nextWR = wR * wStepR - wI * wStepI;
        wI = wR * wStepI + wI * wStepR;
        wR = nextWR;
      }
    }
  }
}

/**
 * Compute the magnitude spectrum of a buffer applying a Hann window.
 */
export function computeMagnitudeSpectrum(
  buffer: Float32Array | number[],
  fftSize: number = 512
): Float32Array {
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  const len = Math.min(buffer.length, fftSize);
  // Hann windowing
  for (let i = 0; i < len; i++) {
    const windowMultiplier = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (len - 1)));
    real[i] = buffer[i] * windowMultiplier;
  }

  fft(real, imag);

  const half = (fftSize >> 1) + 1;
  const magnitudes = new Float32Array(half);
  for (let k = 0; k < half; k++) {
    magnitudes[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]) / fftSize;
  }
  return magnitudes;
}

/**
 * Half-wave rectified positive spectral flux between two spectra.
 */
export function calculateSpectralFlux(
  currentSpectrum: Float32Array,
  previousSpectrum: Float32Array
): number {
  const bins = Math.min(currentSpectrum.length, previousSpectrum.length);
  if (bins === 0) return 0;

  let sum = 0;
  for (let i = 0; i < bins; i++) {
    const diff = currentSpectrum[i] - previousSpectrum[i];
    if (diff > 0) {
      sum += diff;
    }
  }
  return sum / bins;
}

/**
 * Core Onset and Segment Detector
 */
export class OnsetDetector {
  private config: OnsetDetectorConfig;
  private previousRms = 0;
  private previousSpectrum: Float32Array | null = null;
  private lastOnsetTimeMs = -9999;
  private currentState: NoteState = 'SILENCE';

  // Pitch tracking continuity
  private lastStablePitchHz: number | null = null;
  private lastStableMidi: number | null = null;
  private pitchSamplesInCurrentNote: number[] = [];
  private currentNoteStartTimeMs = 0;

  constructor(options?: Partial<OnsetDetectorConfig>) {
    this.config = { ...DEFAULT_ONSET_CONFIG, ...options };
  }

  public updateConfig(options: Partial<OnsetDetectorConfig>): void {
    this.config = { ...this.config, ...options };
  }

  public reset(): void {
    this.previousRms = 0;
    this.previousSpectrum = null;
    this.lastOnsetTimeMs = -9999;
    this.currentState = 'SILENCE';
    this.lastStablePitchHz = null;
    this.lastStableMidi = null;
    this.pitchSamplesInCurrentNote = [];
    this.currentNoteStartTimeMs = 0;
  }

  /**
   * Process an audio frame along with optional pitch information.
   * Returns frame analysis and onset status.
   */
  public processFrame(
    buffer: Float32Array | number[],
    timestampMs: number,
    pitchHz: number | null = null
  ): FrameAnalysisResult {
    const {
      silenceThresholdRms,
      attackRmsDeltaThreshold,
      attackRelativeRiseThreshold,
      spectralFluxThreshold,
      refractoryPeriodMs,
      legatoPitchThresholdCents,
    } = this.config;

    // 1. Calculate RMS energy
    let sumSq = 0;
    for (let i = 0; i < buffer.length; i++) {
      sumSq += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sumSq / Math.max(1, buffer.length));

    // 2. Silence check
    const isSilent = rms < silenceThresholdRms;

    // 3. Compute spectral flux if active
    let spectralFlux = 0;
    const currentSpectrum = isSilent ? null : computeMagnitudeSpectrum(buffer, this.config.frameSize);
    if (currentSpectrum) {
      if (this.previousSpectrum) {
        spectralFlux = calculateSpectralFlux(currentSpectrum, this.previousSpectrum);
      } else {
        // Transition from silence or initial frame: compare against zero baseline
        const zeroSpectrum = new Float32Array(currentSpectrum.length);
        spectralFlux = calculateSpectralFlux(currentSpectrum, zeroSpectrum);
      }
    }

    // 4. Energy derivatives
    const rmsDelta = rms - this.previousRms;
    const timeSinceLastOnset = timestampMs - this.lastOnsetTimeMs;
    const canTriggerOnset = timeSinceLastOnset >= refractoryPeriodMs;

    // 5. Transient attack check
    const isEnergySurge = rmsDelta >= attackRmsDeltaThreshold && (
      this.previousRms <= 0.001 ||
      (rms / Math.max(0.001, this.previousRms)) >= attackRelativeRiseThreshold
    );
    const isSpectralSurge = spectralFlux >= spectralFluxThreshold;

    let isOnset = false;
    let isLegatoChange = false;

    if (!isSilent && canTriggerOnset && (isEnergySurge || isSpectralSurge)) {
      isOnset = true;
      this.lastOnsetTimeMs = timestampMs;
    }

    // 6. Legato Pitch Change Check (Transition without sharp energy attack)
    if (!isSilent && !isOnset && pitchHz !== null && this.lastStablePitchHz !== null) {
      const centsDiff = Math.abs(1200 * Math.log2(pitchHz / this.lastStablePitchHz));
      if (centsDiff >= legatoPitchThresholdCents && canTriggerOnset) {
        isLegatoChange = true;
        isOnset = true;
        this.lastOnsetTimeMs = timestampMs;
      }
    }

    // 7. State machine transitions
    let nextState: NoteState = this.currentState;

    if (isSilent) {
      nextState = 'SILENCE';
      this.lastStablePitchHz = null;
      this.lastStableMidi = null;
      this.pitchSamplesInCurrentNote = [];
    } else if (isOnset) {
      nextState = 'ATTACK';
      this.pitchSamplesInCurrentNote = pitchHz ? [pitchHz] : [];
      this.lastStablePitchHz = pitchHz;
      if (pitchHz) {
        this.lastStableMidi = Math.round(69 + 12 * Math.log2(pitchHz / 440));
      }
      this.currentNoteStartTimeMs = timestampMs;
    } else {
      nextState = 'SUSTAIN';
      if (pitchHz) {
        this.pitchSamplesInCurrentNote.push(pitchHz);
        const sorted = [...this.pitchSamplesInCurrentNote].sort((a, b) => a - b);
        this.lastStablePitchHz = sorted[Math.floor(sorted.length / 2)];
        this.lastStableMidi = Math.round(69 + 12 * Math.log2(this.lastStablePitchHz / 440));
      }
    }

    this.currentState = nextState;
    this.previousRms = rms;
    this.previousSpectrum = currentSpectrum;

    const detectedMidi = pitchHz ? Math.round(69 + 12 * Math.log2(pitchHz / 440)) : null;

    return {
      rms: Math.round(rms * 10000) / 10000,
      rmsDelta: Math.round(rmsDelta * 10000) / 10000,
      spectralFlux: Math.round(spectralFlux * 10000) / 10000,
      isSilent,
      isOnset,
      isLegatoChange,
      state: nextState,
      timestampMs,
      detectedPitchHz: pitchHz,
      detectedMidi,
    };
  }
}

/**
 * High-level Note Stream Segmenter
 * Turns consecutive audio frame analyses into discrete RawNoteSegment[] (notes and rests).
 */
export class NoteSegmenter {
  private onsetDetector: OnsetDetector;
  private completedSegments: RawNoteSegment[] = [];
  private activeSegment: {
    startTimeMs: number;
    isSilence: boolean;
    pitchSamples: number[];
    pitchWeights: number[];
    rmsSamples: number[];
  } | null = null;

  constructor(options?: Partial<OnsetDetectorConfig>) {
    this.onsetDetector = new OnsetDetector(options);
  }

  public updateConfig(options: Partial<OnsetDetectorConfig>): void {
    this.onsetDetector.updateConfig(options);
  }

  public reset(): void {
    this.onsetDetector.reset();
    this.completedSegments = [];
    this.activeSegment = null;
  }

  /**
   * Feed a frame and update segmented notes stream.
   * Optionally accepts a confidence probability score (0.0 to 1.0) from the pitch tracker.
   */
  public ingestFrame(
    buffer: Float32Array | number[],
    timestampMs: number,
    pitchHz: number | null,
    confidence: number = 1.0
  ): RawNoteSegment | null {
    const analysis = this.onsetDetector.processFrame(buffer, timestampMs, pitchHz);
    const weight = Math.max(0.0001, analysis.rms * Math.max(0.1, confidence));

    // Initial frame initialization
    if (!this.activeSegment) {
      this.activeSegment = {
        startTimeMs: timestampMs,
        isSilence: analysis.isSilent,
        pitchSamples: (pitchHz && !analysis.isSilent) ? [pitchHz] : [],
        pitchWeights: (pitchHz && !analysis.isSilent) ? [weight] : [],
        rmsSamples: [analysis.rms],
      };
      return null;
    }

    let finishedSegment: RawNoteSegment | null = null;

    // Check if a segment boundary occurred
    const crossedSilenceBoundary = this.activeSegment.isSilence !== analysis.isSilent;
    const triggeredOnsetWhileVoiced = !this.activeSegment.isSilence && analysis.isOnset;

    if (crossedSilenceBoundary || triggeredOnsetWhileVoiced) {
      finishedSegment = this.closeActiveSegment(timestampMs);
      this.activeSegment = {
        startTimeMs: timestampMs,
        isSilence: analysis.isSilent,
        pitchSamples: (pitchHz && !analysis.isSilent) ? [pitchHz] : [],
        pitchWeights: (pitchHz && !analysis.isSilent) ? [weight] : [],
        rmsSamples: [analysis.rms],
      };
    } else {
      // Accumulate into active segment
      this.activeSegment.rmsSamples.push(analysis.rms);
      if (pitchHz && !analysis.isSilent) {
        this.activeSegment.pitchSamples.push(pitchHz);
        this.activeSegment.pitchWeights.push(weight);
      }
    }

    return finishedSegment;
  }

  /**
   * Finalize recording stream and return all accumulated segments.
   */
  public finalize(finalTimestampMs: number): RawNoteSegment[] {
    if (this.activeSegment) {
      this.closeActiveSegment(finalTimestampMs);
    }
    return [...this.completedSegments];
  }

  public getSegments(): RawNoteSegment[] {
    return [...this.completedSegments];
  }

  private closeActiveSegment(endTimestampMs: number): RawNoteSegment | null {
    if (!this.activeSegment) return null;

    const durationMs = Math.max(0, endTimestampMs - this.activeSegment.startTimeMs);
    let avgFreq: number | null = null;
    let midi: number | null = null;

    if (!this.activeSegment.isSilence && this.activeSegment.pitchSamples.length > 0) {
      const pitches = this.activeSegment.pitchSamples;
      const weights = this.activeSegment.pitchWeights;

      // Energy-weighted pitch extraction:
      // Filter out low-energy attack/release transients if we have sufficient samples (>= 4)
      let candidateIndices = pitches.map((_, idx) => idx);
      if (pitches.length >= 4 && weights.length === pitches.length) {
        let maxWeight = 0;
        for (let i = 0; i < weights.length; i++) {
          if (weights[i] > maxWeight) maxWeight = weights[i];
        }
        const energyFloor = maxWeight * 0.20;
        const robustIndices = candidateIndices.filter(i => weights[i] >= energyFloor);
        if (robustIndices.length >= 2) {
          candidateIndices = robustIndices;
        }
      }

      // Compute energy-weighted median
      const paired = candidateIndices.map(i => ({
        pitch: pitches[i],
        weight: Math.max(0.0001, weights[i] ?? 1.0),
      }));

      paired.sort((a, b) => a.pitch - b.pitch);

      const totalWeight = paired.reduce((acc, cur) => acc + cur.weight, 0);
      let cumulative = 0;
      let weightedMedianFreq = paired[0].pitch;

      for (const item of paired) {
        cumulative += item.weight;
        if (cumulative >= totalWeight * 0.5) {
          weightedMedianFreq = item.pitch;
          break;
        }
      }

      avgFreq = Math.round(weightedMedianFreq * 10) / 10;
      midi = Math.round(69 + 12 * Math.log2(avgFreq / 440));
    }

    const avgRms = this.activeSegment.rmsSamples.length > 0
      ? this.activeSegment.rmsSamples.reduce((a, b) => a + b, 0) / this.activeSegment.rmsSamples.length
      : 0;

    const segment: RawNoteSegment = {
      startTimeMs: this.activeSegment.startTimeMs,
      endTimeMs: endTimestampMs,
      durationMs,
      midi,
      frequencyHz: avgFreq,
      avgRms: Math.round(avgRms * 10000) / 10000,
      pitchSamples: [...this.activeSegment.pitchSamples],
    };

    // Filter out micro-glitches under minimum duration if voiced
    if (this.activeSegment.isSilence || durationMs >= 40) {
      this.completedSegments.push(segment);
      return segment;
    }

    return null;
  }
}
