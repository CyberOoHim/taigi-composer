'use client';

import React, { useState } from 'react';
import { KeySignature, LyricDisplayMode, Song, TimeSignature } from '@/types/song';
import { AlignLeft, ChevronDown, ChevronUp, SlidersHorizontal, Music } from 'lucide-react';

interface SongMetadataHeaderProps {
  song: Song;
  onUpdateSong: (updatedSong: Song) => void;
  displayMode: LyricDisplayMode;
  setDisplayMode: (mode: LyricDisplayMode) => void;
  onOpenAligner: () => void;
}

export const SongMetadataHeader: React.FC<SongMetadataHeaderProps> = ({
  song,
  onUpdateSong,
  displayMode,
  setDisplayMode,
  onOpenAligner,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <div
      id="song-metadata-card"
      className="p-3.5 sm:p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col gap-3 transition-all"
    >
      {/* COMPACT VIEW BAR (Default) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Song Title & Quick Stats */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
            <Music className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 tracking-tight">
                {song.title || '未命名樂曲'}
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-mono font-bold border border-amber-300/60 dark:border-amber-700/60">
                1 = {song.key}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                {song.timeSignature}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                {song.bpm} BPM
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              全曲 {song.measures.length} 小節 · {song.composer ? `曲: ${song.composer}` : '台語經典'}
            </span>
          </div>
        </div>

        {/* Right: Quick Aligner & Expand Button */}
        <div className="flex items-center gap-2">
          {/* Quick Lyric Aligner Modal Trigger */}
          <button
            id="composer-open-aligner-btn"
            type="button"
            onClick={onOpenAligner}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">歌詞對齊匯入</span>
          </button>

          {/* Expand Settings Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer min-h-[36px]"
            title={isExpanded ? '收合設定 (Collapse)' : '展開樂曲設定 (調號/拍號/速度/歌詞顯示)'}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
            <span>{isExpanded ? '收合設定' : '樂曲設定'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* EXPANDED SETTINGS PANEL */}
      {isExpanded && (
        <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Song Title Input */}
            <div className="sm:col-span-2 md:col-span-1">
              <label
                htmlFor="composer-song-title-input"
                className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
              >
                樂曲名稱 (Title)
              </label>
              <input
                id="composer-song-title-input"
                type="text"
                value={song.title}
                onChange={e => onUpdateSong({ ...song, title: e.target.value })}
                className="w-full text-sm font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                placeholder="樂曲名稱..."
              />
            </div>

            {/* Key Signature */}
            <div>
              <label
                htmlFor="composer-key-select"
                className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
              >
                調號 (Key 1=?)
              </label>
              <select
                id="composer-key-select"
                value={song.key}
                onChange={e => onUpdateSong({ ...song, key: e.target.value as KeySignature })}
                className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors cursor-pointer"
              >
                {['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                  <option key={k} value={k}>
                    1 = {k}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Signature */}
            <div>
              <label
                htmlFor="composer-time-signature-select"
                className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
              >
                拍號 (Time)
              </label>
              <select
                id="composer-time-signature-select"
                value={song.timeSignature}
                onChange={e =>
                  onUpdateSong({ ...song, timeSignature: e.target.value as TimeSignature })
                }
                className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors cursor-pointer"
              >
                <option value="4/4">4/4 拍</option>
                <option value="3/4">3/4 拍</option>
                <option value="2/4">2/4 拍</option>
                <option value="6/8">6/8 拍</option>
              </select>
            </div>

            {/* BPM */}
            <div>
              <label
                htmlFor="composer-bpm-input"
                className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
              >
                速度 (BPM)
              </label>
              <input
                id="composer-bpm-input"
                type="number"
                min="40"
                max="240"
                value={song.bpm}
                onChange={e => onUpdateSong({ ...song, bpm: parseInt(e.target.value, 10) || 80 })}
                className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono font-bold rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors text-center"
              />
            </div>
          </div>

          {/* Lyric Display Mode Selector */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-zinc-600 dark:text-zinc-400">歌詞格式:</span>
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 flex-wrap">
                <button
                  id="composer-mode-all"
                  type="button"
                  onClick={() => setDisplayMode('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    displayMode === 'all'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  全部顯示 (漢字+POJ+臺羅)
                </button>
                <button
                  id="composer-mode-hanji-poj"
                  type="button"
                  onClick={() => setDisplayMode('hanji_poj')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    displayMode === 'hanji_poj'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  漢字 + 白話字
                </button>
                <button
                  id="composer-mode-hanji-pij"
                  type="button"
                  onClick={() => setDisplayMode('hanji_pij')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    displayMode === 'hanji_pij'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  漢字 + 臺羅
                </button>
                <button
                  id="composer-mode-hanji-only"
                  type="button"
                  onClick={() => setDisplayMode('hanji_only')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    displayMode === 'hanji_only'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  純漢字
                </button>
                <button
                  id="composer-mode-poj-only"
                  type="button"
                  onClick={() => setDisplayMode('poj_only')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    displayMode === 'poj_only'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  純POJ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
