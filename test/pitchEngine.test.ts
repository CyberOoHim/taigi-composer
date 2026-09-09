import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  YinDetector,
  detectYinPitch,
  frequencyToMidi,
  midiToFrequency,
  frequencyToCents,
  getMidiNoteInfo,
  calculateRms,
  computeMedian,
} from '../lib/pitch/yinDetector.ts';
import {
  OnsetDetector,
  NoteSegmenter,
  computeMagnitudeSpectrum,
  calculateSpectralFlux,
} from '../lib/pitch/onsetDetector.ts';
import {
  midiToNumberedPitch,
  frequencyToNumberedPitch,
  applyScaleDegreeAttraction,
  type ScaleMode,
  quantizeDurationToBeats,
  quantizeRawSegments,
  segmentNotesIntoMeasures,
  transcribeAudioSegmentsToMeasures,
  shiftOctaves,
  transposeTranscribedNotes,
} from '../lib/pitch/scoreQuantizer.ts';
import type { RawNoteSegment } from '../lib/pitch/onsetDetector.ts';
import type { NumberedNotationNote } from '../types/song.ts';

/**
 * Helper to synthesize a mono audio buffer containing sine waves.
 */
function generateSineBuffer(
  frequency: number,
  durationSamples: number,
  sampleRate: number = 44100,
  amplitude: number = 0.5,
  harmonics?: { factor: number; relativeAmp: number }[]
): Float32Array {
  const buffer = new Float32Array(durationSamples);
  for (let i = 0; i < durationSamples; i++) {
    const t = i / sampleRate;
    let sample = Math.sin(2 * Math.PI * frequency * t) * amplitude;

    if (harmonics) {
      for (const h of harmonics) {
        sample += Math.sin(2 * Math.PI * (frequency * h.factor) * t) * (amplitude * h.relativeAmp);
      }
    }
    buffer[i] = sample;
  }
  return buffer;
}

describe('Stage 1: Musical Conversion Utilities', () => {
  it('converts standard A4 (440Hz) to MIDI 69 and back', () => {
    const midi = frequencyToMidi(440);
    assert.strictEqual(Math.round(midi), 69);
    assert.strictEqual(Math.round(midiToFrequency(69)), 440);
  });

  it('converts Middle C (C4) frequency to MIDI 60', () => {
    const c4Freq = 261.625565;
    const midi = frequencyToMidi(c4Freq);
    assert.strictEqual(Math.round(midi), 60);
    const resolved = getMidiNoteInfo(c4Freq);
    assert.ok(resolved);
    assert.strictEqual(resolved?.noteName, 'C4');
    assert.strictEqual(resolved?.midi, 60);
    assert.strictEqual(resolved?.pitchClass, 'C');
    assert.strictEqual(resolved?.octave, 4);
    assert.strictEqual(Math.abs(resolved?.centsOff || 0) < 0.5, true);
  });

  it('computes accurate cents deviation', () => {
    // 1 semitone is exactly 100 cents (e.g. 440Hz -> 466.16Hz)
    const semitoneUp = 440 * Math.pow(2, 1 / 12);
    const cents = frequencyToCents(semitoneUp, 440);
    assert.strictEqual(Math.round(cents), 100);
  });

  it('computes exact running median', () => {
    assert.strictEqual(computeMedian([440, 442, 441]), 441);
    assert.strictEqual(computeMedian([440, 500, 441, 442, 439]), 441);
    assert.strictEqual(computeMedian([10, 20, 30, 40]), 25);
  });
});

