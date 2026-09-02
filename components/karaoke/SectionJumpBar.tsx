'use client';

import React from 'react';
import { Bookmark } from 'lucide-react';

export interface KaraokeSection {
  id: string;
  name: string;
  startMeasureIndex: number;
  endMeasureIndex: number;
  startMeasureNumber: number;
  endMeasureNumber: number;
  startTimeSec: number;
  durationSec: number;
  startPercent: number;
  endPercent: number;
  chord?: string;
  firstLyricSnippet: string;
}

interface SectionJumpBarProps {
  songSections: KaraokeSection[];
  activeSection: KaraokeSection | null;
  onJumpToSection: (section: KaraokeSection) => void;
  formatTime: (seconds: number) => string;
  sectionScrollRef: React.RefObject<HTMLDivElement | null>;
}

export const SectionJumpBar: React.FC<SectionJumpBarProps> = ({
  songSections,
  activeSection,
  onJumpToSection,
  formatTime,
  sectionScrollRef,
}) => {
  return (
    <div className="bg-zinc-900/90 px-4 py-3 border-b border-zinc-800/80">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bookmark className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold tracking-wide text-zinc-200">
            段落觸控跳轉 (Touch Sections to Jump)
          </span>
          <span className="text-[11px] text-zinc-500 hidden md:inline">
            · 觸控任一段落立即跳轉演奏
          </span>
        </div>
        {activeSection && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
            目前段落: {activeSection.name}
          </span>
        )}
      </div>

      {/* Touch-Friendly Section Cards Carousel */}
      <div
        ref={sectionScrollRef}
        className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scroll-smooth"
      >
        {songSections.map((sec, sIdx) => {
          const isSectionActive = activeSection?.id === sec.id;
          return (
            <button
              key={sec.id}
              id={`ktv-section-jump-btn-${sIdx}`}
              type="button"
              onClick={() => onJumpToSection(sec)}
              className={`shrink-0 min-h-[48px] px-3.5 py-2 rounded-xl border text-left transition-all cursor-pointer select-none active:scale-95 touch-manipulation flex items-center gap-3 ${
                isSectionActive
                  ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/20 border-amber-400 ring-2 ring-amber-500/30 text-white shadow-lg shadow-amber-500/10'
                  : 'bg-zinc-950/70 border-zinc-800/90 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-700'
              }`}
              title={`點擊跳轉至「${sec.name}」(${formatTime(sec.startTimeSec)})`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  isSectionActive
                    ? 'bg-amber-400 text-zinc-950 shadow-xs'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {sIdx + 1}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${isSectionActive ? 'text-amber-300' : 'text-zinc-200'}`}>
                    {sec.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/90 text-zinc-400">
                    {formatTime(sec.startTimeSec)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5">
                  <span>#{sec.startMeasureNumber}~#{sec.endMeasureNumber}小節</span>
                  {sec.firstLyricSnippet && (
                    <span className="text-zinc-500 max-w-[130px] truncate hidden sm:inline">
                      · {sec.firstLyricSnippet}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
