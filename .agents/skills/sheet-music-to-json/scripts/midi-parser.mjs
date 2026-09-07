/**
 * midi-parser.mjs
 * 
 * High-performance, dependency-free Standard MIDI File (SMF Format 0 & Format 1)
 * parser and converter to Taigi Numbered Notation Song JSON.
 */

const KEY_OFFSETS = {
  'C': 0, 'Db': 1, 'C#': 1, 'D': 2, 'Eb': 3, 'D#': 3, 'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'Ab': 8, 'G#': 8, 'A': 9,
  'Bb': 10, 'A#': 10, 'B': 11
};

// Major scale scale degree semitone mapping
// 0 -> 1, 2 -> 2, 4 -> 3, 5 -> 4, 7 -> 5, 9 -> 6, 11 -> 7
const DEGREE_LOOKUP = [
  { pitch: 1, accidental: '' },   // 0 semitone: Tonic (1)
  { pitch: 1, accidental: '#' },  // 1 semitone: #1 or b2
  { pitch: 2, accidental: '' },   // 2 semitones: Supertonic (2)
  { pitch: 3, accidental: 'b' },  // 3 semitones: b3 or #2
  { pitch: 3, accidental: '' },   // 4 semitones: Mediant (3)
  { pitch: 4, accidental: '' },   // 5 semitones: Subdominant (4)
  { pitch: 4, accidental: '#' },  // 6 semitones: #4 or b5
  { pitch: 5, accidental: '' },   // 7 semitones: Dominant (5)
  { pitch: 5, accidental: '#' },  // 8 semitones: #5 or b6
  { pitch: 6, accidental: '' },   // 9 semitones: Submediant (6)
  { pitch: 7, accidental: 'b' },  // 10 semitones: b7 or #6
  { pitch: 7, accidental: '' },   // 11 semitones: Leading Tone (7)
];

const STANDARD_DURATIONS = [
  { dur: 4.0, isDotted: false },
  { dur: 3.5, isDotted: true, isDoubleDotted: true },
  { dur: 3.0, isDotted: true },
  { dur: 2.0, isDotted: false },
  { dur: 1.75, isDotted: true, isDoubleDotted: true },
  { dur: 1.5, isDotted: true },
  { dur: 1.0, isDotted: false },
  { dur: 0.75, isDotted: true },
  { dur: 0.667, isDotted: false, isTriplet: true },
  { dur: 0.5, isDotted: false },
  { dur: 0.375, isDotted: true },
  { dur: 0.333, isDotted: false, isTriplet: true },
  { dur: 0.25, isDotted: false },
  { dur: 0.125, isDotted: false },
];

function quantizeDuration(rawBeats) {
  if (rawBeats <= 0.08) return { dur: 0.125, isDotted: false };
  let best = STANDARD_DURATIONS[0];
  let minDiff = Infinity;
  for (const item of STANDARD_DURATIONS) {
    const diff = Math.abs(rawBeats - item.dur);
    if (diff < minDiff) {
      minDiff = diff;
      best = item;
    }
  }
  // If close enough to standard duration (within 20% or 0.15 beats)
  if (minDiff < 0.18 || minDiff / best.dur < 0.2) {
    return { ...best };
  }
  // Fallback to rounded raw beats
  const rounded = Math.round(rawBeats * 4) / 4;
  return {
    dur: Math.max(0.125, rounded),
    isDotted: rounded === 1.5 || rounded === 0.75 || rounded === 3.0,
  };
}

