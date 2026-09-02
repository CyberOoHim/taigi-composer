'use client';

import React from 'react';
import { JianpuNote, KeySignature, NoteDuration, PitchNumber } from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import {
  getDurationChineseInfo,
  PUNCTUATION_MARKS,
  ANNOTATION_MARKS,
} from '@/lib/taigiUtils';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import {
  Volume2,
  PlusCircle,
  Trash2,
  Undo2,
  Redo2,
  MessageSquareQuote,
  FileText,
} from 'lucide-react';

interface NoteEditorHudProps {
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
  onUndo?: () => boolean;
  onRedo?: () => boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  pastCount?: number;
  futureCount?: number;
  showNotice: (msg: string) => void;
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
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  pastCount = 0,
  futureCount = 0,
  showNotice,
}) => {
  return (
    <div
      id={`inline-note-hud-${selectedMeasureIndex}`}
      className="sticky top-[68px] z-30 p-3.5 bg-amber-50/95 dark:bg-zinc-900/95 backdrop-blur-md border-2 border-amber-500 dark:border-amber-500 rounded-2xl shadow-xl flex flex-col gap-2.5 animate-in fade-in duration-150"
    >
      {/* Top Header info and action tools */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 dark:border-zinc-700 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 bg-amber-500 text-zinc-950 rounded-md font-bold text-xs">
            音符 #{selectedMeasureIndex + 1}.{(selectedNoteIndex ?? 0) + 1}
          </span>
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            {getDurationChineseInfo(currentNote.duration).name} ({currentNote.duration} 拍)
          </span>
          {currentNote.isTied && (
            <span className="text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded font-bold">
              延音線 ⌒
            </span>
          )}
          <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium hidden sm:inline">
            (按數字鍵 1-7/0 切換音高 · 空白鍵試聽)
          </span>
        </div>

        {/* Audition & Note Insert / Delete / Undo / Redo */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onUndo && onRedo && (
            <div className="flex items-center bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-amber-300 dark:border-zinc-700 mr-1">
              <button
                id="hud-undo-btn"
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title={canUndo ? `復原 (Undo) [Ctrl+Z] · 尚有 ${pastCount} 步` : '無可復原步驟'}
                className="p-1 rounded text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
              <button
                id="hud-redo-btn"
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title={canRedo ? `重做 (Redo) [Ctrl+Y] · 尚有 ${futureCount} 步` : '無可重做步驟'}
                className="p-1 rounded text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => audioEngine.previewNote(keySignature, currentNote)}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-200 hover:bg-amber-300 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>試聽單音</span>
          </button>
          <button
            type="button"
            onClick={() => onInsertNoteAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
            className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg text-xs font-bold transition-all cursor-pointer"
            title="在當前音符後插入新音符"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>插入音符</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteNoteAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
            className="p-1 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 text-rose-700 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-900 text-xs cursor-pointer"
            title="刪除當前音符"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Piano Keyboard for Intuitive Pitch Entry */}
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

      {/* In-Score Pitch & Duration Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Quick Pitch Numbers */}
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <span className="text-[11px] font-bold text-zinc-500 px-1">快速音高:</span>
          {[1, 2, 3, 4, 5, 6, 7, 0].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => onSetPitch(p as PitchNumber)}
              className={`w-7 h-7 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer ${
                currentNote.pitch === p
                  ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 font-black shadow-xs'
                  : 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {p === 0 ? '0' : p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSetPitch('empty')}
            title="空白音符 / 標點符號 / 註解留白 (空)"
            className={`px-2 h-7 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              currentNote.pitch === 'empty'
                ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 font-black shadow-xs'
                : 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-dashed border-zinc-300 dark:border-zinc-600'
            }`}
          >
            <span>␣ 空</span>
          </button>
        </div>

        {/* Octave Controls */}
        <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold">
          <span className="text-[11px] font-bold text-zinc-500 px-1">八度:</span>
          <button
            type="button"
            onClick={() => onSetOctave(-1)}
            className={`px-2 py-1 rounded-lg cursor-pointer ${
              currentNote.octave === -1
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            低音 (5̣)
          </button>
          <button
            type="button"
            onClick={() => onUpdateSelectedNote(n => ({ ...n, octave: 0 }))}
            className={`px-2 py-1 rounded-lg cursor-pointer ${
              currentNote.octave === 0
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            中音 (5)
          </button>
          <button
            type="button"
            onClick={() => onSetOctave(1)}
            className={`px-2 py-1 rounded-lg cursor-pointer ${
              currentNote.octave === 1
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            高音 (5̇)
          </button>
        </div>

        {/* Accidental */}
        <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold">
          <button
            type="button"
            onClick={() => onSetAccidental('#')}
            className={`px-2 py-1 rounded-lg cursor-pointer ${
              currentNote.accidental === '#'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            ♯ 升
          </button>
          <button
            type="button"
            onClick={() => onSetAccidental('b')}
            className={`px-2 py-1 rounded-lg cursor-pointer ${
              currentNote.accidental === 'b'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            ♭ 降
          </button>
        </div>

        {/* Duration Chips */}
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs flex-wrap">
          <span className="text-[11px] font-bold text-zinc-500 px-1">拍數:</span>
          {[
            { label: '1.5 拍', dur: 1.5 },
            { label: '1 拍', dur: 1 },
            { label: '0.75 拍', dur: 0.75 },
            { label: '0.5 拍', dur: 0.5 },
            { label: '0.25 拍', dur: 0.25 },
            { label: '2 拍', dur: 2 },
            { label: '3 拍', dur: 3 },
          ].map(d => (
            <button
              key={d.dur}
              type="button"
              onClick={() => onSetDuration(d.dur as NoteDuration)}
              className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                currentNote.duration === d.dur
                  ? 'bg-amber-500 text-zinc-950 font-black shadow-2xs'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {d.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onToggleDotted}
            className={`px-2 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
              currentNote.isDotted
                ? 'bg-amber-500 text-zinc-950 border-amber-500'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            · 附點
          </button>
          <button
            type="button"
            onClick={onToggleTie}
            className={`px-2 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
              currentNote.isTied
                ? 'bg-amber-500 text-zinc-950 border-amber-500'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            ⌒ 延音
          </button>
        </div>
      </div>

      {/* Punctuation & Annotation Toolbar in HUD */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200/80 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Punctuation Row */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-2 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
              <MessageSquareQuote className="w-3.5 h-3.5" /> 標點:
            </span>
            {PUNCTUATION_MARKS.slice(0, 9).map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => onInsertPunctuation(p.char)}
                title={`填入標點 ${p.label} (${p.desc})`}
                className="w-6 h-6 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900 text-amber-950 dark:text-amber-200 font-mono font-bold text-xs border border-amber-200 dark:border-amber-800 transition-colors active:scale-95 flex items-center justify-center shadow-2xs cursor-pointer"
              >
                {p.label === ' ' ? '␣' : p.label}
              </button>
            ))}
          </div>

          {/* Annotations Row */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-2 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> 註解:
            </span>
            {ANNOTATION_MARKS.slice(0, 7).map(ann => (
              <button
                key={ann.label}
                type="button"
                onClick={() => onInsertAnnotation(ann.text)}
                title={`填入註解 ${ann.label} (${ann.desc})`}
                className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-950 dark:text-indigo-200 font-semibold text-[11px] border border-indigo-200 dark:border-indigo-800 transition-colors active:scale-95 whitespace-nowrap shadow-2xs cursor-pointer"
              >
                {ann.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Annotation Input */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs">
          <span className="text-[11px] font-bold text-zinc-500">自訂註解:</span>
          <input
            type="text"
            placeholder="如: (漸快/合唱/副歌)..."
            value={currentNote.annotation || ''}
            onChange={e => onSetAnnotation(e.target.value)}
            className="w-32 px-2 py-0.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={() => {
              onSetPitch('empty');
              showNotice('已設定自訂註解並將音高設為留白 (Empty)');
            }}
            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded text-[11px] transition-colors cursor-pointer"
          >
            設為留白註解
          </button>
        </div>
      </div>
    </div>
  );
};
