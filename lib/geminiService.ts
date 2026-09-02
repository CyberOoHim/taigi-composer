import { GoogleGenAI } from '@google/genai';
import { LyricSyllable } from '@/types/song';
import { splitTaigiLyricSyllables } from './taigiUtils';

export async function convertTaigiLyricsWithAi(
  text: string,
  userApiKey?: string
): Promise<LyricSyllable[]> {
  const apiKey = userApiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

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
   - "pij": Tâi-lô (臺灣閩南語羅馬字拼音方案) with correct tone marks (á, à, â, ā, a̍, a̋, oo, nn, etc.)
   - "custom": Han-lô mixed representation

Return strictly valid JSON in the following schema:
{
  "syllables": [
    { "hanji": "望", "poj": "Bāng", "pij": "Bāng", "custom": "望" },
    { "hanji": "春", "poj": "Chhun", "pij": "Tshun", "custom": "春" },
    { "hanji": "風", "poj": "hong", "pij": "hong", "custom": "風" }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
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
