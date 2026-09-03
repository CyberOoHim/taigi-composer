'use client';

import React, { useState, useMemo } from 'react';
import { BarlineType, Song, VerseItem, VerseNoteRef } from '@/types/song';
import { getMeasureRhythmReport, groupSongIntoVerses } from '@/lib/taigiUtils';
import {
  X,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Wand2,
  SlidersHorizontal,
  ExternalLink,
  Plus,
  Trash2,
  AlignLeft,
  Layers,
  Play,
  Square,
  Copy,
  MessageSquareQuote,
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

export interface MeasureOrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
  // Measure operations
  onMoveMeasure: (fromIdx: number, toIdx: number) => void;
  onSelectMeasure: (mIdx: number) => void;
  onToggleLineBreak: (mIdx: number) => void;
  onUpdateBarlineType: (mIdx: number, barlineType: BarlineType) => void;
  onAutoFillRest: (mIdx: number) => void;
  onBatchAutoFillAllRests: () => void;
  onDeleteMeasure: (mIdx: number) => void;
  onAddMeasure: () => void;

  // Verse operations & props
  initialTab?: 'verse' | 'measure';
  verses?: VerseItem[];
  playingVerseIdx?: number | null;
  onTogglePlayVerse?: (vIdx: number, verseNotes: VerseNoteRef[]) => void;
  onMoveVerse?: (fromVerseIdx: number, toVerseIdx: number) => void;
  onSelectVerse?: (verse: VerseItem) => void;
  onToggleVerseLineBreak?: (verse: VerseItem) => void;
  onUpdateVerseSection?: (verse: VerseItem, section: string) => void;
  onAutoFillVerseRests?: (verse: VerseItem) => void;
  onDistributeVerseLyrics?: (verse: VerseItem, vIdx: number, text: string) => void;
  onDuplicateVerse?: (verse: VerseItem) => void;
  onDeleteVerse?: (verse: VerseItem) => void;
  onAddVerse?: () => void;
}

