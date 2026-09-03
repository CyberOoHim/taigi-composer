'use client';

import React, { useMemo } from 'react';
import { Song } from '@/types/song';
import { getMeasureRhythmReport } from '@/lib/taigiUtils';
import { Bookmark, AlertCircle } from 'lucide-react';

interface SectionRailProps {
  song: Song;
  selectedMeasureIndex: number | null;
  onSelectMeasure: (measureIndex: number) => void;
  playingMeasureIdx?: number | null;
}

interface SectionItem {
  id: string;
  name: string;
  startMeasureIndex: number;
  endMeasureIndex: number;
  startMeasureNumber: number;
  endMeasureNumber: number;
  chord?: string;
  noteCount: number;
  hasIncompleteMeasures: boolean;
}

export const SectionRail: React.FC<SectionRailProps> = React.memo(({
  song,
  selectedMeasureIndex,
  onSelectMeasure,
  playingMeasureIdx,
}) => {
  const sections = useMemo<SectionItem[]>(() => {
    if (!song.measures || song.measures.length === 0) return [];

    const sectionStarts: { index: number; name: string }[] = [];

    song.measures.forEach((m, idx) => {
      if (m.section && m.section.trim()) {
        sectionStarts.push({ index: idx, name: m.section.trim() });
      }
    });

    if (sectionStarts.length === 0 || sectionStarts[0].index !== 0) {
      sectionStarts.unshift({
        index: 0,
        name: sectionStarts.length > 0 ? 'Intro' : 'Section 1',
      });
    }

    // Chunk every 4 measures if there's only 1 default section and no explicit markers
    if (sectionStarts.length === 1 && !song.measures[0]?.section && song.measures.length > 4) {
      const chunkSize = song.notesPerLine || 4;
      sectionStarts.length = 0;
      for (let i = 0; i < song.measures.length; i += chunkSize) {
        const secNum = Math.floor(i / chunkSize) + 1;
        sectionStarts.push({ index: i, name: `Section ${secNum}` });
      }
    }

    return sectionStarts.map((curr, i) => {
      const next = sectionStarts[i + 1];
      const startMeasureIndex = curr.index;
      const endMeasureIndex = next ? next.index - 1 : song.measures.length - 1;

      let noteCount = 0;
      let hasIncompleteMeasures = false;
      for (let m = startMeasureIndex; m <= endMeasureIndex; m++) {
        const curM = song.measures[m];
        if (curM) {
          noteCount += curM.notes.length || 0;
          const report = getMeasureRhythmReport(curM, song.timeSignature || '4/4');
          if (!report.isFull) {
            hasIncompleteMeasures = true;
          }
        }
      }

      return {
        id: `sec-${i}-${startMeasureIndex}`,
        name: curr.name,
        startMeasureIndex,
        endMeasureIndex,
        startMeasureNumber: song.measures[startMeasureIndex]?.measureNumber || startMeasureIndex + 1,
        endMeasureNumber: song.measures[endMeasureIndex]?.measureNumber || endMeasureIndex + 1,
        chord: song.measures[startMeasureIndex]?.chord,
        noteCount,
        hasIncompleteMeasures,
      };
    });
  }, [song]);

  if (sections.length <= 1 && song.measures.length <= 4) {
    return null;
  }

  return (
    <div
      id="composer-section-rail"
      className="flex items-center gap-2 p-2.5 bg-white/95 dark:bg-[#141720]/95 backdrop-blur-md rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 shadow-2xs overflow-x-auto select-none no-scrollbar touch-pan-x"
    >
      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 shrink-0 pl-1">
        <Bookmark className="w-4 h-4 text-amber-500" />
        <span className="hidden sm:inline">Sections:</span>
      </div>

      <div className="flex items-center gap-2 flex-nowrap shrink-0">
        {sections.map((sec) => {
          const isSelected =
            selectedMeasureIndex !== null &&
            selectedMeasureIndex >= sec.startMeasureIndex &&
            selectedMeasureIndex <= sec.endMeasureIndex;

          const isPlaying =
            playingMeasureIdx !== null &&
            playingMeasureIdx !== undefined &&
            playingMeasureIdx >= sec.startMeasureIndex &&
            playingMeasureIdx <= sec.endMeasureIndex;

          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => onSelectMeasure(sec.startMeasureIndex)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 cursor-pointer touch-manipulation min-h-[44px] ${
                isPlaying
                  ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 font-black animate-pulse shadow-xs'
                  : isSelected
                  ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-400/70 shadow-xs'
                  : 'bg-zinc-100 dark:bg-[#0a0c10] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/90 dark:border-zinc-800'
              }`}
              title={`Jump to ${sec.name} (Measures #${sec.startMeasureNumber}-#${sec.endMeasureNumber} · ${sec.noteCount} notes)`}
            >
              <span>{sec.name}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                  isSelected
                    ? 'bg-amber-500/30 text-amber-950 dark:text-amber-100 font-bold'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                #{sec.startMeasureNumber}-{sec.endMeasureNumber}
              </span>
              {sec.chord && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hidden md:inline">
                  [{sec.chord}]
                </span>
              )}
              {sec.hasIncompleteMeasures && (
                <span className="shrink-0 flex items-center" title="Section contains incomplete measure(s)">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

SectionRail.displayName = 'SectionRail';
