'use client';

import React, { useState } from 'react';
import { ArticulationType, GraceNote, InstrumentType, JianpuNote, KeySignature, NoteDuration, PitchNumber } from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import {
  getDurationChineseInfo,
  PUNCTUATION_MARKS,
  ANNOTATION_MARKS,
  formatGraceNotes,
  INSTRUMENT_OPTIONS,
  INSTRUMENT_LABELS,
  extractTaigiTone,
  isPunctuationZeroNote,
  isStandaloneAnnotationNote,
  getPunctuationDisplayChar,
} from '@/lib/taigiUtils';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import { getStoredDeckTab, setStoredDeckTab } from '@/lib/storage';
import {
  Volume2,
  PlusCircle,
  Trash2,
  Undo2,
  Redo2,
  MessageSquareQuote,
  FileText,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Music,
  Grid,
  Zap,
  Sparkles,
  Scissors,
  Sliders,
  Wand2,
  Disc,
  ArrowLeft,
  ArrowRight,
  Copy,
  CornerDownLeft,
} from 'lucide-react';

export type DeckTabMode = 'numpad' | 'piano' | 'ornaments' | 'lyrics';

export interface NoteEditorHudProps {
  currentNote: JianpuNote;
  selectedMeasureIndex: number;
  selectedNoteIndex: number | null;
  keySignature: KeySignature;
  audioEngine: AudioEngine;
  onUpdateSelectedNote: (updater: (note: JianpuNote) => JianpuNote) => void;
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
  onInsertBreakAt?: (mIdx: number, nIdx: number) => void;
  onDeleteNoteAt: (mIdx: number, nIdx: number) => void;
  onSplitMeasureBeforeNote?: (mIdx: number, nIdx: number) => void;
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
  inCard?: boolean;

  // Measure-level Quick Duration actions
  onQuickToggleMeasureDuration?: (mIdx?: number) => void;
  onScaleMeasureDuration?: (factor: 0.5 | 2.0, mIdx?: number) => void;
  onSetUniformMeasureDuration?: (duration: NoteDuration, mIdx?: number) => void;

  // Container (Measure / Verse) actions
  containerType?: 'measure' | 'verse';
  containerLabel?: string;
  onDuplicateContainer?: () => void;
  onMoveContainerBackward?: () => void;
  onMoveContainerForward?: () => void;
  canMoveContainerBackward?: boolean;
  canMoveContainerForward?: boolean;
}

