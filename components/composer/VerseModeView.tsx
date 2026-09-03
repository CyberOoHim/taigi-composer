'use client';

import React from 'react';
import { JianpuNote, KeySignature, LyricDisplayMode, NoteDuration, PitchNumber, VerseItem, VerseNoteRef } from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import { isNonNotationItem, isPunctuationOrSpacer } from '@/lib/taigiUtils';
import { scrollToCardElement } from '@/lib/utils';
import { NoteCell } from './NoteCell';
import { NoteEditorHud } from './NoteEditorHud';
import { Play, Square, Plus, MessageSquareQuote, ChevronLeft, ChevronRight } from 'lucide-react';

interface VerseModeViewProps {
  verses: VerseItem[];
  selectedMeasureIndex: number | null;
  selectedNoteIndex: number | null;
  currentNote: JianpuNote | null;
  keySignature: KeySignature;
  audioEngine: AudioEngine;
  playingVerseIdx: number | null;
  activePlaybackNoteId: string | null;
  displayMode: LyricDisplayMode;
  verseBatchTexts: { [vIdx: number]: string };
  onSetVerseBatchTexts: React.Dispatch<React.SetStateAction<{ [vIdx: number]: string }>>;
  onSelectNote: (mIdx: number, nIdx: number) => void;
  onTogglePlayVerse: (vIdx: number, verseNotes: VerseNoteRef[]) => void;
  onAddNoteToVerseEnd: (verse: VerseItem) => void;
  onDistributeVerseLyrics: (verse: VerseItem, vIdx: number) => void;
  onInsertPunctuationToNote: (punct: string) => void;
  onUpdateLyric: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom', val: string) => void;
  onGoToNextNote: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom') => void;
  onGoToPrevNote: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom') => void;
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
}

