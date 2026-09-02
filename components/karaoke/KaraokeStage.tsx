'use client';

import React from 'react';
import { LyricDisplayMode, VerseItem } from '@/types/song';
import { PlaybackState } from '@/lib/audioEngine';
import { KaraokeSection } from './SectionJumpBar';
import { Sparkles } from 'lucide-react';

interface KaraokeStageProps {
  currentVerse: VerseItem | null;
  nextVerse: VerseItem | null;
  activeSection: KaraokeSection | null;
  playbackState: PlaybackState;
  displayMode: LyricDisplayMode;
  onJumpToSection: (section: KaraokeSection) => void;
  isEcoMode?: boolean;
}

export const KaraokeStage: React.FC<KaraokeStageProps> = React.memo(({
  currentVerse,
  nextVerse,
  activeSection,
  playbackState,
  displayMode,
  onJumpToSection,
  isEcoMode = false,
}) => {
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
              const rawHanji = item.note.lyric.hanji ?? item.note.lyric.custom ?? '';
              const rawRoman =
                displayMode === 'hanji_pij' || displayMode === 'pij_only'
                  ? item.note.lyric.pij ?? item.note.lyric.poj ?? ''
                  : item.note.lyric.poj ?? item.note.lyric.pij ?? '';

              const hasHanji = Boolean(rawHanji && rawHanji.trim());
              const hasRoman = Boolean(rawRoman && rawRoman.trim());
              const hasExplicitText = hasHanji || hasRoman;

              if ((item.note.pitch === 0 || item.note.pitch === 'empty') && !hasExplicitText && !item.note.annotation) {
                return null;
              }

              const isPitched = typeof item.note.pitch === 'number' && item.note.pitch > 0;
              const pitchLabel =
                item.note.pitch === 'empty'
                  ? '␣'
                  : item.note.pitch === 0
                  ? '0'
                  : `${item.note.accidental || ''}${item.note.pitch}`;

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
                  className="flex flex-col items-center min-w-[24px] sm:min-w-[28px]"
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

                  {/* Pitch preview */}
                  <span className="text-[9px] font-mono text-zinc-400 bg-zinc-900/80 px-1 py-0.2 rounded border border-zinc-800">
                    {pitchLabel}
                    {isPitched && item.note.octave > 0 ? '̇' : isPitched && item.note.octave < 0 ? '̣' : ''}
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
      <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-3.5 max-w-5xl text-center z-10 min-h-[96px] sm:min-h-[110px]">
        {currentVerse && currentVerse.notes.length > 0 ? (
          currentVerse.notes.map((item, idx) => {
            const isNoteActive =
              playbackState.currentMeasureIndex === item.measureIndex &&
              playbackState.currentNoteIndex === item.noteIndex;

            const isPassed =
              item.measureIndex < playbackState.currentMeasureIndex ||
              (item.measureIndex === playbackState.currentMeasureIndex && item.noteIndex < playbackState.currentNoteIndex);

            const rawHanji = item.note.lyric.hanji ?? item.note.lyric.custom ?? '';
            const rawRoman =
              displayMode === 'hanji_pij' || displayMode === 'pij_only'
                ? item.note.lyric.pij ?? item.note.lyric.poj ?? ''
                : item.note.lyric.poj ?? item.note.lyric.pij ?? '';

            const hasHanji = Boolean(rawHanji && rawHanji.trim());
            const hasRoman = Boolean(rawRoman && rawRoman.trim());
            const hasExplicitText = hasHanji || hasRoman;

            if ((item.note.pitch === 0 || item.note.pitch === 'empty') && !hasExplicitText && !item.note.annotation) {
              return null; // Rest or empty space without lyrics or annotation
            }

            const isPitched = typeof item.note.pitch === 'number' && item.note.pitch > 0;
            const pitchLabel =
              item.note.pitch === 'empty'
                ? '␣'
                : item.note.pitch === 0
                ? '0'
                : `${item.note.accidental || ''}${item.note.pitch}`;

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
                className={`relative flex flex-col items-center transition-transform duration-150 min-w-[32px] sm:min-w-[40px] ${
                  isNoteActive ? 'scale-115 -translate-y-1' : ''
                }`}
                style={{ transform: isNoteActive ? 'translate3d(0, -4px, 0) scale(1.15)' : 'translate3d(0, 0, 0)' }}
              >
                {/* Annotation pill if present */}
                {item.note.annotation && (
                  <span className="text-[10px] font-sans font-bold text-indigo-300 bg-indigo-950/80 px-1.5 py-0.2 rounded-full border border-indigo-700/60 mb-0.5">
                    {item.note.annotation}
                  </span>
                )}

                {/* Romanization (POJ / PIJ) Ruby above */}
                {(displayMode === 'all' || displayMode === 'hanji_poj' || displayMode === 'hanji_pij') && (
                  <span
                    className={`text-xs sm:text-sm font-serif italic mb-0.5 min-h-[1.25rem] transition-colors select-none ${
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

                {/* Hanji / Main Lyric Word */}
                <span
                  className={`text-2xl sm:text-4xl md:text-5xl font-black tracking-wider min-h-[2.5rem] sm:min-h-[3.25rem] flex items-center justify-center transition-all duration-150 select-none ${
                    displayMode === 'poj_only' || displayMode === 'pij_only' ? 'font-serif italic text-xl sm:text-3xl md:text-4xl' : ''
                  } ${
                    isNoteActive
                      ? isEcoMode
                        ? 'text-amber-300 font-black scale-105'
                        : 'text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 scale-105 drop-shadow-[0_0_16px_rgba(245,158,11,0.9)]'
                      : isPassed
                      ? 'text-amber-400'
                      : 'text-zinc-300'
                  }`}
                >
                  {mainWordDisplay}
                </span>

                {/* Corresponding Jianpu Number below */}
                <span
                  className={`mt-1 text-xs sm:text-sm font-mono font-bold px-1.5 py-0.5 rounded transition-colors ${
                    isNoteActive
                      ? 'bg-amber-400 text-zinc-950 ring-2 ring-amber-300 shadow-md'
                      : isPassed
                      ? 'bg-zinc-800 text-amber-300/80'
                      : 'bg-zinc-900/90 text-zinc-400 border border-zinc-800'
                  }`}
                >
                  {pitchLabel}
                  {isPitched && item.note.octave > 0 ? '̇' : isPitched && item.note.octave < 0 ? '̣' : ''}
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
