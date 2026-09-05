import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { splitTaigiLyricSyllables } from '@/lib/taigiUtils';
import {
  buildThinkingConfig,
  callGenerateContentSafe,
  parseModel,
  parseModelJson,
  parseThinking,
  publicAiError,
  rateLimitResponse,
  requireGeminiSession,
  validateLyricPayload,
  getServerGeminiApiKey,
} from '@/lib/geminiServerAuth';

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
    const payloadError = validateLyricPayload(body?.lines, body?.text);
    if (payloadError) return payloadError;

    const { lines, text } = body;
    const model = parseModel(body.model);
    const thinkingEffort = parseThinking(body.thinkingEffort);
    const ai = new GoogleGenAI({ apiKey });
    const thinkingConfig = buildThinkingConfig(model, thinkingEffort);

    if (Array.isArray(lines) && lines.length > 0) {
      const formattedLines = lines.map((l: string, i: number) => `Line ${i + 1}: ${l}`).join('\n');
      const prompt = `You are an expert Taiwanese Hokkien (Taigi / 臺灣話) linguist and music lyricist.
The user provided the following Taigi lyrics structured line-by-line (each line represents a musical phrase/verse):
${formattedLines}

Task:
1. For each line, break down into an array of syllables aligned one-by-one.
2. For each syllable, output strictly two fields:
   - "hanlo": 漢羅 (Hàn-lô: Traditional Han character or Han-lô mixed representation, e.g. "望", "阮ê", "chhun-hong")
   - "poj": 羅馬字 / Pe̍h-ōe-jī (白話字) with correct tone diacritics (á, à, â, ā, a̍, a̋, o͘, ⁿ, etc., e.g. "Bāng")

Return strictly valid JSON in the following schema:
{
  "verses": [
    {
      "lineIndex": 0,
      "syllables": [
        { "hanlo": "望", "poj": "Bāng" }
      ]
    }
  ]
}`;

      const response = await callGenerateContentSafe(ai, {
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      });

      const parsed = parseModelJson(response.text || '{}') as {
        verses?: Array<{ lineIndex?: number; syllables?: unknown }>;
      };
      if (parsed.verses && Array.isArray(parsed.verses)) {
        const result = [];
        for (let i = 0; i < lines.length; i++) {
          const found = parsed.verses.find((v) => v.lineIndex === i) || parsed.verses[i];
          if (found && Array.isArray(found.syllables)) {
            result.push(found.syllables);
          } else {
            const rawSyllables = splitTaigiLyricSyllables(lines[i]);
            result.push(rawSyllables.map((s) => ({ hanlo: s, poj: s })));
          }
        }
        return NextResponse.json({ verses: result });
      }
    }

    if (typeof text === 'string' && text.trim().length > 0) {
      const prompt = `You are an expert Taiwanese Hokkien (Taigi / 臺灣話) linguist and music lyricist.
The user provided the following Taigi lyrics (which may be Hanji, POJ, or Han-lô mixed):
"${text}"

Task:
1. Break down into an array of syllables aligned one-by-one.
2. For each syllable, output strictly two fields:
   - "hanlo": 漢羅 (Hàn-lô: Traditional Han character or Han-lô mixed representation, e.g. "望", "阮ê", "chhun-hong")
   - "poj": 羅馬字 / Pe̍h-ōe-jī (白話字) with correct tone diacritics (á, à, â, ā, a̍, a̋, o͘, ⁿ, etc., e.g. "Bāng")

Return strictly valid JSON in the following schema:
{
  "syllables": [
    { "hanlo": "望", "poj": "Bāng" }
  ]
}`;

      const response = await callGenerateContentSafe(ai, {
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      });

      const parsed = parseModelJson(response.text || '{}') as { syllables?: unknown };
      if (parsed.syllables && Array.isArray(parsed.syllables)) {
        return NextResponse.json({ syllables: parsed.syllables });
      }
    }

    const rawSyllables = splitTaigiLyricSyllables(typeof text === 'string' ? text : '');
    return NextResponse.json({
      syllables: rawSyllables.map((s) => ({ hanlo: s, poj: s })),
    });
  } catch (err: unknown) {
    console.error('[convert-lyrics]', err);
    return NextResponse.json({ error: publicAiError() }, { status: 500 });
  }
}
