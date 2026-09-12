'use client';

import React, { useState, useEffect, useRef } from 'react';
import { NumberedNotationNote, KeySignature, LyricDisplayMode, NoteDuration, PitchNumber, VerseItem, VerseNoteRef, ArticulationType, Song } from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import { isNonNotationItem, isPunctuationOrSpacer, getMeasureRhythmReport } from '@/lib/taigiUtils';
import { scrollToCardElement, scrollToScoreTop } from '@/lib/utils';
import { NoteCell } from './NoteCell';
import { NoteEditorHud } from './NoteEditorHud';
import { ChordPlaybackControl } from '@/components/ChordPlaybackControl';
import {
  Play,
  Square,
  Plus,
  MessageSquareQuote,
  ChevronLeft,
  ChevronRight,
  Copy,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Scissors,
  Merge,
  Sliders,
  ArrowRight,
  CornerUpLeft,
  Mic2,
  FileSpreadsheet,
  X,
  Wand2,
} from 'lucide-react';

interface VerseModeViewProps {
  song: Song;
  verses: VerseItem[];
  selectedMeasureIndex: number | null;
  selectedNoteIndex: number | null;
  currentNote: NumberedNotationNote | null;
  keySignature: KeySignature;
  audioEngine: AudioEngine;
  playingVerseIdx: number | null;
  playingMeasureIdx?: number | null;
  activePlaybackNoteId: string | null;
  displayMode: LyricDisplayMode;
  verseBatchTexts: { [vIdx: number]: string };
  onSetVerseBatchTexts: React.Dispatch<React.SetStateAction<{ [vIdx: number]: string }>>;
  onSelectNote: (mIdx: number, nIdx: number) => void;
  onTogglePlayVerse: (vIdx: number, verseNotes: VerseNoteRef[]) => void;
  onTogglePlayMeasure?: (mIdx: number) => void;
  onAddNoteToVerseEnd: (verse: VerseItem) => void;
  onDistributeVerseLyrics: (verse: VerseItem, vIdx: number) => void;
  onInsertPunctuationToNote: (punct: string) => void;
  onUpdateLyric: (mIdx: number, nIdx: number, type: 'roman' | 'hanlo', val: string) => void;
  onUpdateAnnotation?: (mIdx: number, nIdx: number, val: string) => void;
  onGoToNextNote: (mIdx: number, nIdx: number, type: 'roman' | 'hanlo') => void;
  onGoToPrevNote: (mIdx: number, nIdx: number, type: 'roman' | 'hanlo') => void;
  onUpdateMeasureChord?: (mIdx: number, chord: string) => void;
  onAutoHarmonizeVerse?: (vIdx: number) => void;
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

  // Measure editing in Verse Mode
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
  onDeleteMeasure?: (mIdx: number) => void;

  // Duration actions for selected measure
  onQuickToggleMeasureDuration?: (mIdx?: number) => void;
  onScaleMeasureDuration?: (factor: 0.5 | 2.0, mIdx?: number) => void;
  onSetUniformMeasureDuration?: (duration: NoteDuration, mIdx?: number) => void;

  // Jump Return Navigation (Karaoke & Sheet Mode)
  karaokeReturnTarget?: { measureIndex: number; originalMeasureIndex: number } | null;
  onReturnToKaraoke?: (destMeasureIndex?: number) => void;
  sheetReturnTarget?: { measureIndex: number; originalMeasureIndex: number } | null;
  onReturnToSheet?: (destMeasureIndex?: number) => void;
  onDismissKaraokeReturn?: () => void;
  onDismissSheetReturn?: () => void;
  onOpenKeyboardToScore?: () => void;
}

