/**
 * Authentication and authorization helper for Gemini API access.
 * Supports passcode verification, custom API keys, model & thinking preferences,
 * and reactive real-time synchronization across all components.
 */

import type { GeminiModelChoice, GeminiThinkingEffort } from './geminiService';

export const AUTH_STORAGE_KEY = 'taigi_gemini_auth_verified';
export const PASSCODE_STORAGE_KEY = 'taigi_gemini_auth_passcode';
export const API_KEY_STORAGE_KEY = 'taigi_gemini_api_key';
export const MODEL_STORAGE_KEY = 'taigi_gemini_model';
export const THINKING_EFFORT_STORAGE_KEY = 'taigi_gemini_thinking_effort';

export const GEMINI_AUTH_CHANGE_EVENT = 'taigi_gemini_auth_changed';

// Default accepted passcodes if not specified in environment
const DEFAULT_PASSCODES = ['taigi', 'taigi2025', 'taigi2026', 'gemini', 'composer', 'admin'];

export interface GeminiAuthResult {
  success: boolean;
  isApiKey?: boolean;
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
 * Emits auth change event to instantly synchronize all modals and controls.
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
      notifyGeminiAuthChange();
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
      notifyGeminiAuthChange();
    }
    const hasEnvKey = typeof process !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
    return {
      success: true,
      isApiKey: false,
      message: hasEnvKey
        ? 'Passcode verified successfully! Gemini AI access unlocked.'
        : 'Passcode verified! If AI calls fail, please enter your personal Gemini API Key.',
    };
  }

  return {
    success: false,
    message: 'Incorrect passcode. Please try again (Hint: "taigi" or enter your API Key)',
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
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  notifyGeminiAuthChange();
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

/**
 * Sets or removes a custom Gemini API key.
 */
export function setCustomApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }
  notifyGeminiAuthChange();
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

export { useGeminiAuth } from '@/hooks/useGeminiAuth';
