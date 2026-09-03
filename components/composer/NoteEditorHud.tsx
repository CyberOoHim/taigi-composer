'use client';

import React, { useState } from 'react';
import { JianpuNote, KeySignature, NoteDuration, PitchNumber } from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import {
  getDurationChineseInfo,
  PUNCTUATION_MARKS,
  ANNOTATION_MARKS,
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
} from 'lucide-react';

export type DeckTabMode = 'numpad' | 'piano' | 'lyrics';

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
  onInsertPunctuation: (punct: string) => void;
  onInsertAnnotation: (annot: string) => void;
  onSetAnnotation: (annot: string) => void;
  onInsertNoteAt: (mIdx: number, nIdx: number) => void;
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
  onInsertPunctuation,
  onInsertAnnotation,
  onSetAnnotation,
  onInsertNoteAt,
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
  const pitchLabel =
    currentNote.pitch === 0
      ? '0 (Rest)'
      : currentNote.pitch === 'empty'
      ? '␣ (Empty / Punctuation)'
      : `${currentNote.accidental || ''}${currentNote.pitch}${
          currentNote.octave > 0
            ? '̇'.repeat(currentNote.octave)
            : currentNote.octave < 0
            ? '̣'.repeat(Math.abs(currentNote.octave))
            : ''
        }`;

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

          <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
            <span className="daw-lcd text-sm px-3 py-1 rounded-lg font-mono font-bold shadow-xs">
              {pitchLabel}
            </span>
            <span className="text-zinc-600 dark:text-zinc-300 font-medium">
              {durationInfo.beatsLabel} ({durationInfo.name})
            </span>
          </div>

          {currentNote.isTied && (
            <span className="text-xs bg-amber-400/20 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-md font-bold border border-amber-400/40">
              Tie ⌒
            </span>
          )}

          {currentNote.annotation && (
            <span className="text-xs bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-md font-bold border border-indigo-400/30">
              {currentNote.annotation}
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
                onClick={() => setActiveTab('lyrics')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  activeTab === 'lyrics'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <MessageSquareQuote className="w-4 h-4" />
                <span>Punctuation &amp; Annotations</span>
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

              {/* Row 2: Duration & Articulation Row */}
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
                    { label: '0.75 beats', dur: 0.75 },
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

                  {/* Toggle Tie */}
                  <button
                    type="button"
                    onClick={onToggleTie}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                      currentNote.isTied
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 ring-2 ring-amber-400 font-black shadow-xs'
                        : 'border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 shadow-2xs'
                    }`}
                  >
                    ⌒ Tie
                  </button>
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

          {/* TAB 3: LYRICS & ANNOTATIONS */}
          {activeTab === 'lyrics' && (
            <div className="flex flex-col gap-3.5">
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
                      className="min-w-[44px] h-11 px-2.5 rounded-xl bg-zinc-100 hover:bg-amber-100 dark:bg-[#0a0c10] dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono font-black text-sm border border-zinc-200/90 dark:border-zinc-700/80 transition-all active:scale-95 flex items-center justify-center shadow-2xs cursor-pointer touch-manipulation"
                    >
                      {p.label === ' ' ? '␣ Space' : p.label}
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
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
