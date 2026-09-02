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
      ? '0 (休止符)'
      : currentNote.pitch === 'empty'
      ? '␣ (空白/標點)'
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
          ? 'my-3 bg-gradient-to-b from-amber-50/95 via-amber-100/30 to-amber-50/80 dark:from-zinc-800/95 dark:via-zinc-800/60 dark:to-zinc-900/90 border-2 border-amber-400 dark:border-amber-600/70 rounded-2xl shadow-md'
          : 'sticky top-[68px] z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-2 border-amber-500 rounded-2xl shadow-xl'
      }`}
    >
      {/* Top Header Bar: Note Summary & Instant Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-amber-100/70 dark:bg-amber-950/50 border-b border-amber-200 dark:border-zinc-800 text-xs">
        {/* Selected Note Badge & Info */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 bg-amber-500 text-zinc-950 rounded-lg font-black font-mono text-xs shadow-2xs flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>#{selectedMeasureIndex + 1}.{(selectedNoteIndex ?? 0) + 1}</span>
          </span>

          <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
            <span className="text-amber-800 dark:text-amber-200 font-mono text-sm bg-amber-200/80 dark:bg-amber-900/80 px-2.5 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700">
              {pitchLabel}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
              {durationInfo.beatsLabel} ({durationInfo.name})
            </span>
          </div>

          {currentNote.isTied && (
            <span className="text-[11px] bg-amber-300 dark:bg-amber-900 text-amber-950 dark:text-amber-100 px-2 py-0.5 rounded-md font-bold border border-amber-400 dark:border-amber-700">
              延音 ⌒
            </span>
          )}

          {currentNote.annotation && (
            <span className="text-[11px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-md font-bold border border-indigo-200 dark:border-indigo-800">
              {currentNote.annotation}
            </span>
          )}
        </div>

        {/* Action Tools & Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Quick Audition Button */}
          <button
            type="button"
            onClick={() => audioEngine.previewNote(keySignature, currentNote)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
            title="試聽單音 (Play Note)"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>試聽</span>
          </button>

          {/* Prev / Next Note Quick Navigation */}
          {onNavigatePrevNote && onNavigateNextNote && (
            <div className="flex items-center bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={onNavigatePrevNote}
                className="p-1.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 cursor-pointer touch-manipulation min-h-[34px] min-w-[34px] flex items-center justify-center"
                title="選取上一個音符 (←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-3.5 bg-zinc-200 dark:bg-zinc-700" />
              <button
                type="button"
                onClick={onNavigateNextNote}
                className="p-1.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 cursor-pointer touch-manipulation min-h-[34px] min-w-[34px] flex items-center justify-center"
                title="選取下一個音符 (→)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Insert Note */}
          <button
            type="button"
            onClick={() => onInsertNoteAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
            title="在當前音符後插入新音符"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">插入音符</span>
          </button>

          {/* Delete Note */}
          <button
            type="button"
            onClick={() => onDeleteNoteAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
            className="p-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 text-rose-700 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900 text-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="刪除當前音符"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Undo / Redo if provided */}
          {onUndo && onRedo && (
            <div className="flex items-center bg-white dark:bg-zinc-800 p-0.5 rounded-xl border border-amber-300 dark:border-zinc-700">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title={canUndo ? `復原 (Undo) · 尚有 ${pastCount} 步` : '無可復原步驟'}
                className="p-1.5 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3.5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title={canRedo ? `重做 (Redo) · 尚有 ${futureCount} 步` : '無可重做步驟'}
                className="p-1.5 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-bold rounded-xl border border-amber-300 dark:border-amber-700 transition-all cursor-pointer min-h-[36px]"
            title={isCollapsed ? '展開編輯盤 (Expand Control Deck)' : '收合編輯盤 (Collapse Deck)'}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>展開</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>收合</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Deck View */}
      {!isCollapsed && (
        <div className="p-3.5 flex flex-col gap-3">
          {/* Deck Mode Tabs & Auto-Step Switch */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 dark:border-zinc-800 pb-2.5">
            {/* 3 Modular Tabs */}
            <div className="flex items-center bg-white/80 dark:bg-zinc-800 p-1 rounded-xl border border-amber-200 dark:border-zinc-700 text-xs font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('numpad')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer min-h-[34px] ${
                  activeTab === 'numpad'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>簡譜快選列 (Quick Bar)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('piano')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer min-h-[34px] ${
                  activeTab === 'piano'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>鋼琴鍵盤 (Piano Roll)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('lyrics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer min-h-[34px] ${
                  activeTab === 'lyrics'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <MessageSquareQuote className="w-3.5 h-3.5" />
                <span>標點與註解 (Lyrics/Notes)</span>
              </button>
            </div>

            {/* Auto-Step Next Note Mode Toggle */}
            {onToggleAutoStepAdvance && (
              <button
                type="button"
                onClick={onToggleAutoStepAdvance}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[34px] ${
                  autoStepAdvance
                    ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-xs'
                    : 'bg-white/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-amber-200 dark:border-zinc-700'
                }`}
                title="自動前進模式：點選音高後自動跳到下一個音符進行連續編寫"
              >
                <Zap className={`w-3.5 h-3.5 ${autoStepAdvance ? 'fill-current' : ''}`} />
                <span>連續輸入自動前進: {autoStepAdvance ? '開啟 (ON)' : '關閉 (OFF)'}</span>
              </button>
            )}
          </div>

          {/* TAB 1: QUICK BAR (簡譜快選列) */}
          {activeTab === 'numpad' && (
            <div className="flex flex-col gap-3">
              {/* Row 1: Pitches (1-7, 0, ␣) + Octaves + Accidentals */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Pitches (1-7, 0, ␣) */}
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-[280px]">
                  <span className="text-[11px] font-extrabold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider shrink-0 w-12">
                    音高:
                  </span>
                  <div className="flex items-center gap-1 flex-wrap flex-1">
                    {[1, 2, 3, 4, 5, 6, 7].map(p => {
                      const isCurrent = currentNote.pitch === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onSetPitch(p as PitchNumber)}
                          className={`flex-1 min-w-[38px] sm:min-w-[44px] h-11 rounded-xl font-mono text-lg font-black transition-all active:scale-95 cursor-pointer touch-manipulation flex items-center justify-center ${
                            isCurrent
                              ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md scale-105 font-black'
                              : 'bg-white dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 shadow-2xs'
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
                      className={`min-w-[46px] h-11 rounded-xl font-mono text-base font-bold transition-all active:scale-95 cursor-pointer touch-manipulation flex items-center justify-center gap-1 px-2 ${
                        currentNote.pitch === 0
                          ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md font-black'
                          : 'bg-white dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shadow-2xs'
                      }`}
                      title="休止符 0"
                    >
                      <span>0</span>
                      <span className="text-[10px] font-sans font-normal">休</span>
                    </button>

                    {/* Empty ␣ */}
                    <button
                      type="button"
                      onClick={() => onSetPitch('empty')}
                      className={`min-w-[46px] h-11 rounded-xl font-mono text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation flex items-center justify-center gap-1 px-2 border-dashed ${
                        currentNote.pitch === 'empty'
                          ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md font-black border-amber-400'
                          : 'bg-white/80 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600 shadow-2xs'
                      }`}
                      title="空白 / 標點符號留白 (Empty)"
                    >
                      <span>␣ 空</span>
                    </button>
                  </div>
                </div>

                {/* Octave & Accidental Controls in single line */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Octave */}
                  <div className="flex items-center bg-white dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xs text-xs">
                    <button
                      type="button"
                      onClick={() => onSetOctave(-1)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[34px] ${
                        currentNote.octave === -1
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                      title="低音 (下方一點 5̣)"
                    >
                      低音 5̣
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSelectedNote(n => ({ ...n, octave: 0 }))}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[34px] ${
                        currentNote.octave === 0
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                      title="中音 (正常 5)"
                    >
                      中音 5
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetOctave(1)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[34px] ${
                        currentNote.octave === 1
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                      title="高音 (上方一點 5̇)"
                    >
                      高音 5̇
                    </button>
                  </div>

                  {/* Accidentals */}
                  <div className="flex items-center bg-white dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xs text-xs">
                    <button
                      type="button"
                      onClick={() => onSetAccidental('#')}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[34px] ${
                        currentNote.accidental === '#'
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                      title="升音記號 ♯"
                    >
                      ♯ 升
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetAccidental('b')}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[34px] ${
                        currentNote.accidental === 'b'
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                      title="降音記號 ♭"
                    >
                      ♭ 降
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Duration & Articulation Row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider shrink-0 w-12">
                  拍數:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {[
                    { label: '1 拍', dur: 1 },
                    { label: '0.5 拍 (半拍)', dur: 0.5 },
                    { label: '1.5 拍 (附點)', dur: 1.5 },
                    { label: '0.25 拍 (¼拍)', dur: 0.25 },
                    { label: '0.75 拍', dur: 0.75 },
                    { label: '2 拍 (二分)', dur: 2 },
                    { label: '3 拍 (附點二分)', dur: 3 },
                    { label: '4 拍 (全音)', dur: 4 },
                  ].map(d => (
                    <button
                      key={d.dur}
                      type="button"
                      onClick={() => onSetDuration(d.dur as NoteDuration)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[36px] ${
                        currentNote.duration === d.dur
                          ? 'bg-amber-500 text-zinc-950 font-black shadow-xs ring-2 ring-amber-400'
                          : 'bg-white dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-2xs'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}

                  {/* Toggle Dotted */}
                  <button
                    type="button"
                    onClick={onToggleDotted}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[36px] ${
                      currentNote.isDotted
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 ring-2 ring-amber-400 font-black'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-2xs'
                    }`}
                  >
                    · 附點 (Dot)
                  </button>

                  {/* Toggle Tie */}
                  <button
                    type="button"
                    onClick={onToggleTie}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[36px] ${
                      currentNote.isTied
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 ring-2 ring-amber-400 font-black'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-2xs'
                    }`}
                  >
                    ⌒ 延音線 (Tie)
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
                  <span>互動鋼琴鍵盤 (Piano Roll)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsPianoCollapsed(prev => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
                  title={isPianoCollapsed ? '展開鋼琴琴鍵' : '收合鋼琴琴鍵'}
                >
                  {isPianoCollapsed ? (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                      <span>展開鋼琴</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 text-amber-500" />
                      <span>收合鋼琴</span>
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
                    <span>鋼琴琴鍵已收合（點擊此處或右上角按鈕即可展開）</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LYRICS & ANNOTATIONS */}
          {activeTab === 'lyrics' && (
            <div className="flex flex-col gap-3">
              {/* Punctuation Row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1 shrink-0 w-24">
                  <MessageSquareQuote className="w-3.5 h-3.5" /> 標點填入:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {PUNCTUATION_MARKS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => onInsertPunctuation(p.char)}
                      title={`填入標點 ${p.label} (${p.desc})`}
                      className="min-w-[40px] h-10 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900 text-amber-950 dark:text-amber-200 font-mono font-black text-sm border border-amber-200 dark:border-amber-800 transition-all active:scale-95 flex items-center justify-center shadow-2xs cursor-pointer touch-manipulation"
                    >
                      {p.label === ' ' ? '␣ 空白' : p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Performance Annotations */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1 shrink-0 w-24">
                  <FileText className="w-3.5 h-3.5" /> 常用註解:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {ANNOTATION_MARKS.map(ann => (
                    <button
                      key={ann.label}
                      type="button"
                      onClick={() => onInsertAnnotation(ann.text)}
                      title={`填入註解 ${ann.label} (${ann.desc})`}
                      className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-950 dark:text-indigo-200 font-semibold text-xs border border-indigo-200 dark:border-indigo-800 transition-all active:scale-95 whitespace-nowrap shadow-2xs cursor-pointer touch-manipulation min-h-[38px]"
                    >
                      {ann.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Annotation Input */}
              <div className="flex items-center gap-2 pt-2 border-t border-amber-200 dark:border-zinc-800 text-xs">
                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 shrink-0">自訂註解:</span>
                <input
                  type="text"
                  placeholder="如: (副歌前/男聲獨唱/自由節奏)..."
                  value={currentNote.annotation || ''}
                  onChange={e => onSetAnnotation(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    onSetPitch('empty');
                    showNotice('已設定自訂註解並將音高設為留白 (Empty)');
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[38px] shadow-2xs"
                >
                  設為留白註解
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
