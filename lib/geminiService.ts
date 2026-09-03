import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { JianpuNote, KeySignature, LyricSyllable, NoteDuration, PitchNumber, Song, TimeSignature } from '@/types/song';
import { normalizeNoteDuration, normalizeSongDurations, splitTaigiLyricSyllables } from './taigiUtils';
import { getActiveGeminiApiKey } from './geminiAuth';

export type GeminiModelChoice = 'gemini-3.7-flash' | 'gemini-3.7-flash-lite';
export type GeminiThinkingEffort = 'HIGH' | 'MEDIUM' | 'LOW' | 'OFF' | 'AUTO';

export const DEFAULT_GEMINI_MODEL: GeminiModelChoice = 'gemini-3.7-flash';

export interface GeminiAiOptions {
  model?: GeminiModelChoice | string;
  thinkingEffort?: GeminiThinkingEffort;
}

export interface ScoreImageInput {
  data: string;     // base64 data (with or without data:image/xxx;base64, prefix)
  mimeType: string; // image/jpeg, image/png, etc.
  name?: string;
}

export type AiScoreExtractionMode = 'full_score' | 'score_only' | 'lyrics_only';

export interface AiScoreExtractionResult {
  success: boolean;
  song?: Song;
  lyricsVerses?: LyricSyllable[][];
  rawLyricsText?: string;
  warnings?: string[];
  error?: string;
}

/**
 * Builds appropriate thinking configuration based on the target model and effort level.
 * Both gemini-3.7-flash and gemini-3.7-flash-lite share the same thinkingConfig capabilities.
 */
export function buildThinkingConfig(
  model?: string,
  effort?: GeminiThinkingEffort
): { thinkingBudget?: number; thinkingLevel?: ThinkingLevel } | undefined {
  if (effort === 'OFF') {
    return { thinkingBudget: 0 };
  }

  switch (effort) {
    case 'HIGH':
      return {
        thinkingBudget: 8192,
        thinkingLevel: ThinkingLevel.HIGH,
      };
    case 'LOW':
      return {
        thinkingBudget: 1024,
        thinkingLevel: ThinkingLevel.LOW,
      };
    case 'AUTO':
      return {
        thinkingBudget: -1,
      };
    case 'MEDIUM':
    default:
      return {
        thinkingBudget: 2048,
        thinkingLevel: ThinkingLevel.MEDIUM,
      };
  }
}

/**
 * Executes generateContent with automatic retry fallback if thinkingConfig is rejected by the endpoint.
 */
async function callGenerateContentSafe(
  ai: GoogleGenAI,
  params: Parameters<typeof ai.models.generateContent>[0]
) {
  try {
    return await ai.models.generateContent(params);
  } catch (error: unknown) {
    const errorStr = String(error);
    if (
      params.config?.thinkingConfig &&
      (errorStr.toLowerCase().includes('thinking') ||
        errorStr.toLowerCase().includes('budget') ||
        errorStr.toLowerCase().includes('unsupported') ||
        errorStr.toLowerCase().includes('invalid argument'))
    ) {
      console.warn('Retrying Gemini generateContent without thinkingConfig due to:', errorStr);
      const fallbackConfig = { ...params.config };
      delete fallbackConfig.thinkingConfig;
      return await ai.models.generateContent({
        ...params,
        config: fallbackConfig,
      });
    }
    throw error;
  }
}

