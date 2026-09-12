'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Song } from '@/types/song';
import {
  InSongFilter,
  InSongMatchLocation,
  InSongSearchResult,
  searchWithinSong,
  highlightMatch,
} from '@/lib/lyricSearch';
import {
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Layers,
  AlignLeft,
  ListOrdered,
} from 'lucide-react';

export interface InSongSearchBarProps {
  song: Song;
  isOpen: boolean;
  onClose: () => void;
  onJumpToMeasure: (measureIndex: number) => void;
  onJumpToVerse?: (verseIndex: number, startMeasureIndex: number) => void;
  onActiveMatchChange?: (match: InSongMatchLocation | null) => void;
}

export const InSongSearchBar: React.FC<InSongSearchBarProps> = ({
  song,
  isOpen,
  onClose,
  onJumpToMeasure,
  onJumpToVerse,
  onActiveMatchChange,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InSongFilter>('all');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const chipContainerRef = useRef<HTMLDivElement>(null);

  // Compute search result
  const searchResult = useMemo<InSongSearchResult>(() => {
    if (!query.trim()) {
      return {
        query: '',
        songId: song.id,
        songTitle: song.title,
        totalMeasureMatches: 0,
        totalVerseMatches: 0,
        totalMatches: 0,
        measureMatches: [],
        verseMatches: [],
        allMatches: [],
      };
    }
    return searchWithinSong(song, query, filter);
  }, [song, query, filter]);

  const matches = searchResult.allMatches;
  const totalMatches = matches.length;

  // Reset index during rendering if query or filter changed
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevFilter, setPrevFilter] = useState(filter);
  if (query !== prevQuery || filter !== prevFilter) {
    setPrevQuery(query);
    setPrevFilter(filter);
    setCurrentMatchIndex(0);
  }

  const effectiveMatchIndex = totalMatches > 0 ? Math.min(currentMatchIndex, totalMatches - 1) : 0;

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Execute jump to a match
  const handleJumpToMatch = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= matches.length) return;
      setCurrentMatchIndex(idx);
      const match = matches[idx];
      onActiveMatchChange?.(match);

      if (match.type === 'verse' && typeof match.verseIndex === 'number' && onJumpToVerse) {
        onJumpToVerse(match.verseIndex, match.measureIndex);
      } else {
        onJumpToMeasure(match.measureIndex);
      }

      // Scroll the selected pill into view
      const container = chipContainerRef.current;
      if (container) {
        const pill = container.querySelector<HTMLElement>(`[data-chip-index="${idx}"]`);
        if (pill) {
          pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    },
    [matches, onActiveMatchChange, onJumpToMeasure, onJumpToVerse]
  );

  const handleNextMatch = useCallback(() => {
    if (totalMatches === 0) return;
    const nextIdx = (effectiveMatchIndex + 1) % totalMatches;
    handleJumpToMatch(nextIdx);
  }, [effectiveMatchIndex, totalMatches, handleJumpToMatch]);

  const handlePrevMatch = useCallback(() => {
    if (totalMatches === 0) return;
    const prevIdx = (effectiveMatchIndex - 1 + totalMatches) % totalMatches;
    handleJumpToMatch(prevIdx);
  }, [effectiveMatchIndex, totalMatches, handleJumpToMatch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrevMatch();
      } else {
        handleNextMatch();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="in-song-search-bar"
      role="search"
      aria-label="曲內小節與樂句搜尋"
      className="bg-white/95 dark:bg-[#131622]/95 backdrop-blur-md border-2 border-amber-500/60 rounded-2xl shadow-xl p-3 sm:p-3.5 flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-150 transition-all z-20"
    >
      {/* Search Input Row & Filter Controls */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* Search input with icons */}
        <div className="relative flex-1 min-w-[200px] flex items-center">
          <Search className="w-4 h-4 text-amber-500 absolute left-3 pointer-events-none" />
          <input
            ref={inputRef}
            id="in-song-search-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜尋此曲小節或樂句 (漢字、POJ免調符、演奏標註)..."
            className="w-full bg-zinc-50 dark:bg-[#0e1018] border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 pl-9 pr-8 py-1.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500 shadow-inner placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              title="清除搜尋"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Perspective Filter Tabs: All vs Measures vs Verses */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-850 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-750 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-amber-500 text-zinc-950 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title="顯示所有符合項目"
          >
            <Layers className="w-3 h-3" />
            <span>全部</span>
            {query.trim() && (
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-black/15 font-mono">
                {searchResult.totalMeasureMatches + searchResult.totalVerseMatches}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilter('measure')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              filter === 'measure'
                ? 'bg-amber-500 text-zinc-950 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title="僅顯示符合的小節"
          >
            <ListOrdered className="w-3 h-3" />
            <span>小節</span>
            {query.trim() && (
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-black/15 font-mono">
                {searchResult.totalMeasureMatches}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilter('verse')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              filter === 'verse'
                ? 'bg-amber-500 text-zinc-950 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title="僅顯示符合的樂句"
          >
            <AlignLeft className="w-3 h-3" />
            <span>樂句</span>
            {query.trim() && (
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-black/15 font-mono">
                {searchResult.totalVerseMatches}
              </span>
            )}
          </button>
        </div>

        {/* Stepper Navigation (Prev / Next) & Match Index */}
        {totalMatches > 0 && (
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <span className="font-mono text-zinc-600 dark:text-zinc-400 font-bold px-1 whitespace-nowrap">
              {effectiveMatchIndex + 1} / {totalMatches}
            </span>
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={handlePrevMatch}
                className="p-1 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                title="上一個 (Shift+Enter)"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextMatch}
                className="p-1 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                title="下一個 (Enter)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Close button */}
        <button
          id="in-song-search-close-btn"
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0 transition-colors"
          title="關閉 (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Horizontal Pill Strip for Fast Match Jumping */}
      {query.trim() && totalMatches > 0 && (
        <div
          ref={chipContainerRef}
          id="in-song-search-chips-strip"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar touch-pan-x"
        >
          <span className="text-[11px] font-bold text-zinc-400 shrink-0 mr-1">定位清單:</span>
          {matches.map((m, idx) => {
            const isActive = idx === effectiveMatchIndex;
            const previewSegments = highlightMatch(m.matchedSnippet, query);

            return (
              <button
                key={m.id}
                data-chip-index={idx}
                type="button"
                onClick={() => handleJumpToMatch(idx)}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none active:scale-95 ${
                  isActive
                    ? 'bg-amber-500 text-zinc-950 border-amber-600 font-extrabold shadow-sm ring-2 ring-amber-400/50'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-amber-400'
                }`}
                title={`點擊直達: ${m.type === 'verse' ? `樂句 ${m.verseNumber}` : `第 ${m.measureNumber} 小節`}`}
              >
                {/* Badge: M# or Verse# */}
                <span
                  className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-bold ${
                    isActive
                      ? 'bg-zinc-950 text-amber-400'
                      : m.type === 'verse'
                      ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {m.type === 'verse' ? `句 ${m.verseNumber} (M${m.startMeasureNumber}-${m.endMeasureNumber})` : `M${m.measureNumber}`}
                </span>

                {/* Snippet preview with match highlighting */}
                <span className="max-w-[140px] truncate text-[11px]">
                  {previewSegments.map((seg, sIdx) =>
                    seg.isMatch ? (
                      <span
                        key={sIdx}
                        className={isActive ? 'underline font-black' : 'text-amber-600 dark:text-amber-400 font-black'}
                      >
                        {seg.text}
                      </span>
                    ) : (
                      <span key={sIdx}>{seg.text}</span>
                    )
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Query entered but 0 results */}
      {query.trim() && totalMatches === 0 && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 py-1 px-1 flex items-center justify-between">
          <span>找不到相符的小節或樂句。可嘗試搜尋無調符拼音（如 <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 rounded">u-ia-hoe</code>）或簡化字詞。</span>
        </div>
      )}
    </div>
  );
};
