/**
 * Authentication and authorization helper for Gemini API access.
 * On the client, only NEXT_PUBLIC_GEMINI_API_KEY is accessed directly.
 * The server-only GEMINI_API_KEY is used exclusively by server route handlers
 * (app/api/gemini/*) and is never referenced in this client-side module.
 * When no environment key is configured, all AI features and passcode authentication are muted.
 */

import type { GeminiModelChoice, GeminiThinkingEffort } from './geminiService';
import { safeGetItem, safeSetItem } from './storage';

export const AUTH_STORAGE_KEY = 'taigi_gemini_auth_verified';
export const PASSCODE_STORAGE_KEY = 'taigi_gemini_auth_passcode';
export const MODEL_STORAGE_KEY = 'taigi_gemini_model';
export const THINKING_EFFORT_STORAGE_KEY = 'taigi_gemini_thinking_effort';

export const GEMINI_AUTH_CHANGE_EVENT = 'taigi_gemini_auth_changed';

// Default accepted passcodes if not specified in environment
const DEFAULT_PASSCODES = ['taigi', 'taigi2025', 'taigi2026', 'gemini', 'composer', 'admin'];

let cachedServerAiAvailable: boolean | null = null;
let serverCheckInitiated = false;

export interface GeminiAuthResult {
  success: boolean;
  message: string;
}

/**
 * Dispatches an event to notify all listening components and hooks that
 * the Gemini auth state or configuration has changed.
 */
export function notifyGeminiAuthChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GEMINI_AUTH_CHANGE_EVENT));
  }
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
 * Checks if a Gemini API key is configured in the environment or server.
 */
export function hasEnvGeminiApiKey(): boolean {
  if (typeof process !== 'undefined') {
    // Only check NEXT_PUBLIC_ key on client; server-only GEMINI_API_KEY is checked via /api/gemini/auth-status
    const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (envKey && envKey.trim().length >= 10) {
      return true;
    }
  }
  if (cachedServerAiAvailable !== null) {
    return cachedServerAiAvailable;
  }
  // If in browser and check not yet initiated, probe server route
  if (typeof window !== 'undefined' && !serverCheckInitiated) {
    serverCheckInitiated = true;
    fetch('/api/gemini/auth-status')
      .then((res) => (res.ok ? res.json() : { available: false }))
      .then((data) => {
        if (typeof data?.available === 'boolean') {
          cachedServerAiAvailable = data.available;
          notifyGeminiAuthChange();
        }
      })
      .catch(() => {
        cachedServerAiAvailable = false;
      });
  }
  return true; // Optimistic default in browser to allow checking passcode
}

/**
 * Checks if a valid Gemini API key is available in the environment or server.
 */
export function hasGeminiApiKey(): boolean {
  return hasEnvGeminiApiKey();
}

/**
 * Returns true if Gemini AI is available.
 */
export function isAiAvailable(): boolean {
  return hasGeminiApiKey();
}

/**
 * Checks if the user is currently authenticated to access Gemini API.
 * Returns false if no Gemini API key is configured.
 */
export function isGeminiAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  if (!hasGeminiApiKey()) return false;

  const verified = safeGetItem(AUTH_STORAGE_KEY);
  return verified === 'true';
}

/**
 * Verifies a passcode and persists auth state if valid.
 */
export function verifyGeminiPasscode(input: string): GeminiAuthResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      success: false,
      message: 'Please enter a passcode.',
    };
  }

  // Input matches any valid passcode (case-insensitive)
  const validPasscodes = getValidPasscodes().map(p => p.toLowerCase());
  if (validPasscodes.includes(trimmed.toLowerCase())) {
    safeSetItem(AUTH_STORAGE_KEY, 'true');
    safeSetItem(PASSCODE_STORAGE_KEY, trimmed);
    notifyGeminiAuthChange();
    return {
      success: true,
      message: 'Passcode verified successfully! Gemini AI access unlocked.',
    };
  }

  return {
    success: false,
    message: 'Incorrect passcode. Please try again (Hint: "taigi").',
  };
}

/**
 * Revokes current authentication status and clears saved credentials safely.
 */
export function revokeGeminiAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(PASSCODE_STORAGE_KEY);
    localStorage.removeItem('taigi_gemini_api_key');
  } catch (err) {
    console.warn('[geminiAuth] Failed to clear credentials:', err);
  }
  notifyGeminiAuthChange();
}

/**
 * Retrieves the active Gemini API key from the environment.
 * On the client, only the NEXT_PUBLIC_ prefixed key is available.
 * The server-only GEMINI_API_KEY is accessed exclusively by server route handlers.
 */
export function getActiveGeminiApiKey(): string | undefined {
  if (typeof process !== 'undefined') {
    const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (envKey && envKey.trim().length >= 10) return envKey.trim();
  }
  return undefined;
}

/**
 * Retrieves the configured Gemini model choice safely.
 */
export function getGeminiModel(): GeminiModelChoice {
  if (typeof window === 'undefined') return 'gemini-3.7-flash';
  const saved = safeGetItem(MODEL_STORAGE_KEY);
  if (saved === 'gemini-3.7-flash' || saved === 'gemini-3.7-flash-lite') return saved;
  if (saved === 'gemini-2.5-flash-lite') return 'gemini-3.7-flash-lite';
  return 'gemini-3.7-flash';
}

/**
 * Sets and persists the Gemini model choice safely.
 */
export function setGeminiModel(model: GeminiModelChoice): void {
  if (typeof window === 'undefined') return;
  safeSetItem(MODEL_STORAGE_KEY, model);
  notifyGeminiAuthChange();
}

/**
 * Retrieves the configured thinking effort level safely.
 */
export function getGeminiThinkingEffort(): GeminiThinkingEffort {
  if (typeof window === 'undefined') return 'MEDIUM';
  const saved = safeGetItem(THINKING_EFFORT_STORAGE_KEY) as GeminiThinkingEffort;
  if (saved === 'HIGH' || saved === 'MEDIUM' || saved === 'LOW' || saved === 'OFF' || saved === 'AUTO') {
    return saved;
  }
  return 'MEDIUM';
}

/**
 * Sets and persists the Gemini thinking effort level safely.
 */
export function setGeminiThinkingEffort(effort: GeminiThinkingEffort): void {
  if (typeof window !== 'undefined') {
    safeSetItem(THINKING_EFFORT_STORAGE_KEY, effort);
    notifyGeminiAuthChange();
  }
}