export async function convertTaigiLyricsByVersesWithAi(
  lines: string[],
  userApiKey?: string,
  options?: GeminiAiOptions
): Promise<LyricSyllable[][]> {
  const apiKey =
    userApiKey ||
    getActiveGeminiApiKey() ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : undefined);
  const model = options?.model || DEFAULT_GEMINI_MODEL;
  const thinkingEffort = options?.thinkingEffort || 'MEDIUM';

  if (!apiKey || lines.length === 0) {
    return lines.map((line) => {
      const rawSyllables = splitTaigiLyricSyllables(line);
      return rawSyllables.map((s) => ({
        hanji: s,
        poj: s,
        pij: s,
        custom: s,
      }));
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const formattedLines = lines.map((l, i) => `Line ${i + 1}: ${l}`).join('\n');
    const prompt = `You are an expert Taiwanese Hokkien (Taigi / 臺灣話) linguist and music lyricist.
The user provided the following Taigi lyrics structured line-by-line (each line represents a musical phrase/verse):
${formattedLines}

Task:
1. For each line, break down into an array of syllables aligned one-by-one.
2. For each syllable, output:
   - "hanji": The Han character (if applicable, or matching Hanji)
   - "poj": Pe̍h-ōe-jī (白話字) with correct tone diacritics (á, à, â, ā, a̍, a̋, o͘, ⁿ, etc.)
   - "pij": Tâi-lô (臺灣閩南語羅馬字拼音方案) with correct tone marks (á, à, â, ā, a̍, a̋, oo, nn, etc.)
   - "custom": Han-lô mixed representation

Return strictly valid JSON in the following schema:
{
  "verses": [
    {
      "lineIndex": 0,
      "syllables": [
        { "hanji": "望", "poj": "Bāng", "pij": "Bāng", "custom": "望" },
        { "hanji": "春", "poj": "Chhun", "pij": "Tshun", "custom": "春" },
        { "hanji": "風", "poj": "hong", "pij": "hong", "custom": "風" }
      ]
    }
  ]
}`;

    const thinkingConfig = buildThinkingConfig(model, thinkingEffort);

    const response = await callGenerateContentSafe(ai, {
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.verses && Array.isArray(parsed.verses)) {
      const result: LyricSyllable[][] = [];
      for (let i = 0; i < lines.length; i++) {
        const found = parsed.verses.find((v: { lineIndex?: number }) => v.lineIndex === i) || parsed.verses[i];
        if (found && Array.isArray(found.syllables)) {
          result.push(found.syllables);
        } else {
          const rawSyllables = splitTaigiLyricSyllables(lines[i]);
          result.push(rawSyllables.map((s) => ({ hanji: s, poj: s, pij: s, custom: s })));
        }
      }
      return result;
    }
  } catch (error) {
    console.warn('AI verse conversion failed, using fallback tokenizer:', error);
  }

  return lines.map((line) => {
    const rawSyllables = splitTaigiLyricSyllables(line);
    return rawSyllables.map((s) => ({
      hanji: s,
      poj: s,
      pij: s,
      custom: s,
    }));
  });
}

export async function convertTaigiLyricsWithAi(
  text: string,
  userApiKey?: string,
  options?: GeminiAiOptions
): Promise<LyricSyllable[]> {
  const apiKey =
    userApiKey ||
    getActiveGeminiApiKey() ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : undefined);
  const model = options?.model || DEFAULT_GEMINI_MODEL;
  const thinkingEffort = options?.thinkingEffort || 'MEDIUM';

  if (!apiKey) {
    // Fall back to rule-based tokenizer when no API key is present
    const rawSyllables = splitTaigiLyricSyllables(text);
    return rawSyllables.map((s) => ({
      hanji: s,
      poj: s,
      pij: s,
      custom: s,
    }));
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an expert Taiwanese Hokkien (Taigi / 臺灣話) linguist and music lyricist.
The user provided the following Taigi lyrics (which may be Hanji, POJ, TL, or Han-lô mixed):
"${text}"

Task:
1. Break down into an array of syllables aligned one-by-one.
2. For each syllable, output:
   - "hanji": The Han character (if applicable, or matching Hanji)
   - "poj": Pe̍h-ōe-jī (白話字) with correct tone diacritics (á, à, â, ā, a̍, a̋, o͘, ⁿ, etc.)
   - "pij": Tâi-lô (臺灣閩南語羅馬字拼音方案) with correct tone marks (á, à, â, ā, a̍, a̋, o͘, ⁿ, etc.)
   - "custom": Han-lô mixed representation

Return strictly valid JSON in the following schema:
{
  "syllables": [
    { "hanji": "望", "poj": "Bāng", "pij": "Bāng", "custom": "望" },
    { "hanji": "春", "poj": "Chhun", "pij": "Tshun", "custom": "春" },
    { "hanji": "風", "poj": "hong", "pij": "hong", "custom": "風" }
  ]
}
`;

    const thinkingConfig = buildThinkingConfig(model, thinkingEffort);

    const response = await callGenerateContentSafe(ai, {
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.syllables && Array.isArray(parsed.syllables)) {
      return parsed.syllables;
    }
  } catch (error) {
    console.warn('AI conversion failed, using fallback tokenizer:', error);
  }

  const rawSyllables = splitTaigiLyricSyllables(text);
  return rawSyllables.map((s) => ({
    hanji: s,
    poj: s,
    pij: s,
    custom: s,
  }));
}

/**
 * Normalizes key signature string to valid KeySignature
 */
function normalizeKeySignature(keyStr?: string): KeySignature {
  if (!keyStr) return 'F';
  const clean = keyStr.replace(/^1\s*=\s*/i, '').trim().toUpperCase();
  const validKeys: KeySignature[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const match = validKeys.find((k) => k.toUpperCase() === clean);
  if (match) return match;
  // Handle aliases like C#, D#, G#, A#
  if (clean === 'C#') return 'Db';
  if (clean === 'D#') return 'Eb';
  if (clean === 'G#') return 'Ab';
  if (clean === 'A#') return 'Bb';
  if (clean === 'GB') return 'F#';
  return 'F'; // Default to F for Taiwanese songs
}

/**
 * Normalizes time signature string to valid TimeSignature
 */
function normalizeTimeSignature(timeStr?: string): TimeSignature {
  if (!timeStr) return '4/4';
  const clean = timeStr.trim();
  if (clean === '2/4' || clean === '3/4' || clean === '4/4' || clean === '6/8') {
    return clean;
  }
  return '4/4';
}

/**
 * Normalizes pitch number to valid PitchNumber
 */
function normalizePitch(p: unknown): PitchNumber {
  if (p === 'empty' || p === 'space') return 'empty';
  const num = Number(p);
  if (!isNaN(num) && num >= 0 && num <= 7) {
    return Math.floor(num) as PitchNumber;
  }
  return 1;
}

/**
 * Multimodal AI Score & Lyric Recognition from 1 to 3 images.
 */
export async function extractScoreFromImagesWithAi(
  images: ScoreImageInput[],
  mode: AiScoreExtractionMode = 'full_score',
  userApiKey?: string,
  options?: GeminiAiOptions
): Promise<AiScoreExtractionResult> {
  const apiKey =
    userApiKey ||
    getActiveGeminiApiKey() ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : undefined);
  const model = options?.model || DEFAULT_GEMINI_MODEL;
  const thinkingEffort = options?.thinkingEffort || 'HIGH';

  if (!apiKey) {
    return {
      success: false,
      error: '請先輸入並驗證 Gemini 通行密碼或提供 API Key (Gemini API key is required)',
    };
  }

  if (!images || images.length === 0) {
    return {
      success: false,
      error: '未提供樂譜圖片 (No images provided)',
    };
  }

  if (images.length > 3) {
    return {
      success: false,
      error: '最多支援 3 頁圖片 (Maximum 3 pages supported)',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Build multimodal contents with clean base64 image data
    const imageParts = images.map((img) => ({
      inlineData: {
        data: img.data.replace(/^data:[^;]+;base64,/, '').trim(),
        mimeType: img.mimeType || 'image/jpeg',
      },
    }));

    const pageCountNote =
      images.length === 1
        ? 'The user uploaded 1 page of sheet music / lyrics.'
        : `The user uploaded ${images.length} pages of sheet music / lyrics in sequential order (Page 1 -> Page ${images.length}). Read through all pages consecutively and stitch measures in chronological sequence without repeating or skipping.`;

    let systemInstruction = '';
    if (mode === 'lyrics_only') {
      systemInstruction = `You are a master Taiwanese Hokkien (Taigi / 臺灣話) music transcriber and linguist.
${pageCountNote}

Task: Extract all Taiwanese song lyrics from the provided image(s).
1. Read all lyrics lines/verses in order.
2. For each line, break it down into syllables aligned one-by-one.
3. For each syllable, transcribe:
   - "hanji": Traditional Chinese Hanji character (e.g. "望", "春", "風")
   - "poj": Pe̍h-ōe-jī with accurate tone diacritics (e.g. "Bāng", "Chhun", "hong")
   - "pij": Tâi-lô (臺灣閩南語羅馬字) with accurate tone marks (e.g. "Bāng", "Tshun", "hong")
   - "custom": Han-lô mixed representation or punctuation
4. Extract title, composer, lyricist if visible.

Output strictly valid JSON matching this schema:
{
  "title": "望春風",
  "composer": "鄧雨賢",
  "lyricist": "李臨秋",
  "rawLyricsText": "獨夜無伴守燈下 清風對面吹...",
  "verses": [
    {
      "lineIndex": 0,
      "syllables": [
        { "hanji": "獨", "poj": "To̍k", "pij": "To̍k", "custom": "獨" },
        { "hanji": "夜", "poj": "iā", "pij": "iā", "custom": "夜" }
      ]
    }
  ]
}`;
    } else {
      const includeLyrics = mode === 'full_score';
      systemInstruction = `You are a world-class music transcription AI specializing in numbered notation (Numbered Notation 簡譜) and Taiwanese Hokkien songs (Taigi).
${pageCountNote}

Task: Transcribe the sheet music from the image(s) measure-by-measure into structured Numbered Notation notation.

Rules for Numbered Notation & Taiwanese Music Transcription:
1. **Metadata**:
   - "title": Song title (e.g., "望春風", "雨夜花", "家後")
   - "key": Key signature (e.g., "F", "C", "G", "Bb", "D", "Eb", "Ab", "A", "E", "Db", "B"). Look for $1=F$ or $1=C$, etc.
   - "timeSignature": Time signature (e.g., "4/4", "3/4", "2/4", "6/8"). Default to 4/4 or 2/4 as indicated.
   - "bpm": Tempo in BPM (e.g., 76, 80, 88, 96, 108). Default 80 if not specified.
   - "composer": Composer name if indicated.
   - "lyricist": Lyricist name if indicated.

2. **Measures & Notes**:
   - Sequence measures chronologically from measure 1 to the end across all ${images.length} pages.
   - "measureNumber": 1, 2, 3...
   - "chord": Harmonic chord symbol above the measure if present (e.g., "F", "C7", "Am", "Dm", "Gm", "Bb", "C", "G").
   - "section": Optional section tag (e.g., "前奏", "主歌", "副歌", "尾奏", "Verse 1", "Chorus") if visible.
   - "notes": Array of notes in the measure. For each note:
     * "pitch": 1, 2, 3, 4, 5, 6, 7 (scale degrees), 0 (rest), or 'empty' (blank space / pause / punctuation / newline).
     * "octave": 0 (middle octave), 1 (one dot above: high pitch), 2 (two dots above), -1 (one dot below: low pitch), -2 (two dots below).
     * "accidental": "" (natural), "#" (sharp), "b" (flat).
     * "duration": Note duration in beats:
       - 0 = non-notation items (punctuation like ，。！？, breath marks V, annotations, line breaks \n). These non-singing spacer items MUST have "pitch": "empty" and "duration": 0 so that no time duration is activated.
       - 4 = whole note (e.g. 5 - - - )
       - 3 = dotted half note (e.g. 5 - - )
       - 2 = half note (e.g. 5 - )
       - 1.5 = dotted quarter note (e.g. 5. )
       - 1 = quarter note (e.g. 5 )
       - 0.75 = dotted eighth note
       - 0.5 = eighth note (one underline below, e.g. 5̲ )
       - 0.25 = sixteenth note (two underlines below, e.g. 5̳ )
       - 0.125 = thirty-second note
     * "isDotted": boolean (true if note has a duration dot)
     * "isTied": boolean (true if tied or slurred into the next note)
     ${
       includeLyrics
         ? `* "lyric": Aligned Taiwanese lyric syllable for this note:
       - "hanji": Chinese Han character (e.g. "望")
       - "poj": Pe̍h-ōe-jī with tone marks (e.g. "Bāng")
       - "pij": Tâi-lô with tone marks (e.g. "Bāng")
       - "custom": Han-lô mixed representation (e.g. "望")
       If a note is an extension / melisma / tie on the same word, you can leave lyric empty {} or use "~" / "—".`
         : `* "lyric": {} (Empty object since score-only mode was selected).`
     }

Return strictly valid JSON matching this schema:
{
  "title": "望春風",
  "key": "F",
  "timeSignature": "4/4",
  "bpm": 80,
  "composer": "鄧雨賢",
  "lyricist": "李臨秋",
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
          "isTied": false,
          "lyric": { "hanji": "獨", "poj": "To̍k", "pij": "To̍k", "custom": "獨" }
        }
      ]
    }
  ]
}
`;
    }

    const thinkingConfig = buildThinkingConfig(model, thinkingEffort);

    const response = await callGenerateContentSafe(ai, {
      model,
      contents: [
        ...imageParts,
        {
          text: systemInstruction,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    });

    const rawText = response.text || '{}';
    const cleanJsonText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleanJsonText);

    if (mode === 'lyrics_only') {
      const versesResult: LyricSyllable[][] = [];
      if (parsed.verses && Array.isArray(parsed.verses)) {
        for (const v of parsed.verses) {
          if (Array.isArray(v.syllables)) {
            versesResult.push(v.syllables);
          }
        }
      }
      return {
        success: true,
        rawLyricsText: parsed.rawLyricsText || '',
        lyricsVerses: versesResult,
      };
    }

    // Process Full Score or Score Only
    const songId = `song-ai-${Date.now()}`;
    const title = parsed.title || 'AI 圖片辨識樂譜';
    const key = normalizeKeySignature(parsed.key);
    const timeSignature = normalizeTimeSignature(parsed.timeSignature);
    const bpm = typeof parsed.bpm === 'number' && parsed.bpm > 30 && parsed.bpm < 300 ? parsed.bpm : 80;

    const measures: Song['measures'] = [];
    const warnings: string[] = [];

    if (Array.isArray(parsed.measures) && parsed.measures.length > 0) {
      parsed.measures.forEach((m: Record<string, unknown>, mIdx: number) => {
        const measureNum = typeof m.measureNumber === 'number' ? m.measureNumber : mIdx + 1;
        const measureId = `m-${measureNum}-${Date.now().toString(36)}-${mIdx}`;
        const chord = typeof m.chord === 'string' ? m.chord.trim() : undefined;
        const section = typeof m.section === 'string' ? m.section.trim() : undefined;

        const rawNotes = Array.isArray(m.notes) ? m.notes : [];
        const notes: Song['measures'][0]['notes'] = [];

        rawNotes.forEach((n: Record<string, unknown>, nIdx: number) => {
          const noteId = `n-${measureNum}-${nIdx + 1}-${Math.random().toString(36).substring(2, 6)}`;
          const pitch = normalizePitch(n.pitch);
          const octave = typeof n.octave === 'number' && [-2, -1, 0, 1, 2].includes(n.octave) ? n.octave : 0;
          const accidental = n.accidental === '#' || n.accidental === 'b' ? n.accidental : '';
          const duration = typeof n.duration === 'number' && n.duration >= 0 ? (n.duration as NoteDuration) : 1;
          const isDotted = Boolean(n.isDotted);
          const isTied = Boolean(n.isTied);

          const rawLyric = (n.lyric as Record<string, string>) || {};
          const lyric: LyricSyllable = {
            hanji: typeof rawLyric.hanji === 'string' ? rawLyric.hanji : undefined,
            poj: typeof rawLyric.poj === 'string' ? rawLyric.poj : undefined,
            pij: typeof rawLyric.pij === 'string' ? rawLyric.pij : undefined,
            custom: typeof rawLyric.custom === 'string' ? rawLyric.custom : undefined,
          };

          const rawNote: JianpuNote = {
            id: noteId,
            pitch,
            octave,
            accidental,
            duration,
            isDotted,
            isTied,
            lyric,
            annotation: typeof n.annotation === 'string' ? n.annotation : undefined,
          };

          notes.push(normalizeNoteDuration(rawNote));
        });

        // Ensure measure has at least 1 note
        if (notes.length === 0) {
          notes.push({
            id: `n-${measureNum}-1-def`,
            pitch: 0,
            octave: 0,
            duration: timeSignature === '3/4' ? 3 : timeSignature === '2/4' ? 2 : 4,
            lyric: {},
          });
        }

        measures.push({
          id: measureId,
          measureNumber: measureNum,
          chord: chord || undefined,
          section: section || undefined,
          notes,
        });
      });
    }

    if (measures.length === 0) {
      return {
        success: false,
        error: '無法從圖片中解析出有效樂譜小節，請確認圖片清晰度與樂譜方向。',
      };
    }

    const constructedSong: Song = normalizeSongDurations({
      id: songId,
      title,
      composer: typeof parsed.composer === 'string' ? parsed.composer : undefined,
      lyricist: typeof parsed.lyricist === 'string' ? parsed.lyricist : undefined,
      key,
      timeSignature,
      bpm,
      measures,
      notesPerLine: 4,
      description: `透過 Gemini AI 多模態識譜自 ${images.length} 頁樂譜圖片自動轉錄`,
    });

    return {
      success: true,
      song: constructedSong,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('extractScoreFromImagesWithAi error:', err);
    return {
      success: false,
      error: `AI 圖片識譜失敗: ${errorMsg}`,
    };
  }
}
