'use client';

import React, { useState } from 'react';
import { JianpuNote, LyricDisplayMode } from '@/types/song';
import { isNonNotationItem, isPunctuationOrSpacer } from '@/lib/taigiUtils';

interface NoteCellProps {
  note: JianpuNote;
  mIdx: number;
  nIdx: number;
  isSelected: boolean;
  isPlaybackActive: boolean;
  displayMode: LyricDisplayMode;
  onSelectNote: (mIdx: number, nIdx: number) => void;
  onUpdateLyric: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom', val: string) => void;
  onGoToNextNote: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom') => void;
  onGoToPrevNote: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom') => void;
  keyPrefix?: string;
}

export const NoteCell: React.FC<NoteCellProps> = React.memo(({
  note,
  mIdx,
  nIdx,
  isSelected,
  isPlaybackActive,
  displayMode,
  onSelectNote,
  onUpdateLyric,
  onGoToNextNote,
  onGoToPrevNote,
  keyPrefix = '',
}) => {
  const [focusedField, setFocusedField] = useState<'hanji' | 'poj' | 'pij' | 'custom' | null>(null);

  const isNonNotation = isNonNotationItem(note);
  const isPitched = !isNonNotation && typeof note.pitch === 'number' && note.pitch > 0;
  const octaveTopDots = isPitched && note.octave > 0 ? note.octave : 0;
  const octaveBottomDots = isPitched && note.octave < 0 ? Math.abs(note.octave) : 0;
  const isEighth = !isNonNotation && (note.duration === 0.5 || note.duration === 0.75);
  const isSixteenth = !isNonNotation && (note.duration <= 0.25 || note.duration === 0.375);
  const showDot =
    !isNonNotation &&
    (note.isDotted ||
      note.duration === 1.5 ||
      note.duration === 0.75 ||
      note.duration === 3 ||
      note.duration === 0.375 ||
      note.duration === 1.75);

  const dashesCount = !isNonNotation
    ? note.duration === 2
      ? 1
      : note.duration === 3
      ? 2
      : note.duration === 4
      ? 3
      : 0
    : 0;

  const hanji = note.lyric?.hanji || '';
  const custom = note.lyric?.custom || '';

  // Handle inserting quick Taigi diacritic character to active field
  const handleInsertDiacritic = (char: string) => {
    if (!focusedField) return;
    const currentVal = note.lyric[focusedField] || '';
    onUpdateLyric(mIdx, nIdx, focusedField, currentVal + char);
  };

  return (
    <div
      key={`${keyPrefix}${note.id}-${mIdx}-${nIdx}`}
      id={`wysiwyg-note-cell-${mIdx}-${nIdx}`}
      className={`group relative flex flex-col items-center justify-between p-2 rounded-2xl border transition-all duration-150 min-w-[76px] sm:min-w-[92px] flex-1 select-none ${
        isPlaybackActive
          ? 'bg-amber-400/25 ring-3 ring-amber-500 scale-[1.03] shadow-lg border-amber-500 z-10'
          : isSelected
          ? 'border-amber-500 bg-amber-50/95 dark:bg-amber-950/70 shadow-md ring-2 ring-amber-400/80 z-10'
          : isNonNotation
          ? 'border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-amber-400'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 hover:border-amber-300 dark:hover:border-amber-700'
      }`}
    >
      {/* Downward Anchor Pointer to In-Card Deck */}
      {isSelected && (
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-amber-500 rotate-45 rounded-xs z-20 pointer-events-none shadow-xs" />
      )}

      {/* UPPER TOUCH ZONE: PITCH & ANNOTATION (Select note without focusing inputs) */}
      <div
        onClick={() => onSelectNote(mIdx, nIdx)}
        className="w-full flex flex-col items-center justify-center cursor-pointer py-1 touch-manipulation active:scale-95 transition-transform"
        title="點擊選取此音符並試聽"
      >
        {/* Slur / Tie Arc */}
        {note.isTied && !isNonNotation && (
          <span className="text-amber-600 dark:text-amber-400 text-sm font-bold -mb-1">
            ⌒
          </span>
        )}

        {/* Annotation Pill */}
        {note.annotation && (
          <span className="mb-1 text-[10px] font-sans font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/90 px-1.5 py-0.2 rounded-md border border-indigo-200 dark:border-indigo-800 whitespace-nowrap shadow-2xs">
            {note.annotation}
          </span>
        )}

        {/* Jianpu Note Number Container */}
        <div className="flex flex-col items-center justify-center min-h-[44px]">
          {/* Top Octave Dots */}
          {octaveTopDots > 0 && (
            <div className="flex gap-0.5 mb-[-2px]">
              {Array.from({ length: octaveTopDots }).map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full inline-block bg-zinc-900 dark:bg-zinc-100"
                />
              ))}
            </div>
          )}

          {/* Pitch Number & Accidental */}
          <div className="flex items-baseline font-mono text-2xl font-black tracking-tight select-none">
            {isPitched && note.accidental && (
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400 mr-0.5">
                {note.accidental === '#' ? '♯' : '♭'}
              </span>
            )}
            <span
              className={`${
                isNonNotation
                  ? 'text-zinc-400 dark:text-zinc-500 font-mono text-lg font-normal'
                  : note.pitch === 0
                  ? 'text-zinc-400 dark:text-zinc-600 font-normal'
                  : isPlaybackActive
                  ? 'text-amber-600 dark:text-amber-300 scale-110'
                  : isSelected
                  ? 'text-amber-700 dark:text-amber-300 font-black'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {isNonNotation
                ? note.annotation
                  ? ''
                  : isPunctuationOrSpacer(hanji || custom)
                ? hanji || custom
                : '␣'
                : note.pitch}
            </span>
            {showDot && (
              <span className="text-base font-black text-amber-600 dark:text-amber-400 ml-0.5">
                ·
              </span>
            )}
            {dashesCount > 0 && (
              <span className="font-mono text-zinc-500 dark:text-zinc-400 text-base ml-1 font-bold">
                {' -'.repeat(dashesCount)}
              </span>
            )}
          </div>

          {/* Bottom Octave Dots */}
          {octaveBottomDots > 0 && (
            <div className="flex gap-0.5 mt-[-2px]">
              {Array.from({ length: octaveBottomDots }).map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full inline-block bg-zinc-900 dark:bg-zinc-100"
                />
              ))}
            </div>
          )}

          {/* Duration Underlines */}
          {isEighth && (
            <div className="w-full h-[2.5px] mt-0.5 rounded-full bg-zinc-900 dark:bg-zinc-200" />
          )}
          {isSixteenth && (
            <div className="flex flex-col gap-[2px] w-full mt-0.5">
              <div className="w-full h-[2px] rounded-full bg-zinc-900 dark:bg-zinc-200" />
              <div className="w-full h-[2px] rounded-full bg-zinc-900 dark:bg-zinc-200" />
            </div>
          )}
        </div>
      </div>

      {/* LOWER ZONE: DIRECT IN-SCORE EDITABLE LYRIC INPUTS */}
      <div className="w-full flex flex-col gap-1.5 mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-800">
        {/* POJ (白話字) Lyric Input */}
        {(displayMode === 'all' ||
          displayMode === 'hanji_poj' ||
          displayMode === 'poj_only') && (
          <div className="w-full flex flex-col">
            <input
              id={`lyric-input-${mIdx}-${nIdx}-poj`}
              type="text"
              value={note.lyric.poj || ''}
              onFocus={() => {
                onSelectNote(mIdx, nIdx);
                setFocusedField('poj');
              }}
              onBlur={() => setFocusedField(null)}
              onChange={e =>
                onUpdateLyric(mIdx, nIdx, 'poj', e.target.value)
              }
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    onGoToNextNote(mIdx, nIdx, 'poj');
                  } else {
                    e.preventDefault();
                    onGoToPrevNote(mIdx, nIdx, 'poj');
                  }
                }
              }}
              placeholder="POJ"
              className="w-full text-center font-serif italic text-xs font-semibold px-1 py-1 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-800"
              title="白話字 (POJ)"
            />
          </div>
        )}

        {/* Hanji (漢字) Lyric Input */}
        {(displayMode === 'all' ||
          displayMode === 'hanji_poj' ||
          displayMode === 'hanji_pij' ||
          displayMode === 'hanji_only') && (
          <div className="w-full flex flex-col">
            <input
              id={`lyric-input-${mIdx}-${nIdx}-hanji`}
              type="text"
              value={note.lyric.hanji || ''}
              onFocus={() => {
                onSelectNote(mIdx, nIdx);
                setFocusedField('hanji');
              }}
              onBlur={() => setFocusedField(null)}
              onChange={e =>
                onUpdateLyric(mIdx, nIdx, 'hanji', e.target.value)
              }
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    onGoToNextNote(mIdx, nIdx, 'hanji');
                  } else {
                    e.preventDefault();
                    onGoToPrevNote(mIdx, nIdx, 'hanji');
                  }
                }
              }}
              placeholder="字"
              className="w-full text-center font-bold text-sm px-1 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-zinc-800"
              title="漢字 (Hanji)"
            />
          </div>
        )}

        {/* PIJ (臺羅拼音) Lyric Input */}
        {(displayMode === 'all' || displayMode === 'hanji_pij') && (
          <div className="w-full flex flex-col">
            <input
              id={`lyric-input-${mIdx}-${nIdx}-pij`}
              type="text"
              value={note.lyric.pij || ''}
              onFocus={() => {
                onSelectNote(mIdx, nIdx);
                setFocusedField('pij');
              }}
              onBlur={() => setFocusedField(null)}
              onChange={e =>
                onUpdateLyric(mIdx, nIdx, 'pij', e.target.value)
              }
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    onGoToNextNote(mIdx, nIdx, 'pij');
                  } else {
                    e.preventDefault();
                    onGoToPrevNote(mIdx, nIdx, 'pij');
                  }
                }
              }}
              placeholder="臺羅"
              className="w-full text-center font-serif text-[11px] px-1 py-1 rounded-lg bg-cyan-50/60 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 text-cyan-800 dark:text-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 focus:bg-white dark:focus:bg-zinc-800"
              title="臺羅拼音 (PIJ)"
            />
          </div>
        )}

        {/* Quick Taigi Diacritics Ribbon (shown when an input in this note is focused) */}
        {focusedField && (focusedField === 'poj' || focusedField === 'pij') && (
          <div className="flex items-center justify-center gap-1 mt-1 pt-1 border-t border-zinc-200 dark:border-zinc-700 overflow-x-auto">
            {['á', 'à', 'â', 'ā', 'a̍', 'o͘', 'ⁿ'].map(c => (
              <button
                key={c}
                type="button"
                onMouseDown={e => {
                  e.preventDefault(); // prevent losing input focus
                  handleInsertDiacritic(c);
                }}
                className="w-5 h-5 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-amber-400 hover:text-zinc-950 text-zinc-800 dark:text-zinc-200 font-serif text-[10px] font-bold transition-colors cursor-pointer"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

NoteCell.displayName = 'NoteCell';
