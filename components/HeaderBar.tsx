'use client';

import React, { useState, useEffect } from 'react';
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
  Search,
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
  onOpenLyricSearch?: () => void;
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
  onOpenLyricSearch,
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
  const [isStudioMenuOpen, setIsStudioMenuOpen] = useState<boolean>(false);

  // Close Studio popup when Escape is pressed
  useEffect(() => {
    if (!isStudioMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsStudioMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStudioMenuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#10121a]/95 backdrop-blur-md border-b border-zinc-200/90 dark:border-zinc-800/80 shadow-xs transition-colors select-none pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      <div className="w-full max-w-[1680px] mx-auto px-2 sm:px-4 h-14 flex items-center justify-between gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar touch-pan-x">
        {/* Left: Studio Brand & Active Song Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-950 font-black shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50 shrink-0">
            <Music className={`w-4 h-4 shrink-0 ${isPlaying && !isEcoMode ? 'animate-bounce' : ''}`} />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-zinc-950 animate-ping" />
            )}
          </div>

          {/* Song Quick Picker & Metadata Badge */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="relative flex items-center min-w-0 max-w-[120px] sm:max-w-[170px] md:max-w-[210px] xl:max-w-[240px]">
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
                className="w-full text-xs font-bold bg-zinc-100 hover:bg-zinc-200/80 dark:bg-[#151822] dark:hover:bg-[#1a1e2b] border border-zinc-200/90 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 rounded-xl pl-2.5 pr-6 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-amber-500 truncate cursor-pointer h-9 transition-colors"
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
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 pointer-events-none" />
            </div>

            {/* Quick Song Spec Chip */}
            <span className="hidden xl:inline-flex items-center text-[11px] px-2 py-1 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 font-mono font-bold border border-amber-400/30 whitespace-nowrap shrink-0">
              1={song.key} · {song.timeSignature} · {song.bpm}BPM
            </span>

            {/* New Song Quick Button */}
            {onStartFreshSong && (
              <button
                id="header-new-song-btn"
                type="button"
                onClick={onStartFreshSong}
                className="hidden sm:flex items-center justify-center p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#151822] dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl border border-zinc-200/90 dark:border-zinc-750 text-xs font-bold transition-all active:scale-95 cursor-pointer h-9 w-9 shrink-0"
                title="建立全新空白樂譜 (New Blank Song)"
              >
                <FilePlus2 className="w-4 h-4 text-amber-500 shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Center: DAW Monitor Mode Rocker (Karaoke / Editor / Split) */}
        <div id="view-mode-switcher" className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] p-1 rounded-xl border border-zinc-200/90 dark:border-zinc-800/80 shadow-inner shrink-0">
          <button
            id="tab-btn-karaoke"
            type="button"
            onClick={() => setActiveTab('karaoke')}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 md:px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer touch-manipulation h-8 whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'karaoke'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-semibold'
            }`}
            title="Karaoke Stage"
          >
            <Mic2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">Karaoke</span>
          </button>

          <button
            id="tab-btn-editor"
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 md:px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer touch-manipulation h-8 whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'editor'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-semibold'
            }`}
            title="Score Editor"
          >
            <Music className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden lg:inline whitespace-nowrap">Score Editor</span>
            <span className="hidden sm:inline lg:hidden whitespace-nowrap">Editor</span>
          </button>

          <button
            id="tab-btn-split"
            type="button"
            onClick={() => setActiveTab('split')}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 md:px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer touch-manipulation h-8 whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'split'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-semibold'
            }`}
            title="Split Studio View"
          >
            <Columns className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">Split</span>
          </button>
        </div>

        {/* Right: Master Transport & Consolidated Studio Tools */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
          {/* Master Transport Backlit Play/Pause Button */}
          <button
            id="header-toggle-play-btn"
            type="button"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation h-9 whitespace-nowrap shrink-0 ${
              isPlaying
                ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md shadow-amber-500/30 font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white'
            }`}
            title={isPlaying ? 'Pause Playback (Space)' : 'Play Full Song (Space)'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current shrink-0" />
                <span className="hidden md:inline whitespace-nowrap">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current ml-0.5 shrink-0" />
                <span className="hidden md:inline whitespace-nowrap">Play</span>
              </>
            )}
          </button>

          {/* User Save Button with Dirty Dot */}
          {onSave && (
            <button
              id="header-save-btn"
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation h-9 shrink-0 border ${
                isSaving
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/40'
                  : saveSuccess
                  ? 'bg-emerald-500 text-white font-black border-emerald-400 shadow-xs'
                  : isDirty
                  ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black border-amber-400 shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-[#151822] dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200/90 dark:border-zinc-750'
              }`}
              title={
                isDirty
                  ? '儲存修改至 IndexedDB [Ctrl+S] (有尚未儲存的修改)'
                  : '目前修改已安全保存在 IndexedDB [Ctrl+S]'
              }
            >
              {saveSuccess ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Save className={`w-3.5 h-3.5 shrink-0 ${isDirty ? 'text-zinc-950' : 'text-amber-500'}`} />
              )}
              <span className="hidden sm:inline whitespace-nowrap">
                {isSaving ? '存...' : saveSuccess ? '已存' : isDirty ? '儲存*' : '儲存'}
              </span>
              {isDirty && !isSaving && !saveSuccess && (
                <span className="w-2 h-2 rounded-full bg-amber-950 dark:bg-amber-900 animate-ping inline-block shrink-0" />
              )}
            </button>
          )}

          {/* Master Transport Undo / Redo Module */}
          {onUndo && onRedo && (
            <div
              id="header-undo-redo-group"
              className="hidden lg:flex items-center bg-zinc-100 dark:bg-[#151822] p-0.5 rounded-xl border border-zinc-200/90 dark:border-zinc-750 h-9 shrink-0"
            >
              <button
                id="header-undo-btn"
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title={canUndo ? `Undo [Ctrl+Z] · ${pastCount} step(s) left` : 'No steps to undo'}
                className="flex items-center justify-center p-1.5 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer h-7.5 w-7.5 shrink-0"
              >
                <Undo2 className="w-3.5 h-3.5 shrink-0" />
              </button>

              <div className="w-[1px] h-3.5 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />

              <button
                id="header-redo-btn"
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title={canRedo ? `Redo [Ctrl+Y] · ${futureCount} step(s) left` : 'No steps to redo'}
                className="flex items-center justify-center p-1.5 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer h-7.5 w-7.5 shrink-0"
              >
                <Redo2 className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          )}

          {/* Quick Lyric Search Trigger */}
          {onOpenLyricSearch && (
            <button
              id="header-top-search-btn"
              type="button"
              onClick={onOpenLyricSearch}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer h-9 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#151822] dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/90 dark:border-zinc-750 shrink-0"
              title="搜尋歌詞與樂譜 [Ctrl+K / ⌘K]"
            >
              <Search className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="hidden xl:inline whitespace-nowrap">搜尋</span>
              <kbd className="hidden lg:inline text-[10px] px-1 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700/80 font-mono font-bold text-zinc-600 dark:text-zinc-400">⌘K</kbd>
            </button>
          )}

          {/* Consolidated Studio Menu Dropdown Trigger (⋯ / Sliders) */}
          <button
            id="header-studio-menu-btn"
            type="button"
            onClick={() => setIsStudioMenuOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer h-9 shrink-0 ${
              isStudioMenuOpen
                ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-xs font-black'
                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-[#151822] dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/90 dark:border-zinc-750'
            }`}
            title="Studio Tools & Settings (伴奏和弦、Eco、縮放、MIDI、AI等)"
            aria-expanded={isStudioMenuOpen}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">Studio</span>
            {isEcoMode && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Eco Mode Active" />
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${isStudioMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Click-away backdrop */}
      {isStudioMenuOpen && (
        <div
          id="header-studio-menu-backdrop"
          className="fixed inset-0 z-40 bg-black/25 dark:bg-black/45 backdrop-blur-[1px] animate-in fade-in duration-150"
          onClick={() => setIsStudioMenuOpen(false)}
        />
      )}

      {/* Consolidated Studio Menu Popover Card - Viewport Clamped & Never Clipped */}
      {isStudioMenuOpen && (
        <div
          id="header-studio-menu-popover"
          role="dialog"
          aria-modal="true"
          aria-label="Studio Deck & Tools"
          className="fixed top-14 right-2 sm:right-4 z-50 w-[min(384px,calc(100vw-16px))] max-h-[calc(100dvh-68px)] overflow-y-auto no-scrollbar p-4 bg-white dark:bg-[#141720] border border-zinc-200 dark:border-zinc-750 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3.5"
        >
          {/* Header in Popover */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Studio Deck & Tools
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsStudioMenuOpen(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section 1: Playback Accompaniment & Audio */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Accompaniment & Playback
            </span>

            {/* Chord Playback Control */}
            <div className="p-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
                  和弦伴奏 (Chords)
                </span>
              </div>
              <ChordPlaybackControl variant="toolbar" previewKeyChord={song.key} idPrefix="header-chord" />
            </div>

            {/* Eco / Power Save Mode */}
            {onToggleEcoMode && (
              <button
                id="header-popover-eco-btn"
                type="button"
                onClick={onToggleEcoMode}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isEcoMode
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 shadow-xs'
                    : 'bg-zinc-100/80 hover:bg-zinc-200/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border-zinc-200 dark:border-zinc-750'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Leaf className={`w-4 h-4 shrink-0 ${isEcoMode ? 'text-emerald-500 fill-emerald-500' : 'text-zinc-400 dark:text-zinc-400'}`} />
                  <div className="flex flex-col text-left">
                    <span className="font-bold">{isEcoMode ? '節能模式已開啟 (Eco ON)' : '節能省電模式 (Eco Mode)'}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {isEcoMode ? '螢幕可休眠 · 輕量音訊' : '較輕音訊 · 降低GPU負載'}
                    </span>
                  </div>
                </div>
                {typeof batteryLevel === 'number' && (
                  <span className="text-[11px] font-mono flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                    {isCharging ? (
                      <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" />
                    ) : batteryLevel <= 0.2 ? (
                      <BatteryLow className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <Battery className="w-3.5 h-3.5" />
                    )}
                    <span>{Math.round(batteryLevel * 100)}%</span>
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Section 2: Display & UI Text Zoom */}
          <div className="flex flex-col gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                UI Zoom & Autosave
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
                介面字級縮放
              </span>
              <UiZoomControl idPrefix="header-menu-ui-zoom" />
            </div>

            {/* Autosave Interval */}
            {onSetAutosaveInterval && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
                  自動儲存頻率
                </span>
                <select
                  id="header-menu-autosave-select"
                  value={autosaveInterval}
                  onChange={e => onSetAutosaveInterval(Number(e.target.value))}
                  className="text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 px-2.5 py-1 rounded-lg cursor-pointer focus:outline-hidden"
                >
                  <option value={0}>手動儲存 (預設)</option>
                  <option value={60000}>每 1 分鐘</option>
                  <option value={180000}>每 3 分鐘</option>
                  <option value={300000}>每 5 分鐘</option>
                  <option value={600000}>每 10 分鐘</option>
                </select>
              </div>
            )}
          </div>

          {/* Section 3: Creation, Import & AI Tools */}
          <div className="flex flex-col gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Project & AI Tools
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* Song Library */}
              <button
                type="button"
                onClick={() => {
                  setIsStudioMenuOpen(false);
                  onOpenImportExport();
                }}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-100/80 hover:bg-zinc-200/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-750 text-xs font-bold transition-all cursor-pointer"
              >
                <Library className="w-4 h-4 text-amber-500 shrink-0" />
                <span>曲庫與匯入</span>
              </button>

              {/* MIDI Export */}
              {onOpenMidiExport && (
                <button
                  type="button"
                  onClick={() => {
                    setIsStudioMenuOpen(false);
                    onOpenMidiExport();
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-100/80 hover:bg-zinc-200/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-750 text-xs font-bold transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>匯出 MIDI</span>
                </button>
              )}

              {/* AI Scanner */}
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={() => {
                    if (hasApiKey) {
                      setIsStudioMenuOpen(false);
                      onOpenScanner();
                    }
                  }}
                  disabled={!hasApiKey}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    hasApiKey
                      ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border-amber-400/40 cursor-pointer'
                      : 'bg-zinc-100/60 dark:bg-zinc-900/60 text-zinc-400 dark:text-zinc-500 border-zinc-200/60 dark:border-zinc-800 cursor-not-allowed opacity-50'
                  }`}
                >
                  <ScanLine className={`w-4 h-4 shrink-0 ${hasApiKey ? 'text-amber-500' : 'text-zinc-400'}`} />
                  <span>AI 辨識樂譜</span>
                </button>
              )}

              {/* Gemini AI Settings */}
              {onOpenGeminiAuth && (
                <button
                  type="button"
                  onClick={() => {
                    setIsStudioMenuOpen(false);
                    onOpenGeminiAuth();
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    !hasApiKey
                      ? 'bg-zinc-100/80 dark:bg-zinc-850 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-750'
                      : isAuthenticated
                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-400/40'
                  }`}
                >
                  {isAuthenticated ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span>{isAuthenticated ? 'AI 已解鎖' : 'AI 設定'}</span>
                </button>
              )}
            </div>

            {/* Shortcuts Button */}
            <button
              type="button"
              onClick={() => {
                setIsStudioMenuOpen(false);
                setShowKeyboardShortcuts(true);
              }}
              className="flex items-center justify-center gap-2 p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-colors cursor-pointer"
            >
              <Keyboard className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
              <span>鍵盤快捷鍵一覽 (Shortcuts Guide)</span>
            </button>
          </div>
        </div>
      )}

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

              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
                <span className="font-bold">Lyric Search / Spotlight</span>
                <kbd className="px-2 py-0.5 rounded bg-amber-500/20 dark:bg-amber-500/30 font-mono font-bold text-amber-800 dark:text-amber-200">Ctrl + K / ⌘K</kbd>
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
