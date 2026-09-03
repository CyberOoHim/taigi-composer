'use client';

import React, { useState } from 'react';
import { BarlineType, JianpuNote, KeySignature, LyricDisplayMode, NoteDuration, PitchNumber, Song } from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import { scrollToCardElement } from '@/lib/utils';
import {
  calculateMeasureBeats,
  getExpectedMeasureBeats,
  getDiatonicChords,
  getMeasureRhythmReport,
  getNoteBeatDuration,
} from '@/lib/taigiUtils';
import { NoteCell } from './NoteCell';
import { NoteEditorHud } from './NoteEditorHud';
import {
  Play,
  Square,
  Plus,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Scissors,
  Merge,
  Wand2,
} from 'lucide-react';

interface MeasureModeViewProps {
  song: Song;
  selectedMeasureIndex: number | null;
  selectedNoteIndex: number | null;
  currentNote: JianpuNote | null;
  keySignature: KeySignature;
  audioEngine: AudioEngine;
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

  // Measure adjustment & line editing extensions
  onSplitMeasureAtNote?: (mIdx: number, splitAtIndex: number) => void;
  onMergeWithNextMeasure?: (mIdx: number) => void;
  onShiftNoteToNextMeasure?: (mIdx: number) => void;
  onPullNoteFromNextMeasure?: (mIdx: number) => void;
  onMoveMeasureOrder?: (fromIdx: number, toIdx: number) => void;
  onToggleLineBreak?: (mIdx: number) => void;
  onUpdateBarlineType?: (mIdx: number, barlineType: BarlineType) => void;
  onAutoFillRest?: (mIdx: number) => void;
  onTrimExcessNotes?: (mIdx: number) => void;
}

