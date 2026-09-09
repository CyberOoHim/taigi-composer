'use client';

import React from 'react';
import { Volume2, VolumeX, Music, Layers } from 'lucide-react';
import { useChordPlayback } from '@/hooks/useChordPlayback';
import { audioEngine } from '@/lib/audioEngine';

interface ChordPlaybackControlProps {
  variant?: 'toolbar' | 'compact' | 'inline' | 'card';
  previewKeyChord?: string;
  className?: string;
  idPrefix?: string;
}

export const ChordPlaybackControl: React.FC<ChordPlaybackControlProps> = ({
  variant = 'toolbar',
  previewKeyChord = 'C',
  className = '',
  idPrefix = 'chord-ctrl',
}) => {
  const {
    chordEnabled,
    chordVolume,
    toggleChordEnabled,
    setChordVolume,
  } = useChordPlayback();

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setChordVolume(val);
  };

  const handlePointerUp = () => {
    // If not actively playing, give subtle audition feedback of chord at new volume
    if (!audioEngine.getIsPlaying() && chordEnabled && chordVolume > 0.05) {
      audioEngine.previewChord(previewKeyChord);
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-[#141720] p-1 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs ${className}`}>
        <button
          id={`${idPrefix}-toggle-btn`}
          type="button"
          onClick={toggleChordEnabled}
          aria-pressed={chordEnabled}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[32px] ${
            chordEnabled
              ? 'bg-amber-500 text-zinc-950 font-black shadow-xs'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
          }`}
          title={chordEnabled ? '關閉和弦伴奏 (Turn Chord OFF)' : '開啟和弦伴奏 (Turn Chord ON)'}
        >
          {chordEnabled ? (
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="text-[11px] whitespace-nowrap">
            {chordEnabled ? '和弦 ON' : '和弦 OFF'}
          </span>
        </button>

        <div className="flex items-center gap-1 px-1">
          <input
            id={`${idPrefix}-volume-slider`}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={chordVolume}
            disabled={!chordEnabled}
            onChange={handleVolumeChange}
            onPointerUp={handlePointerUp}
            className={`w-16 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500 transition-opacity ${
              !chordEnabled ? 'opacity-30 cursor-not-allowed' : 'opacity-100'
            }`}
            title={`和弦伴奏音量: ${Math.round(chordVolume * 100)}%`}
          />
          <span className={`text-[10px] font-mono w-7 text-right ${chordEnabled ? 'text-zinc-700 dark:text-zinc-300 font-bold' : 'text-zinc-400'}`}>
            {Math.round(chordVolume * 100)}%
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-[#12141c] rounded-xl border border-zinc-200/80 dark:border-zinc-800 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>和弦伴奏 (Chord Backing)</span>
          </div>
          <button
            id={`${idPrefix}-card-toggle`}
            type="button"
            onClick={toggleChordEnabled}
            aria-pressed={chordEnabled}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[30px] flex items-center gap-1 ${
              chordEnabled
                ? 'bg-amber-500 text-zinc-950 font-black shadow-xs'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
            }`}
            title={chordEnabled ? '關閉和弦伴奏' : '開啟和弦伴奏'}
          >
            {chordEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{chordEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            id={`${idPrefix}-card-volume-slider`}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={chordVolume}
            disabled={!chordEnabled}
            onChange={handleVolumeChange}
            onPointerUp={handlePointerUp}
            className={`flex-1 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500 transition-opacity ${
              !chordEnabled ? 'opacity-30 cursor-not-allowed' : 'opacity-100'
            }`}
          />
          <span className={`text-xs font-mono w-8 text-right font-bold ${chordEnabled ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400'}`}>
            {Math.round(chordVolume * 100)}%
          </span>
        </div>
      </div>
    );
  }

  // Default 'toolbar' variant: clean DAW studio transport cluster
  return (
    <div
      id={`${idPrefix}-container`}
      className={`flex items-center bg-zinc-100 dark:bg-[#141720] p-0.5 sm:p-1 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs gap-1 sm:gap-2 shrink-0 ${className}`}
    >
      {/* Toggle Button */}
      <button
        id={`${idPrefix}-toggle-btn`}
        type="button"
        onClick={toggleChordEnabled}
        aria-pressed={chordEnabled}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] sm:min-h-[38px] shrink-0 ${
          chordEnabled
            ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black shadow-xs'
            : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-750 text-zinc-500 dark:text-zinc-400 font-semibold'
        }`}
        title={chordEnabled ? '關閉和弦伴奏 (Mute Chords)' : '開啟和弦伴奏 (Enable Chords)'}
      >
        {chordEnabled ? (
          <Volume2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />
        ) : (
          <VolumeX className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />
        )}
        <span className="whitespace-nowrap">
          {chordEnabled ? '和弦 ON' : '和弦 OFF'}
        </span>
      </button>

      {/* Volume Slider & Percent Readout */}
      <div className="flex items-center gap-1.5 px-1 sm:px-1.5 shrink-0">
        <input
          id={`${idPrefix}-volume-slider`}
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={chordVolume}
          disabled={!chordEnabled}
          onChange={handleVolumeChange}
          onPointerUp={handlePointerUp}
          className={`w-14 sm:w-20 md:w-24 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500 transition-opacity ${
            !chordEnabled ? 'opacity-30 cursor-not-allowed' : 'opacity-100'
          }`}
          title={`和弦伴奏音量: ${Math.round(chordVolume * 100)}%`}
        />
        <span
          className={`text-[11px] sm:text-xs font-mono w-8 text-right select-none ${
            chordEnabled ? 'text-zinc-800 dark:text-zinc-200 font-bold' : 'text-zinc-400'
          }`}
          title={`和弦音量 ${Math.round(chordVolume * 100)}%`}
        >
          {Math.round(chordVolume * 100)}%
        </span>
      </div>
    </div>
  );
};
