import {
  GraceNote,
  InstrumentType,
  KeySignature,
  NumberedNotationNote,
  Song,
  TimeSignature,
} from '@/types/song';
import {
  KEY_SEMITONES,
  SCALE_DEGREE_SEMITONES,
  getMeasureChords,
  isNonNotationItem,
  isSamePitch,
  isTieActive,
} from './taigiUtils';

export interface MidiExportOptions {
  includeAccompaniment?: boolean;
  lyricType?: 'hanlo' | 'poj' | 'none';
  instrument?: InstrumentType;
  tempoBpm?: number;
  transpose?: number;
}

/** Standard MIDI pulses per quarter note (ticks per beat) */
export const TICKS_PER_BEAT = 480;

/** General MIDI 1 program numbers */
export const GM_INSTRUMENT_MAP: Record<InstrumentType, number> = {
  piano: 0,   // Acoustic Grand Piano
  guitar: 24, // Acoustic Guitar (nylon)
  flute: 73,  // Flute
  whistle: 78, // Whistle
  synth: 80,  // Lead 1 (square)
  bell: 9,    // Glockenspiel
};

/** Key signature sharp/flat count (-7 to +7) */
const KEY_SIGNATURE_SF: Record<string, number> = {
  'C': 0,
  'G': 1,
  'D': 2,
  'A': 3,
  'E': 4,
  'B': 5,
  'F#': 6,
  'C#': 7,
  'F': -1,
  'Bb': -2,
  'Eb': -3,
  'Ab': -4,
  'Db': -5,
  'Gb': -6,
};

/**
 * Encode a number as Variable-Length Quantity (VLQ) for MIDI files.
 */
export function writeVLQ(value: number): number[] {
  const bytes: number[] = [];
  let v = Math.floor(Math.max(0, value));
  bytes.push(v & 0x7f);
  while (v > 0x7f) {
    v >>= 7;
    bytes.unshift((v & 0x7f) | 0x80);
  }
  return bytes;
}

/**
 * Encode string to UTF-8 bytes.
 */
export function stringToBytes(str: string): number[] {
  if (!str) return [];
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(str));
}

/**
 * Calculate MIDI pitch (0-127) from numbered notation pitch, octave, key, and accidental.
 */
export function calculateMidiNote(
  key: KeySignature,
  pitch: number | string,
  octave: number = 0,
  accidental: '' | '#' | 'b' = '',
  transposeSemitones: number = 0
): number | null {
  if (pitch === 0 || pitch === 'empty' || typeof pitch !== 'number') {
    return null;
  }
  const baseKeyOffset = KEY_SEMITONES[key] ?? 0;
  const degreeOffset = SCALE_DEGREE_SEMITONES[pitch] ?? 0;
  let accidentalOffset = 0;
  if (accidental === '#') accidentalOffset = 1;
  if (accidental === 'b') accidentalOffset = -1;

  const totalSemitonesFromC4 =
    baseKeyOffset + degreeOffset + octave * 12 + accidentalOffset + transposeSemitones;
  const midiNote = 60 + totalSemitonesFromC4;
  return Math.min(127, Math.max(0, midiNote));
}

/**
 * Extract chord triad / 7th pitches in MIDI note numbers (octave 3/4).
 */
