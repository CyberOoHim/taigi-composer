'use client';

import React from 'react';
import {
  Song,
  VerseItem,
  NumberedNotationNote,
  KeySignature,
  LyricDisplayMode,
  NoteDuration,
  PitchNumber,
  VerseNoteRef,
  ArticulationType,
  BarlineType,
  NoteEditSubMode,
} from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import { scrollToCardElement } from '@/lib/utils';
import { VerseModeView } from './VerseModeView';
import { MeasureModeView } from './MeasureModeView';
import {
  AlignLeft,
  Layers,
  Sparkles,
  CornerUpLeft,
  Mic2,
  FileSpreadsheet,
  Keyboard,
} from 'lucide-react';

export interface NoteModeViewProps {
  song: Song;
  verses: VerseItem[];
  noteSubMode: NoteEditSubMode;
  onSetNoteSubMode: (mode: NoteEditSubMode) => void;

  selectedMeasureIndex: number | null;
  selectedNoteIndex: number | null;
  currentNote: NumberedNotationNote | null;
  keySignature: KeySignature;
  audioEngine: AudioEngine;

  playingVerseIdx: number | null;
  playingMeasureIdx: number | null;
  activePlaybackNoteId: string | null;
  displayMode: LyricDisplayMode;

  verseBatchTexts: { [vIdx: number]: string };
  onSetVerseBatchTexts: React.Dispatch<React.SetStateAction<{ [vIdx: number]: string }>>;
  measureBatchTexts: { [mIdx: number]: string };
  onSetMeasureBatchTexts: React.Dispatch<React.SetStateAction<{ [mIdx: number]: string }>>;

  onSelectNote: (mIdx: number, nIdx: number) => void;
  onTogglePlayVerse: (vIdx: number, verseNotes: VerseNoteRef[]) => void;
  onTogglePlayMeasure: (mIdx: number) => void;

  onAddNoteToVerseEnd: (verse: VerseItem) => void;
  onAddNoteToMeasure: (mIdx: number) => void;
  onDuplicateMeasure: (mIdx: number) => void;
  onDeleteMeasure: (mIdx: number) => void;
  onUpdateMeasureSection: (mIdx: number, section: string) => void;
  onUpdateMeasureChord: (mIdx: number, chord: string) => void;
  onAutoHarmonizeVerse?: (vIdx: number) => void;

  onDistributeVerseLyrics: (verse: VerseItem, vIdx: number) => void;
  onDistributeMeasureLyrics: (mIdx: number) => void;

  onInsertPunctuationToNote: (punct: string) => void;
  onUpdateLyric: (mIdx: number, nIdx: number, type: 'roman' | 'hanlo', val: string) => void;
  onUpdateAnnotation?: (mIdx: number, nIdx: number, val: string) => void;
  onGoToNextNote: (mIdx: number, nIdx: number, type: 'roman' | 'hanlo') => void;
  onGoToPrevNote: (mIdx: number, nIdx: number, type: 'roman' | 'hanlo') => void;

  onUpdateSelectedNote: (updater: (note: NumberedNotationNote) => NumberedNotationNote) => void;
  onSetPitch: (pitch: PitchNumber) => void;
  onSetOctave: (delta: number) => void;
  onSetAccidental: (acc: '' | '#' | 'b') => void;
  onSetDuration: (duration: NoteDuration) => void;
  onToggleDotted: () => void;
  onToggleTie: () => void;
  onToggleSlur?: () => void;
  onSetArticulation?: (art: ArticulationType) => void;
  onToggleTriplet?: () => void;
  onToggleDoubleDotted?: () => void;

  onInsertPunctuation: (punct: string) => void;
  onInsertAnnotation: (annot: string) => void;
  onSetAnnotation: (annot: string) => void;
  onInsertNoteAt: (mIdx: number, nIdx: number) => void;
  onInsertNoteBeforeAt?: (mIdx: number, nIdx: number) => void;
  onInsertBreakAt?: (mIdx: number, nIdx: number) => void;
  onDeleteNoteAt: (mIdx: number, nIdx: number) => void;
  onMoveNoteBackward?: () => void;
  onMoveNoteForward?: () => void;
  canMoveNoteBackward?: boolean;
  canMoveNoteForward?: boolean;

  onNavigateNextNote?: () => void;
  onNavigatePrevNote?: () => void;
  autoStepAdvance?: boolean;
  onToggleAutoStepAdvance?: () => void;
  onUndo?: () => boolean;
  onRedo?: () => boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  pastCount?: number;
  futureCount?: number;
  showNotice: (msg: string) => void;