export const VerseModeView: React.FC<VerseModeViewProps> = React.memo(({
  verses,
  selectedMeasureIndex,
  selectedNoteIndex,
  currentNote,
  keySignature,
  audioEngine,
  playingVerseIdx,
  activePlaybackNoteId,
  displayMode,
  verseBatchTexts,
  onSetVerseBatchTexts,
  onSelectNote,
  onTogglePlayVerse,
  onAddNoteToVerseEnd,
  onDistributeVerseLyrics,
  onInsertPunctuationToNote,
  onUpdateLyric,
  onGoToNextNote,
  onGoToPrevNote,
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
}) => {
  return (
    <div id="verse-mode-container" className="flex flex-col gap-6">
      {verses.map((verse, vIdx) => {
        const isPlayingThisVerse = playingVerseIdx === vIdx;
        const hasSelectedNoteInVerse = verse.notes.some(
          item =>
            item.measureIndex === selectedMeasureIndex &&
            item.noteIndex === selectedNoteIndex
        );

        return (
          <div
            key={`verse-card-${verse.id}-${vIdx}`}
            id={`verse-card-${vIdx}`}
            onClick={() => {
              const firstContentNote = verse.notes.find(
                n => !isNonNotationItem(n.note) && (typeof n.note.pitch === 'number' && n.note.pitch > 0 || Boolean(n.note.lyric.hanji && !isPunctuationOrSpacer(n.note.lyric.hanji)))
              ) || verse.notes[0];
              if (firstContentNote) {
                onSelectNote(firstContentNote.measureIndex, firstContentNote.noteIndex);
              }
            }}
            className={`flex flex-col p-4 sm:p-5 rounded-2xl border transition-all duration-200 shadow-xs cursor-pointer scroll-mt-28 sm:scroll-mt-32 ${
              isPlayingThisVerse
                ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-500/10 dark:bg-amber-950/30 shadow-md'
                : hasSelectedNoteInVerse
                ? 'border-amber-400/80 dark:border-amber-500/60 bg-amber-50/15 dark:bg-[#161922]'
                : 'border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-[#141720]'
            }`}
          >
            {/* Verse Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-zinc-200/80 dark:border-zinc-800 text-xs">
              {/* Left: Dedicated Play Button & Verse Info */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  id={`verse-play-btn-${vIdx}`}
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onTogglePlayVerse(vIdx, verse.notes);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer touch-manipulation min-h-[40px] ${
                    isPlayingThisVerse
                      ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 animate-pulse font-black'
                      : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                  }`}
                  title={`Play Verse #${vIdx + 1}`}
                >
                  {isPlayingThisVerse ? (
                    <>
                      <Square className="w-4 h-4 fill-current text-zinc-950" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Play Verse #{vIdx + 1}</span>
                    </>
                  )}
                </button>

                {/* Previous / Next Verse Switcher */}
                <div className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] rounded-xl border border-zinc-200/90 dark:border-zinc-700 p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      if (vIdx > 0) {
                        const prevVerse = verses[vIdx - 1];
                        const target = prevVerse.notes[0];
                        if (target) onSelectNote(target.measureIndex, target.noteIndex);
                        scrollToCardElement(`verse-card-${vIdx - 1}`);
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
                        const target = nextVerse.notes[0];
                        if (target) onSelectNote(target.measureIndex, target.noteIndex);
                        scrollToCardElement(`verse-card-${vIdx + 1}`);
                      }
                    }}
                    disabled={vIdx === verses.length - 1}
                    className="p-1.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center transition-all"
                    title="Next Verse"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

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
              </div>
            </div>

            {/* WYSIWYG JIANPU SCORE ROW WITH MEASURE DIVIDERS */}
            <div
              className="flex items-stretch overflow-x-auto pb-3 pt-1 gap-2 sm:gap-2.5"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {verse.notes.map((item, itemIdx) => {
                const isSelected = selectedMeasureIndex === item.measureIndex && selectedNoteIndex === item.noteIndex;
                const isPlaybackActive = activePlaybackNoteId === item.note.id;

                return (
                  <React.Fragment key={`v-frag-${item.measureIndex}-${item.noteIndex}-${itemIdx}`}>
                    {item.isFirstInMeasure && (
                      <div
                        className="flex flex-col items-center justify-center px-2 py-1.5 text-zinc-400 dark:text-zinc-500 font-mono text-[10px] select-none shrink-0 self-stretch rounded-xl bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60"
                        title={`Measure #${item.measureNumber}`}
                      >
                        <span className="font-bold text-zinc-600 dark:text-zinc-400">#{item.measureNumber}</span>
                        <div className="w-[2px] flex-1 bg-zinc-300 dark:bg-zinc-600 my-1 rounded-full" />
                        {item.chord && (
                          <span className="font-bold text-amber-600 dark:text-amber-400 text-[10px]">
                            {item.chord}
                          </span>
                        )}
                      </div>
                    )}
                    <NoteCell
                      note={item.note}
                      mIdx={item.measureIndex}
                      nIdx={item.noteIndex}
                      isSelected={isSelected}
                      isPlaybackActive={isPlaybackActive}
                      displayMode={displayMode}
                      onSelectNote={onSelectNote}
                      onUpdateLyric={onUpdateLyric}
                      onGoToNextNote={onGoToNextNote}
                      onGoToPrevNote={onGoToPrevNote}
                      keyPrefix={`v-${vIdx}-`}
                    />
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
                  onUpdateSelectedNote={onUpdateSelectedNote}
                  onSetPitch={onSetPitch}
                  onSetOctave={onSetOctave}
                  onSetAccidental={onSetAccidental}
                  onSetDuration={onSetDuration}
                  onToggleDotted={onToggleDotted}
                  onToggleTie={onToggleTie}
                  onInsertPunctuation={onInsertPunctuation}
                  onInsertAnnotation={onInsertAnnotation}
                  onSetAnnotation={onSetAnnotation}
                  onInsertNoteAt={onInsertNoteAt}
                  onDeleteNoteAt={onDeleteNoteAt}
                  onSplitMeasureBeforeNote={(m, n) => {
                    if (onSplitMeasureAtNote) onSplitMeasureAtNote(m, n);
                  }}
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
                />
              </div>
            )}

            {/* Verse-Wide Batch Lyric & Punctuation Helper Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 shrink-0 flex items-center gap-1">
                  <MessageSquareQuote className="w-3.5 h-3.5" />
                  <span>Batch Lyric Fill:</span>
                </span>
                <input
                  type="text"
                  value={verseBatchTexts[vIdx] || ''}
                  onChange={e =>
                    onSetVerseBatchTexts(prev => ({ ...prev, [vIdx]: e.target.value }))
                  }
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onDistributeVerseLyrics(verse, vIdx);
                    }
                  }}
                  placeholder={`Enter full lyrics for Verse ${vIdx + 1} (e.g. To̍k iā bô phōaⁿ...)`}
                  className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => onDistributeVerseLyrics(verse, vIdx)}
                  disabled={!(verseBatchTexts[vIdx] || '').trim()}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl text-xs transition-colors shrink-0 shadow-xs cursor-pointer touch-manipulation min-h-[38px]"
                >
                  Distribute to Verse
                </button>
              </div>

              {/* Quick Punctuation Break chips */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0 flex-wrap">
                <span className="text-[11px] font-medium hidden sm:inline">Punctuation:</span>
                {['，', '。', '！', '？', '、', '—', '…'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onInsertPunctuationToNote(p)}
                    disabled={selectedMeasureIndex === null || selectedNoteIndex === null}
                    className="w-7 h-7 flex items-center justify-center bg-zinc-100 hover:bg-amber-100 dark:bg-zinc-800 dark:hover:bg-amber-950/70 text-zinc-800 dark:text-zinc-200 hover:text-amber-800 dark:hover:text-amber-200 rounded-lg font-mono font-bold border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-30 cursor-pointer touch-manipulation active:scale-95"
                    title={`Insert punctuation "${p}" to selected note`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

VerseModeView.displayName = 'VerseModeView';
