'use client';

import React from 'react';
import { JianpuNote, LyricDisplayMode } from '@/types/song';
import { cn } from '@/lib/utils';
import { isNonNotationItem, isPunctuationOrSpacer } from '@/lib/taigiUtils';

interface JianpuNoteComponentProps {
  note: JianpuNote;
  isSelected?: boolean;
  isActive?: boolean;
  playProgress?: number; // 0 to 1 progress within this note during playback
  displayMode?: LyricDisplayMode;
  onClick?: () => void;
  className?: string;
  isKaraokeMode?: boolean;
}

export const JianpuNoteComponent: React.FC<JianpuNoteComponentProps> = React.memo(({
  note,
  isSelected = false,
  isActive = false,
  playProgress = 0,
  displayMode = 'all',
  onClick,
  className,
  isKaraokeMode = false,
}) => {
  const isNonNotation = isNonNotationItem(note);
  const isPitched = !isNonNotation && typeof note.pitch === 'number' && note.pitch > 0;
  const isEmptyNote = isNonNotation || note.pitch === 'empty' || (!note.pitch && note.pitch !== 0);

  // Octave dots (only for active pitched musical notes)
  const octaveTopDots = isPitched && note.octave > 0 ? note.octave : 0;
  const octaveBottomDots = isPitched && note.octave < 0 ? Math.abs(note.octave) : 0;

  // Underlines for eighth notes (duration <= 0.5) and 16th notes (duration <= 0.25)
  const isEighth = !isNonNotation && (note.duration === 0.5 || note.duration === 0.75);
  const isSixteenth = !isNonNotation && (note.duration <= 0.25 || note.duration === 0.375);
  const showDot = !isNonNotation && (note.isDotted || note.duration === 1.5 || note.duration === 0.75 || note.duration === 3 || note.duration === 0.375 || note.duration === 1.75);

  // Extension dashes for 2, 3, 4 beats
  const dashesCount = !isNonNotation
    ? note.duration === 2
      ? 1
      : note.duration === 3
      ? 2
      : note.duration === 4
      ? 3
      : 0
    : 0;

  // Lyric texts
  const hanji = note.lyric.hanji || '';
  const poj = note.lyric.poj || '';
  const pij = note.lyric.pij || '';
  const custom = note.lyric.custom || '';
  const annotation = note.annotation || '';

  // Determine what lyrics to show based on display mode
  const renderLyricContent = () => {
    const hasText = Boolean(hanji || poj || pij || custom || annotation);
    if (!hasText) {
      if (note.pitch === 0 && !isNonNotation) {
        return <span className="text-zinc-400 dark:text-zinc-600 font-mono text-xs">0</span>;
      }
      if (isEmptyNote) {
        return <span className="text-zinc-300 dark:text-zinc-700 font-mono text-xs select-none">␣</span>;
      }
      if (isKaraokeMode) {
        return <span className="text-transparent font-mono text-xs select-none">&nbsp;</span>;
      }
      return <span className="text-zinc-400 dark:text-zinc-600 font-mono text-xs">—</span>;
    }

    const primaryText = hanji || custom || annotation || poj || pij || '';
    const isPunctuation = isPunctuationOrSpacer(primaryText);

    switch (displayMode) {
      case 'hanji_only':
        return (
          <span
            className={cn(
              'font-medium text-sm tracking-wide',
              isPunctuation
                ? 'text-amber-700 dark:text-amber-400 font-bold'
                : 'text-zinc-900 dark:text-zinc-100'
            )}
          >
            {primaryText || '—'}
          </span>
        );
      case 'poj_only':
        return (
          <span className="font-serif italic text-emerald-700 dark:text-emerald-400 text-xs">
            {poj || custom || hanji || annotation || '—'}
          </span>
        );
      case 'pij_only':
        return (
          <span className="font-serif italic text-cyan-700 dark:text-cyan-400 text-xs">
            {pij || custom || hanji || annotation || '—'}
          </span>
        );
      case 'custom_only':
        return (
          <span className="font-medium text-amber-700 dark:text-amber-300 text-xs">
            {custom || hanji || poj || annotation || '—'}
          </span>
        );
      case 'hanji_poj':
        return (
          <div className="flex flex-col items-center leading-tight">
            {poj && <span className="text-[11px] font-serif text-emerald-600 dark:text-emerald-400 font-medium">{poj}</span>}
            <span
              className={cn(
                'font-medium text-sm',
                isPunctuation
                  ? 'text-amber-700 dark:text-amber-400 font-bold'
                  : 'text-zinc-900 dark:text-zinc-100'
              )}
            >
              {primaryText || '—'}
            </span>
          </div>
        );
      case 'hanji_pij':
        return (
          <div className="flex flex-col items-center leading-tight">
            {pij && <span className="text-[11px] font-serif text-cyan-600 dark:text-cyan-400 font-medium">{pij}</span>}
            <span
              className={cn(
                'font-medium text-sm',
                isPunctuation
                  ? 'text-amber-700 dark:text-amber-400 font-bold'
                  : 'text-zinc-900 dark:text-zinc-100'
              )}
            >
              {primaryText || '—'}
            </span>
          </div>
        );
      case 'all':
      default:
        return (
          <div className="flex flex-col items-center leading-none gap-0.5">
            {poj && (
              <span className="text-[10px] font-serif text-emerald-600 dark:text-emerald-400 font-medium max-w-[56px] truncate" title={poj}>
                {poj}
              </span>
            )}
            <span
              className={cn(
                'font-semibold text-sm',
                isPunctuation
                  ? 'text-amber-700 dark:text-amber-400 font-black'
                  : 'text-zinc-900 dark:text-zinc-100'
              )}
            >
              {primaryText || '—'}
            </span>
            {pij && pij !== poj && (
              <span className="text-[9px] font-serif text-cyan-600 dark:text-cyan-400 max-w-[56px] truncate" title={pij}>
                {pij}
              </span>
            )}
          </div>
        );
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center justify-between rounded-xl cursor-pointer transition-all duration-150 select-none touch-manipulation',
        isKaraokeMode
          ? 'min-w-[52px] px-2 py-2'
          : 'min-w-[46px] px-2 py-1.5 border hover:border-amber-400/80 hover:bg-amber-50/40 dark:hover:bg-zinc-800/60',
        isSelected
          ? 'border-amber-500 bg-amber-50/80 dark:bg-[#1f1d18] shadow-sm ring-2 ring-amber-400/50'
          : !isKaraokeMode && 'border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#141720]/80',
        isActive && 'bg-amber-400/20 dark:bg-amber-500/25 ring-2 ring-amber-500 scale-[1.04]',
        isNonNotation && 'opacity-90 border-dashed bg-zinc-50/50 dark:bg-[#0c0e14]/50',
        className
      )}
    >
      {/* Active Karaoke Note Progress Glow Bar */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-400/30 to-amber-500/10 pointer-events-none animate-pulse"
        />
      )}

      {/* Note Number Container */}
      <div className="flex items-center justify-center relative min-h-[36px] px-1">
        {/* Slur / Tie Indicator */}
        {note.isTied && !isNonNotation && (
          <span className="absolute -top-2.5 text-zinc-400 dark:text-zinc-500 text-xs font-bold">⌒</span>
        )}

        {/* Top Annotation if set */}
        {annotation && isNonNotation && (
          <span className="absolute -top-3 text-[10px] font-sans font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.2 rounded-full border border-indigo-200 dark:border-indigo-800 whitespace-nowrap shadow-2xs">
            {annotation}
          </span>
        )}

        <div className="flex flex-col items-center">
          {/* Top Octave Dots */}
          {octaveTopDots > 0 && (
            <div className="flex gap-0.5 mb-[-2px]">
              {Array.from({ length: octaveTopDots }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full inline-block',
                    isActive ? 'bg-amber-600 dark:bg-amber-300' : 'bg-zinc-800 dark:bg-zinc-200'
                  )}
                />
              ))}
            </div>
          )}

          {/* Main Pitch Number & Accidental & Dotted */}
          <div className="flex items-baseline font-mono text-lg font-bold tracking-tight">
            {isPitched && note.accidental && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 mr-0.5">
                {note.accidental === '#' ? '♯' : '♭'}
              </span>
            )}
            <span
              className={cn(
                'transition-colors',
                isNonNotation
                  ? 'text-zinc-400/80 dark:text-zinc-500 font-mono text-base px-1 min-w-[14px] text-center'
                  : note.pitch === 0
                  ? 'text-zinc-400 dark:text-zinc-500 font-normal'
                  : isActive
                  ? 'text-amber-600 dark:text-amber-300 scale-110'
                  : 'text-zinc-900 dark:text-zinc-100'
              )}
            >
              {isNonNotation
                ? annotation
                  ? ''
                  : hanji === '\n' || hanji === '↵' || hanji === '\r' || custom === '\n' || custom === '↵' || custom === '\r'
                  ? '↵'
                  : isPunctuationOrSpacer(hanji || custom)
                  ? hanji || custom
                  : '␣'
                : note.pitch}
            </span>
            {showDot && (
              <span className="text-sm font-black text-amber-600 dark:text-amber-400 ml-0.5">·</span>
            )}
            {/* Extension Dashes */}
            {dashesCount > 0 && (
              <span className="font-mono text-zinc-500 dark:text-zinc-400 text-sm ml-1 font-semibold">
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
                  className={cn(
                    'w-1.5 h-1.5 rounded-full inline-block',
                    isActive ? 'bg-amber-600 dark:bg-amber-300' : 'bg-zinc-800 dark:bg-zinc-200'
                  )}
                />
              ))}
            </div>
          )}

          {/* Duration Underlines */}
          {isEighth && (
            <div
              className={cn(
                'w-full h-[2px] mt-0.5 rounded-full',
                isActive ? 'bg-amber-500' : 'bg-zinc-800 dark:bg-zinc-300'
              )}
            />
          )}
          {isSixteenth && (
            <div className="flex flex-col gap-[2px] w-full mt-0.5">
              <div
                className={cn(
                  'w-full h-[1.5px] rounded-full',
                  isActive ? 'bg-amber-500' : 'bg-zinc-800 dark:bg-zinc-300'
                )}
              />
              <div
                className={cn(
                  'w-full h-[1.5px] rounded-full',
                  isActive ? 'bg-amber-500' : 'bg-zinc-800 dark:bg-zinc-300'
                )}
              />
            </div>
          )}
        </div>
      </div>

      {/* Aligned Lyric Row */}
      <div className="mt-1.5 w-full flex items-center justify-center text-center min-h-[32px]">
        {renderLyricContent()}
      </div>
    </div>
  );
});

JianpuNoteComponent.displayName = 'NumberedNotationNoteComponent';

export const NumberedNotationNoteComponent = JianpuNoteComponent;
