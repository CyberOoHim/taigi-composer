'use client';

import React from 'react';
import { LyricDisplayMode, Song } from '@/types/song';
import { AudioEngine, PlaybackState } from '@/lib/audioEngine';
import { JianpuNoteComponent } from '../JianpuNoteComponent';
import { KaraokeSection } from './SectionJumpBar';
import { Music, Pencil } from 'lucide-react';

interface AlignedScoreRollProps {
  song: Song;
  playbackState: PlaybackState;
  displayMode: LyricDisplayMode;
  songSections: KaraokeSection[];
  audioEngine: AudioEngine;
  sheetScrollRef: React.RefObject<HTMLDivElement | null>;
  loopRange?: { startMeasure: number; endMeasure: number } | null;
  onSelectMeasure?: (measureIndex: number) => void;
  onEditMeasure?: (measureIndex: number) => void;
  onEditSection?: (section: KaraokeSection) => void;
}

export const AlignedScoreRoll: React.FC<AlignedScoreRollProps> = React.memo(({
  song,
  playbackState,
  displayMode,
  songSections,
  audioEngine,
  sheetScrollRef,
  loopRange,
  onSelectMeasure,
  onEditMeasure,
  onEditSection,
}) => {
  return (
    <div className="bg-zinc-900/60 p-4 border-b border-zinc-800/80">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
          <Music className="w-3.5 h-3.5 text-amber-400" />
          <span>Aligned Numbered Music Notation Roll</span>
          {loopRange && (
            <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-600/50 px-2 py-0.5 rounded-md">
              A-B Loop: #{loopRange.startMeasure + 1} - #{loopRange.endMeasure + 1}
            </span>
          )}
        </div>
        <span className="text-[11px] text-zinc-500">
          Measure {playbackState.currentMeasureIndex + 1} of {song.measures.length}
        </span>
      </div>

      <div
        ref={sheetScrollRef}
        className="flex items-center gap-3 overflow-x-auto pb-3 pt-1 scroll-smooth"
      >
        {song.measures.map((measure, mIdx) => {
          const isMeasureActive = playbackState.currentMeasureIndex === mIdx;
          const isInLoopRange = loopRange && mIdx >= loopRange.startMeasure && mIdx <= loopRange.endMeasure;
          const isLoopStart = loopRange && mIdx === loopRange.startMeasure;
          const isLoopEnd = loopRange && mIdx === loopRange.endMeasure;

          return (
            <div
              key={measure.id}
              data-measure-idx={mIdx}
              onClick={() => {
                audioEngine.seekToMeasure(song, mIdx);
                if (onSelectMeasure) onSelectMeasure(mIdx);
              }}
              className={`shrink-0 flex flex-col p-2.5 rounded-xl border transition-all cursor-pointer ${
                isMeasureActive
                  ? 'bg-zinc-800/90 border-amber-500/80 ring-2 ring-amber-500/30 shadow-lg'
                  : isInLoopRange
                  ? 'bg-amber-950/25 border-amber-500/50 hover:border-amber-400'
                  : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700'
              }`}
              title={`Click to jump to Measure #${mIdx + 1}${isInLoopRange ? ' (A-B Loop Range)' : ''}`}
            >
              {/* Measure Header with Section info and Edit button */}
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 px-1">
                <div className="flex items-center gap-1">
                  <span className="font-mono font-semibold">#{measure.measureNumber}</span>
                  {isLoopStart && (
                    <span className="text-[9px] font-black font-mono text-zinc-950 bg-amber-400 px-1 py-0.2 rounded shadow-2xs">
                      Loop A
                    </span>
                  )}
                  {isLoopEnd && (
                    <span className="text-[9px] font-black font-mono text-zinc-950 bg-amber-400 px-1 py-0.2 rounded shadow-2xs">
                      Loop B
                    </span>
                  )}
                  {measure.section && (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/60">
                      {measure.section}
                    </span>
                  )}
                  {measure.chord && (
                    <span className="font-bold text-amber-400 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/50">
                      {measure.chord}
                    </span>
                  )}
                </div>

                {/* Edit Icon in Measure Card */}
                {(onEditMeasure || onEditSection) && (
                  <button
                    id={`ktv-measure-edit-btn-${mIdx}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onEditMeasure) {
                        onEditMeasure(mIdx);
                      } else if (onEditSection) {
                        const sec = songSections.find(s => s.startMeasureIndex <= mIdx && s.endMeasureIndex >= mIdx);
                        if (sec) {
                          onEditSection(sec);
                        } else {
                          onEditSection({
                            id: `sec-${mIdx}`,
                            name: measure.section || `Measure #${mIdx + 1}`,
                            startMeasureIndex: mIdx,
                            endMeasureIndex: mIdx,
                            startMeasureNumber: measure.measureNumber,
                            endMeasureNumber: measure.measureNumber,
                            startTimeSec: 0,
                            durationSec: 0,
                            startPercent: 0,
                            endPercent: 0,
                            firstLyricSnippet: '',
                          });
                        }
                      }
                    }}
                    className="p-1 rounded-md text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 active:scale-90 transition-all cursor-pointer border border-transparent hover:border-zinc-700 ml-1.5"
                    title="Edit this section/measure (switch to Score Editor)"
                    aria-label={`Edit Measure #${mIdx + 1}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Notes in Measure */}
              <div className="flex items-center gap-1.5">
                {measure.notes.map((note, nIdx) => {
                  const isNoteActive = isMeasureActive && playbackState.currentNoteIndex === nIdx;
                  return (
                    <JianpuNoteComponent
                      key={note.id}
                      note={note}
                      isActive={isNoteActive}
                      displayMode={displayMode}
                      isKaraokeMode={true}
                    />
                  );
                })}
                {/* Barline */}
                <div className="w-[1.5px] h-10 bg-zinc-700 mx-1 self-center" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

AlignedScoreRoll.displayName = 'AlignedScoreRoll';