describe('Stage 1: YIN Pitch Detection Benchmarks', () => {
  const sampleRate = 44100;
  const bufferSize = 2048;

  it('detects standard concert pitch A4 (440.0 Hz) within 0.5 Hz tolerance', () => {
    const buffer = generateSineBuffer(440.0, bufferSize, sampleRate, 0.7);
    const result = detectYinPitch(buffer, { sampleRate });

    assert.strictEqual(result.isPitched, true);
    assert.ok(result.frequency !== null);
    assert.strictEqual(result.nearestMidi, 69);
    assert.strictEqual(result.noteName, 'A4');
    assert.ok(result.probability > 0.95, `Expected probability > 0.95, got ${result.probability}`);

    const errorHz = Math.abs((result.frequency || 0) - 440.0);
    assert.ok(errorHz <= 0.5, `Frequency error too high: ${errorHz} Hz (expected <= 0.5 Hz)`);
  });

  it('detects Middle C C4 (261.63 Hz) within 0.5 Hz tolerance', () => {
    const buffer = generateSineBuffer(261.63, bufferSize, sampleRate, 0.7);
    const result = detectYinPitch(buffer, { sampleRate });

    assert.strictEqual(result.isPitched, true);
    assert.ok(result.frequency !== null);
    assert.strictEqual(result.nearestMidi, 60);
    assert.strictEqual(result.noteName, 'C4');

    const errorHz = Math.abs((result.frequency || 0) - 261.63);
    assert.ok(errorHz <= 0.5, `Frequency error too high: ${errorHz} Hz`);
  });

  it('detects high flute tone E5 (659.25 Hz)', () => {
    const buffer = generateSineBuffer(659.25, bufferSize, sampleRate, 0.6);
    const result = detectYinPitch(buffer, { sampleRate });

    assert.strictEqual(result.isPitched, true);
    assert.strictEqual(result.nearestMidi, 76);
    assert.strictEqual(result.noteName, 'E5');
    const errorHz = Math.abs((result.frequency || 0) - 659.25);
    assert.ok(errorHz <= 1.0, `Error too high: ${errorHz} Hz`);
  });

  it('detects low vocal/guitar tone G3 (196.00 Hz)', () => {
    const buffer = generateSineBuffer(196.00, bufferSize, sampleRate, 0.6);
    const result = detectYinPitch(buffer, { sampleRate });

    assert.strictEqual(result.isPitched, true);
    assert.strictEqual(result.nearestMidi, 55);
    assert.strictEqual(result.noteName, 'G3');
    const errorHz = Math.abs((result.frequency || 0) - 196.00);
    assert.ok(errorHz <= 0.8, `Error too high: ${errorHz} Hz`);
  });

  it('resists octave doubling on rich harmonic signals (Erhu/Vocal harmonic test)', () => {
    // 220Hz fundamental (A3) with strong 2nd harmonic (440Hz, 1.2x) and 3rd harmonic (660Hz, 0.9x)
    const complexBuffer = generateSineBuffer(220.0, bufferSize, sampleRate, 0.4, [
      { factor: 2, relativeAmp: 1.2 }, // 440 Hz is louder than fundamental
      { factor: 3, relativeAmp: 0.9 }, // 660 Hz
    ]);

    const result = detectYinPitch(complexBuffer, { sampleRate, threshold: 0.15 });

    assert.strictEqual(result.isPitched, true);
    // Crucial check: Fundamental must be detected as ~220Hz (A3, MIDI 57), NOT 440Hz (A4, MIDI 69)
    assert.strictEqual(result.nearestMidi, 57);
    assert.strictEqual(result.noteName, 'A3');
    const errorHz = Math.abs((result.frequency || 0) - 220.0);
    assert.ok(errorHz <= 1.0, `Octave doubling detected or pitch inaccurate: got ${result.frequency} Hz`);
  });

  it('safely rejects silence and background ambient noise', () => {
    const silentBuffer = new Float32Array(bufferSize);
    const resultSilent = detectYinPitch(silentBuffer, { sampleRate });
    assert.strictEqual(resultSilent.isPitched, false);
    assert.strictEqual(resultSilent.frequency, null);

    // Low amplitude random noise (< 0.003)
    const noiseBuffer = new Float32Array(bufferSize);
    for (let i = 0; i < bufferSize; i++) {
      noiseBuffer[i] = (Math.random() - 0.5) * 0.002;
    }
    const resultNoise = detectYinPitch(noiseBuffer, { sampleRate });
    assert.strictEqual(resultNoise.isPitched, false);
    assert.strictEqual(resultNoise.frequency, null);
  });

  it('smooths micro-vibrato using YinDetector.detectSmoothed', () => {
    const detector = new YinDetector({ sampleRate, medianFilterSize: 5 });

    // Stream 5 frames with ±15 cents natural vibrato (436Hz to 444Hz)
    const vibratoFrequencies = [440.0, 443.5, 437.0, 442.8, 439.5];
    let lastSmoothedResult = null;

    for (const freq of vibratoFrequencies) {
      const frame = generateSineBuffer(freq, 1024, sampleRate, 0.6);
      lastSmoothedResult = detector.detectSmoothed(frame);
    }

    assert.ok(lastSmoothedResult);
    assert.strictEqual(lastSmoothedResult?.isPitched, true);
    assert.strictEqual(lastSmoothedResult?.nearestMidi, 69); // Centered at A4
    // Smoothed frequency should be very close to the center 440.0 Hz
    const dev = Math.abs((lastSmoothedResult?.frequency || 0) - 440.0);
    assert.ok(dev <= 1.5, `Median filter deviation too high: ${dev} Hz`);
  });
});

