/**
 * Authentication and authorization helper for Gemini API access.
 * Strictly uses environment-provided API keys (NEXT_PUBLIC_GEMINI_API_KEY / GEMINI_API_KEY).
 * No API key is accepted or stored from the frontend UI.
 * When no environment key is configured, all AI features and passcode authentication are muted.
 */

import type { GeminiModelChoice, GeminiThinkingEffort } from './geminiService';

export const AUTH_STORAGE_KEY = 'taigi_gemini_auth_verified';
export const PASSCODE_STORAGE_KEY = 'taigi_gemini_auth_passcode';
export const MODEL_STORAGE_KEY = 'taigi_gemini_model';
export const THINKING_EFFORT_STORAGE_KEY = 'taigi_gemini_thinking_effort';

export const GEMINI_AUTH_CHANGE_EVENT = 'taigi_gemini_auth_changed';

// Default accepted passcodes if not specified in environment
const DEFAULT_PASSCODES = ['taigi', 'taigi2025', 'taigi2026', 'gemini', 'composer', 'admin'];

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
 * Checks if a Gemini API key is configured in the environment.
 */
export function hasEnvGeminiApiKey(): boolean {
  if (typeof process !== 'undefined') {
    const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (envKey && envKey.trim().length >= 10) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a valid Gemini API key is available in the environment.
 * Strictly checks environment configuration (no frontend key entry allowed).
 */
export function hasGeminiApiKey(): boolean {
  return hasEnvGeminiApiKey();
}

/**
 * Returns true if Gemini AI is available (synonymous with having an environment API key).
 */
export function isAiAvailable(): boolean {
  return hasGeminiApiKey();
}

/**
 * Checks if the user is currently authenticated to access Gemini API.
 * Returns false if no Gemini API key is configured in the environment.
 */
export function isGeminiAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  if (!hasGeminiApiKey()) return false;

  const verified = localStorage.getItem(AUTH_STORAGE_KEY);
  return verified === 'true';
}

/**
 * Verifies a passcode and persists auth state if valid.
 * If no environment key is configured, passcode authentication is muted and rejected.
 * No API key can be entered from the frontend.
 */
export function verifyGeminiPasscode(input: string): GeminiAuthResult {
  if (!hasEnvGeminiApiKey()) {
    return {
      success: false,
      message: 'Passcode authentication is muted because no Gemini API key is configured in the environment.',
    };
  }

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
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      localStorage.setItem(PASSCODE_STORAGE_KEY, trimmed);
      notifyGeminiAuthChange();
    }
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
 * Revokes current authentication status and clears saved credentials.
 * Emits auth change event to immediately sync across all components.
 */
export function revokeGeminiAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(PASSCODE_STORAGE_KEY);
  // Clean up any legacy custom key if it was previously saved
  localStorage.removeItem('taigi_gemini_api_key');
  notifyGeminiAuthChange();
}

/**
 * Retrieves the active Gemini API key from the environment.
 */
export function getActiveGeminiApiKey(): string | undefined {
  if (typeof process !== 'undefined') {
    const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (envKey && envKey.trim().length >= 10) return envKey.trim();
  }
  return undefined;
}

/**
 * Retrieves the configured Gemini model choice.
 */
export function getGeminiModel(): GeminiModelChoice {
  if (typeof window === 'undefined') return 'gemini-3.7-flash';
  const saved = localStorage.getItem(MODEL_STORAGE_KEY) as string;
  if (saved === 'gemini-3.7-flash' || saved === 'gemini-3.7-flash-lite') return saved;
  if (saved === 'gemini-2.5-flash-lite') return 'gemini-3.7-flash-lite';
  return 'gemini-3.7-flash';
}

/**
 * Sets and persists the Gemini model choice.
 */
export function setGeminiModel(model: GeminiModelChoice): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MODEL_STORAGE_KEY, model);
  notifyGeminiAuthChange();
}

/**
 * Retrieves the configured thinking effort level.
 */
export function getGeminiThinkingEffort(): GeminiThinkingEffort {
  if (typeof window === 'undefined') return 'MEDIUM';
  const saved = localStorage.getItem(THINKING_EFFORT_STORAGE_KEY) as GeminiThinkingEffort;
  if (saved === 'HIGH' || saved === 'MEDIUM' || saved === 'LOW' || saved === 'OFF' || saved === 'AUTO') {
    return saved;
  }
  return 'MEDIUM';
}

/**
 * Sets and persists the Gemini thinking effort level.
 */
export function setGeminiThinkingEffort(effort: GeminiThinkingEffort): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(THINKING_EFFORT_STORAGE_KEY, effort);
    notifyGeminiAuthChange();
  }
}
