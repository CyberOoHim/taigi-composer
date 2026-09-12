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
import { VerseModeView } from './VerseModeView';
import { MeasureModeView } from './MeasureModeView';

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
  return (
    <div id="note-mode-deck-container" className="flex flex-col gap-4">
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
