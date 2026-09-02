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
  SkipBack,
  SkipForward,
  Bookmark,
  Layers,
  Pencil,
} from 'lucide-react';

export interface KaraokeSection {
  id: string;
  name: string;
  startMeasureIndex: number;
  endMeasureIndex: number;
  startMeasureNumber: number;
  endMeasureNumber: number;
  startTimeSec: number;
  durationSec: number;
  startPercent: number;
  endPercent: number;
  chord?: string;
  firstLyricSnippet: string;
}

interface KaraokeViewProps {
  song: Song;
  audioEngine: AudioEngine;
  displayMode: LyricDisplayMode;
  setDisplayMode: (mode: LyricDisplayMode) => void;
  onSelectMeasure?: (measureIndex: number) => void;
  onEditSection?: (section: KaraokeSection) => void;
  onEditMeasure?: (measureIndex: number) => void;
}

export const KaraokeView: React.FC<KaraokeViewProps> = ({
  song,
  audioEngine,
  displayMode,
  setDisplayMode,
  onSelectMeasure,
  onEditSection,
  onEditMeasure,
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

  // Slider scrubbing & debounce state
  const [sliderDraggingPercent, setSliderDraggingPercent] = useState<number | null>(null);
  const seekDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const sectionScrollRef = useRef<HTMLDivElement>(null);

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

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (seekDebounceTimerRef.current) {
        clearTimeout(seekDebounceTimerRef.current);
      }
    };
  }, []);

  // Update audio options when controls change
  useEffect(() => {
    audioEngine.setOptions({
      instrument,
      melodyVolume,
      backingVolume,
      metronomeVolume,
      transpose,
      tempoMultiplier,
      loopMeasure: isLoopingMeasure ? playbackState.currentMeasureIndex : null,
    });
  }, [audioEngine, instrument, melodyVolume, backingVolume, metronomeVolume, transpose, tempoMultiplier, isLoopingMeasure, playbackState.currentMeasureIndex]);

  // Auto-scroll active measure into view during playback
  useEffect(() => {
    if (playbackState.isPlaying && sheetScrollRef.current) {
      const activeEl = sheetScrollRef.current.querySelector(`[data-measure-idx="${playbackState.currentMeasureIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [playbackState.currentMeasureIndex, playbackState.isPlaying]);

  // Extract song sections with precise timestamps and percentages
  const songSections = useMemo<KaraokeSection[]>(() => {
    if (!song.measures || song.measures.length === 0) return [];

    const effectiveBpm = song.bpm * tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;

    // 1. Calculate measure start times
    const measureStartTimes: number[] = [];
    let runningTime = 0;

    for (let i = 0; i < song.measures.length; i++) {
      measureStartTimes.push(runningTime);
      let measureBeats = 0;
      for (const note of song.measures[i].notes) {
        if (note.pitch !== 'empty' && note.pitch !== 0 && !note.annotation) {
          measureBeats += note.duration;
        } else if (note.pitch === 0 || (typeof note.pitch === 'number' && note.pitch > 0)) {
          measureBeats += note.duration;
        }
      }
      runningTime += measureBeats * secPerBeat;
    }
    const totalDuration = runningTime || audioEngine.calculateSongDuration(song) || 1;

    // 2. Detect section boundaries from measure.section properties
    const sectionStartIndices: { index: number; name: string }[] = [];

    song.measures.forEach((m, idx) => {
      if (m.section && m.section.trim()) {
        sectionStartIndices.push({ index: idx, name: m.section.trim() });
      }
    });

    // If measure 0 is not explicitly marked as a section, add it
    if (sectionStartIndices.length === 0 || sectionStartIndices[0].index !== 0) {
      const firstSectionName = sectionStartIndices.length > 0 ? '前奏 (Intro)' : '段落 1';
      sectionStartIndices.unshift({ index: 0, name: firstSectionName });
    }

    // If there is only 1 section and no explicit sections anywhere, chunk every 4 measures
    if (sectionStartIndices.length === 1 && !song.measures[0]?.section) {
      const chunkSize = song.notesPerLine || 4;
      sectionStartIndices.length = 0;
      for (let i = 0; i < song.measures.length; i += chunkSize) {
        const secNum = Math.floor(i / chunkSize) + 1;
        sectionStartIndices.push({ index: i, name: `段落 ${secNum}` });
      }
    }

    const sections: KaraokeSection[] = [];

    for (let i = 0; i < sectionStartIndices.length; i++) {
      const current = sectionStartIndices[i];
      const next = sectionStartIndices[i + 1];
      const startMeasureIndex = current.index;
      const endMeasureIndex = next ? next.index - 1 : song.measures.length - 1;

      const startTimeSec = measureStartTimes[startMeasureIndex] || 0;
      const endTimeSec = next && measureStartTimes[next.index] !== undefined
        ? measureStartTimes[next.index]
        : totalDuration;
      const durationSec = Math.max(0, endTimeSec - startTimeSec);
      const startPercent = Math.min(100, (startTimeSec / totalDuration) * 100);
      const endPercent = Math.min(100, (endTimeSec / totalDuration) * 100);

      // Extract first lyric words in this section
      const lyricWords: string[] = [];
      for (let mIdx = startMeasureIndex; mIdx <= endMeasureIndex; mIdx++) {
        const m = song.measures[mIdx];
        if (!m) continue;
        for (const note of m.notes) {
          const w = note.lyric.hanji || note.lyric.custom || note.lyric.poj || note.lyric.pij;
          if (w && w.trim() && w !== '—' && w !== '，' && w !== '。') {
            lyricWords.push(w);
            if (lyricWords.length >= 6) break;
          }
        }
        if (lyricWords.length >= 6) break;
      }

      sections.push({
        id: `sec-${i}-${startMeasureIndex}`,
        name: current.name,
        startMeasureIndex,
        endMeasureIndex,
        startMeasureNumber: song.measures[startMeasureIndex]?.measureNumber || (startMeasureIndex + 1),
        endMeasureNumber: song.measures[endMeasureIndex]?.measureNumber || (endMeasureIndex + 1),
        startTimeSec,
        durationSec,
        startPercent,
        endPercent,
        chord: song.measures[startMeasureIndex]?.chord,
        firstLyricSnippet: lyricWords.join(' ') || (song.measures[startMeasureIndex]?.chord ? `和弦: ${song.measures[startMeasureIndex]?.chord}` : ''),
      });
    }

    return sections;
  }, [song, tempoMultiplier, audioEngine]);

  // Active section corresponding to currently playing or scrubbed measure
  const activeSection = useMemo(() => {
    if (!songSections.length) return null;
    return (
      songSections.find(
        sec =>
          playbackState.currentMeasureIndex >= sec.startMeasureIndex &&
          playbackState.currentMeasureIndex <= sec.endMeasureIndex
      ) || songSections[0]
    );
  }, [songSections, playbackState.currentMeasureIndex]);

  // Group song measures into Lyric lines
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

  // Jump to specific section handler (instant touch jump)
  const handleJumpToSection = (section: KaraokeSection) => {
    audioEngine.seek(song, section.startTimeSec);
    if (onSelectMeasure) {
      onSelectMeasure(section.startMeasureIndex);
    }
    // Scroll score roll to section start measure
    if (sheetScrollRef.current) {
      const activeEl = sheetScrollRef.current.querySelector(`[data-measure-idx="${section.startMeasureIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  // Skip to previous or next section
  const handleJumpPrevSection = () => {
    if (!songSections.length) return;
    const currentIndex = songSections.findIndex(s => s.id === activeSection?.id);
    if (currentIndex > 0) {
      handleJumpToSection(songSections[currentIndex - 1]);
    } else {
      handleJumpToSection(songSections[0]);
    }
  };

  const handleJumpNextSection = () => {
    if (!songSections.length) return;
    const currentIndex = songSections.findIndex(s => s.id === activeSection?.id);
    if (currentIndex >= 0 && currentIndex < songSections.length - 1) {
      handleJumpToSection(songSections[currentIndex + 1]);
    }
  };

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

  const totalDuration = playbackState.totalDuration || audioEngine.calculateSongDuration(song);
  const currentDisplayPercent = sliderDraggingPercent !== null ? sliderDraggingPercent : (playbackState.progressPercent || 0);
  const currentDisplayTime = sliderDraggingPercent !== null
    ? (sliderDraggingPercent / 100) * totalDuration
    : playbackState.currentTime;

  // Debounced slider sliding handler
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value);
    setSliderDraggingPercent(percent);

    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
    }

    // Debounce: jump to target position/section after 160ms of continuous sliding
    seekDebounceTimerRef.current = setTimeout(() => {
      const targetSec = (percent / 100) * totalDuration;
      audioEngine.seek(song, targetSec);
    }, 160);
  };

  const handleSliderPointerUp = () => {
    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
      seekDebounceTimerRef.current = null;
    }
    if (sliderDraggingPercent !== null) {
      const targetSec = (sliderDraggingPercent / 100) * totalDuration;
      audioEngine.seek(song, targetSec);
      setSliderDraggingPercent(null);
    }
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

        {/* Current Active Section Badge (Interactive Jump Trigger) */}
        {activeSection && (
          <button
            id="ktv-stage-active-section-badge"
            type="button"
            onClick={() => handleJumpToSection(activeSection)}
            className="mb-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-800/90 hover:bg-zinc-700/90 border border-amber-500/40 text-xs font-semibold text-amber-300 shadow-md transition-all active:scale-95 cursor-pointer"
            title={`點擊重新從「${activeSection.name}」開始`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{activeSection.name}</span>
            <span className="text-[10px] text-zinc-400 font-mono">
              (#{activeSection.startMeasureNumber}~#{activeSection.endMeasureNumber})
            </span>
          </button>
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

            const rawHanji = item.note.lyric.hanji ?? item.note.lyric.custom ?? '';
            const rawRoman =
              displayMode === 'hanji_pij' || displayMode === 'pij_only'
                ? item.note.lyric.pij ?? item.note.lyric.poj ?? ''
                : item.note.lyric.poj ?? item.note.lyric.pij ?? '';

            // Check if there is explicit input (even if it's "-" or "—")
            const hasHanji = Boolean(rawHanji && rawHanji.trim());
            const hasRoman = Boolean(rawRoman && rawRoman.trim());
            const hasExplicitText = hasHanji || hasRoman;

            if ((item.note.pitch === 0 || item.note.pitch === 'empty') && !hasExplicitText && !item.note.annotation) {
              return null; // Rest or empty space without lyrics or annotation
            }

            const isPitched = typeof item.note.pitch === 'number' && item.note.pitch > 0;
            const pitchLabel =
              item.note.pitch === 'empty'
                ? '␣'
                : item.note.pitch === 0
                ? '0'
                : `${item.note.accidental || ''}${item.note.pitch}`;

            // Determine text to show for romanization and main word
            // When no word input, do NOT display any word or dash; keep transparent space for aligned notation layout
            const romanDisplay = hasRoman ? rawRoman : '\u00A0';
            let mainWordDisplay = '\u00A0';
            if (displayMode === 'poj_only' || displayMode === 'pij_only') {
              mainWordDisplay = hasRoman ? rawRoman : '\u00A0';
            } else if (hasHanji) {
              mainWordDisplay = rawHanji;
            } else if (hasRoman) {
              mainWordDisplay = rawRoman;
            }

            return (
              <div
                key={`${item.measureIdx}-${item.noteIdx}-${idx}`}
                className={`relative flex flex-col items-center transition-transform duration-150 min-w-[32px] ${
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
                {(displayMode === 'all' || displayMode === 'hanji_poj' || displayMode === 'hanji_pij') && (
                  <span
                    className={`text-xs sm:text-sm font-serif italic mb-0.5 min-h-[1.25rem] transition-colors select-none ${
                      isNoteActive
                        ? 'text-amber-300 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                        : isPassed
                        ? 'text-amber-500/80'
                        : 'text-zinc-400'
                    }`}
                  >
                    {romanDisplay}
                  </span>
                )}

                {/* Hanji / Main Lyric Word */}
                <span
                  className={`text-2xl sm:text-4xl font-black tracking-wider min-h-[2.5rem] flex items-center justify-center transition-all duration-150 select-none ${
                    displayMode === 'poj_only' || displayMode === 'pij_only' ? 'font-serif italic text-xl sm:text-3xl' : ''
                  } ${
                    isNoteActive
                      ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 scale-105 drop-shadow-[0_0_16px_rgba(245,158,11,0.9)]'
                      : isPassed
                      ? 'text-amber-400'
                      : 'text-zinc-300'
                  }`}
                >
                  {mainWordDisplay}
                </span>

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
              const displayWord = displayMode === 'poj_only' || displayMode === 'pij_only' ? roman : (hanji || roman);
              if (!displayWord || !displayWord.trim()) return null;
              return (
                <span key={idx} className="font-medium">
                  {displayWord}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION QUICK-JUMP BAR: Touch-selectable sections with instant jump */}
      <div className="bg-zinc-900/90 px-4 py-3 border-b border-zinc-800/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold tracking-wide text-zinc-200">
              段落觸控跳轉 (Touch Sections to Jump)
            </span>
            <span className="text-[11px] text-zinc-500 hidden md:inline">
              · 觸控任一段落立即跳轉演奏
            </span>
          </div>
          {activeSection && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
              目前段落: {activeSection.name}
            </span>
          )}
        </div>

        {/* Touch-Friendly Section Cards Carousel */}
        <div
          ref={sectionScrollRef}
          className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scroll-smooth"
        >
          {songSections.map((sec, sIdx) => {
            const isSectionActive = activeSection?.id === sec.id;
            return (
              <button
                key={sec.id}
                id={`ktv-section-jump-btn-${sIdx}`}
                type="button"
                onClick={() => handleJumpToSection(sec)}
                className={`shrink-0 min-h-[48px] px-3.5 py-2 rounded-xl border text-left transition-all cursor-pointer select-none active:scale-95 touch-manipulation flex items-center gap-3 ${
                  isSectionActive
                    ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/20 border-amber-400 ring-2 ring-amber-500/30 text-white shadow-lg shadow-amber-500/10'
                    : 'bg-zinc-950/70 border-zinc-800/90 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-700'
                }`}
                title={`點擊跳轉至「${sec.name}」(${formatTime(sec.startTimeSec)})`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    isSectionActive
                      ? 'bg-amber-400 text-zinc-950 shadow-xs'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {sIdx + 1}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${isSectionActive ? 'text-amber-300' : 'text-zinc-200'}`}>
                      {sec.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/90 text-zinc-400">
                      {formatTime(sec.startTimeSec)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5">
                    <span>#{sec.startMeasureNumber}~#{sec.endMeasureNumber}小節</span>
                    {sec.firstLyricSnippet && (
                      <span className="text-zinc-500 max-w-[130px] truncate hidden sm:inline">
                        · {sec.firstLyricSnippet}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
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
                onClick={() => {
                  audioEngine.seekToMeasure(song, mIdx);
                  if (onSelectMeasure) onSelectMeasure(mIdx);
                }}
                className={`shrink-0 flex flex-col p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isMeasureActive
                    ? 'bg-zinc-800/90 border-amber-500/80 ring-2 ring-amber-500/30 shadow-lg'
                    : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700'
                }`}
                title={`點擊跳轉至第 ${mIdx + 1} 小節`}
              >
                {/* Measure Header with Section info and Edit button */}
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 px-1">
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-semibold">#{measure.measureNumber}</span>
                    {measure.section && (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/60">
                        {measure.section}
                      </span>
                    )}
                    {measure.chord && (
                      <span className="font-bold text-amber-400 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/50">
                        {measure.chord}
                      </span>
                    )}
                  </div>

                  {/* Edit Icon in Measure Card */}
                  {(onEditMeasure || onEditSection) && (
                    <button
                      id={`ktv-measure-edit-btn-${mIdx}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEditMeasure) {
                          onEditMeasure(mIdx);
                        } else if (onEditSection) {
                          const sec = songSections.find(s => s.startMeasureIndex <= mIdx && s.endMeasureIndex >= mIdx);
                          if (sec) {
                            onEditSection(sec);
                          } else {
                            onEditSection({
                              id: `sec-${mIdx}`,
                              name: measure.section || `第 ${mIdx + 1} 小節`,
                              startMeasureIndex: mIdx,
                              endMeasureIndex: mIdx,
                              startMeasureNumber: measure.measureNumber,
                              endMeasureNumber: measure.measureNumber,
                              startTimeSec: 0,
                              durationSec: 0,
                              startPercent: 0,
                              endPercent: 0,
                              firstLyricSnippet: '',
                            });
                          }
                        }
                      }}
                      className="p-1 rounded-md text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 active:scale-90 transition-all cursor-pointer border border-transparent hover:border-zinc-700 ml-1.5"
                      title={`編輯此段落/小節 (跳轉至簡譜編寫器)`}
                      aria-label={`編輯第 ${mIdx + 1} 小節`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
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
      <div className="p-4 bg-zinc-900/95 flex flex-col gap-3.5">
        {/* Progress Slider with Section Markers & Debounced Scrubbing */}
        <div className="flex flex-col gap-1.5 w-full">
          {/* Time & Active Section Info Bar */}
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400 min-w-[42px]">
                {formatTime(currentDisplayTime)}
              </span>
              {sliderDraggingPercent !== null && (
                <span className="text-[11px] font-sans px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                  跳轉位置: {formatTime(currentDisplayTime)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeSection && (
                <span className="text-[11px] font-sans text-zinc-400 hidden sm:inline-flex items-center gap-1">
                  <span>段落:</span>
                  <span className="text-amber-300 font-bold">{activeSection.name}</span>
                </span>
              )}
              <span className="text-zinc-400 min-w-[42px] text-right">
                {formatTime(totalDuration)}
              </span>
            </div>
          </div>

          {/* Timeline Track with Visual Section Markers */}
          <div className="relative py-2.5 select-none group flex items-center">
            {/* Background Track Bar */}
            <div className="w-full h-3 bg-zinc-800/90 rounded-full relative overflow-hidden border border-zinc-700/60 shadow-inner">
              {/* Progress Fill */}
              <div
                className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 rounded-full transition-[width] duration-75"
                style={{ width: `${Math.max(0, Math.min(100, currentDisplayPercent))}%` }}
              />
            </div>

            {/* Visual Section Markers along the Track (Select & Jump) */}
            <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none">
              {songSections.map((sec, sIdx) => {
                const isSectionActive = activeSection?.id === sec.id;
                return (
                  <div
                    key={sec.id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-auto z-20"
                    style={{ left: `${sec.startPercent}%` }}
                  >
                    {/* Interactive Marker Pin */}
                    <button
                      id={`ktv-slider-section-mark-${sIdx}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToSection(sec);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleJumpToSection(sec);
                      }}
                      className="group/mark relative flex flex-col items-center justify-center p-2 focus:outline-hidden cursor-pointer touch-manipulation transition-transform active:scale-90"
                      title={`段落標記: ${sec.name} (${formatTime(sec.startTimeSec)} · #${sec.startMeasureNumber}小節) - 點擊立即跳轉`}
                    >
                      {/* Vertical Notch Marker */}
                      <div
                        className={`w-1.5 h-4.5 rounded-full transition-all shadow-sm ${
                          isSectionActive
                            ? 'bg-amber-300 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] scale-110'
                            : 'bg-zinc-400 hover:bg-amber-400 group-hover/mark:bg-amber-400'
                        }`}
                      />

                      {/* Tooltip on Hover / Touch */}
                      <div className="absolute -top-9 opacity-0 group-hover/mark:opacity-100 group-focus/mark:opacity-100 pointer-events-none transition-all duration-150 transform -translate-y-1 group-hover/mark:translate-y-0 z-30 whitespace-nowrap">
                        <div className="bg-zinc-900 border border-amber-500/50 text-amber-300 text-[11px] font-medium px-2 py-0.5 rounded-md shadow-xl flex items-center gap-1.5 backdrop-blur-md">
                          <span className="font-bold">{sec.name}</span>
                          <span className="font-mono text-zinc-400 text-[10px]">{formatTime(sec.startTimeSec)}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Overlaid Range Input for Smooth Scrubbing & Immediate Debounced Jump */}
            <input
              id="ktv-seek-slider"
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={currentDisplayPercent}
              onChange={handleSliderChange}
              onMouseUp={handleSliderPointerUp}
              onTouchEnd={handleSliderPointerUp}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 touch-pan-x"
              aria-label="Karaoke Seek Slider"
            />
          </div>

          {/* Section Names Below Slider Track */}
          <div className="relative w-full h-5 hidden sm:block text-[10px] text-zinc-500 select-none overflow-hidden">
            {songSections.map((sec, sIdx) => {
              const isSectionActive = activeSection?.id === sec.id;
              return (
                <button
                  key={`label-${sec.id}`}
                  id={`ktv-slider-label-${sIdx}`}
                  onClick={() => handleJumpToSection(sec)}
                  className={`absolute transform -translate-x-1/2 px-1.5 py-0.5 rounded-sm transition-all cursor-pointer truncate max-w-[100px] ${
                    isSectionActive
                      ? 'text-amber-300 font-bold bg-amber-500/20 border border-amber-500/40 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                  style={{
                    left: `${Math.min(92, Math.max(8, sec.startPercent))}%`,
                  }}
                  title={`跳轉至 ${sec.name}`}
                >
                  {sec.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Main Transport Controls with Section Skip Navigation */}
          <div className="flex items-center gap-2">
            {/* Skip to Previous Section */}
            <button
              id="ktv-prev-section-btn"
              onClick={handleJumpPrevSection}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title="Jump to Previous Section (上一段落)"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Restart from beginning */}
            <button
              id="ktv-restart-btn"
              onClick={handleRestart}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title="Restart from beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Big Play / Pause Button */}
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

            {/* Skip to Next Section */}
            <button
              id="ktv-next-section-btn"
              onClick={handleJumpNextSection}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title="Jump to Next Section (下一段落)"
            >
              <SkipForward className="w-4 h-4" />
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
              title="Loop active measure (循環播放當前小節)"
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

