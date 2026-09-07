'use client';

import React from 'react';
import { Minus, Plus, Type } from 'lucide-react';
import { useUiZoom } from '@/hooks/useUiZoom';

export interface UiZoomControlProps {
  idPrefix?: string;
  compact?: boolean;
  className?: string;
}

export const UiZoomControl: React.FC<UiZoomControlProps> = ({
  idPrefix = 'ui-zoom',
  compact = false,
  className = '',
}) => {
  const { zoom, zoomIn, zoomOut, resetZoom, canZoomIn, canZoomOut, zoomPercent } = useUiZoom();

  const handleResetOrCycle = () => {
    if (zoomPercent !== 100) {
      resetZoom();
    } else {
      zoomIn();
    }
  };

  const isCustom = zoomPercent !== 100;

  if (compact) {
    return (
      <div
        id={`${idPrefix}-group`}
        className={`flex items-center bg-zinc-100 dark:bg-[#141720] p-0.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 text-xs shrink-0 ${className}`}
      >
        <button
          id={`${idPrefix}-out-btn`}
          type="button"
          onClick={zoomOut}
          disabled={!canZoomOut}
          className="p-1 sm:px-1.5 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] min-w-[28px] flex items-center justify-center"
          title="縮小介面字級 Zoom Out Text [Alt + -]"
          aria-label="縮小介面字級 Zoom Out Text"
        >
          <Minus className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
        </button>

        <button
          id={`${idPrefix}-reset-btn`}
          type="button"
          onClick={handleResetOrCycle}
          className={`px-1.5 py-1 font-mono font-bold text-xs rounded-md transition-all cursor-pointer touch-manipulation select-none flex items-center gap-0.5 ${
            isCustom
              ? 'text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25'
              : 'text-zinc-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400'
          }`}
          title={`介面字級 UI Text Zoom: ${zoomPercent}% (點擊${isCustom ? '重設為 100%' : '放大至 110%'}) [Alt + 0]`}
          aria-label={`Current UI text zoom ${zoomPercent}%`}
        >
          <Type className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-mono text-[11px]">{zoomPercent}%</span>
        </button>

        <button
          id={`${idPrefix}-in-btn`}
          type="button"
          onClick={zoomIn}
          disabled={!canZoomIn}
          className="p-1 sm:px-1.5 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] min-w-[28px] flex items-center justify-center"
          title="放大介面字級 Zoom In Text [Alt + +]"
          aria-label="放大介面字級 Zoom In Text"
        >
          <Plus className="w-3.5 h-3.5 text-amber-500" />
        </button>
      </div>
    );
  }

  return (
    <div
      id={`${idPrefix}-group`}
      className={`flex items-center bg-zinc-100 dark:bg-[#141720] p-0.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 text-xs shrink-0 ${className}`}
    >
      <button
        id={`${idPrefix}-out-btn`}
        type="button"
        onClick={zoomOut}
        disabled={!canZoomOut}
        className="flex items-center justify-center p-1.5 sm:px-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] sm:min-h-[38px] min-w-[32px] shrink-0"
        title="縮小介面字級 Zoom Out UI Text [Alt + -]"
        aria-label="Zoom out UI text"
      >
        <Minus className="w-3.5 h-3.5 shrink-0 text-zinc-600 dark:text-zinc-300" />
      </button>

      <button
        id={`${idPrefix}-reset-btn`}
        type="button"
        onClick={handleResetOrCycle}
        className={`px-1.5 sm:px-2 py-1 font-mono font-bold text-xs rounded-md transition-all cursor-pointer touch-manipulation select-none flex items-center gap-1 shrink-0 ${
          isCustom
            ? 'text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25'
            : 'text-zinc-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400'
        }`}
        title={`介面字級 UI Text Zoom: ${zoomPercent}% (點擊${isCustom ? '重設為 100%' : '放大至 110%'}) [Alt + 0]`}
        aria-label={`Current UI text zoom ${zoomPercent}%`}
      >
        <Type className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="min-w-[38px] text-center font-mono font-bold">{zoomPercent}%</span>
      </button>

      <button
        id={`${idPrefix}-in-btn`}
        type="button"
        onClick={zoomIn}
        disabled={!canZoomIn}
        className="flex items-center justify-center p-1.5 sm:px-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] sm:min-h-[38px] min-w-[32px] shrink-0"
        title="放大介面字級 Zoom In UI Text [Alt + +]"
        aria-label="Zoom in UI text"
      >
        <Plus className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      </button>
    </div>
  );
};
