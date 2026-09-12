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
import { LyricSearchModal } from '@/components/LyricSearchModal';
import { GeminiAuthModal } from '@/components/GeminiAuthModal';
import { AiScoreScannerModal } from '@/components/AiScoreScannerModal';
import { NewSongModal } from '@/components/NewSongModal';
import { useSongHistory } from '@/hooks/useSongHistory';
import { usePowerSaveMode } from '@/hooks/usePowerSaveMode';
import {
  getStoredActiveTabOrNull,
  setStoredActiveTab,
  getStoredDisplayMode,
  setStoredDisplayMode,
  getStoredCurrentSong,
  setStoredCurrentSong,
  saveSongToCustomLibrary,
  getStoredAutosaveInterval,
  setStoredAutosaveInterval,
  getStoredEnableChords,
  setStoredEnableChords,
  setStoredNoteSubMode,
  STORAGE_KEYS,
} from '@/lib/storage';
import { prefersKaraokeDefaultLayout } from '@/lib/device';
import {
  saveSongToDB,
  getSongFromDB,
  getCustomSongsFromDB,
  getModifiedPresetIds,
  resetPresetToFactory,
  saveActiveSongToDB,
  getActiveSongFromDB,
  migrateLocalStorageToDB,
} from '@/lib/indexedDb';
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
    contentRevision,
  } = useSongHistory(PRESET_SONGS[0]);

  const {
    isEcoMode,
    toggleEcoMode,
    setEcoMode,
    batteryLevel,
    isCharging,
  } = usePowerSaveMode();

  const [enableChords, setEnableChords] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return getStoredEnableChords(true);
    return true;
  });

  const toggleEnableChords = useCallback(() => {
    setEnableChords(prev => {
      const next = !prev;
      setStoredEnableChords(next);
      audioEngine.setOptions({ chordEnabled: next });
      return next;
    });
  }, []);

  useEffect(() => {
    audioEngine.setOptions({
      ecoMode: isEcoMode,
      targetFps: isEcoMode ? 20 : 30,
      chordEnabled: enableChords,
    });
  }, [isEcoMode, enableChords]);

  // SSR/desktop default is split; first-run iPad/standalone/coarse pointers switch to karaoke in bootstrap.
  const [activeTab, setActiveTabState] = useState<ActiveTabMode>('split');
  const [displayMode, setDisplayModeState] = useState<LyricDisplayMode>('all');
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'presets' | 'custom' | 'export' | 'import' | 'ai_scan'>('presets');
  const [importExportFormat, setImportExportFormat] = useState<'json' | 'text' | 'midi'>('json');
  const [isLyricSearchOpen, setIsLyricSearchOpen] = useState(false);
  const [isAlignerOpen, setIsAlignerOpen] = useState(false);
  const [isGeminiAuthOpen, setIsGeminiAuthOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isNewSongConfirmOpen, setIsNewSongConfirmOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetMeasureIndex, setTargetMeasureIndex] = useState<number | null>(null);
  const [targetKaraokeMeasureIndex, setTargetKaraokeMeasureIndex] = useState<number | null>(null);
  const [karaokeReturnTarget, setKaraokeReturnTarget] = useState<{
    measureIndex: number;
    originalMeasureIndex: number;
  } | null>(null);

  // Persistence State
  const [savedRevision, setSavedRevision] = useState(0);
  const isDirty = contentRevision !== savedRevision;
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [autosaveInterval, setAutosaveIntervalState] = useState<number>(0);
  const [customSongs, setCustomSongs] = useState<Song[]>([]);
  const [modifiedPresetIds, setModifiedPresetIds] = useState<Set<string>>(new Set());
  const hasInitializedRef = React.useRef(false);

  // Bootstrap IndexedDB on mount: migrate legacy localStorage, load active song, custom songs, and modified presets
  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        await migrateLocalStorageToDB();

        const [customList, modifiedIds, activeDbSong] = await Promise.all([
          getCustomSongsFromDB(),
          getModifiedPresetIds(),
          getActiveSongFromDB(),
        ]);

        if (!isMounted) return;

        const storedTab = getStoredActiveTabOrNull();
        if (storedTab) {
          setActiveTabState(storedTab);
        } else if (prefersKaraokeDefaultLayout()) {
          setActiveTabState('karaoke');
        }
        const storedMode = getStoredDisplayMode();
        if (storedMode && storedMode !== 'all') setDisplayModeState(storedMode);
        const storedAutosave = getStoredAutosaveInterval(0);
        if (storedAutosave !== 0) setAutosaveIntervalState(storedAutosave);
        setCustomSongs(customList);
        setModifiedPresetIds(modifiedIds);

        if (activeDbSong && Array.isArray(activeDbSong.measures) && activeDbSong.measures.length > 0) {
          loadNewSong(activeDbSong);
        } else {
          const savedSong = getStoredCurrentSong();
          if (savedSong && Array.isArray(savedSong.measures) && savedSong.measures.length > 0) {
            loadNewSong(savedSong);
          }
        }
      } catch (err) {
        console.warn('[page] IndexedDB bootstrap fallback to localStorage:', err);
        const savedSong = getStoredCurrentSong();
        if (savedSong) loadNewSong(savedSong);
      } finally {
        if (isMounted) {
          hasInitializedRef.current = true;
        }
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [loadNewSong]);

  // Persist the active song to localStorage after bootstrap. LOAD_SONG is not an edit.
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    setStoredCurrentSong(song);
  }, [song]);


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

  const handleSaveSong = useCallback(async () => {
    if (!song || isSaving) return;
    setIsSaving(true);
    try {
      await saveActiveSongToDB(song);
      setStoredCurrentSong(song);

      const [customList, modifiedIds] = await Promise.all([
        getCustomSongsFromDB(),
        getModifiedPresetIds(),
      ]);
      setCustomSongs(customList);
      setModifiedPresetIds(modifiedIds);

      setSavedRevision(contentRevision);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2200);
    } catch (err) {
      console.error('[page] Failed to save song to IndexedDB:', err);
    } finally {
      setIsSaving(false);
    }
  }, [song, isSaving, contentRevision]);

  const handleSetAutosaveInterval = useCallback((intervalMs: number) => {
    setAutosaveIntervalState(intervalMs);
    setStoredAutosaveInterval(intervalMs);
  }, []);

  // Periodic autosave timer (when interval > 0)
  useEffect(() => {
    if (autosaveInterval <= 0) return;

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (isDirty && !isSaving) {
        void handleSaveSong();
      }
    }, autosaveInterval);

    return () => clearInterval(timer);
  }, [autosaveInterval, isDirty, isSaving, handleSaveSong]);

  const handleResetPreset = useCallback(async (presetId: string) => {
    try {
      const pristine = await resetPresetToFactory(presetId);
      const modifiedIds = await getModifiedPresetIds();
      setModifiedPresetIds(modifiedIds);

      if (pristine && song.id === presetId) {
        loadNewSong(pristine);
        setSavedRevision(0);
        await saveActiveSongToDB(pristine);
      }
    } catch (err) {
      console.error('[page] Failed to reset preset to factory:', err);
    }
  }, [song.id, loadNewSong]);

  const handleConfirmFreshSong = useCallback(async (saveCurrentFirst: boolean) => {
    if (saveCurrentFirst || isDirty) {
      try {
        await saveActiveSongToDB(song);
      } catch {
        saveSongToCustomLibrary(song);
      }
    }
    if (audioEngine) {
      audioEngine.stop();
    }
    const freshSong = createFreshSong();
    try {
      await saveSongToDB(freshSong);
      await saveActiveSongToDB(freshSong);
      const customList = await getCustomSongsFromDB();
      setCustomSongs(customList);
    } catch (err) {
      console.warn('[page] Failed to save fresh song to IndexedDB:', err);
    }

    loadNewSong(freshSong);
    setSavedRevision(0);
    setKaraokeReturnTarget(null);
    if (activeTab === 'karaoke') {
      setActiveTab('editor');
    }
    setTargetMeasureIndex(0);
    setIsNewSongConfirmOpen(false);
  }, [song, isDirty, activeTab, setActiveTab, loadNewSong]);

  // Flush song state to storage immediately when switching tabs or apps (especially critical on iPad)
  useEffect(() => {
    const flushSongToStorage = () => {
      if (song) {
        setStoredCurrentSong(song);
        if (isDirty) {
          void saveActiveSongToDB(song);
        }
      }
    };

    window.addEventListener('pagehide', flushSongToStorage);
    window.addEventListener('beforeunload', flushSongToStorage);
    const handleVisibility = () => {
      if (document.hidden && isDirty && song) {
        void saveActiveSongToDB(song);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pagehide', flushSongToStorage);
      window.removeEventListener('beforeunload', flushSongToStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [song, isDirty]);

  // Listen to cross-tab storage changes (e.g. if user edited or imported in another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if ((e.key === STORAGE_KEYS.CURRENT_SONG || e.key === 'numbered_notation_current_song_v2') && e.newValue) {
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
        loadNewSong(resultSong, { unsaved: true });
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
    setKaraokeReturnTarget({
      measureIndex,
      originalMeasureIndex: measureIndex,
    });
    if (activeTab === 'karaoke') {
      setActiveTab('editor');
    }
    setTargetMeasureIndex(measureIndex);
  }, [activeTab, setActiveTab]);

  const handleEditSection = useCallback((section: KaraokeSection) => {
    if (audioEngine) {
      audioEngine.stop();
    }
    setKaraokeReturnTarget({
      measureIndex: section.startMeasureIndex,
      originalMeasureIndex: section.startMeasureIndex,
    });
    if (activeTab === 'karaoke') {
      setActiveTab('editor');
    }
    setTargetMeasureIndex(section.startMeasureIndex);
  }, [activeTab, setActiveTab]);

  const handleReturnToKaraoke = useCallback((destMeasureIndex?: number) => {
    if (audioEngine) {
      audioEngine.stop();
    }
    const dest =
      destMeasureIndex !== undefined && destMeasureIndex !== null
        ? destMeasureIndex
        : (karaokeReturnTarget?.originalMeasureIndex ?? 0);
    setActiveTab('karaoke');
    setTargetKaraokeMeasureIndex(dest);
  }, [karaokeReturnTarget, setActiveTab]);

  const handleTogglePlay = useCallback(() => {
    if (!audioEngine) return;
    if (isPlaying) {
      audioEngine.pause();
    } else if (audioEngine.getIsPaused()) {
      audioEngine.unlockOnUserGesture();
      void wakeLockManager.requestForPlayback(isEcoMode);
      audioEngine.resume();
    } else {
      audioEngine.unlockOnUserGesture();
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

  const handleSelectSong = useCallback(
    async (targetSong: Song) => {
      if (audioEngine) {
        audioEngine.stop();
      }
      // Safety flush: if current song is dirty, save it to IndexedDB first
      if (isDirty && song) {
        try {
          await saveActiveSongToDB(song);
        } catch (err) {
          console.warn('[page] Failed to flush current song before switching:', err);
        }
      }

      // If selecting a preset, check if user has an edited version in IndexedDB
      let songToLoad = targetSong;
      const isPreset = PRESET_SONGS.some(p => p.id === targetSong.id);
      if (isPreset) {
        try {
          const dbVersion = await getSongFromDB(targetSong.id);
          if (dbVersion) {
            songToLoad = dbVersion;
          }
        } catch (err) {
          console.warn('[page] Failed to check preset override:', err);
        }
      }

      loadNewSong(songToLoad);
      setSavedRevision(0);
      void saveActiveSongToDB(songToLoad);
    },
    [isDirty, song, loadNewSong]
  );

  // Handle jump request from Lyric Search palette
  const handleJumpFromSearch = useCallback(
    async (
      targetSong: Song,
      measureIndex: number,
      destination: 'karaoke' | 'editor' | 'current' = 'current',
      subMode?: 'verse' | 'measure'
    ) => {
      if (audioEngine) {
        audioEngine.stop();
      }

      // Switch song if different from current active song
      if (targetSong.id !== song.id) {
        await handleSelectSong(targetSong);
      }

      if (subMode && typeof window !== 'undefined') {
        setStoredNoteSubMode(subMode);
      }

      const targetTab =
        destination === 'current'
          ? (activeTab === 'split' ? 'editor' : activeTab)
          : destination;

      if (targetTab === 'karaoke') {
        setActiveTab('karaoke');
        setTargetKaraokeMeasureIndex(measureIndex);
      } else {
        setActiveTab('editor');
        setTargetMeasureIndex(measureIndex);
      }
    },
    [song.id, activeTab, handleSelectSong, setActiveTab]
  );

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

  // Global Keyboard shortcuts: Space for playback, Ctrl+Z / Cmd+Z for undo, Ctrl+Y / Cmd+Shift+Z for redo, Ctrl+S / Cmd+S for Save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        activeEl?.getAttribute('contenteditable') === 'true';

      // Check for Lyric Search palette (Ctrl+K or Cmd+K)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsLyricSearchOpen(prev => !prev);
        return;
      }

      if (isTyping) return;
      if (e.defaultPrevented) return;

      // Check for Lyric Search (Ctrl+F or Cmd+F) when not typing in an input
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        if (activeTab === 'karaoke') {
          e.preventDefault();
          setIsLyricSearchOpen(true);
          return;
        }
        // In editor/split mode, ComposerEditor's in-editor search handles Ctrl+F
      }

      // Check for Save (Ctrl+S or Cmd+S)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void handleSaveSong();
        return;
      }

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
  }, [undo, redo, handleTogglePlay, handleSaveSong, activeTab]);

  const handleOpenLibrary = useCallback(() => {
    setImportExportTab('presets');
    setIsImportExportOpen(true);
  }, []);

  const handleOpenMidiExport = useCallback(() => {
    setImportExportTab('export');
    setImportExportFormat('midi');
    setIsImportExportOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0c0e14] text-zinc-900 dark:text-zinc-100 flex flex-col antialiased selection:bg-amber-500/30">
      {/* Top DAW Master Transport Console */}
      <HeaderBar
        song={song}
        onSelectSong={handleSelectSong}
        onStartFreshSong={handleStartFreshSong}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLyricSearch={() => setIsLyricSearchOpen(true)}
        onOpenImportExport={handleOpenLibrary}
        onOpenMidiExport={handleOpenMidiExport}
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
        onSave={handleSaveSong}
        isSaving={isSaving}
        isDirty={isDirty}
        saveSuccess={saveSuccess}
        autosaveInterval={autosaveInterval}
        onSetAutosaveInterval={handleSetAutosaveInterval}
        customSongs={customSongs}
        modifiedPresetIds={modifiedPresetIds}
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
              onEnableEco={() => setEcoMode(true)}
              targetKaraokeMeasureIndex={targetKaraokeMeasureIndex}
              onTargetKaraokeMeasureHandled={() => setTargetKaraokeMeasureIndex(null)}
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
                onClick={() => {
                  const curMIdx = audioEngine?.getState?.()?.currentMeasureIndex ?? 0;
                  setKaraokeReturnTarget({ measureIndex: curMIdx, originalMeasureIndex: curMIdx });
                  setActiveTab('editor');
                  setTargetMeasureIndex(curMIdx);
                }}
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
              karaokeReturnTarget={karaokeReturnTarget}
              onReturnToKaraoke={handleReturnToKaraoke}
              onDismissKaraokeReturn={() => setKaraokeReturnTarget(null)}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              pastCount={pastCount}
              futureCount={futureCount}
            />
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
                onEnableEco={() => setEcoMode(true)}
                targetKaraokeMeasureIndex={targetKaraokeMeasureIndex}
                onTargetKaraokeMeasureHandled={() => setTargetKaraokeMeasureIndex(null)}
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
                karaokeReturnTarget={karaokeReturnTarget}
                onReturnToKaraoke={handleReturnToKaraoke}
                onDismissKaraokeReturn={() => setKaraokeReturnTarget(null)}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                pastCount={pastCount}
                futureCount={futureCount}
                suspendNoteHighlights={isPlaying}
              />
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <ImportExportModal
        key={`${isImportExportOpen ? 'open' : 'closed'}-${importExportTab}-${importExportFormat}`}
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        currentSong={song}
        onLoadSong={handleSelectSong}
        onOpenScanner={() => setIsScannerOpen(true)}
        onStartFreshSong={handleStartFreshSong}
        modifiedPresetIds={modifiedPresetIds}
        onResetPreset={handleResetPreset}
        initialTab={importExportTab}
        initialExportFormat={importExportFormat}
      />

      <LyricSearchModal
        key={isLyricSearchOpen ? 'open' : 'closed'}
        isOpen={isLyricSearchOpen}
        onClose={() => setIsLyricSearchOpen(false)}
        currentSong={song}
        customSongs={customSongs}
        initialScope={activeTab === 'karaoke' ? 'current' : 'all'}
        onJumpToMeasure={handleJumpFromSearch}
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
