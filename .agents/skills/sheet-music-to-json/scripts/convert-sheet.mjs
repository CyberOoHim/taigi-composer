#!/usr/bin/env node

/**
 * convert-sheet.mjs
 * 
 * Universal CLI and library for converting sheet music in diverse input formats:
 * - Text-based Numbered Musical Notation (簡譜) with lyrics (.txt, .md, .tab, .jianpu, .lrc)
 * - Standard MIDI Files (.mid, .midi)
 * - Song JSON files and streams (.json) for sanitization & rhythm balancing
 * - Direct text string (--text "...") or standard input pipe (-)
 * 
 * Visual sheet music (images/PDF) and freeform text scores are handled directly
 * by the Antigravity Agent using its native multimodal capabilities without any external API calls.
 * 
 * Produces 100% schema-compliant Song JSON ready for direct import into the Taigi Composer / Karaoke app.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseMidiBuffer, midiToSongJson } from './midi-parser.mjs';
import { isStructuredAppText, parseStructuredTextScore } from './text-parser.mjs';

const SUPPORTED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif']);
const SUPPORTED_TEXT_EXTS = new Set(['.txt', '.md', '.tab', '.jianpu', '.lrc']);
const SUPPORTED_MIDI_EXTS = new Set(['.mid', '.midi']);
const SUPPORTED_JSON_EXTS = new Set(['.json']);
const VALID_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const VALID_TIME_SIGS = ['4/4', '3/4', '2/4', '6/8'];

function printHelp() {
  console.log(`
🎵 Taigi Sheet Music & Score to Song JSON Converter 🎵

Converts musical scores and notations into the standardized JSON format qualified
for direct import into the Taigi Composer & Karaoke application.
Zero external API calls — 100% local, offline, deterministic processing!

Supported Input Types:
  1. Text-based Numbered Notation with Lyrics:
     - Structured app text format (deterministic, offline, instant)
  2. Standard MIDI Files (.mid, .midi):
     - Automatic note, tempo, meter, rests, and lyric extraction (deterministic, offline)
  3. Song JSON (.json, string, or stdin):
     - Normalization, rhythm balance checking, rest padding (--auto-fix-rhythm), and formatting
  4. Visual Sheet Music (Images / PDF) & Freeform Text:
     - Handled directly by the Antigravity Agent using its native multimodal capabilities
       (no external API keys or network requests needed; see SKILL.md)

Usage:
  node convert-sheet.mjs <input(s)...> [options]
  cat score.txt | node convert-sheet.mjs - [options]

Arguments:
  <input(s)...>             One or more files (Text, MIDI, JSON) or "-" for stdin

Options:
  --text, -t <string>       Direct text input (structured notation or draft JSON)
  --output, -o <file>       Output JSON file path (default: <title>.taigi.json)
  --key, -k <key>           Override key signature (e.g. F, C, G, Bb, D, Eb)
  --time <time>             Override time signature (e.g. 4/4, 3/4, 2/4, 6/8)
  --bpm, -b <bpm>           Override BPM (e.g. 80, 92, 108)
  --title <title>           Override song title
  --auto-fix-rhythm         Automatically pad under-beat measures with rest notes
  --strict                  Exit with error if measure beats do not match time signature
  --help, -h                Show this help guide

Examples:
  # 1. Structured numbered notation score:
  node convert-sheet.mjs score.txt -o my_song.taigi.json
  node convert-sheet.mjs --text "Title: 望春風\\nKey: F\\n[Measure 1]\\nNumbered Notation: 5 6 1 2\\n漢羅: 獨 夜 無 伴"

  # 2. Standard MIDI conversion:
  node convert-sheet.mjs track.mid --auto-fix-rhythm -o song.taigi.json

  # 3. Sanitize and balance draft Song JSON (e.g. created by Agent):
  node convert-sheet.mjs draft.json --auto-fix-rhythm -o final.taigi.json
  cat draft.json | node convert-sheet.mjs - --auto-fix-rhythm -o final.taigi.json
`);
}

function parseArgs(args) {
  const options = {
    inputs: [],
    directText: null,
    output: null,
    key: null,
    time: null,
    bpm: null,
    title: null,
    autoFixRhythm: false,
    strict: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--text' || arg === '-t' || arg === '--json' || arg === '-j') {
      options.directText = args[++i];
    } else if (arg === '--key' || arg === '-k') {
      options.key = args[++i];
    } else if (arg === '--time') {
      options.time = args[++i];
    } else if (arg === '--bpm' || arg === '-b') {
      options.bpm = parseInt(args[++i], 10);
    } else if (arg === '--title') {
      options.title = args[++i];
    } else if (arg === '--auto-fix-rhythm') {
      options.autoFixRhythm = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg.startsWith('-') && arg !== '-') {
      console.warn(`Unknown option: ${arg}`);
    } else {
      options.inputs.push(arg);
    }
  }

  return options;
}

function normalizeKey(keyStr) {
  if (!keyStr) return 'F';
  const clean = keyStr.replace(/^1\s*=\s*/i, '').trim().toUpperCase();
  const match = VALID_KEYS.find(k => k.toUpperCase() === clean);
  if (match) return match;
  if (clean === 'C#') return 'Db';
  if (clean === 'D#') return 'Eb';
  if (clean === 'G#') return 'Ab';
  if (clean === 'A#') return 'Bb';
  if (clean === 'GB') return 'F#';
  return 'F';
}

