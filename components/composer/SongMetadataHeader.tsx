'use client';

import React from 'react';
import { KeySignature, LyricDisplayMode, Song, TimeSignature } from '@/types/song';
import { AlignLeft, Sparkles, Music } from 'lucide-react';

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
  return (
    <div
      id="song-metadata-card"
      className="p-5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col gap-4 transition-all"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Song Title Input */}
        <div className="flex-1 min-w-[240px]">
          <label
            htmlFor="composer-song-title-input"
            className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5"
          >
            樂曲名稱 (Song Title)
          </label>
          <div className="relative flex items-center">
            <input
              id="composer-song-title-input"
              type="text"
              value={song.title}
              onChange={e => onUpdateSong({ ...song, title: e.target.value })}
              className="w-full text-base sm:text-lg font-extrabold text-zinc-900 dark:text-zinc-100 bg-zinc-50/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-zinc-850 transition-all placeholder:text-zinc-400"
              placeholder="望春風 (Bāng Chhun-hong)"
            />
          </div>
        </div>

        {/* Musical Settings (Key, Time, BPM, Aligner) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Key Signature */}
          <div>
            <label
              htmlFor="composer-key-select"
              className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5"
            >
              調號 (Key 1=?)
            </label>
            <select
              id="composer-key-select"
              value={song.key}
              onChange={e => onUpdateSong({ ...song, key: e.target.value as KeySignature })}
              className="bg-zinc-50/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors cursor-pointer"
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
              className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5"
            >
              拍號 (Time)
            </label>
            <select
              id="composer-time-signature-select"
              value={song.timeSignature}
              onChange={e =>
                onUpdateSong({ ...song, timeSignature: e.target.value as TimeSignature })
              }
              className="bg-zinc-50/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors cursor-pointer"
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
              className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5"
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
              className="w-20 bg-zinc-50/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono font-bold rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors text-center"
            />
          </div>

          {/* Batch Lyric Aligner Trigger */}
          <div className="self-end">
            <button
              id="composer-open-aligner-btn"
              type="button"
              onClick={onOpenAligner}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/15 transition-all active:scale-95 cursor-pointer"
            >
              <AlignLeft className="w-4 h-4" />
              <span>整段歌詞對齊匯入</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lyric Display Mode Bar */}
      <div
        id="composer-lyric-mode-bar"
        className="flex flex-wrap items-center justify-between pt-3 border-t border-zinc-200/80 dark:border-zinc-800 text-xs gap-3"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-zinc-500 dark:text-zinc-400">歌詞顯示:</span>
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
            <button
              id="composer-mode-all"
              type="button"
              onClick={() => setDisplayMode('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                displayMode === 'poj_only'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              純POJ
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
          <span>全曲共 {song.measures.length} 小節</span>
          <span>·</span>
          <span className="text-amber-600 dark:text-amber-400 font-semibold">
            點擊曲譜音符即可原地編輯簡譜與歌詞
          </span>
        </div>
      </div>
    </div>
  );
};
