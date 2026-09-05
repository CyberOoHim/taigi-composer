#!/usr/bin/env node

/**
 * convert-sheet.mjs
 * 
 * CLI tool and library for converting sheet music (images or PDF) into
 * standard Song JSON compatible with the Taigi Composer / Karaoke application.
 * 
 * Usage:
 *   node convert-sheet.mjs <file-or-files...> [options]
 * 
 * Options:
 *   --output, -o <file>       Output JSON file path (default: <title>.taigi.json)
 *   --model, -m <model>       Gemini model (default: gemini-2.5-flash or gemini-3.1-pro-preview)
 *   --mode <mode>             Extraction mode: 'full_score' | 'lyrics_only' (default: full_score)
 *   --key, -k <key>           Force key signature (e.g. F, C, G, Bb)
 *   --time, -t <time>         Force time signature (e.g. 4/4, 3/4, 2/4, 6/8)
 *   --bpm, -b <bpm>           Force BPM (e.g. 80, 96)
 *   --strict                  Enforce strict measure beat sum check
 *   --help, -h                Show help
 */

import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';

const SUPPORTED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif']);
const VALID_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const VALID_TIME_SIGS = ['4/4', '3/4', '2/4', '6/8'];

function printHelp() {
  console.log(`
🎵 Sheet Music to Taigi Song JSON Converter 🎵

Converts scanned sheet music (Jianpu 簡譜 or Staff Notation) in Image (PNG, JPG, WEBP)
or PDF format into the standardized JSON schema required by the Taigi Composer app.

Usage:
  node convert-sheet.mjs <file(s)...> [options]

Arguments:
  <file(s)...>              One or more image files (.png, .jpg, .webp) or PDF (.pdf)

Options:
  --output, -o <path>       Output path for the generated JSON file
  --model, -m <model>       Model to use (default: gemini-2.5-flash)
  --mode <mode>             'full_score' (default) or 'lyrics_only'
  --key, -k <key>           Override key signature (e.g., F, C, G, Bb)
  --time, -t <time>         Override time signature (e.g., 4/4, 3/4, 2/4, 6/8)
  --bpm, -b <bpm>           Override BPM (e.g., 76, 80, 92)
  --api-key <key>           Gemini API key (defaults to process.env.GEMINI_API_KEY)
  --strict                  Exit with error if measure beats do not match time signature
  --help, -h                Show this help message

Examples:
  node convert-sheet.mjs score.pdf -o my_song.taigi.json
  node convert-sheet.mjs page1.png page2.png --key F --time 4/4
  node convert-sheet.mjs song.jpg --model gemini-3.1-pro-preview
`);
}

function parseArgs(args) {
  const options = {
    files: [],
    output: null,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    mode: 'full_score',
    key: null,
    time: null,
    bpm: null,
    apiKey: process.env.GEMINI_API_KEY || null,
    strict: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--model' || arg === '-m') {
      options.model = args[++i];
    } else if (arg === '--mode') {
      options.mode = args[++i];
    } else if (arg === '--key' || arg === '-k') {
      options.key = args[++i];
    } else if (arg === '--time' || arg === '-t') {
      options.time = args[++i];
    } else if (arg === '--bpm' || arg === '-b') {
      options.bpm = parseInt(args[++i], 10);
    } else if (arg === '--api-key') {
      options.apiKey = args[++i];
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg.startsWith('-')) {
      console.warn(`Unknown option: ${arg}`);
    } else {
      options.files.push(arg);
    }
  }

  return options;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  throw new Error(`Unsupported file type: ${ext}. Supported: PDF, PNG, JPG, WEBP.`);
}

function normalizeKey(keyStr) {
  if (!keyStr) return 'F';
  const clean = keyStr.replace(/^1\s*=\s*/i, '').trim().toUpperCase();
  const match = VALID_KEYS.find((k) => k.toUpperCase() === clean);
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
  const [num, den] = timeSignature.split('/').map(Number);
  return (num || 4) * (4 / (den || 4));
}

