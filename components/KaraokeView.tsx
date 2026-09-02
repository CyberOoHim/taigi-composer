'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { InstrumentType, JianpuNote, LyricDisplayMode, Measure, Song, VerseItem } from '@/types/song';
import { AudioEngine, PlaybackState } from '@/lib/audioEngine';
import { groupSongIntoVerses } from '@/lib/taigiUtils';
import { KaraokeSection, SectionJumpBar } from './karaoke/SectionJumpBar';
import { KaraokeStage } from './karaoke/KaraokeStage';
import { AlignedScoreRoll } from './karaoke/AlignedScoreRoll';
import { KaraokeControls } from './karaoke/KaraokeControls';
import { AbLoopRehearsalBar, AbLoopState } from './karaoke/AbLoopRehearsalBar';
import { wakeLockManager } from '@/lib/wakeLock';
import {
  getStoredInstrument,
  setStoredInstrument,
  getStoredMelodyVolume,
  setStoredMelodyVolume,
  getStoredBackingVolume,
  setStoredBackingVolume,
  getStoredMetronomeVolume,
  setStoredMetronomeVolume,
  getStoredTranspose,
  setStoredTranspose,
  getStoredTempoMultiplier,
  setStoredTempoMultiplier,
  getStoredShowMixer,
  setStoredShowMixer,
  getStoredStageZoom,
  setStoredStageZoom,
} from '@/lib/storage';
import confetti from 'canvas-confetti';
import {
  Radio,
  Maximize2,
  Minimize2,
  ZoomIn,
} from 'lucide-react';

export type { KaraokeSection } from './karaoke/SectionJumpBar';

interface KaraokeViewProps {
  song: Song;
  audioEngine: AudioEngine;
  displayMode: LyricDisplayMode;
  setDisplayMode: (mode: LyricDisplayMode) => void;
  onSelectMeasure?: (measureIndex: number) => void;
  onEditSection?: (section: KaraokeSection) => void;
  onEditMeasure?: (measureIndex: number) => void;
  isEcoMode?: boolean;
}

