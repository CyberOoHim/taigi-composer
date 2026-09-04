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
  Mic2,
  Play,
  Square,
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
  onPlayKaraoke?: (startMeasureIndex?: number) => void;
  isPlaying?: boolean;
  onStopPlayback?: () => void;
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
  onPlayKaraoke,
  isPlaying = false,
  onStopPlayback,
  incompleteMeasuresCount = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <div
      id="song-metadata-card"
      className="p-3.5 sm:p-4 bg-white/95 dark:bg-[#141720]/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl shadow-xs flex flex-col gap-3 transition-all select-none"
    >
      {/* COMPACT VIEW BAR (DAW Project Inspector Strip) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Song Title, LCD Telemetry, Credits & Description */}
        <div className="flex items-start gap-3 flex-1 min-w-[240px]">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 mt-0.5 border border-amber-500/20">
            <Music className="w-4.5 h-4.5" />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            {/* Title & Musical Hardware LCD Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                id="compact-song-title"
                className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 tracking-tight cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5 touch-manipulation"
                onClick={() => setIsExpanded(prev => !prev)}
                title="Click to expand song information and settings"
              >
                <span>{song.title || 'Untitled Song'}</span>
                <FileEdit className="w-3.5 h-3.5 text-zinc-400 opacity-60 hover:opacity-100" />
              </h3>

              <span className="daw-lcd text-xs px-2.5 py-0.5 rounded-lg font-mono font-bold shadow-xs">
                1 = {song.key}
              </span>

              <span className="daw-lcd text-xs px-2 py-0.5 rounded-lg font-mono font-bold shadow-xs">
                {song.timeSignature}
              </span>

              <span className="daw-lcd text-xs px-2 py-0.5 rounded-lg font-mono font-bold shadow-xs">
                {song.bpm} BPM
              </span>
            </div>

            {/* Necessary Metadata: Measure Count & Composer/Lyricist Credits */}
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-semibold">{song.measures.length} Measures</span>
              <span>·</span>
              <span>{song.composer ? `Music: ${song.composer}` : 'Taigi Traditional'}</span>
              {song.lyricist && (
                <>
                  <span>·</span>
                  <span>Lyrics: {song.lyricist}</span>
                </>
              )}
              {song.subtitle && (
                <>
                  <span>·</span>
                  <span className="italic text-zinc-400 max-w-[200px] truncate">{song.subtitle}</span>
                </>
              )}
            </div>

            {/* Limited-length Description */}
            {song.description ? (
              <p
                id="compact-song-description"
                className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1 max-w-2xl truncate mt-1 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                title={song.description}
                onClick={() => setIsExpanded(prev => !prev)}
              >
                <span className="font-semibold text-zinc-500 mr-1">About:</span>
                {song.description}
              </p>
            ) : (
              <p
                id="compact-song-description-empty"
                className="text-[11px] text-zinc-400 dark:text-zinc-500 italic mt-0.5 cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                onClick={() => setIsExpanded(true)}
              >
                (No description yet. Click &ldquo;Song Settings&rdquo; to add background notes and credits)
              </p>
            )}
          </div>
        </div>

        {/* Right: Quick Actions & Settings Toggle (Touch Targets >= 40px) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Karaoke Play / Stop Playback Trigger */}
          {isPlaying && onStopPlayback ? (
            <button
              id="composer-meta-stop-btn"
              type="button"
              onClick={onStopPlayback}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px] animate-pulse"
              title="Stop audio playback"
            >
              <Square className="w-3.5 h-3.5 fill-current text-white" />
              <span>Stop Playback</span>
            </button>
          ) : onPlayKaraoke ? (
            <button
              id="composer-meta-karaoke-play-btn"
              type="button"
              onClick={() => onPlayKaraoke()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title="Directly jump to Karaoke Stage and play"
            >
              <Mic2 className="w-4 h-4 text-zinc-950" />
              <Play className="w-3.5 h-3.5 fill-current text-zinc-950" />
              <span>Karaoke Play</span>
            </button>
          ) : null}

          {/* Start Fresh Song Trigger */}
          {onStartFreshSong && (
            <button
              id="composer-new-song-btn"
              type="button"
              onClick={onStartFreshSong}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#0a0c10] dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/90 dark:border-zinc-700/80 font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title="Create New Blank Song"
            >
              <FilePlus2 className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">New Song</span>
            </button>
          )}

          {/* AI Score Scanner Modal Trigger */}
          {onOpenScanner && (
            <button
              id="composer-open-scanner-btn"
              type="button"
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title="AI Score OCR Import (Up to 3 pages)"
            >
              <ScanLine className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">AI Scanner</span>
            </button>
          )}

          {/* Quick Lyric Aligner Modal Trigger */}
          <button
            id="composer-open-aligner-btn"
            type="button"
            onClick={onOpenAligner}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#0a0c10] dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
            title="Lyric Aligner Import"
          >
            <AlignLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            <span className="hidden sm:inline">Lyric Aligner</span>
          </button>

          {/* Verse & Measure Organizer and Layout Trigger */}
          {onOpenOrganizer && (
            <button
              id="composer-meta-organizer-btn"
              type="button"
              onClick={onOpenOrganizer}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title="Open Verse & Measure Organizer and Layout Inspector"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Organizer &amp; Layout</span>
              {incompleteMeasuresCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-rose-600 text-white rounded-full font-mono font-black shadow-xs" title={`${incompleteMeasuresCount} measure(s) under or over beat limit`}>
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
            className={`flex items-center gap-1.5 px-3.5 py-1.5 font-bold text-xs rounded-xl border transition-all cursor-pointer min-h-[40px] touch-manipulation ${
              isExpanded
                ? 'bg-amber-500/15 border-amber-400/80 dark:border-amber-600/80 text-amber-900 dark:text-amber-200'
                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-[#0a0c10] dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200/90 dark:border-zinc-700/80'
            }`}
            title={isExpanded ? 'Collapse Settings' : 'Expand Song Settings (Title, Composer, Key, BPM, etc.)'}
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-500" />
            <span>{isExpanded ? 'Collapse' : 'Song Settings'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
              Song Information
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Song Title */}
              <div>
                <label
                  htmlFor="composer-song-title-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  Title *
                </label>
                <input
                  id="composer-song-title-input"
                  type="text"
                  value={song.title}
                  onChange={e => onUpdateSong({ ...song, title: e.target.value })}
                  className="w-full text-sm font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="e.g. Bang Chhun-hong..."
                />
              </div>

              {/* Subtitle / Alternate Name */}
              <div>
                <label
                  htmlFor="composer-song-subtitle-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  Subtitle / English
                </label>
                <input
                  id="composer-song-subtitle-input"
                  type="text"
                  value={song.subtitle || ''}
                  onChange={e => onUpdateSong({ ...song, subtitle: e.target.value })}
                  className="w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="e.g. Taiwanese Folk Song..."
                />
              </div>

              {/* Composer */}
              <div>
                <label
                  htmlFor="composer-song-composer-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  Composer
                </label>
                <input
                  id="composer-song-composer-input"
                  type="text"
                  value={song.composer || ''}
                  onChange={e => onUpdateSong({ ...song, composer: e.target.value })}
                  className="w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="e.g. Teng Yu-hsien..."
                />
              </div>

              {/* Lyricist */}
              <div>
                <label
                  htmlFor="composer-song-lyricist-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  Lyricist
                </label>
                <input
                  id="composer-song-lyricist-input"
                  type="text"
                  value={song.lyricist || ''}
                  onChange={e => onUpdateSong({ ...song, lyricist: e.target.value })}
                  className="w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="e.g. Li Lin-chiu..."
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
              Description & Historical Background
            </label>
            <textarea
              id="composer-song-description-textarea"
              rows={3}
              value={song.description || ''}
              onChange={e => onUpdateSong({ ...song, description: e.target.value })}
              className="w-full text-xs font-normal leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all resize-y"
              placeholder="Enter song background notes, history, cultural context, singing tips, or accompaniment notes..."
            />
          </div>

          {/* Section 3: Musical Parameters & Layout */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Musical Parameters & Layout
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Key Signature */}
              <div>
                <label
                  htmlFor="composer-key-select"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  Key (1=?)
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
                  Time Signature
                </label>
                <select
                  id="composer-time-signature-select"
                  value={song.timeSignature}
                  onChange={e =>
                    onUpdateSong({ ...song, timeSignature: e.target.value as TimeSignature })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors cursor-pointer"
                >
                  <option value="4/4">4/4</option>
                  <option value="3/4">3/4</option>
                  <option value="2/4">2/4</option>
                  <option value="6/8">6/8</option>
                </select>
              </div>

              {/* BPM */}
              <div>
                <label
                  htmlFor="composer-bpm-input"
                  className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
                >
                  Tempo (BPM 40-240)
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
                  Measures Per Line
                </label>
                <select
                  id="composer-notes-per-line-select"
                  value={song.notesPerLine || 4}
                  onChange={e =>
                    onUpdateSong({ ...song, notesPerLine: parseInt(e.target.value, 10) || 4 })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors cursor-pointer"
                >
                  <option value="2">2 Measures / Line</option>
                  <option value="3">3 Measures / Line</option>
                  <option value="4">4 Measures / Line (Default)</option>
                  <option value="5">5 Measures / Line</option>
                  <option value="6">6 Measures / Line</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Lyric Display Mode Selector & Collapse Button */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs gap-3">
            <div className="flex items-center gap-2 flex-wrap">
            {/* Lyrics Display Mode Options */}
            <div className="flex flex-col gap-1.5 text-xs">
              <span className="font-bold text-zinc-600 dark:text-zinc-400">Karaoke & Score Display:</span>
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 flex-wrap gap-1">
                <button
                  id="composer-mode-roman"
                  type="button"
                  onClick={() => setDisplayMode('roman')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    displayMode === 'roman' || displayMode === 'poj_only' || displayMode === 'pij_only'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  1. 羅馬字
                </button>
                <button
                  id="composer-mode-hanlo"
                  type="button"
                  onClick={() => setDisplayMode('hanlo')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    displayMode === 'hanlo' || displayMode === 'hanji_only' || displayMode === 'custom_only'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  2. 漢羅
                </button>
                <button
                  id="composer-mode-roman-major-hanlo"
                  type="button"
                  onClick={() => setDisplayMode('roman_major_hanlo')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    displayMode === 'roman_major_hanlo' || displayMode === 'all' || displayMode === 'hanji_poj' || displayMode === 'hanji_pij'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  3. 羅馬字（主）+ 漢羅
                </button>
              </div>
            </div>
            </div>

            {/* Done & Collapse Button */}
            <button
              id="composer-collapse-settings-footer-btn"
              type="button"
              onClick={() => setIsExpanded(false)}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

SongMetadataHeader.displayName = 'SongMetadataHeader';