export const MeasureOrganizerModal: React.FC<MeasureOrganizerModalProps> = ({
  isOpen,
  onClose,
  song,
  onMoveMeasure,
  onSelectMeasure,
  onToggleLineBreak,
  onUpdateBarlineType,
  onAutoFillRest,
  onBatchAutoFillAllRests,
  onDeleteMeasure,
  onAddMeasure,
  initialTab = 'verse',
  verses: passedVerses,
  playingVerseIdx = null,
  onTogglePlayVerse,
  onMoveVerse,
  onSelectVerse,
  onToggleVerseLineBreak,
  onUpdateVerseSection,
  onAutoFillVerseRests,
  onDistributeVerseLyrics,
  onDuplicateVerse,
  onDeleteVerse,
  onAddVerse,
}) => {
  const [userTab, setUserTab] = useState<'verse' | 'measure' | null>(null);
  const activeTab = userTab ?? initialTab;
  const [measureFilterMode, setMeasureFilterMode] = useState<'all' | 'incomplete'>('all');
  const [verseFilterMode, setVerseFilterMode] = useState<'all' | 'incomplete'>('all');
  const [verseLyricInputs, setVerseLyricInputs] = useState<{ [vIdx: number]: string }>({});

  const handleClose = () => {
    setUserTab(null);
    onClose();
  };

  // Compute verses if not passed
  const computedVerses = useMemo(() => {
    return passedVerses ?? groupSongIntoVerses(song);
  }, [passedVerses, song]);

  // MEASURE REPORTS
  const measureReports = useMemo(() => {
    return song.measures.map((m, idx) => {
      const report = getMeasureRhythmReport(m, song.timeSignature || '4/4');
      const lyricSnippet = m.notes
        .map(n => n.lyric.hanji || n.lyric.custom || n.lyric.poj || '')
        .filter(Boolean)
        .slice(0, 5)
        .join('');

      return {
        measure: m,
        idx,
        report,
        lyricSnippet,
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
    if (measureFilterMode === 'incomplete') {
      return measureReports.filter(r => !r.report.isFull);
    }
    return measureReports;
  }, [measureReports, measureFilterMode]);

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
        verse.lyricSummary.hanji || verse.lyricSummary.custom || verse.lyricSummary.poj || '';

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
    if (verseFilterMode === 'incomplete') {
      return verseReports.filter(r => !r.isFull);
    }
    return verseReports;
  }, [verseReports, verseFilterMode]);

  if (!isOpen) return null;

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
      id="measure-organizer-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        id="measure-organizer-modal"
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden text-zinc-900 dark:text-zinc-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header with Title & Dual-Tab Switcher */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                Organizer &amp; Layout
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Structure, reorder, inspect rhythm health, and format layout by Verses or Measures
              </p>
            </div>
          </div>

          {/* Dual-Mode Tab Switcher (Verses vs Measures) */}
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xs">
              <button
                id="organizer-tab-verse"
                type="button"
                onClick={() => setUserTab('verse')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  activeTab === 'verse'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Verses ({computedVerses.length})</span>
              </button>

              <button
                id="organizer-tab-measure"
                type="button"
                onClick={() => setUserTab('measure')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  activeTab === 'measure'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Measures ({song.measures.length})</span>
              </button>
            </div>

            <button
              id="measure-organizer-close-btn"
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close Organizer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VERSE ORGANIZER TAB CONTENT                                               */}
        {/* ========================================================================= */}
        {activeTab === 'verse' && (
          <>
            {/* Status Dashboard & Filter Toolbar for Verses */}
            <div className="p-4 bg-zinc-50/80 dark:bg-zinc-900/60 border-b border-zinc-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              {/* Quick Verse Metrics */}
              <div className="flex items-center gap-2 flex-wrap font-medium">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
                  {verseStats.total} Verses Total ({song.measures.length} Measures)
                </span>
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Full Rhythm: {verseStats.complete}</span>
                </span>
                {verseStats.incomplete > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/60">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Rhythm Deficit: {verseStats.incomplete}</span>
                  </span>
                )}
              </div>

              {/* Action Tools for Verses */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Filter Pill */}
                <div className="flex bg-white dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setVerseFilterMode('all')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      verseFilterMode === 'all'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    Show All ({verseStats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerseFilterMode('incomplete')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      verseFilterMode === 'incomplete'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    Incomplete Only ({verseStats.incomplete})
                  </button>
                </div>

                {/* Batch Quick-Fix Under-beat measures in all verses */}
                {measureStats.under > 0 && (
                  <button
                    id="verse-organizer-batch-fix-btn"
                    type="button"
                    onClick={onBatchAutoFillAllRests}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation"
                    title="Automatically fill missing beats with rest notes (0) in all incomplete measures"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Auto-Pad All ({measureStats.under})</span>
                  </button>
                )}

                {onAddVerse && (
                  <button
                    id="verse-organizer-add-verse-btn"
                    type="button"
                    onClick={onAddVerse}
                    className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Verse</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Verses List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              {displayedVerseReports.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-500">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                  <p className="font-bold text-sm">All verses match their expected rhythm durations!</p>
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
                        id={`organizer-verse-row-${vIdx}`}
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
                        {/* Top Row: Verse Info, Section, Chords, Beats Badge, and Primary Action Toolbar */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {/* Verse Position Badge */}
                            <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-900 dark:text-amber-200 font-mono font-black text-xs border border-amber-300/80 dark:border-amber-700/80">
                              Verse #{vIdx + 1}
                            </span>

                            {/* Measure Range Badge */}
                            <span className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono font-bold text-xs border border-zinc-200 dark:border-zinc-700">
                              Measures #{verse.startMeasureNumber} – #{verse.endMeasureNumber}
                            </span>

                            {/* Section Tag Editor / Selector */}
                            <div className="flex items-center gap-1">
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
                            </div>

                            {/* Chords Sequence Flow */}
                            {verse.chords.length > 0 ? (
                              <span className="text-amber-700 dark:text-amber-300 font-mono font-bold text-xs bg-amber-100/70 dark:bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-300/70 dark:border-amber-800/60">
                                {verse.chords.join(' → ')}
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400 italic">No chords</span>
                            )}

                            {/* Aggregate Beat Rhythm Badge */}
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

                            {/* Note count */}
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                              {verse.notes.length} notes
                            </span>
                          </div>

                          {/* Right Controls: Audition, Reorder, Break, Duplicate, Delete */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Audition Play/Stop */}
                            {onTogglePlayVerse && (
                              <button
                                id={`organizer-verse-play-btn-${vIdx}`}
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

                            {/* Line Break toggle on verse boundary */}
                            {onToggleVerseLineBreak && (
                              <button
                                type="button"
                                onClick={() => onToggleVerseLineBreak(verse)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                  hasLineBreak
                                    ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-600'
                                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                                }`}
                                title={
                                  hasLineBreak
                                    ? 'Line break enabled after this verse (Click to toggle)'
                                    : 'Enable line break after this verse'
                                }
                              >
                                <CornerDownLeft className="w-3.5 h-3.5" />
                                <span>{hasLineBreak ? 'Break' : 'No Break'}</span>
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

                            {/* Jump to edit verse in score */}
                            {onSelectVerse && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectVerse(verse);
                                  handleClose();
                                }}
                                className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                                title="Jump to edit this verse in score"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Duplicate Verse */}
                            {onDuplicateVerse && (
                              <button
                                type="button"
                                onClick={() => onDuplicateVerse(verse)}
                                className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                                title="Duplicate this verse"
                              >
                                <Copy className="w-3.5 h-3.5" />
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
                          {/* Lyric preview snippet */}
                          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <span className="text-[11px] font-bold text-zinc-400 shrink-0">Lyrics:</span>
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate">
                              {lyricPreview ? `"${lyricPreview}"` : <span className="italic text-zinc-400">(No lyrics assigned)</span>}
                            </span>
                            {verse.lyricSummary.poj && (
                              <span className="text-zinc-400 dark:text-zinc-500 text-[11px] truncate hidden md:inline">
                                ({verse.lyricSummary.poj})
                              </span>
                            )}
                          </div>

                          {/* Quick Batch Lyric Field inside Verse row */}
                          {onDistributeVerseLyrics && (
                            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[260px]">
                              <MessageSquareQuote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
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
                                placeholder="Paste lyrics to distribute..."
                                className="flex-1 px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                              />
                              <button
                                id={`organizer-verse-distribute-btn-${vIdx}`}
                                type="button"
                                onClick={() => handleDistributeLyric(verse, vIdx)}
                                disabled={!(verseLyricInputs[vIdx] || '').trim()}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-35 text-zinc-950 font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
                              >
                                Distribute
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* MEASURE ORGANIZER TAB CONTENT (Preserved 100%)                            */}
        {/* ========================================================================= */}
        {activeTab === 'measure' && (
          <>
            {/* Status Dashboard & Filter Toolbar for Measures */}
            <div className="p-4 bg-zinc-50/80 dark:bg-zinc-900/60 border-b border-zinc-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              {/* Quick Metrics */}
              <div className="flex items-center gap-2 flex-wrap font-medium">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
                  {measureStats.total} Measures Total
                </span>
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Full Beats: {measureStats.complete}</span>
                </span>
                {measureStats.incomplete > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/60">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Under / Over Beats: {measureStats.incomplete}</span>
                  </span>
                )}
              </div>

              {/* Action Tools */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Filter Pill */}
                <div className="flex bg-white dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setMeasureFilterMode('all')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      measureFilterMode === 'all'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    Show All ({measureStats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeasureFilterMode('incomplete')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      measureFilterMode === 'incomplete'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    Incomplete Only ({measureStats.incomplete})
                  </button>
                </div>

                {/* Batch Quick-Fix Under-beat measures */}
                {measureStats.under > 0 && (
                  <button
                    id="measure-organizer-batch-fix-btn"
                    type="button"
                    onClick={onBatchAutoFillAllRests}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation"
                    title="Automatically fill missing beats with rest notes (0) in all incomplete measures"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Auto-Pad Incomplete ({measureStats.under})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onAddMeasure}
                  className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold rounded-xl transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Measure</span>
                </button>
              </div>
            </div>

            {/* Scrollable Measures List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {displayedMeasureReports.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-500">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                  <p className="font-bold text-sm">All measures match their expected beat duration!</p>
                  <p className="text-xs text-zinc-400 mt-1">No under-beat or over-beat measures found.</p>
                </div>
              ) : (
                displayedMeasureReports.map(({ measure, idx, report, lyricSnippet }) => {
                  const isFirst = idx === 0;
                  const isLast = idx === song.measures.length - 1;

                  return (
                    <div
                      key={measure.id}
                      id={`organizer-measure-row-${idx}`}
                      className={`p-3 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs ${
                        report.isFull
                          ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90'
                          : report.isUnder
                          ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 ring-1 ring-amber-400/40'
                          : 'border-rose-300 dark:border-rose-800/80 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-400/40'
                      }`}
                    >
                      {/* Left: Measure Info & Rhythm Status */}
                      <div className="flex items-center gap-3 flex-wrap flex-1">
                        {/* Position Handle & Number */}
                        <div className="flex items-center gap-1.5">
                          <span className="w-10 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono font-black text-xs flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                            #{idx + 1}
                          </span>
                        </div>

                        {/* Section Tag */}
                        {measure.section ? (
                          <span className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                            {measure.section}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">No Section</span>
                        )}

                        {/* Chord Tag */}
                        {measure.chord ? (
                          <span className="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 font-mono font-black text-xs border border-amber-300 dark:border-amber-700">
                            {measure.chord}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">No Chord</span>
                        )}

                        {/* Beat Report Badge */}
                        <div
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-bold border ${
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
                              {report.isUnder ? `(-${report.absDiff} beats)` : `(+${report.absDiff} beats)`}
                            </span>
                          )}
                        </div>

                        {/* Lyric Preview Snippet */}
                        <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium truncate max-w-[140px] sm:max-w-[180px]">
                          {lyricSnippet ? `"${lyricSnippet}…"` : '(No lyrics)'}
                        </span>

                        {/* Notes count */}
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                          {measure.notes.length} Notes
                        </span>
                      </div>

                      {/* Right: Controls & Adjustments */}
                      <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                        {/* Auto-fill rest button if under-beat */}
                        {report.isUnder && (
                          <button
                            type="button"
                            onClick={() => onAutoFillRest(idx)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition-colors cursor-pointer touch-manipulation"
                            title={`Auto-fill ${report.absDiff} beats rest note (0) at end of measure`}
                          >
                            <Plus className="w-3 h-3" />
                            <span>Fill Rest (+{report.absDiff})</span>
                          </button>
                        )}

                        {/* Line break toggle */}
                        <button
                          type="button"
                          onClick={() => onToggleLineBreak(idx)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            measure.isLineBreak
                              ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-600'
                              : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                          }`}
                          title={
                            measure.isLineBreak
                              ? 'Line break enabled after this measure (Click to toggle)'
                              : 'Enable line break after this measure'
                          }
                        >
                          <CornerDownLeft className="w-3.5 h-3.5" />
                          <span>{measure.isLineBreak ? 'Break' : 'No Break'}</span>
                        </button>

                        {/* Barline style select */}
                        <select
                          value={measure.barlineType || 'single'}
                          onChange={e => onUpdateBarlineType(idx, e.target.value as BarlineType)}
                          className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl px-2 py-1.5 cursor-pointer"
                          title="Barline Style"
                        >
                          <option value="single">| Single</option>
                          <option value="double">|| Double</option>
                          <option value="end">|| End</option>
                          <option value="repeat_start">|: Repeat Start</option>
                          <option value="repeat_end">:| Repeat End</option>
                        </select>

                        {/* Reorder: Move Up / Down */}
                        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => onMoveMeasure(idx, idx - 1)}
                            disabled={isFirst}
                            className="p-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Move earlier"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveMeasure(idx, idx + 1)}
                            disabled={isLast}
                            className="p-1 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Move later"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Jump to edit measure */}
                        <button
                          type="button"
                          onClick={() => {
                            onSelectMeasure(idx);
                            handleClose();
                          }}
                          className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                          title="Jump to edit measure"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete measure */}
                        {song.measures.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteMeasure(idx)}
                            className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                            title="Delete measure"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
          <span>
            {activeTab === 'verse'
              ? 'Tip: Use "↑ / ↓" to rearrange verses/phrases; "Break" sets a clean score line break at the verse boundary.'
              : 'Tip: Use "↑ / ↓" to reorder measures; enable "Break" to start a new line for better visual phrasing.'}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold rounded-xl transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const SongOrganizerModal = MeasureOrganizerModal;
