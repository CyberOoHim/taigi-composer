'use client';

import React, { useMemo, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { LyricDisplayMode, VerseItem, VerseNoteRef } from '@/types/song';
import { PlaybackState } from '@/lib/audioEngine';
import { VerseTiming, KaraokeLeadInState } from '@/lib/karaokeSequencer';
import { KaraokeSection } from './SectionJumpBar';
import { KaraokeStageTheme, KaraokeLayoutMode } from '@/lib/storage';
import { isNonNotationItem, isPunctuationOrSpacer } from '@/lib/taigiUtils';
import { CheckCircle2, Wind, Sun, Moon, Music, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface KaraokeStageProps {
  currentVerse: VerseItem | null;
  nextVerse: VerseItem | null;
  activeVerseTiming?: VerseTiming | null;
  nextVerseTiming?: VerseTiming | null;
  activeVerseIndex?: number;
  allVerses?: VerseItem[];
  allVerseTimings?: VerseTiming[];
  isAwaitingVocal?: boolean;
  leadIn?: KaraokeLeadInState | null;
  isVerseCompleted?: boolean;
  activeSection: KaraokeSection | null;
  playbackState: PlaybackState;
  displayMode: LyricDisplayMode;
  onJumpToSection?: (section: KaraokeSection) => void;
  isEcoMode?: boolean;
  zoomScale?: number;
  stageTheme?: KaraokeStageTheme;
  onToggleStageTheme?: () => void;
  showNotation?: boolean;
  onToggleShowNotation?: () => void;
  layoutMode?: KaraokeLayoutMode;
  onToggleLayoutMode?: () => void;
}

// Helper to identify CJK characters for natural Chinese text spacing
const isCJKChar = (char: string): boolean => {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df)
  );
};

/**
 * Individual Syllable Cell with continuous gradient wipe & 3-tier vertical grid
 */
interface SyllableCellProps {
  item: VerseNoteRef;
  noteIndex: number;
  isActiveLine: boolean;
  currentTime: number;
  verseTiming?: VerseTiming | null;
  effectiveMode: 'roman' | 'hanlo' | 'roman_major_hanlo' | 'hanlo_major_roman';
  isFirstVocalNote: boolean;
  showNotation: boolean;
  stageTheme: KaraokeStageTheme;
  zoomScale: number;
  isEcoMode: boolean;
  isComingLineAwaiting: boolean;
}

