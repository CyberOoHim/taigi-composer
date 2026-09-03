'use client';

import { useSyncExternalStore, useCallback } from 'react';
import {
  isGeminiAuthenticated,
  getGeminiModel,
  setGeminiModel,
  getGeminiThinkingEffort,
  setGeminiThinkingEffort,
  getActiveGeminiApiKey,
  setCustomApiKey,
  verifyGeminiPasscode,
  revokeGeminiAuth,
  GEMINI_AUTH_CHANGE_EVENT,
  GeminiAuthResult,
} from '@/lib/geminiAuth';
import type { GeminiModelChoice, GeminiThinkingEffort } from '@/lib/geminiService';

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(GEMINI_AUTH_CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(GEMINI_AUTH_CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export function useGeminiAuth() {
  const isAuthenticated = useSyncExternalStore(
    subscribe,
    isGeminiAuthenticated,
    () => false
  );

  const activeModel = useSyncExternalStore(
    subscribe,
    getGeminiModel,
    () => 'gemini-3.7-flash' as GeminiModelChoice
  );

  const thinkingEffort = useSyncExternalStore(
    subscribe,
    getGeminiThinkingEffort,
    () => 'MEDIUM' as GeminiThinkingEffort
  );

  const apiKey = useSyncExternalStore(
    subscribe,
    () => getActiveGeminiApiKey() || '',
    () => ''
  );

  const verify = useCallback((passcodeOrKey: string): GeminiAuthResult => {
    return verifyGeminiPasscode(passcodeOrKey);
  }, []);

  const revoke = useCallback((): void => {
    revokeGeminiAuth();
  }, []);

  const setModel = useCallback((model: GeminiModelChoice): void => {
    setGeminiModel(model);
  }, []);

  const setEffort = useCallback((effort: GeminiThinkingEffort): void => {
    setGeminiThinkingEffort(effort);
  }, []);

  const updateApiKey = useCallback((key: string): void => {
    setCustomApiKey(key);
  }, []);

  return {
    isAuthenticated,
    activeModel,
    thinkingEffort,
    apiKey,
    verifyPasscode: verify,
    revokeAuth: revoke,
    setModel,
    setThinkingEffort: setEffort,
    setApiKey: updateApiKey,
  };
}
