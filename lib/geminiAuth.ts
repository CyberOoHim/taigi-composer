/**
 * Authentication and authorization helper for Gemini API access.
 * Supports passcode verification, custom API keys, and localStorage persistence.
 */

const AUTH_STORAGE_KEY = 'taigi_gemini_auth_verified';
const PASSCODE_STORAGE_KEY = 'taigi_gemini_auth_passcode';
const API_KEY_STORAGE_KEY = 'taigi_gemini_api_key';

// Default accepted passcodes if not specified in environment
const DEFAULT_PASSCODES = ['taigi', 'taigi2025', 'taigi2026', 'gemini', 'composer', 'admin'];

export interface GeminiAuthResult {
  success: boolean;
  isApiKey?: boolean;
  message: string;
}

/**
 * Returns the list of valid passcodes including env variables.
 */
export function getValidPasscodes(): string[] {
  const envPasscode = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_PASSCODE : undefined;
  const envAiPasscode = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_AI_PASSCODE : undefined;
  const list = [...DEFAULT_PASSCODES];
  if (envPasscode && envPasscode.trim()) list.push(envPasscode.trim());
  if (envAiPasscode && envAiPasscode.trim()) list.push(envAiPasscode.trim());
  return list;
}

/**
 * Checks if the user is currently authenticated to access Gemini API.
 */
export function isGeminiAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const verified = localStorage.getItem(AUTH_STORAGE_KEY);
  if (verified === 'true') return true;

  // Direct custom API key also counts as authenticated
  const customKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (customKey && customKey.trim().length >= 10) return true;

  return false;
}

/**
 * Verifies a passcode or API key and persists auth state.
 */
export function verifyGeminiPasscode(input: string): GeminiAuthResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      success: false,
      message: 'Please enter a passcode or Gemini API Key',
    };
  }

  // Case 1: Input is a direct Gemini API key (starts with AIza or length >= 30)
  if (trimmed.startsWith('AIza') || trimmed.length >= 32) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      localStorage.setItem(PASSCODE_STORAGE_KEY, trimmed);
      localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    }
    return {
      success: true,
      isApiKey: true,
      message: 'Gemini API Key verified successfully! Access unlocked.',
    };
  }

  // Case 2: Input matches any valid passcode (case-insensitive)
  const validPasscodes = getValidPasscodes().map(p => p.toLowerCase());
  if (validPasscodes.includes(trimmed.toLowerCase())) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      localStorage.setItem(PASSCODE_STORAGE_KEY, trimmed);
    }
    return {
      success: true,
      isApiKey: false,
      message: 'Passcode verified successfully! Gemini API access unlocked.',
    };
  }

  return {
    success: false,
    message: 'Incorrect passcode. Please try again (Hint: "taigi" or enter your API Key)',
  };
}

/**
 * Revokes current authentication status and clears saved credentials.
 */
export function revokeGeminiAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(PASSCODE_STORAGE_KEY);
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

/**
 * Retrieves the active custom API key if present.
 */
export function getActiveGeminiApiKey(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const customKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (customKey && customKey.trim()) return customKey.trim();

  const passcode = localStorage.getItem(PASSCODE_STORAGE_KEY);
  if (passcode && (passcode.startsWith('AIza') || passcode.length >= 32)) {
    return passcode.trim();
  }
  return undefined;
}
