'use client';

import React from 'react';
import { LyricDisplayMode, Song } from '@/types/song';
import { NoteCell } from './NoteCell';
import { Play, Square, Plus, Copy, Trash2 } from 'lucide-react';

interface MeasureModeViewProps {
  song: Song;
  selectedMeasureIndex: number | null;
  selectedNoteIndex: number | null;
  playingMeasureIdx: number | null;
  activePlaybackNoteId: string | null;
  displayMode: LyricDisplayMode;
  measureBatchTexts: { [mIdx: number]: string };
  onSetMeasureBatchTexts: React.Dispatch<React.SetStateAction<{ [mIdx: number]: string }>>;
  onSelectNote: (mIdx: number, nIdx: number) => void;
  onTogglePlayMeasure: (mIdx: number) => void;
  onAddNoteToMeasure: (mIdx: number) => void;
  onDuplicateMeasure: (mIdx: number) => void;
  onDeleteMeasure: (mIdx: number) => void;
  onUpdateMeasureSection: (mIdx: number, section: string) => void;
  onUpdateMeasureChord: (mIdx: number, chord: string) => void;
  onDistributeMeasureLyrics: (mIdx: number) => void;
  onUpdateLyric: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom', val: string) => void;
  onGoToNextNote: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom') => void;
  onGoToPrevNote: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom') => void;
}

