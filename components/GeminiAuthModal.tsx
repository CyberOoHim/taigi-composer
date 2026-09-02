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
import {
  isGeminiAuthenticated,
  verifyGeminiPasscode,
  revokeGeminiAuth,
  getActiveGeminiApiKey,
} from '@/lib/geminiAuth';
import { GeminiModelChoice, GeminiThinkingEffort } from '@/lib/geminiService';

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
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return isGeminiAuthenticated();
    return false;
  });
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return isGeminiAuthenticated();
    return false;
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<GeminiModelChoice>(() => {
    if (typeof window !== 'undefined') {
      const savedModel = localStorage.getItem('taigi_gemini_model') as GeminiModelChoice;
      if (savedModel) return savedModel;
    }
    return 'gemini-2.5-flash';
  });
  const [thinkingEffort, setThinkingEffort] = useState<GeminiThinkingEffort>(() => {
    if (typeof window !== 'undefined') {
      const savedEffort = localStorage.getItem('taigi_gemini_thinking_effort') as GeminiThinkingEffort;
      if (savedEffort) return savedEffort;
    }
    return 'MEDIUM';
  });

  if (!isOpen) return null;

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = verifyGeminiPasscode(passcode);
    if (result.success) {
      setIsAuthenticated(true);
      setSuccessMsg(result.message);
      // Collapse after brief success feedback
      setTimeout(() => {
        setIsCollapsed(true);
        if (onAuthSuccess) onAuthSuccess();
      }, 600);
    } else {
      setErrorMsg(result.message);
    }
  };

  const handleRevoke = () => {
    revokeGeminiAuth();
    setIsAuthenticated(false);
    setIsCollapsed(false);
    setPasscode('');
    setSuccessMsg(null);
    setErrorMsg('已清除驗證狀態與金鑰 (Authentication revoked)');
  };

  const handleModelChange = (model: GeminiModelChoice) => {
    setActiveModel(model);
    if (typeof window !== 'undefined') {
      localStorage.setItem('taigi_gemini_model', model);
    }
  };

  const handleEffortChange = (effort: GeminiThinkingEffort) => {
    setThinkingEffort(effort);
    if (typeof window !== 'undefined') {
      localStorage.setItem('taigi_gemini_thinking_effort', effort);
    }
  };

  return (
    <div
      id="gemini-auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
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
            <span>Gemini AI 存取權限驗證 (Passcode Auth)</span>
          </div>
          <button
            id="gemini-auth-close-btn"
            onClick={onClose}
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
                  <span>通行密碼已驗證 (Authenticated)</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-mono font-bold">
                  已解鎖
                </span>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Gemini AI 存取功能已就緒，支援台語歌詞多格式音節自動解析與聲調對齊。
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
                  onClick={() => setIsCollapsed(false)}
                  className="flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>展開設定 / 變更通行碼</span>
                </button>

                <button
                  id="gemini-auth-revoke-btn"
                  type="button"
                  onClick={handleRevoke}
                  className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>清除授權 (Lock)</span>
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
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-300/60 dark:border-amber-700/60 dark:bg-amber-950/30">
                <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    請輸入通行密碼 (Enter Passcode)
                  </h4>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    輸入預設通行碼（提示：<code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 rounded font-mono font-bold text-amber-800 dark:text-amber-300">taigi</code>）或填入個人 Gemini API Key 即可解鎖。
                  </p>
                </div>
              </div>

              {/* Passcode Input Field */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="gemini-auth-passcode-input"
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span>通行密碼 / API Key</span>
                  </span>
                  {isAuthenticated && (
                    <button
                      type="button"
                      onClick={() => setIsCollapsed(true)}
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <ChevronUp className="w-3 h-3" />
                      <span>收合 (Collapse)</span>
                    </button>
                  )}
                </label>

                <div className="relative flex items-center">
                  <input
                    id="gemini-auth-passcode-input"
                    type={showPasscode ? 'text' : 'password'}
                    value={passcode}
                    onChange={e => setPasscode(e.target.value)}
                    placeholder="輸入通行密碼或 AIzaSy... 金鑰"
                    autoFocus
                    className="w-full pl-3 pr-10 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
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
                    <span>模型選擇 (Model)</span>
                  </label>
                  <select
                    id="gemini-auth-model-select"
                    value={activeModel}
                    onChange={e => handleModelChange(e.target.value as GeminiModelChoice)}
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 cursor-pointer"
                  >
                    <option value="gemini-2.5-flash">gemini-2.5-flash (預設)</option>
                    <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="gemini-auth-effort-select"
                    className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1"
                  >
                    <BrainCircuit className="w-3 h-3 text-amber-500" />
                    <span>思考程度 (Thinking)</span>
                  </label>
                  <select
                    id="gemini-auth-effort-select"
                    value={thinkingEffort}
                    onChange={e => handleEffortChange(e.target.value as GeminiThinkingEffort)}
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 cursor-pointer"
                  >
                    <option value="MEDIUM">MEDIUM (預設)</option>
                    <option value="HIGH">HIGH</option>
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
                disabled={!passcode.trim()}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>驗證通行碼並解鎖 (Verify & Unlock)</span>
              </button>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs">
          <button
            id="gemini-auth-footer-close-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold transition-colors cursor-pointer"
          >
            關閉 (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
