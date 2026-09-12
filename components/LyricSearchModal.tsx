'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Song } from '@/types/song';
import { PRESET_SONGS } from '@/lib/presets';
import {
  LyricSearchResult,
  SearchScope,
  searchLibraryLyrics,
  highlightMatch,
} from '@/lib/lyricSearch';
import {
  Search,
  X,
  Mic2,
  Music,
  ArrowRight,
  Sparkles,
  Layers,
  FolderHeart,
  CornerDownLeft,
  ChevronRight,
  ListMusic,
} from 'lucide-react';

interface LyricSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song;
  customSongs?: Song[];
  onJumpToMeasure: (
    targetSong: Song,
    measureIndex: number,
    destination: 'karaoke' | 'editor' | 'current'
  ) => void;
}

const POPULAR_SEARCH_CHIPS = [
  '雨夜花',
  'u-ia-hoe',
  '落土',
  '受風雨',
  '寶貝',
  'po-poe',
  '鄧雨賢',
];

export const LyricSearchModal: React.FC<LyricSearchModalProps> = ({
  isOpen,
  onClose,
  currentSong,
  customSongs = [],
  onJumpToMeasure,
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Combine built-in presets and custom library songs (deduping by id)
  const allSongs = useMemo<Song[]>(() => {
    const map = new Map<string, Song>();
    PRESET_SONGS.forEach(s => map.set(s.id, s));
    customSongs.forEach(s => map.set(s.id, s));
    // Ensure current song in state is always up-to-date in list
    if (currentSong?.id) {
      map.set(currentSong.id, currentSong);
    }
    return Array.from(map.values());
  }, [customSongs, currentSong]);

  // Compute search results dynamically
  const results = useMemo<LyricSearchResult[]>(() => {
    if (!query.trim()) return [];
    return searchLibraryLyrics(allSongs, query, currentSong?.id, {
      scope,
      maxResults: 60,
    });
  }, [allSongs, query, currentSong?.id, scope]);

  // Adjust selectedIndex during rendering when query or scope changes
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevScope, setPrevScope] = useState(scope);

  if (query !== prevQuery || scope !== prevScope) {
    setPrevQuery(query);
    setPrevScope(scope);
    setSelectedIndex(0);
  }

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll active item into view when navigating via keyboard
  useEffect(() => {
    if (results.length === 0) return;
    const container = resultsContainerRef.current;
    if (!container) return;

    const activeItem = container.querySelector<HTMLElement>(`[data-result-index="${selectedIndex}"]`);
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, results.length]);

  const handleExecuteJump = useCallback(
    (result: LyricSearchResult, destination: 'karaoke' | 'editor' | 'current' = 'current') => {
      const target = allSongs.find(s => s.id === result.songId) || currentSong;
      onJumpToMeasure(target, result.measureIndex, destination);
      onClose();
    },
    [allSongs, currentSong, onJumpToMeasure, onClose]
  );

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleExecuteJump(results[selectedIndex], 'current');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="lyric-search-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lyric-search-modal-title"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        id="lyric-search-modal-card"
        className="bg-white dark:bg-[#12141e] border border-zinc-200 dark:border-zinc-800/90 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in zoom-in-95 duration-150"
      >
        {/* Top Search Input Box */}
        <div className="p-3 sm:p-4 border-b border-zinc-200/90 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-[#10121a]/90 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 flex items-center">
              <Search className="w-5 h-5 text-amber-500 absolute left-3.5 pointer-events-none" />
              <input
                ref={inputRef}
                id="lyric-search-input"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜尋歌詞 (支援漢字、白話字 POJ、無調符羅馬字、歌名)..."
                className="w-full bg-white dark:bg-[#181b26] border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 pl-11 pr-10 py-2.5 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500 shadow-inner placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
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
                  className="absolute right-3 p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                  title="清除搜尋"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              id="lyric-search-close-btn"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              title="關閉 (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scope Filters & Status Bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 bg-zinc-200/60 dark:bg-zinc-850 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-750 shrink-0">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  scope === 'all'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>全部樂曲 ({allSongs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('current')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer truncate max-w-[200px] sm:max-w-[240px] ${
                  scope === 'current'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
                title={`目前曲目: ${currentSong.title}`}
              >
                <ListMusic className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">目前曲目: {currentSong.title}</span>
              </button>
            </div>

            {query.trim() && (
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                找到 <strong className="text-amber-600 dark:text-amber-400 font-bold">{results.length}</strong> 處歌詞符合
              </span>
            )}
          </div>
        </div>

        {/* Modal Body: Results or Suggestion Chips */}
        <div
          ref={resultsContainerRef}
          id="lyric-search-results-container"
          className="flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-zinc-100 dark:divide-zinc-800/60"
        >
          {/* Empty Query State: Search Suggestions */}
          {!query.trim() && (
            <div className="py-8 px-4 flex flex-col items-center text-center gap-4 animate-in fade-in duration-150">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Search className="w-6 h-6" />
              </div>

              <div>
                <h3 id="lyric-search-modal-title" className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                  即時搜尋台語歌詞、白話字與歌名
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md leading-relaxed">
                  支援免輸入調符（如輸入 <code className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[11px]">u-ia-hoe</code> 可搜尋 <span className="font-medium text-amber-600 dark:text-amber-400">Ú-iā-hoe</span>）、漢字詞彙跨音符比對，點擊即可直達該小節！
                </p>
              </div>

              {/* Quick Search Chips */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-lg mt-1">
                <span className="text-[11px] text-zinc-400 font-medium mr-1">推薦關鍵字:</span>
                {POPULAR_SEARCH_CHIPS.map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setQuery(chip);
                      inputRef.current?.focus();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 text-xs font-semibold border border-zinc-200/80 dark:border-zinc-700/80 transition-all cursor-pointer hover:border-amber-400"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Query Typed, No Results */}
          {query.trim() && results.length === 0 && (
            <div className="py-12 px-4 flex flex-col items-center text-center gap-3 animate-in fade-in duration-150">
              <Sparkles className="w-10 h-10 text-zinc-400/80" />
              <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                找不到與 &ldquo;{query}&rdquo; 相符的歌詞
              </h4>
              <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
                請嘗試搜尋其他漢字、無聲調羅馬拼音、曲調或歌名，例如「雨夜花」、「受風雨」或「寶貝」。
              </p>
            </div>
          )}

          {/* Results List */}
          {query.trim() && results.length > 0 && (
            <div className="flex flex-col gap-2">
              {results.map((result, idx) => {
                const isSelected = idx === selectedIndex;
                const hanloSegments = highlightMatch(result.previewHanlo || result.matchedSnippet, query);
                const pojSegments = highlightMatch(result.previewPoj || '', query);

                return (
                  <div
                    key={result.id}
                    data-result-index={idx}
                    onClick={() => handleExecuteJump(result, 'current')}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                      isSelected
                        ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500 shadow-xs'
                        : 'bg-white dark:bg-[#151822] border-zinc-200/80 dark:border-zinc-800/80 hover:border-amber-400/80'
                    }`}
                  >
                    {/* Card Header: Song Title, Badge, Measure Info */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {result.songTitle}
                        </span>

                        {result.isCurrentSong ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40 shrink-0">
                            目前曲目
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0">
                            樂庫曲目
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-mono shrink-0">
                        {result.section && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold">
                            {result.section}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold border border-zinc-200/80 dark:border-zinc-700/80">
                          第 {result.measureNumber} 小節 (M{result.measureNumber})
                        </span>
                        {result.chord && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-amber-600 dark:text-amber-400 font-bold border border-zinc-200/80 dark:border-zinc-700/80">
                            {result.chord}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Matched Lyric Snippets (Hanlo & POJ) */}
                    <div className="flex flex-col gap-1 pl-1">
                      {/* Hanlo Line */}
                      {result.previewHanlo && (
                        <div className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                          {hanloSegments.map((seg, sIdx) =>
                            seg.isMatch ? (
                              <mark
                                key={sIdx}
                                className="bg-amber-400/40 dark:bg-amber-500/40 text-amber-950 dark:text-amber-100 font-black px-0.5 rounded-sm"
                              >
                                {seg.text}
                              </mark>
                            ) : (
                              <span key={sIdx}>{seg.text}</span>
                            )
                          )}
                        </div>
                      )}

                      {/* POJ / Romanization Line */}
                      {result.previewPoj && (
                        <div className="text-[11px] sm:text-xs font-mono text-zinc-500 dark:text-zinc-400 leading-snug">
                          {pojSegments.map((seg, sIdx) =>
                            seg.isMatch ? (
                              <mark
                                key={sIdx}
                                className="bg-amber-400/40 dark:bg-amber-500/40 text-amber-950 dark:text-amber-100 font-bold px-0.5 rounded-sm"
                              >
                                {seg.text}
                              </mark>
                            ) : (
                              <span key={sIdx}>{seg.text}</span>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Jump Action Bar */}
                    <div className="mt-1 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-zinc-400 hidden sm:inline">
                        1={result.songKey} · {result.songBpm} BPM
                      </span>

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleExecuteJump(result, 'karaoke');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 font-bold text-[11px] transition-colors cursor-pointer border border-amber-400/40"
                          title="前往 Karaoke 模式並跳至該小節"
                        >
                          <Mic2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Karaoke 練唱</span>
                        </button>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleExecuteJump(result, 'editor');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 font-bold text-[11px] transition-colors cursor-pointer border border-zinc-200/80 dark:border-zinc-700"
                          title="前往 Score Editor 編輯該小節音符與歌詞"
                        >
                          <Music className="w-3.5 h-3.5 text-emerald-500" />
                          <span>樂譜編輯</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Hotkey Hint Bar */}
        <div className="p-2.5 sm:p-3 bg-zinc-100 dark:bg-[#0c0e15] border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono font-bold text-[10px] text-zinc-800 dark:text-zinc-200">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono font-bold text-[10px] text-zinc-800 dark:text-zinc-200">↓</kbd>
              <span>選擇</span>
            </span>

            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono font-bold text-[10px] text-zinc-800 dark:text-zinc-200">Enter</kbd>
              <span>前往小節</span>
            </span>

            <span className="inline-flex items-center gap-1 hidden sm:inline-flex">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono font-bold text-[10px] text-zinc-800 dark:text-zinc-200">Esc</kbd>
              <span>關閉</span>
            </span>
          </div>

          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
            Taigi Studio Lyric Finder
          </span>
        </div>
      </div>
    </div>
  );
};
