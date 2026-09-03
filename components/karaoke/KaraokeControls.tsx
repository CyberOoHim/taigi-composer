'use client';

import React from 'react';
import { InstrumentType, Song } from '@/types/song';
import { PlaybackState } from '@/lib/audioEngine';
import { KaraokeSection } from './SectionJumpBar';
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Repeat,
  SkipBack,
  SkipForward,
  Disc,
  Maximize2,
  Minimize2,
  ZoomIn,
} from 'lucide-react';

interface KaraokeControlsProps {
  playbackState: PlaybackState;
  songSections: KaraokeSection[];
  activeSection: KaraokeSection | null;
  totalDuration: number;
  currentDisplayTime: number;
  currentDisplayPercent: number;
  sliderDraggingPercent: number | null;
  instrument: InstrumentType;
  melodyVolume: number;
  backingVolume: number;
  metronomeVolume: number;
  transpose: number;
  tempoMultiplier: number;
  isLoopingMeasure: boolean;
  showMixer: boolean;
  song: Song;
  isStageMode?: boolean;
  onToggleStageMode?: () => void;
  zoomScale?: number;
  onCycleZoom?: () => void;
  onSliderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSliderPointerUp: () => void;
  onJumpToSection: (section: KaraokeSection) => void;
  onJumpPrevSection: () => void;
  onJumpNextSection: () => void;
  onRestart: () => void;
  onTogglePlay: () => void;
  onTranspose: (delta: number) => void;
  onSetTranspose: (val: number) => void;
  onSetInstrument: (inst: InstrumentType) => void;
  onToggleLoopMeasure: () => void;
  onToggleShowMixer: () => void;
  onSetMelodyVolume: (val: number) => void;
  onSetBackingVolume: (val: number) => void;
  onSetMetronomeVolume: (val: number) => void;
  onSetTempoMultiplier: (val: number) => void;
  formatTime: (seconds: number) => string;
}

