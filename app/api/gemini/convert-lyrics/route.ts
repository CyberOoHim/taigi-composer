import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { buildThinkingConfig } from '@/lib/geminiService';
import { splitTaigiLyricSyllables } from '@/lib/taigiUtils';

const DEFAULT_PASSCODES = ['taigi', 'taigi2025', 'taigi2026', 'gemini', 'composer', 'admin'];

function isPasscodeValid(passcode?: string): boolean {
  const envPasscode = process.env.GEMINI_PASSCODE || process.env.NEXT_PUBLIC_GEMINI_PASSCODE;
  const envAiPasscode = process.env.AI_PASSCODE || process.env.NEXT_PUBLIC_AI_PASSCODE;
  const list = [...DEFAULT_PASSCODES];
  if (envPasscode && envPasscode.trim()) list.push(envPasscode.trim());
  if (envAiPasscode && envAiPasscode.trim()) list.push(envAiPasscode.trim());

  if (!passcode) return false;
  return list.map(p => p.toLowerCase()).includes(passcode.trim().toLowerCase());
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured on the server.' }, { status: 503 });
    }

    const body = await req.json();
    const { lines, text, passcode, model = 'gemini-3.7-flash', thinkingEffort = 'MEDIUM' } = body;

    // Optional passcode check if server requires authentication
    if (passcode && !isPasscodeValid(passcode)) {
      return NextResponse.json({ error: 'Unauthorized: Invalid passcode.' }, { status: 401 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Mode A: verses/lines array
    if (Array.isArray(lines) && lines.length > 0) {
      const formattedLines = lines.map((l: string, i: number) => `Line ${i + 1}: ${l}`).join('\n');
      const prompt = `You are an expert Taiwanese Hokkien (Taigi / 臺灣話) linguist and music lyricist.
The user provided the following Taigi lyrics structured line-by-line (each line represents a musical phrase/verse):
${formattedLines}

Task:
1. For each line, break down into an array of syllables aligned one-by-one.
2. For each syllable, output:
   - "hanji": The Han character (if applicable, or matching Hanji)
   - "poj": Pe̍h-ōe-jī (白話字) with correct tone diacritics (á, à, â, ā, a̍, a̋, o͘, ⁿ, etc.)
   - "tl": Tâi-lô (臺灣閩南語羅馬字拼音方案) with correct tone marks (á, à, â, ā, a̍, a̋, oo, nn, etc.)
   - "custom": Han-lô mixed representation

Return strictly valid JSON in the following schema:
{
  "verses": [
    {
      "lineIndex": 0,
      "syllables": [
        { "hanji": "望", "poj": "Bāng", "tl": "Bāng", "custom": "望" }
      ]
    }
  ]
}`;

      const thinkingConfig = buildThinkingConfig(model, thinkingEffort);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.verses && Array.isArray(parsed.verses)) {
        const result = [];
        for (let i = 0; i < lines.length; i++) {
          const found = parsed.verses.find((v: { lineIndex?: number }) => v.lineIndex === i) || parsed.verses[i];
          if (found && Array.isArray(found.syllables)) {
            result.push(found.syllables);
          } else {
            const rawSyllables = splitTaigiLyricSyllables(lines[i]);
            result.push(rawSyllables.map((s) => ({ hanji: s, poj: s, tl: s, custom: s })));
          }
        }
        return NextResponse.json({ verses: result });
      }
    }

    // Mode B: single text line
    if (typeof text === 'string' && text.trim().length > 0) {
      const prompt = `You are an expert Taiwanese Hokkien (Taigi / 臺灣話) linguist and music lyricist.
The user provided the following Taigi lyrics (which may be Hanji, POJ, TL, or Han-lô mixed):
"${text}"

Task:
1. Break down into an array of syllables aligned one-by-one.
2. For each syllable, output:
   - "hanji": The Han character (if applicable, or matching Hanji)
   - "poj": Pe̍h-ōe-jī (白話字) with correct tone diacritics (á, à, â, ā, a̍, a̋, o͘, ⁿ, etc.)
   - "tl": Tâi-lô (臺灣閩南語羅馬字拼音方案) with correct tone marks (á, à, â, ā, a̍, a̋, oo, nn, etc.)
   - "custom": Han-lô mixed representation

Return strictly valid JSON in the following schema:
{
  "syllables": [
    { "hanji": "望", "poj": "Bāng", "tl": "Bāng", "custom": "望" }
  ]
}`;

      const thinkingConfig = buildThinkingConfig(model, thinkingEffort);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.syllables && Array.isArray(parsed.syllables)) {
        return NextResponse.json({ syllables: parsed.syllables });
      }
    }

    return NextResponse.json({ error: 'No valid lyrics provided.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
