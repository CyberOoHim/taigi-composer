'use client';

import React, { useState } from 'react';
import { LyricSyllable, Song } from '@/types/song';
import { splitTaigiLyricSyllables } from '@/lib/taigiUtils';
import { convertTaigiLyricsWithAi } from '@/lib/geminiService';
import { AlignLeft, Sparkles, X, Check, Loader2, ArrowRight } from 'lucide-react';

interface QuickLyricAlignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
  onApplyLyrics: (updatedSong: Song) => void;
}

export const QuickLyricAlignerModal: React.FC<QuickLyricAlignerModalProps> = ({
  isOpen,
  onClose,
  song,
  onApplyLyrics,
}) => {
  const [inputText, setInputText] = useState('');
  const [targetField, setTargetField] = useState<'hanji' | 'poj' | 'pij' | 'custom' | 'auto_ai'>('auto_ai');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [previewTokens, setPreviewTokens] = useState<LyricSyllable[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate total notes available in song
  const totalNotesCount = song.measures.reduce((acc, m) => acc + m.notes.length, 0);

  // Handle preview generation
  const handleGeneratePreview = async () => {
    setAiError(null);
    if (!inputText.trim()) return;

    if (targetField === 'auto_ai') {
      setIsLoadingAi(true);
      try {
        const tokens = await convertTaigiLyricsWithAi(inputText.trim());
        setPreviewTokens(tokens);
      } catch (err: unknown) {
        // Fallback to local rule-based tokenizer
        const rawSyllables = splitTaigiLyricSyllables(inputText);
        const tokens: LyricSyllable[] = rawSyllables.map(s => ({
          hanji: s,
          poj: s,
          pij: s,
          custom: s,
        }));
        setPreviewTokens(tokens);
        setAiError('AI connection unavailable, applied local syllable tokenizer.');
      } finally {
        setIsLoadingAi(false);
      }
    } else {
      // Local splitting
      const rawSyllables = splitTaigiLyricSyllables(inputText);
      const tokens: LyricSyllable[] = rawSyllables.map(s => {
        const item: LyricSyllable = {};
        item[targetField] = s;
        return item;
      });
      setPreviewTokens(tokens);
    }
  };

  const handleApply = () => {
    if (previewTokens.length === 0) return;

    let tokenIdx = 0;
    const newMeasures = song.measures.map(m => {
      const newNotes = m.notes.map(note => {
        if (tokenIdx < previewTokens.length) {
          const tok = previewTokens[tokenIdx++];
          return {
            ...note,
            lyric: {
              ...note.lyric,
              ...(tok.hanji !== undefined ? { hanji: tok.hanji } : {}),
              ...(tok.poj !== undefined ? { poj: tok.poj } : {}),
              ...(tok.pij !== undefined ? { pij: tok.pij } : {}),
              ...(tok.custom !== undefined ? { custom: tok.custom } : {}),
            },
          };
        }
        return note;
      });

      return {
        ...m,
        notes: newNotes,
      };
    });

    onApplyLyrics({
      ...song,
      measures: newMeasures,
    });

    onClose();
  };

  return (
    <div id="quick-aligner-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div id="quick-aligner-modal-card" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-lg">
            <AlignLeft className="w-5 h-5 text-amber-500" />
            <span>台語歌詞智能對齊工具 (Taigi Lyric Syllable Aligner)</span>
          </div>
          <button
            id="quick-aligner-close-btn"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label htmlFor="aligner-input-text" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              貼上歌詞文字 (Paste Lyrics Text - Hanji / POJ / PIJ / Han-lô)
            </label>
            <textarea
              id="aligner-input-text"
              rows={4}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="例：獨夜無伴守燈下，清風對面吹 或 To̍k-iā bô-phōaⁿ siú teng-ē, chheng-hong tùi bīn chhoe..."
              className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 font-serif"
            />
          </div>

          {/* Target Field Mode Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              對齊模式 (Alignment Target Mode)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <button
                id="align-mode-auto-ai"
                type="button"
                onClick={() => setTargetField('auto_ai')}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border font-medium transition-all ${
                  targetField === 'auto_ai'
                    ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 全自動 (漢字+白話+臺羅)</span>
              </button>

              <button
                id="align-mode-hanji"
                type="button"
                onClick={() => setTargetField('hanji')}
                className={`p-2 rounded-xl border font-medium transition-all ${
                  targetField === 'hanji'
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                填入「漢字」
              </button>

              <button
                id="align-mode-poj"
                type="button"
                onClick={() => setTargetField('poj')}
                className={`p-2 rounded-xl border font-medium transition-all ${
                  targetField === 'poj'
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                填入「POJ (白話字)」
              </button>

              <button
                id="align-mode-pij"
                type="button"
                onClick={() => setTargetField('pij')}
                className={`p-2 rounded-xl border font-medium transition-all ${
                  targetField === 'pij'
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                填入「PIJ (臺羅)」
              </button>

              <button
                id="align-mode-custom"
                type="button"
                onClick={() => setTargetField('custom')}
                className={`p-2 rounded-xl border font-medium transition-all ${
                  targetField === 'custom'
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                填入「自訂漢羅」
              </button>
            </div>
          </div>

          {/* Action Trigger Button */}
          <button
            id="aligner-parse-btn"
            type="button"
            disabled={!inputText.trim() || isLoadingAi}
            onClick={handleGeneratePreview}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-semibold text-sm transition-all disabled:opacity-50"
          >
            {isLoadingAi ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI 台語音節解析與聲調標註中...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>解析音節並產生對齊預覽 (Parse & Preview)</span>
              </>
            )}
          </button>

          {aiError && (
            <p id="aligner-error-msg" className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
              {aiError}
            </p>
          )}

          {/* Preview Tokens Grid */}
          {previewTokens.length > 0 && (
            <div id="aligner-preview-container" className="flex flex-col gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  音節對齊預覽 (Syllables Preview: {previewTokens.length} 個音節 / 全曲共 {totalNotesCount} 個音符)
                </span>
                {previewTokens.length > totalNotesCount && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    (提示: 歌詞音節數多於當前音符數，超出部分將被忽略)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 rounded-xl max-h-48 overflow-y-auto">
                {previewTokens.map((tok, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                  >
                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">#{idx + 1}</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{tok.hanji || tok.custom || '—'}</span>
                    {(tok.poj || tok.pij) && (
                      <span className="font-serif italic text-emerald-600 dark:text-emerald-400 text-[11px]">{tok.poj || tok.pij}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
          <button
            id="aligner-cancel-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            取消 (Cancel)
          </button>
          <button
            id="aligner-apply-btn"
            type="button"
            disabled={previewTokens.length === 0}
            onClick={handleApply}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-sm shadow-md transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>套用到樂譜音符 (Apply to Score)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
