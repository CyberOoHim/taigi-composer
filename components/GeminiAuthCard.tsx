'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  BrainCircuit,
  ShieldCheck,
  LogOut,
  Settings,
} from 'lucide-react';
import { useGeminiAuth } from '@/hooks/useGeminiAuth';
import type { GeminiModelChoice, GeminiThinkingEffort } from '@/lib/geminiService';

export interface GeminiAuthCardProps {
  title?: string;
  description?: string;
  onOpenFullSettings?: () => void;
  showModelControls?: boolean;
  idPrefix?: string;
  className?: string;
}

export const GeminiAuthCard: React.FC<GeminiAuthCardProps> = ({
  title = 'Gemini AI Configuration',
  description = 'Enter the passcode to enable Gemini AI features (Default hint: taigi or personal API Key).',
  onOpenFullSettings,
  showModelControls = true,
  idPrefix = 'gemini-auth',
  className = '',
}) => {
  const {
    isAuthenticated,
    activeModel,
    thinkingEffort,
    apiKey,
    verifyPasscode,
    revokeAuth,
    setModel,
    setThinkingEffort,
    setApiKey,
  } = useGeminiAuth();

  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isAuthExpanded, setIsAuthExpanded] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const result = verifyPasscode(passcode);
    if (result.success) {
      setAuthSuccess(result.message);
      setPasscode('');
      setTimeout(() => {
        setIsAuthExpanded(false);
        setAuthSuccess(null);
      }, 700);
    } else {
      setAuthError(result.message);
    }
  };

  const handleRevoke = () => {
    revokeAuth();
    setPasscode('');
    setAuthSuccess(null);
    setAuthError('Passcode authorization revoked and credentials cleared.');
    setIsAuthExpanded(false);
  };

  return (
    <div
      id={`${idPrefix}-panel`}
      className={`p-3.5 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300/60 dark:border-amber-700/60 rounded-xl flex flex-col gap-3 animate-in fade-in duration-150 ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenFullSettings && (
            <button
              type="button"
              onClick={onOpenFullSettings}
              className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 hover:underline cursor-pointer"
              title="Open Gemini AI Settings & Passcode Dialog"
            >
              <Settings className="w-3 h-3" />
              <span>All AI Settings</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowApiKeyInput(prev => !prev)}
            className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 hover:underline cursor-pointer"
          >
            <Key className="w-3 h-3" />
            <span>{showApiKeyInput ? 'Hide Key' : 'Custom Key'}</span>
          </button>
        </div>
      </div>

      {/* AUTH STATUS / PASSCODE SECTION */}
      {isAuthenticated && !isAuthExpanded ? (
        /* Collapsed Authenticated Badge */
        <div
          id={`${idPrefix}-collapsed-bar`}
          className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 dark:bg-emerald-950/40 dark:border-emerald-800/60 text-xs animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold flex-wrap">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Gemini API Passcode Verified</span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
              {activeModel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              id={`${idPrefix}-expand-toggle-btn`}
              type="button"
              onClick={() => {
                if (onOpenFullSettings) {
                  onOpenFullSettings();
                } else {
                  setIsAuthExpanded(true);
                }
              }}
              className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 cursor-pointer hover:underline"
              title="Change passcode or manage Gemini settings"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Change Passcode</span>
            </button>
            <button
              id={`${idPrefix}-revoke-btn`}
              type="button"
              onClick={handleRevoke}
              className="text-[11px] text-red-600 dark:text-red-400 hover:underline cursor-pointer p-0.5 ml-1"
              title="Revoke Passcode Authorization (Lock AI)"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Expanded Passcode Form */
        <div
          id={`${idPrefix}-expanded-box`}
          className="p-3 bg-white dark:bg-zinc-800/90 border border-amber-300/80 dark:border-amber-700/80 rounded-xl flex flex-col gap-2.5 shadow-2xs animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
              <Lock className="w-4 h-4 text-amber-500" />
              <span>{isAuthenticated ? 'Change Passcode' : 'Gemini AI Passcode Authorization'}</span>
            </div>
            {isAuthenticated && (
              <button
                id={`${idPrefix}-collapse-toggle-btn`}
                type="button"
                onClick={() => setIsAuthExpanded(false)}
                className="flex items-center gap-0.5 text-[11px] text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
              >
                <ChevronUp className="w-3 h-3" />
                <span>Collapse</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {description}{' '}
            <span className="inline-block">
              (Hint: <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 rounded font-mono font-bold">taigi</code> or personal API Key).
            </span>
          </p>

          <form onSubmit={handleVerify} className="flex gap-2">
            <div className="relative flex-1 flex items-center">
              <input
                id={`${idPrefix}-passcode-input`}
                type={showPasscode ? 'text' : 'password'}
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                placeholder="Enter passcode (e.g. taigi) or API Key"
                className="w-full pl-3 pr-8 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                title={showPasscode ? 'Hide passcode' : 'Show passcode'}
              >
                {showPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              id={`${idPrefix}-verify-passcode-btn`}
              type="submit"
              disabled={!passcode.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-xs rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Verify & Unlock</span>
            </button>
          </form>

          {authError && (
            <div
              id={`${idPrefix}-error-msg`}
              className="p-2 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div
              id={`${idPrefix}-success-msg`}
              className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}
        </div>
      )}

      {/* Model & Thinking Effort Selection */}
      {showModelControls && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${idPrefix}-model-select`}
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-500" />
              <span>Gemini Model</span>
            </label>
            <select
              id={`${idPrefix}-model-select`}
              value={activeModel}
              onChange={e => setModel(e.target.value as GeminiModelChoice)}
              className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="gemini-3.7-flash">1. gemini-3.7-flash (Recommended · Full Quality)</option>
              <option value="gemini-3.7-flash-lite">2. gemini-3.7-flash-lite (Fast · Lightweight)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${idPrefix}-effort-select`}
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
            >
              <BrainCircuit className="w-3.5 h-3.5 text-amber-500" />
              <span>Thinking Effort</span>
            </label>
            <select
              id={`${idPrefix}-effort-select`}
              value={thinkingEffort}
              onChange={e => setThinkingEffort(e.target.value as GeminiThinkingEffort)}
              className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="HIGH">HIGH (Deep Theory Reasoning)</option>
              <option value="MEDIUM">MEDIUM (Standard)</option>
              <option value="LOW">LOW (Quick response)</option>
              <option value="OFF">OFF (No thinking pause)</option>
            </select>
          </div>
        </div>
      )}

      {/* Optional Custom Key Input */}
      {showApiKeyInput && (
        <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/50 flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-custom-key-input`}
            className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400"
          >
            Gemini API Key (Custom Personal Key)
          </label>
          <input
            id={`${idPrefix}-custom-key-input`}
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="AIzaSy... (leave empty to use default env key)"
            className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
          />
        </div>
      )}
    </div>
  );
};
