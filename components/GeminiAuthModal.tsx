'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Cpu,
  BrainCircuit,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useGeminiAuth } from '@/hooks/useGeminiAuth';
import type { GeminiModelChoice, GeminiThinkingEffort } from '@/lib/geminiService';

interface GeminiAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
}

export const GeminiAuthModal: React.FC<GeminiAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const {
    isAuthenticated,
    hasApiKey,
    activeModel,
    thinkingEffort,
    verifyPasscode,
    revokeAuth,
    setModel,
    setThinkingEffort,
  } = useGeminiAuth();

  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isCollapsed = isAuthenticated && !isManuallyExpanded;

  const handleClose = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setPasscode('');
    setIsManuallyExpanded(false);
    onClose();
  };

  if (!isOpen) return null;

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = verifyPasscode(passcode);
    if (result.success) {
      setSuccessMsg(result.message);
      setPasscode('');
      setTimeout(() => {
        setIsManuallyExpanded(false);
        if (onAuthSuccess) onAuthSuccess();
      }, 600);
    } else {
      setErrorMsg(result.message);
    }
  };

  const handleRevoke = () => {
    revokeAuth();
    setIsManuallyExpanded(false);
    setPasscode('');
    setSuccessMsg(null);
    setErrorMsg('Authentication revoked and credentials cleared.');
  };


  return (
    <div
      id="gemini-auth-modal-backdrop"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="gemini-auth-modal-card"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-base">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>Gemini AI Passcode & Settings</span>
          </div>
          <button
            id="gemini-auth-close-btn"
            onClick={handleClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4">
          {/* Authenticated Collapsed View */}
          {isAuthenticated && isCollapsed ? (
            <div
              id="gemini-auth-collapsed-panel"
              className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 dark:bg-emerald-950/20 dark:border-emerald-800/50 flex flex-col gap-3 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Passcode Authenticated</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-mono font-bold">
                  Unlocked
                </span>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Gemini AI access is active across all composer tools (AI Score Scanner & Quick Lyric Aligner). Single-entry authentication is synced app-wide.
              </p>

              {/* Collapsed Model & Effort Summary */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-emerald-500/20 dark:border-emerald-800/40">
                <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <Cpu className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                    {activeModel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <BrainCircuit className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                    Effort: {thinkingEffort}
                  </span>
                </div>
              </div>

              {/* Action Buttons in Collapsed State */}
              <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20 dark:border-emerald-800/40">
                <button
                  id="gemini-auth-expand-btn"
                  type="button"
                  onClick={() => setIsManuallyExpanded(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Change Passcode / Preferences</span>
                </button>

                <button
                  id="gemini-auth-revoke-btn"
                  type="button"
                  onClick={handleRevoke}
                  className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Revoke Access (Lock)</span>
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Auth Form */
            <form
              id="gemini-auth-form"
              onSubmit={handleVerify}
              className="flex flex-col gap-4 animate-in fade-in duration-200"
            >
              {!hasApiKey ? (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      AI 功能與通行密碼已靜音 (AI & Passcode Auth Muted)
                    </h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      伺服器環境中未設定 Gemini API 金鑰 (<code>GEMINI_API_KEY</code>)。依安全性設計，前端不提供手動輸入 API 金鑰，全站 AI 功能及通行密碼驗證目前已靜音停用。請由系統管理員於伺服器環境變數設定金鑰後重新載入。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-300/60 dark:border-amber-700/60 dark:bg-amber-950/30">
                  <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      {isAuthenticated ? 'Update Authorization' : 'Enter Passcode Once for All Features'}
                    </h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Enter the default passcode (Hint:{' '}
                      <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 rounded font-mono font-bold text-amber-800 dark:text-amber-300">
                        taigi
                      </code>
                      ). Once authenticated, access is automatically synchronized across the AI Score Scanner and Quick Lyric Aligner.
                    </p>
                  </div>
                </div>
              )}

              {/* Passcode Input Field */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="gemini-auth-passcode-input"
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span>Passcode</span>
                  </span>
                  {isAuthenticated && (
                    <button
                      type="button"
                      onClick={() => setIsManuallyExpanded(false)}
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <ChevronUp className="w-3 h-3" />
                      <span>Collapse</span>
                    </button>
                  )}
                </label>

                <div className="relative flex items-center">
                  <input
                    id="gemini-auth-passcode-input"
                    type={showPasscode ? 'text' : 'password'}
                    value={passcode}
                    onChange={e => setPasscode(e.target.value)}
                    disabled={!hasApiKey}
                    placeholder={
                      !hasApiKey
                        ? '密碼驗證已靜音 (未設定環境金鑰)'
                        : 'Enter passcode (e.g. taigi)'
                    }
                    autoFocus={hasApiKey}
                    className={`w-full pl-3 pr-10 py-2.5 text-sm rounded-xl font-mono border ${
                      !hasApiKey
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
                        : 'bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    disabled={!hasApiKey}
                    className="absolute right-3 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer disabled:opacity-40"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* AI Model & Thinking Effort Preferences */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="gemini-auth-model-select"
                    className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1"
                  >
                    <Cpu className="w-3 h-3 text-amber-500" />
                    <span>Model Choice</span>
                  </label>
                  <select
                    id="gemini-auth-model-select"
                    value={activeModel}
                    onChange={e => setModel(e.target.value as GeminiModelChoice)}
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 cursor-pointer"
                  >
                    <option value="gemini-3.7-flash">gemini-3.7-flash (Default)</option>
                    <option value="gemini-3.7-flash-lite">gemini-3.7-flash-lite</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="gemini-auth-effort-select"
                    className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1"
                  >
                    <BrainCircuit className="w-3 h-3 text-amber-500" />
                    <span>Thinking Effort</span>
                  </label>
                  <select
                    id="gemini-auth-effort-select"
                    value={thinkingEffort}
                    onChange={e => setThinkingEffort(e.target.value as GeminiThinkingEffort)}
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 cursor-pointer"
                  >
                    <option value="MEDIUM">MEDIUM (Default)</option>
                    <option value="HIGH">HIGH (Deep Theory)</option>
                    <option value="LOW">LOW</option>
                    <option value="OFF">OFF</option>
                  </select>
                </div>
              </div>

              {/* Feedback Notifications */}
              {errorMsg && (
                <div
                  id="gemini-auth-error-msg"
                  className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-center gap-2 animate-in fade-in"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div
                  id="gemini-auth-success-msg"
                  className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-in fade-in"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Submit / Action Button */}
              <button
                id="gemini-auth-verify-btn"
                type="submit"
                disabled={!passcode.trim() || !hasApiKey}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all ${
                  !hasApiKey
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 disabled:opacity-50 cursor-pointer'
                }`}
              >
                <Unlock className="w-4 h-4" />
                <span>{!hasApiKey ? '密碼驗證已靜音' : 'Verify & Unlock App-Wide'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs">
          <button
            id="gemini-auth-footer-close-btn"
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