export const VerseModeView: React.FC<VerseModeViewProps> = React.memo(({
  song,
  verses,
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
  onSelectNote,
  onTogglePlayVerse,
  onTogglePlayMeasure,
  onAddNoteToVerseEnd,
  onDistributeVerseLyrics,
  onInsertPunctuationToNote,
  onUpdateLyric,
  onUpdateAnnotation,
  onGoToNextNote,
  onGoToPrevNote,
  onUpdateMeasureChord,
  onAutoHarmonizeVerse,
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
  onDeleteMeasure,
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
  const [hoveredSplitKey, setHoveredSplitKey] = useState<string | null>(null);

  // Ensure active verse card is positioned starting from the top on initial mount or when active verse changes
  const prevVerseIdxRef = useRef<number | null>(null);
  useEffect(() => {
    const targetMIdx = selectedMeasureIndex ?? 0;
    let targetVIdx = verses.findIndex(v =>
      v.notes.some(n => n.measureIndex === targetMIdx && n.noteIndex === (selectedNoteIndex ?? 0))
    );
    if (targetVIdx === -1) {
      targetVIdx = verses.findIndex(v => v.notes.some(n => n.measureIndex === targetMIdx));
    }
    if (targetVIdx !== -1 && prevVerseIdxRef.current !== targetVIdx) {
      prevVerseIdxRef.current = targetVIdx;
      scrollToCardElement(`verse-card-${targetVIdx}`, { align: 'top', headerOffset: 0 });
    }
  }, [selectedMeasureIndex, selectedNoteIndex, verses]);

  return (
    <div id="verse-mode-container" className="flex flex-col gap-6 pb-[75vh]">
      {/* CONSOLIDATED JUMP RETURN NAVIGATION DOCK (Karaoke Mode / Sheet Mode) */}
      {(karaokeReturnTarget || sheetReturnTarget) && (
        <div
          id="verse-editor-return-banner"
          className={`sticky top-2 z-30 flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-2xl border shadow-md backdrop-blur-md transition-all ${
            karaokeReturnTarget
              ? 'bg-amber-500/15 dark:bg-amber-950/85 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100 ring-1 ring-amber-400/30'
              : 'bg-emerald-500/15 dark:bg-emerald-950/85 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-400/30'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`p-1.5 rounded-xl text-xs font-bold shrink-0 shadow-2xs ${
                karaokeReturnTarget ? 'bg-amber-500 text-zinc-950' : 'bg-emerald-600 text-white'
              }`}
            >
              {karaokeReturnTarget ? <Mic2 className="w-3.5 h-3.5" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            </span>
            <div className="flex items-center gap-1.5 text-xs truncate">
              <span className="font-black truncate">
                {karaokeReturnTarget ? 'Karaoke Return Point' : 'Sheet Return Point'}
              </span>
              <span className="text-[11px] font-mono opacity-80 shrink-0">
                (Origin: M.#{karaokeReturnTarget ? karaokeReturnTarget.originalMeasureIndex + 1 : sheetReturnTarget ? sheetReturnTarget.originalMeasureIndex + 1 : 1})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {karaokeReturnTarget && onReturnToKaraoke && (
              <button
                id="verse-btn-return-to-karaoke-origin"
                type="button"
                onClick={() => onReturnToKaraoke(karaokeReturnTarget.originalMeasureIndex)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[34px]"
                title={`Jump back to Karaoke mode at Measure #${karaokeReturnTarget.originalMeasureIndex + 1}`}
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
                <Mic2 className="w-3 h-3" />
                <span>Return to Karaoke</span>
              </button>
            )}

            {sheetReturnTarget && onReturnToSheet && (
              <button
                id="verse-btn-return-to-sheet-origin"
                type="button"
                onClick={() => onReturnToSheet(sheetReturnTarget.originalMeasureIndex)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[34px]"
                title={`Jump back to Sheet mode at Measure #${sheetReturnTarget.originalMeasureIndex + 1}`}
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
                <FileSpreadsheet className="w-3 h-3" />
                <span>Return to Sheet</span>
              </button>
            )}

            {/* Quick Switch to other mode */}
            {karaokeReturnTarget && onReturnToSheet && (
              <button
                id="verse-btn-return-to-sheet-from-karaoke"
                type="button"
                onClick={() => onReturnToSheet(selectedMeasureIndex ?? karaokeReturnTarget.originalMeasureIndex)}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 font-bold text-xs rounded-xl transition-all cursor-pointer min-h-[34px]"
                title="View in Sheet Mode"
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>Sheet</span>
              </button>
            )}

            {sheetReturnTarget && onReturnToKaraoke && (
              <button
                id="verse-btn-return-to-karaoke-from-sheet"
                type="button"
                onClick={() => onReturnToKaraoke(selectedMeasureIndex ?? sheetReturnTarget.originalMeasureIndex)}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 font-bold text-xs rounded-xl transition-all cursor-pointer min-h-[34px]"
                title="Switch to Karaoke Mode"
              >
                <Mic2 className="w-3 h-3 text-amber-500" />
                <span>Karaoke</span>
              </button>
            )}

            {/* Dismiss banner */}
            {(karaokeReturnTarget ? onDismissKaraokeReturn : onDismissSheetReturn) && (
              <button
                type="button"
                onClick={karaokeReturnTarget ? onDismissKaraokeReturn : onDismissSheetReturn}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Dismiss return notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
      {verses.map((verse, vIdx) => {
        const isPlayingThisVerse = playingVerseIdx === vIdx;
        const hasSelectedNoteInVerse = verse.notes.some(
          item =>
            item.measureIndex === selectedMeasureIndex &&
            item.noteIndex === selectedNoteIndex
        );

        // Distinct measures belonging to this verse
        const verseMeasureIndices = Array.from(
          new Set(verse.notes.map(item => item.measureIndex))
        ).sort((a, b) => a - b);

        // Current measure targeted for this verse (selected measure if within verse, otherwise first measure of verse)
        const currentMeasureIdxForVerse =
          selectedMeasureIndex !== null && verseMeasureIndices.includes(selectedMeasureIndex)
            ? selectedMeasureIndex
            : verseMeasureIndices.length > 0
            ? verseMeasureIndices[0]
            : null;

        return (
          <div
            key={`verse-card-${verse.id}-${vIdx}`}
            id={`verse-card-${vIdx}`}
            onClick={() => {
              const firstContentNote =
                verse.notes.find(
                  n =>
                    !isNonNotationItem(n.note) &&
                    ((typeof n.note.pitch === 'number' && n.note.pitch > 0) ||
                      Boolean(
                        (n.note.lyric.hanlo || n.note.lyric.hanji || n.note.lyric.custom) &&
                          !isPunctuationOrSpacer(n.note.lyric.hanlo || n.note.lyric.hanji || n.note.lyric.custom)
                      ))
                ) || verse.notes[0];
              if (firstContentNote) {
                onSelectNote(firstContentNote.measureIndex, firstContentNote.noteIndex);
              }
              if (!hasSelectedNoteInVerse) {
                prevVerseIdxRef.current = vIdx;
                scrollToCardElement(`verse-card-${vIdx}`, { align: 'top', headerOffset: 0 });
              }
            }}
            className={`flex flex-col p-4 sm:p-5 rounded-2xl border transition-all duration-200 shadow-xs cursor-pointer scroll-mt-0 relative ${
              isPlayingThisVerse
                ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-500/10 dark:bg-amber-950/30 shadow-md'
                : hasSelectedNoteInVerse
                ? 'border-amber-400/80 dark:border-amber-500/60 bg-amber-50/15 dark:bg-[#161922]'
                : 'border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-[#141720]'
            }`}
          >
            {/* Go To Top Button (Pinned to Top-Right Corner of Verse Card) */}
            <button
              id={`verse-go-to-top-btn-${vIdx}`}
              type="button"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                scrollToScoreTop();
              }}
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-10 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-100/95 hover:bg-amber-500 hover:text-zinc-950 dark:bg-[#0a0c10]/95 dark:hover:bg-amber-400 dark:hover:text-zinc-950 text-zinc-700 dark:text-zinc-300 border border-zinc-200/90 dark:border-zinc-700 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title={`回到頁首 (Jump to top of score editor from Verse #${vIdx + 1})`}
              aria-label={`Jump to top of score editor from Verse #${vIdx + 1}`}
            >
              <ArrowUpToLine className="w-3.5 h-3.5" />
              <span className="font-bold text-[11px]">Top</span>
            </button>

            {/* Verse Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-zinc-200/80 dark:border-zinc-800 text-xs pr-16 sm:pr-20">
              {/* Left: Dedicated Play Controls & Verse Info */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Unified Transport: Play Verse + Play Measure quick button */}
                <div className="flex items-center gap-1">
                  <button
                    id={`verse-play-btn-${vIdx}`}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onTogglePlayVerse(vIdx, verse.notes);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer touch-manipulation min-h-[36px] ${
                      isPlayingThisVerse
                        ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 animate-pulse font-black'
                        : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                    }`}
                    title={`Play Verse #${vIdx + 1}`}
                  >
                    {isPlayingThisVerse ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current text-zinc-950" />
                        <span>Stop Verse</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play Verse</span>
                      </>
                    )}
                  </button>

                  {/* Play Current Measure Only Button (Verse Mode) */}
                  {currentMeasureIdxForVerse !== null && onTogglePlayMeasure && (
                    <button
                      id={`verse-play-measure-btn-${vIdx}`}
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onTogglePlayMeasure(currentMeasureIdxForVerse);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer touch-manipulation min-h-[36px] ${
                        playingMeasureIdx === currentMeasureIdxForVerse
                          ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse font-black ring-2 ring-rose-400'
                          : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700'
                      }`}
                      title={
                        playingMeasureIdx === currentMeasureIdxForVerse
                          ? `Stop playing Measure #${currentMeasureIdxForVerse + 1}`
                          : `Play current Measure #${currentMeasureIdxForVerse + 1} only`
                      }
                    >
                      {playingMeasureIdx === currentMeasureIdxForVerse ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>Stop M#{currentMeasureIdxForVerse + 1}</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current text-amber-500" />
                          <span>M#{currentMeasureIdxForVerse + 1}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Chord Playback Control on active/playing Verse */}
                {(isPlayingThisVerse || hasSelectedNoteInVerse) && (
                  <ChordPlaybackControl variant="compact" previewKeyChord={song.key} idPrefix={`verse-chord-${vIdx}`} />
                )}

                {/* Previous / Next Verse Switcher */}
                <div className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] rounded-xl border border-zinc-200/90 dark:border-zinc-700 p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      if (vIdx > 0) {
                        const prevVerse = verses[vIdx - 1];
                        const target =
                          prevVerse.notes.find(
                            n =>
                              !isNonNotationItem(n.note) &&
                              ((typeof n.note.pitch === 'number' && n.note.pitch > 0) ||
                                Boolean(
                                  (n.note.lyric.hanlo || n.note.lyric.hanji || n.note.lyric.custom) &&
                                    !isPunctuationOrSpacer(n.note.lyric.hanlo || n.note.lyric.hanji || n.note.lyric.custom)
                                ))
                          ) || prevVerse.notes[0];
                        if (target) onSelectNote(target.measureIndex, target.noteIndex);
                        prevVerseIdxRef.current = vIdx - 1;
                        scrollToCardElement(`verse-card-${vIdx - 1}`, { align: 'top', headerOffset: 0 });
                      }
                    }}
                    disabled={vIdx === 0}
                    className="p-1.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center transition-all"
                    title="Previous Verse"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="daw-lcd px-2.5 py-1 text-xs font-mono font-bold rounded-lg mx-0.5">
                    Verse {vIdx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      if (vIdx < verses.length - 1) {
                        const nextVerse = verses[vIdx + 1];
                        const target =
                          nextVerse.notes.find(
                            n =>
                              !isNonNotationItem(n.note) &&
                              ((typeof n.note.pitch === 'number' && n.note.pitch > 0) ||
                                Boolean(
                                  (n.note.lyric.hanlo || n.note.lyric.hanji || n.note.lyric.custom) &&
                                    !isPunctuationOrSpacer(n.note.lyric.hanlo || n.note.lyric.hanji || n.note.lyric.custom)
                                ))
                          ) || nextVerse.notes[0];
                        if (target) onSelectNote(target.measureIndex, target.noteIndex);
                        prevVerseIdxRef.current = vIdx + 1;
                        scrollToCardElement(`verse-card-${vIdx + 1}`, { align: 'top', headerOffset: 0 });
                      }
                    }}
                    disabled={vIdx === verses.length - 1}
                    className="p-1.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center transition-all"
                    title="Next Verse"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Reorder Verse (Move Earlier / Move Later) */}
                {onMoveVerseOrder && (
                  <div
                    className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] p-0.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 shadow-2xs"
                    title="Reorder verse"
                  >
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onMoveVerseOrder(vIdx, vIdx - 1);
                      }}
                      disabled={vIdx === 0}
                      className="p-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Move verse backward (earlier)"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onMoveVerseOrder(vIdx, vIdx + 1);
                      }}
                      disabled={vIdx === verses.length - 1}
                      className="p-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Move verse forward (later)"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {verse.section && (
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                    {verse.section}
                  </span>
                )}

                <span className="text-zinc-600 dark:text-zinc-400 text-xs font-medium">
                  Measures #{verse.startMeasureNumber} - #{verse.endMeasureNumber} ({verse.notes.length} notes)
                </span>

                {verse.chords.length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-xs bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800/60">
                    Chords: {verse.chords.join(' → ')}
                  </span>
                )}
              </div>

              {/* Right: Quick Verse Actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  id={`verse-add-note-btn-${vIdx}`}
                  type="button"
                  onClick={() => onAddNoteToVerseEnd(verse)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl font-bold text-xs border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer touch-manipulation min-h-[40px]"
                  title="Add note to end of this verse"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Note</span>
                </button>

                {/* Auto Harmonize Verse */}
                {onAutoHarmonizeVerse && (
                  <button
                    id={`verse-auto-harmonize-btn-${vIdx}`}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onAutoHarmonizeVerse(vIdx);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500/20 to-amber-400/20 hover:from-amber-500/30 hover:to-amber-400/30 text-amber-900 dark:text-amber-200 rounded-xl font-bold text-xs border border-amber-300 dark:border-amber-700/80 transition-colors cursor-pointer touch-manipulation min-h-[40px]"
                    title="為此段歌詞所有小節智慧配置最佳和弦 (Auto-Harmonize Verse)"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>🪄 本段配和弦</span>
                  </button>
                )}

                {/* Duplicate Verse */}
                {onDuplicateVerse && (
                  <button
                    id={`verse-duplicate-btn-${vIdx}`}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onDuplicateVerse(verse);
                    }}
                    className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer touch-manipulation min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Duplicate this verse"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Delete Verse */}
                {onDeleteVerse && verses.length > 1 && (
                  <button
                    id={`verse-delete-btn-${vIdx}`}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onDeleteVerse(verse);
                    }}
                    className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer touch-manipulation min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Delete this verse"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Verse Measures Beats Progress Bar & Rhythm Diagnostics Strip */}
            {verseMeasureIndices.length > 0 && (
              <div className="flex flex-col gap-2 mb-3.5 p-3 rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-600 dark:text-zinc-300 px-0.5">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-500" />
                    <span>Verse Measure Rhythm ({verseMeasureIndices.length} {verseMeasureIndices.length === 1 ? 'Measure' : 'Measures'}):</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400 font-normal hidden sm:inline">
                      點擊進度條跳至該小節 (Click bar to jump)
                    </span>
                    <span className="text-[11px] font-medium text-zinc-500 font-mono">
                      Time: {song.timeSignature || '4/4'}
                    </span>
                  </div>
                </div>

                {/* 4 in a row beats progress bars grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {verseMeasureIndices.map(mIdx => {
                    const measure = song.measures[mIdx];
                    if (!measure) return null;
                    const rhythm = getMeasureRhythmReport(measure, song.timeSignature);
                    const isSelectedMeasure = selectedMeasureIndex === mIdx;

                    // Extract associated lyrics for this measure in this verse
                    const verseNotesInMeasure = verse.notes.filter(item => item.measureIndex === mIdx);
                    const notesForMeasure = verseNotesInMeasure.length > 0
                      ? verseNotesInMeasure.map(item => item.note)
                      : measure.notes;

                    const hanloParts: string[] = [];
                    const pojParts: string[] = [];

                    notesForMeasure.forEach(note => {
                      const h = (note.lyric?.hanlo || note.lyric?.custom || note.lyric?.hanji || '').trim();
                      const p = (note.lyric?.poj || note.lyric?.tl || '').trim();
                      if (h && h !== '\n' && h !== '↵') hanloParts.push(h);
                      if (p && p !== '\n' && p !== '↵') pojParts.push(p);
                    });

                    const hanloLyric = hanloParts.reduce((acc, curr) => {
                      if (!acc) return curr;
                      const lastChar = acc.slice(-1);
                      const firstChar = curr.slice(0, 1);
                      if (/[a-zA-Z0-9]/.test(lastChar) && /[a-zA-Z0-9]/.test(firstChar)) {
                        return `${acc} ${curr}`;
                      }
                      return `${acc}${curr}`;
                    }, '');

                    const pojLyric = pojParts.reduce((acc, curr) => {
                      if (!acc) return curr;
                      if (/^[,\.!?:;]/.test(curr)) {
                        return `${acc}${curr}`;
                      }
                      return `${acc} ${curr}`;
                    }, '');

                    const hasLyrics = Boolean(hanloLyric || pojLyric);

                    const handleJumpToMeasure = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      onSelectNote(mIdx, 0);
                      const targetEl = document.getElementById(`verse-measure-anchor-${vIdx}-${mIdx}`);
                      if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                      }
                    };

                    return (
                      <div
                        key={`verse-m-progress-${vIdx}-${mIdx}`}
                        onClick={handleJumpToMeasure}
                        className={`group flex flex-col p-2 sm:p-2.5 rounded-xl border text-xs transition-all cursor-pointer select-none active:scale-[0.99] ${
                          isSelectedMeasure
                            ? 'border-amber-500 bg-amber-500/10 dark:border-amber-400 dark:bg-amber-950/40 ring-1 ring-amber-500/40 shadow-xs'
                            : 'border-zinc-200/80 dark:border-zinc-700/60 bg-white dark:bg-zinc-900/60 hover:border-amber-400/80 dark:hover:border-amber-500/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/60 shadow-2xs'
                        }`}
                        title={`跳至第 ${mIdx + 1} 小節 (Click to jump to Measure #${mIdx + 1})\n節奏: ${rhythm.currentBeats}/${rhythm.expectedBeats} beats${hasLyrics ? `\n歌詞: ${hanloLyric ? hanloLyric : ''} ${pojLyric ? `(${pojLyric})` : ''}` : '\n(無歌詞)'}`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <div className="flex items-center gap-1 font-bold truncate">
                            <span className="font-mono text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] shrink-0 group-hover:bg-amber-500/20 transition-colors">
                              <span className="hidden xl:inline">Measure </span>#{mIdx + 1}
                            </span>
                            {measure.chord && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const firstChord = measure.chord?.split(/[\s,\-|]+/)[0];
                                  if (firstChord) audioEngine.previewChord(firstChord);
                                }}
                                className="text-amber-600 hover:text-amber-500 dark:text-amber-400 text-[10px] sm:text-[11px] font-mono shrink-0 cursor-pointer hover:underline"
                                title={`點擊試聽和弦 [${measure.chord}]`}
                              >
                                [{measure.chord}]
                              </button>
                            )}
                            {measure.section && (
                              <span className="text-[9px] sm:text-[10px] px-1 py-0.5 rounded-sm bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold truncate hidden 2xl:inline">
                                {measure.section}
                              </span>
                            )}
                          </div>

                          {/* Right: Rhythm health status pill & Delete Measure button */}
                          <div className="flex items-center gap-1 shrink-0">
                            <div
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-mono font-bold shrink-0 ${
                                rhythm.isFull
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
                                  : rhythm.isUnder
                                  ? 'bg-amber-50 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800'
                                  : 'bg-rose-50 text-rose-900 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800'
                              }`}
                            >
                              {rhythm.isFull ? (
                                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <AlertCircle className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${rhythm.isUnder ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`} />
                              )}
                              <span>{rhythm.currentBeats}/{rhythm.expectedBeats}<span className="hidden lg:inline"> beats</span></span>
                              {!rhythm.isFull && (
                                <span className="font-sans font-medium opacity-90 text-[9px]">
                                  {rhythm.isUnder ? `(-${rhythm.absDiff})` : `(+${rhythm.absDiff})`}
                                </span>
                              )}
                            </div>

                            {onDeleteMeasure && song.measures.length > 1 && (
                              <button
                                id={`verse-measure-delete-btn-${mIdx}`}
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  onDeleteMeasure(mIdx);
                                }}
                                className="p-1 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                title={`Delete Measure #${mIdx + 1}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Visual Beat Meter / Progress Bar (Clickable) */}
                        <div className="h-1.5 sm:h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden flex">
                          <div
                            className={`h-full transition-all duration-200 ${
                              rhythm.isFull
                                ? 'bg-emerald-500'
                                : rhythm.isUnder
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{
                              width: `${Math.min(100, (rhythm.currentBeats / rhythm.expectedBeats) * 100)}%`,
                            }}
                          />
                          {rhythm.isUnder && (
                            <div
                              className="h-full bg-amber-300/40 dark:bg-amber-600/30 repeating-linear-stripes"
                              style={{
                                width: `${Math.max(0, 100 - (rhythm.currentBeats / rhythm.expectedBeats) * 100)}%`,
                              }}
                            />
                          )}
                        </div>

                        {/* Associated Measure Lyric Under Progress Bar */}
                        <div
                          className={`mt-1.5 pt-1.5 border-t flex items-center min-w-0 transition-colors ${
                            isSelectedMeasure
                              ? 'border-amber-500/30 dark:border-amber-400/30'
                              : 'border-zinc-100 dark:border-zinc-800'
                          }`}
                        >
                          {hasLyrics ? (
                            <div className="flex items-center gap-1.5 min-w-0 w-full overflow-hidden">
                              <MessageSquareQuote
                                className={`w-3 h-3 shrink-0 ${
                                  isSelectedMeasure
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-zinc-400 dark:text-zinc-500'
                                }`}
                              />
                              {displayMode === 'roman' ? (
                                <span className="text-[11px] sm:text-xs font-serif italic font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                                  {pojLyric || hanloLyric}
                                </span>
                              ) : displayMode === 'hanlo' || displayMode === 'hanji_only' || displayMode === 'custom_only' ? (
                                <span className="text-[11px] sm:text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                                  {hanloLyric || pojLyric}
                                </span>
                              ) : displayMode === 'roman_major_hanlo' ? (
                                <div className="flex items-baseline gap-1 truncate min-w-0">
                                  <span className="text-[11px] sm:text-xs font-serif italic font-semibold text-emerald-700 dark:text-emerald-300 truncate shrink-0 max-w-[65%]">
                                    {pojLyric || hanloLyric}
                                  </span>
                                  {hanloLyric && pojLyric && (
                                    <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 truncate">
                                      ({hanloLyric})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-baseline gap-1.5 truncate min-w-0">
                                  <span className="text-[11px] sm:text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate shrink-0 max-w-[60%]">
                                    {hanloLyric || pojLyric}
                                  </span>
                                  {pojLyric && hanloLyric && (
                                    <span className="text-[10px] font-serif italic text-emerald-600 dark:text-emerald-400 truncate opacity-90">
                                      {pojLyric}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 min-w-0 text-zinc-400 dark:text-zinc-500">
                              <span className="text-[10px] italic select-none">(無歌詞)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WYSIWYG NUMBERED NOTATION SCORE ROW WITH MEASURE DIVIDERS & INTERACTIVE SPLITTERS */}
            <div
              className="flex items-center overflow-x-auto pb-3 pt-1 gap-1.5 sm:gap-2 select-none"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {verse.notes.map((item, itemIdx) => {
                const isSelected = selectedMeasureIndex === item.measureIndex && selectedNoteIndex === item.noteIndex;
                const isPlaybackActive = activePlaybackNoteId === item.note.id;
                const splitHoverKey = `${item.measureIndex}-${item.noteIndex}`;
                const measure = song.measures[item.measureIndex];
                const rhythm = measure ? getMeasureRhythmReport(measure, song.timeSignature) : null;
                const isFirstNoteInThisMeasure = item.isFirstInMeasure;
                const nextItem = verse.notes[itemIdx + 1];
                const isLastNoteInThisMeasure = !nextItem || nextItem.measureIndex !== item.measureIndex;

                return (
                  <React.Fragment key={`v-frag-${item.measureIndex}-${item.noteIndex}-${itemIdx}`}>
                    {/* Opening Barline of Measure */}
                    {isFirstNoteInThisMeasure && (
                      <button
                        id={`verse-measure-anchor-${vIdx}-${item.measureIndex}`}
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onSelectNote(item.measureIndex, item.noteIndex);
                        }}
                        className={`flex flex-col items-center justify-center px-2 py-1.5 font-mono text-[10px] select-none shrink-0 self-stretch rounded-xl border transition-all cursor-pointer touch-manipulation active:scale-95 ${
                          selectedMeasureIndex === item.measureIndex
                            ? 'bg-amber-500/15 border-amber-400 dark:border-amber-500 dark:bg-amber-950/60 ring-1 ring-amber-400/50'
                            : 'bg-zinc-100/70 hover:bg-amber-500/10 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 border-zinc-200/70 dark:border-zinc-700/60 hover:border-amber-400/60 text-zinc-400 dark:text-zinc-500'
                        }`}
                        title={`Measure #${item.measureNumber} start - Click to select note`}
                      >
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">#{item.measureNumber}</span>
                        <div className="w-[2px] flex-1 bg-zinc-300 dark:bg-zinc-600 my-1 rounded-full" />
                        {item.chord && (
                          <span className="font-bold text-amber-600 dark:text-amber-400 text-[10px] mb-0.5">
                            {item.chord}
                          </span>
                        )}
                        {rhythm && (
                          <span
                            className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded-sm ${
                              rhythm.isFull
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : rhythm.isUnder
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300'
                            }`}
                            title={`Beats: ${rhythm.currentBeats}/${rhythm.expectedBeats}`}
                          >
                            {rhythm.currentBeats}/{rhythm.expectedBeats}
                          </span>
                        )}
                      </button>
                    )}

                    {/* Interactive In-Between Note Splitter (Scissors) */}
                    {!isFirstNoteInThisMeasure && item.noteIndex > 0 && onSplitMeasureAtNote && (
                      <div
                        className="relative flex items-center justify-center group h-24 sm:h-28 px-0.5 cursor-pointer shrink-0"
                        onMouseEnter={() => setHoveredSplitKey(splitHoverKey)}
                        onMouseLeave={() => setHoveredSplitKey(null)}
                        onClick={e => {
                          e.stopPropagation();
                          onSplitMeasureAtNote(item.measureIndex, item.noteIndex);
                        }}
                        title={`Split Measure at note #${item.noteIndex + 1}`}
                      >
                        <div className="w-[1.5px] h-16 bg-zinc-200 dark:bg-zinc-700 group-hover:bg-amber-500 transition-colors rounded-full" />
                        <button
                          type="button"
                          className={`absolute z-10 p-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-full shadow-md transition-all active:scale-95 ${
                            hoveredSplitKey === splitHoverKey ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                          }`}
                          title="Insert barline before note (Split Measure)"
                        >
                          <Scissors className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <NoteCell
                      note={item.note}
                      prevNote={itemIdx > 0 ? verse.notes[itemIdx - 1]?.note : null}
                      mIdx={item.measureIndex}
                      nIdx={item.noteIndex}
                      isSelected={isSelected}
                      isPlaybackActive={isPlaybackActive}
                      displayMode={displayMode}
                      onSelectNote={onSelectNote}
                      onUpdateLyric={onUpdateLyric}
                      onUpdateAnnotation={onUpdateAnnotation}
                      onGoToNextNote={onGoToNextNote}
                      onGoToPrevNote={onGoToPrevNote}
                      keyPrefix={`v-${vIdx}-`}
                    />

                    {/* Closing Barline Station at end of this measure */}
                    {isLastNoteInThisMeasure && (
                      <div
                        id={`verse-measure-closing-barline-${item.measureIndex}`}
                        onClick={e => e.stopPropagation()}
                        className="flex flex-col items-center justify-between p-1.5 ml-1 self-stretch rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shrink-0 min-w-[52px] shadow-2xs"
                      >
                        {/* Barline Glyphs */}
                        <div className="flex items-center justify-center py-1 px-1.5" title={`End of Measure #${item.measureNumber}`}>
                          <div className="w-[2.5px] h-12 bg-zinc-800 dark:bg-zinc-200 rounded-full" />
                        </div>

                        {/* Note Transfer & Measure Boundary Buttons */}
                        <div className="flex flex-col gap-1 w-full pt-1 border-t border-zinc-200 dark:border-zinc-700 text-[10px]">
                          {/* Shift Note -> */}
                          {onShiftNoteToNextMeasure && measure && measure.notes.length > 1 && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onShiftNoteToNextMeasure(item.measureIndex);
                              }}
                              className="px-1 py-0.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded text-[10px] font-bold text-center cursor-pointer transition-colors whitespace-nowrap"
                              title="Shift last note to next measure"
                            >
                              Shift Note →
                            </button>
                          )}

                          {/* Push Note -> */}
                          {onPushNoteToNextMeasure && measure && measure.notes.length > 1 && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onPushNoteToNextMeasure(item.measureIndex, item.noteIndex);
                              }}
                              className="px-1 py-0.5 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/70 text-indigo-900 dark:text-indigo-200 rounded text-[10px] font-bold text-center cursor-pointer transition-colors whitespace-nowrap"
                              title="Push this note into the next measure"
                            >
                              Push Note →
                            </button>
                          )}

                          {/* <- Pull Note */}
                          {onPullNoteFromNextMeasure && item.measureIndex < song.measures.length - 1 && song.measures[item.measureIndex + 1]?.notes.length > 1 && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onPullNoteFromNextMeasure(item.measureIndex);
                              }}
                              className="px-1 py-0.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded text-[10px] font-bold text-center cursor-pointer transition-colors whitespace-nowrap"
                              title="Pull first note from next measure"
                            >
                              ← Pull Note
                            </button>
                          )}

                          {/* Merge with next measure */}
                          {onMergeWithNextMeasure && item.measureIndex < song.measures.length - 1 && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onMergeWithNextMeasure(item.measureIndex);
                              }}
                              className="px-1 py-0.5 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 rounded text-[10px] font-bold text-center cursor-pointer transition-colors flex items-center justify-center gap-0.5 whitespace-nowrap"
                              title="Merge with next measure"
                            >
                              <Merge className="w-2.5 h-2.5" />
                              <span>Merge</span>
                            </button>
                          )}

                          {/* Delete Measure */}
                          {onDeleteMeasure && song.measures.length > 1 && (
                            <button
                              id={`verse-closing-barline-delete-btn-${item.measureIndex}`}
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onDeleteMeasure(item.measureIndex);
                              }}
                              className="px-1 py-0.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/70 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-300 rounded text-[10px] font-bold text-center cursor-pointer transition-colors flex items-center justify-center gap-0.5 whitespace-nowrap"
                              title={`Delete Measure #${item.measureNumber}`}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              <span>Del Bar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* INTEGRATED IN-CARD NOTE EDITOR DECK */}
            {hasSelectedNoteInVerse && currentNote && selectedMeasureIndex !== null && (
              <div onClick={e => e.stopPropagation()} className="w-full">
                <NoteEditorHud
                  currentNote={currentNote}
                  selectedMeasureIndex={selectedMeasureIndex}
                  selectedNoteIndex={selectedNoteIndex}
                  keySignature={keySignature}
                  audioEngine={audioEngine}
                  currentMeasure={song.measures[selectedMeasureIndex]}
                  timeSignature={song.timeSignature}
                  onUpdateMeasureChord={onUpdateMeasureChord}
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
                  onSplitMeasureBeforeNote={(m, n) => {
                    if (onSplitMeasureAtNote) onSplitMeasureAtNote(m, n);
                  }}
                  onPushNoteToNextMeasure={onPushNoteToNextMeasure}
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
                  inCard={true}
                  onQuickToggleMeasureDuration={onQuickToggleMeasureDuration}
                  onScaleMeasureDuration={onScaleMeasureDuration}
                  onSetUniformMeasureDuration={onSetUniformMeasureDuration}
                  containerType="verse"
                  containerLabel={`Verse ${vIdx + 1}`}
                  onDuplicateContainer={() => onDuplicateVerse?.(verse)}
                  onDeleteMeasure={onDeleteMeasure && selectedMeasureIndex !== null ? () => onDeleteMeasure(selectedMeasureIndex) : undefined}
                  onMoveContainerBackward={vIdx > 0 ? () => onMoveVerseOrder?.(vIdx, vIdx - 1) : undefined}
                  onMoveContainerForward={vIdx < verses.length - 1 ? () => onMoveVerseOrder?.(vIdx, vIdx + 1) : undefined}
                  canMoveContainerBackward={vIdx > 0}
                  canMoveContainerForward={vIdx < verses.length - 1}
                  onTogglePlayMeasure={onTogglePlayMeasure}
                  isPlayingMeasure={playingMeasureIdx === selectedMeasureIndex}
                  onOpenKeyboardToScore={onOpenKeyboardToScore}
                />
              </div>
            )}

            {/* Verse-Wide Batch Lyric & Punctuation Helper Toolbar */}
            <div className="flex flex-col gap-2.5 pt-3 mt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs">
              {/* Row 1: Verse Batch Lyric Input */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 shrink-0 flex items-center gap-1.5 select-none">
                  <MessageSquareQuote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>段落歌詞填入 (羅馬字 / 漢羅):</span>
                </span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    id={`verse-batch-input-${vIdx}`}
                    type="text"
                    value={verseBatchTexts[vIdx] || ''}
                    onChange={e =>
                      onSetVerseBatchTexts(prev => ({
                        ...prev,
                        [vIdx]: e.target.value,
                      }))
                    }
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onDistributeVerseLyrics(verse, vIdx);
                      }
                    }}
                    placeholder="輸入歌詞並按「批次套用」，將自動逐字套入此段落音符..."
                    className="flex-1 min-w-0 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden min-h-[36px] text-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    id={`verse-batch-apply-btn-${vIdx}`}
                    type="button"
                    onClick={() => onDistributeVerseLyrics(verse, vIdx)}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 font-bold rounded-xl text-xs shadow-xs transition-colors shrink-0 min-h-[36px] cursor-pointer touch-manipulation whitespace-nowrap flex items-center justify-center"
                    title="批次套用歌詞至此段落音符"
                  >
                    批次套用
                  </button>
                </div>
              </div>

              {/* Row 2: Quick Punctuation Buttons Row */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mr-0.5 shrink-0 select-none">
                  常用標點:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['，', '。', '、', '！', '？', '—', '…', '「', '」', 'V'].map((punct, pIdx) => (
                    <button
                      key={`verse-${vIdx}-punct-${punct}-${pIdx}`}
                      id={`verse-${vIdx}-punct-btn-${pIdx}`}
                      type="button"
                      onClick={() => onInsertPunctuationToNote(punct)}
                      className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center border border-zinc-200/80 dark:border-zinc-700/80 hover:border-amber-400/80 dark:hover:border-amber-500/80"
                      title={`在選取音符插入標點符號「${punct}」`}
                    >
                      {punct}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

VerseModeView.displayName = 'VerseModeView';