const SyllableCell: React.FC<SyllableCellProps> = React.memo(({
  item,
  noteIndex,
  isActiveLine,
  currentTime,
  verseTiming,
  effectiveMode,
  isFirstVocalNote,
  showNotation,
  stageTheme,
  zoomScale,
  isEcoMode,
  isComingLineAwaiting,
}) => {
  const note = item.note;
  const isNonNotation = isNonNotationItem(note);
  const rawHanlo = note.lyric.hanlo ?? note.lyric.hanji ?? note.lyric.custom ?? '';
  const rawRoman = note.lyric.poj ?? note.lyric.tl ?? '';

  const hasHanlo = Boolean(rawHanlo && rawHanlo.trim());
  const hasRoman = Boolean(rawRoman && rawRoman.trim());
  const hasExplicitText = hasHanlo || hasRoman;

  // Render line breaks (omitted in single-line view so trailing breaks consume 0 width)
  if (rawHanlo === '\n' || rawHanlo === '↵') {
    return null;
  }

  // Render punctuation spacers
  if (isPunctuationOrSpacer(rawHanlo)) {
    return (
      <div className="flex items-center justify-center self-center px-1 font-sans select-none opacity-60">
        <span
          className={
            zoomScale >= 1.5
              ? 'text-2xl sm:text-4xl'
              : zoomScale >= 1.25
              ? 'text-xl sm:text-3xl'
              : 'text-lg sm:text-2xl'
          }
        >
          {rawHanlo}
        </span>
      </div>
    );
  }

  if ((note.pitch === 0 || note.pitch === 'empty') && !hasExplicitText && !note.annotation) {
    return null;
  }

  // Calculate high-precision syllable wipe progress
  const noteTiming = verseTiming?.notesTimeline?.find(
    t => t.measureIndex === item.measureIndex && t.noteIndex === item.noteIndex
  );

  let isNoteActive = false;
  let isPassed = false;
  let wipePercent = 0;

  if (isActiveLine && noteTiming) {
    const { startTimeSec, endTimeSec, durationSec } = noteTiming;
    if (currentTime >= endTimeSec) {
      isPassed = true;
      wipePercent = 100;
    } else if (currentTime >= startTimeSec && currentTime < endTimeSec) {
      isNoteActive = true;
      const progress = durationSec > 0 ? (currentTime - startTimeSec) / durationSec : 0;
      wipePercent = Math.min(100, Math.max(0, Math.round(progress * 100)));
    }
  }

  // Musical attributes
  const isPitched = !isNonNotation && typeof note.pitch === 'number' && note.pitch > 0;
  const octaveTopDots = isPitched && note.octave > 0 ? note.octave : 0;
  const octaveBottomDots = isPitched && note.octave < 0 ? Math.abs(note.octave) : 0;
  const isThirtySecond = !isNonNotation && typeof note.duration === 'number' && note.duration <= 0.125;
  const isSixteenth =
    !isNonNotation && typeof note.duration === 'number' && (note.duration === 0.25 || note.duration === 0.375);
  const isEighth =
    !isNonNotation && typeof note.duration === 'number' && (note.duration === 0.5 || note.duration === 0.75);
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
  const accidentalSymbol = note.accidental === '#' ? '♯' : note.accidental === 'b' ? '♭' : '';

  // Mode text routing
  let subRubyDisplay = '\u00A0';
  let mainWordDisplay = '\u00A0';
  if (effectiveMode === 'roman') {
    mainWordDisplay = hasRoman ? rawRoman : (hasHanlo ? rawHanlo : '\u00A0');
  } else if (effectiveMode === 'hanlo') {
    mainWordDisplay = hasHanlo ? rawHanlo : (hasRoman ? rawRoman : '\u00A0');
  } else if (effectiveMode === 'roman_major_hanlo') {
    subRubyDisplay = hasHanlo ? rawHanlo : '\u00A0';
    mainWordDisplay = hasRoman ? rawRoman : (hasHanlo ? rawHanlo : '\u00A0');
  } else {
    subRubyDisplay = hasRoman ? rawRoman : '\u00A0';
    mainWordDisplay = hasHanlo ? rawHanlo : (hasRoman ? rawRoman : '\u00A0');
  }

  // Theme color palette
  const isDark = stageTheme === 'dark';
  const sungColorHex = isDark ? '#fbbf24' : '#2563eb'; // Gold in dark, Royal Blue in daylight
  const unsungColorHex = isActiveLine
    ? isDark
      ? '#94a3b8'
      : '#475569'
    : isDark
    ? '#64748b'
    : '#64748b';

  // Dynamic text style with continuous left-to-right gradient wipe
  const textFillStyle: React.CSSProperties = isNoteActive
    ? {
        backgroundImage: `linear-gradient(90deg, ${sungColorHex} 0%, ${sungColorHex} ${wipePercent}%, ${unsungColorHex} ${wipePercent}%, ${unsungColorHex} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        display: 'inline-block',
      }
    : isPassed
    ? {
        color: sungColorHex,
      }
    : {
        color: unsungColorHex,
      };

  // Font sizing: In Clean Performance Mode (no notation), scale text up generously
  const mainFontSizeClass = !showNotation
    ? zoomScale >= 1.75
      ? 'text-4xl sm:text-6xl md:text-7xl lg:text-8xl min-h-[4.5rem] sm:min-h-[6.5rem]'
      : zoomScale >= 1.5
      ? 'text-3xl sm:text-5xl md:text-6xl lg:text-7xl min-h-[3.75rem] sm:min-h-[5.5rem]'
      : zoomScale >= 1.25
      ? 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl min-h-[3.25rem] sm:min-h-[4.5rem]'
      : 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl min-h-[3rem] sm:min-h-[4rem]'
    : zoomScale >= 1.75
    ? 'text-3xl sm:text-5xl md:text-6xl lg:text-7xl min-h-[3.5rem] sm:min-h-[5rem]'
    : zoomScale >= 1.5
    ? 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl min-h-[3rem] sm:min-h-[4.25rem]'
    : zoomScale >= 1.25
    ? 'text-xl sm:text-3xl md:text-4xl lg:text-5xl min-h-[2.5rem] sm:min-h-[3.75rem]'
    : 'text-xl sm:text-3xl md:text-4xl lg:text-5xl min-h-[2.5rem] sm:min-h-[3.25rem]';

  const rubyFontSizeClass = !showNotation
    ? zoomScale >= 1.5
      ? 'text-xl sm:text-2xl md:text-3xl min-h-[2rem] sm:min-h-[2.5rem]'
      : 'text-base sm:text-lg md:text-xl min-h-[1.5rem] sm:min-h-[2rem]'
    : zoomScale >= 1.5
    ? 'text-lg sm:text-xl md:text-2xl min-h-[1.75rem] sm:min-h-[2.25rem]'
    : 'text-sm sm:text-base md:text-lg min-h-[1.25rem] sm:min-h-[1.75rem]';

  // Highlight first sung syllable of the line during entry / countdown or before sung
  const isFirstTarget =
    isFirstVocalNote &&
    (isComingLineAwaiting ||
      (!isPassed &&
        !isNoteActive &&
        (verseTiming?.firstVocalStartSec ? currentTime < verseTiming.firstVocalStartSec + 0.4 : true)));

  return (
    <div
      className={`relative flex flex-col items-center justify-end px-1 sm:px-1.5 transition-all duration-150 select-none ${
        dashesCount > 0 ? 'min-w-[48px] sm:min-w-[64px]' : 'min-w-[32px] sm:min-w-[44px]'
      } ${
        isNoteActive
          ? 'scale-110 -translate-y-1'
          : isFirstTarget
          ? 'scale-105'
          : ''
      }`}
    >
      {/* Visual Attack / Entry Cue Badge on First Sung Syllable */}
      {isFirstTarget && (
        <span
          className={`absolute -top-7 sm:-top-8 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full border shadow-md whitespace-nowrap animate-bounce ${
            isDark
              ? 'bg-amber-500/20 text-amber-300 border-amber-400/80 ring-2 ring-amber-400/40'
              : 'bg-blue-100 text-blue-800 border-blue-400 ring-2 ring-blue-300'
          }`}
        >
          起唱 · 1st
        </span>
      )}

      {/* Optional Musical Annotation (e.g. 漸慢, rit., V) */}
      {note.annotation && (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border mb-0.5 ${
            isDark
              ? 'text-indigo-300 bg-indigo-950/80 border-indigo-700/60'
              : 'text-indigo-800 bg-indigo-100 border-indigo-300'
          }`}
        >
          {note.annotation}
        </span>
      )}

      {/* TIER 1: RUBY PRONUNCIATION (Ample line-height so POJ/TL tone marks never crop) */}
      {(effectiveMode === 'roman_major_hanlo' || effectiveMode === 'hanlo_major_roman') && (
        <div
          className={`${rubyFontSizeClass} pt-1 pb-0.5 flex items-center justify-center font-sans tracking-wide leading-normal overflow-visible ${
            effectiveMode === 'hanlo_major_roman' ? 'italic font-serif' : 'font-medium'
          } ${
            isNoteActive
              ? isDark
                ? 'text-amber-300 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                : 'text-blue-600 font-bold'
              : isPassed
              ? isDark
                ? 'text-amber-400/80'
                : 'text-blue-500/80'
              : isFirstTarget
              ? isDark
                ? 'text-amber-300'
                : 'text-blue-700 font-semibold'
              : isDark
              ? 'text-zinc-400'
              : 'text-slate-500'
          }`}
          style={{ overflowWrap: 'normal' }}
        >
          <span>{subRubyDisplay}</span>
        </div>
      )}

      {/* TIER 2: MAIN DISPLAY LYRIC (with Continuous Syllable Wipe) */}
      <div className="relative flex items-baseline justify-center">
        <span
          className={`${mainFontSizeClass} font-black tracking-wider flex items-center justify-center px-0.5 transition-all duration-100 ${
            effectiveMode === 'roman' || effectiveMode === 'roman_major_hanlo'
              ? 'font-serif italic font-extrabold'
              : 'font-sans'
          } ${
            isNoteActive && !isEcoMode
              ? isDark
                ? 'drop-shadow-[0_0_14px_rgba(245,158,11,0.85)]'
                : 'drop-shadow-[0_0_8px_rgba(37,99,235,0.4)]'
              : ''
          } ${
            isFirstTarget
              ? isDark
                ? 'ring-1 ring-amber-400/60 rounded px-1'
                : 'ring-1 ring-blue-500/60 rounded px-1'
              : ''
          }`}
          style={textFillStyle}
        >
          {mainWordDisplay}
        </span>

        {/* Trailing Sustained Dashes */}
        {dashesCount > 0 && (
          <span
            className={`text-base sm:text-xl font-bold ml-1 tracking-widest ${
              isNoteActive
                ? isDark
                  ? 'text-amber-300 font-black'
                  : 'text-blue-600 font-black'
                : isPassed
                ? isDark
                  ? 'text-amber-400/90'
                  : 'text-blue-500'
                : isDark
                ? 'text-zinc-500'
                : 'text-slate-400'
            }`}
          >
            {' -'.repeat(dashesCount)}
          </span>
        )}
      </div>

      {/* TIER 3: NUMBERED NOTATION (Pitch, Octave Dots, Accidentals, Underlines) */}
      {showNotation && (
        <div
          className={`mt-1.5 inline-flex flex-col items-center justify-center relative rounded-md transition-all duration-150 px-1.5 py-0.5 border ${
            isNoteActive
              ? isDark
                ? 'bg-amber-400 text-zinc-950 font-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.8)]'
                : 'bg-blue-600 text-white font-black border-blue-500 shadow-md'
              : isPassed
              ? isDark
                ? 'bg-zinc-800/90 text-amber-300 font-bold border-zinc-700'
                : 'bg-slate-200 text-blue-700 font-bold border-slate-300'
              : isFirstTarget
              ? isDark
                ? 'bg-amber-950/70 text-amber-300 font-black border-amber-500/60 ring-1 ring-amber-400/40'
                : 'bg-blue-50 text-blue-700 font-black border-blue-400 ring-1 ring-blue-300'
              : isDark
              ? 'bg-zinc-900/60 text-zinc-400 font-medium border-zinc-800'
              : 'bg-white text-slate-600 font-medium border-slate-300'
          }`}
        >
          {/* Octave high dots */}
          {octaveTopDots > 0 && (
            <span className="flex items-center justify-center gap-0.5 leading-none mb-0.5">
              {Array.from({ length: octaveTopDots }).map((_, i) => (
                <span
                  key={i}
                  className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full inline-block ${
                    isNoteActive
                      ? isDark
                        ? 'bg-zinc-950'
                        : 'bg-white'
                      : isDark
                      ? 'bg-zinc-300'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </span>
          )}

          {/* Numeral and accidental */}
          <span className="inline-flex items-baseline justify-center leading-none">
            {accidentalSymbol && (
              <span
                className={`text-[9px] sm:text-[10px] mr-0.5 font-bold ${
                  isNoteActive ? (isDark ? 'text-zinc-950' : 'text-white') : isDark ? 'text-amber-400' : 'text-blue-600'
                }`}
              >
                {accidentalSymbol}
              </span>
            )}
            <span className="font-mono text-xs sm:text-base font-black">
              {isNonNotation
                ? note.annotation
                  ? ''
                  : '␣'
                : note.pitch === 'empty'
                ? '␣'
                : note.pitch === 0
                ? '0'
                : note.pitch}
            </span>
            {showDot && (
              <span
                className={`text-xs sm:text-sm font-black ml-0.5 ${
                  isNoteActive ? (isDark ? 'text-zinc-950' : 'text-white') : isDark ? 'text-amber-400' : 'text-blue-600'
                }`}
              >
                ·
              </span>
            )}
          </span>

          {/* Octave low dots */}
          {octaveBottomDots > 0 && (
            <span className="flex items-center justify-center gap-0.5 leading-none mt-0.5">
              {Array.from({ length: octaveBottomDots }).map((_, i) => (
                <span
                  key={i}
                  className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full inline-block ${
                    isNoteActive
                      ? isDark
                        ? 'bg-zinc-950'
                        : 'bg-white'
                      : isDark
                      ? 'bg-zinc-300'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </span>
          )}

          {/* Duration underlines */}
          {isEighth && (
            <span
              className={`block w-full h-[1.5px] rounded-full mt-0.5 ${
                isNoteActive ? (isDark ? 'bg-zinc-950' : 'bg-white') : isDark ? 'bg-zinc-400' : 'bg-slate-500'
              }`}
            />
          )}
          {isSixteenth && (
            <span className="flex flex-col gap-[1px] w-full mt-0.5">
              <span
                className={`block w-full h-[1.5px] rounded-full ${
                  isNoteActive ? (isDark ? 'bg-zinc-950' : 'bg-white') : isDark ? 'bg-zinc-400' : 'bg-slate-500'
                }`}
              />
              <span
                className={`block w-full h-[1.5px] rounded-full ${
                  isNoteActive ? (isDark ? 'bg-zinc-950' : 'bg-white') : isDark ? 'bg-zinc-400' : 'bg-slate-500'
                }`}
              />
            </span>
          )}
          {isThirtySecond && (
            <span className="flex flex-col gap-[1px] w-full mt-0.5">
              <span
                className={`block w-full h-[1.5px] rounded-full ${
                  isNoteActive ? (isDark ? 'bg-zinc-950' : 'bg-white') : isDark ? 'bg-zinc-400' : 'bg-slate-500'
                }`}
              />
              <span
                className={`block w-full h-[1.5px] rounded-full ${
                  isNoteActive ? (isDark ? 'bg-zinc-950' : 'bg-white') : isDark ? 'bg-zinc-400' : 'bg-slate-500'
                }`}
              />
              <span
                className={`block w-full h-[1.5px] rounded-full ${
                  isNoteActive ? (isDark ? 'bg-zinc-950' : 'bg-white') : isDark ? 'bg-zinc-400' : 'bg-slate-500'
                }`}
              />
            </span>
          )}
        </div>
      )}
    </div>
  );
});

SyllableCell.displayName = 'SyllableCell';

export const KaraokeStage: React.FC<KaraokeStageProps> = React.memo(({
  currentVerse,
  nextVerse,
  activeVerseTiming,
  nextVerseTiming,
  activeVerseIndex = 0,
  allVerses = [],
  allVerseTimings = [],
  isAwaitingVocal = false,
  leadIn = null,
  isVerseCompleted = false,
  activeSection,
  playbackState,
  displayMode,
  isEcoMode = false,
  zoomScale = 1.0,
  stageTheme = 'dark',
  onToggleStageTheme,
  showNotation = true,
  onToggleShowNotation,
  layoutMode = 'single_line',
  onToggleLayoutMode,
}) => {
  const isDark = stageTheme === 'dark';

  // Determine effective display mode for text routing
  const effectiveMode: 'roman' | 'hanlo' | 'roman_major_hanlo' | 'hanlo_major_roman' = useMemo(() => {
    if (displayMode === 'hanlo_major_roman' || displayMode === 'hanji_poj') return 'hanlo_major_roman';
    if (displayMode === 'hanlo' || displayMode === 'hanji_only' || displayMode === 'custom_only') return 'hanlo';
    if (displayMode === 'roman' || displayMode === 'poj_only') return 'roman';
    return 'roman_major_hanlo';
  }, [displayMode]);

  // Helper to find first vocal note index in a verse
  const getFirstVocalIndex = (verse: VerseItem | null) => {
    if (!verse) return -1;
    return verse.notes.findIndex(item => {
      const n = item.note;
      const isNonNotation =
        isNonNotationItem(n) || n.pitch === 'empty' || (typeof n.duration === 'number' && n.duration <= 0);
      const rawHanlo = n.lyric.hanlo ?? n.lyric.hanji ?? n.lyric.custom ?? '';
      const rawRoman = n.lyric.poj ?? n.lyric.tl ?? '';
      const hasLyric =
        (rawHanlo && !isPunctuationOrSpacer(rawHanlo) && rawHanlo !== '\n' && rawHanlo !== '↵') ||
        (rawRoman && !isPunctuationOrSpacer(rawRoman) && rawRoman !== '\n' && rawRoman !== '↵');
      const isPitched = !isNonNotation && typeof n.pitch === 'number' && n.pitch > 0;
      return !isNonNotation && (hasLyric || isPitched) && n.duration > 0;
    });
  };

  const currentFirstVocal = useMemo(() => getFirstVocalIndex(currentVerse), [currentVerse]);
  // Derive clean next-phrase starting preview cue (2 chars for Hanji or 2 words for POJ)
  // Ensures the arrow + starting words is an atomic unit using non-breaking spaces (\u00A0)
  const upcomingStartPreview = useMemo(() => {
    if (!nextVerse || !nextVerse.notes || nextVerse.notes.length === 0) return null;

    const vocalNotes: Array<{ hanji: string; poj: string }> = [];
    for (const item of nextVerse.notes) {
      const n = item.note;
      if (isNonNotationItem(n)) continue;
      const rawHanlo = n.lyric.hanlo ?? n.lyric.hanji ?? n.lyric.custom ?? '';
      const rawRoman = n.lyric.poj ?? n.lyric.tl ?? '';
      if (rawHanlo === '\n' || rawHanlo === '↵') continue;

      const cleanHanlo = rawHanlo && !isPunctuationOrSpacer(rawHanlo) ? rawHanlo.trim() : '';
      const cleanRoman = rawRoman && !isPunctuationOrSpacer(rawRoman) ? rawRoman.trim() : '';
      if (cleanHanlo || cleanRoman) {
        vocalNotes.push({ hanji: cleanHanlo, poj: cleanRoman });
      }
    }

    if (vocalNotes.length === 0) return null;

    // Requirement 2: Route by primary text according to display mode
    const isPrimaryRoman = effectiveMode === 'roman' || effectiveMode === 'roman_major_hanlo';
    const hasRomanInNext = vocalNotes.some(v => Boolean(v.poj && v.poj.trim()));
    const hasHanjiInNext = vocalNotes.some(v => Boolean(v.hanji && v.hanji.trim()));

    const useRoman = isPrimaryRoman
      ? (hasRomanInNext || !hasHanjiInNext)
      : (!hasHanjiInNext && hasRomanInNext);

    if (useRoman) {
      // POJ / Roman: 2 words joined with non-breaking space
      const words: string[] = [];
      for (const v of vocalNotes) {
        const word = v.poj || v.hanji;
        if (word) {
          words.push(word);
          if (words.length >= 2) break;
        }
      }
      let pojText = '';
      if (words.length > 1 && words[0].endsWith('-')) {
        pojText = `${words[0]}${words[1]}`;
      } else {
        pojText = words.slice(0, 2).join('\u00A0');
      }
      return pojText ? `→\u00A0${pojText}...` : null;
    } else {
      // Hanji: 2 characters joined with non-breaking space
      let chars = '';
      for (const v of vocalNotes) {
        if (v.hanji) {
          chars += v.hanji;
          if (chars.length >= 2) break;
        }
      }
      const twoChars = chars.slice(0, 2);
      return twoChars ? `→\u00A0${twoChars}...` : null;
    }
  }, [nextVerse, effectiveMode]);

  // Derive clean next-line preview string (joins Hanji naturally without spaces, Roman with spaces)
  const nextLinePreview = useMemo(() => {
    if (!nextVerse || !nextVerse.notes || nextVerse.notes.length === 0) {
      return null;
    }

    const words: string[] = [];
    for (const item of nextVerse.notes) {
      const n = item.note;
      if (isNonNotationItem(n)) continue;
      const rawHanlo = n.lyric.hanlo ?? n.lyric.hanji ?? n.lyric.custom ?? '';
      const rawRoman = n.lyric.poj ?? n.lyric.tl ?? '';
      if (rawHanlo === '\n' || rawHanlo === '↵') continue;

      let word = '';
      if (effectiveMode === 'roman') {
        word = rawRoman || rawHanlo;
      } else if (effectiveMode === 'hanlo') {
        word = rawHanlo || rawRoman;
      } else if (effectiveMode === 'roman_major_hanlo') {
        word = rawRoman || rawHanlo;
      } else {
        word = rawHanlo || rawRoman;
      }

      if (word && word.trim() && !isPunctuationOrSpacer(word)) {
        words.push(word.trim());
      }
    }

    let result = '';
    for (let i = 0; i < words.length; i++) {
      const curr = words[i];
      if (i === 0) {
        result = curr;
      } else {
        const prev = words[i - 1];
        const isPrevCJK = isCJKChar(prev[prev.length - 1]);
        const isCurrCJK = isCJKChar(curr[0]);
        if (isPrevCJK && isCurrCJK) {
          result += curr;
        } else if (prev.endsWith('-')) {
          result += curr;
        } else {
          result += ' ' + curr;
        }
      }
    }

    return result;
  }, [nextVerse, effectiveMode]);

  // Derive seconds per beat for precise rhythmic triggers
  const secPerBeat = useMemo(() => {
    // 1. Check note duration ratio in active verse
    if (activeVerseTiming && activeVerseTiming.notesTimeline.length > 0 && currentVerse?.notes) {
      for (let i = 0; i < currentVerse.notes.length; i++) {
        const item = currentVerse.notes[i];
        const noteDur = item.note.duration;
        const timing = activeVerseTiming.notesTimeline[i];
        if (typeof noteDur === 'number' && noteDur > 0 && timing && timing.durationSec > 0) {
          const spb = timing.durationSec / noteDur;
          if (spb > 0.15 && spb < 3.0) return spb;
        }
      }
    }
    // 2. Check leadIn state
    if (leadIn && leadIn.totalBeats > 0 && leadIn.totalLeadInSec > 0) {
      const spb = leadIn.totalLeadInSec / leadIn.totalBeats;
      if (spb > 0.15 && spb < 3.0) return spb;
    }
    // 3. Fallback standard: 80 BPM = 0.75s per beat
    return 0.75;
  }, [activeVerseTiming, currentVerse, leadIn]);

  const twoBeatsSec = useMemo(() => secPerBeat * 2, [secPerBeat]);

  // Upcoming attack cue visibility in active canvas:
  // Starts appearing right from the beginning of the last 2 beats of the current lyric line
  const isCurrentVerseInLastTwoBeats = useMemo(() => {
    if (!activeVerseTiming || !nextVerse) return false;
    const verseEndBoundary = Math.min(
      activeVerseTiming.lastVocalEndSec > 0 ? activeVerseTiming.lastVocalEndSec : activeVerseTiming.endSec,
      activeVerseTiming.endSec
    );
    const cueStartSec = verseEndBoundary - twoBeatsSec;
    return playbackState.currentTime >= cueStartSec;
  }, [activeVerseTiming, nextVerse, twoBeatsSec, playbackState.currentTime]);

  const showUpcomingCue = Boolean(
    nextVerse && (isCurrentVerseInLastTwoBeats || isVerseCompleted)
  );

  // Stable lyric geometry & adaptive forward cue engine:
  // Strictly preserves the location and font size of the sung lyric line (0px movement, 0% shrink),
  // while dynamically adapting the forward cue ("adopt others") to fit the available margin.
  const canvasRef = useRef<HTMLDivElement>(null);
  const lineRowRef = useRef<HTMLDivElement>(null);
  const [lyricLineScale, setLyricLineScale] = useState<number>(1);
  const [cueFit, setCueFit] = useState<{
    placement: 'inline' | 'below';
    scale: number;
  }>({ placement: 'inline', scale: 1 });

  const updateGeometry = useCallback(() => {
    if (!canvasRef.current || !lineRowRef.current) return;

    const canvasWidth = canvasRef.current.clientWidth;
    const canvasHeight = canvasRef.current.clientHeight;
    const lyricWidth = lineRowRef.current.offsetWidth;
    const lyricHeight = lineRowRef.current.offsetHeight;

    // 1. Calculate stable lyric line scale (strictly independent of the upcoming cue)
    const availableWidth = Math.max(0, canvasWidth - 28);
    const availableHeight = Math.max(0, canvasHeight - 20);

    let newLyricScale = 1;
    if (lyricWidth > 0 && availableWidth > 0 && lyricWidth > availableWidth) {
      newLyricScale = Math.max(0.4, availableWidth / lyricWidth);
    }
    if (lyricHeight > 0 && availableHeight > 0 && lyricHeight > availableHeight) {
      newLyricScale = Math.min(newLyricScale, Math.max(0.4, availableHeight / lyricHeight));
    }

    setLyricLineScale(prev => {
      if (Math.abs(prev - newLyricScale) < 0.005) return prev;
      return newLyricScale;
    });

    // 2. Adapt the upcoming forward cue to the remaining space ("adopt others")
    // Space available between the right edge of the centered lyric line and canvas edge
    const renderedLyricWidth = lyricWidth * newLyricScale;
    const renderedLyricHeight = lyricHeight * newLyricScale;
    const rightMargin = (canvasWidth - renderedLyricWidth) / 2 - 16;
    const bottomMargin = (canvasHeight - renderedLyricHeight) / 2 - 12;

    // Available margins in lineRowRef coordinate space (cue child inherits lyricLineScale)
    const unscaledRightMargin = rightMargin / newLyricScale;
    const unscaledBottomMargin = bottomMargin / newLyricScale;
    const targetCueWidth = 140;

    let newPlacement: 'inline' | 'below' = 'inline';
    let newCueScale = 1;

    if (unscaledRightMargin >= targetCueWidth) {
      newPlacement = 'inline';
      newCueScale = 1;
    } else if (unscaledRightMargin >= 75) {
      newPlacement = 'inline';
      newCueScale = Math.max(0.65, unscaledRightMargin / targetCueWidth);
    } else {
      newPlacement = 'below';
      newCueScale = unscaledBottomMargin < 36 ? Math.max(0.6, unscaledBottomMargin / 36) : 1;
    }

    setCueFit(prev => {
      if (prev.placement === newPlacement && Math.abs(prev.scale - newCueScale) < 0.01) {
        return prev;
      }
      return { placement: newPlacement, scale: newCueScale };
    });
  }, []);

  useLayoutEffect(() => {
    updateGeometry();

    if (typeof ResizeObserver !== 'undefined' && canvasRef.current) {
      const observer = new ResizeObserver(() => {
        updateGeometry();
      });
      observer.observe(canvasRef.current);
      if (lineRowRef.current) {
        observer.observe(lineRowRef.current);
      }
      return () => observer.disconnect();
    }
  }, [
    updateGeometry,
    currentVerse,
    activeVerseIndex,
    zoomScale,
    showNotation,
    displayMode,
  ]);

  return (
    <div
      id="ktv-stage-container"
      className={`relative flex flex-col items-center justify-between p-4 sm:p-6 md:p-8 min-h-[360px] sm:min-h-[420px] select-none overflow-hidden transition-all duration-300 border-b ${
        isDark
          ? 'bg-gradient-to-b from-[#0b0e17] via-[#06070a] to-[#0b0e17] border-zinc-800/80 text-white'
          : 'bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] border-slate-300 text-slate-900'
      }`}
    >
      {/* Background Ambience (Dark mode only, skipped in Eco mode) */}
      {isDark && !isEcoMode && (
        <>
          <div className="eco-hide-ambient absolute -top-24 -left-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="eco-hide-ambient absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        </>
      )}

      {/* Stage Mini Readability Toolbar */}
      <div className="w-full max-w-6xl flex items-center justify-between gap-2 mb-3 px-1 z-20 flex-wrap">
        <div className="flex items-center gap-2">
          {activeSection && (
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                isDark
                  ? 'bg-zinc-900/90 text-amber-300 border-amber-500/40 shadow-xs'
                  : 'bg-white text-blue-800 border-slate-300 shadow-xs'
              }`}
            >
              段落: {activeSection.name}
            </span>
          )}
        </div>

        {/* Readability & Theme Quick Switches */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 1. Theme Switcher (Stage Dark vs Music Stand Daylight) */}
          {onToggleStageTheme && (
            <button
              id="ktv-stage-theme-toggle"
              type="button"
              onClick={onToggleStageTheme}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[34px] ${
                isDark
                  ? 'bg-zinc-900/90 text-amber-300 border-zinc-700 hover:bg-zinc-800'
                  : 'bg-white text-blue-700 border-slate-300 hover:bg-slate-50 shadow-xs'
              }`}
              title="切換舞台暗色 / 譜架高對比白天模式 (Stage Dark vs Music Stand)"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
              <span className="hidden sm:inline">{isDark ? '暗色舞台' : '譜架高對比'}</span>
            </button>
          )}

          {/* 2. Clean Performance Mode Toggle (Hide/Show Numbered Notation) */}
          {onToggleShowNotation && (
            <button
              id="ktv-stage-notation-toggle"
              type="button"
              onClick={onToggleShowNotation}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[34px] ${
                showNotation
                  ? isDark
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                    : 'bg-blue-50 text-blue-800 border-blue-300'
                  : isDark
                  ? 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title="切換簡譜顯示 (純歌詞大字模式 vs 簡譜模式)"
            >
              {showNotation ? <Music className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
              <span>{showNotation ? '簡譜: 開' : '純歌詞模式'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Phrase Completed Celebration Floating Pill */}
      <AnimatePresence>
        {isVerseCompleted && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md border ${
                isDark
                  ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-400 text-emerald-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>本句完成 · Complete</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN STAGE ARENA: DEDICATED UNIFIED SINGLE LYRIC WINDOW */}
      <div className="w-full max-w-6xl z-10 flex flex-col items-center justify-center my-auto">
        <div
          id="ktv-active-lyric-window"
          className={`relative w-full flex flex-col justify-between rounded-2xl transition-all duration-300 shadow-2xl min-h-[280px] sm:min-h-[340px] md:min-h-[380px] overflow-hidden ${
            isDark
              ? 'bg-zinc-900/85 border border-amber-500/40 shadow-amber-950/20'
              : 'bg-white border-2 border-blue-500/70 shadow-lg shadow-blue-100'
          }`}
        >
          {/* 1. Integrated Stage Header: Breath, Countdown & Status Indicator */}
          <div
            id="ktv-stage-window-header"
            className={`w-full flex items-center justify-between px-3.5 sm:px-5 py-2.5 border-b select-none transition-colors ${
              isDark
                ? 'bg-zinc-900/90 border-zinc-800/80 text-zinc-300'
                : 'bg-slate-50/90 border-slate-200 text-slate-700'
            }`}
          >
            {/* Left: Active verse indicator & section */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] sm:text-xs border ${
                  isDark
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/60 shadow-xs'
                    : 'bg-blue-100 text-blue-800 border-blue-300 shadow-xs'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isDark ? 'bg-amber-400 animate-pulse' : 'bg-blue-600 animate-pulse'
                  }`}
                />
                <span>現唱 (Active)</span>
              </span>

              {(currentVerse?.section || activeSection?.name) && (
                <span
                  className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-md border ${
                    isDark
                      ? 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60'
                      : 'bg-white text-slate-700 border-slate-300 shadow-xs'
                  }`}
                >
                  {currentVerse?.section || activeSection?.name}
                </span>
              )}
            </div>

            {/* Right: Integrated Breath & Countdown Indicator */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Beat countdown dots: 4 • 3 • 2 • 1 */}
              {leadIn && leadIn.isLeadIn && (
                <div className="flex items-center gap-1" title="拍子倒數">
                  {Array.from({ length: Math.min(6, leadIn.beatsPerBar || 4) }).map((_, bIdx) => {
                    const beatNum = bIdx + 1;
                    const isCurrent = leadIn.currentBeatIndex === beatNum;
                    const isPassedBeat = leadIn.currentBeatIndex > beatNum;
                    return (
                      <div
                        key={bIdx}
                        className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-150 ${
                          isCurrent
                            ? isDark
                              ? 'bg-amber-400 ring-2 ring-amber-300 scale-125'
                              : 'bg-blue-600 ring-2 ring-blue-300 scale-125'
                            : isPassedBeat
                            ? isDark
                              ? 'bg-amber-500/70'
                              : 'bg-blue-400'
                            : isDark
                            ? 'bg-zinc-700'
                            : 'bg-slate-300'
                        }`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Breath cue badge or time-to-entry countdown */}
              {leadIn?.isBreathCue ? (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black border animate-pulse ${
                    isDark
                      ? 'bg-cyan-950/90 text-cyan-300 border-cyan-400/80 ring-2 ring-cyan-400/30'
                      : 'bg-cyan-100 text-cyan-900 border-cyan-400 ring-2 ring-cyan-200'
                  }`}
                >
                  <Wind className="w-3 h-3 text-cyan-400 animate-spin" />
                  <span>🫁 準備吸氣 · Breathe In</span>
                </span>
              ) : leadIn && leadIn.isLeadIn ? (
                <span
                  className={`text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
                    isDark
                      ? 'bg-zinc-800/80 text-amber-300 border-amber-500/40'
                      : 'bg-blue-50 text-blue-700 border-blue-300'
                  }`}
                >
                  進歌倒數: {leadIn.timeUntilVocalSec.toFixed(1)}s ({leadIn.beatsRemaining} 拍)
                </span>
              ) : isAwaitingVocal ? (
                <span
                  className={`text-[10px] sm:text-xs font-mono font-medium px-2 py-0.5 rounded-md ${
                    isDark ? 'text-zinc-400 bg-zinc-800/50' : 'text-slate-500 bg-slate-100'
                  }`}
                >
                  準備進歌...
                </span>
              ) : null}
            </div>
          </div>

          {/* 2. Open Canvas with Maximized Typography & Vertical Space */}
          <div
            ref={canvasRef}
            className="relative w-full flex-1 flex flex-col items-center justify-center py-6 sm:py-10 md:py-14 px-3 sm:px-6 min-h-[180px] sm:min-h-[220px] overflow-hidden"
          >
            {currentVerse && currentVerse.notes.length > 0 ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`active-verse-${activeVerseIndex}-${currentVerse.verseIndex ?? 0}`}
                  initial={isEcoMode ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={isEcoMode ? undefined : { opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="w-full flex items-center justify-center overflow-visible"
                >
                  <div
                    ref={lineRowRef}
                    className="relative inline-flex flex-nowrap items-end justify-center gap-x-2 sm:gap-x-3.5 md:gap-x-5 shrink-0 transition-transform duration-150 ease-out"
                    style={{
                      transform: lyricLineScale < 1 ? `scale(${lyricLineScale})` : undefined,
                      transformOrigin: 'center center',
                    }}
                  >
                    {currentVerse.notes.map((item, idx) => (
                      <SyllableCell
                        key={`${item.measureIndex}-${item.noteIndex}-${idx}`}
                        item={item}
                        noteIndex={idx}
                        isActiveLine={true}
                        currentTime={playbackState.currentTime}
                        verseTiming={activeVerseTiming}
                        effectiveMode={effectiveMode}
                        isFirstVocalNote={idx === currentFirstVocal}
                        showNotation={showNotation}
                        stageTheme={stageTheme}
                        zoomScale={zoomScale}
                        isEcoMode={isEcoMode}
                        isComingLineAwaiting={isAwaitingVocal || Boolean(leadIn && leadIn.isLeadIn)}
                      />
                    ))}

                    {/* Upcoming Starting Chars / Words Cue (Appears from the last 2 beats of the verse) */}
                    <AnimatePresence>
                      {showUpcomingCue && upcomingStartPreview && (
                        <motion.div
                          initial={{
                            opacity: 0,
                            x: cueFit.placement === 'inline' ? -6 : 0,
                            y: cueFit.placement === 'below' ? -4 : 0,
                          }}
                          animate={{ opacity: 0.75, x: 0, y: 0 }}
                          exit={{
                            opacity: 0,
                            x: cueFit.placement === 'inline' ? 6 : 0,
                            y: cueFit.placement === 'below' ? 4 : 0,
                          }}
                          transition={{ duration: 0.2 }}
                          className={`select-none whitespace-nowrap break-keep break-inside-avoid pointer-events-none z-10 ${
                            cueFit.placement === 'inline'
                              ? 'absolute left-full bottom-0 ml-2 sm:ml-3 flex flex-col items-start justify-end'
                              : 'absolute right-0 top-full mt-1 sm:mt-1.5 flex flex-col items-end justify-start'
                          }`}
                          style={{
                            transform: cueFit.scale < 1 ? `scale(${cueFit.scale})` : undefined,
                            transformOrigin: cueFit.placement === 'inline' ? 'left bottom' : 'right top',
                          }}
                        >
                          <div className="relative flex items-baseline justify-center whitespace-nowrap">
                            <span
                              className={`font-bold tracking-wide transition-all duration-100 whitespace-nowrap select-none ${
                                effectiveMode === 'roman' || effectiveMode === 'roman_major_hanlo'
                                  ? 'font-serif italic font-extrabold'
                                  : 'font-sans'
                              } ${
                                zoomScale >= 1.75
                                  ? 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl min-h-[3rem] sm:min-h-[4rem]'
                                  : zoomScale >= 1.5
                                  ? 'text-xl sm:text-3xl md:text-4xl lg:text-5xl min-h-[2.5rem] sm:min-h-[3.5rem]'
                                  : zoomScale >= 1.25
                                  ? 'text-lg sm:text-2xl md:text-3xl lg:text-4xl min-h-[2rem] sm:min-h-[3rem]'
                                  : 'text-base sm:text-xl md:text-2xl lg:text-3xl min-h-[1.75rem] sm:min-h-[2.5rem]'
                              } ${
                                isDark ? 'text-amber-300' : 'text-blue-600'
                              }`}
                              title="下一句起唱字 (Next phrase entry words)"
                            >
                              {upcomingStartPreview}
                            </span>
                          </div>

                          {showNotation && cueFit.placement === 'inline' && (
                            <div className="mt-1.5 invisible select-none pointer-events-none px-1.5 py-0.5 border border-transparent">
                              <span className="font-mono text-xs sm:text-base font-black">0</span>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div
                className={`w-full flex items-center justify-center p-6 rounded-xl border border-dashed transition-all duration-300 ${
                  isDark
                    ? 'bg-zinc-900/30 border-zinc-800/60 text-zinc-600'
                    : 'bg-slate-100/60 border-slate-300 text-slate-400'
                }`}
              >
                <span className="text-xs sm:text-sm font-medium italic select-none">
                  (全曲結束 · Finale / Rest)
                </span>
              </div>
            )}
          </div>

          {/* 3. Compact "Coming Next" Ambient Banner (Centered, Verse Number removed, Full Coming Lyric) */}
          <div
            id="ktv-next-line-preview-strip"
            className={`relative w-full flex items-center justify-center gap-2 sm:gap-3 px-3.5 sm:px-4 py-2 sm:py-2.5 border-t transition-colors select-none ${
              isDark
                ? 'bg-zinc-950/70 border-zinc-800/50 text-zinc-400/80'
                : 'bg-slate-100/70 border-slate-200 text-slate-500/80'
            }`}
          >
            <div className="flex items-center justify-center gap-2 max-w-full overflow-hidden text-xs sm:text-sm">
              <span
                className={`font-bold shrink-0 text-[10px] sm:text-xs px-2 py-0.5 rounded ${
                  isDark
                    ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60'
                    : 'bg-slate-200 text-slate-600 border border-slate-300'
                }`}
              >
                接唱
              </span>

              <span className="truncate font-medium tracking-wide opacity-80">
                {nextLinePreview ? `${nextLinePreview}...` : '(全曲結束 · Finale)'}
              </span>
            </div>

            {nextVerseTiming && nextVerseTiming.firstVocalStartSec > playbackState.currentTime && (
              <span className="absolute right-3.5 sm:right-4 text-[10px] sm:text-xs font-mono shrink-0 opacity-60 pointer-events-none">
                約 {(nextVerseTiming.firstVocalStartSec - playbackState.currentTime).toFixed(0)}s 後
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

KaraokeStage.displayName = 'KaraokeStage';
