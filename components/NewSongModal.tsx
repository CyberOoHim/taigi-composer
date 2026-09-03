'use client';

import React, { useEffect } from 'react';
import { FilePlus2, BookmarkPlus, X, AlertCircle, Sparkles } from 'lucide-react';

interface NewSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSongTitle: string;
  onConfirm: (saveCurrentFirst: boolean) => void;
}

export const NewSongModal: React.FC<NewSongModalProps> = ({
  isOpen,
  onClose,
  currentSongTitle,
  onConfirm,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="new-song-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="new-song-modal-card"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-song-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <FilePlus2 className="w-4 h-4" />
            </div>
            <h3
              id="new-song-modal-title"
              className="text-base font-extrabold text-zinc-900 dark:text-zinc-100"
            >
              Create New Song
            </h3>
          </div>
          <button
            id="new-song-modal-close-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4 text-xs text-zinc-600 dark:text-zinc-400">
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            A blank score canvas will be created (default Key C, 4/4 time, 80 BPM). You can immediately start composing notes and lyrics.
          </p>

          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                Current song: &ldquo;{currentSongTitle || 'Untitled'}&rdquo;
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                If you have unsaved changes, we recommend saving to your Custom Library first so you can reload it anytime.
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-[11px]">
              After creating a new song, expand &ldquo;Song Settings&rdquo; in the editor header to edit title, subtitle, composer, lyricist, and backstory!
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 pt-0 flex flex-col sm:flex-row-reverse gap-2 sm:gap-2.5">
          <button
            id="new-song-save-and-create-btn"
            type="button"
            onClick={() => onConfirm(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer min-h-[40px]"
          >
            <BookmarkPlus className="w-4 h-4" />
            <span>Save Current & Create New</span>
          </button>

          <button
            id="new-song-direct-create-btn"
            type="button"
            onClick={() => onConfirm(false)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer min-h-[40px]"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-zinc-500" />
            <span>Create Blank Song</span>
          </button>

          <button
            id="new-song-cancel-btn"
            type="button"
            onClick={onClose}
            className="flex items-center justify-center px-3 py-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium text-xs transition-colors cursor-pointer min-h-[40px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
