#!/usr/bin/env node

/**
 * convert-sheet.mjs
 * 
 * Universal CLI and library for converting sheet music in diverse input formats:
 * - Text-based Numbered Musical Notation (簡譜) with lyrics (.txt, .md, .tab, .jianpu, .lrc)
 * - Standard MIDI Files (.mid, .midi)
 * - Scanned Sheet Music Images (.png, .jpg, .jpeg, .webp, .bmp, .gif)
 * - Multi-page PDF documents (.pdf)
 * - Raw text string (--text "...") or standard input pipe (-)
 * 
 * Produces 100% schema-compliant Song JSON ready for direct import into the Taigi Composer / Karaoke app.
 */

import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { parseMidiBuffer, midiToSongJson } from './midi-parser.mjs';
import { isStructuredAppText, parseStructuredTextScore, buildTextTranscriptionPrompt } from './text-parser.mjs';

const SUPPORTED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif']);
const SUPPORTED_TEXT_EXTS = new Set(['.txt', '.md', '.tab', '.jianpu', '.lrc']);
const SUPPORTED_MIDI_EXTS = new Set(['.mid', '.midi']);
const VALID_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const VALID_TIME_SIGS = ['4/4', '3/4', '2/4', '6/8'];

function printHelp() {
  console.log(`
🎵 Taigi Sheet Music & Score to Song JSON Converter 🎵

Converts musical scores and notations into the standardized JSON format qualified
for direct import into the Taigi Composer & Karaoke application.

Supported Input Types:
  1. Text-based Numbered Notation with Lyrics:
     - Structured app text format (deterministic, zero-cost, instant)
     - Freeform / informal text notation with lyrics (AI-powered)
  2. Standard MIDI Files (.mid, .midi)
     - Automatic note, tempo, meter, rests, and lyric extraction (deterministic)
  3. Sheet Music Images (.png, .jpg, .jpeg, .webp, .bmp, .gif)
     - Multimodal Gemini Vision transcription
  4. PDF Documents (.pdf)
     - Multi-page document score transcription

Usage:
  node convert-sheet.mjs <input(s)...> [options]
  cat score.txt | node convert-sheet.mjs - [options]

Arguments:
  <input(s)...>             One or more files (Text, MIDI, Images, PDF) or "-" for stdin

Options:
  --text, -t <string>       Direct text input with numbered notation & lyrics
  --output, -o <file>       Output JSON file path (default: <title>.taigi.json)
  --key, -k <key>           Override key signature (e.g. F, C, G, Bb, D, Eb)
  --time <time>             Override time signature (e.g. 4/4, 3/4, 2/4, 6/8)
  --bpm, -b <bpm>           Override BPM (e.g. 80, 92, 108)
  --title <title>           Override song title
  --auto-fix-rhythm         Automatically pad under-beat measures with rest notes
  --ai-enrich               Use Gemini AI to enrich lyrics with Pe̍h-ōe-jī (POJ) Romanization
  --model, -m <model>       Gemini model (default: gemini-2.5-flash)
  --api-key <key>           Gemini API key (defaults to GEMINI_API_KEY environment variable)
  --strict                  Exit with error if measure beats do not match time signature
  --help, -h                Show this help guide

Examples:
  # 1. Text-based numbered notation with lyrics:
  node convert-sheet.mjs song-score.txt -o my_song.taigi.json
  node convert-sheet.mjs --text "Title: 望春風\\nKey: F\\n[Measure 1]\\nNumbered Notation: 5 6 1 2\\n漢羅: 獨 夜 無 伴"

  # 2. Standard MIDI conversion:
  node convert-sheet.mjs song.mid --auto-fix-rhythm -o song.taigi.json
  node convert-sheet.mjs song.mid --ai-enrich -o song_with_poj.taigi.json

  # 3. Sheet music image & PDF transcription:
  node convert-sheet.mjs score.png --key F --time 4/4
  node convert-sheet.mjs page1.jpg page2.jpg -o full_song.taigi.json
  node convert-sheet.mjs booklet.pdf -o hymn.taigi.json
`);
}

