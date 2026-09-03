'use client';

import React, { useState, useMemo } from 'react';
import { BarlineType, JianpuNote, Song } from '@/types/song';
import { getMeasureRhythmReport } from '@/lib/taigiUtils';
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
} from 'lucide-react';

interface MeasureOrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
  onMoveMeasure: (fromIdx: number, toIdx: number) => void;
  onSelectMeasure: (mIdx: number) => void;
  onToggleLineBreak: (mIdx: number) => void;
  onUpdateBarlineType: (mIdx: number, barlineType: BarlineType) => void;
  onAutoFillRest: (mIdx: number) => void;
  onBatchAutoFillAllRests: () => void;
  onDeleteMeasure: (mIdx: number) => void;
  onAddMeasure: () => void;
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
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'incomplete'>('all');

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

  const stats = useMemo(() => {
    const total = measureReports.length;
    const complete = measureReports.filter(r => r.report.isFull).length;
    const under = measureReports.filter(r => r.report.isUnder).length;
    const over = measureReports.filter(r => r.report.isOver).length;
    const incomplete = under + over;
    return { total, complete, under, over, incomplete };
  }, [measureReports]);

  const displayedReports = useMemo(() => {
    if (filterMode === 'incomplete') {
      return measureReports.filter(r => !r.report.isFull);
    }
    return measureReports;
  }, [measureReports, filterMode]);

  if (!isOpen) return null;

  return (
    <div
      id="measure-organizer-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="measure-organizer-modal"
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden text-zinc-900 dark:text-zinc-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                Measure Organizer & Layout
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Inspect rhythm accuracy, reorder measures, and configure line breaks &amp; barlines
              </p>
            </div>
          </div>
          <button
            id="measure-organizer-close-btn"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close Organizer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Dashboard & Filter Toolbar */}
        <div className="p-4 bg-zinc-50/80 dark:bg-zinc-900/60 border-b border-zinc-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Quick Metrics */}
          <div className="flex items-center gap-2 flex-wrap font-medium">
            <span className="px-2.5 py-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
              {stats.total} Measures Total
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/60">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Full Beats: {stats.complete}</span>
            </span>
            {stats.incomplete > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/60">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Under / Over Beats: {stats.incomplete}</span>
              </span>
            )}
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Pill */}
            <div className="flex bg-white dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xs">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Show All ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('incomplete')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                  filterMode === 'incomplete'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Incomplete Only ({stats.incomplete})
              </button>
            </div>

            {/* Batch Quick-Fix Under-beat measures */}
            {stats.under > 0 && (
              <button
                id="measure-organizer-batch-fix-btn"
                type="button"
                onClick={onBatchAutoFillAllRests}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation"
                title="Automatically fill missing beats with rest notes (0) in all incomplete measures"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Auto-Pad Incomplete ({stats.under})</span>
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
          {displayedReports.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
              <p className="font-bold text-sm">All measures match their expected beat duration!</p>
              <p className="text-xs text-zinc-400 mt-1">No under-beat or over-beat measures found.</p>
            </div>
          ) : (
            displayedReports.map(({ measure, idx, report, lyricSnippet }) => {
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
                        <AlertCircle className={`w-3.5 h-3.5 ${report.isUnder ? 'text-amber-600' : 'text-rose-600'}`} />
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
                      title={measure.isLineBreak ? 'Line break enabled after this measure (Click to toggle)' : 'Enable line break after this measure'}
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
                        onClose();
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

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
          <span>Tip: Use &ldquo;↑ / ↓&rdquo; to reorder measures; enable &ldquo;Break&rdquo; to start a new line for better visual phrasing.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold rounded-xl transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
