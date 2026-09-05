'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LyricDisplayMode, Song } from '@/types/song';
import { PRESET_SONGS, createFreshSong } from '@/lib/presets';
import { audioEngine } from '@/lib/audioEngine';
import { wakeLockManager } from '@/lib/wakeLock';
import { HeaderBar, ActiveTabMode } from '@/components/HeaderBar';
import { KaraokeView, KaraokeSection } from '@/components/KaraokeView';
import { ComposerEditor } from '@/components/ComposerEditor';
import { ImportExportModal } from '@/components/ImportExportModal';
import { QuickLyricAlignerModal } from '@/components/QuickLyricAlignerModal';
import { GeminiAuthModal } from '@/components/GeminiAuthModal';
import { AiScoreScannerModal } from '@/components/AiScoreScannerModal';
import { NewSongModal } from '@/components/NewSongModal';
import { useSongHistory } from '@/hooks/useSongHistory';
import { usePowerSaveMode } from '@/hooks/usePowerSaveMode';
import {
  getStoredActiveTab,
  setStoredActiveTab,
  getStoredDisplayMode,
  setStoredDisplayMode,
  getStoredCurrentSong,
  setStoredCurrentSong,
  saveSongToCustomLibrary,
} from '@/lib/storage';
import {
  Mic2,
  Music,
  Sparkles,
  Layers,
  ArrowRight,
  Play,
} from 'lucide-react';