  onSplitMeasureAtNote?: (mIdx: number, splitAtIndex: number) => void;
  onMergeWithNextMeasure?: (mIdx: number) => void;
  onShiftNoteToNextMeasure?: (mIdx: number) => void;
  onPullNoteFromNextMeasure?: (mIdx: number) => void;
  onPushNoteToNextMeasure?: (mIdx: number, nIdx?: number) => void;
  onAutoFillRest?: (mIdx: number) => void;
  onTrimExcessNotes?: (mIdx: number) => void;

  onDuplicateVerse?: (verse: VerseItem) => void;
  onMoveVerseOrder?: (fromVerseIdx: number, toVerseIdx: number) => void;
  onDeleteVerse?: (verse: VerseItem) => void;

  onMoveMeasureOrder?: (fromIdx: number, toIdx: number) => void;
  onToggleLineBreak?: (mIdx: number) => void;
  onUpdateBarlineType?: (mIdx: number, barlineType: BarlineType) => void;

  selectedMeasureIndices: Set<number>;
  onToggleSelectMeasure: (mIdx: number, multi?: boolean) => void;
  onSelectMeasure: (mIdx: number) => void;

  onQuickToggleMeasureDuration?: (mIdx?: number) => void;
  onScaleMeasureDuration?: (factor: 0.5 | 2.0, mIdx?: number) => void;
  onSetUniformMeasureDuration?: (duration: NoteDuration, mIdx?: number) => void;

  // Jump Return Targets
  karaokeReturnTarget?: { measureIndex: number; originalMeasureIndex: number } | null;
  onReturnToKaraoke?: (destMeasureIndex?: number) => void;
  sheetReturnTarget?: { measureIndex: number; originalMeasureIndex: number } | null;
  onReturnToSheet?: (destMeasureIndex?: number) => void;
  onDismissKaraokeReturn?: () => void;
  onDismissSheetReturn?: () => void;
  onOpenKeyboardToScore?: () => void;
}

