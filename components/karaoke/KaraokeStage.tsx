'use client';

import React from 'react';
import { LyricDisplayMode, VerseItem } from '@/types/song';
import { PlaybackState } from '@/lib/audioEngine';
import { VerseTiming } from '@/lib/karaokeSequencer';
import { KaraokeSection } from './SectionJumpBar';
import { isNonNotationItem, isPunctuationOrSpacer } from '@/lib/taigiUtils';
import { CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KaraokeStageProps {
  currentVerse: VerseItem | null;
  nextVerse: VerseItem | null;
  activeVerseTiming?: VerseTiming | null;
  nextVerseTiming?: VerseTiming | null;
  isAwaitingVocal?: boolean;
  isVerseCompleted?: boolean;
  activeSection: KaraokeSection | null;
  playbackState: PlaybackState;
  displayMode: LyricDisplayMode;
  onJumpToSection: (section: KaraokeSection) => void;
  isEcoMode?: boolean;
  zoomScale?: number;
}

export const KaraokeStage: React.FC<KaraokeStageProps> = React.memo(({
  currentVerse,
  nextVerse,
  activeVerseTiming,
  nextVerseTiming,
  isAwaitingVocal = false,
  isVerseCompleted = false,
  activeSection,
  playbackState,
  displayMode,
  onJumpToSection,
  isEcoMode = false,
  zoomScale = 1.0,
}) => {
  // Dynamic font and sizing tiers for Stage Mode / Music Stand zoom
  const hanjiSizeClass =
    zoomScale >= 1.75
      ? 'text-4xl sm:text-6xl md:text-7xl lg:text-8xl min-h-[4rem] sm:min-h-[5.5rem]'
      : zoomScale >= 1.5
      ? 'text-3xl sm:text-5xl md:text-6xl lg:text-7xl min-h-[3.5rem] sm:min-h-[4.5rem]'
      : zoomScale >= 1.25
      ? 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl min-h-[3rem] sm:min-h-[3.75rem]'
      : 'text-2xl sm:text-4xl md:text-5xl min-h-[2.5rem] sm:min-h-[3.25rem]';

  // Sub Lyric (Han-Lo ruby in Mode 3, or Roman ruby in Mode 4) - Doubled size
  const subLyricSizeClass =
    zoomScale >= 1.75
      ? 'text-3xl sm:text-4xl md:text-5xl min-h-[2.5rem] sm:min-h-[3.25rem]'
      : zoomScale >= 1.5
      ? 'text-2xl sm:text-3xl md:text-4xl min-h-[2.25rem] sm:min-h-[3rem]'
      : zoomScale >= 1.25
      ? 'text-xl sm:text-2xl md:text-3xl min-h-[2rem] sm:min-h-[2.75rem]'
      : 'text-xl sm:text-2xl min-h-[1.75rem] sm:min-h-[2.25rem]';

  const noteMinWClass =
    zoomScale >= 1.5
      ? 'min-w-[44px] sm:min-w-[56px]'
      : zoomScale >= 1.25
      ? 'min-w-[38px] sm:min-w-[48px]'
      : 'min-w-[32px] sm:min-w-[40px]';

  const rowGapClass =
    zoomScale >= 1.5
      ? 'gap-x-5 sm:gap-x-8 gap-y-4'
      : zoomScale >= 1.25
      ? 'gap-x-4 sm:gap-x-7 gap-y-3.5'
      : 'gap-x-4 sm:gap-x-6 gap-y-3.5';

  // Find the index of the first vocal note in active verse and next verse for targeted visual guidance
  const activeFirstVocalIndex = React.useMemo(() => {
    if (!currentVerse) return -1;
    return currentVerse.notes.findIndex(item => {
      const n = item.note;
      const isNonNotation = isNonNotationItem(n) || n.pitch === 'empty' || (typeof n.duration === 'number' && n.duration <= 0);
      const rawHanji = n.lyric.hanji ?? n.lyric.custom ?? '';
      const rawRoman = n.lyric.poj ?? n.lyric.tl ?? '';
      const hasLyric =
        (rawHanji && !isPunctuationOrSpacer(rawHanji) && rawHanji !== '\n' && rawHanji !== '↵') ||
        (rawRoman && !isPunctuationOrSpacer(rawRoman) && rawRoman !== '\n' && rawRoman !== '↵');
      const isPitched = !isNonNotation && typeof n.pitch === 'number' && n.pitch > 0;
      return !isNonNotation && (hasLyric || isPitched) && n.duration > 0;
    });
  }, [currentVerse]);

  const nextFirstVocalIndex = React.useMemo(() => {
    if (!nextVerse) return -1;
    return nextVerse.notes.findIndex(item => {
      const n = item.note;
      const isNonNotation = isNonNotationItem(n) || n.pitch === 'empty' || (typeof n.duration === 'number' && n.duration <= 0);
      const rawHanji = n.lyric.hanji ?? n.lyric.custom ?? '';
      const rawRoman = n.lyric.poj ?? n.lyric.tl ?? '';
      const hasLyric =
        (rawHanji && !isPunctuationOrSpacer(rawHanji) && rawHanji !== '\n' && rawHanji !== '↵') ||
        (rawRoman && !isPunctuationOrSpacer(rawRoman) && rawRoman !== '\n' && rawRoman !== '↵');
      const isPitched = !isNonNotation && typeof n.pitch === 'number' && n.pitch > 0;
      return !isNonNotation && (hasLyric || isPitched) && n.duration > 0;
    });
  }, [nextVerse]);

  const effectiveMode: 'roman' | 'hanlo' | 'roman_major_hanlo' | 'hanlo_major_roman' = React.useMemo(() => {
    if (displayMode === 'hanlo_major_roman' || displayMode === 'hanji_poj') return 'hanlo_major_roman';
    if (displayMode === 'hanlo' || displayMode === 'hanji_only' || displayMode === 'custom_only') return 'hanlo';
    if (displayMode === 'roman' || displayMode === 'poj_only' || displayMode === 'tl_only') return 'roman';
    return 'roman_major_hanlo';
  }, [displayMode]);

  return (
    <div className="relative flex flex-col items-center justify-between p-5 sm:p-8 md:p-10 min-h-[320px] sm:min-h-[360px] md:min-h-[380px] bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900 border-b border-zinc-800/80 select-none overflow-hidden transition-all">
      {/* Background Ambience (Omitted in Eco Mode to save GPU power) */}
      {!isEcoMode && (
        <>
          <div className="eco-hide-ambient absolute -top-24 -left-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="eco-hide-ambient absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        </>
      )}

      {/* Verse Completed Floating Celebration Badge (Non-displacing overlay) */}
      <AnimatePresence>
        {isVerseCompleted && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-xs font-semibold shadow-lg backdrop-blur-md">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Phrase Complete</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SLOT 1 (TOP): SUCCEEDING / COMING VERSE PREVIEW (Centered, badges removed) */}
      <div className="flex-1 w-full flex items-center justify-center z-10 min-h-[52px]">
        <AnimatePresence mode="wait">
          {nextVerse && nextVerse.notes.length > 0 ? (
            <motion.div
              key={`preview-${nextVerse.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 0.75, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              whileHover={{ opacity: 0.95 }}
              transition={{ duration: isEcoMode ? 0 : 0.22, ease: 'easeOut' }}
              className="w-fit max-w-full flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-2 px-4 py-1.5 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700/60 transition-all shadow-xs"
            >

              {/* Note previews */}
              {nextVerse.notes.map((item, idx) => {
                const note = item.note;
                const isNonNotation = isNonNotationItem(note);
                const rawHanji = note.lyric.hanji ?? note.lyric.custom ?? '';
                const rawRoman =
                  displayMode === 'hanji_tl' || displayMode === 'tl_only'
                    ? note.lyric.tl ?? note.lyric.poj ?? ''
                    : note.lyric.poj ?? note.lyric.tl ?? '';

                const hasHanji = Boolean(rawHanji && rawHanji.trim());
                const hasRoman = Boolean(rawRoman && rawRoman.trim());
                const hasExplicitText = hasHanji || hasRoman;

                if ((note.pitch === 0 || note.pitch === 'empty') && !hasExplicitText && !note.annotation) {
                  return null;
                }

                const isPitched = !isNonNotation && typeof note.pitch === 'number' && note.pitch > 0;
                const octaveTopDots = isPitched && note.octave > 0 ? note.octave : 0;
                const octaveBottomDots = isPitched && note.octave < 0 ? Math.abs(note.octave) : 0;
                const isThirtySecond = !isNonNotation && typeof note.duration === 'number' && note.duration <= 0.125;
                const isSixteenth = !isNonNotation && typeof note.duration === 'number' && (note.duration === 0.25 || note.duration === 0.375);
                const isEighth = !isNonNotation && typeof note.duration === 'number' && (note.duration === 0.5 || note.duration === 0.75);
                const showDot = !isNonNotation && (note.isDotted || note.duration === 1.5 || note.duration === 0.75 || note.duration === 3 || note.duration === 0.375 || note.duration === 1.75);
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

                let subRubyDisplay = '\u00A0';
                let mainWordDisplay = '\u00A0';
                if (effectiveMode === 'roman') {
                  mainWordDisplay = hasRoman ? rawRoman : (hasHanji ? rawHanji : '\u00A0');
                } else if (effectiveMode === 'hanlo') {
                  mainWordDisplay = hasHanji ? rawHanji : (hasRoman ? rawRoman : '\u00A0');
                } else if (effectiveMode === 'roman_major_hanlo') {
                  // 3. 羅馬字（主）+ 漢羅: 漢羅 is sub on top, 羅馬字 is major
                  subRubyDisplay = hasHanji ? rawHanji : '\u00A0';
                  mainWordDisplay = hasRoman ? rawRoman : (hasHanji ? rawHanji : '\u00A0');
                } else {
                  // 4. 漢羅（主）+ 羅馬字: 羅馬字 is sub on top, 漢羅 is major
                  subRubyDisplay = hasRoman ? rawRoman : '\u00A0';
                  mainWordDisplay = hasHanji ? rawHanji : (hasRoman ? rawRoman : '\u00A0');
                }

                const isFirstSungNote = idx === nextFirstVocalIndex;

                if (rawHanji === '\n' || rawHanji === '↵') {
                  return (
                    <div
                      key={`next-nl-${item.measureIndex}-${item.noteIndex}-${idx}`}
                      className="basis-full h-0 select-none pointer-events-none"
                    />
                  );
                }

                if (isPunctuationOrSpacer(rawHanji)) {
                  return (
                    <div
                      key={`next-punct-${item.measureIndex}-${item.noteIndex}-${idx}`}
                      className="flex items-center justify-center self-center px-0.5 text-zinc-500 font-sans select-none"
                    >
                      <span className="text-base sm:text-lg">{rawHanji}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={`next-${item.measureIndex}-${item.noteIndex}-${idx}`}
                    className={`relative flex flex-col items-center min-w-[26px] sm:min-w-[32px] px-0.5 rounded transition-all ${
                      isFirstSungNote ? 'bg-amber-500/15 ring-1 ring-amber-400/60' : ''
                    }`}
                  >
                    {/* First sung note indicator badge */}
                    {isFirstSungNote && (
                      <span className="absolute -top-3.5 text-[8px] sm:text-[9px] font-black text-amber-300 bg-amber-950 px-1 py-0 rounded border border-amber-500/70 leading-none whitespace-nowrap shadow-xs">
                        First
                      </span>
                    )}

                    {/* Top sub ruby (漢羅 on top for mode 3, or 羅馬字 on top for mode 4) */}
                    {(effectiveMode === 'roman_major_hanlo' || effectiveMode === 'hanlo_major_roman') && (
                      <span className={`text-xs sm:text-sm leading-tight select-none ${
                        effectiveMode === 'hanlo_major_roman' ? 'font-serif italic text-zinc-500' : 'font-sans text-zinc-500'
                      }`}>
                        {subRubyDisplay}
                      </span>
                    )}

                    {/* Main Lyric Word preview */}
                    <span
                      className={`text-base sm:text-lg select-none ${
                        isFirstSungNote ? 'text-amber-300/90 font-bold' : 'text-zinc-400'
                      } ${
                        effectiveMode === 'roman' || effectiveMode === 'roman_major_hanlo'
                          ? 'font-serif italic font-semibold'
                          : 'font-semibold tracking-wide'
                      }`}
                    >
                      {mainWordDisplay}
                    </span>

                    {/* Pitch preview: Complete Notation */}
                    <span className={`inline-flex flex-col items-center justify-center text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border select-none ${
                      isFirstSungNote
                        ? 'bg-amber-950/70 text-amber-300/90 border-amber-500/40 shadow-xs'
                        : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/60'
                    }`}>
                      {octaveTopDots > 0 && (
                        <span className="flex items-center justify-center gap-0.5 leading-none mb-0.5">
                          {Array.from({ length: octaveTopDots }).map((_, i) => (
                            <span key={i} className="w-1 h-1 rounded-full bg-zinc-300 inline-block" />
                          ))}
                        </span>
                      )}
                      <span className="inline-flex items-baseline justify-center leading-none">
                        {accidentalSymbol && <span className="text-[8px] text-amber-400 mr-0.5">{accidentalSymbol}</span>}
                        <span>
                          {isNonNotation
                            ? (note.annotation ? '' : '␣')
                            : note.pitch === 'empty'
                            ? '␣'
                            : note.pitch === 0
                            ? '0'
                            : note.pitch}
                        </span>
                        {showDot && <span className="text-amber-400 ml-0.2">·</span>}
                        {dashesCount > 0 && <span className="text-zinc-400 ml-0.5">{' -'.repeat(dashesCount)}</span>}
                      </span>
                      {octaveBottomDots > 0 && (
                        <span className="flex items-center justify-center gap-0.5 leading-none mt-0.5">
                          {Array.from({ length: octaveBottomDots }).map((_, i) => (
                            <span key={i} className="w-1 h-1 rounded-full bg-zinc-300 inline-block" />
                          ))}
                        </span>
                      )}
                      {isEighth && <span className="block w-full h-[1px] rounded-full bg-zinc-400 mt-0.5" />}
                      {isSixteenth && (
                        <span className="flex flex-col gap-[1px] w-full mt-0.5">
                          <span className="block w-full h-[1px] rounded-full bg-zinc-400" />
                          <span className="block w-full h-[1px] rounded-full bg-zinc-400" />
                        </span>
                      )}
                      {isThirtySecond && (
                        <span className="flex flex-col gap-[1px] w-full mt-0.5">
                          <span className="block w-full h-[1px] rounded-full bg-zinc-400" />
                          <span className="block w-full h-[1px] rounded-full bg-zinc-400" />
                          <span className="block w-full h-[1px] rounded-full bg-zinc-400" />
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="no-next-verse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.65 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-500 italic select-none"
            >
              <span>(Final Verse of Song)</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SLOT 2 (CENTER): CURRENT ACTIVE / TARGET VERSE (Vertically centered at midpoint) */}
      <div className="shrink-0 w-full max-w-6xl z-10 flex items-center justify-center py-1">
        <AnimatePresence mode="wait">
          {currentVerse && currentVerse.notes.length > 0 ? (
            <motion.div
              key={`active-${currentVerse.id}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: isEcoMode ? 0 : 0.28, ease: 'easeOut' }}
              className={`flex flex-wrap items-center justify-center ${rowGapClass} text-center w-full`}
            >
              {currentVerse.notes.map((item, idx) => {
                const note = item.note;
                const isNonNotation = isNonNotationItem(note) || note.pitch === 'empty' || (typeof note.duration === 'number' && note.duration <= 0);
                const isNoteActive =
                  !isNonNotation &&
                  note.duration > 0 &&
                  !isAwaitingVocal &&
                  playbackState.currentMeasureIndex === item.measureIndex &&
                  playbackState.currentNoteIndex === item.noteIndex;

                const isPassed =
                  !isAwaitingVocal &&
                  (item.measureIndex < playbackState.currentMeasureIndex ||
                    (item.measureIndex === playbackState.currentMeasureIndex && item.noteIndex < playbackState.currentNoteIndex));

                const rawHanji = note.lyric.hanji ?? note.lyric.custom ?? '';
                const rawRoman =
                  displayMode === 'hanji_tl' || displayMode === 'tl_only'
                    ? note.lyric.tl ?? note.lyric.poj ?? ''
                    : note.lyric.poj ?? note.lyric.tl ?? '';

                const hasHanji = Boolean(rawHanji && rawHanji.trim());
                const hasRoman = Boolean(rawRoman && rawRoman.trim());
                const hasExplicitText = hasHanji || hasRoman;

                if (rawHanji === '\n' || rawHanji === '↵') {
                  return (
                    <div
                      key={`active-nl-${item.measureIndex}-${item.noteIndex}-${idx}`}
                      className="basis-full h-0 select-none pointer-events-none"
                    />
                  );
                }

                if (isPunctuationOrSpacer(rawHanji)) {
                  return (
                    <div
                      key={`active-punct-${item.measureIndex}-${item.noteIndex}-${idx}`}
                      className="flex items-center justify-center self-center px-1 text-zinc-400 font-sans select-none"
                    >
                      <span className={hanjiSizeClass}>{rawHanji}</span>
                    </div>
                  );
                }

                if ((note.pitch === 0 || note.pitch === 'empty') && !hasExplicitText && !note.annotation) {
                  return null; // Rest or empty space without lyrics or annotation
                }

                const isPitched = !isNonNotation && typeof note.pitch === 'number' && note.pitch > 0;
                const octaveTopDots = isPitched && note.octave > 0 ? note.octave : 0;
                const octaveBottomDots = isPitched && note.octave < 0 ? Math.abs(note.octave) : 0;
                const isThirtySecond = !isNonNotation && typeof note.duration === 'number' && note.duration <= 0.125;
                const isSixteenth = !isNonNotation && typeof note.duration === 'number' && (note.duration === 0.25 || note.duration === 0.375);
                const isEighth = !isNonNotation && typeof note.duration === 'number' && (note.duration === 0.5 || note.duration === 0.75);
                const showDot = !isNonNotation && (note.isDotted || note.duration === 1.5 || note.duration === 0.75 || note.duration === 3 || note.duration === 0.375 || note.duration === 1.75);
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

                let subRubyDisplay = '\u00A0';
                let mainWordDisplay = '\u00A0';
                if (effectiveMode === 'roman') {
                  mainWordDisplay = hasRoman ? rawRoman : (hasHanji ? rawHanji : '\u00A0');
                } else if (effectiveMode === 'hanlo') {
                  mainWordDisplay = hasHanji ? rawHanji : (hasRoman ? rawRoman : '\u00A0');
                } else if (effectiveMode === 'roman_major_hanlo') {
                  // 3. 羅馬字（主）+ 漢羅: 漢羅 is sub on top, 羅馬字 is major
                  subRubyDisplay = hasHanji ? rawHanji : '\u00A0';
                  mainWordDisplay = hasRoman ? rawRoman : (hasHanji ? rawHanji : '\u00A0');
                } else {
                  // 4. 漢羅（主）+ 羅馬字: 羅馬字 is sub on top, 漢羅 is major
                  subRubyDisplay = hasRoman ? rawRoman : '\u00A0';
                  mainWordDisplay = hasHanji ? rawHanji : (hasRoman ? rawRoman : '\u00A0');
                }

                // Clean visual hint on the first vocal character when awaiting singing
                const isTargetFirstVocal = isAwaitingVocal && idx === activeFirstVocalIndex;

                return (
                  <div
                    key={`${item.measureIndex}-${item.noteIndex}-${idx}`}
                    className={`relative flex flex-col items-center transition-all duration-150 ${noteMinWClass} ${
                      dashesCount > 0 ? 'min-w-[48px] sm:min-w-[64px]' : ''
                    } ${
                      isNoteActive
                        ? 'scale-115 -translate-y-1'
                        : isTargetFirstVocal
                        ? 'scale-105'
                        : ''
                    }`}
                    style={{
                      transform: isNoteActive
                        ? 'translate3d(0, -4px, 0) scale(1.15)'
                        : isTargetFirstVocal
                        ? 'translate3d(0, -2px, 0) scale(1.05)'
                        : 'translate3d(0, 0, 0)',
                    }}
                  >
                    {/* First character visual hint */}
                    {isTargetFirstVocal && (
                      <span className="absolute -top-6 sm:-top-7 text-[9px] sm:text-[10px] font-bold text-amber-300 bg-amber-950/90 px-1.5 py-0.5 rounded border border-amber-500/60 shadow-xs whitespace-nowrap select-none">
                        First
                      </span>
                    )}

                    {/* Annotation pill if present */}
                    {note.annotation && (
                      <span className="text-[10px] font-sans font-bold text-indigo-300 bg-indigo-950/80 px-1.5 py-0.2 rounded-full border border-indigo-700/60 mb-0.5">
                        {note.annotation}
                      </span>
                    )}

                    {/* Top Sub Ruby: 漢羅 on top for mode 3, or 羅馬字 on top for mode 4 (Doubled size) */}
                    {(effectiveMode === 'roman_major_hanlo' || effectiveMode === 'hanlo_major_roman') && (
                      <span
                        className={`${subLyricSizeClass} ${
                          effectiveMode === 'hanlo_major_roman' ? 'font-serif italic' : 'font-sans font-medium'
                        } mb-0.5 leading-tight transition-colors select-none ${
                          isNoteActive
                            ? isEcoMode
                              ? 'text-amber-300 font-bold'
                              : 'text-amber-300 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                            : isTargetFirstVocal
                            ? 'text-amber-300 font-semibold'
                            : isPassed
                            ? 'text-amber-500/80'
                            : 'text-zinc-400'
                        }`}
                      >
                        {subRubyDisplay}
                      </span>
                    )}

                    {/* Main Lyric Word (羅馬字 for mode 1 & 3; 漢羅 for mode 2 & 4) */}
                    <span
                      className={`${hanjiSizeClass} tracking-wide flex items-center justify-center transition-all duration-150 select-none px-1 ${
                        effectiveMode === 'roman' || effectiveMode === 'roman_major_hanlo'
                          ? 'font-serif italic font-bold'
                          : 'font-black tracking-wider'
                      } ${
                        isNoteActive
                          ? isEcoMode
                            ? 'text-amber-300 font-black scale-105'
                            : 'text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 scale-105 drop-shadow-[0_0_16px_rgba(245,158,11,0.9)]'
                          : isTargetFirstVocal
                          ? 'text-amber-300 font-black drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                          : isPassed
                          ? 'text-amber-400 font-bold'
                          : 'text-zinc-300'
                      }`}
                    >
                      {mainWordDisplay}
                    </span>

                    {/* Corresponding Complete Numbered Notation below */}
                    <span
                      className={`mt-1.5 inline-flex flex-col items-center justify-center relative rounded-md transition-all duration-150 px-2 py-1 select-none ${
                        zoomScale >= 1.5
                          ? 'min-w-[36px] sm:min-w-[44px]'
                          : zoomScale >= 1.25
                          ? 'min-w-[30px] sm:min-w-[36px]'
                          : 'min-w-[26px] sm:min-w-[30px]'
                      } ${
                        isNoteActive
                          ? isEcoMode
                            ? 'bg-amber-400 text-zinc-950 font-black border-2 border-amber-300 shadow-md'
                            : 'bg-gradient-to-br from-amber-300 to-amber-500 text-zinc-950 font-black border-2 border-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.9)]'
                          : isTargetFirstVocal
                          ? 'bg-amber-950/80 text-amber-300 font-black border border-amber-500/80 shadow-xs ring-1 ring-amber-400/50'
                          : isPassed
                          ? 'bg-zinc-800/80 text-amber-400/90 font-bold border border-zinc-700/60'
                          : 'bg-zinc-900/80 text-zinc-400 font-medium border border-zinc-800/70'
                      }`}
                    >
                      {/* Octave high dots */}
                      {octaveTopDots > 0 && (
                        <span className="flex items-center justify-center gap-0.5 leading-none mb-0.5">
                          {Array.from({ length: octaveTopDots }).map((_, i) => (
                            <span
                              key={i}
                              className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full inline-block ${
                                isNoteActive ? 'bg-zinc-950' : isTargetFirstVocal ? 'bg-amber-300' : 'bg-zinc-300'
                              }`}
                            />
                          ))}
                        </span>
                      )}

                      {/* Main Pitch Numeral / Accidental / Dotted symbol / Dashes */}
                      <span className="inline-flex items-baseline justify-center leading-none">
                        {accidentalSymbol && (
                          <span
                            className={`text-[10px] sm:text-xs mr-0.5 font-bold ${
                              isNoteActive ? 'text-zinc-950' : 'text-amber-400'
                            }`}
                          >
                            {accidentalSymbol}
                          </span>
                        )}

                        <span
                          className={`font-mono leading-none ${
                            zoomScale >= 1.5
                              ? 'text-lg sm:text-2xl'
                              : zoomScale >= 1.25
                              ? 'text-base sm:text-xl'
                              : 'text-sm sm:text-lg'
                          } ${isNoteActive || isTargetFirstVocal ? 'font-black' : 'font-bold'}`}
                        >
                          {isNonNotation
                            ? (note.annotation ? '' : '␣')
                            : note.pitch === 'empty'
                            ? '␣'
                            : note.pitch === 0
                            ? '0'
                            : note.pitch}
                        </span>

                        {showDot && (
                          <span
                            className={`text-sm sm:text-base font-black ml-0.5 ${
                              isNoteActive ? 'text-zinc-950' : 'text-amber-400'
                            }`}
                          >
                            ·
                          </span>
                        )}

                        {dashesCount > 0 && (
                          <span
                            className={`text-xs sm:text-sm ml-1 tracking-widest ${
                              isNoteActive ? 'text-zinc-900 font-black' : 'text-zinc-400'
                            }`}
                          >
                            {' -'.repeat(dashesCount)}
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
                                isNoteActive ? 'bg-zinc-950' : isTargetFirstVocal ? 'bg-amber-300' : 'bg-zinc-300'
                              }`}
                            />
                          ))}
                        </span>
                      )}

                      {/* Underline for 8th note */}
                      {isEighth && (
                        <span
                          className={`block w-full h-[1.5px] rounded-full mt-0.5 ${
                            isNoteActive ? 'bg-zinc-950' : 'bg-zinc-400'
                          }`}
                        />
                      )}

                      {/* Double underline for 16th note */}
                      {isSixteenth && (
                        <span className="flex flex-col gap-[1px] w-full mt-0.5">
                          <span
                            className={`block w-full h-[1.5px] rounded-full ${
                              isNoteActive ? 'bg-zinc-950' : 'bg-zinc-400'
                            }`}
                          />
                          <span
                            className={`block w-full h-[1.5px] rounded-full ${
                              isNoteActive ? 'bg-zinc-950' : 'bg-zinc-400'
                            }`}
                          />
                        </span>
                      )}

                      {/* Triple underline for 32nd note */}
                      {isThirtySecond && (
                        <span className="flex flex-col gap-[1px] w-full mt-0.5">
                          <span
                            className={`block w-full h-[1.5px] rounded-full ${
                              isNoteActive ? 'bg-zinc-950' : 'bg-zinc-400'
                            }`}
                          />
                          <span
                            className={`block w-full h-[1.5px] rounded-full ${
                              isNoteActive ? 'bg-zinc-950' : 'bg-zinc-400'
                            }`}
                          />
                          <span
                            className={`block w-full h-[1.5px] rounded-full ${
                              isNoteActive ? 'bg-zinc-950' : 'bg-zinc-400'
                            }`}
                          />
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-zinc-500 italic select-none">
              <span>(Waiting for playback · Ready)</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* SLOT 3 (BOTTOM): BALANCED SPACER (Ensures Slot 2 remains at exact vertical center) */}
      <div className="flex-1 w-full flex items-center justify-center pointer-events-none min-h-[52px]" aria-hidden="true" />
    </div>
  );
});

KaraokeStage.displayName = 'KaraokeStage';
