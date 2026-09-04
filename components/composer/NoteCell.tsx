'use client';

import React, { useState } from 'react';
import { JianpuNote, LyricDisplayMode } from '@/types/song';
import {
  isNonNotationItem,
  isPunctuationOrSpacer,
  isPunctuationZeroNote,
  isStandaloneAnnotationNote,
  getPunctuationDisplayChar,
  extractTaigiTone,
  isMelismaContinuation,
  INSTRUMENT_LABELS,
} from '@/lib/taigiUtils';
import { Volume2, FileText } from 'lucide-react';

interface NoteCellProps {
  note: JianpuNote;
  prevNote?: JianpuNote | null;
  mIdx: number;
  nIdx: number;
  isSelected: boolean;
  isPlaybackActive: boolean;
  displayMode: LyricDisplayMode;
  onSelectNote: (mIdx: number, nIdx: number) => void;
  onUpdateLyric: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom' | 'roman' | 'hanlo', val: string) => void;
  onUpdateAnnotation?: (mIdx: number, nIdx: number, val: string) => void;
  onGoToNextNote: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom' | 'roman' | 'hanlo') => void;
  onGoToPrevNote: (mIdx: number, nIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom' | 'roman' | 'hanlo') => void;
  keyPrefix?: string;
  showToneOverlay?: boolean;
}

export const NoteCell: React.FC<NoteCellProps> = React.memo(({
  note,
  prevNote,
  mIdx,
  nIdx,
  isSelected,
  isPlaybackActive,
  displayMode,
  onSelectNote,
  onUpdateLyric,
  onUpdateAnnotation,
  onGoToNextNote,
  onGoToPrevNote,
  keyPrefix = '',
  showToneOverlay = true,
}) => {
  const [focusedField, setFocusedField] = useState<'roman' | 'hanlo' | null>(null);

  const isNonNotation = isNonNotationItem(note);
  const isPitched = !isNonNotation && typeof note.pitch === 'number' && note.pitch > 0;
  const octaveTopDots = isPitched && note.octave > 0 ? note.octave : 0;
  const octaveBottomDots = isPitched && note.octave < 0 ? Math.abs(note.octave) : 0;

  const romanTone = extractTaigiTone(note.lyric?.poj || note.lyric?.pij || '');

  const isThirtySecond = !isNonNotation && typeof note.duration === 'number' && note.duration > 0 && note.duration <= 0.125;
  const isSixteenth = !isNonNotation && typeof note.duration === 'number' && ((note.duration <= 0.25 && note.duration > 0.125) || note.duration === 0.375);
  const isEighth = !isNonNotation && typeof note.duration === 'number' && (note.duration === 0.5 || note.duration === 0.75 || note.duration === 0.333);

  const isTriplet = !isNonNotation && (note.isTriplet || note.duration === 0.333 || note.duration === 0.667);
  const showDoubleDot = !isNonNotation && (note.isDoubleDotted || note.duration === 1.75 || note.duration === 3.5);
  const showDot =
    !isNonNotation &&
    !showDoubleDot &&
    (note.isDotted ||
      note.duration === 1.5 ||
      note.duration === 0.75 ||
      note.duration === 3 ||
      note.duration === 0.375);

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

  // 1. Standalone zero-time annotation note (performance/vocal/section marker)
  if (isStandaloneAnnotationNote(note)) {
    return (
      <div
        key={`${keyPrefix}${note.id}-${mIdx}-${nIdx}`}
        id={`wysiwyg-note-cell-${mIdx}-${nIdx}`}
        onClick={() => onSelectNote(mIdx, nIdx)}
        className={`group relative flex flex-col items-center justify-between p-2 rounded-2xl border transition-all duration-150 min-w-[72px] max-w-[160px] shrink-0 self-stretch cursor-pointer select-none ${
          isPlaybackActive
            ? 'bg-amber-500/20 ring-2 ring-amber-400 scale-[1.02] shadow-md border-amber-500 z-10'
            : isSelected
            ? 'border-indigo-500 bg-indigo-50/95 dark:bg-[#161a30] shadow-md ring-2 ring-indigo-400/80 z-10'
            : 'border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/30 hover:border-indigo-400 dark:hover:border-indigo-700'
        }`}
        title={`Annotation: ${note.annotation} (0 beats) - Click to select or edit`}
      >
        {isSelected && (
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-indigo-500 rotate-45 rounded-xs z-20 pointer-events-none shadow-xs" />
        )}

        <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
          <FileText className="w-3 h-3 shrink-0" />
          <span>標記 (0拍)</span>
        </div>

        <div className="w-full flex flex-col items-center justify-center my-auto">
          <input
            id={`lyric-input-${mIdx}-${nIdx}-annotation`}
            type="text"
            value={note.annotation || ''}
            onFocus={() => {
              onSelectNote(mIdx, nIdx);
              setFocusedField('hanlo');
            }}
            onChange={e => {
              if (onUpdateAnnotation) {
                onUpdateAnnotation(mIdx, nIdx, e.target.value);
              } else {
                onUpdateLyric(mIdx, nIdx, 'hanlo', e.target.value);
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (!e.shiftKey) onGoToNextNote(mIdx, nIdx, 'hanlo');
                else onGoToPrevNote(mIdx, nIdx, 'hanlo');
              }
            }}
            placeholder="標記..."
            className="w-full text-center font-bold text-xs px-2 py-1 rounded-lg bg-white/90 dark:bg-[#0e1017] border border-indigo-200 dark:border-indigo-800/80 text-indigo-950 dark:text-indigo-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 min-h-[30px]"
            title="Performance Annotation (0 beats)"
          />
        </div>

        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono mt-1 select-none">
          Annotation
        </span>
      </div>
    );
  }

  // 2. Single-character zero-time punctuation / spacer note
  if (isPunctuationZeroNote(note)) {
    const rawChar = note.lyric?.hanji || note.lyric?.custom || '';
    const displayChar = getPunctuationDisplayChar(note);

    return (
      <div
        key={`${keyPrefix}${note.id}-${mIdx}-${nIdx}`}
        id={`wysiwyg-note-cell-${mIdx}-${nIdx}`}
        onClick={() => onSelectNote(mIdx, nIdx)}
        className={`group relative flex flex-col items-center justify-between p-1 rounded-xl border border-dashed transition-all duration-150 w-9 sm:w-10 min-w-[36px] max-w-[44px] shrink-0 self-stretch cursor-pointer select-none ${
          isPlaybackActive
            ? 'bg-amber-500/20 ring-2 ring-amber-400 border-amber-500'
            : isSelected
            ? 'border-amber-500 bg-amber-50/95 dark:bg-[#1c1a14] shadow-md ring-2 ring-amber-400/80 z-10'
            : 'border-zinc-300 dark:border-zinc-700/80 bg-zinc-50/60 dark:bg-[#0c0e14]/50 hover:border-amber-400'
        }`}
        title={`Zero-time note: "${displayChar}" (0 beats) - Click to edit or select`}
      >
        {isSelected && (
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-500 rotate-45 rounded-xs z-20 pointer-events-none shadow-xs" />
        )}

        <span className="text-[8px] font-mono text-zinc-400 dark:text-zinc-500 select-none">
          0拍
        </span>

        <div className="w-full flex items-center justify-center my-auto">
          <input
            id={`lyric-input-${mIdx}-${nIdx}-punct`}
            type="text"
            maxLength={2}
            value={rawChar === '\n' || rawChar === '\r' ? '↵' : (rawChar || (displayChar === '␣' ? '' : displayChar))}
            placeholder={displayChar === '␣' ? '␣' : ''}
            onFocus={() => {
              onSelectNote(mIdx, nIdx);
              setFocusedField('hanlo');
            }}
            onChange={e => {
              const val = e.target.value;
              const char = val.slice(-1) || '';
              onUpdateLyric(mIdx, nIdx, 'hanlo', char);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Tab' || e.key === ' ') {
                e.preventDefault();
                if (!e.shiftKey) {
                  onGoToNextNote(mIdx, nIdx, 'hanlo');
                } else {
                  onGoToPrevNote(mIdx, nIdx, 'hanlo');
                }
              }
            }}
            className="w-full text-center font-bold text-lg text-amber-700 dark:text-amber-400 bg-transparent focus:outline-hidden focus:ring-1 focus:ring-amber-500 rounded cursor-text min-h-[36px]"
            title="Single-character punctuation / delimiter (0 beats) - Type 1 character"
          />
        </div>

        <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 select-none">
          ·
        </span>
      </div>
    );
  }

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
        {/* Articulation mark (Fermata, Accent, Staccato, Tenuto, Portamento) */}
        {note.articulation && note.articulation !== 'none' && !isNonNotation && (
          <span className="text-amber-600 dark:text-amber-400 font-black text-xs select-none -mb-1">
            {note.articulation === 'fermata' && '𝄐'}
            {note.articulation === 'accent' && '>'}
            {note.articulation === 'staccato' && '·'}
            {note.articulation === 'tenuto' && '—'}
            {note.articulation === 'portamento_up' && '↗'}
            {note.articulation === 'portamento_down' && '↘'}
          </span>
        )}

        {/* Triplet indicator 3 */}
        {isTriplet && !isNonNotation && (
          <span className="text-[9px] font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1 rounded-sm border border-indigo-200 dark:border-indigo-800 -mb-0.5 shadow-2xs">
            3
          </span>
        )}

        {/* Slur / Tie Arc */}
        {!isNonNotation && (
          <div className="flex items-center gap-1 text-xs font-bold -mb-1 select-none pointer-events-none">
            {(note.tieToNext || (note.isTied && !note.slurToNext)) && (
              <span className="text-amber-500 dark:text-amber-400 text-sm font-black" title="Tie (連結音 - 音色融合)">
                ⌒
              </span>
            )}
            {note.slurToNext && (
              <span className="text-purple-600 dark:text-purple-400 text-sm font-black" title="Slur (圓滑音 - 一字多音)">
                ⌢
              </span>
            )}
          </div>
        )}

        {/* Annotation Pill */}
        {note.annotation && (
          <span className="mb-1 text-[10px] font-sans font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/90 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 whitespace-nowrap shadow-2xs">
            {note.annotation}
          </span>
        )}

        {/* Note-Specific Sound Source Override Pill */}
        {note.instrument && !isNonNotation && (
          <span
            className="mb-1 text-[10px] font-sans font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-700 whitespace-nowrap shadow-2xs"
            title={`Note Instrument Override: ${INSTRUMENT_LABELS[note.instrument]?.en || note.instrument}`}
          >
            {INSTRUMENT_LABELS[note.instrument]?.zh || note.instrument}
          </span>
        )}

        {/* Numbered Notation Note Number Container */}
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

          {/* Pitch Number & Accidental & Grace Notes */}
          <div className="flex items-center">
            {/* Pre-Grace Notes (前裝飾音 / 前倚音) */}
            {isPitched && note.preGraceNotes && note.preGraceNotes.length > 0 && (
              <div className="flex items-end gap-0.5 mr-1 mb-1 text-[11px] text-zinc-600 dark:text-zinc-400 font-mono font-bold leading-none select-none">
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-black -mr-0.5">⌒</span>
                {note.preGraceNotes.map((g, idx) => (
                  <span key={idx} className="relative flex flex-col items-center">
                    {g.octave > 0 && <span className="text-[7px] leading-none mb-[-2px]">·</span>}
                    <span className="flex items-baseline">
                      {g.accidental && <span className="text-[8px] text-amber-600">{g.accidental === '#' ? '♯' : '♭'}</span>}
                      <span>{g.pitch}</span>
                    </span>
                    {g.octave < 0 && <span className="text-[7px] leading-none mt-[-2px]">·</span>}
                    <span className="w-full h-[1.5px] bg-zinc-600 dark:bg-zinc-400 mt-0.5 rounded-full" />
                  </span>
                ))}
              </div>
            )}

            {/* Main Pitch Number & Accidental */}
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
              {showDoubleDot && (
                <span className="text-base font-black text-amber-600 dark:text-amber-400 ml-0.5">
                  ··
                </span>
              )}
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

            {/* Post-Grace Notes (後裝飾音 / 尾裝飾音) */}
            {isPitched && note.postGraceNotes && note.postGraceNotes.length > 0 && (
              <div className="flex items-end gap-0.5 ml-1 mb-1 text-[11px] text-zinc-600 dark:text-zinc-400 font-mono font-bold leading-none select-none">
                {note.postGraceNotes.map((g, idx) => (
                  <span key={idx} className="relative flex flex-col items-center">
                    {g.octave > 0 && <span className="text-[7px] leading-none mb-[-2px]">·</span>}
                    <span className="flex items-baseline">
                      {g.accidental && <span className="text-[8px] text-amber-600">{g.accidental === '#' ? '♯' : '♭'}</span>}
                      <span>{g.pitch}</span>
                    </span>
                    {g.octave < 0 && <span className="text-[7px] leading-none mt-[-2px]">·</span>}
                    <span className="w-full h-[1.5px] bg-zinc-600 dark:bg-zinc-400 mt-0.5 rounded-full" />
                  </span>
                ))}
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-black -ml-0.5">⌒</span>
              </div>
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
          {isThirtySecond && (
            <div className="flex flex-col gap-[1.5px] w-full mt-0.5">
              <div className="w-full h-[1.5px] rounded-full bg-zinc-900 dark:bg-zinc-200" />
              <div className="w-full h-[1.5px] rounded-full bg-zinc-900 dark:bg-zinc-200" />
              <div className="w-full h-[1.5px] rounded-full bg-zinc-900 dark:bg-zinc-200" />
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

      {/* LOWER ZONE: DIRECT IN-SCORE EDITABLE LYRIC INPUTS (ALWAYS ONLY 羅馬字 AND 漢羅) */}
      <div className="w-full flex flex-col gap-1.5 mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-800/80">
        {/* 羅馬字 Lyric Input */}
        <div className="w-full flex flex-col gap-0.5">
          <input
            id={`lyric-input-${mIdx}-${nIdx}-roman`}
            type="text"
            value={note.lyric.poj || note.lyric.pij || ''}
            onFocus={() => {
              onSelectNote(mIdx, nIdx);
              setFocusedField('roman');
            }}
            onBlur={() => setFocusedField(null)}
            onChange={e =>
              onUpdateLyric(mIdx, nIdx, 'roman', e.target.value)
            }
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Tab' || e.key === ' ' || e.key === '-') {
                if (!e.shiftKey) {
                  e.preventDefault();
                  onGoToNextNote(mIdx, nIdx, 'roman');
                } else {
                  e.preventDefault();
                  onGoToPrevNote(mIdx, nIdx, 'roman');
                }
              }
            }}
            placeholder="羅馬字"
            className="w-full text-center font-serif italic text-xs font-semibold px-1 py-1 rounded-lg bg-emerald-50/60 dark:bg-[#0c1410] border border-emerald-200/90 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-800 min-h-[32px] touch-manipulation"
            title="羅馬字 (Romanization) - Space, hyphen, or Tab moves to next note"
          />
          {showToneOverlay && romanTone && (
            <div
              className="flex items-center justify-center gap-0.5 text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-xs select-none border border-emerald-300/40"
              title={`${romanTone.name} (Pitch contour ${romanTone.contour} ${romanTone.symbol})`}
            >
              <span>{romanTone.superscript}</span>
              <span className="text-[8px] opacity-75">{romanTone.symbol}</span>
            </div>
          )}
        </div>

        {/* 漢羅 Lyric Input */}
        <div className="w-full flex flex-col">
          <input
            id={`lyric-input-${mIdx}-${nIdx}-hanlo`}
            type="text"
            value={note.lyric.hanji || note.lyric.custom || ''}
            onFocus={() => {
              onSelectNote(mIdx, nIdx);
              setFocusedField('hanlo');
            }}
            onBlur={() => setFocusedField(null)}
            onChange={e =>
              onUpdateLyric(mIdx, nIdx, 'hanlo', e.target.value)
            }
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Tab' || e.key === ' ') {
                if (!e.shiftKey) {
                  e.preventDefault();
                  onGoToNextNote(mIdx, nIdx, 'hanlo');
                } else {
                  e.preventDefault();
                  onGoToPrevNote(mIdx, nIdx, 'hanlo');
                }
              }
            }}
            placeholder="漢羅"
            className="w-full text-center font-bold text-sm px-1 py-1 rounded-lg bg-zinc-50 dark:bg-[#0a0c10] border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-zinc-800 min-h-[34px] touch-manipulation"
            title="漢羅 (Han-lô) - Space or Tab moves to next note"
          />
        </div>
      </div>
    </div>
  );
});

NoteCell.displayName = 'NoteCell';