export const MeasureModeView: React.FC<MeasureModeViewProps> = ({
  song,
  selectedMeasureIndex,
  selectedNoteIndex,
  playingMeasureIdx,
  activePlaybackNoteId,
  displayMode,
  measureBatchTexts,
  onSetMeasureBatchTexts,
  onSelectNote,
  onTogglePlayMeasure,
  onAddNoteToMeasure,
  onDuplicateMeasure,
  onDeleteMeasure,
  onUpdateMeasureSection,
  onUpdateMeasureChord,
  onDistributeMeasureLyrics,
  onUpdateLyric,
  onGoToNextNote,
  onGoToPrevNote,
}) => {
  return (
    <div id="measure-mode-container" className="flex flex-col gap-6">
      {song.measures.map((measure, mIdx) => {
        const isSelectedMeasure = selectedMeasureIndex === mIdx;
        const isPlayingThisMeasure = playingMeasureIdx === mIdx;

        return (
          <div
            key={measure.id}
            id={`measure-card-${mIdx}`}
            className={`flex flex-col p-4 sm:p-5 rounded-2xl border transition-all duration-200 shadow-xs ${
              isPlayingThisMeasure
                ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-50/60 dark:bg-amber-950/40 shadow-md'
                : isSelectedMeasure
                ? 'border-amber-400 dark:border-amber-600/90 bg-amber-50/20 dark:bg-amber-950/20'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/95'
            }`}
          >
            {/* Measure Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-zinc-200/80 dark:border-zinc-800 text-xs">
              {/* Left: Dedicated Play Button & Measure Info */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  id={`measure-play-btn-${mIdx}`}
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onTogglePlayMeasure(mIdx);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer touch-manipulation min-h-[40px] ${
                    isPlayingThisMeasure
                      ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 animate-pulse font-black'
                      : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                  }`}
                  title={`試聽第 ${mIdx + 1} 小節 (Play Measure #${mIdx + 1})`}
                >
                  {isPlayingThisMeasure ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current text-zinc-950" />
                      <span>停止試聽</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>試聽第 {mIdx + 1} 小節</span>
                    </>
                  )}
                </button>

                <span className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold flex items-center justify-center font-mono text-xs border border-zinc-200 dark:border-zinc-700">
                  #{mIdx + 1}
                </span>

                {/* Section Selector */}
                <select
                  id={`measure-section-select-${mIdx}`}
                  value={measure.section || ''}
                  onChange={e => onUpdateMeasureSection(mIdx, e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold rounded-xl px-2.5 py-2 text-xs cursor-pointer min-h-[38px]"
                  title="段落標籤"
                >
                  <option value="">無段落標記</option>
                  <option value="前奏">前奏 (Intro)</option>
                  <option value="主歌 A">主歌 A (Verse 1)</option>
                  <option value="主歌 B">主歌 B (Verse 2)</option>
                  <option value="導歌">導歌 (Pre-Chorus)</option>
                  <option value="副歌">副歌 (Chorus)</option>
                  <option value="間奏">間奏 (Interlude)</option>
                  <option value="尾奏">尾奏 (Outro)</option>
                </select>

                {/* Chord Selector */}
                <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-xs min-h-[38px]">
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">和弦:</span>
                  <select
                    id={`measure-chord-select-${mIdx}`}
                    value={measure.chord || ''}
                    onChange={e => onUpdateMeasureChord(mIdx, e.target.value)}
                    className="bg-transparent font-bold text-amber-600 dark:text-amber-400 focus:outline-hidden text-xs cursor-pointer"
                  >
                    <option value="">無和弦</option>
                    {['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'G7', 'C7', 'Fm', 'A', 'D', 'E', 'Bb'].map(
                      c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* Right: Quick Measure Actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Add note to this measure */}
                <button
                  id={`measure-add-note-btn-${mIdx}`}
                  type="button"
                  onClick={() => onAddNoteToMeasure(mIdx)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl font-bold text-xs border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer touch-manipulation min-h-[40px]"
                  title="在此小節尾端增加一個音符"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>加音符</span>
                </button>

                {/* Duplicate measure */}
                <button
                  id={`measure-duplicate-btn-${mIdx}`}
                  type="button"
                  onClick={() => onDuplicateMeasure(mIdx)}
                  className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer touch-manipulation min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="複製此小節"
                >
                  <Copy className="w-4 h-4" />
                </button>

                {/* Delete measure */}
                <button
                  id={`measure-delete-btn-${mIdx}`}
                  type="button"
                  onClick={() => onDeleteMeasure(mIdx)}
                  className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer touch-manipulation min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="刪除此小節"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* THE WYSIWYG JIANPU SCORE ROW */}
            <div
              className="flex items-stretch overflow-x-auto pb-3 pt-1 gap-2 sm:gap-3"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {measure.notes.map((note, nIdx) => {
                const isSelected = selectedMeasureIndex === mIdx && selectedNoteIndex === nIdx;
                const isPlaybackActive = activePlaybackNoteId === note.id;

                return (
                  <NoteCell
                    key={`m-${mIdx}-${note.id}-${nIdx}`}
                    note={note}
                    mIdx={mIdx}
                    nIdx={nIdx}
                    isSelected={isSelected}
                    isPlaybackActive={isPlaybackActive}
                    displayMode={displayMode}
                    onSelectNote={onSelectNote}
                    onUpdateLyric={onUpdateLyric}
                    onGoToNextNote={onGoToNextNote}
                    onGoToPrevNote={onGoToPrevNote}
                    keyPrefix={`m-${mIdx}-`}
                  />
                );
              })}
            </div>

            {/* Quick Measure-Wide Batch Lyric Input Row */}
            <div className="flex items-center gap-2 pt-3 mt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 shrink-0">
                整小節快速填詞:
              </span>
              <input
                type="text"
                value={measureBatchTexts[mIdx] || ''}
                onChange={e =>
                  onSetMeasureBatchTexts(prev => ({ ...prev, [mIdx]: e.target.value }))
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onDistributeMeasureLyrics(mIdx);
                  }
                }}
                placeholder={`輸入第 ${mIdx + 1} 小節完整歌詞 (如: 獨夜無伴 或 To̍k iā bô phōaⁿ)`}
                className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-zinc-800"
              />
              <button
                type="button"
                onClick={() => onDistributeMeasureLyrics(mIdx)}
                disabled={!(measureBatchTexts[mIdx] || '').trim()}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl text-xs transition-colors shrink-0 shadow-xs cursor-pointer touch-manipulation min-h-[38px]"
              >
                分配至此小節
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