export function parseMidiBuffer(buf) {
  let pos = 0;

  function readString(len) {
    const s = buf.toString('utf8', pos, pos + len);
    pos += len;
    return s;
  }
  function readUInt32() {
    const val = buf.readUInt32BE(pos);
    pos += 4;
    return val;
  }
  function readUInt16() {
    const val = buf.readUInt16BE(pos);
    pos += 2;
    return val;
  }
  function readUInt8() {
    const val = buf.readUInt8(pos);
    pos += 1;
    return val;
  }
  function readVLQ() {
    let val = 0;
    let b;
    do {
      b = readUInt8();
      val = (val << 7) | (b & 0x7f);
    } while (b & 0x80);
    return val;
  }

  const magic = readString(4);
  if (magic !== 'MThd') {
    throw new Error(`Invalid MIDI file header: expected "MThd", got "${magic}"`);
  }

  const headerLen = readUInt32();
  const format = readUInt16();
  const numTracks = readUInt16();
  const division = readUInt16();
  pos = 8 + headerLen;

  let bpm = 80;
  let timeSignature = '4/4';
  let key = 'F';
  let songTitle = '';

  const tracks = [];

  for (let t = 0; t < numTracks; t++) {
    if (pos >= buf.length) break;
    const trkMagic = readString(4);
    if (trkMagic !== 'MTrk') {
      break;
    }
    const trkLen = readUInt32();
    const endPos = pos + trkLen;
    let currentTick = 0;
    let runningStatus = 0;
    const events = [];
    let trackName = '';

    while (pos < endPos && pos < buf.length) {
      const delta = readVLQ();
      currentTick += delta;

      let status = buf.readUInt8(pos);
      if (status < 0x80) {
        status = runningStatus;
      } else {
        pos++;
        runningStatus = status;
      }

      if (status === 0xFF) {
        // Meta event
        const metaType = readUInt8();
        const metaLen = readVLQ();
        const metaData = buf.subarray(pos, pos + metaLen);
        pos += metaLen;

        if (metaType === 0x51) {
          // Set Tempo (microseconds per quarter note)
          const us = (metaData[0] << 16) | (metaData[1] << 8) | metaData[2];
          if (us > 0) bpm = Math.round(60000000 / us);
        } else if (metaType === 0x58) {
          // Time Signature
          const num = metaData[0] || 4;
          const den = Math.pow(2, metaData[1] || 2);
          const candidate = `${num}/${den}`;
          if (['4/4', '3/4', '2/4', '6/8'].includes(candidate)) {
            timeSignature = candidate;
          }
        } else if (metaType === 0x59) {
          // Key Signature: sf = [-7..7], mi = [0=major, 1=minor]
          const sf = metaData[0] > 127 ? metaData[0] - 256 : metaData[0];
          const sfMap = {
            '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
            '0': 'C', '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#', '7': 'C#'
          };
          if (sfMap[sf]) key = sfMap[sf];
        } else if (metaType === 0x03) {
          // Track Name
          const name = metaData.toString('utf8').trim();
          trackName = name;
          if (!songTitle && name && !name.toLowerCase().includes('conductor') && !name.toLowerCase().includes('tempo')) {
            songTitle = name;
          }
        } else if (metaType === 0x05 || metaType === 0x01) {
          // Lyric or Text event
          const text = metaData.toString('utf8').trim();
          if (text) {
            events.push({ type: 'lyric', tick: currentTick, text });
          }
        } else if (metaType === 0x06) {
          // Marker
          const text = metaData.toString('utf8').trim();
          if (text) {
            events.push({ type: 'marker', tick: currentTick, text });
          }
        }
      } else if (status === 0xF0 || status === 0xF7) {
        // SysEx
        const sysLen = readVLQ();
        pos += sysLen;
      } else {
        // Channel event
        const msgType = status & 0xF0;
        const ch = status & 0x0F;

        if (msgType === 0x90) {
          const pitch = readUInt8();
          const vel = readUInt8();
          events.push({
            type: vel > 0 ? 'noteOn' : 'noteOff',
            tick: currentTick,
            pitch,
            vel,
            ch,
          });
        } else if (msgType === 0x80) {
          const pitch = readUInt8();
          const vel = readUInt8();
          events.push({
            type: 'noteOff',
            tick: currentTick,
            pitch,
            vel,
            ch,
          });
        } else if (msgType === 0xC0 || msgType === 0xD0) {
          pos += 1;
        } else {
          pos += 2;
        }
      }
    }

    tracks.push({ trackIndex: t, trackName, events });
  }

  return {
    format,
    numTracks,
    division: division || 480,
    bpm,
    timeSignature,
    key,
    songTitle,
    tracks,
  };
}

/**
 * Convert parsed MIDI data into application Song JSON
 */
