export interface GeminiAuthStatusPayload {
  available?: boolean;
  authenticated?: boolean;
  live?: boolean;
}

/**
 * Map a GET /api/gemini/auth-status body to a cache action.
 * Static-export / failed probes must not look like a real logout.
 */
export function interpretGeminiAuthStatus(
  data: GeminiAuthStatusPayload | null | undefined
): 'authenticated' | 'unauthenticated' | 'unknown' {
  if (data?.authenticated === true) return 'authenticated';
  if (data?.live === true) return 'unauthenticated';
  return 'unknown';
}