export const NoteModeView: React.FC<NoteModeViewProps> = React.memo(({
  song,
  verses,
  noteSubMode,
  onSetNoteSubMode,
  selectedMeasureIndex,
  selectedNoteIndex,
  currentNote,
  keySignature,
  audioEngine,
  playingVerseIdx,
  playingMeasureIdx,
  activePlaybackNoteId,
  displayMode,
  verseBatchTexts,
  onSetVerseBatchTexts,
  measureBatchTexts,
  onSetMeasureBatchTexts,
  onSelectNote,
  onTogglePlayVerse,
  onTogglePlayMeasure,
  onAddNoteToVerseEnd,
  onAddNoteToMeasure,
  onDuplicateMeasure,
  onDeleteMeasure,
  onUpdateMeasureSection,
  onUpdateMeasureChord,
  onAutoHarmonizeVerse,
  onDistributeVerseLyrics,
  onDistributeMeasureLyrics,
  onInsertPunctuationToNote,
  onUpdateLyric,
  onUpdateAnnotation,
  onGoToNextNote,
  onGoToPrevNote,
  onUpdateSelectedNote,
  onSetPitch,
  onSetOctave,
  onSetAccidental,
  onSetDuration,
  onToggleDotted,
  onToggleTie,
  onToggleSlur,
  onSetArticulation,
  onToggleTriplet,
  onToggleDoubleDotted,
  onInsertPunctuation,
  onInsertAnnotation,
  onSetAnnotation,
  onInsertNoteAt,
  onInsertNoteBeforeAt,
  onInsertBreakAt,
  onDeleteNoteAt,
  onMoveNoteBackward,
  onMoveNoteForward,
  canMoveNoteBackward,
  canMoveNoteForward,
  onNavigateNextNote,
  onNavigatePrevNote,
  autoStepAdvance,
  onToggleAutoStepAdvance,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  pastCount = 0,
  futureCount = 0,
  showNotice,
  onSplitMeasureAtNote,
  onMergeWithNextMeasure,
  onShiftNoteToNextMeasure,
  onPullNoteFromNextMeasure,
  onPushNoteToNextMeasure,
  onAutoFillRest,
  onTrimExcessNotes,
  onDuplicateVerse,
  onMoveVerseOrder,
  onDeleteVerse,
  onMoveMeasureOrder,
  onToggleLineBreak,
  onUpdateBarlineType,
  selectedMeasureIndices,
  onToggleSelectMeasure,
  onSelectMeasure,
  onQuickToggleMeasureDuration,
  onScaleMeasureDuration,
  onSetUniformMeasureDuration,
  karaokeReturnTarget,
  onReturnToKaraoke,
  sheetReturnTarget,
  onReturnToSheet,
  onDismissKaraokeReturn,
  onDismissSheetReturn,
  onOpenKeyboardToScore,
}) => {
  const handleSwitchSubMode = (targetSubMode: NoteEditSubMode) => {
    if (targetSubMode === noteSubMode) return;
    onSetNoteSubMode(targetSubMode);

    // Maintain visual focus by scrolling to matching card
    setTimeout(() => {
      if (targetSubMode === 'verse') {
        const mIdx = selectedMeasureIndex ?? 0;
        const matchingVerseIdx = verses.findIndex(v =>
          v.notes.some(n => n.measureIndex === mIdx)
        );
        const targetVIdx = matchingVerseIdx >= 0 ? matchingVerseIdx : 0;
        scrollToCardElement(`verse-card-${targetVIdx}`, { align: 'top', headerOffset: 0 });
      } else {
        const targetMIdx = selectedMeasureIndex ?? 0;
        scrollToCardElement(`measure-card-${targetMIdx}`, { align: 'top', headerOffset: 0 });
      }
    }, 50);
  };

  return (
    <div id="note-mode-deck-container" className="flex flex-col gap-4">
      {/* NOTE MODE INTERNAL SUB-VIEW TOGGLE (Verse Edit vs Measure Edit) */}
      <div
        id="note-mode-sub-toggle-bar"
        className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-100/90 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Note View Perspective:</span>
          </span>

          <div
            id="note-mode-perspective-switch-group"
            className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-700"
          >
            <button
              id="note-submode-verse-btn"
              type="button"
              onClick={() => handleSwitchSubMode('verse')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[36px] ${
                noteSubMode === 'verse'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Verse Edit: Phrase-level lyric and breath flow view"
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>Verse Edit (樂句)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200/80 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono font-bold ml-0.5">
                {verses.length}
              </span>
            </button>

            <button
              id="note-submode-measure-btn"
              type="button"
              onClick={() => handleSwitchSubMode('measure')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[36px] ${
                noteSubMode === 'measure'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Measure Edit: Barline and chord-structured view"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Measure Edit (小節)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200/80 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono font-bold ml-0.5">
                {song.measures.length}
              </span>
            </button>
          </div>
        </div>

        {/* Right side: Quick Jump Return & Submode explanation */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick jump return back to Karaoke mode */}
          {karaokeReturnTarget && onReturnToKaraoke && (
            <button
              id="note-bar-back-to-karaoke-btn"
              type="button"
              onClick={() => onReturnToKaraoke(karaokeReturnTarget.originalMeasureIndex)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title={`Jump back to Karaoke mode at Measure #${karaokeReturnTarget.originalMeasureIndex + 1}`}
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
              <Mic2 className="w-3.5 h-3.5" />
              <span>Back to Karaoke (#{karaokeReturnTarget.originalMeasureIndex + 1})</span>
            </button>
          )}

          {/* Quick jump return back to Sheet mode */}
          {sheetReturnTarget && onReturnToSheet && (
            <button
              id="note-bar-back-to-sheet-btn"
              type="button"
              onClick={() => onReturnToSheet(sheetReturnTarget.originalMeasureIndex)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-bold rounded-xl text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title={`Jump back to Sheet mode at Measure #${sheetReturnTarget.originalMeasureIndex + 1}`}
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Back to Sheet (#{sheetReturnTarget.originalMeasureIndex + 1})</span>
            </button>
          )}

          {/* Quick open Keyboard-to-Score Studio */}
          {onOpenKeyboardToScore && (
            <button
              id="note-mode-open-keyboard-btn"
              type="button"
              onClick={onOpenKeyboardToScore}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black rounded-xl text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title="開啟鍵盤彈奏轉譜工作站 (Keyboard-to-Score Studio)"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>彈奏轉譜</span>
            </button>
          )}

          {noteSubMode === 'verse' ? (
            <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/60 font-medium text-xs">
              <span className="font-bold text-amber-600 dark:text-amber-400">Verse Edit:</span>
              Auto-grouped by punctuation &amp; phrasing · {verses.length} verses total
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-zinc-200/70 dark:bg-zinc-700/60 text-zinc-800 dark:text-zinc-200 px-3 py-1.5 rounded-xl font-medium text-xs">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">Measure Edit:</span>
              Arranged by score barlines · {song.measures.length} measures total
            </span>
          )}
        </div>
      </div>

      {/* RENDER ACTIVE PERSPECTIVE SUB-VIEW */}
      {noteSubMode === 'verse' ? (
        <VerseModeView
          song={song}
          verses={verses}
          selectedMeasureIndex={selectedMeasureIndex}
          selectedNoteIndex={selectedNoteIndex}
          currentNote={currentNote}
          keySignature={keySignature}
          audioEngine={audioEngine}
          playingVerseIdx={playingVerseIdx}
          playingMeasureIdx={playingMeasureIdx}
          activePlaybackNoteId={activePlaybackNoteId}
          displayMode={displayMode}
          verseBatchTexts={verseBatchTexts}
          onSetVerseBatchTexts={onSetVerseBatchTexts}
          onSelectNote={onSelectNote}
          onTogglePlayVerse={onTogglePlayVerse}
          onTogglePlayMeasure={onTogglePlayMeasure}
          onAddNoteToVerseEnd={onAddNoteToVerseEnd}
          onDistributeVerseLyrics={onDistributeVerseLyrics}
          onInsertPunctuationToNote={onInsertPunctuationToNote}
          onUpdateLyric={onUpdateLyric}
          onUpdateAnnotation={onUpdateAnnotation}
          onUpdateMeasureChord={onUpdateMeasureChord}
          onAutoHarmonizeVerse={onAutoHarmonizeVerse}
          onGoToNextNote={onGoToNextNote}
          onGoToPrevNote={onGoToPrevNote}
          onUpdateSelectedNote={onUpdateSelectedNote}
          onSetPitch={onSetPitch}
          onSetOctave={onSetOctave}
          onSetAccidental={onSetAccidental}
          onSetDuration={onSetDuration}
          onToggleDotted={onToggleDotted}
          onToggleTie={onToggleTie}
          onToggleSlur={onToggleSlur}
          onSetArticulation={onSetArticulation}
          onToggleTriplet={onToggleTriplet}
          onToggleDoubleDotted={onToggleDoubleDotted}
          onInsertPunctuation={onInsertPunctuation}
          onInsertAnnotation={onInsertAnnotation}
          onSetAnnotation={onSetAnnotation}
          onInsertNoteAt={onInsertNoteAt}
          onInsertNoteBeforeAt={onInsertNoteBeforeAt}
          onInsertBreakAt={onInsertBreakAt}
          onDeleteNoteAt={onDeleteNoteAt}
          onMoveNoteBackward={onMoveNoteBackward}
          onMoveNoteForward={onMoveNoteForward}
          canMoveNoteBackward={canMoveNoteBackward}
          canMoveNoteForward={canMoveNoteForward}
          onNavigateNextNote={onNavigateNextNote}
          onNavigatePrevNote={onNavigatePrevNote}
          autoStepAdvance={autoStepAdvance}
          onToggleAutoStepAdvance={onToggleAutoStepAdvance}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          pastCount={pastCount}
          futureCount={futureCount}
          showNotice={showNotice}
          onSplitMeasureAtNote={onSplitMeasureAtNote}
          onMergeWithNextMeasure={onMergeWithNextMeasure}
          onShiftNoteToNextMeasure={onShiftNoteToNextMeasure}
          onPullNoteFromNextMeasure={onPullNoteFromNextMeasure}
          onPushNoteToNextMeasure={onPushNoteToNextMeasure}
          onAutoFillRest={onAutoFillRest}
          onTrimExcessNotes={onTrimExcessNotes}
          onDuplicateVerse={onDuplicateVerse}
          onMoveVerseOrder={onMoveVerseOrder}
          onDeleteVerse={onDeleteVerse}
          onDeleteMeasure={onDeleteMeasure}
          onQuickToggleMeasureDuration={onQuickToggleMeasureDuration}
          onScaleMeasureDuration={onScaleMeasureDuration}
          onSetUniformMeasureDuration={onSetUniformMeasureDuration}
          karaokeReturnTarget={karaokeReturnTarget}
          onReturnToKaraoke={onReturnToKaraoke}
          sheetReturnTarget={sheetReturnTarget}
          onReturnToSheet={onReturnToSheet}
          onDismissKaraokeReturn={onDismissKaraokeReturn}
          onDismissSheetReturn={onDismissSheetReturn}
          onOpenKeyboardToScore={onOpenKeyboardToScore}
        />
      ) : (
        <MeasureModeView
          song={song}
          selectedMeasureIndex={selectedMeasureIndex}
          selectedNoteIndex={selectedNoteIndex}
          currentNote={currentNote}
          keySignature={keySignature}
          audioEngine={audioEngine}
          playingMeasureIdx={playingMeasureIdx}
          activePlaybackNoteId={activePlaybackNoteId}
          displayMode={displayMode}
          measureBatchTexts={measureBatchTexts}
          onSetMeasureBatchTexts={onSetMeasureBatchTexts}
          onSelectNote={onSelectNote}
          onTogglePlayMeasure={onTogglePlayMeasure}
          onAddNoteToMeasure={onAddNoteToMeasure}
          onDuplicateMeasure={onDuplicateMeasure}
          onDeleteMeasure={onDeleteMeasure}
          onUpdateMeasureSection={onUpdateMeasureSection}
          onUpdateMeasureChord={onUpdateMeasureChord}
          onDistributeMeasureLyrics={onDistributeMeasureLyrics}
          onUpdateLyric={onUpdateLyric}
          onUpdateAnnotation={onUpdateAnnotation}
          onGoToNextNote={onGoToNextNote}
          onGoToPrevNote={onGoToPrevNote}
          onUpdateSelectedNote={onUpdateSelectedNote}
          onSetPitch={onSetPitch}
          onSetOctave={onSetOctave}
          onSetAccidental={onSetAccidental}
          onSetDuration={onSetDuration}
          onToggleDotted={onToggleDotted}
          onToggleTie={onToggleTie}
          onToggleSlur={onToggleSlur}
          onSetArticulation={onSetArticulation}
          onToggleTriplet={onToggleTriplet}
          onToggleDoubleDotted={onToggleDoubleDotted}
          onInsertPunctuation={onInsertPunctuation}
          onInsertAnnotation={onInsertAnnotation}
          onSetAnnotation={onSetAnnotation}
          onInsertNoteAt={onInsertNoteAt}
          onInsertNoteBeforeAt={onInsertNoteBeforeAt}
          onInsertBreakAt={onInsertBreakAt}
          onDeleteNoteAt={onDeleteNoteAt}
          onMoveNoteBackward={onMoveNoteBackward}
          onMoveNoteForward={onMoveNoteForward}
          canMoveNoteBackward={canMoveNoteBackward}
          canMoveNoteForward={canMoveNoteForward}
          onNavigateNextNote={onNavigateNextNote}
          onNavigatePrevNote={onNavigatePrevNote}
          autoStepAdvance={autoStepAdvance}
          onToggleAutoStepAdvance={onToggleAutoStepAdvance}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          pastCount={pastCount}
          futureCount={futureCount}
          showNotice={showNotice}
          onSplitMeasureAtNote={onSplitMeasureAtNote}
          onMergeWithNextMeasure={onMergeWithNextMeasure}
          onShiftNoteToNextMeasure={onShiftNoteToNextMeasure}
          onPullNoteFromNextMeasure={onPullNoteFromNextMeasure}
          onPushNoteToNextMeasure={onPushNoteToNextMeasure}
          onMoveMeasureOrder={onMoveMeasureOrder}
          onToggleLineBreak={onToggleLineBreak}
          onUpdateBarlineType={onUpdateBarlineType}
          onAutoFillRest={onAutoFillRest}
          onTrimExcessNotes={onTrimExcessNotes}
          selectedMeasureIndices={selectedMeasureIndices}
          onToggleSelectMeasure={onToggleSelectMeasure}
          onSelectMeasure={onSelectMeasure}
          onQuickToggleMeasureDuration={onQuickToggleMeasureDuration}
          onScaleMeasureDuration={onScaleMeasureDuration}
          onSetUniformMeasureDuration={onSetUniformMeasureDuration}
          karaokeReturnTarget={karaokeReturnTarget}
          onReturnToKaraoke={onReturnToKaraoke}
          sheetReturnTarget={sheetReturnTarget}
          onReturnToSheet={onReturnToSheet}
          onDismissKaraokeReturn={onDismissKaraokeReturn}
          onDismissSheetReturn={onDismissSheetReturn}
          onOpenKeyboardToScore={onOpenKeyboardToScore}
        />
      )}
    </div>
  );
});

NoteModeView.displayName = 'NoteModeView';
