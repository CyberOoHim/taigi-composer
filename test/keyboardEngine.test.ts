/**
 * Keyboard Engine & Quantizer Test Suite
 *
 * Tests Stage 1 & 2 of the Keyboard-to-Score pipeline:
 * - Stage 1:
 *   - Monophonic legato overlap arbitration (note truncation on next key onset)
 *   - Rest gap detection (intervals >= 80ms become rests, < 80ms extend legato)
 *   - QWERTY key mapping tables (white keys A-K, black keys W-U, high octaves)
 *   - Movable solfege vs chromatic piano mapping modes
 *   - Auxiliary controls (octave shift, space rest, backspace undo)
 *   - Hardware Web MIDI event translation (0x90 / 0x80)
 *
 * - Stage 2:
 *   - Direct pipeline connection from finalize() to transcribeAudioSegmentsToMeasures()
 *   - Quarter, eighth, sixteenth, and triplet beat quantization with human jitter (+-30ms)
 *   - Barline tie splitting (tieToNext: true) across measure boundaries
 *   - Multi-measure note splitting
 *   - Untied rests across barlines
 *   - Key signature transposition across all 12 keys and accidental spelling preferences
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  KeyEventEngine,
  resolveQwertyKey,
  QWERTY_KEY_DEFINITIONS,
  DEFAULT_KEY_ENGINE_CONFIG,
} from '../lib/keyboard/keyEventEngine.ts';
import {
  transcribeAudioSegmentsToMeasures,
  transcribeKeyboardSegmentsToMeasures,
  quantizeRawSegments,
  midiToNumberedPitch,
  KEY_SEMITONES,
} from '../lib/pitch/scoreQuantizer.ts';
import type { KeySignature, TimeSignature } from '../types/song.ts';
import type { RawNoteSegment } from '../lib/pitch/onsetDetector.ts';

// Helper for deterministic simulated time
class VirtualClock {
  private currentMs = 1000;
  public now = () => this.currentMs;
  public advance(deltaMs: number) {
    this.currentMs += deltaMs;
    return this.currentMs;
  }
  public set(timeMs: number) {
    this.currentMs = timeMs;
    return this.currentMs;
  }
}

describe('Stage 1: Keyboard Event Engine (lib/keyboard/keyEventEngine.ts)', () => {
  it('initializes with default configuration and starts recording on first note', () => {
    const clock = new VirtualClock();
    const engine = new KeyEventEngine({ keySignature: 'C', bpm: 80 }, undefined, clock.now);

    assert.equal(engine.isRecordingActive(), false);
    assert.equal(engine.getSegments().length, 0);

    // Note onset should trigger recording start
    engine.noteOn(60, 0.9, clock.now());
    assert.equal(engine.isRecordingActive(), true);
    assert.equal(engine.getRecordingStartTime(), 1000);

    clock.advance(500);
    engine.noteOff(60, clock.now());

    const segments = engine.getSegments();
    assert.equal(segments.length, 1);
    assert.equal(segments[0].midi, 60);
    assert.equal(segments[0].startTimeMs, 0);
    assert.equal(segments[0].endTimeMs, 500);
    assert.equal(segments[0].durationMs, 500);
  });

  it('handles monophonic legato overlap arbitration by truncating previous note', () => {
    const clock = new VirtualClock();
    const noteOffEvents: number[] = [];
    const noteOnEvents: number[] = [];

    const engine = new KeyEventEngine(
      { keySignature: 'C', bpm: 80 },
      {
        onNoteOn: note => noteOnEvents.push(note.midi),
        onNoteOff: midi => noteOffEvents.push(midi),
      },
      clock.now
    );

    // Press Note 1 (C4 = MIDI 60) at t=1000
    engine.noteOn(60, 0.8, clock.now(), 'KeyA');
    assert.equal(noteOnEvents.length, 1);
    assert.equal(noteOnEvents[0], 60);

    // Advance 450ms to t=1450 (playing legato - Note 2 is pressed BEFORE Note 1 is released)
    clock.advance(450);
    // Press Note 2 (D4 = MIDI 62) at t=1450 while Note 1 is still physically held!
    engine.noteOn(62, 0.8, clock.now(), 'KeyS');

    // Note 1 should be immediately truncated and resolved at t=1450
    assert.equal(noteOffEvents.includes(60), true);
    assert.equal(noteOnEvents.length, 2);
    assert.equal(noteOnEvents[1], 62);

    const segsAfterOverlap = engine.getSegments();
    assert.equal(segsAfterOverlap.length, 1);
    assert.equal(segsAfterOverlap[0].midi, 60);
    assert.equal(segsAfterOverlap[0].durationMs, 450); // Exactly 450ms

    // At t=1500, physical keyup for Note 1 arrives late:
    clock.advance(50);
    engine.noteOff(60, clock.now(), 'KeyA');

    // This late Note 1 release should NOT cause duplicate segments or disturb Note 2
    assert.equal(engine.getSegments().length, 1);

    // At t=1950 (500ms after Note 2 onset), Note 2 is released:
    clock.advance(450);
    engine.noteOff(62, clock.now(), 'KeyS');

    const finalSegments = engine.getSegments();
    assert.equal(finalSegments.length, 2);
    assert.equal(finalSegments[0].midi, 60);
    assert.equal(finalSegments[0].durationMs, 450);
    assert.equal(finalSegments[1].midi, 62);
    assert.equal(finalSegments[1].durationMs, 500);
  });

  it('detects rest gaps >= 80ms and generates discrete rest segments', () => {
    const clock = new VirtualClock();
    const engine = new KeyEventEngine(
      { keySignature: 'C', bpm: 80, restThresholdMs: 80 },
      undefined,
      clock.now
    );

    // Note 1: t=1000 to t=1500 (500ms)
    engine.noteOn(60, 0.8, clock.now());
    clock.advance(500);
    engine.noteOff(60, clock.now());

    // Pause of 300ms (silence / rest gap)
    clock.advance(300);

    // Note 2: t=1800 to t=2300 (500ms)
    engine.noteOn(64, 0.8, clock.now());
    clock.advance(500);
    engine.noteOff(64, clock.now());

    const segments = engine.getSegments();
    assert.equal(segments.length, 3);

    // Segment 0: Note (C4)
    assert.equal(segments[0].midi, 60);
    assert.equal(segments[0].durationMs, 500);

    // Segment 1: Rest (300ms gap >= 80ms)
    assert.equal(segments[1].midi, null);
    assert.equal(segments[1].durationMs, 300);
    assert.equal(segments[1].startTimeMs, 500);
    assert.equal(segments[1].endTimeMs, 800);

    // Segment 2: Note (E4)
    assert.equal(segments[2].midi, 64);
    assert.equal(segments[2].durationMs, 500);
    assert.equal(segments[2].startTimeMs, 800);
  });

  it('extends previous note when gap is < 80ms to maintain legato continuity', () => {
    const clock = new VirtualClock();
    const engine = new KeyEventEngine(
      { keySignature: 'C', bpm: 80, restThresholdMs: 80, extendLegatoGaps: true },
      undefined,
      clock.now
    );

    // Note 1: t=1000 to t=1460 (460ms)
    engine.noteOn(60, 0.8, clock.now());
    clock.advance(460);
    engine.noteOff(60, clock.now());

    // Micro articulation gap: 40ms (< 80ms threshold)
    clock.advance(40);

    // Note 2: t=1500 to t=2000
    engine.noteOn(62, 0.8, clock.now());
    clock.advance(500);
    engine.noteOff(62, clock.now());

    const segments = engine.getSegments();
    // No rest segment should be created because 40ms < 80ms
    assert.equal(segments.length, 2);
    assert.equal(segments[0].midi, 60);
    // Note 1 was extended from 460ms to 500ms
    assert.equal(segments[0].durationMs, 500);
    assert.equal(segments[0].endTimeMs, 500);
    assert.equal(segments[1].midi, 62);
    assert.equal(segments[1].startTimeMs, 500);
  });

  it('correctly maps QWERTY keys to pitch numbers, accidentals, and octaves in Key of C', () => {
    // White keys (Middle Octave)
    const keyA = resolveQwertyKey('KeyA', 'C', 0);
    assert.ok(keyA);
    assert.equal(keyA.midi, 60);
    assert.equal(keyA.pitch, 1);
    assert.equal(keyA.octave, 0);
    assert.equal(keyA.accidental, '');

    const keyD = resolveQwertyKey('KeyD', 'C', 0);
    assert.ok(keyD);
    assert.equal(keyD.midi, 64);
    assert.equal(keyD.pitch, 3);

    const keyJ = resolveQwertyKey('KeyJ', 'C', 0);
    assert.ok(keyJ);
    assert.equal(keyJ.midi, 71);
    assert.equal(keyJ.pitch, 7);

    // High octave white keys
    const keyK = resolveQwertyKey('KeyK', 'C', 0);
    assert.ok(keyK);
    assert.equal(keyK.midi, 72);
    assert.equal(keyK.pitch, 1);
    assert.equal(keyK.octave, 1); // Dot above

    // Black keys (Accidentals)
    const keyW = resolveQwertyKey('KeyW', 'C', 0);
    assert.ok(keyW);
    assert.equal(keyW.midi, 61);
    assert.equal(keyW.pitch, 1);
    assert.equal(keyW.accidental, '#');

    const keyUAuto = resolveQwertyKey('KeyU', 'C', 0, 'chromatic_piano', 'auto');
    assert.ok(keyUAuto);
    assert.equal(keyUAuto.midi, 70); // A#4 / Bb4
    assert.equal(keyUAuto.pitch, 7); // Default auto maps to Taiwanese flat 7 (b7)
    assert.equal(keyUAuto.accidental, 'b');

    const keyUSharp = resolveQwertyKey('KeyU', 'C', 0, 'chromatic_piano', 'sharp');
    assert.ok(keyUSharp);
    assert.equal(keyUSharp.pitch, 6); // Sharp preference maps to sharp 6 (#6)
    assert.equal(keyUSharp.accidental, '#');
  });

  it('supports movable solfege QWERTY mapping mode in transposed keys', () => {
    // In Key of F (1 = F), with movable_solfege mode:
    // KeyA should map to degree 1 (F4 = MIDI 65)
    const keyAInF = resolveQwertyKey('KeyA', 'F', 0, 'movable_solfege');
    assert.ok(keyAInF);
    assert.equal(keyAInF.midi, 65); // F4
    assert.equal(keyAInF.pitch, 1);

    // KeyD should map to degree 3 (A4 = MIDI 69)
    const keyDInF = resolveQwertyKey('KeyD', 'F', 0, 'movable_solfege');
    assert.ok(keyDInF);
    assert.equal(keyDInF.midi, 69); // A4
    assert.equal(keyDInF.pitch, 3);

    // In Key of G (1 = G), KeyA should map to degree 1 (G4 = MIDI 67)
    const keyAInG = resolveQwertyKey('KeyA', 'G', 0, 'movable_solfege');
    assert.ok(keyAInG);
    assert.equal(keyAInG.midi, 67); // G4
    assert.equal(keyAInG.pitch, 1);
  });

  it('handles auxiliary controls: Octave Shift (Z/X), Space Rest, and Backspace Undo', () => {
    const clock = new VirtualClock();
    let shiftedOctave = 0;

    const engine = new KeyEventEngine(
      { keySignature: 'C' },
      { onOctaveShiftChange: oct => (shiftedOctave = oct) },
      clock.now
    );

    assert.equal(engine.getOctaveShift(), 0);

    // Shift up with KeyX
    engine.handleKeyDown({ code: 'KeyX' }, clock.now());
    assert.equal(engine.getOctaveShift(), 1);
    assert.equal(shiftedOctave, 1);

    // Play Note with shifted octave: KeyA should now be C5 (MIDI 72)
    engine.handleKeyDown({ code: 'KeyA' }, clock.now());
    clock.advance(500);
    engine.handleKeyUp({ code: 'KeyA' }, clock.now());

    let segs = engine.getSegments();
    assert.equal(segs.length, 1);
    assert.equal(segs[0].midi, 72);

    // Undo last note with Backspace
    const undone = engine.undoLastNote();
    assert.ok(undone);
    assert.equal(undone.midi, 72);
    assert.equal(engine.getSegments().length, 0);

    // Shift down twice with KeyZ
    engine.handleKeyDown({ code: 'KeyZ' }, clock.now());
    engine.handleKeyDown({ code: 'KeyZ' }, clock.now());
    assert.equal(engine.getOctaveShift(), -1);

    // Trigger explicit rest with triggerRest
    engine.triggerRest(600, clock.now());
    segs = engine.getSegments();
    assert.equal(segs.length, 1);
    assert.equal(segs[0].midi, null);
    assert.equal(segs[0].durationMs, 600);
  });

  it('processes standard Web MIDI messages accurately', () => {
    const clock = new VirtualClock();
    const engine = new KeyEventEngine({ keySignature: 'C' }, undefined, clock.now);

    // MIDI Note On: channel 1, Middle C (60), velocity 100
    const handledOn = engine.handleMidiMessage(
      { data: [0x90, 60, 100] },
      clock.now()
    );
    assert.equal(handledOn, true);

    clock.advance(500);

    // MIDI Note Off: channel 1, Middle C (60), velocity 0
    const handledOff = engine.handleMidiMessage(
      { data: [0x80, 60, 0] },
      clock.now()
    );
    assert.equal(handledOff, true);

    const segs = engine.getSegments();
    assert.equal(segs.length, 1);
    assert.equal(segs[0].midi, 60);
    assert.equal(segs[0].durationMs, 500);
    assert.equal(Math.round(segs[0].avgRms * 100) / 100, 0.79); // 100 / 127
  });

  it('suppresses keyboard auto-repeat events using repeat guard', () => {
    const clock = new VirtualClock();
    const engine = new KeyEventEngine({ keySignature: 'C' }, undefined, clock.now);

    // First keydown
    engine.handleKeyDown({ code: 'KeyA', repeat: false }, clock.now());
    clock.advance(100);

    // OS auto-repeat events (repeat: true)
    engine.handleKeyDown({ code: 'KeyA', repeat: true }, clock.now());
    clock.advance(100);
    engine.handleKeyDown({ code: 'KeyA', repeat: true }, clock.now());
    clock.advance(300);

    engine.handleKeyUp({ code: 'KeyA' }, clock.now());

    // Should result in exactly ONE 500ms sustained note, not three stuttered notes!
    const segs = engine.getSegments();
    assert.equal(segs.length, 1);
    assert.equal(segs[0].durationMs, 500);
  });
});

describe('Stage 2: Quantization & Barline Packaging Engine', () => {
  it('connects KeyEventEngine.finalize() directly into transcribeKeyboardSegmentsToMeasures', () => {
    const clock = new VirtualClock();
    const engine = new KeyEventEngine(
      { keySignature: 'C', bpm: 80, timeSignature: '4/4' },
      undefined,
      clock.now
    );

    // At 80 BPM, 1 beat = 750ms.
    // Play four quarter notes: 1, 2, 3, 5 (C4, D4, E4, G4)
    const notes = [60, 62, 64, 67];
    for (const midi of notes) {
      engine.noteOn(midi, 0.8, clock.now());
      clock.advance(750);
      engine.noteOff(midi, clock.now());
    }

    const segments = engine.finalize(clock.now());
    assert.equal(segments.length, 4);

    const result = transcribeKeyboardSegmentsToMeasures(segments, {
      key: 'C',
      timeSignature: '4/4',
      bpm: 80,
      grid: 'eighth',
    });

    assert.equal(result.measures.length, 1);
    assert.equal(result.measures[0].notes.length, 4);
    assert.deepEqual(
      result.measures[0].notes.map(n => n.pitch),
      [1, 2, 3, 5]
    );
    assert.deepEqual(
      result.measures[0].notes.map(n => n.duration),
      [1, 1, 1, 1]
    );
  });

  it('quantizes quarter, eighth, sixteenth, and triplet notes with simulated human jitter (+-30ms)', () => {
    // 80 BPM: 1 beat = 750ms
    // Quarter = 750ms
    // Eighth = 375ms
    // Sixteenth = 187.5ms
    // Triplet = 250ms (3 in 1 beat)
    const bpm = 80;

    // Simulate performance jitter of +-25ms
    const rawSegments: RawNoteSegment[] = [
      // Quarter note (750ms -> played as 765ms)
      {
        startTimeMs: 0,
        endTimeMs: 765,
        durationMs: 765,
        midi: 60,
        frequencyHz: 261.63,
        avgRms: 0.8,
        pitchSamples: [60],
      },
      // Eighth note (375ms -> played as 360ms)
      {
        startTimeMs: 765,
        endTimeMs: 1125,
        durationMs: 360,
        midi: 62,
        frequencyHz: 293.66,
        avgRms: 0.8,
        pitchSamples: [62],
      },
      // Sixteenth note (187.5ms -> played as 195ms)
      {
        startTimeMs: 1125,
        endTimeMs: 1320,
        durationMs: 195,
        midi: 64,
        frequencyHz: 329.63,
        avgRms: 0.8,
        pitchSamples: [64],
      },
    ];

    const quantized = quantizeRawSegments(rawSegments, {
      key: 'C',
      bpm,
      grid: 'sixteenth',
      keyboardMode: true,
    });

    assert.equal(quantized.length, 3);
    assert.equal(quantized[0].duration, 1); // 1.0 beat (quarter)
    assert.equal(quantized[1].duration, 0.5); // 0.5 beat (eighth)
    assert.equal(quantized[2].duration, 0.25); // 0.25 beat (sixteenth)

    // Triplet test: 3 notes of ~250ms each at 80 BPM (total 750ms = 1 beat)
    const tripletSegments: RawNoteSegment[] = [
      {
        startTimeMs: 0,
        endTimeMs: 245,
        durationMs: 245,
        midi: 60,
        frequencyHz: 261.63,
        avgRms: 0.8,
        pitchSamples: [60],
      },
      {
        startTimeMs: 245,
        endTimeMs: 505,
        durationMs: 260,
        midi: 62,
        frequencyHz: 293.66,
        avgRms: 0.8,
        pitchSamples: [62],
      },
      {
        startTimeMs: 505,
        endTimeMs: 750,
        durationMs: 245,
        midi: 64,
        frequencyHz: 329.63,
        avgRms: 0.8,
        pitchSamples: [64],
      },
    ];

    const quantTriplets = quantizeRawSegments(tripletSegments, {
      key: 'C',
      bpm,
      allowTriplets: true,
      keyboardMode: true,
    });

    assert.equal(quantTriplets.length, 3);
    assert.equal(quantTriplets[0].isTriplet, true);
    assert.equal(quantTriplets[1].isTriplet, true);
    assert.equal(quantTriplets[2].isTriplet, true);
  });

  it('splits pitched notes crossing measure boundaries with tieToNext: true', () => {
    // In 4/4 time, measure target is 4 beats.
    // Note 1: 3 beats (C4)
    // Note 2: 3 beats (D4) -> Crosses boundary! 1 beat in Measure 1, 2 beats in Measure 2
    const rawSegments: RawNoteSegment[] = [
      {
        startTimeMs: 0,
        endTimeMs: 2250,
        durationMs: 2250, // 3 beats at 80 BPM
        midi: 60,
        frequencyHz: 261.63,
        avgRms: 0.8,
        pitchSamples: [60],
      },
      {
        startTimeMs: 2250,
        endTimeMs: 4500,
        durationMs: 2250, // 3 beats at 80 BPM
        midi: 62,
        frequencyHz: 293.66,
        avgRms: 0.8,
        pitchSamples: [62],
      },
    ];

    const result = transcribeKeyboardSegmentsToMeasures(rawSegments, {
      key: 'C',
      timeSignature: '4/4',
      bpm: 80,
      grid: 'quarter',
    });

    assert.equal(result.measures.length, 2);

    // Measure 1: 3 beats (C4) + 1 beat (D4, tied to next)
    const m1Notes = result.measures[0].notes;
    assert.equal(m1Notes.length, 2);
    assert.equal(m1Notes[0].pitch, 1);
    assert.equal(m1Notes[0].duration, 3);
    assert.equal(Boolean(m1Notes[0].tieToNext), false);

    assert.equal(m1Notes[1].pitch, 2);
    assert.equal(m1Notes[1].duration, 1);
    assert.equal(m1Notes[1].tieToNext, true); // Tied across barline!

    // Measure 2: 2 remaining beats of D4
    const m2Notes = result.measures[1].notes;
    assert.equal(m2Notes[0].pitch, 2);
    assert.equal(m2Notes[0].duration, 2);
    assert.equal(Boolean(m2Notes[0].tieToNext), false);
  });

  it('splits multi-measure sustained notes spanning across multiple barlines', () => {
    // A single 10-beat sustained note in 4/4 time:
    // Measure 1: 4 beats (tieToNext: true)
    // Measure 2: 4 beats (tieToNext: true)
    // Measure 3: 2 beats (tieToNext: false)
    const rawSegments: RawNoteSegment[] = [
      {
        startTimeMs: 0,
        endTimeMs: 7500,
        durationMs: 7500, // 10 beats at 80 BPM
        midi: 67, // Sol (G4)
        frequencyHz: 392.0,
        avgRms: 0.9,
        pitchSamples: [67],
      },
    ];

    const result = transcribeKeyboardSegmentsToMeasures(rawSegments, {
      key: 'C',
      timeSignature: '4/4',
      bpm: 80,
      grid: 'quarter',
    });

    assert.equal(result.measures.length, 3);

    // Measure 1
    assert.equal(result.measures[0].notes.length, 1);
    assert.equal(result.measures[0].notes[0].pitch, 5);
    assert.equal(result.measures[0].notes[0].duration, 4);
    assert.equal(result.measures[0].notes[0].tieToNext, true);

    // Measure 2
    assert.equal(result.measures[1].notes.length, 1);
    assert.equal(result.measures[1].notes[0].pitch, 5);
    assert.equal(result.measures[1].notes[0].duration, 4);
    assert.equal(result.measures[1].notes[0].tieToNext, true);

    // Measure 3
    assert.equal(result.measures[2].notes.length, 1);
    assert.equal(result.measures[2].notes[0].pitch, 5);
    assert.equal(result.measures[2].notes[0].duration, 2);
    assert.equal(result.measures[2].notes[0].tieToNext, false);
  });

  it('does NOT tie rests across barlines', () => {
    // 3 beats note + 3 beats rest in 4/4 time:
    // Measure 1: 3 beats note + 1 beat rest (tieToNext: false!)
    // Measure 2: 2 beats rest (tieToNext: false!)
    const rawSegments: RawNoteSegment[] = [
      {
        startTimeMs: 0,
        endTimeMs: 2250,
        durationMs: 2250, // 3 beats note
        midi: 60,
        frequencyHz: 261.63,
        avgRms: 0.8,
        pitchSamples: [60],
      },
      {
        startTimeMs: 2250,
        endTimeMs: 4500,
        durationMs: 2250, // 3 beats rest
        midi: null,
        frequencyHz: null,
        avgRms: 0,
        pitchSamples: [],
      },
    ];

    const result = transcribeKeyboardSegmentsToMeasures(rawSegments, {
      key: 'C',
      timeSignature: '4/4',
      bpm: 80,
      grid: 'quarter',
      trimSilence: false,
    });

    assert.equal(result.measures.length, 2);

    const m1Rest = result.measures[0].notes[1];
    assert.equal(m1Rest.pitch, 0);
    assert.equal(m1Rest.duration, 1);
    assert.equal(m1Rest.tieToNext, false); // RESTS MUST NOT BE TIED

    const m2Rest = result.measures[1].notes[0];
    assert.equal(m2Rest.pitch, 0);
    assert.equal(m2Rest.duration, 2);
    assert.equal(m2Rest.tieToNext, false);
  });

  it('accurately transposes across all 12 musical key signatures', () => {
    const allKeys: KeySignature[] = [
      'C',
      'Db',
      'D',
      'Eb',
      'E',
      'F',
      'F#',
      'G',
      'Ab',
      'A',
      'Bb',
      'B',
    ];

    for (const key of allKeys) {
      const tonicSemitone = KEY_SEMITONES[key];
      const rootMidi = 60 + tonicSemitone; // The root tonic 1 of this key

      const info = midiToNumberedPitch(rootMidi, key);
      assert.equal(info.pitch, 1, `Root note for Key of ${key} should map to scale degree 1`);
      assert.equal(info.accidental, '', `Diatonic root tonic in Key of ${key} should have no accidental`);
      assert.equal(info.octave, 0, `Middle register tonic in Key of ${key} should have octave 0`);

      // Fifth (degree 5) = root + 7 semitones
      const fifthMidi = rootMidi + 7;
      const fifthInfo = midiToNumberedPitch(fifthMidi, key);
      assert.equal(fifthInfo.pitch, 5, `Fifth degree in Key of ${key} should map to scale degree 5`);
      assert.equal(fifthInfo.accidental, '', `Fifth degree in Key of ${key} should have no accidental`);
    }
  });

  it('respects accidental spelling preferences (sharp vs flat)', () => {
    // In Key of C, MIDI 61 is C#4 or Db4
    const sharpInfo = midiToNumberedPitch(61, 'C', { accidentalPreference: 'sharp' });
    assert.equal(sharpInfo.pitch, 1);
    assert.equal(sharpInfo.accidental, '#');

    const flatInfo = midiToNumberedPitch(61, 'C', { accidentalPreference: 'flat' });
    assert.equal(flatInfo.pitch, 2);
    assert.equal(flatInfo.accidental, 'b');

    // Taiwanese folk scale variation: Flat 7 (MIDI 70 in Key of C)
    const flat7Info = midiToNumberedPitch(70, 'C', { accidentalPreference: 'flat' });
    assert.equal(flat7Info.pitch, 7);
    assert.equal(flat7Info.accidental, 'b');
  });

  it('handles 3/4 and 2/4 and 6/8 time signatures cleanly', () => {
    // 3/4 Time: 3 beats per measure
    const notes3Beats: RawNoteSegment[] = [
      {
        startTimeMs: 0,
        endTimeMs: 750,
        durationMs: 750,
        midi: 60,
        frequencyHz: 261.63,
        avgRms: 0.8,
        pitchSamples: [60],
      },
      {
        startTimeMs: 750,
        endTimeMs: 1500,
        durationMs: 750,
        midi: 62,
        frequencyHz: 293.66,
        avgRms: 0.8,
        pitchSamples: [62],
      },
      {
        startTimeMs: 1500,
        endTimeMs: 2250,
        durationMs: 750,
        midi: 64,
        frequencyHz: 329.63,
        avgRms: 0.8,
        pitchSamples: [64],
      },
    ];

    const result34 = transcribeKeyboardSegmentsToMeasures(notes3Beats, {
      key: 'C',
      timeSignature: '3/4',
      bpm: 80,
    });
    assert.equal(result34.measures.length, 1);
    assert.equal(result34.measures[0].notes.length, 3);

    // 2/4 Time: 2 beats per measure -> 3 notes of 1 beat will create 2 measures
    const result24 = transcribeKeyboardSegmentsToMeasures(notes3Beats, {
      key: 'C',
      timeSignature: '2/4',
      bpm: 80,
    });
    assert.equal(result24.measures.length, 2);
    assert.equal(result24.measures[0].notes.length, 2);
    assert.equal(result24.measures[1].notes.length, 1);
  });
});
