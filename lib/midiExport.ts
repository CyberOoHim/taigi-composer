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

export type MidiLyricMode = 'hanlo' | 'poj' | 'both' | 'none';

export interface MidiExportOptions {
  includeAccompaniment?: boolean;
  lyricType?: MidiLyricMode;
  instrument?: InstrumentType;
  tempoBpm?: number;
  transpose?: number;
  format?: 'mid' | 'kar';
  includeKaraokeTrack?: boolean;
  includeMelodyLyrics?: boolean;
  includeTextEvents?: boolean;
  addTune1000Header?: boolean;
  smartRomanSpacing?: boolean;
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
  cello: 42,  // Cello
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
 * Extract and normalize lyric text from a note according to the selected mode,
 * with graceful fallback so no syllables are dropped if only one dialect is populated.
 */
export function extractNoteLyric(
  note: NumberedNotationNote,
  mode: MidiLyricMode
): { text: string; rawHanlo: string; rawPoj: string; isLineBreak: boolean } {
  if (mode === 'none' || !note.lyric) {
    return { text: '', rawHanlo: '', rawPoj: '', isLineBreak: false };
  }

  const rawHanlo = (note.lyric.hanlo || note.lyric.custom || note.lyric.hanji || '').trim();
  const rawPoj = (note.lyric.poj || note.lyric.tl || '').trim();

  // Detect explicit \n in lyric syllables
  const isLineBreak =
    note.lyric.hanlo === '\n' ||
    note.lyric.poj === '\n' ||
    note.lyric.custom === '\n' ||
    note.lyric.hanji === '\n';

  if (isLineBreak) {
    return { text: '', rawHanlo, rawPoj, isLineBreak: true };
  }

  let text = '';
  if (mode === 'hanlo') {
    text = rawHanlo || rawPoj;
  } else if (mode === 'poj') {
    text = rawPoj || rawHanlo;
  } else if (mode === 'both') {
    if (rawHanlo && rawPoj && rawHanlo !== rawPoj) {
      text = `${rawHanlo} (${rawPoj})`;
    } else {
      text = rawHanlo || rawPoj;
    }
  }

  return { text, rawHanlo, rawPoj, isLineBreak: false };
}

/**
 * Format a syllable for standard MIDI Karaoke (.kar / Tune 1000) players:
 * - \ prefix indicates start of a new verse/paragraph
 * - / prefix indicates start of a new line
 * - Leading space for separated Roman words
 */
export function formatKaraokeSyllable(
  text: string,
  mode: MidiLyricMode,
  isFirstOfVerse: boolean,
  isFirstOfLine: boolean,
  prevEndedWithHyphen: boolean
): string {
  if (!text) return '';

  if (isFirstOfVerse) {
    return `\\${text}`;
  }
  if (isFirstOfLine) {
    return `/${text}`;
  }

  if (mode === 'poj') {
    // If not continuing a hyphenated word, prepend space for English/Roman word separation
    if (!text.startsWith('-') && !prevEndedWithHyphen) {
      return ` ${text}`;
    }
  }

  return text;
}

/**
 * Create Dedicated Karaoke / Words Track (Track 1 in MIDI Karaoke .kar files):
 * Recognized by vanBasco's Karaoke Player, Karaoke 5, KarFun, and media players.
 * Emits Tune 1000 header tags (@KMIDI, @V, @T) and synchronized Text/Lyric events.
 */
function buildKaraokeWordsTrack(song: Song, options: MidiExportOptions): number[] {
  const events: TimedMidiEvent[] = [];
  const lyricType = options.lyricType || 'hanlo';

  // 1. Track Name: "Words" (standard identifier for MIDI karaoke players)
  const trackName = stringToBytes('Words');
  events.push({
    tick: 0,
    priority: 0,
    data: [0xff, 0x03, ...writeVLQ(trackName.length), ...trackName],
  });

  // 2. Tune 1000 MIDI Karaoke Header Events (tick 0, Text Event 0xFF 0x01)
  if (options.addTune1000Header ?? true) {
    const headerTags = [
      '@KMIDI KARAOKE FILE',
      '@V0100',
      `@I Taigi Numbered Notation Score`,
      `@T${song.title || 'Untitled'}`,
      `@T${song.composer ? `Music: ${song.composer}` : 'Taigi Traditional'}`,
      ...(song.lyricist ? [`@T${`Lyrics: ${song.lyricist}`}`] : []),
      `@TKey: 1=${song.key} | Meter: ${song.timeSignature} | BPM: ${song.bpm}`,
    ];

    for (const tag of headerTags) {
      const tagBytes = stringToBytes(tag);
      events.push({
        tick: 0,
        priority: 0,
        data: [0xff, 0x01, ...writeVLQ(tagBytes.length), ...tagBytes],
      });
    }
  }

  let currentTick = 0;
  let isNextVerse = true;
  let isNextLine = false;
  let lastSectionName = '';
  let prevEndedWithHyphen = false;

  for (let mIdx = 0; mIdx < song.measures.length; mIdx++) {
    const measure = song.measures[mIdx];

    if (measure.section && measure.section.trim()) {
      const secTrimmed = measure.section.trim();
      if (secTrimmed !== lastSectionName) {
        lastSectionName = secTrimmed;
        isNextVerse = true;
      }
    }

    const notes = measure.notes || [];

    for (let nIdx = 0; nIdx < notes.length; nIdx++) {
      const note = notes[nIdx];

      if (note.pitch === 'empty' || isNonNotationItem(note) || (typeof note.duration === 'number' && note.duration <= 0)) {
        if (
          note.lyric?.hanlo === '\n' ||
          note.lyric?.poj === '\n' ||
          note.lyric?.custom === '\n' ||
          note.lyric?.hanji === '\n'
        ) {
          isNextLine = true;
        }
        continue;
      }

      const noteDurationBeats = typeof note.duration === 'number' ? note.duration : 1;
      const noteTicks = Math.round(noteDurationBeats * TICKS_PER_BEAT);

      const prevNote = nIdx > 0 ? notes[nIdx - 1] : mIdx > 0 ? song.measures[mIdx - 1]?.notes?.slice(-1)[0] : null;
      const isContinuationOfTie = isTieActive(prevNote, note);

      if (isContinuationOfTie) {
        currentTick += noteTicks;
        continue;
      }

      const { text, rawPoj, isLineBreak } = extractNoteLyric(note, lyricType);

      if (isLineBreak) {
        isNextLine = true;
        currentTick += noteTicks;
        continue;
      }

      if (text && text.trim()) {
        const syllableFormatted = formatKaraokeSyllable(
          text.trim(),
          lyricType,
          isNextVerse,
          isNextLine,
          prevEndedWithHyphen
        );

        isNextVerse = false;
        isNextLine = false;
        prevEndedWithHyphen = rawPoj.endsWith('-') || text.endsWith('-');

        const sylBytes = stringToBytes(syllableFormatted);

        // Text Event (0xFF 0x01) - read by vanBasco and players
        events.push({
          tick: currentTick,
          priority: 0,
          data: [0xff, 0x01, ...writeVLQ(sylBytes.length), ...sylBytes],
        });

        // Lyric Event (0xFF 0x05)
        events.push({
          tick: currentTick,
          priority: 0,
          data: [0xff, 0x05, ...writeVLQ(sylBytes.length), ...sylBytes],
        });
      }

      currentTick += noteTicks;
    }

    if (measure.isLineBreak) {
      isNextLine = true;
    }
  }

  return buildTrackChunk(events);
}

/**
 * Create Track (Melody & Vocal line with note-aligned lyrics and articulations):
 * Includes standard Lyric events (0xFF 0x05) directly on notes for DAWs and notation software
 * (MuseScore, Logic Pro, GarageBand, Cubase, Sibelius, Synthesizer V, Vocaloid).
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
  const includeMelodyLyrics = options.includeMelodyLyrics ?? true;

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
      const prevNote = nIdx > 0 ? notes[nIdx - 1] : mIdx > 0 ? song.measures[mIdx - 1]?.notes?.slice(-1)[0] : null;
      const isContinuationOfTie = isTieActive(prevNote, note);

      if (isContinuationOfTie) {
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

      // Pitch calculation
      const midiPitch = calculateMidiNote(
        song.key,
        note.pitch,
        note.octave || 0,
        note.accidental || '',
        transpose
      );

      const preGrace = (note.preGraceNotes || []).slice(0, 3);
      const graceTicksPerNote = 60;
      const totalGraceTicks = preGrace.length * graceTicksPerNote;
      let startMainTick = currentTick;

      if (midiPitch !== null && preGrace.length > 0 && totalSustainedTicks > totalGraceTicks + 60) {
        preGrace.forEach((g: GraceNote, gIdx: number) => {
          const gPitch = calculateMidiNote(song.key, g.pitch, g.octave || 0, g.accidental || '', transpose);
          if (gPitch !== null) {
            const gStart = currentTick + gIdx * graceTicksPerNote;
            const gEnd = gStart + graceTicksPerNote;
            events.push({
              tick: gStart,
              priority: 3,
              data: [0x90 | channel, gPitch, 80],
            });
            events.push({
              tick: gEnd,
              priority: 1,
              data: [0x80 | channel, gPitch, 0],
            });
          }
        });
        startMainTick = currentTick + totalGraceTicks;
      }

      // Note-attached Lyric meta events (0xFF 0x05 & 0xFF 0x01) directly at main note onset
      if (lyricType !== 'none' && includeMelodyLyrics) {
        const { text, isLineBreak } = extractNoteLyric(note, lyricType);
        if (!isLineBreak && text && text.trim()) {
          const cleanSyllable = text.trim();
          const lyricBytes = stringToBytes(cleanSyllable);

          // Standard Lyric Event (0xFF 0x05) for notation / DAW engines (MuseScore, Logic Pro, SynthV)
          events.push({
            tick: startMainTick,
            priority: 0,
            data: [0xff, 0x05, ...writeVLQ(lyricBytes.length), ...lyricBytes],
          });

          // Also Text Event (0xFF 0x01) for engines that read text events
          events.push({
            tick: startMainTick,
            priority: 0,
            data: [0xff, 0x01, ...writeVLQ(lyricBytes.length), ...lyricBytes],
          });
        }
      }

      if (midiPitch !== null) {
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
 * Create Track (Chord Accompaniment track on Channel 1):
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

  // Program Change: Acoustic Grand Piano (0)
  events.push({
    tick: 0,
    priority: 2,
    data: [0xc0 | channel, 0],
  });

  const transpose = options.transpose || 0;
  let currentTick = 0;

  for (const measure of song.measures) {
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
            events.push({
              tick: chordStartTick,
              priority: 3,
              data: [0x90 | channel, pitch, 68],
            });
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
 * If lyrics are enabled, embeds both a dedicated "Words" track (for karaoke players like vanBasco)
 * and note-level Lyric events (for DAWs and score notation editors).
 */
export function exportSongToMidi(song: Song, options: MidiExportOptions = {}): Uint8Array {
  const includeAccomp = options.includeAccompaniment ?? true;
  const lyricType = options.lyricType || 'hanlo';
  const includeKaraoke = (options.includeKaraokeTrack ?? true) && lyricType !== 'none';

  // Track chunks
  const conductorTrack = buildConductorTrack(song, options);
  const tracks: number[][] = [conductorTrack];

  // Dedicated Karaoke Words Track (Format 1 Track 1)
  if (includeKaraoke) {
    const wordsTrack = buildKaraokeWordsTrack(song, options);
    tracks.push(wordsTrack);
  }

  // Vocal / Melody Track with note events and note-attached lyric events
  const melodyTrack = buildMelodyTrack(song, options);
  tracks.push(melodyTrack);

  // Accompaniment Track
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
export function createMidiBlob(midiBytes: Uint8Array, mimeType: string = 'audio/midi'): Blob {
  return new Blob([midiBytes.buffer as ArrayBuffer], { type: mimeType });
}

/**
 * Directly trigger a browser download for the song as a .mid or .kar file.
 */
export function downloadMidiFile(song: Song, options: MidiExportOptions = {}): void {
  const isKar = options.format === 'kar';
  const midiBytes = exportSongToMidi(song, options);
  const mimeType = isKar ? 'audio/midi-karaoke' : 'audio/midi';
  const blob = createMidiBlob(midiBytes, mimeType);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanTitle = (song.title || 'Untitled')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_');
  const ext = isKar ? 'kar' : 'mid';
  link.download = `${cleanTitle}.${ext}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Analyze a song's lyrics structure for previewing synchronized MIDI output in the UI.
 */
export interface SongMidiLyricsSummary {
  totalSyllables: number;
  measuresWithLyrics: number;
  hasLineBreaks: boolean;
  hasSections: boolean;
  previewLines: Array<{
    measureNumber: number;
    section?: string;
    text: string;
  }>;
}

export function getSongMidiLyricsSummary(
  song: Song,
  lyricType: MidiLyricMode = 'hanlo'
): SongMidiLyricsSummary {
  let totalSyllables = 0;
  let measuresWithLyrics = 0;
  let hasLineBreaks = false;
  let hasSections = false;
  const previewLines: Array<{ measureNumber: number; section?: string; text: string }> = [];

  song.measures.forEach((measure, mIdx) => {
    if (measure.section) hasSections = true;
    if (measure.isLineBreak) hasLineBreaks = true;

    const measureSyllables: string[] = [];
    (measure.notes || []).forEach(note => {
      const { text, isLineBreak } = extractNoteLyric(note, lyricType);
      if (isLineBreak) hasLineBreaks = true;
      if (text && text.trim()) {
        totalSyllables++;
        measureSyllables.push(text.trim());
      }
    });

    if (measureSyllables.length > 0) {
      measuresWithLyrics++;
      previewLines.push({
        measureNumber: mIdx + 1,
        section: measure.section,
        text: measureSyllables.join(' · '),
      });
    }
  });

  return {
    totalSyllables,
    measuresWithLyrics,
    hasLineBreaks,
    hasSections,
    previewLines,
  };
}