function parseArgs(args) {
  const options = {
    inputs: [],
    directText: null,
    output: null,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    key: null,
    time: null,
    bpm: null,
    title: null,
    autoFixRhythm: false,
    aiEnrich: false,
    apiKey: process.env.GEMINI_API_KEY || null,
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
    } else if (arg === '--text' || arg === '-t') {
      options.directText = args[++i];
    } else if (arg === '--model' || arg === '-m') {
      options.model = args[++i];
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
    } else if (arg === '--ai-enrich') {
      options.aiEnrich = true;
    } else if (arg === '--api-key') {
      options.apiKey = args[++i];
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

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  throw new Error(`Unsupported visual file type: ${ext}`);
}

function buildVisionTranscriptionPrompt(fileCount, isPdf, options) {
  const sourceDescription = isPdf
    ? `The input is a PDF score document (${fileCount} file).`
    : `The user provided ${fileCount} sheet music image(s) in sequential reading order.`;

  return `You are a world-class music transcription AI and expert in Numbered Musical Notation (簡譜) and Taiwanese Hokkien songs (Taigi).
${sourceDescription}

Task: Carefully transcribe the sheet music into structured, valid JSON adhering strictly to the Taigi Song Schema.

Critical Transcription Rules:
1. **Metadata**:
   - "title": Song title (e.g., "望春風", "雨夜花", "思慕的人"). Look at the header of the sheet.
   ${options.title ? `- Use forced title: "${options.title}"` : ''}
   - "subtitle": Subtitle or alternative title if present.
   - "composer": Composer name (作曲).
   - "lyricist": Lyricist name (作詞).
   - "key": Key signature (e.g. "F", "C", "G", "Bb", "D", "Eb"). Look for "1 = F", "1 = C", etc. Defaults to "F" or "C" if not found.
   ${options.key ? `- Use forced key: "${options.key}"` : ''}
   - "timeSignature": Time signature (e.g. "4/4", "3/4", "2/4", "6/8"). Look for time signature at the beginning of the first system.
   ${options.time ? `- Use forced timeSignature: "${options.time}"` : ''}
   - "bpm": Tempo in beats per minute (e.g. 76, 80, 88, 96). Default to 80 if unspecified.
   ${options.bpm ? `- Use forced bpm: ${options.bpm}` : ''}

2. **Measures & Note Structure**:
   - Sequence measures chronologically from measure 1 to the end across all pages without omitting or duplicating.
   - "measureNumber": 1, 2, 3...
   - "chord": Harmonic chord symbol above the measure if present (e.g., "F", "C7", "Am", "Dm", "Bb", "G7").
   - "section": Optional section tag (e.g., "前奏", "主歌", "副歌", "尾奏", "Verse 1", "Chorus", "Intro", "Outro").
   - "barlineType": "single" (default), "double", "end", "repeat_start", "repeat_end".
   - "isLineBreak": true if this measure marks the end of a printed line/system or singing phrase.

3. **Numbered Notation Note Decoding**:
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
     * Whole note (4 beats): 5 - - - -> duration: 4
     * Dotted half note (3 beats): 5 - - -> duration: 3
     * Half note (2 beats): 5 - -> duration: 2
     * Dotted quarter note (1.5 beats): 5· -> duration: 1.5, isDotted: true
     * Quarter note (1 beat): 5 -> duration: 1
     * Dotted 8th note (0.75 beats): 5· with 1 underline -> duration: 0.75, isDotted: true
     * 8th note (0.5 beats): 5 with 1 underline -> duration: 0.5
     * 16th note (0.25 beats): 5 with 2 underlines -> duration: 0.25
   - "isDotted": true if dotted.
   - "tieToNext": true if curved tie connects to next note of same pitch.
   - "slurToNext": true if curved slur connects singing notes across different pitches.

4. **Lyrics Alignment (Taiwanese Hokkien / Taigi)**:
   - For every note that has a sung lyric syllable:
     "lyric": {
       "hanlo": "漢字或漢羅混合 (e.g., 獨, 夜, 無, 伴, 守, 燈, 下)",
       "poj": "Pe̍h-ōe-jī 白話字羅馬字含調符 (e.g., To̍k, iā, bô, phōaⁿ, siú, teng, ē)"
     }
   - For rests (pitch 0) or notes tied from previous notes, set lyric to {}.

5. **Karaoke Phrase Structuring**:
   - Organize measures into natural singing phrases (2 to 4 measures, 4 to 8 syllables per phrase).
   - Conclude each phrase by setting "isLineBreak": true on that measure.

Return ONLY the raw JSON object conforming to the schema.`;
}

/**
 * AI Lyric Enrichment: adds accurate Pe̍h-ōe-jī (POJ) to song notes with Taiwanese Han characters
 */
async function enrichSongLyricsWithAI(song, ai, modelName) {
  console.log(`🤖 Enriching lyrics with Pe̍h-ōe-jī (POJ) tone diacritics via Gemini (${modelName})...`);

  // Collect all syllables
  const syllables = [];
  song.measures.forEach((m, mIdx) => {
    m.notes.forEach((n, nIdx) => {
      const han = n.lyric?.hanlo || n.lyric?.hanji || n.lyric?.custom || '';
      if (han && han !== '—' && han !== '-' && n.pitch !== 0 && n.pitch !== 'empty') {
        syllables.push({ mIdx, nIdx, han });
      }
    });
  });

  if (syllables.length === 0) return song;

  const prompt = `You are an expert Taiwanese Hokkien (Taigi / 白話字) linguist.
The following is an ordered list of Han / Hanlo lyrics from a Taiwanese song ("${song.title}"):
${JSON.stringify(syllables.map(s => s.han))}

Provide the exact corresponding Pe̍h-ōe-jī (POJ) Romanization with official tone marks (á, à, â, ā, a̍, etc.) for each syllable.
Return a JSON array of strings of equal length:
Example: ["To̍k", "iā", "bô", "phōaⁿ", "siú", "teng", "ē"]
Return ONLY the JSON array.`;

  try {
    const res = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    const pojList = JSON.parse(res.text || '[]');
    if (Array.isArray(pojList)) {
      syllables.forEach((s, idx) => {
        if (pojList[idx]) {
          const m = song.measures[s.mIdx];
          if (m && m.notes[s.nIdx]) {
            m.notes[s.nIdx].lyric.poj = pojList[idx];
          }
        }
      });
      console.log(`✨ Successfully enriched ${syllables.length} lyric syllables with POJ.`);
    }
  } catch (err) {
    console.warn('⚠️  Could not complete AI lyric enrichment:', err.message || err);
  }

  return song;
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

  // 1. Direct text passed via --text / -t
  if (options.directText) {
    const text = options.directText;
    if (isStructuredAppText(text)) {
      console.log('📝 Detected structured app score text format. Parsing deterministically...');
      rawSong = parseStructuredTextScore(text, options);
    } else {
      console.log('📝 Detected freeform text numbered notation. Transcribing with Gemini...');
      if (!options.apiKey) {
        console.error('Error: Gemini API key required for freeform text transcription. Set GEMINI_API_KEY.');
        process.exit(1);
      }
      const ai = new GoogleGenAI({ apiKey: options.apiKey });
      const prompt = buildTextTranscriptionPrompt(text, options);
      const res = await ai.models.generateContent({
        model: options.model,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      rawSong = JSON.parse(res.text || '{}');
    }
  }

  // 2. Standard input pipe ("-")
  else if (options.inputs.length === 1 && options.inputs[0] === '-') {
    console.log('📥 Reading score from standard input (stdin)...');
    const text = fs.readFileSync(0, 'utf-8');
    if (isStructuredAppText(text)) {
      console.log('📝 Detected structured app score text format. Parsing deterministically...');
      rawSong = parseStructuredTextScore(text, options);
    } else {
      console.log('📝 Detected freeform text numbered notation. Transcribing with Gemini...');
      if (!options.apiKey) {
        console.error('Error: Gemini API key required for freeform text transcription. Set GEMINI_API_KEY.');
        process.exit(1);
      }
      const ai = new GoogleGenAI({ apiKey: options.apiKey });
      const prompt = buildTextTranscriptionPrompt(text, options);
      const res = await ai.models.generateContent({
        model: options.model,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      rawSong = JSON.parse(res.text || '{}');
    }
  }

  // 3. File inputs
  else if (options.inputs.length > 0) {
    const firstInput = options.inputs[0];
    const ext = path.extname(firstInput).toLowerCase();

    // Verify all files exist
    for (const f of options.inputs) {
      if (!fs.existsSync(f)) {
        console.error(`Error: File not found: ${f}`);
        process.exit(1);
      }
    }

    // A. Text file input
    if (SUPPORTED_TEXT_EXTS.has(ext)) {
      console.log(`📄 Reading text score from: ${firstInput}`);
      const text = fs.readFileSync(firstInput, 'utf-8');
      if (isStructuredAppText(text)) {
        console.log('📝 Parsing structured notation deterministically...');
        rawSong = parseStructuredTextScore(text, options);
      } else {
        console.log(`🤖 Freeform notation detected. Invoking Gemini model (${options.model})...`);
        if (!options.apiKey) {
          console.error('Error: Gemini API key required for freeform text transcription. Set GEMINI_API_KEY.');
          process.exit(1);
        }
        const ai = new GoogleGenAI({ apiKey: options.apiKey });
        const prompt = buildTextTranscriptionPrompt(text, options);
        const res = await ai.models.generateContent({
          model: options.model,
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
        rawSong = JSON.parse(res.text || '{}');
      }
    }

    // B. MIDI file input
    else if (SUPPORTED_MIDI_EXTS.has(ext)) {
      console.log(`🎹 Parsing Standard MIDI file: ${firstInput}`);
      const buf = fs.readFileSync(firstInput);
      const midiData = parseMidiBuffer(buf);
      rawSong = midiToSongJson(midiData, options);
      console.log(`✨ Successfully extracted ${rawSong.measures.length} measures from MIDI!`);
    }

    // C. Images or PDF
    else if (SUPPORTED_IMAGE_EXTS.has(ext) || ext === '.pdf') {
      if (!options.apiKey) {
        console.error('Error: Gemini API key required for vision transcription. Set GEMINI_API_KEY or pass --api-key <key>.');
        process.exit(1);
      }

      console.log(`\n🎵 Transcribing ${options.inputs.length} visual score file(s)...`);
      const ai = new GoogleGenAI({ apiKey: options.apiKey });
      let hasPdf = false;

      const contentParts = options.inputs.map(filePath => {
        const mimeType = getMimeType(filePath);
        if (mimeType === 'application/pdf') hasPdf = true;
        const fileBuffer = fs.readFileSync(filePath);
        return {
          inlineData: {
            data: fileBuffer.toString('base64'),
            mimeType,
          },
        };
      });

      const promptText = buildVisionTranscriptionPrompt(options.inputs.length, hasPdf, options);
      contentParts.push({ text: promptText });

      console.log(`🤖 Invoking Gemini Vision model (${options.model})...`);
      const response = await ai.models.generateContent({
        model: options.model,
        contents: contentParts,
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text || '{}';
      try {
        rawSong = JSON.parse(text);
      } catch (parseErr) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          rawSong = JSON.parse(match[0]);
        } else {
          console.error('Failed to parse model output as JSON:', text);
          process.exit(1);
        }
      }
    }

    else {
      console.error(`Error: Unsupported file type: "${ext}". Supported: Text (.txt, .md), MIDI (.mid), Images (.png, .jpg), PDF (.pdf).`);
      process.exit(1);
    }
  }

  if (!rawSong) {
    console.error('Error: No song data produced.');
    process.exit(1);
  }

  // Optional AI Lyric Enrichment
  if (options.aiEnrich && options.apiKey) {
    const ai = new GoogleGenAI({ apiKey: options.apiKey });
    rawSong = await enrichSongLyricsWithAI(rawSong, ai, options.model);
  }

  // Sanitize and normalize
  const { song, rhythmWarnings, autoFixedMeasures, expectedBeats } = sanitizeAndFormatSong(rawSong, options);

  const cleanTitle = song.title.replace(/[\\/:*?"<>| ]+/g, '_');
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
