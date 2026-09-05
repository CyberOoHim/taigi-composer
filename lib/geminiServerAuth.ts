import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { GeminiModelChoice, GeminiThinkingEffort } from '@/lib/geminiService';

export const SESSION_COOKIE = 'taigi_gemini_session';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const MAX_SCORE_PAGES = 3;
export const MAX_IMAGE_CHARS = 2_500_000;
export const MAX_MEASURES = 400;
export const MAX_NOTES_PER_MEASURE = 64;
export const MAX_LYRIC_LINES = 80;
export const MAX_LINE_CHARS = 2000;
export const MAX_MODEL_JSON_CHARS = 1_000_000;

export const ALLOWED_MODELS: readonly GeminiModelChoice[] = [
  'gemini-3.7-flash',
  'gemini-3.7-flash-lite',
];

export const ALLOWED_THINKING: readonly GeminiThinkingEffort[] = [
  'HIGH',
  'MEDIUM',
  'LOW',
  'OFF',
  'AUTO',
];

const AUTH_RATE_LIMIT = 8;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const GENERATE_RATE_LIMIT = 30;
const GENERATE_RATE_WINDOW_MS = 10 * 60 * 1000;

const FALLBACK_PASSCODES = ['taigi', 'taigi2025', 'taigi2026', 'gemini', 'composer', 'admin'];

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function getServerGeminiApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY;
  if (key && key.trim().length >= 10) return key.trim();
  return undefined;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getServerGeminiApiKey());
}

function getSessionSecret(): string | undefined {
  const dedicated = process.env.GEMINI_SESSION_SECRET;
  if (dedicated && dedicated.trim().length >= 16) return dedicated.trim();
  return getServerGeminiApiKey();
}

function getValidPasscodes(): string[] {
  const list: string[] = [];
  const envPasscode = process.env.GEMINI_PASSCODE;
  const envAiPasscode = process.env.AI_PASSCODE;
  if (envPasscode && envPasscode.trim()) list.push(envPasscode.trim());
  if (envAiPasscode && envAiPasscode.trim()) list.push(envAiPasscode.trim());
  if (list.length === 0) {
    list.push(...FALLBACK_PASSCODES);
  }
  return list;
}

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export function isPasscodeValid(passcode?: string): boolean {
  if (!passcode || typeof passcode !== 'string') return false;
  const trimmed = passcode.trim().toLowerCase();
  if (!trimmed) return false;
  return getValidPasscodes().some((candidate) => safeEqualString(trimmed, candidate.toLowerCase()));
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function consumeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = rateBuckets.get(key);
  if (!existing || now > existing.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

export function rateLimitResponse(req: Request, bucket: 'auth' | 'generate'): NextResponse | null {
  const ip = getClientIp(req);
  const ok =
    bucket === 'auth'
      ? consumeRateLimit(`auth:${ip}`, AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_MS)
      : consumeRateLimit(`gen:${ip}`, GENERATE_RATE_LIMIT, GENERATE_RATE_WINDOW_MS);
  if (ok) return null;
  return NextResponse.json(
    { error: 'Too many requests. Please wait and try again.' },
    { status: 429 }
  );
}

function signSession(exp: number, nonce: string, secret: string): string {
  return createHmac('sha256', secret).update(`${exp}.${nonce}`).digest('base64url');
}

export function createSessionToken(): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = randomBytes(16).toString('base64url');
  return `${exp}.${nonce}.${signSession(exp, nonce, secret)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const secret = getSessionSecret();
  if (!secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp || !nonce || !sig) return false;
  const expected = signSession(exp, nonce, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function readSessionCookie(req?: Request): string | undefined {
  if (!req?.headers) return undefined;
  const header = req.headers.get('cookie');
  if (!header) return undefined;
  const parts = header.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE}=`)) {
      return decodeURIComponent(trimmed.slice(SESSION_COOKIE.length + 1));
    }
  }
  return undefined;
}

export function applySessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export function requireGeminiSession(req: Request): NextResponse | null {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: 'Gemini API is not configured.' }, { status: 503 });
  }
  if (!verifySessionToken(readSessionCookie(req))) {
    return NextResponse.json({ error: 'Unauthorized. Verify passcode first.' }, { status: 401 });
  }
  return null;
}

export function parseModel(value: unknown): GeminiModelChoice {
  if (typeof value === 'string' && (ALLOWED_MODELS as readonly string[]).includes(value)) {
    return value as GeminiModelChoice;
  }
  return 'gemini-3.7-flash';
}

export function parseThinking(value: unknown): GeminiThinkingEffort {
  if (typeof value === 'string' && (ALLOWED_THINKING as readonly string[]).includes(value)) {
    return value as GeminiThinkingEffort;
  }
  return 'MEDIUM';
}

export function publicAiError(): string {
  return 'AI request failed. Please try again.';
}

export function validateLyricPayload(lines: unknown, text: unknown): NextResponse | null {
  if (Array.isArray(lines) && lines.length > 0) {
    if (lines.length > MAX_LYRIC_LINES) {
      return NextResponse.json({ error: `Maximum ${MAX_LYRIC_LINES} lines allowed.` }, { status: 400 });
    }
    for (const line of lines) {
      if (typeof line !== 'string' || line.length > MAX_LINE_CHARS) {
        return NextResponse.json({ error: 'A lyrics line is missing or too long.' }, { status: 400 });
      }
    }
    return null;
  }
  if (typeof text === 'string' && text.trim()) {
    if (text.length > MAX_LINE_CHARS * 4) {
      return NextResponse.json({ error: 'Lyrics text is too long.' }, { status: 400 });
    }
    return null;
  }
  return NextResponse.json({ error: 'No lyrics provided.' }, { status: 400 });
}

export function validateScanImages(images: unknown): NextResponse | null {
  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: '未提供樂譜圖片' }, { status: 400 });
  }
  if (images.length > MAX_SCORE_PAGES) {
    return NextResponse.json({ error: `最多支援 ${MAX_SCORE_PAGES} 頁圖片` }, { status: 400 });
  }
  for (const image of images) {
    if (!image || typeof image !== 'object') {
      return NextResponse.json({ error: 'Invalid image payload.' }, { status: 400 });
    }
    const data = (image as { data?: unknown }).data;
    if (typeof data !== 'string' || data.length === 0 || data.length > MAX_IMAGE_CHARS) {
      return NextResponse.json({ error: 'An image is missing or too large.' }, { status: 400 });
    }
  }
  return null;
}

export function capParsedScore(parsed: { measures?: unknown }): NextResponse | null {
  if (!Array.isArray(parsed.measures)) return null;
  if (parsed.measures.length > MAX_MEASURES) {
    return NextResponse.json(
      { success: false, error: 'Transcribed score exceeded the measure limit.' },
      { status: 400 }
    );
  }
  for (const measure of parsed.measures) {
    const notes = measure && typeof measure === 'object' ? (measure as { notes?: unknown }).notes : undefined;
    if (Array.isArray(notes) && notes.length > MAX_NOTES_PER_MEASURE) {
      return NextResponse.json(
        { success: false, error: 'A measure exceeded the note limit.' },
        { status: 400 }
      );
    }
  }
  return null;
}

export function parseModelJson(rawText: string): unknown {
  if (!rawText || rawText.length > MAX_MODEL_JSON_CHARS) {
    throw new Error('Model payload too large');
  }
  const cleanJsonText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleanJsonText || '{}');
}

export function buildThinkingConfig(
  _model?: string,
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

export async function callGenerateContentSafe(
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