function normalizeTimeSig(timeStr) {
  if (!timeStr) return '4/4';
  const clean = timeStr.trim();
  if (VALID_TIME_SIGS.includes(clean)) return clean;
  return '4/4';
}

function getExpectedBeats(timeSignature) {
  const [num, den] = (timeSignature || '4/4').split('/').map(Number);
  return (num || 4) * (4 / (den || 4));
}

function normalizePitch(p) {
  if (p === 'empty' || p === 'space' || p === null || p === undefined) return 'empty';
  const num = Number(p);
  if (!isNaN(num) && num >= 0 && num <= 7) return Math.floor(num);
  return 1;
}

function isJsonString(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return Boolean(parsed && (parsed.measures || parsed.title));
  } catch {
    return false;
  }
}

function printAgentVisualGuidance(fileList) {
  console.log(`
📷 Visual Score File(s) Detected: ${fileList.join(', ')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Visual sheet music (scanned images & PDF documents) are transcribed
directly by the Antigravity Agent using its native multimodal vision tools.
Zero external API calls or API keys are required!

Agent Direct Transcription Workflow:
  1. Inspect the score image or PDF using the agent's view_file tool.
  2. Transcribe key (1=F), meter (4/4), measures, notes (pitch 1-7, 0,
     durations, ties/slurs, chords), and lyrics.
  3. Enrich Taiwanese Hokkien Hanlo with accurate Pe̍h-ōe-jī (POJ) tone diacritics.
  4. Split into short, meaningful karaoke phrases (2-4 measures, 4-8 syllables).
  5. Save as Song JSON and validate using:
     node .agents/skills/sheet-music-to-json/scripts/validate-song-json.mjs <song.json>

See .agents/skills/sheet-music-to-json/SKILL.md for complete instructions.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

function printAgentFreeformGuidance() {
  console.log(`
📝 Freeform Text Score Detected:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Unstructured text notation is transcribed directly by the Antigravity Agent
without external API calls.

Agent Workflow:
  1. Inspect the score text directly.
  2. Structure the score into the canonical format (see SKILL.md Section 2A)
     or transcribe directly into Song JSON adhering to schema.json.
  3. Validate with validate-song-json.mjs.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

/**
 * Universal Post-Processor: sanitizes, formats, fixes IDs, and checks rhythm
 */
function sanitizeAndFormatSong(rawSong, options = {}) {
  const songId = rawSong.id && typeof rawSong.id === 'string' ? rawSong.id : `song-${Date.now()}`;
  const title = (options.title || rawSong.title || 'Untitled Song').trim();
  const subtitle = rawSong.subtitle || '';
  const composer = rawSong.composer || '';
  const lyricist = rawSong.lyricist || '';
  const key = normalizeKey(options.key || rawSong.key);
  const timeSignature = normalizeTimeSig(options.time || rawSong.timeSignature);
  const bpm = options.bpm || (typeof rawSong.bpm === 'number' && rawSong.bpm > 30 && rawSong.bpm < 300 ? rawSong.bpm : 80);
  const notesPerLine = rawSong.notesPerLine || 4;

  const expectedBeats = getExpectedBeats(timeSignature);
  const measures = [];
  let rhythmWarnings = 0;
  let autoFixedMeasures = 0;

  const rawMeasures = Array.isArray(rawSong.measures) ? rawSong.measures : [];

  rawMeasures.forEach((m, mIdx) => {
    const measureNumber = typeof m.measureNumber === 'number' ? m.measureNumber : mIdx + 1;
    const measureId = m.id && typeof m.id === 'string' ? m.id : `m-${measureNumber}-${Date.now().toString(36)}-${mIdx}`;
    const chord = typeof m.chord === 'string' && m.chord.trim() ? m.chord.trim() : undefined;
    const section = typeof m.section === 'string' && m.section.trim() ? m.section.trim() : undefined;
    const barlineType = m.barlineType || undefined;
    const isLineBreak = Boolean(m.isLineBreak);

    const notes = [];
    const rawNotes = Array.isArray(m.notes) ? m.notes : [];

    rawNotes.forEach((n, nIdx) => {
      const noteId = n.id && typeof n.id === 'string' ? n.id : `n-${measureNumber}-${nIdx + 1}-${Math.random().toString(36).substring(2, 6)}`;
      const pitch = normalizePitch(n.pitch);
      const octave = typeof n.octave === 'number' && [-2, -1, 0, 1, 2].includes(n.octave) ? n.octave : 0;
      const accidental = n.accidental === '#' || n.accidental === 'b' ? n.accidental : '';
      let duration = typeof n.duration === 'number' && n.duration >= 0 ? n.duration : 1;

      // Zero-duration rule for spacers / annotations / empty pitches
      if (pitch === 'empty') duration = 0;

      const isDotted = Boolean(n.isDotted || duration === 1.5 || duration === 0.75 || duration === 3.0);
      const isDoubleDotted = Boolean(n.isDoubleDotted || duration === 1.75 || duration === 3.5);
      const tieToNext = Boolean(n.tieToNext || n.isTied);
      const slurToNext = Boolean(n.slurToNext);
      const isTriplet = Boolean(n.isTriplet || duration === 0.333 || duration === 0.667);

      const rawLyric = n.lyric || {};
      const hanlo = rawLyric.hanlo || rawLyric.hanji || rawLyric.custom || undefined;
      const poj = rawLyric.poj || rawLyric.tl || undefined;
      const lyric = {
        hanlo,
        poj,
        hanji: hanlo,
        custom: hanlo,
      };

      notes.push({
        id: noteId,
        pitch,
        octave,
        accidental: accidental || undefined,
        duration,
        isDotted: isDotted || undefined,
        isDoubleDotted: isDoubleDotted || undefined,
        tieToNext: tieToNext || undefined,
        slurToNext: slurToNext || undefined,
        isTriplet: isTriplet || undefined,
        preGraceNotes: Array.isArray(n.preGraceNotes) && n.preGraceNotes.length > 0 ? n.preGraceNotes : undefined,
        postGraceNotes: Array.isArray(n.postGraceNotes) && n.postGraceNotes.length > 0 ? n.postGraceNotes : undefined,
        articulation: n.articulation && n.articulation !== 'none' ? n.articulation : undefined,
        annotation: n.annotation || undefined,
        lyric,
      });
    });

    if (notes.length === 0) {
      notes.push({
        id: `n-${measureNumber}-1-rest`,
        pitch: 0,
        octave: 0,
        accidental: '',
        duration: expectedBeats,
        lyric: {},
      });
    }

    // Measure beat sum calculation
    let currentMeasureBeats = notes.reduce((sum, n) => {
      if (n.pitch === 'empty' || n.duration <= 0) return sum;
      return sum + n.duration;
    }, 0);
    currentMeasureBeats = Math.round(currentMeasureBeats * 1000) / 1000;

    const diff = Math.abs(currentMeasureBeats - expectedBeats);

    // Auto-fix deficit if requested
    if (options.autoFixRhythm && currentMeasureBeats < expectedBeats - 0.05) {
      const deficit = Math.round((expectedBeats - currentMeasureBeats) * 1000) / 1000;
      notes.push({
        id: `n-${measureNumber}-${notes.length + 1}-autofix-rest`,
        pitch: 0,
        octave: 0,
        accidental: '',
        duration: deficit,
        isDotted: deficit === 1.5 || deficit === 0.75 || deficit === 3.0 || undefined,
        lyric: {},
      });
      autoFixedMeasures++;
    } else if (diff > 0.05 && !section?.includes('前奏') && !section?.includes('Pickup')) {
      rhythmWarnings++;
    }

    measures.push({
      id: measureId,
      measureNumber,
      chord,
      section,
      barlineType,
      isLineBreak,
      notes,
    });
  });

  return {
    song: {
      id: songId,
      title,
      subtitle: subtitle || undefined,
      composer: composer || undefined,
      lyricist: lyricist || undefined,
      key,
      timeSignature,
      bpm,
      notesPerLine,
      measures,
      description: rawSong.description || `Transcribed score for ${title}.`,
    },
    rhythmWarnings,
    autoFixedMeasures,
    expectedBeats,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || (options.inputs.length === 0 && !options.directText)) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  let rawSong = null;

  // 1. Direct text passed via --text / -t / --json / -j
  if (options.directText) {
    const text = options.directText;
    if (isJsonString(text)) {
      console.log('📦 Detected direct Song JSON input. Sanitizing and formatting...');
      rawSong = JSON.parse(text);
    } else if (isStructuredAppText(text)) {
      console.log('📝 Detected structured app score text format. Parsing deterministically...');
      rawSong = parseStructuredTextScore(text, options);
    } else {
      printAgentFreeformGuidance();
      process.exit(1);
    }
  }

  // 2. Standard input pipe ("-")
  else if (options.inputs.length === 1 && options.inputs[0] === '-') {
    console.log('📥 Reading score from standard input (stdin)...');
    const text = fs.readFileSync(0, 'utf-8');
    if (isJsonString(text)) {
      console.log('📦 Detected Song JSON from stdin. Sanitizing and formatting...');
      rawSong = JSON.parse(text);
    } else if (isStructuredAppText(text)) {
      console.log('📝 Detected structured app score text format. Parsing deterministically...');
      rawSong = parseStructuredTextScore(text, options);
    } else {
      printAgentFreeformGuidance();
      process.exit(1);
    }
  }

  // 3. File inputs
  else if (options.inputs.length > 0) {
    const firstInput = options.inputs[0];
    const ext = path.extname(firstInput).toLowerCase();

    // Visual score guidance for images / PDF
    if (SUPPORTED_IMAGE_EXTS.has(ext) || ext === '.pdf') {
      printAgentVisualGuidance(options.inputs);
      process.exit(0);
    }

    // Verify all files exist
    for (const f of options.inputs) {
      if (!fs.existsSync(f)) {
        console.error(`Error: File not found: ${f}`);
        process.exit(1);
      }
    }

    // A. JSON file input (e.g. draft from agent)
    if (SUPPORTED_JSON_EXTS.has(ext)) {
      console.log(`📦 Reading Song JSON from: ${firstInput}`);
      const rawText = fs.readFileSync(firstInput, 'utf-8');
      rawSong = JSON.parse(rawText);
    }

    // B. Text file input
    else if (SUPPORTED_TEXT_EXTS.has(ext)) {
      console.log(`📄 Reading text score from: ${firstInput}`);
      const text = fs.readFileSync(firstInput, 'utf-8');
      if (isJsonString(text)) {
        console.log('📦 File contains Song JSON. Sanitizing and formatting...');
        rawSong = JSON.parse(text);
      } else if (isStructuredAppText(text)) {
        console.log('📝 Parsing structured notation deterministically...');
        rawSong = parseStructuredTextScore(text, options);
      } else {
        printAgentFreeformGuidance();
        process.exit(1);
      }
    }

    // C. MIDI file input
    else if (SUPPORTED_MIDI_EXTS.has(ext)) {
      console.log(`🎹 Parsing Standard MIDI file: ${firstInput}`);
      const buf = fs.readFileSync(firstInput);
      const midiData = parseMidiBuffer(buf);
      rawSong = midiToSongJson(midiData, options);
      console.log(`✨ Successfully extracted ${rawSong.measures.length} measures from MIDI!`);
    }

    else {
      console.error(`Error: Unsupported file type: "${ext}". Supported: Text (.txt, .md), MIDI (.mid), JSON (.json).`);
      process.exit(1);
    }
  }

  if (!rawSong) {
    console.error('Error: No song data produced.');
    process.exit(1);
  }

  // Sanitize and normalize
  const { song, rhythmWarnings, autoFixedMeasures, expectedBeats } = sanitizeAndFormatSong(rawSong, options);

  const cleanTitle = (song.title || 'untitled').replace(/[\\/:*?"<>| ]+/g, '_');
  const outputPath = options.output || `${cleanTitle}.taigi.json`;
  fs.writeFileSync(outputPath, JSON.stringify(song, null, 2), 'utf-8');

  console.log(`\n✅ Conversion successful!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Title:          ${song.title} ${song.subtitle ? `(${song.subtitle})` : ''}`);
  console.log(`  Key / Time:     Key ${song.key} | ${song.timeSignature} | ${song.bpm} BPM`);
  console.log(`  Composer:       ${song.composer || '—'}`);
  console.log(`  Lyricist:       ${song.lyricist || '—'}`);
  console.log(`  Measures:       ${song.measures.length}`);
  console.log(`  Total Notes:    ${song.measures.reduce((acc, m) => acc + m.notes.length, 0)}`);
  if (autoFixedMeasures > 0) {
    console.log(`  🛠️  Auto-Fix:     Padded ${autoFixedMeasures} measure(s) with rests to match ${expectedBeats} beats.`);
  }
  if (rhythmWarnings > 0) {
    console.log(`  ⚠️  Rhythm alert:  ${rhythmWarnings} measure(s) differ from expected ${expectedBeats} beats.`);
    if (options.strict) {
      console.error(`\nStrict check failed due to rhythm discrepancies.`);
      process.exit(1);
    }
  } else {
    console.log(`  Rhythm check:   100% balanced (${expectedBeats} beats/measure)`);
  }
  console.log(`  Saved to:       ${outputPath}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`To import into the app:`);
  console.log(`1. Open the app in your browser.`);
  console.log(`2. Click "Library / Import" in the top bar.`);
  console.log(`3. Under the "Import" tab, choose "${outputPath}" or paste its content.`);
  console.log(`4. Enjoy instant editing, interactive rehearsal, and karaoke!\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
