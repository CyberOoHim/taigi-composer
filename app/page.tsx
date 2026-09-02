'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LyricDisplayMode, Song } from '@/types/song';
import { PRESET_SONGS } from '@/lib/presets';
import { audioEngine } from '@/lib/audioEngine';
import { HeaderBar, ActiveTabMode } from '@/components/HeaderBar';
import { KaraokeView, KaraokeSection } from '@/components/KaraokeView';
import { ComposerEditor } from '@/components/ComposerEditor';
import { ImportExportModal } from '@/components/ImportExportModal';
import { QuickLyricAlignerModal } from '@/components/QuickLyricAlignerModal';
import { GeminiAuthModal } from '@/components/GeminiAuthModal';
import { useSongHistory } from '@/hooks/useSongHistory';
import { usePowerSaveMode } from '@/hooks/usePowerSaveMode';
import {
  Mic2,
  Music,
  Sparkles,
  Layers,
  ArrowRight,
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

  const [activeTab, setActiveTab] = useState<ActiveTabMode>('karaoke');
  const [displayMode, setDisplayMode] = useState<LyricDisplayMode>('all');
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isAlignerOpen, setIsAlignerOpen] = useState(false);
  const [isGeminiAuthOpen, setIsGeminiAuthOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetMeasureIndex, setTargetMeasureIndex] = useState<number | null>(null);

  const handleEditMeasure = useCallback((measureIndex: number) => {
    if (activeTab === 'karaoke') {
      setActiveTab('editor');
    }
    setTargetMeasureIndex(measureIndex);
  }, [activeTab]);

  const handleEditSection = useCallback((section: KaraokeSection) => {
    if (activeTab === 'karaoke') {
      setActiveTab('editor');
    }
    setTargetMeasureIndex(section.startMeasureIndex);
  }, [activeTab]);

  const handleTogglePlay = useCallback(() => {
    if (!audioEngine) return;
    if (isPlaying) {
      audioEngine.pause();
    } else if (audioEngine.getIsPaused()) {
      audioEngine.resume();
    } else {
      audioEngine.play(song, 0);
    }
  }, [isPlaying, song]);

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

      // Spacebar to toggle playback (if not typing in input/textarea/select)
      if (
        (e.code === 'Space' || e.key === ' ') &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleTogglePlay]);

  return (
    <div className="min-h-screen bg-zinc-100/70 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col antialiased">
      {/* Top Header */}
      <HeaderBar
        song={song}
        onSelectSong={handleSelectSong}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onOpenGeminiAuth={() => setIsGeminiAuthOpen(true)}
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

      {/* Main Body Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-8 flex flex-col gap-6">
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

            {/* Quick Switch to Editor CTA */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    想修改這首歌的旋律、音符或台語歌詞嗎？
                  </h4>
                  <p className="text-xs text-zinc-500">
                    切換至簡譜編寫模式，隨時調整簡譜 1-7 音符、調號、和弦與漢字/白話字/臺羅歌詞。支援完整的復原 (Undo) 與重做 (Redo)。
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('editor')}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs rounded-xl hover:opacity-90 transition-opacity cursor-pointer touch-manipulation min-h-[38px]"
              >
                <span>前往編寫器 (Open Editor)</span>
                <ArrowRight className="w-3.5 h-3.5" />
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
        )}

        {activeTab === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
            <div className="lg:col-span-6 flex flex-col gap-4">
              <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Mic2 className="w-4 h-4 text-amber-500" />
                <span>卡拉OK即時動態演奏 (Karaoke Player)</span>
              </h3>
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

            <div className="lg:col-span-6 flex flex-col gap-4">
              <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Music className="w-4 h-4 text-amber-500" />
                <span>簡譜即時編寫 (Score Composer)</span>
              </h3>
              <ComposerEditor
                song={song}
                onUpdateSong={setSong}
                audioEngine={audioEngine}
                displayMode={displayMode}
                setDisplayMode={setDisplayMode}
                onOpenAligner={() => setIsAlignerOpen(true)}
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

        {/* Feature Explanatory Footer Guide */}
        <div className="mt-4 p-5 bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs text-zinc-600 dark:text-zinc-400 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-xs">
          <div className="flex flex-col gap-1.5">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>多格式台語歌詞支援 (Hanji / POJ / PIJ)</span>
            </h4>
            <p className="leading-relaxed">
              支援漢字 (Hanji)、白話字 (Pe̍h-ōe-jī)、臺灣閩南語羅馬字拼音方案 (臺羅 / PIJ) 以及漢羅合用 (Han-lô)。每個音符精確對齊對應的音節與演唱註解。
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Mic2 className="w-4 h-4 text-amber-500" />
              <span>專業卡拉OK動態引擎 (Karaoke Engine)</span>
            </h4>
            <p className="leading-relaxed">
              內建 Web Audio API 多樂器音源（鋼琴、臺灣竹笛、古典吉他、80年代合成器、八音鐘），支援即時移調升降 Key (±12半音)、自訂速度 BPM、和弦伴奏與節拍器。
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>樂曲匯入、匯出與分享 (Import & Export)</span>
            </h4>
            <p className="leading-relaxed">
              支援標準 JSON 樂譜檔 (.taigi.json) 及人類可讀的純文字簡譜格式 (.txt) 一鍵複製或下載。隨附《望春風》、《雨夜花》、《愛拚才會贏》等經典範例。
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
      />

      <QuickLyricAlignerModal
        isOpen={isAlignerOpen}
        onClose={() => setIsAlignerOpen(false)}
        song={song}
        onApplyLyrics={setSong}
      />

      <GeminiAuthModal
        isOpen={isGeminiAuthOpen}
        onClose={() => setIsGeminiAuthOpen(false)}
      />
    </div>
  );
}