export const MeasureModeView: React.FC<MeasureModeViewProps> = React.memo(({
  song,
  selectedMeasureIndex,
  selectedNoteIndex,
  currentNote,
  keySignature,
  audioEngine,
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
  onMergeWithNextMeasure,
  onShiftNoteToNextMeasure,
  onPullNoteFromNextMeasure,
  onMoveMeasureOrder,
  onToggleLineBreak,
  onUpdateBarlineType,
  onAutoFillRest,
  onTrimExcessNotes,
}) => {
  const [hoveredSplitIndex, setHoveredSplitIndex] = useState<string | null>(null);

  const cycleBarline = (mIdx: number, current: BarlineType = 'single') => {
    if (!onUpdateBarlineType) return;
    const styles: BarlineType[] = ['single', 'double', 'end', 'repeat_start', 'repeat_end'];
    const curIdx = styles.indexOf(current);
    const nextStyle = styles[(curIdx + 1) % styles.length];
    onUpdateBarlineType(mIdx, nextStyle);
  };

  return (
    <div id="measure-mode-container" className="flex flex-col gap-6">
      {song.measures.map((measure, mIdx) => {
        const isSelectedMeasure = selectedMeasureIndex === mIdx;
        const isPlayingThisMeasure = playingMeasureIdx === mIdx;
        const isFirstMeasure = mIdx === 0;
        const isLastMeasure = mIdx === song.measures.length - 1;

        const rhythm = getMeasureRhythmReport(measure, song.timeSignature || '4/4');
        const diatonicChords = getDiatonicChords(keySignature);
        const barlineStyle: BarlineType = measure.barlineType || 'single';

        return (
          <React.Fragment key={measure.id}>
            <div
              id={`measure-card-${mIdx}`}
              className={`flex flex-col p-4 sm:p-5 rounded-2xl border transition-all duration-200 shadow-xs scroll-mt-20 sm:scroll-mt-24 ${
                isPlayingThisMeasure
                  ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-50/60 dark:bg-amber-950/40 shadow-md'
                  : isSelectedMeasure
                  ? 'border-amber-400 dark:border-amber-600/90 bg-amber-50/20 dark:bg-amber-950/20'
                  : rhythm.isFull
                  ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/95'
                  : rhythm.isUnder
                  ? 'border-amber-300 dark:border-amber-800/70 bg-white dark:bg-zinc-900/95'
                  : 'border-rose-300 dark:border-rose-800/70 bg-white dark:bg-zinc-900/95'
              }`}
            >
              {/* Measure Header Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-zinc-200/80 dark:border-zinc-800 text-xs">
                {/* Left: Measure Play, Number Switcher, Relative Location & Beat Status */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Play Button */}
                  <button
                    id={`measure-play-btn-${mIdx}`}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onTogglePlayMeasure(mIdx);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer touch-manipulation min-h-[38px] ${
                      isPlayingThisMeasure
                        ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 animate-pulse font-black'
                        : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                    }`}
                    title={`試聽第 ${mIdx + 1} 小節 (Play Measure #${mIdx + 1})`}
                  >
                    {isPlayingThisMeasure ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current text-zinc-950" />
                        <span>停止</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>試聽</span>
                      </>
                    )}
                  </button>

                  {/* Previous / Next Measure Switcher */}
                  <div className="flex items-center bg-white dark:bg-zinc-800 rounded-xl border border-amber-300 dark:border-zinc-700 p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (mIdx > 0) {
                          onSelectNote(mIdx - 1, 0);
                          scrollToCardElement(`measure-card-${mIdx - 1}`);
                        }
                      }}
                      disabled={mIdx === 0}
                      className="p-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-amber-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center transition-all"
                      title="跳至上一小節"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2.5 py-1 bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 font-black font-mono text-xs rounded-lg mx-0.5">
                      #{mIdx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (mIdx < song.measures.length - 1) {
                          onSelectNote(mIdx + 1, 0);
                          scrollToCardElement(`measure-card-${mIdx + 1}`);
                        }
                      }}
                      disabled={mIdx === song.measures.length - 1}
                      className="p-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-amber-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center transition-all"
                      title="跳至下一小節"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Relative Measure Location (Move Earlier / Move Later) */}
                  {onMoveMeasureOrder && (
                    <div
                      className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xs"
                      title="調換小節相對位置 (Reorder measure)"
                    >
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onMoveMeasureOrder(mIdx, mIdx - 1);
                        }}
                        disabled={isFirstMeasure}
                        className="p-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="小節往前移一格 (Move earlier)"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onMoveMeasureOrder(mIdx, mIdx + 1);
                        }}
                        disabled={isLastMeasure}
                        className="p-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="小節往後移一格 (Move later)"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Smart Measure Beat-Count Badge & Quick Fix */}
                  <div className="flex items-center gap-1.5">
                    <div
                      id={`measure-beat-badge-${mIdx}`}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold border shadow-2xs select-none transition-all ${
                        rhythm.isFull
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
                          : rhythm.isUnder
                          ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 ring-1 ring-amber-400/60'
                          : 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800 ring-1 ring-rose-400/60'
                      }`}
                      title={
                        rhythm.isFull
                          ? `拍數完整 (${rhythm.currentBeats}/${rhythm.expectedBeats} 拍)`
                          : rhythm.isUnder
                          ? `小節不足拍：目前 ${rhythm.currentBeats} 拍，缺少 ${rhythm.absDiff} 拍`
                          : `小節超拍：目前 ${rhythm.currentBeats} 拍，超出 ${rhythm.absDiff} 拍`
                      }
                    >
                      {rhythm.isFull ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className={`w-3.5 h-3.5 ${rhythm.isUnder ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`} />
                      )}
                      <span>{rhythm.currentBeats}/{rhythm.expectedBeats}拍</span>
                      {!rhythm.isFull && (
                        <span className="text-[10px] font-sans font-medium opacity-85">
                          {rhythm.isUnder ? `(少${rhythm.absDiff}拍)` : `(多${rhythm.absDiff}拍)`}
                        </span>
                      )}
                    </div>

                    {/* Auto-fill Rest Quick Fix Button */}
                    {rhythm.isUnder && onAutoFillRest && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onAutoFillRest(mIdx);
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg text-[11px] shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[32px]"
                        title={`一鍵自動在小節末尾補滿 ${rhythm.absDiff} 拍休止符 (0)`}
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>補休止符 (+{rhythm.absDiff})</span>
                      </button>
                    )}

                    {/* Trim Excess Quick Fix Button */}
                    {rhythm.isOver && onTrimExcessNotes && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onTrimExcessNotes(mIdx);
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg text-[11px] shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[32px]"
                        title={`自動將超出 ${rhythm.absDiff} 拍的音符移至新小節`}
                      >
                        <Scissors className="w-3 h-3" />
                        <span>拆出超拍音符</span>
                      </button>
                    )}
                  </div>

                  {/* Section Selector */}
                  <select
                    id={`measure-section-select-${mIdx}`}
                    value={measure.section || ''}
                    onChange={e => onUpdateMeasureSection(mIdx, e.target.value)}
                    className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold rounded-xl px-2.5 py-1.5 text-xs cursor-pointer min-h-[36px]"
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
                  <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-xs min-h-[36px]">
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

                {/* Right: Line Break, Barline Type, Add Note, Duplicate, Delete */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Line Break Toggle */}
                  {onToggleLineBreak && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onToggleLineBreak(mIdx);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] ${
                        measure.isLineBreak
                          ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-600 shadow-xs'
                          : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                      }`}
                      title={measure.isLineBreak ? '已在此小節後設定換行 (Click to cancel)' : '設定此小節後換行 (Line break after this measure)'}
                    >
                      <CornerDownLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{measure.isLineBreak ? '已換行' : '換行'}</span>
                    </button>
                  )}

                  {/* Barline Type Selector */}
                  {onUpdateBarlineType && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        cycleBarline(mIdx, measure.barlineType);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer min-h-[36px]"
                      title="小節線樣式 (點擊切換: 單線 | 雙線 || 終止線 || 反覆起 |: 反覆訖 :|)"
                    >
                      <span>
                        {barlineStyle === 'single'
                          ? '| 單線'
                          : barlineStyle === 'double'
                          ? '|| 雙線'
                          : barlineStyle === 'end'
                          ? '|| 終止'
                          : barlineStyle === 'repeat_start'
                          ? '|: 反覆起'
                          : ':| 反覆訖'}
                      </span>
                    </button>
                  )}

                  {/* Add note to this measure */}
                  <button
                    id={`measure-add-note-btn-${mIdx}`}
                    type="button"
                    onClick={() => onAddNoteToMeasure(mIdx)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl font-bold text-xs border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer touch-manipulation min-h-[36px]"
                    title="在此小節尾端增加一個音符"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">加音符</span>
                  </button>

                  {/* Duplicate measure */}
                  <button
                    id={`measure-duplicate-btn-${mIdx}`}
                    type="button"
                    onClick={() => onDuplicateMeasure(mIdx)}
                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="複製此小節"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete measure */}
                  <button
                    id={`measure-delete-btn-${mIdx}`}
                    type="button"
                    onClick={() => onDeleteMeasure(mIdx)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="刪除此小節"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Visual Beat Meter / Rhythm Progress Strip */}
              <div
                id={`measure-beat-progress-${mIdx}`}
                className="mb-3 px-3 py-1.5 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center gap-3 text-[11px]"
              >
                <span className="font-bold text-zinc-500 dark:text-zinc-400 shrink-0">時值進度:</span>
                <div className="flex-1 h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden flex">
                  {/* Filled portion */}
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
                  {/* Deficit stripe if under */}
                  {rhythm.isUnder && (
                    <div
                      className="h-full bg-amber-300/40 dark:bg-amber-600/30 repeating-linear-stripes"
                      style={{
                        width: `${Math.max(0, 100 - (rhythm.currentBeats / rhythm.expectedBeats) * 100)}%`,
                      }}
                    />
                  )}
                </div>
                <span className="font-mono text-zinc-700 dark:text-zinc-300 font-bold shrink-0">
                  {rhythm.currentBeats} / {rhythm.expectedBeats} 拍
                  {rhythm.isUnder && <span className="text-amber-600 dark:text-amber-400 ml-1">(缺 {rhythm.absDiff})</span>}
                  {rhythm.isOver && <span className="text-rose-600 dark:text-rose-400 ml-1">(超 {rhythm.absDiff})</span>}
                  {rhythm.isFull && <span className="text-emerald-600 dark:text-emerald-400 ml-1">✓</span>}
                </span>
              </div>

              {/* One-Tap Diatonic Chord Palette */}
              <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 mb-3 bg-zinc-50/90 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/70 dark:border-zinc-800/70">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold shrink-0 ml-1">
                  {keySignature} 調順階和弦:
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {diatonicChords.map(c => {
                    const isCurrentChord = measure.chord === c.chord;
                    return (
                      <button
                        key={c.chord}
                        type="button"
                        onClick={() => {
                          onUpdateMeasureChord(mIdx, c.chord);
                          audioEngine.previewChord(c.chord);
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                          isCurrentChord
                            ? 'bg-amber-500 text-zinc-950 border-amber-600 ring-2 ring-amber-400 font-black'
                            : c.colorClass
                        }`}
                        title={`${c.label} (${c.degree}) - 點擊套用並試聽`}
                      >
                        <span>{c.chord}</span>
                        <span className="text-[9px] opacity-75 ml-0.5 font-normal">({c.degree})</span>
                      </button>
                    );
                  })}
                  {measure.chord && (
                    <button
                      type="button"
                      onClick={() => onUpdateMeasureChord(mIdx, '')}
                      className="px-2 py-1 rounded-lg text-[10px] text-zinc-500 hover:text-rose-600 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 cursor-pointer transition-colors shadow-2xs font-semibold"
                      title="清除此小節和弦"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>

              {/* THE WYSIWYG JIANPU SCORE ROW WITH INTERACTIVE BARLINES */}
              <div
                className="flex items-center overflow-x-auto pb-3 pt-1 gap-1.5 sm:gap-2 select-none"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {/* Opening Barline */}
                <div
                  className="flex flex-col items-center justify-center px-1.5 py-2 text-zinc-400 dark:text-zinc-600 font-mono text-[10px] shrink-0 self-stretch rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50"
                  title={`第 ${mIdx + 1} 小節起點`}
                >
                  <span className="font-black text-zinc-500 dark:text-zinc-400">#{mIdx + 1}</span>
                  <div className="w-[2px] flex-1 bg-zinc-300 dark:bg-zinc-600 my-1 rounded-full" />
                </div>

                {measure.notes.map((note, nIdx) => {
                  const isSelected = selectedMeasureIndex === mIdx && selectedNoteIndex === nIdx;
                  const isPlaybackActive = activePlaybackNoteId === note.id;
                  const splitHoverKey = `${mIdx}-${nIdx}`;

                  return (
                    <React.Fragment key={`m-${mIdx}-${note.id}-${nIdx}`}>
                      {/* Interactive In-between Split Barline (only between notes) */}
                      {nIdx > 0 && onSplitMeasureAtNote && (
                        <div
                          className="relative flex items-center justify-center group h-24 sm:h-28 px-0.5 cursor-pointer"
                          onMouseEnter={() => setHoveredSplitIndex(splitHoverKey)}
                          onMouseLeave={() => setHoveredSplitIndex(null)}
                          onClick={e => {
                            e.stopPropagation();
                            onSplitMeasureAtNote(mIdx, nIdx);
                          }}
                          title={`在此處拆分小節線 (Split Measure at note #${nIdx + 1})`}
                        >
                          <div className="w-[1.5px] h-16 bg-zinc-200 dark:bg-zinc-700 group-hover:bg-amber-500 transition-colors rounded-full" />
                          <button
                            type="button"
                            className={`absolute z-10 p-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-full shadow-md transition-all active:scale-95 ${
                              hoveredSplitIndex === splitHoverKey ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                            }`}
                            title="在此音符前插入小節線 (Split Measure)"
                          >
                            <Scissors className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <NoteCell
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
                    </React.Fragment>
                  );
                })}

                {/* Closing Barline Component & Cross-Measure Note Controls */}
                <div
                  id={`measure-closing-barline-${mIdx}`}
                  className="flex flex-col items-center justify-between p-1.5 ml-1 self-stretch rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shrink-0 min-w-[50px] shadow-2xs"
                >
                  {/* Visual Barline Glyphs */}
                  <div
                    onClick={() => cycleBarline(mIdx, measure.barlineType)}
                    className="flex items-center justify-center gap-0.5 py-1 px-1.5 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                    title="點擊切換小節線樣式"
                  >
                    {barlineStyle === 'single' && (
                      <div className="w-[2.5px] h-12 bg-zinc-800 dark:bg-zinc-200 rounded-full" />
                    )}
                    {barlineStyle === 'double' && (
                      <div className="flex gap-1 items-center">
                        <div className="w-[2px] h-12 bg-zinc-800 dark:bg-zinc-200 rounded-full" />
                        <div className="w-[2px] h-12 bg-zinc-800 dark:bg-zinc-200 rounded-full" />
                      </div>
                    )}
                    {barlineStyle === 'end' && (
                      <div className="flex gap-1 items-center">
                        <div className="w-[1.5px] h-12 bg-zinc-800 dark:bg-zinc-200 rounded-full" />
                        <div className="w-[4px] h-12 bg-zinc-800 dark:bg-zinc-200 rounded-full" />
                      </div>
                    )}
                    {barlineStyle === 'repeat_start' && (
                      <div className="flex items-center gap-1 font-black text-sm">
                        <div className="w-[3px] h-12 bg-zinc-800 dark:bg-zinc-200 rounded-full" />
                        <span className="font-mono text-zinc-800 dark:text-zinc-200 font-black">:</span>
                      </div>
                    )}
                    {barlineStyle === 'repeat_end' && (
                      <div className="flex items-center gap-1 font-black text-sm">
                        <span className="font-mono text-zinc-800 dark:text-zinc-200 font-black">:</span>
                        <div className="w-[3px] h-12 bg-zinc-800 dark:bg-zinc-200 rounded-full" />
                      </div>
                    )}
                  </div>

                  {/* Note Shift / Transfer Buttons between measures */}
                  <div className="flex flex-col gap-1 w-full pt-1 border-t border-zinc-200 dark:border-zinc-700 text-[10px]">
                    {/* Shift last note of this measure to next measure */}
                    {onShiftNoteToNextMeasure && measure.notes.length > 1 && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onShiftNoteToNextMeasure(mIdx);
                        }}
                        className="px-1 py-0.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded text-[10px] font-bold text-center cursor-pointer transition-colors"
                        title="將此小節末音推入下一小節 (Shift last note to next measure)"
                      >
                        推末音→
                      </button>
                    )}

                    {/* Pull first note of next measure into this measure */}
                    {onPullNoteFromNextMeasure && !isLastMeasure && song.measures[mIdx + 1]?.notes.length > 1 && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onPullNoteFromNextMeasure(mIdx);
                        }}
                        className="px-1 py-0.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded text-[10px] font-bold text-center cursor-pointer transition-colors"
                        title="從下小節借首音拉入此小節 (Pull next measure first note)"
                      >
                        ←借首音
                      </button>
                    )}

                    {/* Merge with next measure */}
                    {onMergeWithNextMeasure && !isLastMeasure && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onMergeWithNextMeasure(mIdx);
                        }}
                        className="px-1 py-0.5 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 rounded text-[10px] font-bold text-center cursor-pointer transition-colors flex items-center justify-center gap-0.5"
                        title="將此小節與下一個小節合併為一小節 (Merge with next measure)"
                      >
                        <Merge className="w-2.5 h-2.5" />
                        <span>合併</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* INTEGRATED IN-CARD NOTE EDITOR DECK */}
              {isSelectedMeasure && currentNote && selectedMeasureIndex !== null && (
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

            {/* Visual System Line Break Indicator */}
            {measure.isLineBreak && (
              <div className="flex items-center justify-center my-1">
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80 text-xs font-bold">
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  <span>第 {mIdx + 1} 小節後系統換行 (System Line Break)</span>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

MeasureModeView.displayName = 'MeasureModeView';
