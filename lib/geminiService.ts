import { LyricSyllable, Song } from '@/types/song';
import { splitTaigiLyricSyllables } from './taigiUtils';
import { revokeGeminiAuth } from './geminiAuth';

export type GeminiModelChoice = 'gemini-3.7-flash' | 'gemini-3.7-flash-lite';
export type GeminiThinkingEffort = 'HIGH' | 'MEDIUM' | 'LOW' | 'OFF' | 'AUTO';

export const DEFAULT_GEMINI_MODEL: GeminiModelChoice = 'gemini-3.7-flash';

export interface GeminiAiOptions {
  model?: GeminiModelChoice | string;
  thinkingEffort?: GeminiThinkingEffort;
}

export interface ScoreImageInput {
  data: string;
  mimeType: string;
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

function fallbackVerse(line: string): LyricSyllable[] {
  return splitTaigiLyricSyllables(line).map((s) => ({
    hanlo: s,
    poj: s,
  }));
}

function handleAuthFailure(status: number): boolean {
  if (status === 401) {
    revokeGeminiAuth();
    return true;
  }
  return false;
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === 'string' && data.error.length < 200) {
      return data.error;
    }
  } catch {
    // ignore unreadable error bodies
  }
  return fallback;
}

export async function convertTaigiLyricsByVersesWithAi(
  lines: string[],
  _userApiKey?: string,
  options?: GeminiAiOptions
): Promise<LyricSyllable[][]> {
  if (lines.length === 0) return [];

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/gemini/convert-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          lines,
          model: options?.model || DEFAULT_GEMINI_MODEL,
          thinkingEffort: options?.thinkingEffort || 'MEDIUM',
        }),
      });
      handleAuthFailure(res.status);
      if (res.ok) {
        const data = await res.json();
        if (data.verses && Array.isArray(data.verses)) {
          return data.verses;
        }
      }
    } catch {
      // Fall through to local tokenizer
    }
  }

  return lines.map((line) => fallbackVerse(line));
}

export async function convertTaigiLyricsWithAi(
  text: string,
  _userApiKey?: string,
  options?: GeminiAiOptions
): Promise<LyricSyllable[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/gemini/convert-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          text,
          model: options?.model || DEFAULT_GEMINI_MODEL,
          thinkingEffort: options?.thinkingEffort || 'MEDIUM',
        }),
      });
      handleAuthFailure(res.status);
      if (res.ok) {
        const data = await res.json();
        if (data.syllables && Array.isArray(data.syllables)) {
          return data.syllables;
        }
      }
    } catch {
      // Fall through
    }
  }

  return fallbackVerse(text);
}

export async function extractScoreFromImagesWithAi(
  images: ScoreImageInput[],
  mode: AiScoreExtractionMode = 'full_score',
  _userApiKey?: string,
  options?: GeminiAiOptions
): Promise<AiScoreExtractionResult> {
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

  if (typeof window === 'undefined') {
    return {
      success: false,
      error: 'Score recognition is only available in the browser.',
    };
  }

  try {
    const res = await fetch('/api/gemini/scan-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        images,
        mode,
        model: options?.model || DEFAULT_GEMINI_MODEL,
        thinkingEffort: options?.thinkingEffort || 'HIGH',
      }),
    });

    if (handleAuthFailure(res.status)) {
      return {
        success: false,
        error: '通行密碼已過期，請重新驗證 (Passcode expired, please verify again)',
      };
    }

    if (!res.ok) {
      return {
        success: false,
        error: await readApiError(res, 'AI 圖片識譜失敗，請稍後再試。'),
      };
    }

    const data = await res.json();
    return data;
  } catch {
    return {
      success: false,
      error: 'AI 圖片識譜失敗，請稍後再試。',
    };
  }
}
