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
  ShieldCheck,
  ScanLine,
  FilePlus2,
} from 'lucide-react';
import { useGeminiAuth } from '@/hooks/useGeminiAuth';


export type ActiveTabMode = 'karaoke' | 'editor' | 'split';

interface HeaderBarProps {
  song: Song;
  onSelectSong: (song: Song) => void;
  onStartFreshSong?: () => void;
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
  onStartFreshSong,
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
  const { isAuthenticated } = useGeminiAuth();
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#10121a]/95 backdrop-blur-md border-b border-zinc-200/90 dark:border-zinc-800/80 shadow-xs transition-colors select-none pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Left: Studio Brand & Active Song Status */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-950 font-black shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50 shrink-0">
            <Music className={`w-4 sm:w-5 h-4 sm:h-5 shrink-0 ${isPlaying ? 'animate-bounce' : ''}`} />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-zinc-950 animate-ping" />
            )}
          </div>
          <div className="hidden sm:flex flex-col shrink-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex items-center gap-1.5">
                <span>Taigi Composer</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono font-bold border border-amber-400/30">
                  DAW Studio
                </span>
              </h1>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap font-mono">
              1={song.key} · {song.timeSignature} · {song.bpm}BPM
            </p>
          </div>
        </div>

        {/* Center: DAW Monitor Mode Rocker (Karaoke / Editor / Split) */}
        <div id="view-mode-switcher" className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] p-1 rounded-xl border border-zinc-200/90 dark:border-zinc-800/80 shadow-inner shrink-0">
          <button
            id="tab-btn-karaoke"
            type="button"
            onClick={() => setActiveTab('karaoke')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer touch-manipulation min-h-[38px] whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'karaoke'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-semibold'
            }`}
            title="Karaoke View"
          >
            <Mic2 className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Karaoke</span>
          </button>

          <button
            id="tab-btn-editor"
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer touch-manipulation min-h-[38px] whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'editor'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-semibold'
            }`}
            title="Score Editor"
          >
            <Music className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Score Editor</span>
          </button>

          <button
            id="tab-btn-split"
            type="button"
            onClick={() => setActiveTab('split')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer touch-manipulation min-h-[38px] whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'split'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-semibold'
            }`}
            title="Split Studio View"
          >
            <Columns className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Split View</span>
          </button>
        </div>

        {/* Right: Master Transport & iPad-Accessible Utility Rail */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink min-w-0 overflow-x-auto no-scrollbar py-0.5">
          {/* Preset Song Quick Picker (Accessible on iPad widths md+) */}
          <select
            id="header-preset-song-select"
            value={song.id}
            onChange={e => {
              const selected = PRESET_SONGS.find(p => p.id === e.target.value);
              if (selected) onSelectSong(selected);
            }}
            className="hidden md:block text-xs font-bold bg-zinc-50 dark:bg-[#141720] border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-amber-500 max-w-[150px] truncate cursor-pointer min-h-[38px] shrink-0"
            title="Select Preset Song"
          >
            {PRESET_SONGS.map(p => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {/* Master Transport Undo / Redo Module */}
          {onUndo && onRedo && (
            <div
              id="header-undo-redo-group"
              className="flex items-center bg-zinc-100 dark:bg-[#141720] p-0.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shrink-0"
            >
              <button
                id="header-undo-btn"
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title={canUndo ? `Undo [Ctrl+Z] · ${pastCount} step(s) left` : 'No steps to undo'}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] sm:min-h-[38px] shrink-0"
              >
                <Undo2 className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">Undo</span>
                {canUndo && pastCount > 0 && (
                  <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono font-bold">
                    {pastCount}
                  </span>
                )}
              </button>

              <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />

              <button
                id="header-redo-btn"
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title={canRedo ? `Redo [Ctrl+Y] · ${futureCount} step(s) left` : 'No steps to redo'}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] sm:min-h-[38px] shrink-0"
              >
                <Redo2 className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">Redo</span>
                {canRedo && futureCount > 0 && (
                  <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono font-bold">
                    {futureCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Master Transport Backlit Play/Pause Button */}
          <button
            id="header-toggle-play-btn"
            type="button"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] sm:min-h-[40px] whitespace-nowrap shrink-0 ${
              isPlaying
                ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md shadow-amber-500/30 font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white'
            }`}
            title={isPlaying ? 'Pause Playback (Space)' : 'Play Full Song (Space)'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current ml-0.5 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">Play</span>
              </>
            )}
          </button>

          {/* Eco / Power Saving Mode (iPad Battery Monitor) */}
          {onToggleEcoMode && (
            <button
              id="header-toggle-eco-mode-btn"
              type="button"
              onClick={onToggleEcoMode}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] sm:min-h-[40px] whitespace-nowrap shrink-0 ${
                isEcoMode
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141720] dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200/90 dark:border-zinc-700/80'
              }`}
              title={
                isEcoMode
                  ? `Eco Mode Active (Reduced frame rate and GPU effects)${typeof batteryLevel === 'number' ? ` · Battery ${Math.round(batteryLevel * 100)}%` : ''}`
                  : `Enable Eco Mode (Power saving for mobile & tablet)${typeof batteryLevel === 'number' ? ` · Battery ${Math.round(batteryLevel * 100)}%` : ''}`
              }
            >
              <Leaf className={`w-3.5 h-3.5 shrink-0 ${isEcoMode ? 'text-emerald-500 fill-emerald-500' : 'text-zinc-400'}`} />
              <span className="hidden lg:inline whitespace-nowrap">{isEcoMode ? 'Eco ON' : 'Eco'}</span>
              {typeof batteryLevel === 'number' && (
                <span className="text-[11px] font-mono inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  {isCharging ? (
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : batteryLevel <= 0.2 ? (
                    <BatteryLow className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  ) : (
                    <Battery className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{Math.round(batteryLevel * 100)}%</span>
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-amber-400/20 hover:from-amber-500/30 hover:to-amber-400/30 text-amber-900 dark:text-amber-200 rounded-xl border border-amber-400/60 dark:border-amber-600/60 text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] sm:min-h-[40px] whitespace-nowrap shrink-0"
              title="AI Score OCR (Multi-page score & lyrics transcription)"
            >
              <ScanLine className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">AI Scanner</span>
            </button>
          )}

          {/* Start Fresh Song Trigger */}
          {onStartFreshSong && (
            <button
              id="header-new-song-btn"
              type="button"
              onClick={onStartFreshSong}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141720] dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] sm:min-h-[40px] whitespace-nowrap shrink-0"
              title="Create New Blank Song"
            >
              <FilePlus2 className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">New Song</span>
            </button>
          )}

          {/* Import / Export & Library Modal */}
          <button
            id="header-open-library-btn"
            type="button"
            onClick={onOpenImportExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141720] dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] sm:min-h-[40px] whitespace-nowrap shrink-0"
            title="Song Library, Import & Export"
          >
            <Library className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">Library</span>
          </button>

          {/* Gemini AI Passcode Auth Modal Trigger */}
          {onOpenGeminiAuth && (
            <button
              id="header-open-gemini-auth-btn"
              type="button"
              onClick={onOpenGeminiAuth}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] sm:min-h-[40px] whitespace-nowrap shrink-0 ${
                isAuthenticated
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-400/80 dark:border-emerald-700/80'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300/80 dark:border-amber-700/80'
              }`}
              title={isAuthenticated ? 'Gemini AI Unlocked · Manage passcode & settings' : 'Gemini AI Passcode & Settings'}
            >
              {isAuthenticated ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <span className="hidden xl:inline whitespace-nowrap">
                {isAuthenticated ? 'AI Unlocked' : 'AI Passcode'}
              </span>
            </button>
          )}

          {/* Keyboard Shortcuts Trigger (Visible on iPad landscape & desktop) */}
          <button
            id="header-shortcuts-btn"
            type="button"
            onClick={() => setShowKeyboardShortcuts(true)}
            className="flex items-center justify-center p-2 rounded-xl bg-zinc-100 dark:bg-[#141720] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/90 dark:border-zinc-700/80 transition-all active:scale-95 cursor-pointer min-h-[38px] min-w-[38px] shrink-0"
            title="Keyboard Shortcuts"
          >
            <Keyboard className="w-4 h-4 shrink-0" />
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
                <span>Keyboard Shortcuts Guide</span>
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
                <span>Play / Pause</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Space</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>Undo</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Ctrl + Z / ⌘Z</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>Redo</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Ctrl + Y / ⌘⇧Z</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>Pitch Input (Numbered 1-7)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Number Keys 1 ~ 7</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>Rest Note (0)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Number Key 0</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>Empty / Spacer Note</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">E / Backspace</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>Navigate Notes</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">← / → Arrow Keys</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>Next Lyric Syllable</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Tab / Enter</kbd>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowKeyboardShortcuts(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