function normalizePitch(p) {
  if (p === 'empty' || p === 'space' || p === null || p === undefined) return 'empty';
  const num = Number(p);
  if (!isNaN(num) && num >= 0 && num <= 7) return Math.floor(num);
  return 1;
}

function buildTranscriptionPrompt(fileCount, isPdf, mode) {
  const sourceDescription = isPdf
    ? `The input contains a PDF score document with ${fileCount} file(s).`
    : `The user provided ${fileCount} page image(s) of sheet music in sequential reading order.`;

  return `You are a world-class music transcription AI and expert in Numbered Musical Notation (Jianpu 簡譜) and Taiwanese Hokkien songs (Taigi).
${sourceDescription}

Task: Carefully inspect every measure of the music notation and transcribe it into structured, valid JSON matching the exact schema below.

Critical Transcription Rules:
1. **Metadata**:
   - "title": Song title (e.g., "望春風", "雨夜花", "思慕的人"). Look at the header of the sheet.
   - "subtitle": Subtitle or alternative title if present.
   - "composer": Composer name (作曲).
   - "lyricist": Lyricist name (作詞).
   - "key": Key signature (e.g. "F", "C", "G", "Bb", "D", "Eb"). Look for "1 = F", "1 = C", etc. Defaults to "F" or "C" if not found.
   - "timeSignature": Time signature (e.g. "4/4", "3/4", "2/4", "6/8"). Look for time signature at the beginning of the first system.
   - "bpm": Tempo in beats per minute (e.g. 76, 80, 88, 96). Default to 80 if unspecified.

2. **Measures & Note Structure**:
   - Sequence measures chronologically from measure 1 to the end across all pages without omitting or duplicating.
   - "measureNumber": 1, 2, 3...
   - "chord": Harmonic chord symbol above the measure if present (e.g., "F", "C7", "Am", "Dm", "Bb", "G7").
   - "section": Optional section tag (e.g., "前奏", "主歌", "副歌", "尾奏", "Verse 1", "Chorus", "Intro", "Outro").
   - "barlineType": "single" (default), "double", "end", "repeat_start", "repeat_end".
   - "isLineBreak": true if this measure marks the end of a printed line/system.

3. **Jianpu Note Decoding**:
   - "pitch": 
     * 1 (Do), 2 (Re), 3 (Mi), 4 (Fa), 5 (Sol), 6 (La), 7 (Ti)
     * 0 (Rest / 休止符)
     * "empty" (Blank spacer / punctuation / line marker)
   - "octave":
     * 0: middle octave (no dots)
     * 1: one dot above (高音 1̇, 2̇, etc.)
     * 2: two dots above (倍高音)
     * -1: one dot below (低音 5̣, 6̣, etc.)
     * -2: two dots below (倍低音)
   - "accidental": "" (natural), "#" (sharp), "b" (flat).
   - "duration": Duration in beats (relative to quarter note = 1):
     * Whole note (4 beats): in Jianpu represented by note followed by three dashes (e.g. 5 - - -) -> duration: 4
     * Dotted half note (3 beats): note followed by two dashes (5 - -) -> duration: 3
     * Half note (2 beats): note followed by one dash (5 -) -> duration: 2
     * Dotted quarter note (1.5 beats): 5· -> duration: 1.5, isDotted: true
     * Quarter note (1 beat): standalone number (5) -> duration: 1
     * Dotted 8th note (0.75 beats): 5· with 1 underline -> duration: 0.75, isDotted: true
     * 8th note (0.5 beats): number with 1 underline (5̲) -> duration: 0.5
     * 16th note (0.25 beats): number with 2 underlines (5̳) -> duration: 0.25
     * 32nd note (0.125 beats): number with 3 underlines -> duration: 0.125
     * Triplet (0.333 beats): triplet bracket ┌ 3 ┐ -> duration: 0.333, isTriplet: true
   - "isDotted": true if dotted.
   - "tieToNext": true if there is a curved tie connecting to the NEXT note of the SAME pitch.
   - "slurToNext": true if there is a curved slur connecting to notes of different pitches (legato singing phrasing).
   - "preGraceNotes": Array of grace notes before the main note (前裝飾音): [{ "pitch": 6, "octave": 0, "accidental": "" }]
   - "postGraceNotes": Array of grace notes after the main note (後裝飾音).
   - "articulation": "none" | "staccato" | "tenuto" | "accent" | "fermata".

4. **Lyrics Alignment (Taiwanese Hokkien / Taigi)**:
   - For every note that has a sung lyric syllable:
     * "lyric": {
         "hanlo": "漢字或漢羅混合 (e.g., 獨, 夜, 無, 伴, 守, 燈, 下, 阮ê)",
         "poj": "Pe̍h-ōe-jī 白話字羅馬字含調符 (e.g., To̍k, iā, bô, phōaⁿ, siú, teng, ē, gún ê)"
       }
   - For rests (pitch 0) or notes tied from previous notes (continuation of sustained syllable), set lyric to {}.

Output strictly valid JSON matching this schema:
{
  "title": "望春風",
  "subtitle": "",
  "composer": "鄧雨賢",
  "lyricist": "李臨秋",
  "key": "F",
  "timeSignature": "4/4",
  "bpm": 80,
  "notesPerLine": 4,
  "measures": [
    {
      "measureNumber": 1,
      "chord": "F",
      "section": "前奏",
      "notes": [
        {
          "pitch": 5,
          "octave": 0,
          "accidental": "",
          "duration": 1,
          "isDotted": false,
          "tieToNext": false,
          "slurToNext": false,
          "lyric": {
            "hanlo": "獨",
            "poj": "To̍k"
          }
        }
      ]
    }
  ]
}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || options.files.length === 0) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  if (!options.apiKey) {
    console.error('Error: Gemini API key is missing. Set GEMINI_API_KEY env var or pass --api-key <key>.');
    process.exit(1);
  }

  console.log(`\n🎵 Converting ${options.files.length} input file(s)...`);
  for (const f of options.files) {
    if (!fs.existsSync(f)) {
      console.error(`Error: File not found: ${f}`);
      process.exit(1);
    }
  }

  const ai = new GoogleGenAI({ apiKey: options.apiKey });
  let hasPdf = false;

  const contentParts = options.files.map((filePath) => {
    const mimeType = getMimeType(filePath);
    if (mimeType === 'application/pdf') hasPdf = true;
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    return {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };
  });

  const promptText = buildTranscriptionPrompt(options.files.length, hasPdf, options.mode);
  contentParts.push({ text: promptText });

  console.log(`🤖 Invoking Gemini Vision model (${options.model})...`);

  let response;
  try {
    response = await ai.models.generateContent({
      model: options.model,
      contents: contentParts,
      config: {
        responseMimeType: 'application/json',
      },
    });
  } catch (err) {
    console.error('API Error:', err.message || err);
    process.exit(1);
  }

  const text = response.text || '{}';
  let rawJson;
  try {
    rawJson = JSON.parse(text);
  } catch (parseErr) {
    // Try to extract json block if wrapped in markdown
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      rawJson = JSON.parse(match[0]);
    } else {
      console.error('Failed to parse model output as JSON. Raw output:');
      console.error(text);
      process.exit(1);
    }
  }

  // Sanitize and normalize the Song structure
  const songId = `song-${Date.now()}`;
  const title = (rawJson.title || 'Untitled Song').trim();
  const subtitle = rawJson.subtitle || '';
  const composer = rawJson.composer || '';
  const lyricist = rawJson.lyricist || '';
  const key = normalizeKey(options.key || rawJson.key);
  const timeSignature = normalizeTimeSig(options.time || rawJson.timeSignature);
  const bpm = options.bpm || (typeof rawJson.bpm === 'number' && rawJson.bpm > 30 && rawJson.bpm < 300 ? rawJson.bpm : 80);
  const notesPerLine = rawJson.notesPerLine || 4;

  const expectedBeats = getExpectedBeats(timeSignature);
  const measures = [];
  let rhythmWarnings = 0;

  const rawMeasures = Array.isArray(rawJson.measures) ? rawJson.measures : [];

  rawMeasures.forEach((m, mIdx) => {
    const measureNumber = typeof m.measureNumber === 'number' ? m.measureNumber : mIdx + 1;
    const measureId = `m-${measureNumber}-${Date.now().toString(36)}-${mIdx}`;
    const chord = typeof m.chord === 'string' && m.chord.trim() ? m.chord.trim() : undefined;
    const section = typeof m.section === 'string' && m.section.trim() ? m.section.trim() : undefined;
    const barlineType = m.barlineType || undefined;
    const isLineBreak = Boolean(m.isLineBreak);

    const notes = [];
    const rawNotes = Array.isArray(m.notes) ? m.notes : [];

    rawNotes.forEach((n, nIdx) => {
      const noteId = `n-${measureNumber}-${nIdx + 1}-${Math.random().toString(36).substring(2, 6)}`;
      const pitch = normalizePitch(n.pitch);
      const octave = typeof n.octave === 'number' && [-2, -1, 0, 1, 2].includes(n.octave) ? n.octave : 0;
      const accidental = n.accidental === '#' || n.accidental === 'b' ? n.accidental : '';
      const duration = typeof n.duration === 'number' && n.duration >= 0 ? n.duration : 1;
      const isDotted = Boolean(n.isDotted);
      const isDoubleDotted = Boolean(n.isDoubleDotted);
      const tieToNext = Boolean(n.tieToNext || n.isTied);
      const slurToNext = Boolean(n.slurToNext);
      const isTriplet = Boolean(n.isTriplet);

      const rawLyric = n.lyric || {};
      const lyric = {
        hanlo: rawLyric.hanlo || rawLyric.hanji || rawLyric.custom || undefined,
        poj: rawLyric.poj || rawLyric.tl || undefined,
      };

      const note = {
        id: noteId,
        pitch,
        octave,
        accidental,
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
      };

      notes.push(note);
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

    // Check rhythm
    const measureBeats = notes.reduce((sum, n) => {
      if (n.pitch === 'empty' || n.duration <= 0) return sum;
      return sum + n.duration;
    }, 0);

    const diff = Math.abs(measureBeats - expectedBeats);
    if (diff > 0.05 && !section?.includes('前奏') && !section?.includes('Pickup')) {
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

  const finalSong = {
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
    description: `Converted from sheet music (${options.files.map(f => path.basename(f)).join(', ')}) using Gemini AI vision transcription.`,
  };

  const outputPath = options.output || `${title.replace(/[\\/:*?"<>| ]+/g, '_')}.taigi.json`;
  fs.writeFileSync(outputPath, JSON.stringify(finalSong, null, 2), 'utf-8');

  console.log(`\n✅ Conversion successful!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Title:          ${title} ${subtitle ? `(${subtitle})` : ''}`);
  console.log(`  Key / Time:     ${key} | ${timeSignature} | ${bpm} BPM`);
  console.log(`  Composer:       ${composer || 'N/A'}`);
  console.log(`  Lyricist:       ${lyricist || 'N/A'}`);
  console.log(`  Measures:       ${measures.length}`);
  console.log(`  Total Notes:    ${measures.reduce((acc, m) => acc + m.notes.length, 0)}`);
  if (rhythmWarnings > 0) {
    console.log(`  ⚠️  Rhythm alert:  ${rhythmWarnings} measure(s) differ from ${expectedBeats} beats.`);
    if (options.strict) {
      console.error(`\nStrict check failed due to rhythm discrepancies.`);
      process.exit(1);
    }
  } else {
    console.log(`  Rhythm check:   100% matched (${expectedBeats} beats/measure)`);
  }
  console.log(`  Saved to:       ${outputPath}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`To import into the app:`);
  console.log(`1. Open the app in your browser.`);
  console.log(`2. Click "Library / Import".`);
  console.log(`3. Go to the "Import" tab, click "Choose File" or paste the contents of ${outputPath}.`);
  console.log(`4. Enjoy playback, editing, rehearsal, and karaoke!\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