describe('Stage 1: Onset & Segment Detector Benchmarks', () => {
  const sampleRate = 44100;
  const frameSize = 512;

  it('computes accurate RMS energy of known sine wave', () => {
    // A sine wave of peak amplitude 1.0 has theoretical RMS = 1 / sqrt(2) ≈ 0.7071
    const buffer = generateSineBuffer(440, frameSize, sampleRate, 1.0);
    const rms = calculateRms(buffer);
    assert.ok(Math.abs(rms - (1 / Math.SQRT2)) < 0.02, `RMS expected ~0.7071, got ${rms}`);
  });

  it('computes positive spectral flux and triggers attack onset on sudden tone burst', () => {
    const detector = new OnsetDetector({
      sampleRate,
      frameSize,
      silenceThresholdRms: 0.008,
      attackRmsDeltaThreshold: 0.02,
      refractoryPeriodMs: 50,
    });

    // 1. Silent baseline frame
    const silentFrame = new Float32Array(frameSize);
    const f1 = detector.processFrame(silentFrame, 0, null);
    assert.strictEqual(f1.isSilent, true);
    assert.strictEqual(f1.isOnset, false);

    // 2. Sudden loud burst frame (Tongue attack / consonant onset)
    const attackFrame = generateSineBuffer(440, frameSize, sampleRate, 0.8);
    const f2 = detector.processFrame(attackFrame, 15, 440);

    assert.strictEqual(f2.isSilent, false);
    assert.strictEqual(f2.isOnset, true);
    assert.strictEqual(f2.state, 'ATTACK');
    assert.ok(f2.spectralFlux > 0, 'Spectral flux should be positive on onset');

    // 3. Sustained continuation frame
    const sustainFrame = generateSineBuffer(440, frameSize, sampleRate, 0.78);
    const f3 = detector.processFrame(sustainFrame, 30, 440);
    assert.strictEqual(f3.isSilent, false);
    assert.strictEqual(f3.isOnset, false);
    assert.strictEqual(f3.state, 'SUSTAIN');
  });

  it('enforces refractory period against spurious immediate re-triggers', () => {
    const detector = new OnsetDetector({
      sampleRate,
      frameSize,
      refractoryPeriodMs: 80,
    });

    const burst1 = generateSineBuffer(440, frameSize, sampleRate, 0.7);
    const f1 = detector.processFrame(burst1, 100, 440);
    assert.strictEqual(f1.isOnset, true);

    // Immediately after at 120ms (within 80ms refractory period)
    const burst2 = generateSineBuffer(440, frameSize, sampleRate, 0.95);
    const f2 = detector.processFrame(burst2, 120, 440);
    assert.strictEqual(f2.isOnset, false, 'Should be suppressed by refractory guard');

    // After 100ms elapsed at 220ms
    const burst3 = generateSineBuffer(440, frameSize, sampleRate, 0.98);
    const f3 = detector.processFrame(burst3, 220, 440);
    // Here it can sustain or re-trigger if delta is sufficient
  });

  it('detects legato pitch changes without amplitude silence dip', () => {
    const detector = new OnsetDetector({
      sampleRate,
      frameSize,
      refractoryPeriodMs: 50,
      legatoPitchThresholdCents: 75,
    });

    // Stabilize at C4 (261.63Hz)
    const c4Frame = generateSineBuffer(261.63, frameSize, sampleRate, 0.6);
    detector.processFrame(c4Frame, 0, 261.63);
    detector.processFrame(c4Frame, 20, 261.63);

    // Legato transition to E4 (329.63Hz, ~400 cents higher) with same volume
    const e4Frame = generateSineBuffer(329.63, frameSize, sampleRate, 0.6);
    const legatoFrame = detector.processFrame(e4Frame, 80, 329.63);

    assert.strictEqual(legatoFrame.isOnset, true);
    assert.strictEqual(legatoFrame.isLegatoChange, true);
  });

  it('segments continuous audio stream into discrete notes and rests using NoteSegmenter', () => {
    const segmenter = new NoteSegmenter({
      sampleRate,
      frameSize,
      silenceThresholdRms: 0.008,
      refractoryPeriodMs: 40,
    });

    const c4Buffer = generateSineBuffer(261.63, frameSize, sampleRate, 0.5);
    const silentBuffer = new Float32Array(frameSize);
    const g4Buffer = generateSineBuffer(392.00, frameSize, sampleRate, 0.5);

    // Note 1 (C4): 0ms to 100ms
    segmenter.ingestFrame(c4Buffer, 0, 261.63);
    segmenter.ingestFrame(c4Buffer, 25, 261.63);
    segmenter.ingestFrame(c4Buffer, 50, 261.63);
    segmenter.ingestFrame(c4Buffer, 75, 261.63);

    // Rest: 100ms to 200ms
    segmenter.ingestFrame(silentBuffer, 100, null);
    segmenter.ingestFrame(silentBuffer, 150, null);

    // Note 2 (G4): 200ms to 300ms
    segmenter.ingestFrame(g4Buffer, 200, 392.00);
    segmenter.ingestFrame(g4Buffer, 250, 392.00);
    segmenter.ingestFrame(g4Buffer, 275, 392.00);

    const segments = segmenter.finalize(300);

    assert.ok(segments.length >= 3, `Expected at least 3 segments (note, rest, note), got ${segments.length}`);

    // First segment is Note 1 (C4, MIDI 60)
    assert.strictEqual(segments[0].midi, 60);
    assert.ok(segments[0].durationMs >= 75);

    // Second segment is Rest / Silence (null MIDI)
    assert.strictEqual(segments[1].midi, null);

    // Third segment is Note 2 (G4, MIDI 67)
    assert.strictEqual(segments[2].midi, 67);
    assert.ok(segments[2].durationMs >= 75);
  });
});

