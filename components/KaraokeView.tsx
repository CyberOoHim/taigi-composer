'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { InstrumentType, JianpuNote, LyricDisplayMode, Measure, Song, VerseItem } from '@/types/song';
import { AudioEngine, PlaybackState } from '@/lib/audioEngine';
import { groupSongIntoVerses } from '@/lib/taigiUtils';
import { KaraokeSection } from './karaoke/SectionJumpBar';
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
  getStoredLeadInEnabled,
  setStoredLeadInEnabled,
} from '@/lib/storage';
import { computeVersesTiming, getKaraokeStageSequenceState } from '@/lib/karaokeSequencer';
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
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() => {
    if (audioEngine && typeof audioEngine.getState === 'function') {
      return audioEngine.getState();
    }
    return {
      isPlaying: false,
      isPaused: false,
      currentMeasureIndex: 0,
      currentNoteIndex: 0,
      currentNoteId: null,
      currentTime: 0,
      totalDuration: 0,
      progressPercent: 0,
    };
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
  const [leadInEnabled, setLeadInEnabledState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return getStoredLeadInEnabled(true);
    return true;
  });

  const toggleLeadInEnabled = useCallback(() => {
    setLeadInEnabledState(prev => {
      const next = !prev;
      setStoredLeadInEnabled(next);
      return next;
    });
  }, []);

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
      const firstSectionName = sectionStartIndices.length > 0 ? 'Intro' : 'Section 1';
      sectionStartIndices.unshift({ index: 0, name: firstSectionName });
    }

    // If there is only 1 section and no explicit sections anywhere, chunk every 4 measures
    if (sectionStartIndices.length === 1 && !song.measures[0]?.section) {
      const chunkSize = song.notesPerLine || 4;
      sectionStartIndices.length = 0;
      for (let i = 0; i < song.measures.length; i += chunkSize) {
        const secNum = Math.floor(i / chunkSize) + 1;
        sectionStartIndices.push({ index: i, name: `Section ${secNum}` });
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
        firstLyricSnippet: lyricWords.join(' ') || (song.measures[startMeasureIndex]?.chord ? `Chord: ${song.measures[startMeasureIndex]?.chord}` : ''),
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


  // Group song into natural musical verses (split by delimiters, punctuation, pauses, sections)
  const songVerses = useMemo(() => {
    return groupSongIntoVerses(song);
  }, [song]);

  // Compute verses timeline with tempoMultiplier
  const verseTimings = useMemo(() => {
    return computeVersesTiming(song, songVerses, tempoMultiplier);
  }, [song, songVerses, tempoMultiplier]);

  // Enhanced Stage sequence state: manages seamless transitions, preview lead-in, and rhythmic countdown
  const stageSequence = useMemo(() => {
    return getKaraokeStageSequenceState(
      verseTimings,
      playbackState.currentTime,
      song,
      tempoMultiplier,
      leadInEnabled
    );
  }, [verseTimings, playbackState.currentTime, song, tempoMultiplier, leadInEnabled]);

  const currentVerse = stageSequence.activeVerse || songVerses[0] || null;
  const nextVerse = stageSequence.nextVerse;

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
  }, [audioEngine, song, onSelectMeasure]);

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

  // Stop playback when jumping to edit a measure or section in Score Editor
  const handleEditMeasureInternal = useCallback((mIdx: number) => {
    audioEngine.stop();
    if (onEditMeasure) {
      onEditMeasure(mIdx);
    }
  }, [audioEngine, onEditMeasure]);

  const handleEditSectionInternal = useCallback((section: KaraokeSection) => {
    audioEngine.stop();
    if (onEditSection) {
      onEditSection(section);
    }
  }, [audioEngine, onEditSection]);

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

  const handleToggleAbLoop = useCallback(() => {
    setAbLoop(prev => ({
      ...prev,
      enabled: !prev.enabled,
      currentIteration: 0,
      startMeasure: !prev.enabled
        ? activeSection
          ? activeSection.startMeasureIndex
          : Math.max(0, playbackState.currentMeasureIndex)
        : prev.startMeasure,
      endMeasure: !prev.enabled
        ? activeSection
          ? activeSection.endMeasureIndex
          : Math.min(song.measures.length - 1, playbackState.currentMeasureIndex + 3)
        : prev.endMeasure,
    }));
  }, [activeSection, playbackState.currentMeasureIndex, song.measures.length]);

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
      className={`flex flex-col bg-[#0c0e14] text-white rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl transition-all duration-300 ${
        isStageMode || isFullscreen ? 'fixed inset-0 z-50 rounded-none h-dvh w-screen overflow-y-auto safe-pb safe-pt overscroll-none' : 'w-full'
      }`}
    >
      {/* Karaoke Top Status Bar (DAW Stage Monitor) */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-[#10121a]/95 border-b border-zinc-800/80 backdrop-blur-md gap-3 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-md">
            <Radio className={`w-5 h-5 ${playbackState.isPlaying ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold tracking-tight text-zinc-100">{song.title}</h2>
              <span className="daw-lcd px-2.5 py-0.5 text-xs font-mono font-bold rounded-lg shadow-xs">
                {effectiveKeyDisplay}
              </span>
              <span className="daw-lcd px-2.5 py-0.5 text-xs font-mono font-bold rounded-lg shadow-xs">
                {song.timeSignature}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {song.composer && `Music: ${song.composer}`} {song.lyricist && `| Lyrics: ${song.lyricist}`}
            </p>
          </div>
        </div>

        {/* Display Mode & Fullscreen Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Display Mode Selector */}
          <div id="ktv-display-mode-selector" className="flex items-center bg-[#0a0c10] p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              id="ktv-mode-all"
              type="button"
              onClick={() => setDisplayMode('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                displayMode === 'all'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              id="ktv-mode-hanji-poj"
              type="button"
              onClick={() => setDisplayMode('hanji_poj')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                displayMode === 'hanji_poj'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Hanji + POJ
            </button>
            <button
              id="ktv-mode-hanji-pij"
              type="button"
              onClick={() => setDisplayMode('hanji_pij')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                displayMode === 'hanji_pij'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Hanji + TL
            </button>
            <button
              id="ktv-mode-hanji-only"
              type="button"
              onClick={() => setDisplayMode('hanji_only')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                displayMode === 'hanji_only'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Hanji Only
            </button>
            <button
              id="ktv-mode-poj-only"
              type="button"
              onClick={() => setDisplayMode('poj_only')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                displayMode === 'poj_only'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              POJ Only
            </button>
          </div>

          {/* 1-Tap Zoom Toggle */}
          <button
            id="ktv-header-zoom-btn"
            type="button"
            onClick={cycleZoom}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#0a0c10] hover:bg-zinc-800 text-xs font-bold text-amber-300 border border-zinc-800 transition-all active:scale-95 touch-manipulation cursor-pointer"
            title={`Stage Zoom: Currently ${Math.round(stageZoom * 100)}% - Click to cycle (100%-175%)`}
          >
            <ZoomIn className="w-4 h-4 text-amber-400" />
            <span>{Math.round(stageZoom * 100)}%</span>
          </button>

          {/* Fullscreen / Stage Mode Button */}
          <button
            id="ktv-stage-mode-toggle-btn"
            type="button"
            onClick={toggleStageMode}
            className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold transition-all active:scale-95 touch-manipulation cursor-pointer ${
              isStageMode || isFullscreen
                ? 'bg-amber-500 text-zinc-950 font-bold border border-amber-400 shadow-md'
                : 'bg-[#0a0c10] text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-800'
            }`}
            title={isStageMode || isFullscreen ? 'Exit Stage Mode (ESC)' : 'Enter Stage Mode'}
          >
            {isStageMode || isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 text-amber-400" />}
            <span className="hidden sm:inline">{isStageMode || isFullscreen ? 'Exit Stage' : 'Stage Mode'}</span>
          </button>
        </div>
      </div>

      {/* Main KTV Stage Arena (Always 2 Verses: Next on top, Current in center) */}
      <KaraokeStage
        currentVerse={currentVerse}
        nextVerse={nextVerse}
        activeVerseTiming={stageSequence.activeVerseTiming}
        nextVerseTiming={stageSequence.nextVerseTiming}
        isAwaitingVocal={stageSequence.isAwaitingVocal}
        isVerseCompleted={stageSequence.isVerseCompleted}
        activeSection={activeSection}
        playbackState={playbackState}
        displayMode={displayMode}
        onJumpToSection={handleJumpToSection}
        isEcoMode={isEcoMode}
        zoomScale={stageZoom}
      />

      {/* Primary Karaoke Controls Bar (Moved directly under the lyric area) */}
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
        abLoop={abLoop}
        onToggleAbLoop={handleToggleAbLoop}
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

      {/* A-B Phrase Loop Rehearsal Bar (Expands directly below player deck when enabled) */}
      {abLoop.enabled && (
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
      )}


      {/* Aligned Numbered Notation Score Roll */}
      <AlignedScoreRoll
        song={song}
        playbackState={playbackState}
        displayMode={displayMode}
        songSections={songSections}
        audioEngine={audioEngine}
        sheetScrollRef={sheetScrollRef}
        loopRange={abLoop.enabled ? { startMeasure: abLoop.startMeasure, endMeasure: abLoop.endMeasure } : null}
        onSelectMeasure={onSelectMeasure}
        onEditMeasure={handleEditMeasureInternal}
        onEditSection={handleEditSectionInternal}
      />
    </div>
  );
};
