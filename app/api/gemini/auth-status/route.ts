import { NextResponse } from 'next/server';
import {
  applySessionCookie,
  clearSessionCookie,
  createSessionToken,
  isGeminiConfigured,
  isPasscodeValid,
  rateLimitResponse,
  readSessionCookie,
  verifySessionToken,
} from '@/lib/geminiServerAuth';

export const dynamic = 'force-static';

export async function GET(req: Request) {
  const available = isGeminiConfigured();
  const authenticated = available && verifySessionToken(readSessionCookie(req));
  return NextResponse.json({
    available,
    authenticated,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.revoke === true) {
      const response = NextResponse.json({ success: true, message: 'Session cleared.' });
      clearSessionCookie(response);
      return response;
    }

    const limited = rateLimitResponse(req, 'auth');
    if (limited) return limited;

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { success: false, message: 'Server has no Gemini API key configured.' },
        { status: 400 }
      );
    }

    const passcode = body?.passcode;
    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Passcode is required.' },
        { status: 400 }
      );
    }

    if (!isPasscodeValid(passcode)) {
      return NextResponse.json(
        { success: false, message: 'Invalid passcode.' },
        { status: 401 }
      );
    }

    const token = createSessionToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Could not create a session.' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Passcode verified successfully!',
    });
    applySessionCookie(response, token);
    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
