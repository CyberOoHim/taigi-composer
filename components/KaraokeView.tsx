'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InstrumentType, JianpuNote, LyricDisplayMode, Measure, Song } from '@/types/song';
import { AudioEngine, PlaybackState } from '@/lib/audioEngine';
import { JianpuNoteComponent } from './JianpuNoteComponent';
import confetti from 'canvas-confetti';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Sliders,
  Music,
  Maximize2,
  Minimize2,
  Repeat,
  Radio,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Disc,
} from 'lucide-react';

interface KaraokeViewProps {
  song: Song;
  audioEngine: AudioEngine;
  displayMode: LyricDisplayMode;
  setDisplayMode: (mode: LyricDisplayMode) => void;
  onSelectMeasure?: (measureIndex: number) => void;
}

export const KaraokeView: React.FC<KaraokeViewProps> = ({
  song,
  audioEngine,
  displayMode,
  setDisplayMode,
  onSelectMeasure,
}) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    currentMeasureIndex: 0,
    currentNoteIndex: 0,
    currentNoteId: null,
    currentTime: 0,
    totalDuration: 0,
    progressPercent: 0,
  });

  const [instrument, setInstrument] = useState<InstrumentType>('piano');
  const [melodyVolume, setMelodyVolume] = useState<number>(0.85);
  const [backingVolume, setBackingVolume] = useState<number>(0.5);
  const [metronomeVolume, setMetronomeVolume] = useState<number>(0.15);
  const [transpose, setTranspose] = useState<number>(0);
  const [tempoMultiplier, setTempoMultiplier] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoopingMeasure, setIsLoopingMeasure] = useState<boolean>(false);
  const [showMixer, setShowMixer] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);

  // Sync state with AudioEngine
  useEffect(() => {
    const unsubState = audioEngine.subscribeState(state => {
      setPlaybackState(state);
    });

    const unsubEnded = audioEngine.subscribeEnded(() => {
      // Trigger confetti celebration on Karaoke finish
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Safe fallback
      }
    });

    return () => {
      unsubState();
      unsubEnded();
    };
  }, [audioEngine]);

  // Update audio options when controls change
  useEffect(() => {
    audioEngine.setOptions({
      instrument,
      melodyVolume,
      backingVolume,
      metronomeVolume,
      transpose,
      tempoMultiplier,
    });
  }, [audioEngine, instrument, melodyVolume, backingVolume, metronomeVolume, transpose, tempoMultiplier]);

  // Auto-scroll active measure into view during playback
  useEffect(() => {
    if (playbackState.isPlaying && sheetScrollRef.current) {
      const activeEl = sheetScrollRef.current.querySelector(`[data-measure-idx="${playbackState.currentMeasureIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [playbackState.currentMeasureIndex, playbackState.isPlaying]);

  // Group song measures into Lyric lines (2 measures per line typically)
  const lyricLines = useMemo(() => {
    const lines: {
      lineIndex: number;
      measures: Measure[];
      measureIndices: number[];
      notes: { note: JianpuNote; measureIdx: number; noteIdx: number }[];
    }[] = [];

    const measuresPerLine = song.notesPerLine || 2;
    for (let i = 0; i < song.measures.length; i += measuresPerLine) {
      const slice = song.measures.slice(i, i + measuresPerLine);
      const mIndices = slice.map((_, idx) => i + idx);
      const notesList: { note: JianpuNote; measureIdx: number; noteIdx: number }[] = [];

      slice.forEach((m, mOffset) => {
        m.notes.forEach((n, nIdx) => {
          notesList.push({
            note: n,
            measureIdx: i + mOffset,
            noteIdx: nIdx,
          });
        });
      });

      lines.push({
        lineIndex: lines.length,
        measures: slice,
        measureIndices: mIndices,
        notes: notesList,
      });
    }
    return lines;
  }, [song]);

  // Find active line index
  const activeLineIndex = useMemo(() => {
    return lyricLines.findIndex(line => line.measureIndices.includes(playbackState.currentMeasureIndex));
  }, [lyricLines, playbackState.currentMeasureIndex]);

  const currentLine = lyricLines[activeLineIndex !== -1 ? activeLineIndex : 0];
  const nextLine = lyricLines[(activeLineIndex !== -1 ? activeLineIndex : 0) + 1] || null;

  // Playback control handlers
  const handleTogglePlay = () => {
    if (playbackState.isPlaying) {
      audioEngine.pause();
    } else if (playbackState.isPaused) {
      audioEngine.resume();
    } else {
      audioEngine.play(song, 0);
    }
  };

  const handleRestart = () => {
    audioEngine.play(song, 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value);
    const total = playbackState.totalDuration || audioEngine.calculateSongDuration(song);
    const targetSec = (percent / 100) * total;
    audioEngine.seek(song, targetSec);
  };

  const handleTranspose = (delta: number) => {
    setTranspose(prev => Math.max(-12, Math.min(12, prev + delta)));
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Compute key display with transpose
  const effectiveKeyDisplay = useMemo(() => {
    if (transpose === 0) return `1 = ${song.key}`;
    const sign = transpose > 0 ? `+${transpose}` : `${transpose}`;
    return `1 = ${song.key} (${sign} semitones)`;
  }, [song.key, transpose]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-zinc-950 text-white rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : 'w-full'
      }`}
    >
      {/* Karaoke Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-zinc-900/90 border-b border-zinc-800/80 backdrop-blur-md gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-zinc-950 shadow-md">
            <Radio className={`w-5 h-5 ${playbackState.isPlaying ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-zinc-100">{song.title}</h2>
              <span className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {effectiveKeyDisplay}
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-zinc-800 text-zinc-300">
                {song.timeSignature}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {song.composer && `曲: ${song.composer}`} {song.lyricist && `| 詞: ${song.lyricist}`}
            </p>
          </div>
        </div>

        {/* Display Mode & Instrument Tabs */}
        <div className="flex items-center gap-2">
          {/* Display Mode Selector */}
          <div id="ktv-display-mode-selector" className="flex items-center bg-zinc-800/90 p-1 rounded-xl border border-zinc-700/60 text-xs">
            <button
              id="ktv-mode-all"
              onClick={() => setDisplayMode('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                displayMode === 'all'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              全顯示 (All)
            </button>
            <button
              id="ktv-mode-hanji-poj"
              onClick={() => setDisplayMode('hanji_poj')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                displayMode === 'hanji_poj'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              漢字 + 白話字
            </button>
            <button
              id="ktv-mode-hanji-pij"
              onClick={() => setDisplayMode('hanji_pij')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                displayMode === 'hanji_pij'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              漢字 + 臺羅
            </button>
            <button
              id="ktv-mode-hanji-only"
              onClick={() => setDisplayMode('hanji_only')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                displayMode === 'hanji_only'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              純漢字
            </button>
            <button
              id="ktv-mode-poj-only"
              onClick={() => setDisplayMode('poj_only')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                displayMode === 'poj_only'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              純POJ
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            id="ktv-fullscreen-toggle-btn"
            onClick={toggleFullscreen}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Karaoke Fullscreen Stage'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main KTV Stage Arena */}
      <div className="relative flex flex-col items-center justify-center p-6 sm:p-10 min-h-[280px] bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900 border-b border-zinc-800/80 select-none overflow-hidden">
        {/* Background Ambience / Disco Glow */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />

        {/* Current Active Section Badge */}
        {song.measures[playbackState.currentMeasureIndex]?.section && (
          <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700 text-xs font-semibold text-amber-400 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{song.measures[playbackState.currentMeasureIndex].section}</span>
          </div>
        )}

        {/* CURRENT LYRIC LINE (Big KTV Karaoke Sweeping Text) */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 max-w-4xl text-center z-10 min-h-[90px]">
          {currentLine.notes.map((item, idx) => {
            const isNoteActive =
              playbackState.currentMeasureIndex === item.measureIdx &&
              playbackState.currentNoteIndex === item.noteIdx;

            const isPassed =
              item.measureIdx < playbackState.currentMeasureIndex ||
              (item.measureIdx === playbackState.currentMeasureIndex && item.noteIdx < playbackState.currentNoteIndex);

            const hanji = item.note.lyric.hanji || item.note.lyric.custom || '';
            const roman =
              displayMode === 'hanji_pij' || displayMode === 'pij_only'
                ? item.note.lyric.pij || item.note.lyric.poj || ''
                : item.note.lyric.poj || item.note.lyric.pij || '';

            if ((item.note.pitch === 0 || item.note.pitch === 'empty') && !hanji && !roman && !item.note.annotation) {
              return null; // Rest or empty space without lyrics or annotation
            }

            const isPitched = typeof item.note.pitch === 'number' && item.note.pitch > 0;
            const pitchLabel =
              item.note.pitch === 'empty'
                ? '␣'
                : item.note.pitch === 0
                ? '0'
                : `${item.note.accidental || ''}${item.note.pitch}`;

            return (
              <div
                key={`${item.measureIdx}-${item.noteIdx}-${idx}`}
                className={`relative flex flex-col items-center transition-transform duration-150 ${
                  isNoteActive ? 'scale-115 -translate-y-1' : ''
                }`}
              >
                {/* Annotation pill if present */}
                {item.note.annotation && (
                  <span className="text-[10px] font-sans font-bold text-indigo-300 bg-indigo-950/80 px-1.5 py-0.2 rounded-full border border-indigo-700/60 mb-0.5">
                    {item.note.annotation}
                  </span>
                )}

                {/* Romanization (POJ / PIJ) Ruby above */}
                {(displayMode === 'all' || displayMode === 'hanji_poj' || displayMode === 'hanji_pij' || displayMode === 'poj_only' || displayMode === 'pij_only') && (
                  <span
                    className={`text-xs sm:text-sm font-serif italic mb-0.5 transition-colors ${
                      isNoteActive
                        ? 'text-amber-300 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                        : isPassed
                        ? 'text-amber-500/80'
                        : 'text-zinc-400'
                    }`}
                  >
                    {roman || (item.note.pitch === 'empty' ? '' : '—')}
                  </span>
                )}

                {/* Hanji / Main Lyric Word */}
                {displayMode !== 'poj_only' && displayMode !== 'pij_only' && (
                  <span
                    className={`text-2xl sm:text-4xl font-black tracking-wider transition-all duration-150 ${
                      isNoteActive
                        ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 scale-105 drop-shadow-[0_0_16px_rgba(245,158,11,0.9)]'
                        : isPassed
                        ? 'text-amber-400'
                        : 'text-zinc-300'
                    }`}
                  >
                    {hanji || roman || (item.note.pitch === 'empty' ? '␣' : '—')}
                  </span>
                )}

                {/* Corresponding Jianpu Number below */}
                <span
                  className={`mt-1 text-xs font-mono font-bold px-1.5 py-0.5 rounded transition-colors ${
                    isNoteActive
                      ? 'bg-amber-400 text-zinc-950 ring-2 ring-amber-300 shadow-md'
                      : isPassed
                      ? 'bg-zinc-800 text-amber-300/80'
                      : 'bg-zinc-900/90 text-zinc-400'
                  }`}
                >
                  {pitchLabel}
                  {isPitched && item.note.octave > 0 ? '̇' : isPitched && item.note.octave < 0 ? '̣' : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* NEXT UPCOMING LYRIC LINE PREVIEW */}
        {nextLine && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-zinc-500 text-sm sm:text-base opacity-75">
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-medium">
              Next:
            </span>
            {nextLine.notes.map((item, idx) => {
              const hanji = item.note.lyric.hanji || item.note.lyric.custom || '';
              const roman = item.note.lyric.poj || item.note.lyric.pij || '';
              return (
                <span key={idx} className="font-medium">
                  {hanji || roman}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Aligned Jianpu Score Roll / Strip */}
      <div className="bg-zinc-900/60 p-4 border-b border-zinc-800/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <Music className="w-3.5 h-3.5 text-amber-400" />
            <span>簡譜曲譜對齊滾動條 (Aligned Numbered Music Notation Roll)</span>
          </div>
          <span className="text-[11px] text-zinc-500">
            第 {playbackState.currentMeasureIndex + 1} 小節 (Measure {playbackState.currentMeasureIndex + 1} of {song.measures.length})
          </span>
        </div>

        <div
          ref={sheetScrollRef}
          className="flex items-center gap-3 overflow-x-auto pb-3 pt-1 scroll-smooth"
        >
          {song.measures.map((measure, mIdx) => {
            const isMeasureActive = playbackState.currentMeasureIndex === mIdx;

            return (
              <div
                key={measure.id}
                data-measure-idx={mIdx}
                onClick={() => onSelectMeasure && onSelectMeasure(mIdx)}
                className={`shrink-0 flex flex-col p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isMeasureActive
                    ? 'bg-zinc-800/90 border-amber-500/80 ring-2 ring-amber-500/30 shadow-lg'
                    : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                {/* Measure Header */}
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 px-1">
                  <span className="font-mono font-semibold">#{measure.measureNumber}</span>
                  {measure.chord && (
                    <span className="font-bold text-amber-400 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/50">
                      {measure.chord}
                    </span>
                  )}
                </div>

                {/* Notes in Measure */}
                <div className="flex items-center gap-1.5">
                  {measure.notes.map((note, nIdx) => {
                    const isNoteActive = isMeasureActive && playbackState.currentNoteIndex === nIdx;
                    return (
                      <JianpuNoteComponent
                        key={note.id}
                        note={note}
                        isActive={isNoteActive}
                        displayMode={displayMode}
                        isKaraokeMode={true}
                      />
                    );
                  })}
                  {/* Barline */}
                  <div className="w-[1.5px] h-10 bg-zinc-700 mx-1 self-center" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary Karaoke Controls Bar */}
      <div className="p-4 bg-zinc-900/95 flex flex-col gap-3">
        {/* Progress Slider */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-400 min-w-[38px] text-right">
            {formatTime(playbackState.currentTime)}
          </span>
          <div className="relative flex-1 group flex items-center">
            <input
              id="ktv-seek-slider"
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={playbackState.progressPercent || 0}
              onChange={handleSeek}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-hidden"
            />
          </div>
          <span className="font-mono text-xs text-zinc-400 min-w-[38px]">
            {formatTime(playbackState.totalDuration || audioEngine.calculateSongDuration(song))}
          </span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Main Transport Controls */}
          <div className="flex items-center gap-2">
            <button
              id="ktv-restart-btn"
              onClick={handleRestart}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title="Restart from beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              id="ktv-main-play-pause-btn"
              onClick={handleTogglePlay}
              className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
              title={playbackState.isPlaying ? 'Pause' : 'Play Karaoke'}
            >
              {playbackState.isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>

            {/* Loop Measure Toggle */}
            <button
              id="ktv-loop-measure-btn"
              onClick={() => setIsLoopingMeasure(!isLoopingMeasure)}
              className={`p-2.5 rounded-xl border transition-colors ${
                isLoopingMeasure
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
              title="Loop active measure"
            >
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          {/* Key Changer (Transpose) Controls */}
          <div id="ktv-transpose-controls" className="flex items-center bg-zinc-800/90 rounded-xl p-1 border border-zinc-700 text-xs">
            <span className="px-2 font-medium text-zinc-400">移調 (Key):</span>
            <button
              id="ktv-transpose-down-btn"
              onClick={() => handleTranspose(-1)}
              className="px-2 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 font-bold text-zinc-200 transition-colors"
              title="Key down (b)"
            >
              ♭
            </button>
            <span className="px-2.5 font-mono font-bold text-amber-400 min-w-[32px] text-center">
              {transpose > 0 ? `+${transpose}` : transpose}
            </span>
            <button
              id="ktv-transpose-up-btn"
              onClick={() => handleTranspose(1)}
              className="px-2 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 font-bold text-zinc-200 transition-colors"
              title="Key up (#)"
            >
              ♯
            </button>
            {transpose !== 0 && (
              <button
                id="ktv-transpose-reset-btn"
                onClick={() => setTranspose(0)}
                className="ml-1 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white underline"
              >
                Reset
              </button>
            )}
          </div>

          {/* Instrument Selector */}
          <div id="ktv-instrument-control" className="flex items-center gap-1.5 bg-zinc-800/90 rounded-xl p-1 border border-zinc-700 text-xs">
            <span className="px-1.5 font-medium text-zinc-400 flex items-center gap-1">
              <Disc className="w-3.5 h-3.5 text-amber-400" />
              音色:
            </span>
            <select
              id="ktv-instrument-select"
              value={instrument}
              onChange={e => setInstrument(e.target.value as InstrumentType)}
              className="bg-zinc-900 text-zinc-200 font-medium px-2 py-1 rounded-lg border border-zinc-700 focus:outline-hidden focus:border-amber-400"
            >
              <option value="piano">鋼琴 (Grand Piano)</option>
              <option value="flute">臺灣竹笛/蕭 (Traditional Flute)</option>
              <option value="guitar">古典吉他 (Acoustic Guitar)</option>
              <option value="synth">80s KTV 合成器 (Synthesizer)</option>
              <option value="bell">八音鐘 (Glockenspiel)</option>
            </select>
          </div>

          {/* Mixer & Tempo Toggle */}
          <button
            id="ktv-toggle-mixer-btn"
            onClick={() => setShowMixer(!showMixer)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
              showMixer
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>混音 & 速度 (Mixer & BPM)</span>
          </button>
        </div>

        {/* Collapsible Mixer & Tempo Panel */}
        {showMixer && (
          <div className="mt-2 p-4 bg-zinc-950/90 rounded-xl border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-200">
            {/* Melody Volume */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>主旋律導唱 (Melody Lead)</span>
                <span className="font-mono text-zinc-200">{Math.round(melodyVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={melodyVolume}
                onChange={e => setMelodyVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Backing Chord Volume */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>和弦伴奏 (Accompaniment)</span>
                <span className="font-mono text-zinc-200">{Math.round(backingVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={backingVolume}
                onChange={e => setBackingVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Metronome Volume */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>節拍器 (Metronome Beat)</span>
                <span className="font-mono text-zinc-200">{Math.round(metronomeVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={metronomeVolume}
                onChange={e => setMetronomeVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Tempo BPM Adjuster */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>速度 (Speed: {Math.round(song.bpm * tempoMultiplier)} BPM)</span>
                <span className="font-mono text-zinc-200">{tempoMultiplier.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={tempoMultiplier}
                onChange={e => setTempoMultiplier(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