export function getChordMidiNotes(chordName: string, transposeSemitones: number = 0): number[] {
  if (!chordName || chordName.trim() === '') return [];
  const rootMatch = chordName.match(/^([A-G][#b]?)(.*)$/);
  if (!rootMatch) return [];

  const rootStr = rootMatch[1];
  const quality = rootMatch[2].toLowerCase();
  const rootSemitone = (KEY_SEMITONES[rootStr] ?? 0) + transposeSemitones;
  const rootMidi = 48 + rootSemitone; // C3 baseline for accompaniment

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

  return intervals.map(i => Math.min(127, Math.max(0, rootMidi + i)));
}

interface TimedMidiEvent {
  tick: number;
  priority: number; // 0: Meta, 1: Note Off, 2: Program Change / CC, 3: Note On
  data: number[];
}

/**
 * Builds a MIDI track binary byte array from a list of timed events.
 */
function buildTrackChunk(events: TimedMidiEvent[]): number[] {
  // Sort events chronologically, breaking ties with priority
  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    return a.priority - b.priority;
  });

  let currentTick = 0;
  const trackData: number[] = [];

  for (const ev of events) {
    const delta = Math.max(0, ev.tick - currentTick);
    trackData.push(...writeVLQ(delta));
    trackData.push(...ev.data);
    currentTick = ev.tick;
  }

  // Append End-of-Track meta event (0xFF 0x2F 0x00)
  trackData.push(...writeVLQ(0));
  trackData.push(0xff, 0x2f, 0x00);

  // MTrk header + 4-byte chunk length (big endian)
  const trackBytes: number[] = [0x4d, 0x54, 0x72, 0x6b];
  const len = trackData.length;
  trackBytes.push((len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
  trackBytes.push(...trackData);

  return trackBytes;
}

/**
 * Create Track 0 (Conductor / Master track):
 * Sets Song Title, Time Signature, Key Signature, and Tempo.
 */
function buildConductorTrack(song: Song, options: MidiExportOptions): number[] {
  const events: TimedMidiEvent[] = [];

  // Track Name
  const titleBytes = stringToBytes(song.title || 'Untitled Score');
  events.push({
    tick: 0,
    priority: 0,
    data: [0xff, 0x03, ...writeVLQ(titleBytes.length), ...titleBytes],
  });

  // Time Signature: 0xFF 0x58 0x04 nn dd cc bb
  const [numStr, denStr] = (song.timeSignature || '4/4').split('/');
  const nn = parseInt(numStr, 10) || 4;
  const den = parseInt(denStr, 10) || 4;
  // dd is log2(denominator)
  const dd = den === 8 ? 3 : den === 2 ? 1 : 2;
  events.push({
    tick: 0,
    priority: 0,
    data: [0xff, 0x58, 0x04, nn, dd, 24, 8],
  });

  // Key Signature: 0xFF 0x59 0x02 sf mi
  const sf = KEY_SIGNATURE_SF[song.key] ?? 0;
  // sf in two's complement for negative values
  const sfByte = sf < 0 ? (256 + sf) & 0xff : sf;
  events.push({
    tick: 0,
    priority: 0,
    data: [0xff, 0x59, 0x02, sfByte, 0x00],
  });

  // Set Tempo: 0xFF 0x51 0x03 tt tt tt (microseconds per quarter note)
  const bpm = Math.max(20, Math.min(300, options.tempoBpm || song.bpm || 80));
  const mpqn = Math.round(60_000_000 / bpm);
  events.push({
    tick: 0,
    priority: 0,
    data: [0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff],
  });

  return buildTrackChunk(events);
}

/**
 * Create Track 1 (Melody & Vocal line with lyrics and articulations):
 */
function buildMelodyTrack(song: Song, options: MidiExportOptions): number[] {
  const events: TimedMidiEvent[] = [];
  const channel = 0; // Channel 1 (0-indexed)

  // Track Name
  const trackName = stringToBytes('Melody / Vocal');
  events.push({
    tick: 0,
    priority: 0,
    data: [0xff, 0x03, ...writeVLQ(trackName.length), ...trackName],
  });

  // Program Change
  const instType = options.instrument || song.measures[0]?.notes[0]?.instrument || 'piano';
  const progNumber = GM_INSTRUMENT_MAP[instType] ?? 0;
  events.push({
    tick: 0,
    priority: 2,
    data: [0xc0 | channel, progNumber],
  });

  const transpose = options.transpose || 0;
  const lyricType = options.lyricType || 'hanlo';

  // Flatten notes across measures with measure markers
  let currentTick = 0;

  for (let mIdx = 0; mIdx < song.measures.length; mIdx++) {
    const measure = song.measures[mIdx];

    // Optional section marker
    if (measure.section && measure.section.trim()) {
      const sectionBytes = stringToBytes(measure.section.trim());
      events.push({
        tick: currentTick,
        priority: 0,
        data: [0xff, 0x06, ...writeVLQ(sectionBytes.length), ...sectionBytes],
      });
    }

    const notes = measure.notes || [];

    for (let nIdx = 0; nIdx < notes.length; nIdx++) {
      const note = notes[nIdx];

      // Non-notation items (zero duration punctuation, pure annotations, etc.) don't advance time
      if (isNonNotationItem(note) || note.pitch === 'empty' || (typeof note.duration === 'number' && note.duration <= 0)) {
        continue;
      }

      const noteDurationBeats = typeof note.duration === 'number' ? note.duration : 1;
      const noteTicks = Math.round(noteDurationBeats * TICKS_PER_BEAT);

      // Check if this note is the destination of a continuous tie from the previous note
      // If previous note tied to this one with the same pitch, the Note On was already extended
      const prevNote = nIdx > 0 ? notes[nIdx - 1] : mIdx > 0 ? song.measures[mIdx - 1]?.notes?.slice(-1)[0] : null;
      const isContinuationOfTie = isTieActive(prevNote, note);

      if (isContinuationOfTie) {
        // Just advance time because the previous note sustains through this note's duration
        currentTick += noteTicks;
        continue;
      }

      // Calculate total duration if this note ties to subsequent notes
      let totalSustainedBeats = noteDurationBeats;
      let curr = note;
      let nextMIdx = mIdx;
      let nextNIdx = nIdx + 1;

      while (curr && (curr.tieToNext || curr.isTied)) {
        let nextNote: NumberedNotationNote | null = null;
        if (nextNIdx < (song.measures[nextMIdx]?.notes?.length || 0)) {
          nextNote = song.measures[nextMIdx].notes[nextNIdx];
          nextNIdx++;
        } else if (nextMIdx + 1 < song.measures.length) {
          nextMIdx++;
          nextNIdx = 0;
          nextNote = song.measures[nextMIdx]?.notes?.[0] || null;
          nextNIdx = 1;
        }

        if (nextNote && isSamePitch(curr, nextNote) && !isNonNotationItem(nextNote) && typeof nextNote.duration === 'number') {
          totalSustainedBeats += nextNote.duration;
          curr = nextNote;
        } else {
          break;
        }
      }

      const totalSustainedTicks = Math.round(totalSustainedBeats * TICKS_PER_BEAT);

      // Lyric meta event at the start of this note
      if (lyricType !== 'none') {
        let lyricText = '';
        if (lyricType === 'hanlo') {
          lyricText = note.lyric?.hanlo || note.lyric?.custom || note.lyric?.hanji || '';
        } else if (lyricType === 'poj') {
          lyricText = note.lyric?.poj || note.lyric?.tl || '';
        }
        if (lyricText && lyricText.trim()) {
          const lyricBytes = stringToBytes(lyricText.trim());
          events.push({
            tick: currentTick,
            priority: 0,
            data: [0xff, 0x05, ...writeVLQ(lyricBytes.length), ...lyricBytes],
          });
        }
      }

      // Pitch calculation
      const midiPitch = calculateMidiNote(
        song.key,
        note.pitch,
        note.octave || 0,
        note.accidental || '',
        transpose
      );

      if (midiPitch !== null) {
        // Check for pre-grace notes
        const preGrace = (note.preGraceNotes || []).slice(0, 3);
        const graceTicksPerNote = 60; // 32nd note duration
        const totalGraceTicks = preGrace.length * graceTicksPerNote;

        let startMainTick = currentTick;

        if (preGrace.length > 0 && totalSustainedTicks > totalGraceTicks + 60) {
          preGrace.forEach((g: GraceNote, gIdx: number) => {
            const gPitch = calculateMidiNote(song.key, g.pitch, g.octave || 0, g.accidental || '', transpose);
            if (gPitch !== null) {
              const gStart = currentTick + gIdx * graceTicksPerNote;
              const gEnd = gStart + graceTicksPerNote;
              // Note On
              events.push({
                tick: gStart,
                priority: 3,
                data: [0x90 | channel, gPitch, 80],
              });
              // Note Off
              events.push({
                tick: gEnd,
                priority: 1,
                data: [0x80 | channel, gPitch, 0],
              });
            }
          });
          startMainTick = currentTick + totalGraceTicks;
        }

        // Articulation velocity & gate adjustment
        let velocity = 92;
        let gateRatio = 0.94;

        if (note.articulation === 'staccato') {
          gateRatio = 0.48;
        } else if (note.articulation === 'accent') {
          velocity = 115;
          gateRatio = 0.92;
        } else if (note.articulation === 'tenuto') {
          gateRatio = 0.98;
        }

        const remainingTicks = Math.max(60, totalSustainedTicks - (startMainTick - currentTick));
        const activeDurationTicks = Math.max(30, Math.round(remainingTicks * gateRatio));
        const endMainTick = startMainTick + activeDurationTicks;

        // Main Note On
        events.push({
          tick: startMainTick,
          priority: 3,
          data: [0x90 | channel, midiPitch, velocity],
        });

        // Main Note Off
        events.push({
          tick: endMainTick,
          priority: 1,
          data: [0x80 | channel, midiPitch, 0],
        });
      }

      currentTick += noteTicks;
    }
  }

  return buildTrackChunk(events);
}

/**
 * Create Track 2 (Chord Accompaniment track on Channel 1):
 */
function buildAccompanimentTrack(song: Song, options: MidiExportOptions): number[] {
  const events: TimedMidiEvent[] = [];
  const channel = 1; // Channel 2 (0-indexed)

  // Track Name
  const trackName = stringToBytes('Accompaniment');
  events.push({
    tick: 0,
    priority: 0,
    data: [0xff, 0x03, ...writeVLQ(trackName.length), ...trackName],
  });

  // Program Change: Acoustic Grand Piano (0) or Nylon Guitar (24)
  events.push({
    tick: 0,
    priority: 2,
    data: [0xc0 | channel, 0],
  });

  const transpose = options.transpose || 0;
  let currentTick = 0;

  for (const measure of song.measures) {
    // Measure beat calculation
    let measureBeats = 0;
    for (const n of measure.notes) {
      if (!isNonNotationItem(n) && n.pitch !== 'empty' && typeof n.duration === 'number' && n.duration > 0) {
        measureBeats += n.duration;
      }
    }
    if (measureBeats <= 0) {
      const [numStr] = (measure.timeSignature || song.timeSignature || '4/4').split('/');
      measureBeats = parseInt(numStr, 10) || 4;
    }

    const chords = getMeasureChords(measure);

    if (chords.length > 0) {
      const beatsPerChord = measureBeats / chords.length;
      const ticksPerChord = Math.round(beatsPerChord * TICKS_PER_BEAT);

      chords.forEach((chordName, cIdx) => {
        const chordMidiNotes = getChordMidiNotes(chordName, transpose);
        if (chordMidiNotes.length > 0) {
          const chordStartTick = currentTick + Math.round(cIdx * ticksPerChord);
          const chordEndTick = chordStartTick + Math.round(ticksPerChord * 0.9);

          for (const pitch of chordMidiNotes) {
            // Note On
            events.push({
              tick: chordStartTick,
              priority: 3,
              data: [0x90 | channel, pitch, 68],
            });
            // Note Off
            events.push({
              tick: chordEndTick,
              priority: 1,
              data: [0x80 | channel, pitch, 0],
            });
          }
        }
      });
    }

    currentTick += Math.round(measureBeats * TICKS_PER_BEAT);
  }

  return buildTrackChunk(events);
}

/**
 * Generate a complete Standard MIDI File (Format 1) as a Uint8Array.
 */
export function exportSongToMidi(song: Song, options: MidiExportOptions = {}): Uint8Array {
  const includeAccomp = options.includeAccompaniment ?? true;

  // Track chunks
  const conductorTrack = buildConductorTrack(song, options);
  const melodyTrack = buildMelodyTrack(song, options);
  const tracks: number[][] = [conductorTrack, melodyTrack];

  if (includeAccomp) {
    const accompTrack = buildAccompanimentTrack(song, options);
    tracks.push(accompTrack);
  }

  // Header chunk: 'MThd' + length (6) + format 1 + numTracks + division (480)
  const numTracks = tracks.length;
  const headerChunk: number[] = [
    0x4d, 0x54, 0x68, 0x64, // 'MThd'
    0x00, 0x00, 0x00, 0x06, // length 6
    0x00, 0x01,             // Format 1 (multi-track)
    (numTracks >> 8) & 0xff, numTracks & 0xff,
    (TICKS_PER_BEAT >> 8) & 0xff, TICKS_PER_BEAT & 0xff,
  ];

  const totalLength = headerChunk.length + tracks.reduce((sum, t) => sum + t.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  result.set(headerChunk, offset);
  offset += headerChunk.length;

  for (const track of tracks) {
    result.set(track, offset);
    offset += track.length;
  }

  return result;
}

/**
 * Create a downloadable Blob of the exported MIDI file.
 */
export function createMidiBlob(midiBytes: Uint8Array): Blob {
  return new Blob([midiBytes.buffer as ArrayBuffer], { type: 'audio/midi' });
}

/**
 * Directly trigger a browser download for the song as a .mid file.
 */
export function downloadMidiFile(song: Song, options: MidiExportOptions = {}): void {
  const midiBytes = exportSongToMidi(song, options);
  const blob = createMidiBlob(midiBytes);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanTitle = (song.title || 'Untitled')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_');
  link.download = `${cleanTitle}.mid`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