export default function Home() {
  const {
    song,
    setSong,
    loadNewSong,
    undo,
    redo,
    canUndo,
    canRedo,
    pastCount,
    futureCount,
  } = useSongHistory(PRESET_SONGS[0]);

  const {
    isEcoMode,
    toggleEcoMode,
    batteryLevel,
    isCharging,
  } = usePowerSaveMode();

  useEffect(() => {
    audioEngine.setOptions({
      ecoMode: isEcoMode,
      targetFps: isEcoMode ? 20 : 30,
    });
  }, [isEcoMode]);

  // Default to 'split' (雙視窗) as requested
  const [activeTab, setActiveTabState] = useState<ActiveTabMode>(() => {
    if (typeof window !== 'undefined') return getStoredActiveTab();
    return 'split';
  });
  const [displayMode, setDisplayModeState] = useState<LyricDisplayMode>(() => {
    if (typeof window !== 'undefined') return getStoredDisplayMode();
    return 'all';
  });
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isAlignerOpen, setIsAlignerOpen] = useState(false);
  const [isGeminiAuthOpen, setIsGeminiAuthOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isNewSongConfirmOpen, setIsNewSongConfirmOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetMeasureIndex, setTargetMeasureIndex] = useState<number | null>(null);

  // Load persisted current song from localStorage on mount
  useEffect(() => {
    const savedSong = getStoredCurrentSong();
    if (savedSong && (savedSong.id !== PRESET_SONGS[0].id || savedSong.title !== PRESET_SONGS[0].title)) {
      loadNewSong(savedSong);
    }
  }, [loadNewSong]);

  const setActiveTab = useCallback((tab: ActiveTabMode) => {
    if (tab === 'editor' && audioEngine) {
      audioEngine.stop();
    }
    setActiveTabState(tab);
    setStoredActiveTab(tab);
  }, []);

  const setDisplayMode = useCallback((mode: LyricDisplayMode) => {
    setDisplayModeState(mode);
    setStoredDisplayMode(mode);
  }, []);

  const handleStartFreshSong = useCallback(() => {
    setIsNewSongConfirmOpen(true);
  }, []);

  const handleConfirmFreshSong = useCallback((saveCurrentFirst: boolean) => {
    if (saveCurrentFirst) {
      saveSongToCustomLibrary(song);
    }
    if (audioEngine) {
      audioEngine.stop();
    }
    const freshSong = createFreshSong();
    loadNewSong(freshSong);
    if (activeTab === 'karaoke') {
      setActiveTab('editor');
    }
    setTargetMeasureIndex(0);
    setIsNewSongConfirmOpen(false);
  }, [song, activeTab, setActiveTab, loadNewSong]);

  // Save current song to localStorage when updated
  useEffect(() => {
    if (song) {
      setStoredCurrentSong(song);
    }
  }, [song]);

  // Flush song state to storage immediately when switching tabs or apps (especially critical on iPad)
  useEffect(() => {
    const flushSongToStorage = () => {
      if (song) {
        setStoredCurrentSong(song);
      }
    };

    window.addEventListener('pagehide', flushSongToStorage);
    window.addEventListener('beforeunload', flushSongToStorage);
    const handleVisibility = () => {
      if (document.hidden) {
        flushSongToStorage();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pagehide', flushSongToStorage);
      window.removeEventListener('beforeunload', flushSongToStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [song]);

  // Listen to cross-tab storage changes (e.g. if user edited or imported in another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'jianpu_current_song_v2' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && parsed.id && parsed.id !== song.id) {
            loadNewSong(parsed);
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [song.id, loadNewSong]);

  const handleApplyScannedSong = useCallback(
    (
      resultSong: Song,
      action: 'new' | 'replace' | 'append' | 'lyrics'
    ) => {
      if (audioEngine) {
        audioEngine.stop();
      }
      if (action === 'new') {
        loadNewSong(resultSong);
      } else {
        setSong(resultSong);
      }
    },
    [loadNewSong, setSong]
  );

  const handleEditMeasure = useCallback((measureIndex: number) => {
    if (audioEngine) {
      audioEngine.stop();
    }
    if (activeTab === 'karaoke') {
      setActiveTab('editor');
    }
    setTargetMeasureIndex(measureIndex);
  }, [activeTab, setActiveTab]);

  const handleEditSection = useCallback((section: KaraokeSection) => {
    if (audioEngine) {
      audioEngine.stop();
    }
    if (activeTab === 'karaoke') {
      setActiveTab('editor');
    }
    setTargetMeasureIndex(section.startMeasureIndex);
  }, [activeTab, setActiveTab]);

  const handleTogglePlay = useCallback(() => {
    if (!audioEngine) return;
    if (isPlaying) {
      audioEngine.pause();
    } else if (audioEngine.getIsPaused()) {
      void wakeLockManager.requestForPlayback(isEcoMode);
      audioEngine.resume();
    } else {
      void wakeLockManager.requestForPlayback(isEcoMode);
      audioEngine.play(song, 0);
    }
  }, [isPlaying, song, isEcoMode]);

  const handlePlayKaraoke = useCallback((startMeasure?: number) => {
    setActiveTab('karaoke');
    const startSec =
      startMeasure !== undefined && startMeasure > 0
        ? audioEngine.getMeasureStartTime(song, startMeasure)
        : 0;
    audioEngine.stop();
    void wakeLockManager.requestForPlayback(isEcoMode);
    audioEngine.play(song, startSec);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [setActiveTab, song, isEcoMode]);

  const handleSelectSong = useCallback((newSong: Song) => {
    if (audioEngine) {
      audioEngine.stop();
    }
    loadNewSong(newSong);
  }, [loadNewSong]);

  // Subscribe to audio engine playback state
  useEffect(() => {
    if (!audioEngine) return;
    const unsub = audioEngine.subscribeState(state => {
      setIsPlaying(state.isPlaying);
    });
    return () => {
      unsub();
    };
  }, []);

  // Global Keyboard shortcuts: Space for playback, Ctrl+Z / Cmd+Z for undo, Ctrl+Y / Cmd+Shift+Z for redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        activeEl?.getAttribute('contenteditable') === 'true';

      if (isTyping) return;

      // Check for Undo (Ctrl+Z or Cmd+Z without Shift)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      // Check for Redo (Ctrl+Y or Cmd+Shift+Z or Ctrl+Shift+Z)
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Spacebar to toggle playback
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleTogglePlay]);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0c0e14] text-zinc-900 dark:text-zinc-100 flex flex-col antialiased selection:bg-amber-500/30">
      {/* Top DAW Master Transport Console */}
      <HeaderBar
        song={song}
        onSelectSong={handleSelectSong}
        onStartFreshSong={handleStartFreshSong}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onOpenGeminiAuth={() => setIsGeminiAuthOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        pastCount={pastCount}
        futureCount={futureCount}
        isEcoMode={isEcoMode}
        onToggleEcoMode={toggleEcoMode}
        batteryLevel={batteryLevel}
        isCharging={isCharging}
      />

      {/* Main Studio Canvas */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-5 lg:px-8 py-4 sm:py-6 flex flex-col gap-6 safe-px">
        {/* Dynamic View Mode Container */}
        {activeTab === 'karaoke' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <KaraokeView
              song={song}
              audioEngine={audioEngine}
              displayMode={displayMode}
              setDisplayMode={setDisplayMode}
              onSelectMeasure={() => {}}
              onEditMeasure={handleEditMeasure}
              onEditSection={handleEditSection}
              isEcoMode={isEcoMode}
            />

            {/* Quick Switch to Editor CTA Rack */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 bg-white dark:bg-[#141720] border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl shadow-xs gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 border border-amber-500/20">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Want to edit this song&apos;s melody, notes, or lyrics?
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Switch to Score Editor mode to adjust numbered notes 1-7, key signatures, chords, and Hanji/POJ/TL lyrics. Full Undo and Redo supported.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('editor')}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[44px] shrink-0 w-full sm:w-auto"
              >
                <span>Open Editor</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <ComposerEditor
              song={song}
              onUpdateSong={setSong}
              audioEngine={audioEngine}
              displayMode={displayMode}
              setDisplayMode={setDisplayMode}
              onOpenAligner={() => setIsAlignerOpen(true)}
              onOpenScanner={() => setIsScannerOpen(true)}
              onStartFreshSong={handleStartFreshSong}
              onPlayKaraoke={handlePlayKaraoke}
              targetMeasureIndex={targetMeasureIndex}
              onTargetMeasureHandled={() => setTargetMeasureIndex(null)}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              pastCount={pastCount}
              futureCount={futureCount}
            />

            {/* Quick Switch to Karaoke Stage CTA Rack */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 bg-white dark:bg-[#141720] border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl shadow-xs gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 border border-amber-500/20">
                  <Mic2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Ready to sing or rehearse this song?
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Jump directly to Karaoke Stage to rehearse with real-time Romanization, lyrics countdown, and multi-instrument accompaniment.
                  </p>
                </div>
              </div>
              <button
                id="composer-cta-karaoke-play-btn"
                type="button"
                onClick={() => handlePlayKaraoke()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[44px] shrink-0 w-full sm:w-auto"
              >
                <Mic2 className="w-4 h-4" />
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Karaoke Play</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'split' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in duration-200">
            {/* Left Channel Rack: Live Vocal Stage */}
            <div className="xl:col-span-6 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1 py-0.5">
                <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
                  <Mic2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Live Karaoke Player</span>
                </h3>
              </div>
              <KaraokeView
                song={song}
                audioEngine={audioEngine}
                displayMode={displayMode}
                setDisplayMode={setDisplayMode}
                onEditMeasure={handleEditMeasure}
                onEditSection={handleEditSection}
                isEcoMode={isEcoMode}
              />
            </div>

            {/* Right Channel Rack: Score Composer Deck */}
            <div className="xl:col-span-6 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1 py-0.5">
                <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <Music className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Score Composer</span>
                </h3>
              </div>
              <ComposerEditor
                song={song}
                onUpdateSong={setSong}
                audioEngine={audioEngine}
                displayMode={displayMode}
                setDisplayMode={setDisplayMode}
                onOpenAligner={() => setIsAlignerOpen(true)}
                onOpenScanner={() => setIsScannerOpen(true)}
                onStartFreshSong={handleStartFreshSong}
                onPlayKaraoke={handlePlayKaraoke}
                targetMeasureIndex={targetMeasureIndex}
                onTargetMeasureHandled={() => setTargetMeasureIndex(null)}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                pastCount={pastCount}
                futureCount={futureCount}
              />
            </div>
          </div>
        )}

        {/* Studio Hardware Specs & Explanatory Rack Strip */}
        <div className="mt-2 p-5 bg-white/90 dark:bg-[#141720]/90 border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl text-xs text-zinc-600 dark:text-zinc-400 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-xs">
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Multi-format Lyrics Support (Hanji / POJ / TL)</span>
            </h4>
            <p className="leading-relaxed text-zinc-500 dark:text-zinc-400">
              Supports Hanji (漢字), Pe̍h-ōe-jī (POJ), Tâi-lô (TL), and Han-lô mixed orthography. Each note precisely aligns with corresponding syllables and vocal annotations.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 text-xs uppercase tracking-wider">
              <Mic2 className="w-4 h-4 text-amber-500" />
              <span>Karaoke Engine</span>
            </h4>
            <p className="leading-relaxed text-zinc-500 dark:text-zinc-400">
              Built-in Web Audio API multi-instrument soundfonts (Grand Piano, Bamboo Flute, Classical Guitar, 80s Synth, Glockenspiel), real-time transpose (±12 semitones), custom BPM, chord accompaniment, and metronome.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 text-xs uppercase tracking-wider">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Import, Export & Share</span>
            </h4>
            <p className="leading-relaxed text-zinc-500 dark:text-zinc-400">
              Supports standard JSON score files (.taigi.json) and human-readable plain text Numbered Notation formats (.txt) for one-click copying or downloading. Includes presets for classical compositions.
            </p>
          </div>
        </div>
      </main>

      {/* Modals */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        currentSong={song}
        onLoadSong={handleSelectSong}
        onOpenScanner={() => setIsScannerOpen(true)}
        onStartFreshSong={handleStartFreshSong}
      />

      <QuickLyricAlignerModal
        isOpen={isAlignerOpen}
        onClose={() => setIsAlignerOpen(false)}
        song={song}
        onApplyLyrics={setSong}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenGeminiAuth={() => setIsGeminiAuthOpen(true)}
      />

      <GeminiAuthModal
        isOpen={isGeminiAuthOpen}
        onClose={() => setIsGeminiAuthOpen(false)}
      />

      <AiScoreScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        currentSong={song}
        onApply={handleApplyScannedSong}
        onOpenGeminiAuth={() => setIsGeminiAuthOpen(true)}
      />


      <NewSongModal
        isOpen={isNewSongConfirmOpen}
        onClose={() => setIsNewSongConfirmOpen(false)}
        currentSongTitle={song.title}
        onConfirm={handleConfirmFreshSong}
      />
    </div>
  );
}