describe('Stage 2: Numbered Notation Scale Degree Mapping', () => {
  it('maps standard diatonic pitches in Key of C (1 = C)', () => {
    // 1 (Do) = C4 (MIDI 60)
    const doNote = midiToNumberedPitch(60, 'C');
    assert.strictEqual(doNote.pitch, 1);
    assert.strictEqual(doNote.octave, 0);
    assert.strictEqual(doNote.accidental, '');

    // 2 (Re) = D4 (MIDI 62)
    const reNote = midiToNumberedPitch(62, 'C');
    assert.strictEqual(reNote.pitch, 2);
    assert.strictEqual(reNote.octave, 0);

    // 3 (Mi) = E4 (MIDI 64)
    const miNote = midiToNumberedPitch(64, 'C');
    assert.strictEqual(miNote.pitch, 3);
    assert.strictEqual(miNote.octave, 0);

    // 4 (Fa) = F4 (MIDI 65)
    const faNote = midiToNumberedPitch(65, 'C');
    assert.strictEqual(faNote.pitch, 4);
    assert.strictEqual(faNote.octave, 0);

    // 5 (Sol) = G4 (MIDI 67)
    const solNote = midiToNumberedPitch(67, 'C');
    assert.strictEqual(solNote.pitch, 5);
    assert.strictEqual(solNote.octave, 0);

    // 6 (La) = A4 (MIDI 69)
    const laNote = midiToNumberedPitch(69, 'C');
    assert.strictEqual(laNote.pitch, 6);
    assert.strictEqual(laNote.octave, 0);

    // 7 (Ti) = B4 (MIDI 71)
    const tiNote = midiToNumberedPitch(71, 'C');
    assert.strictEqual(tiNote.pitch, 7);
    assert.strictEqual(tiNote.octave, 0);

    // High 1 (Do with top dot) = C5 (MIDI 72)
    const highDo = midiToNumberedPitch(72, 'C');
    assert.strictEqual(highDo.pitch, 1);
    assert.strictEqual(highDo.octave, 1);

    // Low 5 (Sol with bottom dot) = G3 (MIDI 55)
    const lowSol = midiToNumberedPitch(55, 'C');
    assert.strictEqual(lowSol.pitch, 5);
    assert.strictEqual(lowSol.octave, -1);

    // Rest / silence (null MIDI)
    const rest = midiToNumberedPitch(null, 'C');
    assert.strictEqual(rest.pitch, 0);
    assert.strictEqual(rest.octave, 0);
  });

  it('maps transposed key signatures accurately (Key of F and Key of G)', () => {
    // Key of F: 1 = F4 (MIDI 65)
    const fDo = midiToNumberedPitch(65, 'F');
    assert.strictEqual(fDo.pitch, 1);
    assert.strictEqual(fDo.octave, 0);

    // Key of F: 4 (Fa) = Bb4 (MIDI 70)
    const fFa = midiToNumberedPitch(70, 'F');
    assert.strictEqual(fFa.pitch, 4);
    assert.strictEqual(fFa.octave, 0);

    // Key of F: 5 (Sol) = C5 (MIDI 72)
    const fSol = midiToNumberedPitch(72, 'F');
    assert.strictEqual(fSol.pitch, 5);
    assert.strictEqual(fSol.octave, 0);

    // Key of F: Low 5 = C4 (MIDI 60)
    const fLowSol = midiToNumberedPitch(60, 'F');
    assert.strictEqual(fLowSol.pitch, 5);
    assert.strictEqual(fLowSol.octave, -1);

    // Key of G: 1 = G4 (MIDI 67)
    const gDo = midiToNumberedPitch(67, 'G');
    assert.strictEqual(gDo.pitch, 1);
    assert.strictEqual(gDo.octave, 0);

    // Key of G: 5 = D5 (MIDI 74)
    const gSol = midiToNumberedPitch(74, 'G');
    assert.strictEqual(gSol.pitch, 5);
    assert.strictEqual(gSol.octave, 0);

    // Key of G: 7 (Ti) = F#4 (MIDI 66)
    const gTi = midiToNumberedPitch(66, 'G');
    assert.strictEqual(gTi.pitch, 7);
    assert.strictEqual(gTi.octave, -1);
  });

  it('maps accidental variations (flat 7, sharp 4, flat 3) for Taiwanese folk melodies', () => {
    // In Key C: Bb4 (MIDI 70) is minor 7th -> b7
    const flat7 = midiToNumberedPitch(70, 'C');
    assert.strictEqual(flat7.pitch, 7);
    assert.strictEqual(flat7.accidental, 'b');

    // In Key C: F#4 (MIDI 66) is tritone -> #4
    const sharp4 = midiToNumberedPitch(66, 'C');
    assert.strictEqual(sharp4.pitch, 4);
    assert.strictEqual(sharp4.accidental, '#');

    // In Key C: Eb4 (MIDI 63) is minor 3rd -> b3
    const flat3 = midiToNumberedPitch(63, 'C');
    assert.strictEqual(flat3.pitch, 3);
    assert.strictEqual(flat3.accidental, 'b');
  });

  it('converts raw analog frequency to NumberedPitchInfo with cents precision', () => {
    // 440 Hz in Key C -> MIDI 69 (A4) = 6 (La)
    const resultA4 = frequencyToNumberedPitch(440.0, 'C');
    assert.strictEqual(resultA4.pitch, 6);
    assert.strictEqual(resultA4.octave, 0);
    assert.ok(Math.abs(resultA4.centsOff) < 1.0);

    // Slightly sharp A4 (445 Hz)
    const sharpA4 = frequencyToNumberedPitch(445.0, 'C');
    assert.strictEqual(sharpA4.pitch, 6);
    assert.ok(sharpA4.centsOff > 10 && sharpA4.centsOff < 30);
  });
});

