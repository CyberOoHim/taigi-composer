import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { JianpuNote, KeySignature, LyricSyllable, NoteDuration, PitchNumber, Song, TimeSignature } from '@/types/song';
import { normalizeNoteDuration, normalizeSongDurations } from '@/lib/taigiUtils';
import {
  buildThinkingConfig,
  callGenerateContentSafe,
  capParsedScore,
  getServerGeminiApiKey,
  MAX_LYRIC_LINES,
  parseModel,
  parseModelJson,
  parseThinking,
  publicAiError,
  rateLimitResponse,
  requireGeminiSession,
  validateScanImages,
} from '@/lib/geminiServerAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function normalizeKeySignature(keyStr?: string): KeySignature {
  if (!keyStr) return 'F';
  const clean = keyStr.replace(/^1\s*=\s*/i, '').trim().toUpperCase();
  const validKeys: KeySignature[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const match = validKeys.find((k) => k.toUpperCase() === clean);
  if (match) return match;
  if (clean === 'C#') return 'Db';
  if (clean === 'D#') return 'Eb';
  if (clean === 'G#') return 'Ab';
  if (clean === 'A#') return 'Bb';
  if (clean === 'GB') return 'F#';
  return 'F';
}

function normalizeTimeSignature(timeStr?: string): TimeSignature {
  if (!timeStr) return '4/4';
  const clean = timeStr.trim();
  if (clean === '2/4' || clean === '3/4' || clean === '4/4' || clean === '6/8') {
    return clean;
  }
  return '4/4';
}

function normalizePitch(p: unknown): PitchNumber {
  if (p === 'empty' || p === 'space') return 'empty';
  const num = Number(p);
  if (!isNaN(num) && num >= 0 && num <= 7) {
    return Math.floor(num) as PitchNumber;
  }
  return 1;
}

export async function POST(req: Request) {
  try {
    const limited = rateLimitResponse(req, 'generate');
    if (limited) return limited;

    const unauthorized = requireGeminiSession(req);
    if (unauthorized) return unauthorized;

    const apiKey = getServerGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API is not configured.' }, { status: 503 });
    }

    const body = await req.json();
    const { images, mode = 'full_score' } = body;
    const model = parseModel(body.model);
    const thinkingEffort = parseThinking(body.thinkingEffort);

    const imageError = validateScanImages(images);
    if (imageError) return imageError;

    const ai = new GoogleGenAI({ apiKey });

    const imageParts = images.map((img: { data: string; mimeType?: string }) => ({
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
3. For each syllable, transcribe strictly two fields:
   - "hanlo": 漢羅 (Traditional Chinese Hanji character or Han-lô mixed representation, e.g. "望", "春", "風", "阮ê")
   - "poj": 羅馬字 / Pe̍h-ōe-jī with accurate tone diacritics (e.g. "Bāng", "Chhun", "hong")
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
        { "hanlo": "獨", "poj": "To̍k" },
        { "hanlo": "夜", "poj": "iā" }
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
   - "key": Key signature (e.g., "F", "C", "G", "Bb", "D", "Eb", "Ab", "A", "E", "Db", "B"). Look for 1=F or 1=C, etc.
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
     * "octave": 0 (middle octave), 1 (high), 2 (two dots), -1 (low), -2 (two dots below).
     * "accidental": "" (natural), "#" (sharp), "b" (flat).
     * "duration": Note duration in beats (0 for punctuation/spacers, 4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25, 0.125).
     * "isDotted": boolean
     * "isTied": boolean
     ${
       includeLyrics
         ? `* "lyric": Aligned Taiwanese lyric syllable for this note:
       - "hanlo": 漢羅 (Traditional Hanji or Han-lô mixed representation, e.g. "獨")
       - "poj": 羅馬字 (Pe̍h-ōe-jī with tone marks, e.g. "To̍k")`
         : `* "lyric": {}`
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
          "lyric": { "hanlo": "獨", "poj": "To̍k" }
        }
      ]
    }
  ]
}`;
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

    const parsed = parseModelJson(response.text || '{}') as Record<string, unknown>;
    const scoreCapError = capParsedScore(parsed);
    if (scoreCapError) return scoreCapError;

    if (mode === 'lyrics_only') {
      const versesResult: LyricSyllable[][] = [];
      if (Array.isArray(parsed.verses)) {
        if (parsed.verses.length > MAX_LYRIC_LINES) {
          return NextResponse.json(
            { success: false, error: 'Transcribed lyrics exceeded the line limit.' },
            { status: 400 }
          );
        }
        for (const v of parsed.verses) {
          if (v && typeof v === 'object' && Array.isArray((v as { syllables?: unknown }).syllables)) {
            versesResult.push((v as { syllables: LyricSyllable[] }).syllables);
          }
        }
      }
      return NextResponse.json({
        success: true,
        rawLyricsText: typeof parsed.rawLyricsText === 'string' ? parsed.rawLyricsText : '',
        lyricsVerses: versesResult,
      });
    }

    // Full score / score only
    const songId = `song-ai-${Date.now()}`;
    const title = typeof parsed.title === 'string' ? parsed.title : 'AI 圖片辨識樂譜';
    const key = normalizeKeySignature(typeof parsed.key === 'string' ? parsed.key : undefined);
    const timeSignature = normalizeTimeSignature(
      typeof parsed.timeSignature === 'string' ? parsed.timeSignature : undefined
    );
    const bpm = typeof parsed.bpm === 'number' && parsed.bpm > 30 && parsed.bpm < 300 ? parsed.bpm : 80;

    const measures: Song['measures'] = [];

    if (Array.isArray(parsed.measures) && parsed.measures.length > 0) {
      (parsed.measures as Record<string, unknown>[]).forEach((m, mIdx) => {
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
            poj: typeof rawLyric.poj === 'string' ? rawLyric.poj : typeof rawLyric.tl === 'string' ? rawLyric.tl : undefined,
            hanlo: typeof rawLyric.hanlo === 'string' ? rawLyric.hanlo : typeof rawLyric.hanji === 'string' ? rawLyric.hanji : typeof rawLyric.custom === 'string' ? rawLyric.custom : undefined,
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
      return NextResponse.json({
        success: false,
        error: '無法從圖片中解析出有效樂譜小節，請確認圖片清晰度與樂譜方向。',
      }, { status: 400 });
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

    return NextResponse.json({
      success: true,
      song: constructedSong,
    });
  } catch (err: unknown) {
    console.error('[scan-score]', err);
    return NextResponse.json({
      success: false,
      error: publicAiError(),
    }, { status: 500 });
  }
}
