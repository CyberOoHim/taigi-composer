'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Check,
  ArrowDown,
  ArrowUp,
  Plus,
  Minus,
  RefreshCw,
  Wand2,
  Activity,
  X,
} from 'lucide-react';
import { useGeminiAuth } from '@/hooks/useGeminiAuth';
import {
  CHROMATIC_KEYS,
  STANDARD_TIME_SIGNATURES,
  TEMPO_PRESETS,
  transposeSongChords,
  autoFillSongMeasureRests,
  smartRebarSong,
} from '@/lib/taigiUtils';

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
  const { hasApiKey } = useGeminiAuth();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Active inline popover for the 3 circled DAW LCD items: 'key' | 'timeSignature' | 'bpm' | null
  const [activePopover, setActivePopover] = useState<'key' | 'timeSignature' | 'bpm' | null>(null);

  // Key Signature Settings
  const [autoTransposeChords, setAutoTransposeChords] = useState<boolean>(true);

  // Time Signature Settings
  const [syncAllMeasures, setSyncAllMeasures] = useState<boolean>(true);

  // Tap Tempo state
  const tapTimesRef = useRef<number[]>([]);
  const [tapTempoFeedback, setTapTempoFeedback] = useState<string | null>(null);

  // Close popovers on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePopover(null);
      }
    };
    if (activePopover) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [activePopover]);

  // Handle Key Change
  const handleSelectKey = (targetKey: KeySignature) => {
    if (targetKey === song.key) {
      setActivePopover(null);
      return;
    }
    if (autoTransposeChords) {
      const updated = transposeSongChords(song, targetKey);
      onUpdateSong(updated);
    } else {
      onUpdateSong({ ...song, key: targetKey });
    }
    setActivePopover(null);
  };

  const handleStepKey = (delta: number) => {
    const currentIdx = CHROMATIC_KEYS.indexOf(song.key);
    const safeIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx = (safeIdx + delta + 12) % 12;
    const targetKey = CHROMATIC_KEYS[nextIdx];
    handleSelectKey(targetKey);
  };

  // Handle Time Signature Change
  const handleSelectTimeSignature = (targetTimeSig: TimeSignature) => {
    if (syncAllMeasures) {
      const updatedMeasures = song.measures.map(m => ({
        ...m,
        timeSignature: undefined,
      }));
      onUpdateSong({
        ...song,
        timeSignature: targetTimeSig,
        measures: updatedMeasures,
      });
    } else {
      onUpdateSong({ ...song, timeSignature: targetTimeSig });
    }
    setActivePopover(null);
  };

  // Smart Re-bar measures
  const handleSmartRebar = (targetTimeSig: TimeSignature) => {
    const updated = smartRebarSong(song, targetTimeSig);
    onUpdateSong(updated);
    setActivePopover(null);
  };

  // Auto Fill Rests
  const handleAutoFillRests = () => {
    const updated = autoFillSongMeasureRests(song);
    onUpdateSong(updated);
    setActivePopover(null);
  };

  // Handle BPM Change
  const handleSetBpm = (newBpm: number) => {
    const clamped = Math.max(30, Math.min(260, Math.round(newBpm)));
    onUpdateSong({ ...song, bpm: clamped });
  };

  const handleStepBpm = (delta: number) => {
    handleSetBpm(song.bpm + delta);
  };

  // Tap Tempo Handler
  const handleTapTempo = () => {
    const now = Date.now();
    const recentTaps = tapTimesRef.current.filter(t => now - t < 2600);
    recentTaps.push(now);
    tapTimesRef.current = recentTaps;

    if (recentTaps.length >= 2) {
      let totalDiff = 0;
      for (let i = 1; i < recentTaps.length; i++) {
        totalDiff += recentTaps[i] - recentTaps[i - 1];
      }
      const avgInterval = totalDiff / (recentTaps.length - 1);
      const computedBpm = Math.round(60000 / avgInterval);
      const clamped = Math.max(40, Math.min(240, computedBpm));
      handleSetBpm(clamped);
      setTapTempoFeedback(`${clamped} BPM (${recentTaps.length} taps)`);
    } else {
      setTapTempoFeedback('Tap again to measure...');
    }
  };

  return (
    <div
      id="song-metadata-card"
      className="p-3.5 sm:p-4 bg-white/95 dark:bg-[#141720]/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl shadow-xs flex flex-col gap-3 transition-all select-none relative"
    >
      {/* Click-away Backdrop for Active Popover */}
      {activePopover && (
        <div
          id="popover-backdrop"
          className="fixed inset-0 z-30 bg-black/10 dark:bg-black/20"
          onClick={() => setActivePopover(null)}
        />
      )}

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

              {/* ITEM 1: Key Signature (Clickable & Directly Editable) */}
              <div className="relative inline-block">
                <button
                  id="header-key-badge-btn"
                  type="button"
                  onClick={() => setActivePopover(activePopover === 'key' ? null : 'key')}
                  className={`daw-lcd text-xs px-2.5 py-1 rounded-lg font-mono font-bold shadow-xs cursor-pointer touch-manipulation transition-all flex items-center gap-1 border ${
                    activePopover === 'key'
                      ? 'ring-2 ring-amber-400 border-amber-500 brightness-110 text-amber-300'
                      : 'border-amber-500/20 hover:border-amber-400/60 hover:brightness-105 active:scale-95'
                  }`}
                  title="Click to edit Key Signature (1 = ?)"
                >
                  <span>1 = {song.key}</span>
                  <ChevronDown className="w-3 h-3 text-amber-500/70" />
                </button>

                {/* Key Signature Popover */}
                {activePopover === 'key' && (
                  <div
                    id="popover-key-editor"
                    className="absolute left-0 top-full mt-2 z-40 w-72 sm:w-80 p-3.5 bg-white dark:bg-[#161922] border border-zinc-200 dark:border-zinc-700/80 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        <Music className="w-3.5 h-3.5 text-amber-500" />
                        <span>調號設定 (Key: 1 = ?)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivePopover(null)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quick Half-step Semitone Steppers */}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        id="key-step-down-btn"
                        type="button"
                        onClick={() => handleStepKey(-1)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Down 1 semitone"
                      >
                        <ArrowDown className="w-3.5 h-3.5 text-amber-500" />
                        <span>-1 半音</span>
                      </button>

                      <div className="daw-lcd px-2.5 py-1 text-xs font-mono font-bold rounded-lg shrink-0">
                        1 = {song.key}
                      </div>

                      <button
                        id="key-step-up-btn"
                        type="button"
                        onClick={() => handleStepKey(1)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Up 1 semitone"
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-amber-500" />
                        <span>+1 半音</span>
                      </button>
                    </div>

                    {/* Chromatic 12 Keys Grid */}
                    <div className="grid grid-cols-4 gap-1.5 mb-3">
                      {CHROMATIC_KEYS.map(k => {
                        const isCurrent = song.key === k;
                        return (
                          <button
                            key={k}
                            id={`key-opt-${k}`}
                            type="button"
                            onClick={() => handleSelectKey(k)}
                            className={`py-1.5 px-2 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer touch-manipulation flex items-center justify-center gap-1 ${
                              isCurrent
                                ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-xs'
                                : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700/60 hover:bg-amber-500/10 hover:border-amber-500/40'
                            }`}
                          >
                            <span>1={k}</span>
                            {isCurrent && <Check className="w-3 h-3 text-zinc-950 stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Auto Transpose Chords Toggle */}
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 cursor-pointer">
                      <input
                        id="auto-transpose-chords-checkbox"
                        type="checkbox"
                        checked={autoTransposeChords}
                        onChange={e => setAutoTransposeChords(e.target.checked)}
                        className="w-4 h-4 rounded-sm text-amber-500 focus:ring-amber-400 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          自動移調小節和弦
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          換調時同步變更樂譜和弦（如 Gm → Am）
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* ITEM 2: Time Signature (Clickable & Directly Editable) */}
              <div className="relative inline-block">
                <button
                  id="header-timesig-badge-btn"
                  type="button"
                  onClick={() => setActivePopover(activePopover === 'timeSignature' ? null : 'timeSignature')}
                  className={`daw-lcd text-xs px-2.5 py-1 rounded-lg font-mono font-bold shadow-xs cursor-pointer touch-manipulation transition-all flex items-center gap-1 border ${
                    activePopover === 'timeSignature'
                      ? 'ring-2 ring-amber-400 border-amber-500 brightness-110 text-amber-300'
                      : 'border-amber-500/20 hover:border-amber-400/60 hover:brightness-105 active:scale-95'
                  }`}
                  title="Click to edit Time Signature (Meter)"
                >
                  <span>{song.timeSignature}</span>
                  <ChevronDown className="w-3 h-3 text-amber-500/70" />
                </button>

                {/* Time Signature Popover */}
                {activePopover === 'timeSignature' && (
                  <div
                    id="popover-timesig-editor"
                    className="absolute left-0 top-full mt-2 z-40 w-72 sm:w-80 p-3.5 bg-white dark:bg-[#161922] border border-zinc-200 dark:border-zinc-700/80 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        <Activity className="w-3.5 h-3.5 text-amber-500" />
                        <span>拍號設定 (Time Signature)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivePopover(null)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Standard Meter Options */}
                    <div className="flex flex-col gap-1.5 mb-3">
                      {STANDARD_TIME_SIGNATURES.map(ts => {
                        const isCurrent = song.timeSignature === ts.value;
                        return (
                          <button
                            key={ts.value}
                            id={`timesig-opt-${ts.value.replace('/', '-')}`}
                            type="button"
                            onClick={() => handleSelectTimeSignature(ts.value)}
                            className={`p-2 rounded-xl border text-left transition-all cursor-pointer touch-manipulation flex items-center justify-between ${
                              isCurrent
                                ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold shadow-xs'
                                : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700/60 hover:bg-amber-500/10 hover:border-amber-500/40'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm w-8">{ts.label}</span>
                              <span className="text-[11px] opacity-90">{ts.sublabel}</span>
                            </div>
                            {isCurrent && <Check className="w-4 h-4 text-zinc-950 stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Sync to all measures option */}
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 cursor-pointer mb-2.5">
                      <input
                        id="sync-all-measures-checkbox"
                        type="checkbox"
                        checked={syncAllMeasures}
                        onChange={e => setSyncAllMeasures(e.target.checked)}
                        className="w-4 h-4 rounded-sm text-amber-500 focus:ring-amber-400 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                      />
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        同步更新所有小節之拍號規格
                      </span>
                    </label>

                    {/* Actions: Auto Fill Rests & Smart Rebar */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <button
                        id="autofill-rests-btn"
                        type="button"
                        onClick={handleAutoFillRests}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Automatically add rests to complete under-beat measures"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                        <span>補齊不足拍數休止符 (Auto-fill Rests)</span>
                      </button>

                      <button
                        id="smart-rebar-btn"
                        type="button"
                        onClick={() => handleSmartRebar(song.timeSignature)}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-400/40 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Smartly redistribute notes into measures according to time signature"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                        <span>依 {song.timeSignature} 重新整頓小節 (Smart Re-bar)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ITEM 3: BPM / Tempo (Clickable & Directly Editable) */}
              <div className="relative inline-block">
                <button
                  id="header-bpm-badge-btn"
                  type="button"
                  onClick={() => setActivePopover(activePopover === 'bpm' ? null : 'bpm')}
                  className={`daw-lcd text-xs px-2.5 py-1 rounded-lg font-mono font-bold shadow-xs cursor-pointer touch-manipulation transition-all flex items-center gap-1 border ${
                    activePopover === 'bpm'
                      ? 'ring-2 ring-amber-400 border-amber-500 brightness-110 text-amber-300'
                      : 'border-amber-500/20 hover:border-amber-400/60 hover:brightness-105 active:scale-95'
                  }`}
                  title="Click to edit Tempo (BPM)"
                >
                  <span>{song.bpm} BPM</span>
                  <ChevronDown className="w-3 h-3 text-amber-500/70" />
                </button>

                {/* BPM Popover */}
                {activePopover === 'bpm' && (
                  <div
                    id="popover-bpm-editor"
                    className="absolute left-0 top-full mt-2 z-40 w-72 sm:w-80 p-3.5 bg-white dark:bg-[#161922] border border-zinc-200 dark:border-zinc-700/80 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        <Activity className="w-3.5 h-3.5 text-amber-500" />
                        <span>速度設定 (Tempo · BPM)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivePopover(null)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Numeric Input & Steppers */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <button
                        id="bpm-minus-10-btn"
                        type="button"
                        onClick={() => handleStepBpm(-10)}
                        className="py-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
                        title="-10 BPM"
                      >
                        -10
                      </button>
                      <button
                        id="bpm-minus-1-btn"
                        type="button"
                        onClick={() => handleStepBpm(-1)}
                        className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="-1 BPM"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1">
                        <input
                          id="bpm-direct-input"
                          type="number"
                          min="30"
                          max="260"
                          value={song.bpm}
                          onChange={e => handleSetBpm(parseInt(e.target.value, 10) || 80)}
                          className="w-16 text-center text-base font-mono font-black text-amber-600 dark:text-amber-400 bg-transparent focus:outline-hidden"
                        />
                        <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                          BPM
                        </span>
                      </div>

                      <button
                        id="bpm-plus-1-btn"
                        type="button"
                        onClick={() => handleStepBpm(1)}
                        className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="+1 BPM"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id="bpm-plus-10-btn"
                        type="button"
                        onClick={() => handleStepBpm(10)}
                        className="py-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
                        title="+10 BPM"
                      >
                        +10
                      </button>
                    </div>

                    {/* Common Classical / Modern Tempo Presets */}
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {TEMPO_PRESETS.map(preset => {
                        const isCurrent = song.bpm === preset.bpm;
                        return (
                          <button
                            key={preset.bpm}
                            id={`bpm-preset-${preset.bpm}`}
                            type="button"
                            onClick={() => handleSetBpm(preset.bpm)}
                            className={`py-1 px-1.5 text-[11px] font-medium rounded-lg border transition-all cursor-pointer text-center truncate ${
                              isCurrent
                                ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold shadow-xs'
                                : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700/60 hover:bg-amber-500/10'
                            }`}
                            title={preset.label}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Tap Tempo Interactive Pad */}
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-1.5">
                      <button
                        id="bpm-tap-tempo-btn"
                        type="button"
                        onClick={handleTapTempo}
                        className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation flex items-center justify-center gap-1.5"
                      >
                        <Activity className="w-4 h-4 text-zinc-950" />
                        <span>Tap Tempo (連續點擊測速)</span>
                      </button>

                      {tapTempoFeedback && (
                        <p className="text-[11px] text-center font-mono text-amber-600 dark:text-amber-400 font-bold animate-in fade-in">
                          {tapTempoFeedback}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
              onClick={hasApiKey ? onOpenScanner : undefined}
              disabled={!hasApiKey}
              aria-disabled={!hasApiKey}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs rounded-xl shadow-2xs transition-all min-h-[40px] ${
                hasApiKey
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 active:scale-95 cursor-pointer touch-manipulation'
                  : 'bg-zinc-100/80 dark:bg-zinc-900/60 text-zinc-400 dark:text-zinc-500 border border-zinc-200/80 dark:border-zinc-800/80 opacity-50 cursor-not-allowed select-none'
              }`}
              title={
                hasApiKey
                  ? 'AI Score OCR Import (Up to 3 pages)'
                  : 'AI Score Scanner muted (Gemini API Key not available)'
              }
            >
              <ScanLine className={`w-4 h-4 ${hasApiKey ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
              <span className="hidden sm:inline">
                {hasApiKey ? 'AI Scanner' : 'AI Scanner (Muted)'}
              </span>
            </button>
          )}

          {/* Quick Lyric Aligner Modal Trigger */}
          <button
            id="composer-open-aligner-btn"
            type="button"
            onClick={onOpenAligner}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#0a0c10] dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
            title="歌詞對齊台 (支援 羅馬字 與 漢羅)"
          >
            <AlignLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            <span className="hidden sm:inline">歌詞對齊 (羅馬字/漢羅)</span>
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
                  onChange={e => handleSelectKey(e.target.value as KeySignature)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors cursor-pointer"
                >
                  {CHROMATIC_KEYS.map(k => (
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
                  onChange={e => handleSelectTimeSignature(e.target.value as TimeSignature)}
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
                  onChange={e => handleSetBpm(parseInt(e.target.value, 10) || 80)}
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
                    displayMode === 'roman'
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
                    displayMode === 'roman_major_hanlo' || displayMode === 'all'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  3. 羅馬字（主）+ 漢羅
                </button>
                <button
                  id="composer-mode-hanlo-major-roman"
                  type="button"
                  onClick={() => setDisplayMode('hanlo_major_roman')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    displayMode === 'hanlo_major_roman' || displayMode === 'hanji_poj'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  4. 漢羅（主）+ 羅馬字
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