export const KaraokeView: React.FC<KaraokeViewProps> = ({
  song,
  audioEngine,
  displayMode,
  setDisplayMode,
  onSelectMeasure,
  onEditSection,
  onEditMeasure,
  isEcoMode = false,
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

  const [instrument, setInstrumentState] = useState<InstrumentType>(() => {
    if (typeof window !== 'undefined') return getStoredInstrument();
    return 'piano';
  });
  const [melodyVolume, setMelodyVolumeState] = useState<number>(() => {
    if (typeof window !== 'undefined') return getStoredMelodyVolume(0.85);
    return 0.85;
  });
  const [backingVolume, setBackingVolumeState] = useState<number>(() => {
    if (typeof window !== 'undefined') return getStoredBackingVolume(0.5);
    return 0.5;
  });
  const [metronomeVolume, setMetronomeVolumeState] = useState<number>(() => {
    if (typeof window !== 'undefined') return getStoredMetronomeVolume(0.15);
    return 0.15;
  });
  const [transpose, setTransposeState] = useState<number>(() => {
    if (typeof window !== 'undefined') return getStoredTranspose(0);
    return 0;
  });
  const [tempoMultiplier, setTempoMultiplierState] = useState<number>(() => {
    if (typeof window !== 'undefined') return getStoredTempoMultiplier(1.0);
    return 1.0;
  });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isStageMode, setIsStageMode] = useState<boolean>(false);
  const [stageZoom, setStageZoomState] = useState<number>(() => {
    if (typeof window !== 'undefined') return getStoredStageZoom(1.0);
    return 1.0;
  });
  const [isLoopingMeasure, setIsLoopingMeasure] = useState<boolean>(false);
  const [abLoop, setAbLoop] = useState<AbLoopState>({
    enabled: false,
    startMeasure: 0,
    endMeasure: 1,
    loopTarget: 0,
    currentIteration: 0,
    tempoTrainer: false,
    tempoStepPercent: 5,
    baseTempoMultiplier: 1.0,
    maxTempoMultiplier: 1.25,
    countInEnabled: true,
  });
  const [showMixer, setShowMixerState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return getStoredShowMixer(false);
    return false;
  });

  const setInstrument = useCallback((inst: InstrumentType) => {
    setInstrumentState(inst);
    setStoredInstrument(inst);
  }, []);

  const setMelodyVolume = useCallback((vol: number) => {
    setMelodyVolumeState(vol);
    setStoredMelodyVolume(vol);
  }, []);

  const setBackingVolume = useCallback((vol: number) => {
    setBackingVolumeState(vol);
    setStoredBackingVolume(vol);
  }, []);

  const setMetronomeVolume = useCallback((vol: number) => {
    setMetronomeVolumeState(vol);
    setStoredMetronomeVolume(vol);
  }, []);

  const setTranspose = useCallback((tr: number | ((prev: number) => number)) => {
    setTransposeState(prev => {
      const next = typeof tr === 'function' ? tr(prev) : tr;
      setStoredTranspose(next);
      return next;
    });
  }, []);

  const setTempoMultiplier = useCallback((mul: number | ((prev: number) => number)) => {
    setTempoMultiplierState(prev => {
      const next = typeof mul === 'function' ? mul(prev) : mul;
      setStoredTempoMultiplier(next);
      return next;
    });
  }, []);

  const setShowMixer = useCallback((show: boolean | ((prev: boolean) => boolean)) => {
    setShowMixerState(prev => {
      const next = typeof show === 'function' ? show(prev) : show;
      setStoredShowMixer(next);
      return next;
    });
  }, []);

  // Slider scrubbing & debounce state
  const [sliderDraggingPercent, setSliderDraggingPercent] = useState<number | null>(null);
  const seekDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const sectionScrollRef = useRef<HTMLDivElement>(null);

  // Screen Wake Lock lifecycle management
  useEffect(() => {
    if (playbackState.isPlaying) {
      wakeLockManager.request();
    } else {
      wakeLockManager.release();
    }
    return () => {
      wakeLockManager.release();
    };
  }, [playbackState.isPlaying]);

  // Sync state with AudioEngine
  useEffect(() => {
    const unsubState = audioEngine.subscribeState(state => {
      setPlaybackState(state);
    });

    const unsubEnded = audioEngine.subscribeEnded(() => {
      // Trigger confetti celebration on Karaoke finish (skip or lightweight in eco mode)
      try {
        confetti({
          particleCount: isEcoMode ? 15 : 75,
          spread: isEcoMode ? 40 : 70,
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
  }, [audioEngine, isEcoMode]);

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
      targetFps: isEcoMode ? 20 : 30,
    });
  }, [
    audioEngine,
    instrument,
    melodyVolume,
    backingVolume,
    metronomeVolume,
    transpose,
    tempoMultiplier,
    isEcoMode,
  ]);

  // Update loop measure or A-B loop setting when looping options change
  useEffect(() => {
    if (abLoop.enabled) {
      audioEngine.setOptions({
        loopMeasure: null,
        loopRange: {
          startMeasure: abLoop.startMeasure,
          endMeasure: abLoop.endMeasure,
        },
      });
    } else {
      audioEngine.setOptions({
        loopMeasure: isLoopingMeasure ? playbackState.currentMeasureIndex : null,
        loopRange: null,
      });
    }
  }, [
    audioEngine,
    abLoop.enabled,
    abLoop.startMeasure,
    abLoop.endMeasure,
    isLoopingMeasure,
    playbackState.currentMeasureIndex,
  ]);

  // Hook into loop iteration for A-B rehearsal trainer & loop count targets
  useEffect(() => {
    audioEngine.setLoopIterationListener((iterationCount: number) => {
      setAbLoop(prev => {
        if (!prev.enabled) return prev;

        // Check if reached loop target
        if (prev.loopTarget > 0 && iterationCount >= prev.loopTarget) {
          audioEngine.stop();
          return { ...prev, currentIteration: iterationCount };
        }

        // If tempo trainer is active, speed up!
        if (prev.tempoTrainer) {
          const stepMultiplier = prev.tempoStepPercent / 100;
          setTempoMultiplier(current => {
            const next = Math.min(prev.maxTempoMultiplier, Math.round((current + stepMultiplier) * 100) / 100);
            return next;
          });
        }

        return { ...prev, currentIteration: iterationCount };
      });
    });

    return () => {
      audioEngine.setLoopIterationListener(undefined);
    };
  }, [audioEngine, setTempoMultiplier]);

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

    // 1. Calculate measure start times using audioEngine to guarantee 100% precision with playback engine
    const measureStartTimes: number[] = song.measures.map((_, i) =>
      audioEngine.getMeasureStartTime(song, i)
    );
    const totalDuration = audioEngine.calculateSongDuration(song) || 1;

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
  }, [song, audioEngine]);

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

  // Auto-scroll section card into view in carousel when active section changes
  useEffect(() => {
    if (playbackState.isPlaying && sectionScrollRef.current && activeSection) {
      const sIdx = songSections.findIndex(s => s.id === activeSection.id);
      if (sIdx !== -1) {
        const secEl = sectionScrollRef.current.querySelector(`#ktv-section-jump-btn-${sIdx}`);
        if (secEl) {
          secEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }
  }, [activeSection, playbackState.isPlaying, songSections]);

  // Group song into natural musical verses (split by delimiters, punctuation, pauses, sections)
  const songVerses = useMemo(() => {
    return groupSongIntoVerses(song);
  }, [song]);

  // Find active verse index based on currently playing note and measure
  const activeVerseIndex = useMemo(() => {
    if (!songVerses.length) return 0;
    const currentM = playbackState.currentMeasureIndex;
    const currentN = playbackState.currentNoteIndex;

    // 1. Precise note match
    const idx = songVerses.findIndex(verse =>
      verse.notes.some(n => n.measureIndex === currentM && n.noteIndex === currentN)
    );
    if (idx !== -1) return idx;

    // 2. Measure fallback match
    const mIdx = songVerses.findIndex(verse =>
      verse.notes.some(n => n.measureIndex === currentM)
    );
    if (mIdx !== -1) return mIdx;

    return 0;
  }, [songVerses, playbackState.currentMeasureIndex, playbackState.currentNoteIndex]);

  const currentVerse = songVerses[activeVerseIndex] || songVerses[0] || null;
  const nextVerse = songVerses[activeVerseIndex + 1] || null;

  // Jump to specific section handler (instant touch jump)
  const handleJumpToSection = useCallback((section: KaraokeSection) => {
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
    // Scroll section jump bar carousel to active section
    if (sectionScrollRef.current) {
      const sIdx = songSections.findIndex(s => s.id === section.id);
      if (sIdx !== -1) {
        const secEl = sectionScrollRef.current.querySelector(`#ktv-section-jump-btn-${sIdx}`);
        if (secEl) {
          secEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }
  }, [audioEngine, song, onSelectMeasure, songSections]);

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

  const handleStartAbRehearsal = () => {
    const startTime = audioEngine.getMeasureStartTime(song, abLoop.startMeasure);
    setAbLoop(prev => ({ ...prev, currentIteration: 0 }));

    if (abLoop.countInEnabled) {
      audioEngine.playCountIn(
        song,
        () => {},
        () => {
          audioEngine.play(song, startTime);
        }
      );
    } else {
      audioEngine.play(song, startTime);
    }
  };

  const handleStopAbRehearsal = () => {
    audioEngine.stop();
  };

  const handleResetTempo = () => {
    setTempoMultiplier(1.0);
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

    // Jump to target position/section after 160ms of continuous sliding
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

  const cycleZoom = useCallback(() => {
    setStageZoomState(prev => {
      let next = 1.0;
      if (prev < 1.2) next = 1.25;
      else if (prev < 1.45) next = 1.5;
      else if (prev < 1.7) next = 1.75;
      else next = 1.0;
      setStoredStageZoom(next);
      return next;
    });
  }, []);

  const toggleStageMode = useCallback(() => {
    setIsStageMode(prev => {
      const next = !prev;
      if (next) {
        if (containerRef.current && typeof containerRef.current.requestFullscreen === 'function') {
          containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        }
      } else {
        if (typeof document !== 'undefined' && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
          document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        } else {
          setIsFullscreen(false);
        }
      }
      return next;
    });
  }, []);

  // Lock body scrolling during Stage Mode
  useEffect(() => {
    if (isStageMode) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('stage-mode-active');
      return () => {
        document.body.style.overflow = origOverflow;
        document.body.classList.remove('stage-mode-active');
      };
    }
  }, [isStageMode]);

  // Escape key to leave stage mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStageMode) {
        toggleStageMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStageMode, toggleStageMode]);

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
        isStageMode || isFullscreen ? 'fixed inset-0 z-50 rounded-none h-dvh w-screen overflow-y-auto safe-pb safe-pt overscroll-none' : 'w-full'
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

        {/* Display Mode & Fullscreen Tabs */}
        <div className="flex items-center gap-2">
          {/* Display Mode Selector */}
          <div id="ktv-display-mode-selector" className="flex items-center bg-zinc-800/90 p-1 rounded-xl border border-zinc-700/60 text-xs">
            <button
              id="ktv-mode-all"
              type="button"
              onClick={() => setDisplayMode('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                displayMode === 'all'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              全顯示 (All)
            </button>
            <button
              id="ktv-mode-hanji-poj"
              type="button"
              onClick={() => setDisplayMode('hanji_poj')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                displayMode === 'hanji_poj'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              漢字 + 白話字
            </button>
            <button
              id="ktv-mode-hanji-pij"
              type="button"
              onClick={() => setDisplayMode('hanji_pij')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                displayMode === 'hanji_pij'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              漢字 + 臺羅
            </button>
            <button
              id="ktv-mode-hanji-only"
              type="button"
              onClick={() => setDisplayMode('hanji_only')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                displayMode === 'hanji_only'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              純漢字
            </button>
            <button
              id="ktv-mode-poj-only"
              type="button"
              onClick={() => setDisplayMode('poj_only')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                displayMode === 'poj_only'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              純POJ
            </button>
          </div>

          {/* 1-Tap Zoom Toggle */}
          <button
            id="ktv-header-zoom-btn"
            type="button"
            onClick={cycleZoom}
            className="flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-amber-300 border border-zinc-700/60 transition-all active:scale-95 touch-manipulation cursor-pointer"
            title={`譜架縮放 (Zoom Scale): 目前 ${Math.round(stageZoom * 100)}% - 點擊循環切換 (100%~175%)`}
          >
            <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
            <span>{Math.round(stageZoom * 100)}%</span>
          </button>

          {/* Fullscreen / Stage Mode Button */}
          <button
            id="ktv-stage-mode-toggle-btn"
            type="button"
            onClick={toggleStageMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl text-xs font-bold transition-all active:scale-95 touch-manipulation cursor-pointer ${
              isStageMode || isFullscreen
                ? 'bg-amber-500 text-zinc-950 font-bold border border-amber-400 shadow-md'
                : 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border border-zinc-700/60'
            }`}
            title={isStageMode || isFullscreen ? '離開譜架/舞台模式 (ESC)' : '進入譜架/舞台專注模式 (Stage Mode)'}
          >
            {isStageMode || isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 text-amber-400" />}
            <span className="hidden sm:inline">{isStageMode || isFullscreen ? '離開譜架' : '譜架模式'}</span>
          </button>
        </div>
      </div>

      {/* Main KTV Stage Arena (Always 2 Verses: Next on top, Current in center) */}
      <KaraokeStage
        currentVerse={currentVerse}
        nextVerse={nextVerse}
        activeSection={activeSection}
        playbackState={playbackState}
        displayMode={displayMode}
        onJumpToSection={handleJumpToSection}
        isEcoMode={isEcoMode}
        zoomScale={stageZoom}
      />

      {/* Section Quick Jump Bar */}
      <SectionJumpBar
        songSections={songSections}
        activeSection={activeSection}
        onJumpToSection={handleJumpToSection}
        formatTime={formatTime}
        sectionScrollRef={sectionScrollRef}
      />

      {/* A-B Phrase Loop Rehearsal Bar */}
      <AbLoopRehearsalBar
        song={song}
        abLoop={abLoop}
        onUpdateAbLoop={setAbLoop}
        activeSection={activeSection}
        currentMeasureIndex={playbackState.currentMeasureIndex}
        isPlaying={playbackState.isPlaying}
        tempoMultiplier={tempoMultiplier}
        onStartAbRehearsal={handleStartAbRehearsal}
        onStopAbRehearsal={handleStopAbRehearsal}
        onResetTempo={handleResetTempo}
      />

      {/* Aligned Jianpu Score Roll */}
      <AlignedScoreRoll
        song={song}
        playbackState={playbackState}
        displayMode={displayMode}
        songSections={songSections}
        audioEngine={audioEngine}
        sheetScrollRef={sheetScrollRef}
        loopRange={abLoop.enabled ? { startMeasure: abLoop.startMeasure, endMeasure: abLoop.endMeasure } : null}
        onSelectMeasure={onSelectMeasure}
        onEditMeasure={onEditMeasure}
        onEditSection={onEditSection}
      />

      {/* Primary Karaoke Controls Bar */}
      <KaraokeControls
        playbackState={playbackState}
        songSections={songSections}
        activeSection={activeSection}
        totalDuration={totalDuration}
        currentDisplayTime={currentDisplayTime}
        currentDisplayPercent={currentDisplayPercent}
        sliderDraggingPercent={sliderDraggingPercent}
        instrument={instrument}
        melodyVolume={melodyVolume}
        backingVolume={backingVolume}
        metronomeVolume={metronomeVolume}
        transpose={transpose}
        tempoMultiplier={tempoMultiplier}
        isLoopingMeasure={isLoopingMeasure}
        showMixer={showMixer}
        song={song}
        isStageMode={isStageMode}
        onToggleStageMode={toggleStageMode}
        zoomScale={stageZoom}
        onCycleZoom={cycleZoom}
        onSliderChange={handleSliderChange}
        onSliderPointerUp={handleSliderPointerUp}
        onJumpToSection={handleJumpToSection}
        onJumpPrevSection={handleJumpPrevSection}
        onJumpNextSection={handleJumpNextSection}
        onRestart={handleRestart}
        onTogglePlay={handleTogglePlay}
        onTranspose={handleTranspose}
        onSetTranspose={setTranspose}
        onSetInstrument={setInstrument}
        onToggleLoopMeasure={() => setIsLoopingMeasure(!isLoopingMeasure)}
        onToggleShowMixer={() => setShowMixer(!showMixer)}
        onSetMelodyVolume={setMelodyVolume}
        onSetBackingVolume={setBackingVolume}
        onSetMetronomeVolume={setMetronomeVolume}
        onSetTempoMultiplier={setTempoMultiplier}
        formatTime={formatTime}
      />
    </div>
  );
};
