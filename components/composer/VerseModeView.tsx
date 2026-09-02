'use client';

import React from 'react';
import { JianpuNote, KeySignature, LyricDisplayMode, NoteDuration, PitchNumber, VerseItem, VerseNoteRef } from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import { isNonNotationItem, isPunctuationOrSpacer } from '@/lib/taigiUtils';
import { NoteCell } from './NoteCell';
import { NoteEditorHud } from './NoteEditorHud';
import { Play, Square, Plus, MessageSquareQuote } from 'lucide-react';

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
  showNotice: (msg: string) => void;
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
  showNotice,
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
            className={`flex flex-col p-4 sm:p-5 rounded-2xl border transition-all duration-200 shadow-xs cursor-pointer ${
              isPlayingThisVerse
                ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-50/60 dark:bg-amber-950/40 shadow-md'
                : hasSelectedNoteInVerse
                ? 'border-amber-400 dark:border-amber-600/90 bg-amber-50/20 dark:bg-amber-950/20'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/95'
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
                  title={`試聽第 ${vIdx + 1} 句 (Play Verse #${vIdx + 1})`}
                >
                  {isPlayingThisVerse ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current text-zinc-950" />
                      <span>停止試聽</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>試聽第 {vIdx + 1} 句</span>
                    </>
                  )}
                </button>

                <span className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 font-black font-mono text-xs border border-amber-300/60 dark:border-amber-700/60">
                  第 {vIdx + 1} 句
                </span>

                {verse.section && (
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                    {verse.section}
                  </span>
                )}

                <span className="text-zinc-600 dark:text-zinc-400 text-xs font-medium">
                  涵蓋小節 #{verse.startMeasureNumber} ~ #{verse.endMeasureNumber} (共 {verse.notes.length} 音)
                </span>

                {verse.chords.length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-xs bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800/60">
                    和弦: {verse.chords.join(' → ')}
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
                  title="在此句尾端增加一個音符"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>句末加音符</span>
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
                        title={`第 ${item.measureNumber} 小節`}
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
                  onNavigateNextNote={onNavigateNextNote}
                  onNavigatePrevNote={onNavigatePrevNote}
                  autoStepAdvance={autoStepAdvance}
                  onToggleAutoStepAdvance={onToggleAutoStepAdvance}
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
                  <span>整句填詞:</span>
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
                  placeholder={`輸入第 ${vIdx + 1} 句完整歌詞 (如: 獨夜無伴守燈下， 或 To̍k iā bô phōaⁿ...)`}
                  className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => onDistributeVerseLyrics(verse, vIdx)}
                  disabled={!(verseBatchTexts[vIdx] || '').trim()}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl text-xs transition-colors shrink-0 shadow-xs cursor-pointer touch-manipulation min-h-[38px]"
                >
                  分配至此句
                </button>
              </div>

              {/* Quick Punctuation Break chips */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0 flex-wrap">
                <span className="text-[11px] font-medium hidden sm:inline">插入標點:</span>
                {['，', '。', '！', '？', '、', '—', '…'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onInsertPunctuationToNote(p)}
                    disabled={selectedMeasureIndex === null || selectedNoteIndex === null}
                    className="w-7 h-7 flex items-center justify-center bg-zinc-100 hover:bg-amber-100 dark:bg-zinc-800 dark:hover:bg-amber-950/70 text-zinc-800 dark:text-zinc-200 hover:text-amber-800 dark:hover:text-amber-200 rounded-lg font-mono font-bold border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-30 cursor-pointer touch-manipulation active:scale-95"
                    title={`為選取的音符插入標點「${p}」`}
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
