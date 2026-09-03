'use client';

import React, { useState } from 'react';
import { JianpuNote, LyricDisplayMode } from '@/types/song';
import { isNonNotationItem, isPunctuationOrSpacer, extractTaigiTone } from '@/lib/taigiUtils';
import { Volume2 } from 'lucide-react';

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
  showToneOverlay?: boolean;
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
  showToneOverlay = true,
}) => {
  const [focusedField, setFocusedField] = useState<'hanji' | 'poj' | 'pij' | 'custom' | null>(null);

  const isNonNotation = isNonNotationItem(note);
  const isPitched = !isNonNotation && typeof note.pitch === 'number' && note.pitch > 0;
  const octaveTopDots = isPitched && note.octave > 0 ? note.octave : 0;
  const octaveBottomDots = isPitched && note.octave < 0 ? Math.abs(note.octave) : 0;
  const isEighth = !isNonNotation && (note.duration === 0.5 || note.duration === 0.75);
  const isSixteenth = !isNonNotation && (note.duration <= 0.25 || note.duration === 0.375);

  const pojTone = extractTaigiTone(note.lyric?.poj || '');
  const pijTone = extractTaigiTone(note.lyric?.pij || '');
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
      className={`group relative flex flex-col items-center justify-between p-2.5 rounded-2xl border transition-all duration-150 min-w-[76px] sm:min-w-[92px] flex-1 select-none ${
        isPlaybackActive
          ? 'bg-amber-500/20 ring-2 ring-amber-400 scale-[1.03] shadow-md border-amber-500 z-10'
          : isSelected
          ? 'border-amber-500 bg-amber-50/90 dark:bg-[#1c1a14] shadow-md ring-2 ring-amber-400/80 z-10'
          : isNonNotation
          ? 'border-dashed border-zinc-300 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-[#0e1017]/50 hover:border-amber-400'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141720] hover:border-amber-300 dark:hover:border-zinc-700'
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
        title="Click to select note and preview"
      >
        {/* Slur / Tie Arc */}
        {note.isTied && !isNonNotation && (
          <span className="text-amber-600 dark:text-amber-400 text-sm font-bold -mb-1">
            ⌒
          </span>
        )}

        {/* Annotation Pill */}
        {note.annotation && (
          <span className="mb-1 text-[10px] font-sans font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/90 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 whitespace-nowrap shadow-2xs">
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
                  : hanji === '\n' || hanji === '↵' || custom === '\n' || custom === '↵'
                  ? '↵'
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

          {/* Audition Pitch Floating Indicator */}
          {isPitched && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectNote(mIdx, nIdx);
              }}
              className="absolute -top-1.5 -right-3.5 p-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 opacity-0 group-hover:opacity-100 hover:scale-110 transition-all cursor-pointer touch-manipulation"
              title="Preview pitch"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* LOWER ZONE: DIRECT IN-SCORE EDITABLE LYRIC INPUTS */}
      <div className="w-full flex flex-col gap-1.5 mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-800/80">
        {/* POJ Lyric Input */}
        {(displayMode === 'all' ||
          displayMode === 'hanji_poj' ||
          displayMode === 'poj_only') && (
          <div className="w-full flex flex-col gap-0.5">
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
                if (e.key === 'Enter' || e.key === 'Tab' || e.key === ' ' || e.key === '-') {
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
              className="w-full text-center font-serif italic text-xs font-semibold px-1 py-1 rounded-lg bg-emerald-50/60 dark:bg-[#0c1410] border border-emerald-200/90 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-800 min-h-[32px] touch-manipulation"
              title="POJ romanization - Space, hyphen, or Tab moves to next note"
            />
            {showToneOverlay && pojTone && (
              <div
                className="flex items-center justify-center gap-0.5 text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-xs select-none border border-emerald-300/40"
                title={`${pojTone.name} (Pitch contour ${pojTone.contour} ${pojTone.symbol})`}
              >
                <span>{pojTone.superscript}</span>
                <span className="text-[8px] opacity-75">{pojTone.symbol}</span>
              </div>
            )}
          </div>
        )}

        {/* Hanji Lyric Input */}
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
                if (e.key === 'Enter' || e.key === 'Tab' || e.key === ' ') {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    onGoToNextNote(mIdx, nIdx, 'hanji');
                  } else {
                    e.preventDefault();
                    onGoToPrevNote(mIdx, nIdx, 'hanji');
                  }
                }
              }}
              placeholder="Hanji"
              className="w-full text-center font-bold text-sm px-1 py-1 rounded-lg bg-zinc-50 dark:bg-[#0a0c10] border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-zinc-800 min-h-[34px] touch-manipulation"
              title="Hanji character - Space or Tab moves to next note"
            />
          </div>
        )}

        {/* PIJ Lyric Input */}
        {(displayMode === 'all' || displayMode === 'hanji_pij') && (
          <div className="w-full flex flex-col gap-0.5">
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
                if (e.key === 'Enter' || e.key === 'Tab' || e.key === ' ' || e.key === '-') {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    onGoToNextNote(mIdx, nIdx, 'pij');
                  } else {
                    e.preventDefault();
                    onGoToPrevNote(mIdx, nIdx, 'pij');
                  }
                }
              }}
              placeholder="PIJ"
              className="w-full text-center font-serif text-[11px] px-1 py-1 rounded-lg bg-cyan-50/60 dark:bg-[#0c1316] border border-cyan-200/90 dark:border-cyan-800/60 text-cyan-800 dark:text-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 focus:bg-white dark:focus:bg-zinc-800 min-h-[32px] touch-manipulation"
              title="PIJ romanization - Space, hyphen, or Tab moves to next note"
            />
            {showToneOverlay && pijTone && (
              <div
                className="flex items-center justify-center gap-0.5 text-[9px] font-mono font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-100/70 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded-xs select-none border border-cyan-300/40"
                title={`${pijTone.name} (Pitch contour ${pijTone.contour} ${pijTone.symbol})`}
              >
                <span>{pijTone.superscript}</span>
                <span className="text-[8px] opacity-75">{pijTone.symbol}</span>
              </div>
            )}
          </div>
        )}

        {/* Quick Taigi Diacritics Ribbon (Touch-friendly 34px buttons for iPad) */}
        {focusedField && (focusedField === 'poj' || focusedField === 'pij') && (
          <div className="flex items-center justify-center gap-1.5 mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-700/80 overflow-x-auto py-0.5">
            {['á', 'à', 'â', 'ā', 'a̍', 'o͘', 'ⁿ'].map(c => (
              <button
                key={c}
                type="button"
                onMouseDown={e => {
                  e.preventDefault(); // prevent losing input focus
                  handleInsertDiacritic(c);
                }}
                className="min-w-[34px] min-h-[34px] px-1 rounded-lg bg-zinc-200 hover:bg-amber-400 hover:text-zinc-950 dark:bg-zinc-800 dark:hover:bg-amber-500 dark:hover:text-zinc-950 text-zinc-900 dark:text-zinc-100 font-serif text-xs font-bold transition-all active:scale-95 shadow-2xs cursor-pointer touch-manipulation flex items-center justify-center"
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