describe('Stage 2: Beat-Grid Duration Quantization', () => {
  it('quantizes standard durations at 80 BPM (1 beat = 750ms)', () => {
    const bpm = 80;

    // Quarter note: 750ms -> 1.0 beat
    const q = quantizeDurationToBeats(750, bpm, 'eighth');
    assert.strictEqual(q.duration, 1.0);
    assert.strictEqual(q.isDotted, false);

    // Eighth note: 375ms -> 0.5 beat
    const e = quantizeDurationToBeats(375, bpm, 'eighth');
    assert.strictEqual(e.duration, 0.5);
    assert.strictEqual(e.isDotted, false);

    // Half note: 1500ms -> 2.0 beats
    const h = quantizeDurationToBeats(1500, bpm, 'eighth');
    assert.strictEqual(h.duration, 2.0);

    // Dotted quarter: 1125ms -> 1.5 beats
    const dq = quantizeDurationToBeats(1125, bpm, 'eighth');
    assert.strictEqual(dq.duration, 1.5);
    assert.strictEqual(dq.isDotted, true);

    // Dotted eighth: 562.5ms -> 0.75 beats
    const de = quantizeDurationToBeats(562.5, bpm, 'eighth');
    assert.strictEqual(de.duration, 0.75);
    assert.strictEqual(de.isDotted, true);

    // Whole note: 3000ms -> 4.0 beats
    const w = quantizeDurationToBeats(3000, bpm, 'eighth');
    assert.strictEqual(w.duration, 4.0);
  });

  it('quantizes sixteenth notes on a sixteenth grid', () => {
    const bpm = 80;
    // Sixteenth note: 187.5ms -> 0.25 beat
    const sx = quantizeDurationToBeats(187.5, bpm, 'sixteenth');
    assert.strictEqual(sx.duration, 0.25);
    assert.strictEqual(sx.isDotted, false);

    // Dotted sixteenth note: 281.25ms -> 0.375 beat
    const dsx = quantizeDurationToBeats(281.25, bpm, 'sixteenth');
    assert.strictEqual(dsx.duration, 0.375);
    assert.strictEqual(dsx.isDotted, true);
  });

  it('tolerates human vocal tempo drift and jitter', () => {
    const bpm = 80; // nominal 750ms quarter, 375ms eighth

    // Slightly rushed quarter note (710ms instead of 750ms)
    const rushedQ = quantizeDurationToBeats(710, bpm, 'eighth');
    assert.strictEqual(rushedQ.duration, 1.0);

    // Slightly dragged quarter note (790ms instead of 750ms)
    const draggedQ = quantizeDurationToBeats(790, bpm, 'eighth');
    assert.strictEqual(draggedQ.duration, 1.0);

    // Slightly rushed eighth note (350ms instead of 375ms)
    const rushedE = quantizeDurationToBeats(350, bpm, 'eighth');
    assert.strictEqual(rushedE.duration, 0.5);

    // Slightly dragged eighth note (410ms instead of 375ms)
    const draggedE = quantizeDurationToBeats(410, bpm, 'eighth');
    assert.strictEqual(draggedE.duration, 0.5);
  });

  it('quantizes triplets when allowTriplets is enabled', () => {
    const bpm = 80; // 750ms / beat -> triplet eighth is 250ms (~0.333 beat)
    const trip = quantizeDurationToBeats(250, bpm, 'eighth', true);
    assert.strictEqual(trip.duration, 0.333);
    assert.strictEqual(trip.isTriplet, true);
  });
});