export const KaraokeControls: React.FC<KaraokeControlsProps> = React.memo(({
  playbackState,
  songSections,
  activeSection,
  totalDuration,
  currentDisplayTime,
  currentDisplayPercent,
  sliderDraggingPercent,
  instrument,
  melodyVolume,
  backingVolume,
  metronomeVolume,
  transpose,
  tempoMultiplier,
  isLoopingMeasure,
  showMixer,
  song,
  isStageMode = false,
  onToggleStageMode,
  zoomScale = 1.0,
  onCycleZoom,
  onSliderChange,
  onSliderPointerUp,
  onJumpToSection,
  onJumpPrevSection,
  onJumpNextSection,
  onRestart,
  onTogglePlay,
  onTranspose,
  onSetTranspose,
  onSetInstrument,
  onToggleLoopMeasure,
  onToggleShowMixer,
  onSetMelodyVolume,
  onSetBackingVolume,
  onSetMetronomeVolume,
  onSetTempoMultiplier,
  formatTime,
}) => {
  return (
    <div className="p-4 bg-zinc-900/95 flex flex-col gap-3.5 safe-pb">
      {/* Progress Slider with Section Markers & Debounced Scrubbing */}
      <div className="flex flex-col gap-1.5 w-full">
        {/* Time & Active Section Info Bar */}
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400 min-w-[42px]">
              {formatTime(currentDisplayTime)}
            </span>
            {sliderDraggingPercent !== null && (
              <span className="text-[11px] font-sans px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                跳轉位置: {formatTime(currentDisplayTime)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeSection && (
              <span className="text-[11px] font-sans text-zinc-400 hidden sm:inline-flex items-center gap-1">
                <span>段落:</span>
                <span className="text-amber-300 font-bold">{activeSection.name}</span>
              </span>
            )}
            <span className="text-zinc-400 min-w-[42px] text-right">
              {formatTime(totalDuration)}
            </span>
          </div>
        </div>

        {/* Timeline Track with Visual Section Markers */}
        <div className="relative py-2.5 select-none group flex items-center">
          {/* Background Track Bar */}
          <div className="w-full h-3 bg-zinc-800/90 rounded-full relative overflow-hidden border border-zinc-700/60 shadow-inner">
            {/* Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 rounded-full transition-[width] duration-75"
              style={{ width: `${Math.max(0, Math.min(100, currentDisplayPercent))}%` }}
            />
          </div>

          {/* Visual Section Markers along the Track */}
          <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none">
            {songSections.map((sec, sIdx) => {
              const isSectionActive = activeSection?.id === sec.id;
              return (
                <div
                  key={sec.id}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-auto z-20"
                  style={{ left: `${sec.startPercent}%` }}
                >
                  {/* Interactive Marker Pin */}
                  <button
                    id={`ktv-slider-section-mark-${sIdx}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToSection(sec);
                    }}
                    className="group/mark relative flex flex-col items-center justify-center p-2 focus:outline-hidden cursor-pointer touch-manipulation transition-transform active:scale-90"
                    title={`段落標記: ${sec.name} (${formatTime(sec.startTimeSec)} · #${sec.startMeasureNumber}小節) - 點擊立即跳轉`}
                  >
                    {/* Vertical Notch Marker */}
                    <div
                      className={`w-1.5 h-4.5 rounded-full transition-all shadow-xs ${
                        isSectionActive
                          ? 'bg-amber-300 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] scale-110'
                          : 'bg-zinc-400 hover:bg-amber-400 group-hover/mark:bg-amber-400'
                      }`}
                    />

                    {/* Tooltip on Hover / Touch */}
                    <div className="absolute -top-9 opacity-0 group-hover/mark:opacity-100 group-focus/mark:opacity-100 pointer-events-none transition-all duration-150 transform -translate-y-1 group-hover/mark:translate-y-0 z-30 whitespace-nowrap">
                      <div className="bg-zinc-900 border border-amber-500/50 text-amber-300 text-[11px] font-medium px-2 py-0.5 rounded-md shadow-xl flex items-center gap-1.5 backdrop-blur-md">
                        <span className="font-bold">{sec.name}</span>
                        <span className="font-mono text-zinc-400 text-[10px]">{formatTime(sec.startTimeSec)}</span>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Overlaid Range Input for Smooth Scrubbing */}
          <input
            id="ktv-seek-slider"
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={currentDisplayPercent}
            onChange={onSliderChange}
            onMouseUp={onSliderPointerUp}
            onTouchEnd={onSliderPointerUp}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 touch-pan-x"
            aria-label="Karaoke Seek Slider"
          />
        </div>

        {/* Section Names Below Slider Track */}
        <div className="relative w-full h-5 hidden sm:block text-[10px] text-zinc-500 select-none overflow-hidden">
          {songSections.map((sec, sIdx) => {
            const isSectionActive = activeSection?.id === sec.id;
            return (
              <button
                key={`label-${sec.id}`}
                id={`ktv-slider-label-${sIdx}`}
                type="button"
                onClick={() => onJumpToSection(sec)}
                className={`absolute transform -translate-x-1/2 px-1.5 py-0.5 rounded-xs transition-all cursor-pointer truncate max-w-[100px] ${
                  isSectionActive
                    ? 'text-amber-300 font-bold bg-amber-500/20 border border-amber-500/40 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
                style={{
                  left: `${Math.min(92, Math.max(8, sec.startPercent))}%`,
                }}
                title={`跳轉至 ${sec.name}`}
              >
                {sec.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Main Transport Controls with Section Skip Navigation */}
        <div className="flex items-center gap-2">
          {/* Skip to Previous Section */}
          <button
            id="ktv-prev-section-btn"
            type="button"
            onClick={onJumpPrevSection}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all active:scale-95 touch-manipulation flex items-center justify-center cursor-pointer"
            title="Jump to Previous Section (上一段落)"
          >
            <SkipBack className="w-4.5 h-4.5" />
          </button>

          {/* Restart from beginning */}
          <button
            id="ktv-restart-btn"
            type="button"
            onClick={onRestart}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all active:scale-95 touch-manipulation flex items-center justify-center cursor-pointer"
            title="Restart from beginning (從頭重新播放)"
          >
            <RotateCcw className="w-4.5 h-4.5" />
          </button>

          {/* Big Play / Pause Button */}
          <button
            id="ktv-main-play-pause-btn"
            type="button"
            onClick={onTogglePlay}
            className="min-w-[50px] min-h-[48px] w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition-all touch-manipulation flex items-center justify-center cursor-pointer"
            title={playbackState.isPlaying ? 'Pause' : 'Play Karaoke'}
          >
            {playbackState.isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>

          {/* Skip to Next Section */}
          <button
            id="ktv-next-section-btn"
            type="button"
            onClick={onJumpNextSection}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all active:scale-95 touch-manipulation flex items-center justify-center cursor-pointer"
            title="Jump to Next Section (下一段落)"
          >
            <SkipForward className="w-4.5 h-4.5" />
          </button>

          {/* Loop Measure Toggle */}
          <button
            id="ktv-loop-measure-btn"
            type="button"
            onClick={onToggleLoopMeasure}
            className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl border transition-all active:scale-95 touch-manipulation flex items-center justify-center cursor-pointer ${
              isLoopingMeasure
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
            }`}
            title="Loop active measure (循環播放當前小節)"
          >
            <Repeat className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Key Changer (Transpose) Controls */}
        <div id="ktv-transpose-controls" className="flex items-center min-h-[44px] bg-zinc-800/90 rounded-xl p-1 border border-zinc-700 text-xs">
          <span className="px-2 font-medium text-zinc-400">移調:</span>
          <button
            id="ktv-transpose-down-btn"
            type="button"
            onClick={() => onTranspose(-1)}
            className="min-w-[36px] min-h-[36px] px-2 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 font-bold text-zinc-200 transition-all active:scale-90 touch-manipulation flex items-center justify-center cursor-pointer"
            title="Key down (b)"
          >
            ♭
          </button>
          <span className="px-2 font-mono font-bold text-amber-400 min-w-[32px] text-center">
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
          <button
            id="ktv-transpose-up-btn"
            type="button"
            onClick={() => onTranspose(1)}
            className="min-w-[36px] min-h-[36px] px-2 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 font-bold text-zinc-200 transition-all active:scale-90 touch-manipulation flex items-center justify-center cursor-pointer"
            title="Key up (#)"
          >
            ♯
          </button>
          {transpose !== 0 && (
            <button
              id="ktv-transpose-reset-btn"
              type="button"
              onClick={() => onSetTranspose(0)}
              className="ml-1 px-2 py-1 text-[11px] text-zinc-400 hover:text-white underline cursor-pointer touch-manipulation"
            >
              Reset
            </button>
          )}
        </div>

        {/* Instrument Selector */}
        <div id="ktv-instrument-control" className="flex items-center min-h-[44px] gap-1.5 bg-zinc-800/90 rounded-xl p-1.5 border border-zinc-700 text-xs">
          <span className="px-1 font-medium text-zinc-400 flex items-center gap-1">
            <Disc className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">音色:</span>
          </span>
          <select
            id="ktv-instrument-select"
            value={instrument}
            onChange={e => onSetInstrument(e.target.value as InstrumentType)}
            className="bg-zinc-900 text-zinc-200 font-medium px-2.5 py-1.5 min-h-[36px] rounded-lg border border-zinc-700 focus:outline-hidden focus:border-amber-400 cursor-pointer touch-manipulation"
          >
            <option value="piano">鋼琴 (Grand Piano)</option>
            <option value="flute">臺灣竹笛/蕭 (Traditional Flute)</option>
            <option value="guitar">古典吉他 (Acoustic Guitar)</option>
            <option value="synth">80s KTV 合成器 (Synthesizer)</option>
            <option value="bell">八音鐘 (Glockenspiel)</option>
          </select>
        </div>

        {/* Mixer & Tempo Toggle */}
        <button
          id="ktv-toggle-mixer-btn"
          type="button"
          onClick={onToggleShowMixer}
          className={`flex items-center min-h-[44px] gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all active:scale-95 touch-manipulation cursor-pointer ${
            showMixer
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>混音 & 速度</span>
        </button>

        {/* 1-Tap Zoom Toggle for Music Stand Ergonomics */}
        {onCycleZoom && (
          <button
            id="ktv-zoom-toggle-btn"
            type="button"
            onClick={onCycleZoom}
            className="flex items-center min-h-[44px] gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-amber-300 transition-all active:scale-95 touch-manipulation cursor-pointer"
            title={`譜架縮放 (Zoom): 目前 ${Math.round(zoomScale * 100)}% - 點擊循環切換 (100%~175%)`}
          >
            <ZoomIn className="w-4 h-4 text-amber-400" />
            <span>縮放 {Math.round(zoomScale * 100)}%</span>
          </button>
        )}

        {/* Stage Mode (Music Stand Fullscreen Overlay) Toggle */}
        {onToggleStageMode && (
          <button
            id="ktv-stage-mode-btn"
            type="button"
            onClick={onToggleStageMode}
            className={`flex items-center min-h-[44px] gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 touch-manipulation cursor-pointer ${
              isStageMode
                ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md'
                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
            }`}
            title={isStageMode ? '退出譜架全螢幕模式' : '開啟譜架/舞台專注模式 (Stage Mode)'}
          >
            {isStageMode ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4 text-amber-400" />
            )}
            <span>{isStageMode ? '離開譜架' : '譜架模式'}</span>
          </button>
        )}
      </div>

      {/* Collapsible Mixer & Tempo Panel */}
      {showMixer && (
        <div className="mt-2 p-4 bg-zinc-950/90 rounded-xl border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-200">
          {/* Melody Volume */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>主旋律導唱 (Melody Lead)</span>
              <span className="font-mono text-zinc-200">{Math.round(melodyVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={melodyVolume}
              onChange={e => onSetMelodyVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Backing Chord Volume */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>和弦伴奏 (Accompaniment)</span>
              <span className="font-mono text-zinc-200">{Math.round(backingVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={backingVolume}
              onChange={e => onSetBackingVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Metronome Volume */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>節拍器 (Metronome Beat)</span>
              <span className="font-mono text-zinc-200">{Math.round(metronomeVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={metronomeVolume}
              onChange={e => onSetMetronomeVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Tempo BPM Adjuster */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>速度 (Speed: {Math.round(song.bpm * tempoMultiplier)} BPM)</span>
              <span className="font-mono text-zinc-200">{tempoMultiplier.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={tempoMultiplier}
              onChange={e => onSetTempoMultiplier(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>
      )}
    </div>
  );
});

KaraokeControls.displayName = 'KaraokeControls';
