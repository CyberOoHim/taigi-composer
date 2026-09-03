'use client';

import React, { useState } from 'react';
import { KeySignature, LyricDisplayMode, Song, TimeSignature } from '@/types/song';
import {
  AlignLeft,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Music,
  ScanLine,
  FilePlus2,
  FileEdit,
} from 'lucide-react';

interface SongMetadataHeaderProps {
  song: Song;
  onUpdateSong: (updatedSong: Song) => void;
  displayMode: LyricDisplayMode;
  setDisplayMode: (mode: LyricDisplayMode) => void;
  onOpenAligner: () => void;
  onOpenScanner?: () => void;
  onStartFreshSong?: () => void;
  onOpenOrganizer?: () => void;
  incompleteMeasuresCount?: number;
}

export const SongMetadataHeader: React.FC<SongMetadataHeaderProps> = React.memo(({
  song,
  onUpdateSong,
  displayMode,
  setDisplayMode,
  onOpenAligner,
  onOpenScanner,
  onStartFreshSong,
  onOpenOrganizer,
  incompleteMeasuresCount = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <div
      id="song-metadata-card"
      className="p-3.5 sm:p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col gap-3 transition-all"
    >
      {/* COMPACT VIEW BAR (Always visible, default state) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Song Title, Badges, Credits & Clamped Description */}
        <div className="flex items-start gap-3 flex-1 min-w-[240px]">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 mt-0.5">
            <Music className="w-4 h-4" />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            {/* Title & Musical Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                id="compact-song-title"
                className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 tracking-tight cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5"
                onClick={() => setIsExpanded(prev => !prev)}
                title="點擊展開編輯樂曲資訊與設定"
              >
                <span>{song.title || '未命名樂曲'}</span>
                <FileEdit className="w-3.5 h-3.5 text-zinc-400 opacity-60 hover:opacity-100" />
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

            {/* Necessary Metadata: Measure Count & Composer/Lyricist Credits */}
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>全曲 {song.measures.length} 小節</span>
              <span>·</span>
              <span>{song.composer ? `曲: ${song.composer}` : '台語經典'}</span>
              {song.lyricist && (
                <>
                  <span>·</span>
                  <span>詞: {song.lyricist}</span>
                </>
              )}
              {song.subtitle && (
                <>
                  <span>·</span>
                  <span className="italic text-zinc-400 max-w-[200px] truncate">{song.subtitle}</span>
                </>
              )}
            </div>

            {/* Limited-length Description (Clamped to 1 line, full text in tooltip) */}
            {song.description ? (
              <p
                id="compact-song-description"
                className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1 max-w-2xl truncate mt-1 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                title={song.description}
                onClick={() => setIsExpanded(prev => !prev)}
              >
                <span className="font-semibold text-zinc-500 dark:text-zinc-500 mr-1">簡介:</span>
                {song.description}
              </p>
            ) : (
              <p
                id="compact-song-description-empty"
                className="text-[11px] text-zinc-400 dark:text-zinc-500 italic mt-0.5 cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                onClick={() => setIsExpanded(true)}
              >
                （尚無簡介，點擊「樂曲設定」展開填寫背景說明與詞曲作者）
              </p>
            )}
          </div>
        </div>

        {/* Right: Quick Actions & Expand Settings Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Start Fresh Song Trigger */}
          {onStartFreshSong && (
            <button
              id="composer-new-song-btn"
              type="button"
              onClick={onStartFreshSong}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700 font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title="建立全新空白樂曲 (New Song)"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">新建樂曲</span>
            </button>
          )}

          {/* AI Score Scanner Modal Trigger */}
          {onOpenScanner && (
            <button
              id="composer-open-scanner-btn"
              type="button"
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title="AI 圖片識譜匯入 (最多 3 頁)"
            >
              <ScanLine className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">圖片識譜匯入</span>
            </button>
          )}

          {/* Quick Lyric Aligner Modal Trigger */}
          <button
            id="composer-open-aligner-btn"
            type="button"
            onClick={onOpenAligner}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
            title="歌詞對齊匯入"
          >
            <AlignLeft className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            <span className="hidden sm:inline">歌詞對齊</span>
          </button>

          {/* Measure Organizer & Rhythm Health Trigger */}
          {onOpenOrganizer && (
            <button
              id="composer-meta-organizer-btn"
              type="button"
              onClick={onOpenOrganizer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title="小節總覽、拍數檢查與版面排版"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">小節排版</span>
              {incompleteMeasuresCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-rose-600 text-white rounded-full font-mono font-black" title={`${incompleteMeasuresCount} 個小節拍數未滿或超拍`}>
                  {incompleteMeasuresCount}
                </span>
              )}
            </button>
          )}

          {/* Expand Settings Toggle */}
          <button
            id="composer-expand-settings-btn"
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs rounded-xl border transition-all cursor-pointer min-h-[36px] ${
              isExpanded
                ? 'bg-amber-500/15 border-amber-400/80 dark:border-amber-600/80 text-amber-900 dark:text-amber-200'
                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
            }`}
            title={isExpanded ? '收合設定 (Collapse)' : '展開樂曲設定 (名稱/簡介/作詞/作曲/調號/速度)'}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
            <span>{isExpanded ? '收合設定' : '樂曲設定'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* EXPANDED SETTINGS & METADATA PANEL (Default closed) */}
      {isExpanded && (
        <div
          id="composer-expanded-metadata-panel"
          className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-4 animate-in fade-in duration-150"
        >
          {/* Section 1: Basic Song Information */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              樂曲基本資訊 (Song Information)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Song Title */}
              <div>
                <label
                  htmlFor="composer-song-title-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  樂曲名稱 (Title) *
                </label>
                <input
                  id="composer-song-title-input"
                  type="text"
                  value={song.title}
                  onChange={e => onUpdateSong({ ...song, title: e.target.value })}
                  className="w-full text-sm font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="例如：望春風..."
                />
              </div>

              {/* Subtitle / Alternate Name */}
              <div>
                <label
                  htmlFor="composer-song-subtitle-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  副標題 / 英文 (Subtitle)
                </label>
                <input
                  id="composer-song-subtitle-input"
                  type="text"
                  value={song.subtitle || ''}
                  onChange={e => onUpdateSong({ ...song, subtitle: e.target.value })}
                  className="w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="例如：Taiwanese Folk Song..."
                />
              </div>

              {/* Composer */}
              <div>
                <label
                  htmlFor="composer-song-composer-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  作曲者 (Composer)
                </label>
                <input
                  id="composer-song-composer-input"
                  type="text"
                  value={song.composer || ''}
                  onChange={e => onUpdateSong({ ...song, composer: e.target.value })}
                  className="w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="例如：鄧雨賢..."
                />
              </div>

              {/* Lyricist */}
              <div>
                <label
                  htmlFor="composer-song-lyricist-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  作詞者 (Lyricist)
                </label>
                <input
                  id="composer-song-lyricist-input"
                  type="text"
                  value={song.lyricist || ''}
                  onChange={e => onUpdateSong({ ...song, lyricist: e.target.value })}
                  className="w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="例如：李臨秋..."
                />
              </div>
            </div>
          </div>

          {/* Section 2: Lengthy Description Multi-line Input */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="composer-song-description-textarea"
              className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
            >
              樂曲簡介與創作背景解說 (Description / Historical Background)
            </label>
            <textarea
              id="composer-song-description-textarea"
              rows={3}
              value={song.description || ''}
              onChange={e => onUpdateSong({ ...song, description: e.target.value })}
              className="w-full text-xs font-normal leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all resize-y"
              placeholder="在此輸入樂曲背景介紹、創作歷史、文化意涵、演唱注意事項或樂器伴奏指示..."
            />
          </div>

          {/* Section 3: Musical Parameters & Layout */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              樂理調式與版面設定 (Musical & Layout Settings)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
                  速度 (BPM 40~240)
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

              {/* Notes / Measures Per Line */}
              <div>
                <label
                  htmlFor="composer-notes-per-line-select"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  每行顯示小節數
                </label>
                <select
                  id="composer-notes-per-line-select"
                  value={song.notesPerLine || 4}
                  onChange={e =>
                    onUpdateSong({ ...song, notesPerLine: parseInt(e.target.value, 10) || 4 })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors cursor-pointer"
                >
                  <option value="2">2 小節 / 行</option>
                  <option value="3">3 小節 / 行</option>
                  <option value="4">4 小節 / 行 (預設)</option>
                  <option value="5">5 小節 / 行</option>
                  <option value="6">6 小節 / 行</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Lyric Display Mode Selector & Collapse Button */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs gap-3">
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

            {/* Done & Collapse Button */}
            <button
              id="composer-collapse-settings-footer-btn"
              type="button"
              onClick={() => setIsExpanded(false)}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
            >
              完成並收合設定 (Done)
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

SongMetadataHeader.displayName = 'SongMetadataHeader';