describe('Stage 2: Measure Layout & Barline Tie Splitting', () => {
  it('packs exact beats into a 4/4 measure without splitting', () => {
    const notes: NumberedNotationNote[] = [
      { id: 'n1', pitch: 1, octave: 0, duration: 1, lyric: {} },
      { id: 'n2', pitch: 2, octave: 0, duration: 1, lyric: {} },
      { id: 'n3', pitch: 3, octave: 0, duration: 1, lyric: {} },
      { id: 'n4', pitch: 5, octave: 0, duration: 1, lyric: {} },
    ];

    const measures = segmentNotesIntoMeasures(notes, { timeSignature: '4/4' });
    assert.strictEqual(measures.length, 1);
    assert.strictEqual(measures[0].notes.length, 4);
    assert.strictEqual(measures[0].notes[3].tieToNext ?? false, false);
  });

  it('splits pitched notes crossing a measure boundary and links them with tieToNext: true', () => {
    // Measure has 3 beats filled, then a 2-beat note arrives (overflows by 1 beat)
    const notes: NumberedNotationNote[] = [
      { id: 'n1', pitch: 5, octave: 0, duration: 3, lyric: { hanlo: '雨' } },
      { id: 'n2', pitch: 6, octave: 0, duration: 2, lyric: { hanlo: '水' } },
    ];

    const measures = segmentNotesIntoMeasures(notes, { timeSignature: '4/4' });
    assert.strictEqual(measures.length, 2, 'Should create 2 measures');

    // Measure 1: 3 beats (n1) + 1 beat (n2 part 1) = 4 beats
    assert.strictEqual(measures[0].notes.length, 2);
    assert.strictEqual(measures[0].notes[0].pitch, 5);
    assert.strictEqual(measures[0].notes[0].duration, 3);
    assert.strictEqual(measures[0].notes[1].pitch, 6);
    assert.strictEqual(measures[0].notes[1].duration, 1);
    assert.strictEqual(measures[0].notes[1].tieToNext, true, 'Part 1 at barline must have tieToNext: true');

    // Measure 2: 1 beat (n2 part 2)
    assert.strictEqual(measures[1].notes.length, 1);
    assert.strictEqual(measures[1].notes[0].pitch, 6);
    assert.strictEqual(measures[1].notes[0].duration, 1);
    assert.strictEqual(measures[1].notes[0].tieToNext ?? false, false, 'Part 2 should not tie to next');
  });

  it('splits multi-measure sustained notes across multiple barlines', () => {
    // Sustained 6-beat note starting at beat 0 in 4/4 time
    const notes: NumberedNotationNote[] = [
      { id: 'long1', pitch: 1, octave: 0, duration: 6, lyric: {} },
    ];

    const measures = segmentNotesIntoMeasures(notes, { timeSignature: '4/4' });
    assert.strictEqual(measures.length, 2);

    // Measure 1: 4 beats (whole measure) with tie
    assert.strictEqual(measures[0].notes.length, 1);
    assert.strictEqual(measures[0].notes[0].duration, 4);
    assert.strictEqual(measures[0].notes[0].tieToNext, true);

    // Measure 2: remaining 2 beats without tie
    assert.strictEqual(measures[1].notes.length, 1);
    assert.strictEqual(measures[1].notes[0].duration, 2);
    assert.strictEqual(measures[1].notes[0].tieToNext ?? false, false);
  });

  it('does NOT tie rests across barlines', () => {
    // 3 beats note + 2 beats rest in 4/4
    const notes: NumberedNotationNote[] = [
      { id: 'n1', pitch: 3, octave: 0, duration: 3, lyric: {} },
      { id: 'rest1', pitch: 0, octave: 0, duration: 2, lyric: {} },
    ];

    const measures = segmentNotesIntoMeasures(notes, { timeSignature: '4/4' });
    assert.strictEqual(measures.length, 2);

    // Measure 1: note 3 (3 beats) + rest (1 beat)
    assert.strictEqual(measures[0].notes[1].pitch, 0);
    assert.strictEqual(measures[0].notes[1].duration, 1);
    assert.strictEqual(measures[0].notes[1].tieToNext, false, 'Rests must NOT be tied across barline');

    // Measure 2: rest (1 beat)
    assert.strictEqual(measures[1].notes[0].pitch, 0);
    assert.strictEqual(measures[1].notes[0].duration, 1);
    assert.strictEqual(measures[1].notes[0].tieToNext, false);
  });

  it('handles 3/4 and 2/4 time signatures accurately', () => {
    // 3/4 time signature (3 beats per measure)
    const notes34: NumberedNotationNote[] = [
      { id: 'a', pitch: 1, octave: 0, duration: 2, lyric: {} },
      { id: 'b', pitch: 2, octave: 0, duration: 2, lyric: {} }, // 2 + 2 = 4 -> splits into 2 + 1 in M1, 1 in M2
    ];

    const measures34 = segmentNotesIntoMeasures(notes34, { timeSignature: '3/4' });
    assert.strictEqual(measures34.length, 2);
    assert.strictEqual(measures34[0].notes[0].duration, 2);
    assert.strictEqual(measures34[0].notes[1].duration, 1);
    assert.strictEqual(measures34[0].notes[1].tieToNext, true);
    assert.strictEqual(measures34[1].notes[0].duration, 1);

    // 2/4 time signature (2 beats per measure)
    const notes24: NumberedNotationNote[] = [
      { id: 'x', pitch: 5, octave: 0, duration: 1, lyric: {} },
      { id: 'y', pitch: 6, octave: 0, duration: 1, lyric: {} },
      { id: 'z', pitch: 1, octave: 1, duration: 1, lyric: {} },
    ];

    const measures24 = segmentNotesIntoMeasures(notes24, { timeSignature: '2/4' });
    assert.strictEqual(measures24.length, 2);
    assert.strictEqual(measures24[0].notes.length, 2); // 1 + 1 = 2
    assert.strictEqual(measures24[1].notes.length, 1); // 1
  });

  it('runs complete end-to-end transcription from raw segments to measures', () => {
    // Simulate a hummed 4-note motif at 80 BPM (750ms/beat):
    // Note 1: C4 (MIDI 60) for 750ms (1 beat)
    // Note 2: E4 (MIDI 64) for 750ms (1 beat)
    // Note 3: G4 (MIDI 67) for 1500ms (2 beats)
    // Note 4: A4 (MIDI 69) for 1500ms (2 beats, crosses barline!)
    const rawSegments: RawNoteSegment[] = [
      {
        startTimeMs: 0,
        endTimeMs: 750,
        durationMs: 750,
        midi: 60,
        frequencyHz: 261.63,
        avgRms: 0.15,
        pitchSamples: [261.63, 261.63],
      },
      {
        startTimeMs: 750,
        endTimeMs: 1500,
        durationMs: 750,
        midi: 64,
        frequencyHz: 329.63,
        avgRms: 0.16,
        pitchSamples: [329.63, 329.63],
      },
      {
        startTimeMs: 1500,
        endTimeMs: 3000,
        durationMs: 1500,
        midi: 67,
        frequencyHz: 392.00,
        avgRms: 0.17,
        pitchSamples: [392.00, 392.00],
      },
      {
        startTimeMs: 3000,
        endTimeMs: 4500,
        durationMs: 1500,
        midi: 69,
        frequencyHz: 440.00,
        avgRms: 0.18,
        pitchSamples: [440.00, 440.00],
      },
    ];

    const result = transcribeAudioSegmentsToMeasures(rawSegments, {
      key: 'C',
      timeSignature: '4/4',
      bpm: 80,
      grid: 'eighth',
    });

    assert.ok(result.measures.length >= 2, 'Should span at least 2 measures');
    assert.strictEqual(result.summary.totalNotes, 4);
    assert.ok(result.summary.averagePitchAccuracyCents < 1.0);

    // Measure 1: 1 beat (C4) + 1 beat (E4) + 2 beats (G4) = 4 beats total!
    assert.strictEqual(measuresTotalBeats(result.measures[0]), 4);
    assert.strictEqual(result.measures[0].notes[0].pitch, 1);
    assert.strictEqual(result.measures[0].notes[1].pitch, 3);
    assert.strictEqual(result.measures[0].notes[2].pitch, 5);

    // Measure 2: 2 beats (A4) = 2 beats
    assert.strictEqual(result.measures[1].notes[0].pitch, 6);
    assert.strictEqual(result.measures[1].notes[0].duration, 2);
  });

  it('shifts octaves and transposes transcribed notes cleanly', () => {
    const original: NumberedNotationNote[] = [
      { id: '1', pitch: 1, octave: 0, duration: 1, lyric: {} },
      { id: '2', pitch: 5, octave: 0, duration: 1, lyric: {} },
    ];

    // Shift octave +1
    const shifted = shiftOctaves(original, 1);
    assert.strictEqual(shifted[0].octave, 1);
    assert.strictEqual(shifted[1].octave, 1);

    // Transpose from Key C to Key F (C is 1 in C, C is 5 in F)
    const transposed = transposeTranscribedNotes(original, 'C', 'F');
    // Note 1 (Do in C = C4) -> In Key F, C4 is Sol (5)
    assert.strictEqual(transposed[0].pitch, 5);
  });
});

