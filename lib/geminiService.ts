import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { LyricSyllable } from '@/types/song';
import { splitTaigiLyricSyllables } from './taigiUtils';

export type GeminiModelChoice = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite';
export type GeminiThinkingEffort = 'HIGH' | 'MEDIUM';

export interface GeminiAiOptions {
  model?: GeminiModelChoice | string;
  thinkingEffort?: GeminiThinkingEffort;
}

export async function convertTaigiLyricsByVersesWithAi(
  lines: string[],
  userApiKey?: string,
  options?: GeminiAiOptions
): Promise<LyricSyllable[][]> {
  const apiKey = userApiKey || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : undefined);
  const model = options?.model || 'gemini-2.5-flash';
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

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingLevel: thinkingEffort === 'HIGH' ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM,
        },
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
  const apiKey = userApiKey || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : undefined);
  const model = options?.model || 'gemini-2.5-flash';
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
The user provided the following Taigi lyrics (which may be Hanji, POJ, PIJ, or Han-lô mixed):
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

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingLevel: thinkingEffort === 'HIGH' ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM,
        },
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

