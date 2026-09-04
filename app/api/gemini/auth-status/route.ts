import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const DEFAULT_PASSCODES = ['taigi', 'taigi2025', 'taigi2026', 'gemini', 'composer', 'admin'];

function getValidPasscodes(): string[] {
  const envPasscode = process.env.GEMINI_PASSCODE || process.env.NEXT_PUBLIC_GEMINI_PASSCODE;
  const envAiPasscode = process.env.AI_PASSCODE || process.env.NEXT_PUBLIC_AI_PASSCODE;
  const list = [...DEFAULT_PASSCODES];
  if (envPasscode && envPasscode.trim()) list.push(envPasscode.trim());
  if (envAiPasscode && envAiPasscode.trim()) list.push(envAiPasscode.trim());
  return list;
}

export async function GET() {
  const hasKey = Boolean(
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 10) ||
    (process.env.NEXT_PUBLIC_GEMINI_API_KEY && process.env.NEXT_PUBLIC_GEMINI_API_KEY.trim().length >= 10)
  );

  return NextResponse.json({
    available: hasKey,
  });
}

export async function POST(req: Request) {
  try {
    const { passcode } = await req.json();
    const hasKey = Boolean(
      (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 10) ||
      (process.env.NEXT_PUBLIC_GEMINI_API_KEY && process.env.NEXT_PUBLIC_GEMINI_API_KEY.trim().length >= 10)
    );

    if (!hasKey) {
      return NextResponse.json(
        { success: false, message: 'Server has no Gemini API key configured.' },
        { status: 400 }
      );
    }

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Passcode is required.' },
        { status: 400 }
      );
    }

    const trimmed = passcode.trim().toLowerCase();
    const validPasscodes = getValidPasscodes().map((p) => p.toLowerCase());

    if (validPasscodes.includes(trimmed)) {
      return NextResponse.json({
        success: true,
        message: 'Passcode verified successfully!',
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid passcode.' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
