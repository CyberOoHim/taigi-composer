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
  Save,
  Check,
  ChevronDown,
  SlidersHorizontal,
  Download,
} from 'lucide-react';
import { useGeminiAuth } from '@/hooks/useGeminiAuth';
import { UiZoomControl } from '@/components/UiZoomControl';
import { ChordPlaybackControl } from '@/components/ChordPlaybackControl';


export type ActiveTabMode = 'karaoke' | 'editor' | 'split';

interface HeaderBarProps {
  song: Song;
  onSelectSong: (song: Song) => void;
  onStartFreshSong?: () => void;
  activeTab: ActiveTabMode;
  setActiveTab: (tab: ActiveTabMode) => void;
  onOpenImportExport: () => void;
  onOpenMidiExport?: () => void;
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
  onSave?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  saveSuccess?: boolean;
  autosaveInterval?: number;
  onSetAutosaveInterval?: (intervalMs: number) => void;
  customSongs?: Song[];
  modifiedPresetIds?: Set<string>;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  song,
  onSelectSong,
  onStartFreshSong,
  activeTab,
  setActiveTab,
  onOpenImportExport,
  onOpenMidiExport,
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
  onSave,
  isSaving = false,
  isDirty = false,
  saveSuccess = false,
  autosaveInterval = 0,
  onSetAutosaveInterval,
  customSongs = [],
  modifiedPresetIds = new Set(),
}) => {
  const { isAuthenticated, hasApiKey } = useGeminiAuth();
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [isExpanderOpen, setIsExpanderOpen] = useState<boolean>(true);

  const handleToggleExpander = () => {
    setIsExpanderOpen(prev => !prev);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#10121a]/95 backdrop-blur-md eco-flat-shadow border-b border-zinc-200/90 dark:border-zinc-800/80 shadow-xs transition-colors select-none pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Left: Studio Brand & Active Song Status */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-950 font-black shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50 shrink-0">
            <Music className={`w-4 sm:w-5 h-4 sm:h-5 shrink-0 ${isPlaying && !isEcoMode ? 'animate-bounce' : ''}`} />
            {isPlaying && !isEcoMode && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-zinc-950 animate-ping" />
            )}
            {isPlaying && isEcoMode && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-zinc-950" />
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

        {/* Scrollable Action Rail (DAW Monitor Mode Rocker + Expander Bar Trigger) */}
        <div
          id="header-nav-scroll-container"
          className="flex-1 min-w-0 flex items-center justify-between gap-2 sm:gap-4 overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain py-1 pl-1 pr-1"
        >
          {/* Center: DAW Monitor Mode Rocker (Karaoke / Editor / Split) */}
          <div id="view-mode-switcher" className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] p-1 rounded-xl border border-zinc-200/90 dark:border-zinc-800/80 shadow-inner shrink-0 sm:mx-auto">
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

          {/* Right: Expander Bar Trigger & Quick Playback */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            {/* If toolbar is collapsed, provide quick Play/Pause in header */}
            {!isExpanderOpen && (
              <button
                id="header-quick-play-btn"
                type="button"
                onClick={onTogglePlay}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] whitespace-nowrap shrink-0 ${
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
            )}

            {/* Expander Bar Toggle Button (Default Opened) */}
            <button
              id="header-expander-toggle-btn"
              type="button"
              onClick={handleToggleExpander}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] shrink-0 ${
                isExpanderOpen
                  ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-400/50 dark:border-amber-600/50 shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141720] dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/90 dark:border-zinc-700/80'
              }`}
              aria-expanded={isExpanderOpen}
              title={isExpanderOpen ? '收合工具列 (Collapse Studio Toolbar)' : '展開工具列 (Expand Studio Toolbar)'}
            >
              <SlidersHorizontal className={`w-4 h-4 shrink-0 ${isExpanderOpen ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'}`} />
              <span className="whitespace-nowrap">
                {isExpanderOpen ? '收合工具' : '展開工具'}
              </span>
              {isDirty && !isExpanderOpen && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" title="有尚未儲存的修改" />
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${isExpanderOpen ? 'rotate-180 text-amber-600 dark:text-amber-400' : 'text-zinc-400'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Expander Bar Under Header Bar (Default Opened) */}
      <div
        id="header-expander-bar"
        className={`w-full border-t border-zinc-200/90 dark:border-zinc-800/80 bg-zinc-50/95 dark:bg-[#0d0f16]/95 backdrop-blur-md transition-all duration-200 ease-in-out overflow-hidden ${
          isExpanderOpen
            ? 'max-h-40 opacity-100 py-2 sm:py-2.5 shadow-xs'
            : 'max-h-0 opacity-0 py-0 border-t-0 pointer-events-none'
        }`}
      >
        <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
          {/* Left Sub-Rail: Master Transport & Primary Song Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
                  <span className="whitespace-nowrap">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current ml-0.5 shrink-0" />
                  <span className="whitespace-nowrap">Play</span>
                </>
              )}
            </button>

            {/* Eco / Power Saving Mode. Battery % is Chromium-only (not iPad Safari). */}
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
                    ? `Eco 已開啟：較輕音訊、螢幕可能休眠、降低 GPU${typeof batteryLevel === 'number' ? ` · 電量 ${Math.round(batteryLevel * 100)}%` : ''}`
                    : `開啟 Eco：較輕音訊、螢幕可能休眠、降低 GPU${typeof batteryLevel === 'number' ? ` · 電量 ${Math.round(batteryLevel * 100)}%` : ''}`
                }
              >
                <Leaf className={`w-3.5 h-3.5 shrink-0 ${isEcoMode ? 'text-emerald-500 fill-emerald-500' : 'text-zinc-400'}`} />
                <span className="whitespace-nowrap">{isEcoMode ? 'Eco ON' : 'Eco'}</span>
                <span className="hidden md:inline text-[10px] font-medium opacity-80">
                  {isEcoMode ? '螢幕可休眠' : '開啟後螢幕可休眠'}
                </span>
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

            {/* Chord Playback Control (Toggle & Volume Slider - Global) */}
            <ChordPlaybackControl variant="toolbar" previewKeyChord={song.key} idPrefix="header-chord" />

            <div className="w-[1px] h-5 bg-zinc-300 dark:bg-zinc-700/80 mx-0.5 shrink-0" />

            {/* Song Quick Picker (Presets + Custom Library) */}
            <select
              id="header-preset-song-select"
              value={song.id}
              onChange={e => {
                const selectedPreset = PRESET_SONGS.find(p => p.id === e.target.value);
                if (selectedPreset) {
                  onSelectSong(selectedPreset);
                  return;
                }
                const selectedCustom = customSongs.find(s => s.id === e.target.value);
                if (selectedCustom) {
                  onSelectSong(selectedCustom);
                }
              }}
              className="text-xs font-bold bg-zinc-50 dark:bg-[#141720] border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-amber-500 max-w-[170px] truncate cursor-pointer min-h-[38px] sm:min-h-[40px] shrink-0"
              title="選擇樂譜 (預設曲目與自訂庫存)"
            >
              <optgroup label="預設曲目 (Presets)">
                {PRESET_SONGS.map(p => {
                  const isModified = modifiedPresetIds.has(p.id);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.title} {isModified ? '★ (已修改)' : ''}
                    </option>
                  );
                })}
              </optgroup>
              {customSongs.length > 0 && (
                <optgroup label={`自訂樂譜 (${customSongs.length})`}>
                  {customSongs.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title || '未命名樂曲'}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {/* User Save & Autosave Interval Module */}
            {onSave && (
              <div
                id="header-save-module"
                className="flex items-center bg-zinc-100 dark:bg-[#141720] p-0.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shrink-0"
              >
                <button
                  id="header-save-btn"
                  type="button"
                  onClick={onSave}
                  disabled={isSaving}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] sm:min-h-[38px] shrink-0 ${
                    isSaving
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      : saveSuccess
                      ? 'bg-emerald-500 text-white font-black shadow-xs'
                      : isDirty
                      ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black shadow-xs'
                      : 'text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800'
                  }`}
                  title={
                    isDirty
                      ? '儲存修改至 IndexedDB [Ctrl+S] (有尚未儲存的修改)'
                      : '目前修改已安全保存在 IndexedDB [Ctrl+S]'
                  }
                >
                  {saveSuccess ? (
                    <Check className="w-4 h-4 shrink-0" />
                  ) : (
                    <Save className={`w-4 h-4 shrink-0 ${isDirty ? 'text-zinc-950' : 'text-amber-500'}`} />
                  )}
                  <span className="whitespace-nowrap">
                    {isSaving
                      ? '儲存中...'
                      : saveSuccess
                      ? '已儲存'
                      : isDirty
                      ? '儲存 (未存)'
                      : '儲存'}
                  </span>
                  {isDirty && !isSaving && !saveSuccess && (
                    <span className="w-2 h-2 rounded-full bg-amber-950 dark:bg-amber-950 animate-ping inline-block" />
                  )}
                </button>

                {onSetAutosaveInterval && (
                  <>
                    <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />
                    <select
                      id="header-autosave-interval-select"
                      value={autosaveInterval}
                      onChange={e => onSetAutosaveInterval(Number(e.target.value))}
                      className="text-[11px] font-semibold bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 px-1 py-1 rounded-md cursor-pointer focus:outline-hidden"
                      title="自動儲存至 IndexedDB 頻率設定"
                    >
                      <option value={0} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                        手動儲存 (預設)
                      </option>
                      <option value={60000} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                        每 1 分鐘自動存
                      </option>
                      <option value={180000} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                        每 3 分鐘自動存
                      </option>
                      <option value={300000} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                        每 5 分鐘自動存
                      </option>
                      <option value={600000} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                        每 10 分鐘自動存
                      </option>
                    </select>
                  </>
                )}
              </div>
            )}

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
                  <span className="whitespace-nowrap">Undo</span>
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
                  <span className="whitespace-nowrap">Redo</span>
                  {canRedo && futureCount > 0 && (
                    <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono font-bold">
                      {futureCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right Sub-Rail: Library, Creative Tools & Settings */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
                <span className="whitespace-nowrap">New Song</span>
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
              <span className="whitespace-nowrap">Library</span>
            </button>

            {/* Direct Export MIDI Trigger */}
            {onOpenMidiExport && (
              <button
                id="header-export-midi-btn"
                type="button"
                onClick={onOpenMidiExport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] sm:min-h-[40px] whitespace-nowrap shrink-0"
                title="Export MIDI with Synchronized Lyrics (.mid / .kar)"
              >
                <Download className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="whitespace-nowrap">MIDI</span>
              </button>
            )}

            {/* AI Score Scanner Modal Trigger */}
            {onOpenScanner && (
              <button
                id="header-open-scanner-btn"
                type="button"
                onClick={hasApiKey ? onOpenScanner : undefined}
                disabled={!hasApiKey}
                aria-disabled={!hasApiKey}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  hasApiKey
                    ? 'bg-gradient-to-r from-amber-500/20 to-amber-400/20 hover:from-amber-500/30 hover:to-amber-400/30 text-amber-900 dark:text-amber-200 border-amber-400/60 dark:border-amber-600/60 active:scale-95 cursor-pointer touch-manipulation min-h-[38px] sm:min-h-[40px]'
                    : 'bg-zinc-100/80 dark:bg-zinc-900/60 text-zinc-400 dark:text-zinc-500 border-zinc-200/80 dark:border-zinc-800/80 opacity-50 cursor-not-allowed min-h-[38px] sm:min-h-[40px] select-none'
                }`}
                title={
                  hasApiKey
                    ? 'AI Score OCR (Multi-page score & lyrics transcription)'
                    : 'AI Score Scanner muted (Gemini API key not configured in environment)'
                }
              >
                <ScanLine className={`w-4 h-4 shrink-0 ${hasApiKey ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
                <span className="whitespace-nowrap">
                  {hasApiKey ? 'AI Scanner' : 'AI Scanner (Muted)'}
                </span>
              </button>
            )}

            {/* Gemini AI Passcode Auth Modal Trigger */}
            {onOpenGeminiAuth && (
              <button
                id="header-open-gemini-auth-btn"
                type="button"
                onClick={onOpenGeminiAuth}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] sm:min-h-[40px] whitespace-nowrap shrink-0 ${
                  !hasApiKey
                    ? 'bg-zinc-100/80 dark:bg-zinc-900/60 text-zinc-400 dark:text-zinc-500 border-zinc-200/80 dark:border-zinc-800/80 opacity-60 hover:opacity-90 hover:border-zinc-400 dark:hover:border-zinc-700'
                    : isAuthenticated
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-400/80 dark:border-emerald-700/80'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300/80 dark:border-amber-700/80'
                }`}
                title={
                  !hasApiKey
                    ? 'Gemini AI & Passcode Auth muted (No Gemini API key configured in environment)'
                    : isAuthenticated
                    ? 'Gemini AI Unlocked · Manage passcode & settings'
                    : 'Gemini AI Passcode & Settings'
                }
              >
                {!hasApiKey ? (
                  <Sparkles className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                ) : isAuthenticated ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span className="whitespace-nowrap">
                  {!hasApiKey ? 'AI Muted' : isAuthenticated ? 'AI Unlocked' : 'AI Passcode'}
                </span>
              </button>
            )}

            {/* Global UI Text Zoom (- / +) Control */}
            <UiZoomControl idPrefix="header-expander-ui-zoom" />

            {/* Keyboard Shortcuts Trigger */}
            <button
              id="header-shortcuts-btn"
              type="button"
              onClick={() => setShowKeyboardShortcuts(true)}
              className="flex items-center justify-center p-2 rounded-xl bg-zinc-100 dark:bg-[#141720] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/90 dark:border-zinc-700/80 transition-all active:scale-95 cursor-pointer min-h-[38px] sm:min-h-[40px] min-w-[38px] sm:min-w-[40px] shrink-0"
              title="Keyboard Shortcuts"
            >
              <Keyboard className="w-4 h-4 shrink-0" />
            </button>
          </div>
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

              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
                <span className="font-bold">Save Score (IndexedDB)</span>
                <kbd className="px-2 py-0.5 rounded bg-amber-500/20 dark:bg-amber-500/30 font-mono font-bold text-amber-800 dark:text-amber-200">Ctrl + S / ⌘S</kbd>
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
                <span>Move Note (Backward / Forward)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Alt + ← / Alt + →</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>Insert Note (Before / After)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Shift + I (Before) / I (After)</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>Next Lyric (羅馬字 / 漢羅)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Tab / Space / Enter</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>UI Text Zoom In</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Alt + + / Option + +</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>UI Text Zoom Out</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Alt + - / Option + -</kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                <span>Reset UI Text Zoom (100%)</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono font-bold text-zinc-800 dark:text-zinc-200">Alt + 0 / Option + 0</kbd>
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
