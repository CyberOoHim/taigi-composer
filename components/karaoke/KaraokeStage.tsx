'use client';

import React from 'react';
import { LyricDisplayMode, VerseItem } from '@/types/song';
import { PlaybackState } from '@/lib/audioEngine';
import { KaraokeSection } from './SectionJumpBar';
import { isNonNotationItem } from '@/lib/taigiUtils';
import { Sparkles } from 'lucide-react';

interface KaraokeStageProps {
  currentVerse: VerseItem | null;
  nextVerse: VerseItem | null;
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

  const romanSizeClass =
    zoomScale >= 1.5
      ? 'text-sm sm:text-base md:text-lg'
      : zoomScale >= 1.25
      ? 'text-xs sm:text-sm md:text-base'
      : 'text-xs sm:text-sm';

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

  return (
    <div className="relative flex flex-col items-center justify-center p-6 sm:p-10 min-h-[300px] sm:min-h-[340px] bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900 border-b border-zinc-800/80 select-none overflow-hidden">
      {/* Background Ambience / Disco Glow (Omitted in Eco Mode to save GPU power) */}
      {!isEcoMode && (
        <>
          <div className="eco-hide-ambient absolute -top-24 -left-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="eco-hide-ambient absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        </>
      )}

      {/* Current Active Section Badge */}
      {activeSection && (
        <button
          id="ktv-stage-active-section-badge"
          type="button"
          onClick={() => onJumpToSection(activeSection)}
          className="mb-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-800/90 hover:bg-zinc-700/90 border border-amber-500/40 text-xs font-semibold text-amber-300 shadow-md transition-all active:scale-95 cursor-pointer z-20"
          title={`點擊重新從「${activeSection.name}」開始`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{activeSection.name}</span>
          <span className="text-[10px] text-zinc-400 font-mono">
            (#{activeSection.startMeasureNumber}~#{activeSection.endMeasureNumber})
          </span>
        </button>
      )}

      {/* TOP ROW: SUCCEEDING / COMING VERSE PREVIEW (Faded on top of current verse) */}
      <div className="w-full max-w-5xl flex flex-col items-center justify-center mb-5 sm:mb-7 min-h-[50px] sm:min-h-[58px] z-10">
        {nextVerse && nextVerse.notes.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-2 opacity-60 hover:opacity-85 transition-opacity">
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 shrink-0 select-none">
              <span>下句</span>
              <span className="text-[9px] text-zinc-500 font-mono">
                #{nextVerse.startMeasureNumber}~#{nextVerse.endMeasureNumber}
              </span>
            </span>

            {nextVerse.notes.map((item, idx) => {
              const note = item.note;
              const isNonNotation = isNonNotationItem(note);
              const rawHanji = note.lyric.hanji ?? note.lyric.custom ?? '';
              const rawRoman =
                displayMode === 'hanji_pij' || displayMode === 'pij_only'
                  ? note.lyric.pij ?? note.lyric.poj ?? ''
                  : note.lyric.poj ?? note.lyric.pij ?? '';

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

              const romanDisplay = hasRoman ? rawRoman : '\u00A0';
              let mainWordDisplay = '\u00A0';
              if (displayMode === 'poj_only' || displayMode === 'pij_only') {
                mainWordDisplay = hasRoman ? rawRoman : '\u00A0';
              } else if (hasHanji) {
                mainWordDisplay = rawHanji;
              } else if (hasRoman) {
                mainWordDisplay = rawRoman;
              }

              return (
                <div
                  key={`next-${item.measureIndex}-${item.noteIndex}-${idx}`}
                  className="flex flex-col items-center min-w-[26px] sm:min-w-[30px]"
                >
                  {/* Romanization Ruby preview */}
                  {(displayMode === 'all' || displayMode === 'hanji_poj' || displayMode === 'hanji_pij') && (
                    <span className="text-[10px] sm:text-xs font-serif italic text-zinc-400/90 leading-tight select-none">
                      {romanDisplay}
                    </span>
                  )}

                  {/* Hanji / Main Lyric Word preview */}
                  <span
                    className={`text-base sm:text-xl font-bold tracking-wide text-zinc-300 select-none ${
                      displayMode === 'poj_only' || displayMode === 'pij_only' ? 'font-serif italic text-sm sm:text-base' : ''
                    }`}
                  >
                    {mainWordDisplay}
                  </span>

                  {/* Pitch preview: Complete Notation */}
                  <span className="inline-flex flex-col items-center justify-center text-[9px] font-mono font-bold text-zinc-300 bg-zinc-900/90 px-1.5 py-0.5 rounded border border-zinc-800 select-none">
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
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500/70 italic select-none">
            <span>(尾聲 · Final Verse)</span>
          </div>
        )}
      </div>

      {/* CENTER ROW: CURRENT ACTIVE VERSE (Big KTV Sweeping Lyrics) */}
      <div className={`flex flex-wrap items-center justify-center ${rowGapClass} max-w-6xl text-center z-10 min-h-[96px] sm:min-h-[110px]`}>
        {currentVerse && currentVerse.notes.length > 0 ? (
          currentVerse.notes.map((item, idx) => {
            const note = item.note;
            const isNonNotation = isNonNotationItem(note);
            const isNoteActive =
              playbackState.currentMeasureIndex === item.measureIndex &&
              playbackState.currentNoteIndex === item.noteIndex;

            const isPassed =
              item.measureIndex < playbackState.currentMeasureIndex ||
              (item.measureIndex === playbackState.currentMeasureIndex && item.noteIndex < playbackState.currentNoteIndex);

            const rawHanji = note.lyric.hanji ?? note.lyric.custom ?? '';
            const rawRoman =
              displayMode === 'hanji_pij' || displayMode === 'pij_only'
                ? note.lyric.pij ?? note.lyric.poj ?? ''
                : note.lyric.poj ?? note.lyric.pij ?? '';

            const hasHanji = Boolean(rawHanji && rawHanji.trim());
            const hasRoman = Boolean(rawRoman && rawRoman.trim());
            const hasExplicitText = hasHanji || hasRoman;

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

            const romanDisplay = hasRoman ? rawRoman : '\u00A0';
            let mainWordDisplay = '\u00A0';
            if (displayMode === 'poj_only' || displayMode === 'pij_only') {
              mainWordDisplay = hasRoman ? rawRoman : '\u00A0';
            } else if (hasHanji) {
              mainWordDisplay = rawHanji;
            } else if (hasRoman) {
              mainWordDisplay = rawRoman;
            }

            return (
              <div
                key={`${item.measureIndex}-${item.noteIndex}-${idx}`}
                className={`relative flex flex-col items-center transition-transform duration-150 ${noteMinWClass} ${
                  dashesCount > 0 ? 'min-w-[48px] sm:min-w-[64px]' : ''
                } ${
                  isNoteActive ? 'scale-115 -translate-y-1' : ''
                }`}
                style={{ transform: isNoteActive ? 'translate3d(0, -4px, 0) scale(1.15)' : 'translate3d(0, 0, 0)' }}
              >
                {/* Annotation pill if present */}
                {note.annotation && (
                  <span className="text-[10px] font-sans font-bold text-indigo-300 bg-indigo-950/80 px-1.5 py-0.2 rounded-full border border-indigo-700/60 mb-0.5">
                    {note.annotation}
                  </span>
                )}

                {/* Romanization (POJ / PIJ) Ruby above: span:nth-of-type(1) */}
                {(displayMode === 'all' || displayMode === 'hanji_poj' || displayMode === 'hanji_pij') && (
                  <span
                    className={`${romanSizeClass} font-serif italic mb-0.5 min-h-[1.25rem] transition-colors select-none ${
                      isNoteActive
                        ? isEcoMode
                          ? 'text-amber-300 font-bold'
                          : 'text-amber-300 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                        : isPassed
                        ? 'text-amber-500/80'
                        : 'text-zinc-400'
                    }`}
                  >
                    {romanDisplay}
                  </span>
                )}

                {/* Hanji / Main Lyric Word: span:nth-of-type(2) */}
                <span
                  className={`${hanjiSizeClass} font-black tracking-wider flex items-center justify-center transition-all duration-150 select-none px-1 ${
                    displayMode === 'poj_only' || displayMode === 'pij_only' ? 'font-serif italic text-xl sm:text-3xl md:text-4xl' : ''
                  } ${
                    isNoteActive
                      ? isEcoMode
                        ? 'text-amber-300 font-black scale-105'
                        : 'text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 scale-105 drop-shadow-[0_0_16px_rgba(245,158,11,0.9)]'
                      : isPassed
                      ? 'text-amber-400 font-bold'
                      : 'text-zinc-300'
                  }`}
                >
                  {mainWordDisplay}
                </span>

                {/* Corresponding Complete Jianpu Notation below: span:nth-of-type(3) */}
                <span
                  className={`mt-1.5 inline-flex flex-col items-center justify-center relative rounded-md transition-all duration-150 px-2 py-1 select-none ${
                    zoomScale >= 1.5
                      ? 'min-w-[36px] sm:min-w-[44px]'
                      : zoomScale >= 1.25
                      ? 'min-w-[32px] sm:min-w-[38px]'
                      : 'min-w-[28px] sm:min-w-[32px]'
                  } ${
                    isNoteActive
                      ? 'bg-amber-400 text-zinc-950 ring-2 ring-amber-300/90 shadow-[0_0_12px_rgba(251,191,36,0.5)] font-black scale-105'
                      : isPassed
                      ? 'bg-zinc-800/95 text-amber-300 border border-amber-500/40 shadow-xs font-bold'
                      : 'bg-zinc-900/95 text-zinc-200 border border-zinc-700/70 shadow-xs font-bold'
                  }`}
                >
                  {/* Slur / Tie Arc */}
                  {note.isTied && !isNonNotation && (
                    <span className={`absolute -top-3 text-[11px] font-bold leading-none select-none ${
                      isNoteActive ? 'text-zinc-950' : isPassed ? 'text-amber-300' : 'text-zinc-400'
                    }`}>⌒</span>
                  )}

                  {/* Top Octave Dots */}
                  {octaveTopDots > 0 && (
                    <span className="flex items-center justify-center gap-0.5 leading-none mb-0.5 z-10">
                      {Array.from({ length: octaveTopDots }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full inline-block ${
                            isNoteActive ? 'bg-zinc-950' : isPassed ? 'bg-amber-400' : 'bg-zinc-200'
                          }`}
                        />
                      ))}
                    </span>
                  )}

                  {/* Main Pitch Numeral, Accidental, Dotted Dot, and Extension Dashes */}
                  <span
                    className={`inline-flex items-baseline justify-center font-mono font-bold leading-none tracking-tight ${
                      zoomScale >= 1.5 ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                    }`}
                  >
                    {accidentalSymbol && (
                      <span
                        className={`text-[10px] sm:text-xs font-black mr-0.5 ${
                          isNoteActive ? 'text-zinc-950' : 'text-amber-400'
                        }`}
                      >
                        {accidentalSymbol}
                      </span>
                    )}
                    <span>
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
                        className={`font-black text-sm ml-0.5 ${
                          isNoteActive ? 'text-zinc-950' : 'text-amber-400'
                        }`}
                      >
                        ·
                      </span>
                    )}
                    {dashesCount > 0 && (
                      <span
                        className={`font-mono font-bold ml-1 tracking-wider ${
                          isNoteActive ? 'text-zinc-950 font-black' : isPassed ? 'text-amber-300' : 'text-zinc-400'
                        }`}
                      >
                        {' -'.repeat(dashesCount)}
                      </span>
                    )}
                  </span>

                  {/* Bottom Octave Dots */}
                  {octaveBottomDots > 0 && (
                    <span className="flex items-center justify-center gap-0.5 leading-none mt-0.5 z-10">
                      {Array.from({ length: octaveBottomDots }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full inline-block ${
                            isNoteActive ? 'bg-zinc-950' : isPassed ? 'bg-amber-400' : 'bg-zinc-200'
                          }`}
                        />
                      ))}
                    </span>
                  )}

                  {/* Duration Underlines (減時線) */}
                  {isEighth && (
                    <span
                      className={`block w-full h-[1.5px] sm:h-[2px] rounded-full mt-1 ${
                        isNoteActive ? 'bg-zinc-950' : isPassed ? 'bg-amber-400' : 'bg-zinc-300'
                      }`}
                    />
                  )}
                  {isSixteenth && (
                    <span className="flex flex-col gap-[1.5px] w-full mt-1">
                      <span
                        className={`block w-full h-[1.5px] rounded-full ${
                          isNoteActive ? 'bg-zinc-950' : isPassed ? 'bg-amber-400' : 'bg-zinc-300'
                        }`}
                      />
                      <span
                        className={`block w-full h-[1.5px] rounded-full ${
                          isNoteActive ? 'bg-zinc-950' : isPassed ? 'bg-amber-400' : 'bg-zinc-300'
                        }`}
                      />
                    </span>
                  )}
                  {isThirtySecond && (
                    <span className="flex flex-col gap-[1px] w-full mt-1">
                      <span
                        className={`block w-full h-[1.5px] rounded-full ${
                          isNoteActive ? 'bg-zinc-950' : isPassed ? 'bg-amber-400' : 'bg-zinc-300'
                        }`}
                      />
                      <span
                        className={`block w-full h-[1.5px] rounded-full ${
                          isNoteActive ? 'bg-zinc-950' : isPassed ? 'bg-amber-400' : 'bg-zinc-300'
                        }`}
                      />
                      <span
                        className={`block w-full h-[1.5px] rounded-full ${
                          isNoteActive ? 'bg-zinc-950' : isPassed ? 'bg-amber-400' : 'bg-zinc-300'
                        }`}
                      />
                    </span>
                  )}
                </span>
              </div>
            );
          })
        ) : (
          <div className="text-zinc-500 italic text-sm">(無歌詞樂句)</div>
        )}
      </div>
    </div>
  );
});

KaraokeStage.displayName = 'KaraokeStage';