export const NoteEditorHud: React.FC<NoteEditorHudProps> = ({
  currentNote,
  selectedMeasureIndex,
  selectedNoteIndex,
  keySignature,
  audioEngine,
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
  onInsertBreakAt,
  onDeleteNoteAt,
  onSplitMeasureBeforeNote,
  onNavigateNextNote,
  onNavigatePrevNote,
  autoStepAdvance = false,
  onToggleAutoStepAdvance,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  pastCount = 0,
  futureCount = 0,
  showNotice,
  inCard = true,
  onQuickToggleMeasureDuration,
  onScaleMeasureDuration,
  onSetUniformMeasureDuration,
  containerType,
  containerLabel,
  onDuplicateContainer,
  onMoveContainerBackward,
  onMoveContainerForward,
  canMoveContainerBackward = false,
  canMoveContainerForward = false,
}) => {
  const [activeTab, setActiveTabState] = useState<DeckTabMode>(() => {
    if (typeof window !== 'undefined') return getStoredDeckTab();
    return 'numpad';
  });

  const setActiveTab = React.useCallback((tab: DeckTabMode) => {
    setActiveTabState(tab);
    setStoredDeckTab(tab);
  }, []);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isPianoCollapsed, setIsPianoCollapsed] = useState<boolean>(false);

  const durationInfo = getDurationChineseInfo(currentNote.duration);

  // Pitch formatted label
  const isLineBreakNote =
    currentNote.pitch === 'empty' &&
    (currentNote.lyric?.hanji === '\n' ||
      currentNote.lyric?.hanji === '↵' ||
      currentNote.lyric?.custom === '\n' ||
      currentNote.lyric?.custom === '↵');

  const punctChar = getPunctuationDisplayChar(currentNote);

  const pitchLabel =
    currentNote.pitch === 0
      ? '0 (Rest)'
      : isStandaloneAnnotationNote(currentNote)
      ? `標記: ${currentNote.annotation} (0拍)`
      : isLineBreakNote
      ? '↵ (Line Break · 0拍)'
      : isPunctuationZeroNote(currentNote)
      ? `"${punctChar}" (標點符號 · 0拍)`
      : currentNote.pitch === 'empty'
      ? '␣ (Empty / 0拍)'
      : `${currentNote.accidental || ''}${currentNote.pitch}${
          currentNote.octave > 0
            ? '̇'.repeat(currentNote.octave)
            : currentNote.octave < 0
            ? '̣'.repeat(Math.abs(currentNote.octave))
            : ''
        }`;

  // Grace Notes handlers
  const handleAddPreGrace = () => {
    const existing = currentNote.preGraceNotes || [];
    if (existing.length >= 3) {
      showNotice('前裝飾音最多支援 3 個小音符');
      return;
    }
    const defaultPitch = (typeof currentNote.pitch === 'number' && currentNote.pitch > 0 ? currentNote.pitch : 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    const newNote: GraceNote = { pitch: defaultPitch, octave: currentNote.octave || 0, accidental: '' };
    onUpdateSelectedNote(n => ({
      ...n,
      preGraceNotes: [...(n.preGraceNotes || []), newNote],
    }));
  };

  const handleUpdatePreGrace = (index: number, updater: (g: GraceNote) => GraceNote) => {
    onUpdateSelectedNote(n => {
      const list = [...(n.preGraceNotes || [])];
      if (list[index]) {
        list[index] = updater(list[index]);
      }
      return { ...n, preGraceNotes: list };
    });
  };

  const handleRemovePreGrace = (index: number) => {
    onUpdateSelectedNote(n => ({
      ...n,
      preGraceNotes: (n.preGraceNotes || []).filter((_, i) => i !== index),
    }));
  };

  const handleAddPostGrace = () => {
    const existing = currentNote.postGraceNotes || [];
    if (existing.length >= 3) {
      showNotice('後裝飾音最多支援 3 個小音符');
      return;
    }
    const defaultPitch = (typeof currentNote.pitch === 'number' && currentNote.pitch > 0 ? currentNote.pitch : 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    const newNote: GraceNote = { pitch: defaultPitch, octave: currentNote.octave || 0, accidental: '' };
    onUpdateSelectedNote(n => ({
      ...n,
      postGraceNotes: [...(n.postGraceNotes || []), newNote],
    }));
  };

  const handleUpdatePostGrace = (index: number, updater: (g: GraceNote) => GraceNote) => {
    onUpdateSelectedNote(n => {
      const list = [...(n.postGraceNotes || [])];
      if (list[index]) {
        list[index] = updater(list[index]);
      }
      return { ...n, postGraceNotes: list };
    });
  };

  const handleRemovePostGrace = (index: number) => {
    onUpdateSelectedNote(n => ({
      ...n,
      postGraceNotes: (n.postGraceNotes || []).filter((_, i) => i !== index),
    }));
  };

  const handleApplyOrnamentPreset = (type: 'upper_single' | 'lower_single' | 'double_slide' | 'triple_turn' | 'post_drop' | 'post_lift' | 'clear') => {
    const baseP = (typeof currentNote.pitch === 'number' && currentNote.pitch > 0 ? currentNote.pitch : 5);
    const wrapPitch = (p: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 => {
      let norm = ((p - 1) % 7) + 1;
      if (norm <= 0) norm += 7;
      return norm as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    };

    let updatedPre: GraceNote[] = currentNote.preGraceNotes || [];
    let updatedPost: GraceNote[] = currentNote.postGraceNotes || [];

    switch (type) {
      case 'upper_single':
        updatedPre = [{ pitch: wrapPitch(baseP + 1), octave: currentNote.octave || 0 }];
        showNotice('已套用：單音上倚音');
        break;
      case 'lower_single':
        updatedPre = [{ pitch: wrapPitch(baseP - 1), octave: currentNote.octave || 0 }];
        showNotice('已套用：單音下倚音');
        break;
      case 'double_slide':
        updatedPre = [
          { pitch: wrapPitch(baseP - 2), octave: currentNote.octave || 0 },
          { pitch: wrapPitch(baseP - 1), octave: currentNote.octave || 0 },
        ];
        showNotice('已套用：雙音滑轉');
        break;
      case 'triple_turn':
        updatedPre = [
          { pitch: wrapPitch(baseP + 1), octave: currentNote.octave || 0 },
          { pitch: wrapPitch(baseP), octave: currentNote.octave || 0 },
          { pitch: wrapPitch(baseP - 1), octave: currentNote.octave || 0 },
        ];
        showNotice('已套用：三音迴音');
        break;
      case 'post_drop':
        updatedPost = [{ pitch: wrapPitch(baseP - 1), octave: currentNote.octave || 0 }];
        showNotice('已套用：尾音下拋');
        break;
      case 'post_lift':
        updatedPost = [{ pitch: wrapPitch(baseP + 1), octave: currentNote.octave || 0 }];
        showNotice('已套用：尾音上提');
        break;
      case 'clear':
        updatedPre = [];
        updatedPost = [];
        showNotice('已清除裝飾音');
        break;
    }

    const updatedNote: JianpuNote = {
      ...currentNote,
      preGraceNotes: updatedPre,
      postGraceNotes: updatedPost,
    };
    onUpdateSelectedNote(() => updatedNote);
    audioEngine.previewNote(keySignature, updatedNote);
  };

  return (
    <div
      id={`inline-note-hud-${selectedMeasureIndex}`}
      onClick={e => e.stopPropagation()}
      className={`w-full transition-all duration-200 overflow-hidden ${
        inCard
          ? 'my-3.5 bg-white dark:bg-[#141720] border border-zinc-300 dark:border-zinc-700/80 rounded-2xl shadow-lg ring-1 ring-black/5 dark:ring-white/5'
          : 'sticky top-[68px] z-30 bg-white/95 dark:bg-[#141720]/95 backdrop-blur-md border-2 border-amber-500 rounded-2xl shadow-xl'
      }`}
    >
      {/* Top Header Bar: Note Summary & Instant Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-zinc-100/90 dark:bg-[#0c0e14]/90 border-b border-zinc-200/90 dark:border-zinc-800/90 text-xs">
        {/* Selected Note Badge & LCD Readout */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-3 py-1.5 bg-amber-500 text-zinc-950 rounded-lg font-black font-mono text-xs shadow-2xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>#{selectedMeasureIndex + 1}.{(selectedNoteIndex ?? 0) + 1}</span>
          </span>

          <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100 flex-wrap">
            <span className="daw-lcd text-sm px-3 py-1 rounded-lg font-mono font-bold shadow-xs">
              {pitchLabel}
            </span>
            <span className="text-zinc-600 dark:text-zinc-300 font-medium">
              {durationInfo.beatsLabel} ({durationInfo.name})
            </span>

            {/* Note Sound Source Override Selector (Matching Screenshot 2) */}
            <div className="flex items-center gap-1 bg-zinc-200/90 dark:bg-zinc-800/90 px-2 py-1 rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-2xs">
              <Disc className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <select
                id={`hud-note-instrument-select-${selectedMeasureIndex}-${selectedNoteIndex}`}
                value={currentNote.instrument || ''}
                onChange={e => {
                  const val = (e.target.value as InstrumentType) || undefined;
                  onUpdateSelectedNote(prev => ({
                    ...prev,
                    instrument: val,
                  }));
                  if (val) {
                    audioEngine.previewNote(keySignature, { ...currentNote, instrument: val });
                  }
                }}
                className="bg-transparent font-bold text-xs text-amber-600 dark:text-amber-400 focus:outline-hidden cursor-pointer"
                title="音色覆蓋 (Sound Source Override - Overrides primary song tone)"
              >
                <option value="" className="bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                  預設 (Default)
                </option>
                {INSTRUMENT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                    {opt.labelZh} ({opt.value})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(currentNote.tieToNext || (currentNote.isTied && !currentNote.slurToNext)) && (
            <span className="text-xs bg-amber-400/20 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-md font-bold border border-amber-400/40" title="Tie: 連結音 (音色融合成一音)">
              Tie ⌒ (連結)
            </span>
          )}

          {currentNote.slurToNext && (
            <span className="text-xs bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-md font-bold border border-purple-400/40" title="Slur: 圓滑音 (連音/一字多音)">
              Slur ⌢ (圓滑)
            </span>
          )}

          {currentNote.articulation && currentNote.articulation !== 'none' && (
            <span className="text-xs bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-1 rounded-md font-bold border border-cyan-400/40">
              {currentNote.articulation === 'fermata' && '延長 𝄐'}
              {currentNote.articulation === 'accent' && '重音 >'}
              {currentNote.articulation === 'staccato' && '跳音 ·'}
              {currentNote.articulation === 'tenuto' && '保持 —'}
              {currentNote.articulation === 'portamento_up' && '上滑 ↗'}
              {currentNote.articulation === 'portamento_down' && '下滑 ↘'}
            </span>
          )}

          {currentNote.isTriplet && (
            <span className="text-xs bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md font-bold border border-indigo-400/40">
              三連音 3
            </span>
          )}

          {((currentNote.preGraceNotes?.length || 0) + (currentNote.postGraceNotes?.length || 0) > 0) && (
            <span className="text-xs bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-md font-bold border border-rose-400/30">
              裝飾: {formatGraceNotes(currentNote.preGraceNotes)} {currentNote.pitch} {formatGraceNotes(currentNote.postGraceNotes)}
            </span>
          )}

          {isStandaloneAnnotationNote(currentNote) && (
            <span className="text-xs bg-indigo-600 text-white dark:bg-indigo-500 px-2.5 py-1 rounded-md font-bold shadow-xs">
              標記 · 0拍: {currentNote.annotation}
            </span>
          )}

          {isPunctuationZeroNote(currentNote) && (
            <span className="text-xs bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-md font-bold border border-amber-400/40">
              標點/間隔 (0拍) · 僅佔 1 字元
            </span>
          )}

          {currentNote.annotation && !isStandaloneAnnotationNote(currentNote) && (
            <span className="text-xs bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-md font-bold border border-indigo-400/30">
              附屬標記: {currentNote.annotation}
            </span>
          )}
        </div>

        {/* Action Tools & Navigation (Touch Targets >= 40px) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Audition Button */}
          <button
            type="button"
            onClick={() => audioEngine.previewNote(keySignature, currentNote)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
            title="Play note"
          >
            <Volume2 className="w-4 h-4" />
            <span>Play</span>
          </button>

          {/* Prev / Next Note Quick Navigation */}
          {onNavigatePrevNote && onNavigateNextNote && (
            <div className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 rounded-xl border border-zinc-300 dark:border-zinc-700 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={onNavigatePrevNote}
                className="p-2 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 cursor-pointer touch-manipulation min-h-[38px] min-w-[38px] flex items-center justify-center"
                title="Select previous note (←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-700" />
              <button
                type="button"
                onClick={onNavigateNextNote}
                className="p-2 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 cursor-pointer touch-manipulation min-h-[38px] min-w-[38px] flex items-center justify-center"
                title="Select next note (→)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Insert Note */}
          <button
            type="button"
            onClick={() => onInsertNoteAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
            title="Insert new note after current note"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Insert Note</span>
          </button>

          {/* Insert Break (Line break note directly after current note) */}
          {onInsertBreakAt && (
            <button
              id="hud-insert-break-btn"
              type="button"
              onClick={() => onInsertBreakAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title="Insert line break note (↵) directly after current note (splits verse, 0 beats)"
            >
              <CornerDownLeft className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Insert Break</span>
              <span className="sm:hidden">Break</span>
            </button>
          )}

          {/* Delete Note */}
          <button
            type="button"
            onClick={() => onDeleteNoteAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
            className="p-2 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900/80 text-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Delete current note"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Undo / Redo in Input Deck */}
          {(onUndo || onRedo) && (
            <div
              id="hud-undo-redo-group"
              className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-2xs"
            >
              {onUndo && (
                <button
                  id="hud-undo-btn"
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  title={canUndo ? `Undo [Ctrl+Z] · ${pastCount} step(s)` : 'No steps to undo'}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px]"
                >
                  <Undo2 className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Undo</span>
                  {canUndo && pastCount > 0 && (
                    <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono font-bold">
                      {pastCount}
                    </span>
                  )}
                </button>
              )}

              {onUndo && onRedo && (
                <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />
              )}

              {onRedo && (
                <button
                  id="hud-redo-btn"
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  title={canRedo ? `Redo [Ctrl+Y] · ${futureCount} step(s)` : 'No steps to redo'}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px]"
                >
                  <Redo2 className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Redo</span>
                  {canRedo && futureCount > 0 && (
                    <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono font-bold">
                      {futureCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Split Measure before current note */}
          {onSplitMeasureBeforeNote && selectedNoteIndex !== null && selectedNoteIndex > 0 && (
            <button
              type="button"
              onClick={() => onSplitMeasureBeforeNote(selectedMeasureIndex, selectedNoteIndex)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title="Insert barline before this note and split measure"
            >
              <Scissors className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Split Measure</span>
            </button>
          )}

          {/* Measure / Verse Actions: Move Backward / Forward */}
          {(onMoveContainerBackward || onMoveContainerForward) && (
            <div
              id="hud-move-container-group"
              className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-2xs"
            >
              <button
                id="hud-move-backward-btn"
                type="button"
                onClick={onMoveContainerBackward}
                disabled={!canMoveContainerBackward}
                title={canMoveContainerBackward ? `Move ${containerLabel || (containerType === 'verse' ? 'verse' : 'measure')} backward (earlier in song)` : 'Cannot move backward (already at first position)'}
                className="p-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] min-w-[36px] flex items-center justify-center"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
              </button>
              <span className="text-[11px] font-bold px-1.5 text-zinc-700 dark:text-zinc-200 select-none whitespace-nowrap">
                Move {containerType === 'verse' ? 'Verse' : 'Measure'}
              </span>
              <button
                id="hud-move-forward-btn"
                type="button"
                onClick={onMoveContainerForward}
                disabled={!canMoveContainerForward}
                title={canMoveContainerForward ? `Move ${containerLabel || (containerType === 'verse' ? 'verse' : 'measure')} forward (later in song)` : 'Already at last position'}
                className="p-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] min-w-[36px] flex items-center justify-center"
              >
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          )}

          {/* Measure / Verse Actions: Duplicate */}
          {onDuplicateContainer && (
            <button
              id="hud-duplicate-container-btn"
              type="button"
              onClick={onDuplicateContainer}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold border border-zinc-300 dark:border-zinc-700 transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title={`Duplicate current ${containerType === 'verse' ? 'verse' : 'measure'}`}
            >
              <Copy className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Duplicate {containerType === 'verse' ? 'Verse' : 'Measure'}</span>
              <span className="sm:hidden">Dup {containerType === 'verse' ? 'Verse' : 'Bar'}</span>
            </button>
          )}

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-bold rounded-xl border border-amber-300 dark:border-amber-700 transition-all cursor-pointer min-h-[36px]"
            title={isCollapsed ? 'Expand Deck' : 'Collapse Deck'}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Expand</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Deck View */}
      {!isCollapsed && (
        <div className="p-3.5 flex flex-col gap-3">
          {/* Deck Mode Tabs & Auto-Step Switch */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
            {/* 3 Modular Tabs */}
            <div className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] p-1 rounded-xl border border-zinc-200/90 dark:border-zinc-800 text-xs font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('numpad')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  activeTab === 'numpad'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Quick Bar</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('piano')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  activeTab === 'piano'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Music className="w-4 h-4" />
                <span>Piano Roll</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ornaments')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  activeTab === 'ornaments'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>裝飾音 (Grace)</span>
                {((currentNote.preGraceNotes?.length || 0) + (currentNote.postGraceNotes?.length || 0) > 0) && (
                  <span className="ml-0.5 px-1.5 py-0.2 bg-purple-600 text-white rounded-full text-[10px] font-black">
                    {(currentNote.preGraceNotes?.length || 0) + (currentNote.postGraceNotes?.length || 0)}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('lyrics')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  activeTab === 'lyrics'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <MessageSquareQuote className="w-4 h-4" />
                <span>歌詞 (羅馬字 / 漢羅) 與標點</span>
              </button>
            </div>

            {/* Auto-Step Next Note Mode Toggle */}
            {onToggleAutoStepAdvance && (
              <button
                type="button"
                onClick={onToggleAutoStepAdvance}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  autoStepAdvance
                    ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-xs'
                    : 'bg-zinc-100 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 border-zinc-200/90 dark:border-zinc-800'
                }`}
                title="Auto-advance mode: automatically move to next note after selecting pitch"
              >
                <Zap className={`w-4 h-4 ${autoStepAdvance ? 'fill-current' : ''}`} />
                <span>Auto Step Advance: {autoStepAdvance ? 'ON' : 'OFF'}</span>
              </button>
            )}
          </div>

          {/* TAB 1: QUICK BAR */}
          {activeTab === 'numpad' && (
            <div className="flex flex-col gap-3.5">
              {/* Row 1: Pitches (1-7, 0, ␣) + Octaves + Accidentals */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Pitches (1-7, 0, ␣) as Tactile Audio Pads */}
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
                  <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 w-12">
                    Pitch:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap flex-1">
                    {[1, 2, 3, 4, 5, 6, 7].map(p => {
                      const isCurrent = currentNote.pitch === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onSetPitch(p as PitchNumber)}
                          className={`flex-1 min-w-[42px] sm:min-w-[48px] h-12 rounded-xl font-mono text-xl font-black transition-all active:scale-95 cursor-pointer touch-manipulation flex items-center justify-center ${
                            isCurrent
                              ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md scale-105 font-black'
                              : 'bg-zinc-100 dark:bg-[#0a0c10] hover:bg-amber-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}

                    {/* Rest 0 */}
                    <button
                      type="button"
                      onClick={() => onSetPitch(0)}
                      className={`min-w-[50px] sm:min-w-[56px] h-12 rounded-xl font-mono text-base font-bold transition-all active:scale-95 cursor-pointer touch-manipulation flex items-center justify-center gap-1 px-2.5 ${
                        currentNote.pitch === 0
                          ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md font-black'
                          : 'bg-zinc-100 dark:bg-[#0a0c10] hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs'
                      }`}
                      title="Rest (0)"
                    >
                      <span>0</span>
                      <span className="text-[10px] font-sans font-normal">Rest</span>
                    </button>

                    {/* Empty ␣ */}
                    <button
                      type="button"
                      onClick={() => onSetPitch('empty')}
                      className={`min-w-[50px] sm:min-w-[56px] h-12 rounded-xl font-mono text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation flex items-center justify-center gap-1 px-2.5 border-dashed ${
                        currentNote.pitch === 'empty'
                          ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md font-black border-amber-400'
                          : 'bg-zinc-100/80 dark:bg-[#0a0c10]/80 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 shadow-2xs'
                      }`}
                      title="Empty / Spacer"
                    >
                      <span>␣ Empty</span>
                    </button>
                  </div>
                </div>

                {/* Octave & Accidental Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Octave */}
                  <div className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] p-1 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs text-xs">
                    <button
                      type="button"
                      onClick={() => onSetOctave(-1)}
                      className={`px-3 py-2 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                        currentNote.octave === -1
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                      title="Low (dot below 5̣)"
                    >
                      Low 5̣
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSelectedNote(n => ({ ...n, octave: 0 }))}
                      className={`px-3 py-2 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                        currentNote.octave === 0
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                      title="Mid (natural 5)"
                    >
                      Mid 5
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetOctave(1)}
                      className={`px-3 py-2 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                        currentNote.octave === 1
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                      title="High (dot above 5̇)"
                    >
                      High 5̇
                    </button>
                  </div>

                  {/* Accidentals */}
                  <div className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] p-1 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs text-xs">
                    <button
                      type="button"
                      onClick={() => onSetAccidental('#')}
                      className={`px-3 py-2 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                        currentNote.accidental === '#'
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                      title="Sharp ♯"
                    >
                      ♯ Sharp
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetAccidental('b')}
                      className={`px-3 py-2 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                        currentNote.accidental === 'b'
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                      title="Flat ♭"
                    >
                      ♭ Flat
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Duration & Phrasing Controls */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200/80 dark:border-zinc-800/80">
                <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 w-12">
                  Duration:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {[
                    { label: '0 beats (Empty)', dur: 0 },
                    { label: '1 beat (Quarter)', dur: 1 },
                    { label: '0.5 beats (8th)', dur: 0.5 },
                    { label: '1.5 beats (Dotted 4th)', dur: 1.5 },
                    { label: '0.25 beats (16th)', dur: 0.25 },
                    { label: '0.125 beats (32nd)', dur: 0.125 },
                    { label: '⅓ Triplet (8th)', dur: 0.333 },
                    { label: '⅔ Triplet (4th)', dur: 0.667 },
                    { label: '0.75 beats', dur: 0.75 },
                    { label: '1.75 beats (··)', dur: 1.75 },
                    { label: '2 beats (Half)', dur: 2 },
                    { label: '3 beats (Dotted Half)', dur: 3 },
                    { label: '4 beats (Whole)', dur: 4 },
                  ].map(d => (
                    <button
                      key={d.dur}
                      type="button"
                      onClick={() => onSetDuration(d.dur as NoteDuration)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                        currentNote.duration === d.dur
                          ? 'bg-amber-500 text-zinc-950 font-black shadow-xs ring-2 ring-amber-400'
                          : 'bg-zinc-100 dark:bg-[#0a0c10] hover:bg-amber-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}

                  {/* Toggle Dotted */}
                  <button
                    type="button"
                    onClick={onToggleDotted}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                      currentNote.isDotted
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 ring-2 ring-amber-400 font-black shadow-xs'
                        : 'border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 shadow-2xs'
                    }`}
                  >
                    · Dotted
                  </button>

                  {/* Toggle Double Dotted */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onToggleDoubleDotted) {
                        onToggleDoubleDotted();
                      } else {
                        onUpdateSelectedNote(n => {
                          const nextDouble = !n.isDoubleDotted;
                          let nextDur = n.duration;
                          if (nextDouble) {
                            if (n.duration === 1) nextDur = 1.75;
                            else if (n.duration === 2) nextDur = 3.5;
                          } else {
                            if (n.duration === 1.75) nextDur = 1;
                            else if (n.duration === 3.5) nextDur = 2;
                          }
                          return { ...n, isDoubleDotted: nextDouble, duration: nextDur };
                        });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                      currentNote.isDoubleDotted || currentNote.duration === 1.75 || currentNote.duration === 3.5
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 ring-2 ring-amber-400 font-black shadow-xs'
                        : 'border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 shadow-2xs'
                    }`}
                    title="Double Dotted (雙附點)"
                  >
                    ·· Double Dot
                  </button>

                  {/* Toggle Triplet */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onToggleTriplet) {
                        onToggleTriplet();
                      } else {
                        onUpdateSelectedNote(n => {
                          const nextTrip = !n.isTriplet;
                          let nextDur = n.duration;
                          if (nextTrip) {
                            if (n.duration === 0.5) nextDur = 0.333;
                            else if (n.duration === 1) nextDur = 0.667;
                            else nextDur = 0.333;
                          } else {
                            if (n.duration === 0.333) nextDur = 0.5;
                            else if (n.duration === 0.667) nextDur = 1;
                          }
                          return { ...n, isTriplet: nextTrip, duration: nextDur };
                        });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                      currentNote.isTriplet || currentNote.duration === 0.333 || currentNote.duration === 0.667
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 ring-2 ring-amber-400 font-black shadow-xs'
                        : 'border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 shadow-2xs'
                    }`}
                    title="Triplet (三連音)"
                  >
                    ┌ 3 ┐ Triplet
                  </button>

                  {/* Toggle Tie */}
                  <button
                    type="button"
                    onClick={onToggleTie}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                      currentNote.tieToNext || (currentNote.isTied && !currentNote.slurToNext)
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 ring-2 ring-amber-400 font-black shadow-xs'
                        : 'border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 shadow-2xs'
                    }`}
                    title="Tie (連結音): 連接同音高，播放時音色融合為一持續長音"
                  >
                    ⌒ Tie (連結音)
                  </button>

                  {/* Toggle Slur */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onToggleSlur) {
                        onToggleSlur();
                      } else {
                        onUpdateSelectedNote(n => ({
                          ...n,
                          slurToNext: !n.slurToNext,
                        }));
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                      currentNote.slurToNext
                        ? 'bg-purple-600 text-white border-purple-500 ring-2 ring-purple-400 font-black shadow-xs'
                        : 'border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 shadow-2xs'
                    }`}
                    title="Slur (圓滑音): 跨越不同音高圓滑唱奏，亦適用一字多音 (Melisma)"
                  >
                    ⌢ Slur (圓滑音)
                  </button>
                </div>
              </div>

              {/* Row 2.5: Whole Measure Quick Duration Batch Strip */}
              {(onScaleMeasureDuration || onSetUniformMeasureDuration) && (
                <div
                  id="hud-measure-duration-quick-strip"
                  className="flex flex-wrap items-center gap-2 pt-1.5 pb-1 px-2.5 bg-amber-500/10 dark:bg-amber-950/25 border border-amber-300/80 dark:border-amber-800/60 rounded-xl"
                >
                  <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <span>M.{selectedMeasureIndex + 1} Batch:</span>
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Proportional Scaling: Halve & Double */}
                    {onScaleMeasureDuration && (
                      <div className="flex items-center bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-amber-300/80 dark:border-zinc-700 shadow-2xs gap-0.5">
                        <button
                          type="button"
                          onClick={() => onScaleMeasureDuration(0.5, selectedMeasureIndex)}
                          className="flex items-center gap-1 px-2.5 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-700 rounded-md text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[30px]"
                          title={`Proportionally halve (÷2) all note durations in Measure #${selectedMeasureIndex + 1} (e.g. 1 → 0.5, 0.5 → 0.25)`}
                        >
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400">÷2</span>
                          <span>Halve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onScaleMeasureDuration(2.0, selectedMeasureIndex)}
                          className="flex items-center gap-1 px-2.5 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-700 rounded-md text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[30px]"
                          title={`Proportionally double (×2) all note durations in Measure #${selectedMeasureIndex + 1} (e.g. 0.5 → 1, 1 → 2)`}
                        >
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400">×2</span>
                          <span>Double</span>
                        </button>
                      </div>
                    )}

                    {/* Direct Uniform Duration Presets: All to: ♪ 0.5 | ♩ 1.0 | 𝅗𝅥 2.0 */}
                    {onSetUniformMeasureDuration && (
                      <div className="flex items-center bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-amber-300/80 dark:border-zinc-700 shadow-2xs gap-0.5">
                        <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 px-1.5">All to:</span>
                        <button
                          type="button"
                          onClick={() => onSetUniformMeasureDuration(0.5, selectedMeasureIndex)}
                          className="px-2 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-700 rounded-md text-xs font-bold transition-all cursor-pointer min-h-[30px]"
                          title={`Set all notes in Measure #${selectedMeasureIndex + 1} to 8th note (0.5 beats)`}
                        >
                          ♪ 0.5
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetUniformMeasureDuration(1.0, selectedMeasureIndex)}
                          className="px-2 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-700 rounded-md text-xs font-bold transition-all cursor-pointer min-h-[30px]"
                          title={`Set all notes in Measure #${selectedMeasureIndex + 1} to Quarter note (1.0 beat)`}
                        >
                          ♩ 1.0
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetUniformMeasureDuration(2.0, selectedMeasureIndex)}
                          className="px-2 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-700 rounded-md text-xs font-bold transition-all cursor-pointer min-h-[30px]"
                          title={`Set all notes in Measure #${selectedMeasureIndex + 1} to Half note (2.0 beats)`}
                        >
                          𝅗𝅥 2.0
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Row 3: Articulations Palette */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
                <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 w-12">
                  Artic:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {[
                    { label: '自然 (None)', art: 'none' as const },
                    { label: '延長 𝄐 (Fermata)', art: 'fermata' as const },
                    { label: '重音 > (Accent)', art: 'accent' as const },
                    { label: '跳音 · (Staccato)', art: 'staccato' as const },
                    { label: '保持 — (Tenuto)', art: 'tenuto' as const },
                    { label: '上滑 ↗ (Port. Up)', art: 'portamento_up' as const },
                    { label: '下滑 ↘ (Port. Down)', art: 'portamento_down' as const },
                  ].map(a => {
                    const isSelected = (currentNote.articulation || 'none') === a.art;
                    return (
                      <button
                        key={a.art}
                        type="button"
                        onClick={() => {
                          if (onSetArticulation) {
                            onSetArticulation(a.art);
                          } else {
                            onUpdateSelectedNote(n => ({ ...n, articulation: a.art }));
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                          isSelected
                            ? 'bg-amber-500 text-zinc-950 font-black shadow-xs ring-2 ring-amber-400'
                            : 'bg-zinc-100 dark:bg-[#0a0c10] hover:bg-amber-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs'
                        }`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PIANO ROLL */}
          {activeTab === 'piano' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-amber-500" />
                  <span>Interactive Piano Roll</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsPianoCollapsed(prev => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
                  title={isPianoCollapsed ? 'Expand Piano Keys' : 'Collapse Piano Keys'}
                >
                  {isPianoCollapsed ? (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                      <span>Expand Piano</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 text-amber-500" />
                      <span>Collapse Piano</span>
                    </>
                  )}
                </button>
              </div>

              {!isPianoCollapsed ? (
                <PianoKeyboard
                  keySignature={keySignature}
                  currentNote={currentNote}
                  onSelectPitch={(pitch, octave, accidental) => {
                    onUpdateSelectedNote(n => ({
                      ...n,
                      pitch,
                      octave,
                      accidental: accidental || '',
                    }));
                  }}
                  audioEngine={audioEngine}
                />
              ) : (
                <div
                  onClick={() => setIsPianoCollapsed(false)}
                  className="p-3 rounded-xl border border-dashed border-amber-300/80 dark:border-zinc-700 bg-amber-50/50 dark:bg-zinc-800/40 text-center cursor-pointer hover:bg-amber-100/60 dark:hover:bg-zinc-800/70 transition-colors"
                >
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-1.5 font-medium">
                    <Music className="w-3.5 h-3.5 text-amber-500" />
                    <span>Piano keyboard is collapsed (click here or top-right button to expand)</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ORNAMENTS / GRACE NOTES */}
          {activeTab === 'ornaments' && (
            <div className="flex flex-col gap-4">
              {/* Header & Quick Audition Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-zinc-50 dark:bg-[#0c0e14] rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    裝飾音編輯 (前裝飾音與後裝飾音，支援 1 至 3 個小音符)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => audioEngine.previewNote(keySignature, currentNote)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-95 transition-all shadow-xs cursor-pointer"
                  title="試聽本音與裝飾音 (Preview note with ornaments)"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>試聽效果</span>
                </button>
              </div>

              {/* Note Sound Source Override Section */}
              <div className="flex flex-col gap-2 p-3 bg-zinc-100/70 dark:bg-[#0c0e14]/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Disc className="w-4 h-4 text-amber-500" />
                    <span>音色音源覆蓋 (Note Sound Source Override)</span>
                  </span>
                  {currentNote.instrument && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSelectedNote(prev => ({ ...prev, instrument: undefined }));
                      }}
                      className="text-[11px] text-zinc-500 hover:text-rose-500 underline cursor-pointer"
                    >
                      重設為預設 (Reset)
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSelectedNote(prev => ({ ...prev, instrument: undefined }));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                      !currentNote.instrument
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-xs font-black'
                        : 'bg-white dark:bg-[#141720] border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-amber-400'
                    }`}
                  >
                    預設 (Default)
                  </button>
                  {INSTRUMENT_OPTIONS.map(opt => {
                    const isSelected = currentNote.instrument === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onUpdateSelectedNote(prev => ({ ...prev, instrument: opt.value }));
                          audioEngine.previewNote(keySignature, { ...currentNote, instrument: opt.value });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-xs ring-2 ring-amber-400 font-black'
                            : 'bg-white dark:bg-[#141720] border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-amber-400'
                        }`}
                        title={opt.labelEn}
                      >
                        {opt.labelZh}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 經典唱腔裝飾音範本 (One-Tap Presets) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  經典台語 / 流行唱腔範本 (One-Tap Presets):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: '單音上倚音', desc: 'Pre-grace +1', type: 'upper_single' as const },
                    { label: '單音下倚音', desc: 'Pre-grace -1', type: 'lower_single' as const },
                    { label: '雙音滑轉', desc: 'Pre-grace double', type: 'double_slide' as const },
                    { label: '三音迴音', desc: 'Pre-grace triple turn', type: 'triple_turn' as const },
                    { label: '尾音下拋', desc: 'Post-grace drop', type: 'post_drop' as const },
                    { label: '尾音上提', desc: 'Post-grace lift', type: 'post_lift' as const },
                    { label: '清除裝飾音', desc: 'Clear', type: 'clear' as const },
                  ].map(p => (
                    <button
                      key={p.type}
                      type="button"
                      onClick={() => handleApplyOrnamentPreset(p.type)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] ${
                        p.type === 'clear'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50 hover:bg-rose-100'
                          : 'bg-zinc-100 dark:bg-[#0a0c10] hover:bg-amber-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs'
                      }`}
                      title={p.desc}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 前裝飾音 (Pre-Grace Notes, 1 to 3 notes) */}
              <div className="flex flex-col gap-2 p-3 bg-zinc-100/70 dark:bg-[#0c0e14]/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                      前裝飾音 (前倚音 / Pre-Grace Notes)
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {(currentNote.preGraceNotes || []).length} / 3 音
                    </span>
                  </div>
                  {(currentNote.preGraceNotes || []).length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddPreGrace}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-95 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>新增音符</span>
                    </button>
                  )}
                </div>

                {(!currentNote.preGraceNotes || currentNote.preGraceNotes.length === 0) ? (
                  <p className="text-xs text-zinc-500 italic py-1">尚未設定前裝飾音（點擊上方「新增音符」或點選唱腔範本）</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {currentNote.preGraceNotes.map((g, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white dark:bg-[#141720] rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded-md font-mono font-black text-xs">
                            #{idx + 1}
                          </span>

                          {/* Pitch Picker (1-7) */}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5, 6, 7].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleUpdatePreGrace(idx, old => ({ ...old, pitch: p as 1 | 2 | 3 | 4 | 5 | 6 | 7 }))}
                                className={`w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                                  g.pitch === p
                                    ? 'bg-amber-500 text-zinc-950 font-black ring-2 ring-amber-400'
                                    : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>

                          {/* Octave buttons */}
                          <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                            {[-1, 0, 1].map(oct => (
                              <button
                                key={oct}
                                type="button"
                                onClick={() => handleUpdatePreGrace(idx, old => ({ ...old, octave: oct }))}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                  (g.octave || 0) === oct
                                    ? 'bg-amber-500 text-zinc-950 font-black'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {oct === -1 ? '低̣' : oct === 1 ? '高̇' : '中'}
                              </button>
                            ))}
                          </div>

                          {/* Accidental buttons */}
                          <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                            {(['', '#', 'b'] as const).map(acc => (
                              <button
                                key={acc || 'nat'}
                                type="button"
                                onClick={() => handleUpdatePreGrace(idx, old => ({ ...old, accidental: acc }))}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                  (g.accidental || '') === acc
                                    ? 'bg-amber-500 text-zinc-950 font-black'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {acc === '#' ? '♯' : acc === 'b' ? '♭' : '♮'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemovePreGrace(idx)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="刪除此外飾音"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 後裝飾音 (Post-Grace Notes, 1 to 3 notes) */}
              <div className="flex flex-col gap-2 p-3 bg-zinc-100/70 dark:bg-[#0c0e14]/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                      後裝飾音 (尾裝飾音 / Post-Grace Notes)
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {(currentNote.postGraceNotes || []).length} / 3 音
                    </span>
                  </div>
                  {(currentNote.postGraceNotes || []).length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddPostGrace}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-95 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>新增音符</span>
                    </button>
                  )}
                </div>

                {(!currentNote.postGraceNotes || currentNote.postGraceNotes.length === 0) ? (
                  <p className="text-xs text-zinc-500 italic py-1">尚未設定後裝飾音（點擊上方「新增音符」或點選唱腔範本）</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {currentNote.postGraceNotes.map((g, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white dark:bg-[#141720] rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-800 dark:text-purple-300 rounded-md font-mono font-black text-xs">
                            #{idx + 1}
                          </span>

                          {/* Pitch Picker (1-7) */}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5, 6, 7].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleUpdatePostGrace(idx, old => ({ ...old, pitch: p as 1 | 2 | 3 | 4 | 5 | 6 | 7 }))}
                                className={`w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                                  g.pitch === p
                                    ? 'bg-amber-500 text-zinc-950 font-black ring-2 ring-amber-400'
                                    : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>

                          {/* Octave buttons */}
                          <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                            {[-1, 0, 1].map(oct => (
                              <button
                                key={oct}
                                type="button"
                                onClick={() => handleUpdatePostGrace(idx, old => ({ ...old, octave: oct }))}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                  (g.octave || 0) === oct
                                    ? 'bg-amber-500 text-zinc-950 font-black'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {oct === -1 ? '低̣' : oct === 1 ? '高̇' : '中'}
                              </button>
                            ))}
                          </div>

                          {/* Accidental buttons */}
                          <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                            {(['', '#', 'b'] as const).map(acc => (
                              <button
                                key={acc || 'nat'}
                                type="button"
                                onClick={() => handleUpdatePostGrace(idx, old => ({ ...old, accidental: acc }))}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                  (g.accidental || '') === acc
                                    ? 'bg-amber-500 text-zinc-950 font-black'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {acc === '#' ? '♯' : acc === 'b' ? '♭' : '♮'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemovePostGrace(idx)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="刪除此外飾音"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LYRICS & ANNOTATIONS */}
          {activeTab === 'lyrics' && (
            <div className="flex flex-col gap-3.5">
              {/* Single-Note Direct Lyric Syllable Editor (羅馬字 / 漢羅) */}
              <div className="p-3 bg-zinc-50 dark:bg-[#0c0e14] rounded-xl border border-zinc-200/90 dark:border-zinc-800 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <MessageSquareQuote className="w-4 h-4 text-amber-500" />
                    <span>本音歌詞設定 (羅馬字 / 漢羅)</span>
                  </span>
                  {(() => {
                    const tone = extractTaigiTone(currentNote.lyric?.poj || currentNote.lyric?.pij || '');
                    if (!tone) return null;
                    return (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-black border border-emerald-500/30"
                        title={`${tone.name} (聲調符號 ${tone.symbol})`}
                      >
                        第 {tone.toneNumber} 調 {tone.symbol}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      羅馬字 (Romanization / POJ / TL):
                    </label>
                    <input
                      type="text"
                      placeholder="例：teng-ē 或 siú..."
                      value={currentNote.lyric?.poj || currentNote.lyric?.pij || ''}
                      onChange={e => {
                        const val = e.target.value;
                        onUpdateSelectedNote(n => ({
                          ...n,
                          lyric: {
                            ...n.lyric,
                            poj: val,
                            pij: val,
                          },
                        }));
                      }}
                      className="px-3.5 py-2 text-xs bg-white dark:bg-[#141720] border border-zinc-200/90 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 font-serif min-h-[38px]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      漢羅 (Han-lô / 漢字):
                    </label>
                    <input
                      type="text"
                      placeholder="例：燈下 或 守..."
                      value={currentNote.lyric?.custom || currentNote.lyric?.hanji || ''}
                      onChange={e => {
                        const val = e.target.value;
                        onUpdateSelectedNote(n => ({
                          ...n,
                          lyric: {
                            ...n.lyric,
                            hanji: val,
                            custom: val,
                          },
                        }));
                      }}
                      className="px-3.5 py-2 text-xs bg-white dark:bg-[#141720] border border-zinc-200/90 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 font-serif min-h-[38px]"
                    />
                  </div>
                </div>
              </div>

              {/* Punctuation Row */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 shrink-0 w-24">
                  <MessageSquareQuote className="w-4 h-4" /> Punctuation:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {PUNCTUATION_MARKS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => onInsertPunctuation(p.char)}
                      title={`Insert punctuation ${p.label} (${p.desc})`}
                      className={`min-w-[44px] h-11 px-2.5 rounded-xl font-mono font-black text-sm border transition-all active:scale-95 flex items-center justify-center shadow-2xs cursor-pointer touch-manipulation ${
                        p.char === '\n'
                          ? 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                          : 'bg-zinc-100 hover:bg-amber-100 dark:bg-[#0a0c10] dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200/90 dark:border-zinc-700/80'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Performance Annotations */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 shrink-0 w-24">
                  <FileText className="w-4 h-4" /> Annotations:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {ANNOTATION_MARKS.map(ann => (
                    <button
                      key={ann.label}
                      type="button"
                      onClick={() => onInsertAnnotation(ann.text)}
                      title={`Insert annotation ${ann.label} (${ann.desc})`}
                      className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-indigo-100 dark:bg-[#0a0c10] dark:hover:bg-zinc-800 text-indigo-900 dark:text-indigo-200 font-semibold text-xs border border-zinc-200/90 dark:border-zinc-700/80 transition-all active:scale-95 whitespace-nowrap shadow-2xs cursor-pointer touch-manipulation min-h-[40px]"
                    >
                      {ann.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Annotation Input */}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 shrink-0">Custom Annotation:</span>
                <input
                  type="text"
                  placeholder="e.g. (Pre-Chorus / Male Solo / Rubato)..."
                  value={currentNote.annotation || ''}
                  onChange={e => onSetAnnotation(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-[#0a0c10] border border-zinc-200/90 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 min-h-[40px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    onSetPitch('empty');
                    showNotice('Set custom annotation with empty pitch (Empty)');
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[40px] shadow-xs active:scale-95 touch-manipulation shrink-0"
                >
                  Set Annotation
                </button>
                {currentNote.annotation && (
                  <button
                    type="button"
                    onClick={() => {
                      onSetAnnotation('');
                      showNotice('Cleared annotation');
                    }}
                    className="px-3 py-2 bg-zinc-200 hover:bg-rose-100 hover:text-rose-700 dark:bg-zinc-800 dark:hover:bg-rose-950/50 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[40px] shadow-2xs active:scale-95 touch-manipulation shrink-0"
                    title="Clear annotation"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