describe('Enhanced Vocal Pitch & Beat Length Accuracy (Hum-to-Score)', () => {
  it('suppresses false sharps/flats from vocal pitch drift via diatonic scale attraction', () => {
    // Middle C is 261.63 Hz. +55 cents = 270.06 Hz (in between C and C#)
    const driftedCHz = midiToFrequency(60) * Math.pow(2, 55 / 1200);

    // Diatonic mode: Human voice drifting +55 cents should stay on 1 (Do), not jump to #1
    const diatonicResult = frequencyToNumberedPitch(driftedCHz, 'C', { scaleMode: 'diatonic' });
    assert.strictEqual(diatonicResult.pitch, 1, 'Diatonic mode should attract +55 cents drift to 1 (Do)');
    assert.strictEqual(diatonicResult.accidental, '');

    // Chromatic mode: Strict 12-TET rounding rounds +55 cents up to C#4 (#1)
    const chromaticResult = frequencyToNumberedPitch(driftedCHz, 'C', { scaleMode: 'chromatic' });
    assert.strictEqual(chromaticResult.pitch, 1);
    assert.strictEqual(chromaticResult.accidental, '#');
  });

  it('preserves authentic Taiwanese folk inflections (b7, #4, b3) under diatonic attraction', () => {
    // Bb4 (b7 in Key C) = 466.16 Hz
    const bb4Hz = 466.16;
    const b7Result = frequencyToNumberedPitch(bb4Hz, 'C', { scaleMode: 'diatonic' });
    assert.strictEqual(b7Result.pitch, 7);
    assert.strictEqual(b7Result.accidental, 'b');

    // F#4 (#4 in Key C) = 369.99 Hz
    const fs4Hz = 369.99;
    const sharp4Result = frequencyToNumberedPitch(fs4Hz, 'C', { scaleMode: 'diatonic' });
    assert.strictEqual(sharp4Result.pitch, 4);
    assert.strictEqual(sharp4Result.accidental, '#');

    // Eb4 (b3 in Key C) = 311.13 Hz
    const eb4Hz = 311.13;
    const flat3Result = frequencyToNumberedPitch(eb4Hz, 'C', { scaleMode: 'diatonic' });
    assert.strictEqual(flat3Result.pitch, 3);
    assert.strictEqual(flat3Result.accidental, 'b');
  });

  it('attracts half-step passing tones in pentatonic mode (1, 2, 3, 5, 6)', () => {
    // F4 (Fa, 349.23 Hz) in pentatonic mode pulls towards 3 (Mi)
    const f4Hz = 349.23;
    const pentatonicFa = frequencyToNumberedPitch(f4Hz, 'C', { scaleMode: 'pentatonic' });
    assert.strictEqual(pentatonicFa.pitch, 3, 'Fa should attract to Mi in pentatonic mode');

    // B4 (Ti, 493.88 Hz) in pentatonic mode pulls towards 1 (high Do)
    const b4Hz = 493.88;
    const pentatonicTi = frequencyToNumberedPitch(b4Hz, 'C', { scaleMode: 'pentatonic' });
    assert.strictEqual(pentatonicTi.pitch, 1, 'Ti should attract to Do in pentatonic mode');
    assert.strictEqual(pentatonicTi.octave, 1);
  });

  it('absorbs short articulation gaps (100-200ms) into full quarter notes at 80 BPM', () => {
    // At 80 BPM (750ms/beat), 4 hummed syllables "da-da-da-da":
    // Human singer holds sound for ~600ms, with ~150ms breath/release gap before next syllable
    const rawSegments: RawNoteSegment[] = [
      {
        startTimeMs: 0,
        endTimeMs: 600,
        durationMs: 600,
        midi: 60,
        frequencyHz: 261.63,
        avgRms: 0.2,
        pitchSamples: [261.63],
      },
      {
        startTimeMs: 750,
        endTimeMs: 1350,
        durationMs: 600,
        midi: 62,
        frequencyHz: 293.66,
        avgRms: 0.2,
        pitchSamples: [293.66],
      },
      {
        startTimeMs: 1500,
        endTimeMs: 2100,
        durationMs: 600,
        midi: 64,
        frequencyHz: 329.63,
        avgRms: 0.2,
        pitchSamples: [329.63],
      },
      {
        startTimeMs: 2250,
        endTimeMs: 2850,
        durationMs: 600,
        midi: 67,
        frequencyHz: 392.00,
        avgRms: 0.2,
        pitchSamples: [392.00],
      },
    ];

    // With absorbArticulationGaps: true
    const smoothed = transcribeAudioSegmentsToMeasures(rawSegments, {
      bpm: 80,
      timeSignature: '4/4',
      key: 'C',
      grid: 'eighth',
      absorbArticulationGaps: true,
      scaleMode: 'diatonic',
    });

    assert.strictEqual(smoothed.measures.length, 1);
    const notes = smoothed.measures[0].notes;
    // Exactly 4 notes, all quarter notes (duration = 1), zero rests!
    assert.strictEqual(notes.length, 4, 'Should transcribe as exactly 4 notes without rest fragmentation');
    assert.strictEqual(notes[0].pitch, 1);
    assert.strictEqual(notes[0].duration, 1);
    assert.strictEqual(notes[1].pitch, 2);
    assert.strictEqual(notes[1].duration, 1);
    assert.strictEqual(notes[2].pitch, 3);
    assert.strictEqual(notes[2].duration, 1);
    assert.strictEqual(notes[3].pitch, 5);
    assert.strictEqual(notes[3].duration, 1);
  });

  it('quantizes vocal beat lengths cleanly (0.82 and 1.15 beats snap to 1.0 quarter note)', () => {
    // At 80 BPM (750ms/beat):
    // 0.82 beats = 615ms (slightly short hummed quarter)
    const snapShort = quantizeDurationToBeats(615, 80, 'eighth', false, false);
    assert.strictEqual(snapShort.duration, 1, '0.82 beats should snap cleanly to 1.0 quarter note in vocal mode');

    // 1.15 beats = 862.5ms (slightly long hummed quarter)
    const snapLong = quantizeDurationToBeats(862.5, 80, 'eighth', false, false);
    assert.strictEqual(snapLong.duration, 1, '1.15 beats should snap cleanly to 1.0 quarter note in vocal mode');

    // In keyboard mode on sixteenth grid, exact 0.75 beat (562.5ms) is preserved
    const snapKeyboard = quantizeDurationToBeats(562.5, 80, 'sixteenth', false, true);
    assert.strictEqual(snapKeyboard.duration, 0.75, 'In keyboard mode on sixteenth grid, exact 0.75 is preserved');
  });

  it('trims noisy attack/fry frames using energy-weighted pitch extraction in NoteSegmenter', () => {
    const sampleRate = 44100;
    const frameSize = 1024;
    const segmenter = new NoteSegmenter({
      sampleRate,
      frameSize,
      silenceThresholdRms: 0.008,
      refractoryPeriodMs: 40,
    });

    const noisyAttackBuffer = generateSineBuffer(180, frameSize, sampleRate, 0.05);
    const c4Buffer = generateSineBuffer(261.63, frameSize, sampleRate, 0.5);
    const fryBuffer = generateSineBuffer(110, frameSize, sampleRate, 0.05);

    // Frame 0 (consonant attack noise): low RMS (0.05), unvoiced/noisy pitch 180 Hz
    segmenter.ingestFrame(noisyAttackBuffer, 0, 180, 0.3);

    // Frames 1-5 (voiced vowel core): strong RMS (0.5), stable C4 (261.63 Hz)
    segmenter.ingestFrame(c4Buffer, 25, 261.63, 0.98);
    segmenter.ingestFrame(c4Buffer, 50, 261.63, 0.98);
    segmenter.ingestFrame(c4Buffer, 75, 261.63, 0.98);
    segmenter.ingestFrame(c4Buffer, 100, 261.63, 0.98);
    segmenter.ingestFrame(c4Buffer, 125, 261.63, 0.98);

    // Frame 6 (vocal fry / trailing noise): low RMS (0.05), low fry pitch 110 Hz
    segmenter.ingestFrame(fryBuffer, 150, 110, 0.2);

    const segments = segmenter.finalize(175);
    assert.ok(segments.length > 0, 'Segment should be created');
    assert.strictEqual(segments[0].midi, 60, 'Should accurately extract C4 despite attack and fry frame noise');
    assert.ok(
      Math.abs((segments[0].frequencyHz ?? 0) - 261.63) < 1.0,
      `Frequency should be close to 261.63, got ${segments[0].frequencyHz}`
    );
  });
});

function measuresTotalBeats(measure: { notes: NumberedNotationNote[] }): number {
  return measure.notes.reduce((sum, n) => sum + (typeof n.duration === 'number' ? n.duration : 0), 0);
}
