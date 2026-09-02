import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export async function POST(req: NextRequest) {
  try {
    const { action, text, context } = await req.json();

    if (!text && action !== 'generate_idea') {
      return NextResponse.json({ error: 'Text prompt is required' }, { status: 400 });
    }

    const ai = getAiClient();

    if (action === 'convert_lyrics') {
      // Convert Hanji to accurate POJ & PIJ (Tâi-lô)
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
  ],
  "original": "${text}"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return NextResponse.json(parsed);
    }

    if (action === 'suggest_melody') {
      const prompt = `You are a traditional Taiwanese folk and pop composer (specializing in Deng Yu-shian style Taiwanese pentatonic 1 2 3 5 6 folk melodies and modern Han-lô songs).
The user wants to generate a short melodic phrase with aligned Taigi lyrics on theme: "${text || 'Taiwanese summer breeze and memories'}".
Key: ${context?.key || 'F'}, Time: ${context?.timeSignature || '4/4'}, BPM: ${context?.bpm || 76}.

Generate 4 measures of numbered notation (Jianpu) with aligned Hanji, POJ, PIJ, and chords.
Output JSON schema:
{
  "title": "Song Title in Hanji (POJ)",
  "composer": "Composer Name",
  "lyricist": "Lyricist Name",
  "key": "F",
  "timeSignature": "4/4",
  "bpm": 76,
  "measures": [
    {
      "measureNumber": 1,
      "chord": "F",
      "notes": [
        { "pitch": 5, "octave": -1, "duration": 0.5, "lyric": { "hanji": "海", "poj": "Hái", "pij": "Hái", "custom": "海" } },
        { "pitch": 6, "octave": -1, "duration": 0.5, "lyric": { "hanji": "風", "poj": "hong", "pij": "hong", "custom": "風" } },
        { "pitch": 1, "octave": 0, "duration": 1, "lyric": { "hanji": "吹", "poj": "chhoe", "pij": "tshue", "custom": "吹" } },
        { "pitch": 2, "octave": 0, "duration": 2, "lyric": { "hanji": "來", "poj": "lâi", "pij": "lâi", "custom": "來" } }
      ]
    }
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
      return NextResponse.json(parsed);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
