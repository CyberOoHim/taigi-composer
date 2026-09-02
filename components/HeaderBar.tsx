'use client';

import React from 'react';
import { Song } from '@/types/song';
import { PRESET_SONGS } from '@/lib/presets';
import {
  Mic2,
  Music,
  Columns,
  Download,
  Upload,
  Sparkles,
  Library,
  Play,
  Pause,
  Undo2,
  Redo2,
} from 'lucide-react';

export type ActiveTabMode = 'karaoke' | 'editor' | 'split';

interface HeaderBarProps {
  song: Song;
  onSelectSong: (song: Song) => void;
  activeTab: ActiveTabMode;
  setActiveTab: (tab: ActiveTabMode) => void;
  onOpenImportExport: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onUndo?: () => boolean;
  onRedo?: () => boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  pastCount?: number;
  futureCount?: number;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  song,
  onSelectSong,
  activeTab,
  setActiveTab,
  onOpenImportExport,
  isPlaying,
  onTogglePlay,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  pastCount = 0,
  futureCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & App Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-zinc-950 font-black shadow-md shadow-amber-500/20">
            <Music className="w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>台語簡譜創作與卡拉OK</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono">
                Taigi Studio
              </span>
            </h1>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Jianpu Numbered Notation · Hanji · POJ · PIJ · Karaoke Engine
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div id="view-mode-switcher" className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold">
          <button
            id="tab-btn-karaoke"
            onClick={() => setActiveTab('karaoke')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'karaoke'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>卡拉OK機 (Karaoke)</span>
          </button>

          <button
            id="tab-btn-editor"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'editor'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>簡譜編寫 (Composer)</span>
          </button>

          <button
            id="tab-btn-split"
            onClick={() => setActiveTab('split')}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'split'
                ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>雙視窗 (Split View)</span>
          </button>
        </div>

        {/* Right Action Tools: Undo/Redo, Song Selector, Quick Play, Import/Export */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo Action Group */}
          {onUndo && onRedo && (
            <div
              id="header-undo-redo-group"
              className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700"
            >
              <button
                id="header-undo-btn"
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title={canUndo ? `復原上一步 (Undo) [Ctrl+Z / ⌘Z] · 尚有 ${pastCount} 步可復原` : '無可復原的步驟 (Undo) [Ctrl+Z]'}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">復原</span>
                {canUndo && pastCount > 0 && (
                  <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono">
                    {pastCount}
                  </span>
                )}
              </button>

              <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-600 mx-0.5" />

              <button
                id="header-redo-btn"
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title={canRedo ? `重做下一步 (Redo) [Ctrl+Y / ⌘⇧Z] · 尚有 ${futureCount} 步可重做` : '無可重做的步驟 (Redo) [Ctrl+Y]'}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">重做</span>
                {canRedo && futureCount > 0 && (
                  <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono">
                    {futureCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Preset Song Quick Picker */}
          <select
            id="header-preset-song-select"
            value={song.id}
            onChange={e => {
              const selected = PRESET_SONGS.find(p => p.id === e.target.value);
              if (selected) onSelectSong(selected);
            }}
            className="hidden lg:block text-xs font-semibold bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-amber-500 max-w-[160px] truncate"
          >
            {PRESET_SONGS.map(p => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {/* Quick Play/Pause Button */}
          <button
            id="header-toggle-play-btn"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>暫停 (Pause)</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                <span>播放 (Play)</span>
              </>
            )}
          </button>

          {/* Import / Export & Library Modal */}
          <button
            id="header-open-library-btn"
            onClick={onOpenImportExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold transition-colors"
            title="曲庫與匯入匯出"
          >
            <Library className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">曲庫/匯入匯出</span>
          </button>
        </div>
      </div>
    </header>
  );
};