export function midiToSongJson(midiData, options = {}) {
  const division = midiData.division || 480;
  const key = options.key || midiData.key || 'F';
  const timeSignature = options.time || midiData.timeSignature || '4/4';
  const bpm = options.bpm || midiData.bpm || 80;
  const title = options.title || midiData.songTitle || 'Imported MIDI Score';

  const [numBeats, den] = timeSignature.split('/').map(Number);
  const beatsPerMeasure = (numBeats || 4) * (4 / (den || 4));

  // Find melody track:
  // 1. Track specified in options.track
  // 2. Track with most lyric events
  // 3. Track named "Melody", "Vocal", "Lead", or "Track 1"
  // 4. Track with most single-voice notes in range 48-84
  let melodyTrack = null;
  if (typeof options.track === 'number' && midiData.tracks[options.track]) {
    melodyTrack = midiData.tracks[options.track];
  } else {
    // Score tracks
    let bestScore = -1;
    for (const trk of midiData.tracks) {
      const noteCount = trk.events.filter(e => e.type === 'noteOn').length;
      if (noteCount === 0) continue;
      const lyricCount = trk.events.filter(e => e.type === 'lyric').length;
      let score = noteCount;
      if (lyricCount > 0) score += lyricCount * 20;
      const name = (trk.trackName || '').toLowerCase();
      if (name.includes('melody') || name.includes('vocal') || name.includes('lead') || name.includes('solo')) {
        score += 1000;
      }
      if (score > bestScore) {
        bestScore = score;
        melodyTrack = trk;
      }
    }
  }

  if (!melodyTrack) {
    // Fallback to first non-empty track
    melodyTrack = midiData.tracks.find(t => t.events.length > 0) || { events: [] };
  }

  // Also collect any lyrics or markers across all tracks (especially track 0 and melodyTrack)
  const allLyrics = [];
  const allMarkers = [];
  midiData.tracks.forEach(trk => {
    trk.events.forEach(e => {
      if (e.type === 'lyric') allLyrics.push(e);
      if (e.type === 'marker') allMarkers.push(e);
    });
  });

  // Extract paired Note On/Off events from melody track
  const activeNotes = new Map(); // pitch -> noteOn event
  const noteSpans = [];

  // Sort events by tick
  const sortedEvents = [...melodyTrack.events].sort((a, b) => a.tick - b.tick);

  for (const ev of sortedEvents) {
    if (ev.type === 'noteOn') {
      // If already active, close previous note
      if (activeNotes.has(ev.pitch)) {
        const prev = activeNotes.get(ev.pitch);
        if (ev.tick > prev.tick) {
          noteSpans.push({
            pitch: prev.pitch,
            startTick: prev.tick,
            durationTicks: ev.tick - prev.tick,
          });
        }
      }
      activeNotes.set(ev.pitch, ev);
    } else if (ev.type === 'noteOff') {
      if (activeNotes.has(ev.pitch)) {
        const onEv = activeNotes.get(ev.pitch);
        activeNotes.delete(ev.pitch);
        const dur = ev.tick - onEv.tick;
        if (dur > 0) {
          noteSpans.push({
            pitch: onEv.pitch,
            startTick: onEv.tick,
            durationTicks: dur,
          });
        }
      }
    }
  }

  // Close any unclosed notes at last tick
  const maxTick = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].tick : 0;
  for (const [p, onEv] of activeNotes.entries()) {
    noteSpans.push({
      pitch: p,
      startTick: onEv.tick,
      durationTicks: Math.max(division, maxTick - onEv.tick),
    });
  }

  // Sort notes by startTick
  noteSpans.sort((a, b) => a.startTick - b.startTick);

  // Map each MIDI note to scale degree & octave relative to Key
  const rootKeyOffset = KEY_OFFSETS[key] ?? 5; // Default F = 5

  function midiNoteToNumbered(midiPitch) {
    // Relative semitones from C4 (MIDI 60)
    const relFromC4 = midiPitch - 60;
    // Relative to key root:
    const relFromKey = relFromC4 - rootKeyOffset;
    const octave = Math.floor(relFromKey / 12);
    const semitoneDegree = ((relFromKey % 12) + 12) % 12;
    const mapping = DEGREE_LOOKUP[semitoneDegree] || { pitch: 1, accidental: '' };
    return {
      pitch: mapping.pitch,
      accidental: mapping.accidental,
      octave: Math.max(-2, Math.min(2, octave)),
    };
  }

  // Build Measures by beats
  const measures = [];
  let currentBeat = 0;
  let currentMeasureIndex = 1;
  let currentMeasureNotes = [];
  let currentMeasureSection = undefined;
  let phraseSyllableCount = 0;

  // Function to attach lyrics near a given tick
  function findLyricNearTick(tick) {
    const threshold = division * 0.4;
    const match = allLyrics.find(l => Math.abs(l.tick - tick) <= threshold);
    return match ? match.text : '';
  }

  function findMarkerNearTick(tick) {
    const threshold = division * 0.5;
    const match = allMarkers.find(m => Math.abs(m.tick - tick) <= threshold);
    return match ? match.text : undefined;
  }

  function commitMeasure(forceLineBreak = false) {
    const mId = `m-${currentMeasureIndex}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    measures.push({
      id: mId,
      measureNumber: currentMeasureIndex,
      section: currentMeasureSection,
      notes: [...currentMeasureNotes],
      isLineBreak: forceLineBreak,
    });
    currentMeasureIndex++;
    currentMeasureNotes = [];
    currentMeasureSection = undefined;
  }

  let noteIdx = 0;
  const totalNotes = noteSpans.length;

  while (noteIdx < totalNotes) {
    const note = noteSpans[noteIdx];
    const noteStartBeat = note.startTick / division;
    const noteRawDurBeats = note.durationTicks / division;

    // Check if there is a gap (rest) before this note
    if (noteStartBeat > currentBeat + 0.08) {
      const restDuration = noteStartBeat - currentBeat;
      // How much rest fits in current measure?
      const currentMeasureBeatsRemaining = beatsPerMeasure - (currentBeat % beatsPerMeasure);

      if (restDuration <= currentMeasureBeatsRemaining) {
        const qRest = quantizeDuration(restDuration);
        currentMeasureNotes.push({
          id: `n-${currentMeasureIndex}-${currentMeasureNotes.length + 1}-rest`,
          pitch: 0,
          octave: 0,
          accidental: '',
          duration: qRest.dur,
          isDotted: qRest.isDotted || undefined,
          lyric: {},
        });
        currentBeat += restDuration;
      } else {
        // Rest fills remainder of measure
        const restPart1 = quantizeDuration(currentMeasureBeatsRemaining);
        currentMeasureNotes.push({
          id: `n-${currentMeasureIndex}-${currentMeasureNotes.length + 1}-rest`,
          pitch: 0,
          octave: 0,
          accidental: '',
          duration: restPart1.dur,
          lyric: {},
        });
        currentBeat += currentMeasureBeatsRemaining;
        commitMeasure();
        continue;
      }
    }

    // Check if current measure is already full
    if (currentBeat % beatsPerMeasure === 0 && currentMeasureNotes.length > 0) {
      // Check karaoke phrase break
      const shouldBreak = phraseSyllableCount >= 6;
      commitMeasure(shouldBreak);
      if (shouldBreak) phraseSyllableCount = 0;
    }

    // Check for section markers
    const marker = findMarkerNearTick(note.startTick);
    if (marker) currentMeasureSection = marker;

    const numInfo = midiNoteToNumbered(note.pitch);
    const quantized = quantizeDuration(noteRawDurBeats);
    const lyricStr = findLyricNearTick(note.startTick);

    if (lyricStr) phraseSyllableCount++;

    const noteObj = {
      id: `n-${currentMeasureIndex}-${currentMeasureNotes.length + 1}`,
      pitch: numInfo.pitch,
      octave: numInfo.octave,
      accidental: numInfo.accidental || undefined,
      duration: quantized.dur,
      isDotted: quantized.isDotted || undefined,
      isDoubleDotted: quantized.isDoubleDotted || undefined,
      isTriplet: quantized.isTriplet || undefined,
      lyric: lyricStr ? { hanlo: lyricStr, poj: '' } : {},
    };

    currentMeasureNotes.push(noteObj);
    currentBeat += quantized.dur;
    noteIdx++;

    // Check if measure is filled
    const measureAccumBeats = currentMeasureNotes.reduce((s, n) => s + (n.pitch === 'empty' ? 0 : n.duration), 0);
    if (measureAccumBeats >= beatsPerMeasure - 0.05) {
      const isLongPhrase = phraseSyllableCount >= 6;
      commitMeasure(isLongPhrase);
      if (isLongPhrase) phraseSyllableCount = 0;
    }
  }

  // Commit any remaining notes
  if (currentMeasureNotes.length > 0) {
    commitMeasure(true);
  }

  if (measures.length === 0) {
    // Empty default measure
    measures.push({
      id: `m-1-${Date.now()}`,
      measureNumber: 1,
      notes: [
        {
          id: `n-1-1`,
          pitch: 1,
          octave: 0,
          duration: beatsPerMeasure,
          lyric: { hanlo: '阮', poj: 'Gún' },
        },
      ],
    });
  }

  return {
    id: `song-${Date.now()}`,
    title,
    key,
    timeSignature,
    bpm,
    notesPerLine: 4,
    description: `Imported from Standard MIDI File (${title}) with automatic scale degree quantization.`,
    measures,
  };
}
