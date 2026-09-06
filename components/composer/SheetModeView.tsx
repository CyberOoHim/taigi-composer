'use client';

import React, { useState, useMemo } from 'react';
import { BarlineType, LyricDisplayMode, Song, VerseItem, VerseNoteRef } from '@/types/song';
import { getMeasureRhythmReport, groupSongIntoVerses } from '@/lib/taigiUtils';
import { NumberedNotationNoteComponent } from '@/components/NumberedNotationNoteComponent';
import {
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Wand2,
  ExternalLink,
  Plus,
  Trash2,
  AlignLeft,
  Layers,
  Play,
  Square,
  Copy,
  SlidersHorizontal,
  FileSpreadsheet,
  SplitSquareVertical,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const COMMON_SECTIONS = [
  'Verse 1',
  'Verse 2',
  'Verse 3',
  'Verse 4',
  'Chorus',
  'Pre-Chorus',
  'Bridge',
  'Intro',
  'Outro',
  'Interlude',
  'Coda',
];

export interface SheetModeViewProps {
  song: Song;
  verses?: VerseItem[];
  // Measure operations & deep links
  onSelectMeasure: (mIdx: number) => void;
  onEditNotes?: (mIdx: number) => void;
  onSelectNote?: (mIdx: number, nIdx: number) => void;
  selectedMeasureIndex?: number | null;
  selectedNoteIndex?: number | null;
  activePlaybackNoteId?: string | null;
  displayMode?: LyricDisplayMode;
  onMoveMeasure: (fromIdx: number, toIdx: number) => void;
  onDuplicateMeasure?: (mIdx: number) => void;
  onToggleLineBreak: (mIdx: number) => void;
  onUpdateBarlineType: (mIdx: number, barlineType: BarlineType) => void;
  onAutoFillRest: (mIdx: number) => void;
  onBatchAutoFillAllRests: () => void;
  onDeleteMeasure: (mIdx: number) => void;
  onAddMeasure: () => void;

  // Measure and System playback
  playingMeasureIdx?: number | null;
  onTogglePlayMeasure?: (mIdx: number) => void;
  playingSystemIdx?: number | null;
  onTogglePlaySystem?: (systemIndex: number, measureIndices: number[]) => void;

  // Sheet Playback from Current Note
  isPlayingSheet?: boolean;
  onTogglePlaySheetFromNote?: (mIdx?: number, nIdx?: number) => void;
  onNavigateNextNote?: () => void;
  onNavigatePrevNote?: () => void;

  // Verse operations & deep links
  onSelectVerse: (verse: VerseItem) => void;
  playingVerseIdx?: number | null;
  onTogglePlayVerse?: (vIdx: number, verseNotes: VerseNoteRef[]) => void;
  onMoveVerse?: (fromVerseIdx: number, toVerseIdx: number) => void;
  onToggleVerseLineBreak?: (verse: VerseItem) => void;
  onUpdateVerseSection?: (verse: VerseItem, section: string) => void;
  onAutoFillVerseRests?: (verse: VerseItem) => void;
  onDistributeVerseLyrics?: (verse: VerseItem, vIdx: number, text: string) => void;
  onDuplicateVerse?: (verse: VerseItem) => void;
  onDeleteVerse?: (verse: VerseItem) => void;
  onAddVerse?: () => void;
}

export const SheetModeView: React.FC<SheetModeViewProps> = ({
  song,
  verses: passedVerses,
  onSelectMeasure,
  onEditNotes,
  onSelectNote,
  selectedMeasureIndex = null,
  selectedNoteIndex = null,
  activePlaybackNoteId = null,
  displayMode = 'all',
  onMoveMeasure,
  onDuplicateMeasure,
  onToggleLineBreak,
  onUpdateBarlineType,
  onAutoFillRest,
  onBatchAutoFillAllRests,
  onDeleteMeasure,
  onAddMeasure,
  playingMeasureIdx = null,
  onTogglePlayMeasure,
  playingSystemIdx = null,
  onTogglePlaySystem,
  isPlayingSheet = false,
  onTogglePlaySheetFromNote,
  onNavigateNextNote,
  onNavigatePrevNote,
  onSelectVerse,
  playingVerseIdx = null,
  onTogglePlayVerse,
  onMoveVerse,
  onToggleVerseLineBreak,
  onUpdateVerseSection,
  onAutoFillVerseRests,
  onDistributeVerseLyrics,
  onDuplicateVerse,
  onDeleteVerse,
  onAddVerse,
}) => {
  // Primary sub-mode in Sheet Mode: 'measure' (Systems & Measures) vs 'verse' (Phrasing & Sections)
  const [sheetPerspective, setSheetPerspective] = useState<'measure' | 'verse'>('measure');
  const [filterMode, setFilterMode] = useState<'all' | 'incomplete'>('all');
  const [groupBySystems, setGroupBySystems] = useState<boolean>(true);
  const [verseLyricInputs, setVerseLyricInputs] = useState<{ [vIdx: number]: string }>({});

  // Compute verses if not explicitly passed
  const computedVerses = useMemo(() => {
    return passedVerses ?? groupSongIntoVerses(song);
  }, [passedVerses, song]);

  // Information about currently selected note in the score
  const selectedNoteInfo = useMemo(() => {
    if (
      selectedMeasureIndex === null ||
      selectedMeasureIndex === undefined ||
      selectedMeasureIndex < 0 ||
      selectedMeasureIndex >= song.measures.length
    ) {
      return null;
    }
    const m = song.measures[selectedMeasureIndex];
    if (!m) return null;
    const nIdx = selectedNoteIndex ?? 0;
    const n = m.notes[nIdx];
    if (!n) return null;

    const measureNumber = m.measureNumber || selectedMeasureIndex + 1;
    const noteNumber = nIdx + 1;
    const pitchDisplay =
      n.pitch === 0 ? '0 (Rest)' : n.pitch === 'empty' ? 'Empty' : `${n.pitch}`;
    const lyricDisplay =
      n.lyric?.hanlo || n.lyric?.hanji || n.lyric?.custom || n.lyric?.poj || '';

    return {
      measureIndex: selectedMeasureIndex,
      noteIndex: nIdx,
      measureNumber,
      noteNumber,
      pitchDisplay,
      lyricDisplay,
      details: `${pitchDisplay}${lyricDisplay ? ` • “${lyricDisplay}”` : ''}${m.section ? ` [${m.section}]` : ''}`,
    };
  }, [song.measures, selectedMeasureIndex, selectedNoteIndex]);

  // Smoothly scroll active playback note into view during sheet playback
  React.useEffect(() => {
    if (!isPlayingSheet || !activePlaybackNoteId) return;
    const el = document.getElementById(`sheet-note-${activePlaybackNoteId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [isPlayingSheet, activePlaybackNoteId]);

  // MEASURE REPORTS
  const measureReports = useMemo(() => {
    return song.measures.map((m, idx) => {
      const report = getMeasureRhythmReport(m, song.timeSignature || '4/4');

      const hanloParts: string[] = [];
      const pojParts: string[] = [];

      m.notes.forEach(n => {
        const h = (n.lyric?.hanlo || n.lyric?.hanji || n.lyric?.custom || '').trim();
        const p = (n.lyric?.poj || n.lyric?.tl || '').trim();
        if (h && h !== '\n' && h !== '↵') hanloParts.push(h);
        if (p && p !== '\n' && p !== '↵') pojParts.push(p);
      });

      const completeLyric = hanloParts.reduce((acc, curr) => {
        if (!acc) return curr;
        const lastChar = acc.slice(-1);
        const firstChar = curr.slice(0, 1);
        if (/[a-zA-Z0-9]/.test(lastChar) && /[a-zA-Z0-9]/.test(firstChar)) {
          return `${acc} ${curr}`;
        }
        return `${acc}${curr}`;
      }, '');

      const completePoj = pojParts.join(' ');

      return {
        measure: m,
        idx,
        report,
        completeLyric,
        completePoj,
      };
    });
  }, [song.measures, song.timeSignature]);

  const measureStats = useMemo(() => {
    const total = measureReports.length;
    const complete = measureReports.filter(r => r.report.isFull).length;
    const under = measureReports.filter(r => r.report.isUnder).length;
    const over = measureReports.filter(r => r.report.isOver).length;
    const incomplete = under + over;
    return { total, complete, under, over, incomplete };
  }, [measureReports]);

  const displayedMeasureReports = useMemo(() => {
    if (filterMode === 'incomplete') {
      return measureReports.filter(r => !r.report.isFull);
    }
    return measureReports;
  }, [measureReports, filterMode]);

  // GROUP MEASURES BY SYSTEMS (staff lines split by isLineBreak)
  const measureSystems = useMemo(() => {
    const systems: Array<{
      systemIndex: number;
      reports: typeof measureReports;
      startMeasureNumber: number;
      endMeasureNumber: number;
    }> = [];

    let currentSystem: typeof measureReports = [];

    displayedMeasureReports.forEach(item => {
      currentSystem.push(item);
      if (item.measure.isLineBreak) {
        systems.push({
          systemIndex: systems.length + 1,
          reports: currentSystem,
          startMeasureNumber: currentSystem[0].measure.measureNumber || currentSystem[0].idx + 1,
          endMeasureNumber: item.measure.measureNumber || item.idx + 1,
        });
        currentSystem = [];
      }
    });

    if (currentSystem.length > 0) {
      systems.push({
        systemIndex: systems.length + 1,
        reports: currentSystem,
        startMeasureNumber: currentSystem[0].measure.measureNumber || currentSystem[0].idx + 1,
        endMeasureNumber:
          currentSystem[currentSystem.length - 1].measure.measureNumber ||
          currentSystem[currentSystem.length - 1].idx + 1,
      });
    }

    return systems;
  }, [displayedMeasureReports]);

  // VERSE REPORTS
  const verseReports = useMemo(() => {
    return computedVerses.map((verse, vIdx) => {
      const mIndices = Array.from(new Set(verse.notes.map(n => n.measureIndex))).sort((a, b) => a - b);
      const measures = mIndices.map(idx => song.measures[idx]).filter(Boolean);
      const reports = measures.map(m => getMeasureRhythmReport(m, song.timeSignature || '4/4'));

      const isFull = reports.every(r => r.isFull);
      const underCount = reports.filter(r => r.isUnder).length;
      const overCount = reports.filter(r => r.isOver).length;
      const totalBeats = reports.reduce((acc, r) => acc + r.currentBeats, 0);
      const expectedBeats = reports.reduce((acc, r) => acc + r.expectedBeats, 0);

      const lastMeasure = measures[measures.length - 1];
      const hasLineBreak = Boolean(lastMeasure?.isLineBreak);

      // Check for measure overlap with adjacent verses
      const prevVerse = computedVerses[vIdx - 1];
      const nextVerse = computedVerses[vIdx + 1];

      const prevIndices = prevVerse
        ? Array.from(new Set(prevVerse.notes.map(n => n.measureIndex)))
        : [];
      const nextIndices = nextVerse
        ? Array.from(new Set(nextVerse.notes.map(n => n.measureIndex)))
        : [];

      const sharesMeasureWithPrev = mIndices.some(idx => prevIndices.includes(idx));
      const sharesMeasureWithNext = mIndices.some(idx => nextIndices.includes(idx));

      const lyricPreview =
        verse.lyricSummary.hanlo || verse.lyricSummary.hanji || verse.lyricSummary.custom || verse.lyricSummary.poj || '';

      return {
        verse,
        vIdx,
        mIndices,
        measures,
        reports,
        isFull,
        underCount,
        overCount,
        totalBeats,
        expectedBeats,
        hasLineBreak,
        sharesMeasureWithPrev,
        sharesMeasureWithNext,
        lyricPreview,
      };
    });
  }, [computedVerses, song.measures, song.timeSignature]);

  const verseStats = useMemo(() => {
    const total = verseReports.length;
    const complete = verseReports.filter(r => r.isFull).length;
    const incomplete = total - complete;
    const under = verseReports.reduce((acc, r) => acc + r.underCount, 0);
    return { total, complete, incomplete, under };
  }, [verseReports]);

  const displayedVerseReports = useMemo(() => {
    if (filterMode === 'incomplete') {
      return verseReports.filter(r => !r.isFull);
    }
    return verseReports;
  }, [verseReports, filterMode]);

  const handleDistributeLyric = (verse: VerseItem, vIdx: number) => {
    const text = (verseLyricInputs[vIdx] || '').trim();
    if (!text) return;
    if (onDistributeVerseLyrics) {
      onDistributeVerseLyrics(verse, vIdx, text);
      setVerseLyricInputs(prev => ({ ...prev, [vIdx]: '' }));
    }
  };

  return (
    <div
      id="sheet-mode-view-root"
      className="flex flex-col gap-4 bg-zinc-50/60 dark:bg-zinc-950/60 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-5 shadow-xs"
    >
      {/* ========================================================================= */}
      {/* 1. TOP SHEET CONTROLS & SUB-PERSPECTIVE SWITCHER                          */}
      {/* ========================================================================= */}
      <div
        id="sheet-mode-header-card"
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Sub-perspective Pill (Measures vs Verses in Sheet Mode) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              <span>Sheet Perspective:</span>
            </span>

            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <button
                id="sheet-perspective-measure-btn"
                type="button"
                onClick={() => setSheetPerspective('measure')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[34px] ${
                  sheetPerspective === 'measure'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Measures &amp; Layout</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200/80 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono font-bold ml-0.5">
                  {measureStats.total}
                </span>
              </button>

              <button
                id="sheet-perspective-verse-btn"
                type="button"
                onClick={() => setSheetPerspective('verse')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[34px] ${
                  sheetPerspective === 'verse'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Verses &amp; Phrasing</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200/80 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono font-bold ml-0.5">
                  {verseStats.total}
                </span>
              </button>
            </div>
          </div>

          {/* Quick Metrics & Filter Pill */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Toggle */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <button
                id="sheet-filter-all-btn"
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Show All
              </button>
              <button
                id="sheet-filter-incomplete-btn"
                type="button"
                onClick={() => setFilterMode('incomplete')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  filterMode === 'incomplete'
                    ? 'bg-rose-600 text-white shadow-2xs font-black'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <span>Incomplete Only</span>
                {measureStats.incomplete > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-mono">
                    {measureStats.incomplete}
                  </span>
                )}
              </button>
            </div>

            {/* Toggle System Grouping (for Measure Perspective) */}
            {sheetPerspective === 'measure' && (
              <button
                id="sheet-toggle-systems-btn"
                type="button"
                onClick={() => setGroupBySystems(!groupBySystems)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  groupBySystems
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                }`}
                title="Group measures by staff line systems (delimited by line breaks)"
              >
                <SplitSquareVertical className="w-3.5 h-3.5" />
                <span>{groupBySystems ? 'Grouped by Systems' : 'Flat List'}</span>
              </button>
            )}

            {/* Batch Auto-Pad All Rests */}
            {measureStats.under > 0 && (
              <button
                id="sheet-batch-fix-btn"
                type="button"
                onClick={onBatchAutoFillAllRests}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation text-xs"
                title="Automatically fill missing beats with rest notes (0) in all under-beat measures"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Auto-Pad All ({measureStats.under})</span>
              </button>
            )}

            {/* Play Key from Current Note in Header */}
            {onTogglePlaySheetFromNote && (
              <button
                id="sheet-play-from-note-btn"
                type="button"
                onClick={() => onTogglePlaySheetFromNote(selectedMeasureIndex ?? 0, selectedNoteIndex ?? 0)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all duration-200 active:scale-95 cursor-pointer touch-manipulation min-h-[34px] ${
                  isPlayingSheet
                    ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400 font-extrabold animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold'
                }`}
                title={
                  isPlayingSheet
                    ? 'Stop sheet playback (Space / P)'
                    : selectedNoteInfo
                    ? `Play sheet starting from Measure #${selectedNoteInfo.measureNumber}, Note #${selectedNoteInfo.noteNumber} (Space / P)`
                    : 'Play sheet from beginning (Space / P)'
                }
              >
                {isPlayingSheet ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Sheet</span>
                    <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] bg-black/30 text-white/90 rounded font-mono ml-0.5">
                      Space
                    </kbd>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {selectedNoteInfo
                        ? `Play from Note (${selectedNoteInfo.measureNumber}.${selectedNoteInfo.noteNumber})`
                        : 'Play Sheet'}
                    </span>
                    <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] bg-black/25 text-white/90 rounded font-mono ml-0.5">
                      Space
                    </kbd>
                  </>
                )}
              </button>
            )}

            {/* Primary Add Trigger */}
            {sheetPerspective === 'measure' ? (
              <button
                id="sheet-add-measure-header-btn"
                type="button"
                onClick={onAddMeasure}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Measure</span>
              </button>
            ) : (
              onAddVerse && (
                <button
                  id="sheet-add-verse-header-btn"
                  type="button"
                  onClick={onAddVerse}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Verse</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Informative Subtitle / Description Banner */}
        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800/80 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Full Beats: {measureStats.complete}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Under/Over: {measureStats.incomplete}</span>
            </span>
            <span>•</span>
            <span>Time Signature: <strong className="font-mono">{song.timeSignature || '4/4'}</strong></span>
          </div>
          <div className="text-[11px] text-zinc-400 italic">
            Tip: Click &quot;Edit in Mode&quot; (<ExternalLink className="w-3 h-3 inline text-amber-500" />) on any card to jump straight into granular note or verse editing.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MEASURE PERSPECTIVE (Systems, Line Breaks, Barlines, Rhythm Health)    */}
      {/* ========================================================================= */}
      {sheetPerspective === 'measure' && (
        <div id="sheet-measures-container" className="flex flex-col gap-4">
          {displayedMeasureReports.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2" />
              <p className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                All measures match their expected beat duration!
              </p>
              <p className="text-xs text-zinc-400 mt-1">No rhythmic deficits found in the score.</p>
            </div>
          ) : groupBySystems ? (
            /* Render Grouped by Staff Systems (Visual lines of the printed sheet) */
            <div className="flex flex-col gap-5">
              {measureSystems.map(system => (
                <div
                  key={`system-${system.systemIndex}`}
                  className={`flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-2xl border transition-all shadow-2xs ${
                    playingSystemIdx === system.systemIndex
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80 ring-2 ring-amber-400/40'
                      : 'bg-white/70 dark:bg-zinc-900/70 border-zinc-200/80 dark:border-zinc-800/80'
                  }`}
                >
                  {/* System Header with System Play Key */}
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-600 dark:text-zinc-300 pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg font-mono text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <SplitSquareVertical className="w-3.5 h-3.5 text-indigo-500" />
                        <span>System {system.systemIndex}</span>
                      </span>
                      <span className="text-zinc-700 dark:text-zinc-300 font-semibold">
                        Measures #{system.startMeasureNumber} – #{system.endMeasureNumber}
                      </span>
                      <span className="text-zinc-400 font-normal">
                        ({system.reports.length} measures)
                      </span>
                    </div>

                    {/* Play Key for this System */}
                    {onTogglePlaySystem && (
                      <button
                        id={`sheet-system-play-btn-${system.systemIndex}`}
                        type="button"
                        onClick={() => onTogglePlaySystem(system.systemIndex, system.reports.map(r => r.idx))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs touch-manipulation min-h-[32px] ${
                          playingSystemIdx === system.systemIndex
                            ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 animate-pulse font-black'
                            : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                        }`}
                        title={
                          playingSystemIdx === system.systemIndex
                            ? `Stop playing System #${system.systemIndex}`
                            : `Play System #${system.systemIndex} (Measures #${system.startMeasureNumber} – #${system.endMeasureNumber})`
                        }
                      >
                        {playingSystemIdx === system.systemIndex ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop System {system.systemIndex}</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Play System {system.systemIndex}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {system.reports.map(({ measure, idx, report }) => {
                      const isFirst = idx === 0;
                      const isLast = idx === song.measures.length - 1;

                      return (
                        <div
                          key={measure.id}
                          id={`sheet-measure-row-${idx}`}
                          onClick={() => onSelectMeasure(idx)}
                          className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 shadow-2xs cursor-pointer ${
                            selectedMeasureIndex === idx
                              ? 'ring-2 ring-emerald-500/60 dark:ring-emerald-400/60 border-emerald-500/80 dark:border-emerald-500/80 bg-white dark:bg-zinc-900 shadow-sm'
                              : report.isFull
                              ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 hover:border-zinc-300 dark:hover:border-zinc-700'
                              : report.isUnder
                              ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 ring-1 ring-amber-400/40 hover:border-amber-400'
                              : 'border-rose-300 dark:border-rose-800/80 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-400/40 hover:border-rose-400'
                          }`}
                        >
                          {/* Top Row: Measure Info & Action Controls */}
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 w-full">
                            {/* Measure Info & Badges */}
                            <div className="flex items-center gap-2.5 flex-wrap flex-1">
                              <span className="w-11 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono font-black text-xs flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                                #{idx + 1}
                              </span>

                              {measure.section ? (
                                <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                                  {measure.section}
                                </span>
                              ) : null}

                              {measure.chord ? (
                                <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 font-mono font-black text-xs border border-amber-300 dark:border-amber-700">
                                  {measure.chord}
                                </span>
                              ) : (
                                <span className="text-[11px] text-zinc-400 italic">No chord</span>
                              )}

                              {/* Beat Report Badge */}
                              <div
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-mono text-xs font-bold border ${
                                  report.isFull
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
                                    : report.isUnder
                                    ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800'
                                    : 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800'
                                }`}
                              >
                                {report.isFull ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <AlertCircle
                                    className={`w-3.5 h-3.5 ${report.isUnder ? 'text-amber-600' : 'text-rose-600'}`}
                                  />
                                )}
                                <span>
                                  {report.currentBeats}/{report.expectedBeats} Beats
                                </span>
                                {!report.isFull && (
                                  <span className="font-sans font-medium text-[11px] ml-0.5">
                                    {report.isUnder ? `(-${report.absDiff})` : `(+${report.absDiff})`}
                                  </span>
                                )}
                              </div>

                              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                                {measure.notes.length} notes
                              </span>
                            </div>

                            {/* Action Controls - Displayed only when measure card is selected */}
                            {selectedMeasureIndex === idx && (
                              <div
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 flex-wrap self-end md:self-center"
                              >
                                {/* Audition Measure Play Button */}
                                {onTogglePlayMeasure && (
                                  <button
                                    type="button"
                                    onClick={() => onTogglePlayMeasure(idx)}
                                    className={`p-1.5 rounded-xl border transition-colors cursor-pointer touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center ${
                                      playingMeasureIdx === idx
                                        ? 'bg-rose-600 text-white border-rose-500 ring-2 ring-rose-400 font-bold animate-pulse'
                                        : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                    }`}
                                    title={playingMeasureIdx === idx ? `Stop playing Measure #${idx + 1}` : `Play Measure #${idx + 1}`}
                                  >
                                    {playingMeasureIdx === idx ? (
                                      <Square className="w-3.5 h-3.5 fill-current" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                    )}
                                  </button>
                                )}

                                {/* Play Sheet from Current Note in this Measure */}
                                {onTogglePlaySheetFromNote && (
                                  <button
                                    id={`sheet-measure-play-from-note-btn-${idx}`}
                                    type="button"
                                    onClick={() => onTogglePlaySheetFromNote(idx, selectedNoteIndex ?? 0)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer touch-manipulation min-h-[32px] ${
                                      isPlayingSheet
                                        ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400 font-extrabold animate-pulse'
                                        : 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                                    }`}
                                    title={
                                      isPlayingSheet
                                        ? 'Stop sheet playback (Space / P)'
                                        : `Play sheet from Note #${(selectedNoteIndex ?? 0) + 1} of Measure #${idx + 1}`
                                    }
                                  >
                                    {isPlayingSheet ? (
                                      <>
                                        <Square className="w-3 h-3 fill-current" />
                                        <span>Stop</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-3 h-3 fill-current text-emerald-600 dark:text-emerald-400" />
                                        <span>Play from Note #{(selectedNoteIndex ?? 0) + 1}</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                {/* Auto-fill rest button if under-beat */}
                                {report.isUnder && (
                                  <button
                                    type="button"
                                    onClick={() => onAutoFillRest(idx)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs transition-colors cursor-pointer touch-manipulation"
                                    title={`Auto-fill ${report.absDiff} beats rest note (0) at end of measure`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Fill Rest (+{report.absDiff})</span>
                                  </button>
                                )}

                                {/* System Line Break Toggle */}
                                <button
                                  type="button"
                                  onClick={() => onToggleLineBreak(idx)}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                    measure.isLineBreak
                                      ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-600 font-black'
                                      : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                                  }`}
                                  title={
                                    measure.isLineBreak
                                      ? 'System line break enabled (Click to remove break)'
                                      : 'End system line after this measure (Click to add break)'
                                  }
                                >
                                  <CornerDownLeft className="w-3.5 h-3.5" />
                                  <span>{measure.isLineBreak ? 'Break ↵' : 'No Break'}</span>
                                </button>

                                {/* Barline Style Selector */}
                                <select
                                  value={measure.barlineType || 'single'}
                                  onChange={e => onUpdateBarlineType(idx, e.target.value as BarlineType)}
                                  className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-lg px-2 py-1 cursor-pointer"
                                  title="Barline Style at end of measure"
                                >
                                  <option value="single">| Single</option>
                                  <option value="double">|| Double</option>
                                  <option value="end">|| End</option>
                                  <option value="repeat_start">|: Repeat Start</option>
                                  <option value="repeat_end">:| Repeat End</option>
                                </select>

                                {/* Reorder Buttons */}
                                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                  <button
                                    type="button"
                                    onClick={() => onMoveMeasure(idx, idx - 1)}
                                    disabled={isFirst}
                                    className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    title="Move measure earlier"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onMoveMeasure(idx, idx + 1)}
                                    disabled={isLast}
                                    className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    title="Move measure later"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Deep link: Jump to Edit in Measure Mode */}
                                <button
                                  type="button"
                                  onClick={() => (onEditNotes ? onEditNotes(idx) : onSelectMeasure(idx))}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700 text-xs font-bold transition-all cursor-pointer"
                                  title="Jump to note-by-note editing in Measure Mode"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Edit Notes</span>
                                </button>

                                {/* Duplicate Measure */}
                                {onDuplicateMeasure && (
                                  <button
                                    id={`sheet-system-duplicate-measure-btn-${idx}`}
                                    type="button"
                                    onClick={() => onDuplicateMeasure(idx)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-xs font-bold transition-colors cursor-pointer"
                                    title={`Duplicate Measure #${measure.measureNumber || idx + 1}`}
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span className="hidden xl:inline">Duplicate</span>
                                  </button>
                                )}

                                {/* Delete Measure */}
                                {song.measures.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteMeasure(idx)}
                                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                    title="Delete measure"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Notes Displayed with Lyric */}
                          <div className="w-full pt-1">
                            <div
                              className="flex items-stretch gap-1.5 overflow-x-auto pb-1.5 pt-0.5 select-none scrollbar-thin"
                              style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                              {measure.notes.length === 0 ? (
                                <div className="text-xs text-zinc-400 italic py-2 px-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                  No notes in measure
                                </div>
                              ) : (
                                measure.notes.map((note, nIdx) => (
                                  <NumberedNotationNoteComponent
                                    id={`sheet-note-${note.id || `${idx}-${nIdx}`}`}
                                    key={`sheet-sys-m-${idx}-n-${note.id || nIdx}`}
                                    note={note}
                                    prevNote={nIdx > 0 ? measure.notes[nIdx - 1] : null}
                                    isSelected={selectedMeasureIndex === idx && selectedNoteIndex === nIdx}
                                    isActive={activePlaybackNoteId === note.id}
                                    displayMode={displayMode}
                                    onClick={e => {
                                      e?.stopPropagation();
                                      if (onSelectNote) {
                                        onSelectNote(idx, nIdx);
                                      } else {
                                        onSelectMeasure(idx);
                                      }
                                    }}
                                  />
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Flat List of Measures */
            <div className="flex flex-col gap-2.5">
              {displayedMeasureReports.map(({ measure, idx, report }) => {
                const isFirst = idx === 0;
                const isLast = idx === song.measures.length - 1;

                return (
                  <div
                    key={measure.id}
                    id={`sheet-measure-flat-row-${idx}`}
                    onClick={() => onSelectMeasure(idx)}
                    className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 shadow-2xs cursor-pointer ${
                      selectedMeasureIndex === idx
                        ? 'ring-2 ring-emerald-500/60 dark:ring-emerald-400/60 border-emerald-500/80 dark:border-emerald-500/80 bg-white dark:bg-zinc-900 shadow-sm'
                        : report.isFull
                        ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 hover:border-zinc-300 dark:hover:border-zinc-700'
                        : report.isUnder
                        ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 ring-1 ring-amber-400/40 hover:border-amber-400'
                        : 'border-rose-300 dark:border-rose-800/80 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-400/40 hover:border-rose-400'
                    }`}
                  >
                    {/* Top Row: Measure Info & Controls */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 w-full">
                      {/* Left: Measure Info */}
                      <div className="flex items-center gap-2.5 flex-wrap flex-1">
                        <span className="w-11 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono font-black text-xs flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                          #{idx + 1}
                        </span>

                        {measure.section && (
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                            {measure.section}
                          </span>
                        )}

                        {measure.chord ? (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 font-mono font-black text-xs border border-amber-300 dark:border-amber-700">
                            {measure.chord}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">No chord</span>
                        )}

                        <div
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-mono text-xs font-bold border ${
                            report.isFull
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
                              : report.isUnder
                              ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {report.isFull ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <AlertCircle
                              className={`w-3.5 h-3.5 ${report.isUnder ? 'text-amber-600' : 'text-rose-600'}`}
                            />
                          )}
                          <span>
                            {report.currentBeats}/{report.expectedBeats} Beats
                          </span>
                          {!report.isFull && (
                            <span className="font-sans font-medium text-[11px] ml-0.5">
                              {report.isUnder ? `(-${report.absDiff})` : `(+${report.absDiff})`}
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                          {measure.notes.length} notes
                        </span>
                      </div>

                      {/* Right: Controls - Displayed only when measure card is selected */}
                      {selectedMeasureIndex === idx && (
                        <div
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1.5 flex-wrap self-end md:self-center"
                        >
                          {/* Audition Measure Play Button */}
                          {onTogglePlayMeasure && (
                            <button
                              type="button"
                              onClick={() => onTogglePlayMeasure(idx)}
                              className={`p-1.5 rounded-xl border transition-colors cursor-pointer touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center ${
                                playingMeasureIdx === idx
                                  ? 'bg-rose-600 text-white border-rose-500 ring-2 ring-rose-400 font-bold animate-pulse'
                                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                              }`}
                              title={playingMeasureIdx === idx ? `Stop playing Measure #${idx + 1}` : `Play Measure #${idx + 1}`}
                            >
                              {playingMeasureIdx === idx ? (
                                <Square className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>
                          )}

                          {/* Play Sheet from Current Note in this Measure */}
                          {onTogglePlaySheetFromNote && (
                            <button
                              id={`sheet-flat-measure-play-from-note-btn-${idx}`}
                              type="button"
                              onClick={() => onTogglePlaySheetFromNote(idx, selectedNoteIndex ?? 0)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer touch-manipulation min-h-[32px] ${
                                isPlayingSheet
                                  ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400 font-extrabold animate-pulse'
                                  : 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                              }`}
                              title={
                                isPlayingSheet
                                  ? 'Stop sheet playback (Space / P)'
                                  : `Play sheet from Note #${(selectedNoteIndex ?? 0) + 1} of Measure #${idx + 1}`
                              }
                            >
                              {isPlayingSheet ? (
                                <>
                                  <Square className="w-3 h-3 fill-current" />
                                  <span>Stop</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 fill-current text-emerald-600 dark:text-emerald-400" />
                                  <span>Play from Note #{(selectedNoteIndex ?? 0) + 1}</span>
                                </>
                              )}
                            </button>
                          )}

                          {report.isUnder && (
                            <button
                              type="button"
                              onClick={() => onAutoFillRest(idx)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs transition-colors cursor-pointer touch-manipulation"
                              title={`Auto-fill ${report.absDiff} beats rest note (0)`}
                            >
                              <Plus className="w-3 h-3" />
                              <span>Fill Rest (+{report.absDiff})</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onToggleLineBreak(idx)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                              measure.isLineBreak
                                ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-600 font-black'
                                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                            }`}
                            title={measure.isLineBreak ? 'Line break enabled' : 'Toggle line break'}
                          >
                            <CornerDownLeft className="w-3.5 h-3.5" />
                            <span>{measure.isLineBreak ? 'Break ↵' : 'No Break'}</span>
                          </button>

                          <select
                            value={measure.barlineType || 'single'}
                            onChange={e => onUpdateBarlineType(idx, e.target.value as BarlineType)}
                            className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-lg px-2 py-1 cursor-pointer"
                            title="Barline style"
                          >
                            <option value="single">| Single</option>
                            <option value="double">|| Double</option>
                            <option value="end">|| End</option>
                            <option value="repeat_start">|: Repeat Start</option>
                            <option value="repeat_end">:| Repeat End</option>
                          </select>

                          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <button
                              type="button"
                              onClick={() => onMoveMeasure(idx, idx - 1)}
                              disabled={isFirst}
                              className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              title="Move earlier"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveMeasure(idx, idx + 1)}
                              disabled={isLast}
                              className="p-1 rounded text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              title="Move later"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => (onEditNotes ? onEditNotes(idx) : onSelectMeasure(idx))}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700 text-xs font-bold transition-all cursor-pointer"
                            title="Jump to edit notes"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Edit Notes</span>
                          </button>

                          {/* Duplicate Measure */}
                          {onDuplicateMeasure && (
                            <button
                              id={`sheet-flat-duplicate-measure-btn-${idx}`}
                              type="button"
                              onClick={() => onDuplicateMeasure(idx)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-xs font-bold transition-colors cursor-pointer"
                              title={`Duplicate Measure #${measure.measureNumber || idx + 1}`}
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Duplicate</span>
                            </button>
                          )}

                          {song.measures.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onDeleteMeasure(idx)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              title="Delete measure"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Notes Displayed with Lyric */}
                    <div className="w-full pt-1">
                      <div
                        className="flex items-stretch gap-1.5 overflow-x-auto pb-1.5 pt-0.5 select-none scrollbar-thin"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                      >
                        {measure.notes.length === 0 ? (
                          <div className="text-xs text-zinc-400 italic py-2 px-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                            No notes in measure
                          </div>
                        ) : (
                          measure.notes.map((note, nIdx) => (
                            <NumberedNotationNoteComponent
                              id={`sheet-note-${note.id || `${idx}-${nIdx}`}`}
                              key={`sheet-flat-m-${idx}-n-${note.id || nIdx}`}
                              note={note}
                              prevNote={nIdx > 0 ? measure.notes[nIdx - 1] : null}
                              isSelected={selectedMeasureIndex === idx && selectedNoteIndex === nIdx}
                              isActive={activePlaybackNoteId === note.id}
                              displayMode={displayMode}
                              onClick={e => {
                                e?.stopPropagation();
                                if (onSelectNote) {
                                  onSelectNote(idx, nIdx);
                                } else {
                                  onSelectMeasure(idx);
                                }
                              }}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VERSE PERSPECTIVE (Phrasing, Lyrics, Audition, Section Sequencing)     */}
      {/* ========================================================================= */}
      {sheetPerspective === 'verse' && (
        <div id="sheet-verses-container" className="flex flex-col gap-3.5">
          {displayedVerseReports.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2" />
              <p className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                All verses match their expected rhythm durations!
              </p>
              <p className="text-xs text-zinc-400 mt-1">No rhythm deficits found across any verses.</p>
            </div>
          ) : (
            displayedVerseReports.map(
              ({
                verse,
                vIdx,
                isFull,
                underCount,
                overCount,
                totalBeats,
                expectedBeats,
                hasLineBreak,
                sharesMeasureWithPrev,
                sharesMeasureWithNext,
                lyricPreview,
              }) => {
                const isFirst = vIdx === 0;
                const isLast = vIdx === computedVerses.length - 1;
                const isPlaying = playingVerseIdx === vIdx;

                const canMoveUp = !isFirst && !sharesMeasureWithPrev;
                const canMoveDown = !isLast && !sharesMeasureWithNext;

                return (
                  <div
                    key={verse.id}
                    id={`sheet-verse-row-${vIdx}`}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col gap-3 shadow-2xs ${
                      isPlaying
                        ? 'border-amber-500 ring-2 ring-amber-400/80 bg-amber-500/10 dark:bg-amber-950/30'
                        : isFull
                        ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90'
                        : underCount > 0
                        ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 ring-1 ring-amber-400/30'
                        : 'border-rose-300 dark:border-rose-800/80 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-400/30'
                    }`}
                  >
                    {/* Top Row: Info Badges & Action Toolbar */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-900 dark:text-amber-200 font-mono font-black text-xs border border-amber-300/80 dark:border-amber-700/80">
                          Verse #{vIdx + 1}
                        </span>

                        <span className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono font-bold text-xs border border-zinc-200 dark:border-zinc-700">
                          Measures #{verse.startMeasureNumber} – #{verse.endMeasureNumber}
                        </span>

                        {/* Section Selector */}
                        <select
                          value={
                            COMMON_SECTIONS.includes(verse.section || '')
                              ? verse.section
                              : verse.section
                              ? 'custom'
                              : ''
                          }
                          onChange={e => {
                            const val = e.target.value;
                            if (val !== 'custom' && onUpdateVerseSection) {
                              onUpdateVerseSection(verse, val);
                            }
                          }}
                          className="bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl px-2.5 py-1 cursor-pointer"
                          title="Set Section for Verse"
                        >
                          <option value="">(No Section)</option>
                          {COMMON_SECTIONS.map(sec => (
                            <option key={sec} value={sec}>
                              {sec}
                            </option>
                          ))}
                          {verse.section && !COMMON_SECTIONS.includes(verse.section) && (
                            <option value="custom">{verse.section}</option>
                          )}
                        </select>

                        {/* Chords Flow */}
                        {verse.chords.length > 0 ? (
                          <span className="text-amber-700 dark:text-amber-300 font-mono font-bold text-xs bg-amber-100/70 dark:bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-300/70 dark:border-amber-800/60">
                            {verse.chords.join(' → ')}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">No chords</span>
                        )}

                        {/* Aggregate Beat Badge */}
                        <div
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-bold border ${
                            isFull
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
                              : underCount > 0
                              ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {isFull ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <AlertCircle
                              className={`w-3.5 h-3.5 ${underCount > 0 ? 'text-amber-600' : 'text-rose-600'}`}
                            />
                          )}
                          <span>
                            {isFull
                              ? `Full (${totalBeats}/${expectedBeats} Beats)`
                              : underCount > 0
                              ? `${underCount} Under-beat (${totalBeats}/${expectedBeats})`
                              : `${overCount} Over-beat (${totalBeats}/${expectedBeats})`}
                          </span>
                        </div>

                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                          {verse.notes.length} notes
                        </span>
                      </div>

                      {/* Right Controls */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Audition Button */}
                        {onTogglePlayVerse && (
                          <button
                            type="button"
                            onClick={() => onTogglePlayVerse(vIdx, verse.notes)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isPlaying
                                ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 animate-pulse font-black'
                                : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                            }`}
                            title={isPlaying ? 'Stop playback' : `Audition Verse #${vIdx + 1}`}
                          >
                            {isPlaying ? (
                              <>
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Audition</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Fill Rest if under-beat */}
                        {underCount > 0 && onAutoFillVerseRests && (
                          <button
                            type="button"
                            onClick={() => onAutoFillVerseRests(verse)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition-colors cursor-pointer touch-manipulation"
                            title={`Auto-pad missing beats in under-beat measures of Verse #${vIdx + 1}`}
                          >
                            <Wand2 className="w-3 h-3" />
                            <span>Fill Rest</span>
                          </button>
                        )}

                        {/* Line break toggle on verse boundary */}
                        {onToggleVerseLineBreak && (
                          <button
                            type="button"
                            onClick={() => onToggleVerseLineBreak(verse)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                              hasLineBreak
                                ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-600 font-black'
                                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                            }`}
                            title={
                              hasLineBreak
                                ? 'Line break enabled after this verse (Click to toggle)'
                                : 'Enable line break after this verse'
                            }
                          >
                            <CornerDownLeft className="w-3.5 h-3.5" />
                            <span>{hasLineBreak ? 'Break ↵' : 'No Break'}</span>
                          </button>
                        )}

                        {/* Reorder Verses Up / Down */}
                        {onMoveVerse && (
                          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => onMoveVerse(vIdx, vIdx - 1)}
                              disabled={!canMoveUp}
                              className="p-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              title={
                                sharesMeasureWithPrev
                                  ? 'Cannot reorder: shares a measure with previous verse'
                                  : 'Move verse earlier'
                              }
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveVerse(vIdx, vIdx + 1)}
                              disabled={!canMoveDown}
                              className="p-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              title={
                                sharesMeasureWithNext
                                  ? 'Cannot reorder: shares a measure with next verse'
                                  : 'Move verse later'
                              }
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Deep link: Jump to Edit in Verse Mode */}
                        <button
                          type="button"
                          onClick={() => onSelectVerse(verse)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700 text-xs font-bold transition-all cursor-pointer"
                          title="Jump to lyric & breath alignment in Verse Mode"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Edit Verse</span>
                        </button>

                        {/* Duplicate Verse */}
                        {onDuplicateVerse && (
                          <button
                            id={`sheet-duplicate-verse-btn-${vIdx}`}
                            type="button"
                            onClick={() => onDuplicateVerse(verse)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-xs font-bold transition-colors cursor-pointer"
                            title={`Duplicate verse #${vIdx + 1}`}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Duplicate</span>
                          </button>
                        )}

                        {/* Delete Verse */}
                        {onDeleteVerse && computedVerses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteVerse(verse)}
                            className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                            title="Delete this entire verse"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Lyric Summary Preview & Quick Batch Lyric Distribute Field */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                      {/* Complete Lyric Display for Verse */}
                      <div className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 flex-1 min-w-[200px]">
                        <span className="text-[11px] font-bold text-zinc-400 shrink-0">歌詞:</span>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-zinc-800 dark:text-zinc-100 font-bold font-serif text-xs sm:text-sm">
                            {lyricPreview ? `“${lyricPreview}”` : <span className="italic text-zinc-400 font-normal">(無歌詞)</span>}
                          </span>
                          {(verse.lyricSummary.poj || verse.lyricSummary.tl) && (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-serif italic">
                              [{verse.lyricSummary.poj || verse.lyricSummary.tl}]
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Whole-Verse Lyric Distributor Field */}
                      {onDistributeVerseLyrics && (
                        <div className="flex items-center gap-1.5 w-full sm:w-auto sm:min-w-[280px]">
                          <input
                            type="text"
                            value={verseLyricInputs[vIdx] || ''}
                            onChange={e =>
                              setVerseLyricInputs(prev => ({ ...prev, [vIdx]: e.target.value }))
                            }
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleDistributeLyric(verse, vIdx);
                              }
                            }}
                            placeholder="填入段落歌詞 (羅馬字 / 漢羅)..."
                            className="flex-1 px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 font-serif"
                          />
                          <button
                            type="button"
                            onClick={() => handleDistributeLyric(verse, vIdx)}
                            disabled={!(verseLyricInputs[vIdx] || '').trim()}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-35 text-zinc-950 font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
                          >
                            分發歌詞
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Notes with Lyrics Row for Verse */}
                    <div className="w-full pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                      <div className="flex items-center justify-between mb-1 text-[11px] text-zinc-400">
                        <span className="font-bold text-zinc-500 dark:text-zinc-400 text-xs">
                          音符與歌詞 (Notes &amp; Lyrics across Verse Measures):
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          {verse.notes.length} notes
                        </span>
                      </div>

                      <div
                        className="flex items-stretch gap-1.5 overflow-x-auto pb-1.5 pt-0.5 select-none scrollbar-thin"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                      >
                        {verse.notes.length === 0 ? (
                          <div className="text-xs text-zinc-400 italic py-2 px-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                            No notes in verse
                          </div>
                        ) : (
                          verse.notes.map((ref, rIdx) => (
                            <React.Fragment key={`verse-${verse.id}-note-${ref.note.id || rIdx}`}>
                              {ref.isFirstInMeasure && (
                                <div className="flex flex-col justify-center items-center px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono font-bold text-zinc-500 shrink-0 self-center">
                                  #{ref.measureIndex + 1}
                                </div>
                              )}
                              <NumberedNotationNoteComponent
                                id={`sheet-note-${ref.note.id || `${ref.measureIndex}-${ref.noteIndex}`}`}
                                note={ref.note}
                                prevNote={rIdx > 0 ? verse.notes[rIdx - 1].note : null}
                                isSelected={selectedMeasureIndex === ref.measureIndex && selectedNoteIndex === ref.noteIndex}
                                isActive={activePlaybackNoteId === ref.note.id}
                                displayMode={displayMode}
                                onClick={e => {
                                  e?.stopPropagation();
                                  if (onSelectNote) {
                                    onSelectNote(ref.measureIndex, ref.noteIndex);
                                  } else {
                                    onSelectMeasure(ref.measureIndex);
                                  }
                                }}
                              />
                            </React.Fragment>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            )
          )}
        </div>
      )}

      {/* Floating Sticky Play Deck for Sheet Mode */}
      {onTogglePlaySheetFromNote && (
        <div
          id="sheet-floating-play-bar"
          className="sticky bottom-3 sm:bottom-5 z-40 mx-auto max-w-2xl w-full flex items-center justify-between gap-3 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-zinc-900/95 dark:bg-zinc-900/95 text-white shadow-2xl border border-zinc-700/80 backdrop-blur-md transition-all"
        >
          {/* Left: Selected Note Info & Quick Navigation */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="flex items-center bg-zinc-800 p-0.5 rounded-xl border border-zinc-700 shrink-0">
              <button
                id="sheet-floating-prev-note-btn"
                type="button"
                onClick={onNavigatePrevNote}
                disabled={!onNavigatePrevNote}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
                title="Previous Note (Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                id="sheet-floating-next-note-btn"
                type="button"
                onClick={onNavigateNextNote}
                disabled={!onNavigateNextNote}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
                title="Next Note (Right Arrow)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Current Note Pill */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                <span className="text-zinc-400 font-normal">Play from:</span>
                {selectedNoteInfo ? (
                  <span className="font-mono text-amber-400 font-black">
                    Measure #{selectedNoteInfo.measureNumber}, Note #{selectedNoteInfo.noteNumber}
                  </span>
                ) : (
                  <span className="text-zinc-400 italic font-normal">Measure #1, Note #1 (Beginning)</span>
                )}
              </div>
              {selectedNoteInfo?.details && (
                <div className="text-[11px] text-zinc-300 font-serif truncate">
                  {selectedNoteInfo.details}
                </div>
              )}
            </div>
          </div>

          {/* Right: Master Play Key */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="sheet-floating-play-key-btn"
              type="button"
              onClick={() => onTogglePlaySheetFromNote(selectedMeasureIndex ?? 0, selectedNoteIndex ?? 0)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] ${
                isPlayingSheet
                  ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-300 animate-pulse'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
              }`}
              title={
                isPlayingSheet
                  ? 'Stop playback (Space / P)'
                  : selectedNoteInfo
                  ? `Play sheet starting from Measure #${selectedNoteInfo.measureNumber}, Note #${selectedNoteInfo.noteNumber} (Space / P)`
                  : 'Play sheet from beginning (Space / P)'
              }
            >
              {isPlayingSheet ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Sheet</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play from Note</span>
                </>
              )}
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-black/30 rounded font-mono font-bold">
                Space / P
              </kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
