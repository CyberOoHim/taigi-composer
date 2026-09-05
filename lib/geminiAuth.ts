/**
 * Client Gemini auth helper. The API key never lives in this module.
 * Availability and passcode checks go through /api/gemini/auth-status.
 * A httpOnly session cookie is the real authorization; localStorage is UX cache.
 */

import type { GeminiModelChoice, GeminiThinkingEffort } from './geminiService';
import { safeGetItem, safeSetItem } from './storage';

export const AUTH_STORAGE_KEY = 'taigi_gemini_auth_verified';
export const PASSCODE_STORAGE_KEY = 'taigi_gemini_auth_passcode';
export const MODEL_STORAGE_KEY = 'taigi_gemini_model';
export const THINKING_EFFORT_STORAGE_KEY = 'taigi_gemini_thinking_effort';

export const GEMINI_AUTH_CHANGE_EVENT = 'taigi_gemini_auth_changed';

let cachedServerAiAvailable: boolean | null = null;
let serverCheckInitiated = false;

export interface GeminiAuthResult {
  success: boolean;
  message: string;
}

export function notifyGeminiAuthChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GEMINI_AUTH_CHANGE_EVENT));
  }
}

function clearLocalAuthCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(PASSCODE_STORAGE_KEY);
    localStorage.removeItem('taigi_gemini_api_key');
  } catch {
    // storage blocked
  }
}

function probeServerAuthStatus(): void {
  if (typeof window === 'undefined' || serverCheckInitiated) return;
  serverCheckInitiated = true;
  fetch('/api/gemini/auth-status', { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : { available: false, authenticated: false }))
    .then((data) => {
      cachedServerAiAvailable = data?.available === true;
      if (data?.authenticated === true) {
        safeSetItem(AUTH_STORAGE_KEY, 'true');
      } else {
        clearLocalAuthCache();
      }
      notifyGeminiAuthChange();
    })
    .catch(() => {
      cachedServerAiAvailable = false;
      notifyGeminiAuthChange();
    });
}

/**
 * True only after the server reports a runtime GEMINI_API_KEY.
 * Defaults to muted so a missing or static-export deploy never looks unlocked.
 */
export function hasEnvGeminiApiKey(): boolean {
  if (cachedServerAiAvailable === null) {
    probeServerAuthStatus();
  }
  return cachedServerAiAvailable === true;
}

export function hasGeminiApiKey(): boolean {
  return hasEnvGeminiApiKey();
}

export function isAiAvailable(): boolean {
  return hasGeminiApiKey();
}

export function isGeminiAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  if (!hasGeminiApiKey()) return false;
  return safeGetItem(AUTH_STORAGE_KEY) === 'true';
}

export async function verifyGeminiPasscode(input: string): Promise<GeminiAuthResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      success: false,
      message: 'Please enter a passcode.',
    };
  }

  if (typeof window === 'undefined') {
    return {
      success: false,
      message: 'Passcode verification requires the browser.',
    };
  }

  try {
    const res = await fetch('/api/gemini/auth-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ passcode: trimmed }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      safeSetItem(AUTH_STORAGE_KEY, 'true');
      try {
        localStorage.removeItem(PASSCODE_STORAGE_KEY);
        localStorage.removeItem('taigi_gemini_api_key');
      } catch {
        // ignore
      }
      notifyGeminiAuthChange();
      return {
        success: true,
        message: typeof data.message === 'string' ? data.message : 'Passcode verified successfully.',
      };
    }
    return {
      success: false,
      message: typeof data?.message === 'string' ? data.message : 'Incorrect passcode. Please try again.',
    };
  } catch {
    return {
      success: false,
      message: 'Could not reach the authentication service.',
    };
  }
}

export function revokeGeminiAuth(): void {
  if (typeof window === 'undefined') return;
  clearLocalAuthCache();
  fetch('/api/gemini/auth-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ revoke: true }),
  }).catch(() => {
    // cookie clear is best-effort
  });
  notifyGeminiAuthChange();
}

export function getGeminiModel(): GeminiModelChoice {
  if (typeof window === 'undefined') return 'gemini-3.7-flash';
  const saved = safeGetItem(MODEL_STORAGE_KEY);
  if (saved === 'gemini-3.7-flash' || saved === 'gemini-3.7-flash-lite') return saved;
  if (saved === 'gemini-2.5-flash-lite') return 'gemini-3.7-flash-lite';
  return 'gemini-3.7-flash';
}

export function setGeminiModel(model: GeminiModelChoice): void {
  if (typeof window === 'undefined') return;
  safeSetItem(MODEL_STORAGE_KEY, model);
  notifyGeminiAuthChange();
}

export function getGeminiThinkingEffort(): GeminiThinkingEffort {
  if (typeof window === 'undefined') return 'MEDIUM';
  const saved = safeGetItem(THINKING_EFFORT_STORAGE_KEY) as GeminiThinkingEffort;
  if (saved === 'HIGH' || saved === 'MEDIUM' || saved === 'LOW' || saved === 'OFF' || saved === 'AUTO') {
    return saved;
  }
  return 'MEDIUM';
}

export function setGeminiThinkingEffort(effort: GeminiThinkingEffort): void {
  if (typeof window !== 'undefined') {
    safeSetItem(THINKING_EFFORT_STORAGE_KEY, effort);
    notifyGeminiAuthChange();
  }
}
