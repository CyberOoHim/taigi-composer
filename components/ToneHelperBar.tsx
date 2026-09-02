'use client';

import React, { useState } from 'react';
import { TAIGI_TONE_CHARS, PUNCTUATION_MARKS, ANNOTATION_MARKS } from '@/lib/taigiUtils';
import { Sparkles, Keyboard, MessageSquareQuote, FileText } from 'lucide-react';

interface ToneHelperBarProps {
  onInsertChar: (char: string) => void;
  className?: string;
}

export const ToneHelperBar: React.FC<ToneHelperBarProps> = ({ onInsertChar, className }) => {
  const [activeTab, setActiveTab] = useState<'tones' | 'punctuation' | 'annotations' | 'hanlo'>('tones');

  return (
    <div className={`flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl ${className || ''}`}>
      <div className="flex flex-wrap items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 gap-2">
        <div className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
          <Keyboard className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>台語聲調、標點符號與註解盤 (Taigi Diacritics & Annotations Palette)</span>
        </div>
        
        {/* Category Tabs */}
        <div className="flex items-center bg-zinc-200/70 dark:bg-zinc-800 p-0.5 rounded-lg text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('tones')}
            className={`px-2 py-0.5 rounded-md transition-all ${
              activeTab === 'tones'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            聲調符號
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('punctuation')}
            className={`px-2 py-0.5 rounded-md transition-all ${
              activeTab === 'punctuation'
                ? 'bg-white dark:bg-zinc-700 text-amber-700 dark:text-amber-300 shadow-2xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            標點符號
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('annotations')}
            className={`px-2 py-0.5 rounded-md transition-all ${
              activeTab === 'annotations'
                ? 'bg-white dark:bg-zinc-700 text-indigo-700 dark:text-indigo-300 shadow-2xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            樂曲註解
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hanlo')}
            className={`px-2 py-0.5 rounded-md transition-all ${
              activeTab === 'hanlo'
                ? 'bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-300 shadow-2xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            常用漢羅
          </button>
        </div>
      </div>

      {/* Tone Diacritics Tab */}
      {activeTab === 'tones' && (
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
          {TAIGI_TONE_CHARS.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => onInsertChar(item.char)}
              title={`${item.char} — ${item.desc}`}
              className="px-2 py-1 text-sm font-serif bg-white dark:bg-zinc-800 hover:bg-amber-100 hover:text-amber-900 dark:hover:bg-amber-950 dark:hover:text-amber-200 border border-zinc-200 dark:border-zinc-700 rounded-md transition-colors shadow-xs select-none active:scale-95"
            >
              <span className="font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Punctuation Marks Tab */}
      {activeTab === 'punctuation' && (
        <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto pr-1">
          {PUNCTUATION_MARKS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => onInsertChar(p.char)}
              title={`${p.label} — ${p.desc}`}
              className="px-2.5 py-1 text-sm font-mono font-bold bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-md transition-colors shadow-xs select-none active:scale-95"
            >
              <span>{p.label === ' ' ? '␣ (空白)' : p.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Annotations Tab */}
      {activeTab === 'annotations' && (
        <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto pr-1">
          {ANNOTATION_MARKS.map(ann => (
            <button
              key={ann.label}
              type="button"
              onClick={() => onInsertChar(ann.text)}
              title={`${ann.label} — ${ann.desc}`}
              className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-950 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 rounded-md transition-colors shadow-xs select-none active:scale-95"
            >
              <span>{ann.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Common Han-lo Phrases Tab */}
      {activeTab === 'hanlo' && (
        <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto pr-1">
          {['ê (的)', 'bô (無)', 'hó (好)', 'tio̍h (著)', 'beh (欲)', 'siūⁿ (想)', 'lâi (來)', 'kò͘ (故)', 'chhun (春)', 'hong (風)', 'kui (歸)', 'sim (心)'].map(phrase => {
            const text = phrase.split(' ')[0];
            return (
              <button
                key={phrase}
                type="button"
                onClick={() => onInsertChar(text)}
                className="px-2.5 py-1 text-xs font-serif bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-md whitespace-nowrap transition-colors shadow-xs select-none active:scale-95"
              >
                {phrase}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
