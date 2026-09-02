'use client';

import React, { useState } from 'react';
import { Song } from '@/types/song';
import { PRESET_SONGS } from '@/lib/presets';
import {
  Mic2,
  Music,
  Columns,
  Library,
  Play,
  Pause,
  Undo2,
  Redo2,
  Keyboard,
  X,
  Leaf,
  Battery,
  BatteryCharging,
  BatteryLow,
  Sparkles,
  ScanLine,
} from 'lucide-react';

export type ActiveTabMode = 'karaoke' | 'editor' | 'split';

interface HeaderBarProps {
  song: Song;
  onSelectSong: (song: Song) => void;
  activeTab: ActiveTabMode;
  setActiveTab: (tab: ActiveTabMode) => void;
  onOpenImportExport: () => void;
  onOpenGeminiAuth?: () => void;
  onOpenScanner?: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onUndo?: () => boolean;
  onRedo?: () => boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  pastCount?: number;
  futureCount?: number;
  isEcoMode?: boolean;
  onToggleEcoMode?: () => void;
  batteryLevel?: number | null;
  isCharging?: boolean | null;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  song,
  onSelectSong,
  activeTab,
  setActiveTab,
  onOpenImportExport,
  onOpenGeminiAuth,
  onOpenScanner,
  isPlaying,
  onTogglePlay,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  pastCount = 0,
  futureCount = 0,
  isEcoMode = false,
  onToggleEcoMode,
  batteryLevel,
  isCharging,
}) => {
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 shadow-xs transition-colors select-none overflow-x-clip">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-2.5">
        {/* Logo & App Brand */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className="flex items-center justify-center w-8 sm:w-9 lg:w-10 h-8 sm:h-9 lg:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-zinc-950 font-black shadow-md shadow-amber-500/20 ring-1 ring-amber-400/40 shrink-0">
            <Music className={`w-4 sm:w-5 h-4 sm:h-5 shrink-0 ${isPlaying ? 'animate-bounce' : ''}`} />
          </div>
          <div className="hidden sm:block shrink-0">
            <h1 className="text-xs sm:text-sm lg:text-base font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 whitespace-nowrap">
              <span>台語簡譜創作與卡拉OK</span>
              <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-mono font-bold border border-amber-300/50 dark:border-amber-700/50">
                Taigi Studio
              </span>
            </h1>
            <p className="hidden xl:block text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              Jianpu Numbered Notation · Hanji · POJ · PIJ · Touch Composer Deck
            </p>
          </div>
        </div>

        {/* View Mode Switcher (Karaoke / Editor / Split) */}
        <div id="view-mode-switcher" className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 sm:p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs font-semibold shadow-inner shrink-0">
          <button
            id="tab-btn-karaoke"
            type="button"
            onClick={() => setActiveTab('karaoke')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[32px] sm:min-h-[36px] whitespace-nowrap shrink-0 ${
              activeTab === 'karaoke'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">卡拉OK</span>
          </button>

          <button
            id="tab-btn-editor"
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[32px] sm:min-h-[36px] whitespace-nowrap shrink-0 ${
              activeTab === 'editor'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">簡譜編寫</span>
          </button>

          <button
            id="tab-btn-split"
            type="button"
            onClick={() => setActiveTab('split')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[32px] sm:min-h-[36px] whitespace-nowrap shrink-0 ${
              activeTab === 'split'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Columns className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">雙視窗</span>
          </button>
        </div>

        {/* Right Action Tools: Preset Song Selector, Undo/Redo, Quick Play, Import/Export */}
        <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 shrink-0">
          {/* Preset Song Quick Picker */}
          <select
            id="header-preset-song-select"
            value={song.id}
            onChange={e => {
              const selected = PRESET_SONGS.find(p => p.id === e.target.value);
              if (selected) onSelectSong(selected);
            }}
            className="hidden lg:block text-xs font-bold bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl px-2 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-amber-500 max-w-[120px] xl:max-w-[160px] truncate cursor-pointer min-h-[34px] sm:min-h-[36px] shrink-0"
          >
            {PRESET_SONGS.map(p => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {/* Undo / Redo Action Group */}
          {onUndo && onRedo && (
            <div
              id="header-undo-redo-group"
              className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700 shrink-0"
            >
              <button
                id="header-undo-btn"
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title={canUndo ? `復原上一步 (Undo) [Ctrl+Z] · 尚有 ${pastCount} 步` : '無可復原步驟'}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[32px] sm:min-h-[34px] shrink-0"
              >
                <Undo2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden 2xl:inline whitespace-nowrap">復原</span>
                {canUndo && pastCount > 0 && (
                  <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono font-bold">
                    {pastCount}
                  </span>
                )}
              </button>

              <div className="w-[1px] h-3.5 bg-zinc-300 dark:bg-zinc-600 mx-0.5" />

              <button
                id="header-redo-btn"
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title={canRedo ? `重做下一步 (Redo) [Ctrl+Y] · 尚有 ${futureCount} 步` : '無可重做步驟'}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[32px] sm:min-h-[34px] shrink-0"
              >
                <Redo2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden 2xl:inline whitespace-nowrap">重做</span>
                {canRedo && futureCount > 0 && (
                  <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono font-bold">
                    {futureCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Quick Play/Pause Button */}
          <button
            id="header-toggle-play-btn"
            type="button"
            onClick={onTogglePlay}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[34px] sm:min-h-[36px] whitespace-nowrap shrink-0 ${
              isPlaying
                ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md shadow-amber-500/20 font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white'
            }`}
            title={isPlaying ? '暫停播放 (Space)' : '開始播放 (Space)'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current shrink-0" />
                <span className="hidden md:inline whitespace-nowrap">暫停</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current ml-0.5 shrink-0" />
                <span className="hidden md:inline whitespace-nowrap">播放</span>
              </>
            )}
          </button>

          {/* Eco / Power Saving Mode Toggle */}
          {onToggleEcoMode && (
            <button
              id="header-toggle-eco-mode-btn"
              type="button"
              onClick={onToggleEcoMode}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[34px] sm:min-h-[36px] whitespace-nowrap shrink-0 ${
                isEcoMode
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-700'
              }`}
              title={
                isEcoMode
                  ? `省電模式已開啟 (降低幀率與GPU特效)${typeof batteryLevel === 'number' ? ` · 電量 ${Math.round(batteryLevel * 100)}%` : ''}`
                  : `開啟省電模式 (Eco Mode - 適合 iPad / 手機省電)${typeof batteryLevel === 'number' ? ` · 電量 ${Math.round(batteryLevel * 100)}%` : ''}`
              }
            >
              <Leaf className={`w-3.5 h-3.5 shrink-0 ${isEcoMode ? 'text-emerald-500 fill-emerald-500' : 'text-zinc-400'}`} />
              <span className="hidden xl:inline whitespace-nowrap">{isEcoMode ? '省電中' : '省電'}</span>
              {typeof batteryLevel === 'number' && (
                <span className="text-[10px] font-mono hidden 2xl:inline-flex items-center gap-0.5 text-zinc-500 whitespace-nowrap">
                  {isCharging ? (
                    <BatteryCharging className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : batteryLevel <= 0.2 ? (
                    <BatteryLow className="w-3 h-3 text-rose-500 shrink-0" />
                  ) : (
                    <Battery className="w-3 h-3 shrink-0" />
                  )}
                  {Math.round(batteryLevel * 100)}%
                </span>
              )}
            </button>
          )}

          {/* AI Score Scanner Modal Trigger */}
          {onOpenScanner && (
            <button
              id="header-open-scanner-btn"
              type="button"
              onClick={onOpenScanner}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-amber-400/20 hover:from-amber-500/30 hover:to-amber-400/30 text-amber-900 dark:text-amber-200 rounded-xl border border-amber-400/60 dark:border-amber-600/60 text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[34px] sm:min-h-[36px] whitespace-nowrap shrink-0"
              title="AI 圖片識譜 (多頁樂譜與歌詞轉錄)"
            >
              <ScanLine className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">AI 圖片識譜</span>
            </button>
          )}

          {/* Import / Export & Library Modal */}
          <button
            id="header-open-library-btn"
            type="button"
            onClick={onOpenImportExport}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl border border-zinc-200/80 dark:border-zinc-700 text-xs font-bold transition-colors cursor-pointer touch-manipulation min-h-[34px] sm:min-h-[36px] whitespace-nowrap shrink-0"
            title="曲庫與匯入匯出"
          >
            <Library className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="hidden xl:inline whitespace-nowrap">曲庫/匯入匯出</span>
            <span className="hidden sm:inline xl:hidden whitespace-nowrap">曲庫</span>
          </button>

          {/* Gemini AI Passcode Auth Modal Trigger */}
          {onOpenGeminiAuth && (
            <button
              id="header-open-gemini-auth-btn"
              type="button"
              onClick={onOpenGeminiAuth}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 rounded-xl border border-amber-300/80 dark:border-amber-700/80 text-xs font-bold transition-colors cursor-pointer touch-manipulation min-h-[34px] sm:min-h-[36px] whitespace-nowrap shrink-0"
              title="Gemini AI 通行密碼驗證與設定 (Gemini AI Passcode Auth)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">AI 通行碼</span>
            </button>
          )}

          {/* Keyboard Shortcuts trigger */}
          <button
            id="header-shortcuts-btn"
            type="button"
            onClick={() => setShowKeyboardShortcuts(true)}
            className="hidden 2xl:flex items-center justify-center p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 transition-colors cursor-pointer min-h-[34px] min-w-[34px] shrink-0"
            title="快捷鍵指南 (Keyboard Shortcuts)"
          >
            <Keyboard className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <div
          id="shortcuts-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            id="shortcuts-modal-card"
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-zinc-100">
                <Keyboard className="w-4 h-4 text-amber-500" />
                <span>鍵盤快捷鍵指南 (Keyboard Shortcuts)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyboardShortcuts(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>播放 / 暫停 (Toggle Playback)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Space 空白鍵</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>復原上一步 (Undo)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Ctrl + Z / ⌘Z</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>重做下一步 (Redo)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Ctrl + Y / ⌘⇧Z</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>音符音高輸入 (Pitched Note 1-7)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">數字鍵 1 ~ 7</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>休止符輸入 (Rest 0)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">數字鍵 0</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>空白 / 標點留白 (Empty Space)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">E / Backspace</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>選取前後音符 (Navigate Notes)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">← / → 方向鍵</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>歌詞輸入框切換下一個音 (Next Lyric)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Tab / Enter</kbd>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowKeyboardShortcuts(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors cursor-pointer"
              >
                我知道了 (Got it)
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
