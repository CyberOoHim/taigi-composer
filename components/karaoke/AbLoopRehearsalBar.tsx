'use client';

import React from 'react';
import { Song } from '@/types/song';
import { KaraokeSection } from './SectionJumpBar';
import {
  Repeat,
  Zap,
  Play,
  RotateCcw,
  Gauge,
  Clock,
  Sparkles,
  ChevronRight,
  Check,
} from 'lucide-react';

export interface AbLoopState {
  enabled: boolean;
  startMeasure: number; // 0-indexed
  endMeasure: number;   // 0-indexed
  loopTarget: number;   // 0 for infinite, 3, 5, 10
  currentIteration: number;
  tempoTrainer: boolean;
  tempoStepPercent: number; // e.g. 5 for +5% each loop
  baseTempoMultiplier: number;
  maxTempoMultiplier: number;
  countInEnabled: boolean;
}

interface AbLoopRehearsalBarProps {
  song: Song;
  abLoop: AbLoopState;
  onUpdateAbLoop: (updater: (prev: AbLoopState) => AbLoopState) => void;
  activeSection: KaraokeSection | null;
  currentMeasureIndex: number;
  isPlaying: boolean;
  tempoMultiplier: number;
  onStartAbRehearsal: () => void;
  onStopAbRehearsal: () => void;
  onResetTempo: () => void;
}

export const AbLoopRehearsalBar: React.FC<AbLoopRehearsalBarProps> = ({
  song,
  abLoop,
  onUpdateAbLoop,
  activeSection,
  currentMeasureIndex,
  isPlaying,
  tempoMultiplier,
  onStartAbRehearsal,
  onStopAbRehearsal,
  onResetTempo,
}) => {
  const totalMeasures = song.measures.length;

  const handleToggleEnabled = () => {
    onUpdateAbLoop(prev => ({
      ...prev,
      enabled: !prev.enabled,
      currentIteration: 0,
      startMeasure: !prev.enabled
        ? activeSection
          ? activeSection.startMeasureIndex
          : Math.max(0, currentMeasureIndex)
        : prev.startMeasure,
      endMeasure: !prev.enabled
        ? activeSection
          ? activeSection.endMeasureIndex
          : Math.min(totalMeasures - 1, currentMeasureIndex + 3)
        : prev.endMeasure,
    }));
  };

  const handleSetPresetSection = () => {
    if (!activeSection) return;
    onUpdateAbLoop(prev => ({
      ...prev,
      enabled: true,
      startMeasure: activeSection.startMeasureIndex,
      endMeasure: activeSection.endMeasureIndex,
      currentIteration: 0,
    }));
  };

  const handleSetPreset2Bars = () => {
    const start = Math.max(0, currentMeasureIndex);
    const end = Math.min(totalMeasures - 1, start + 1);
    onUpdateAbLoop(prev => ({
      ...prev,
      enabled: true,
      startMeasure: start,
      endMeasure: end,
      currentIteration: 0,
    }));
  };

  const handleSetPreset4Bars = () => {
    const start = Math.max(0, currentMeasureIndex);
    const end = Math.min(totalMeasures - 1, start + 3);
    onUpdateAbLoop(prev => ({
      ...prev,
      enabled: true,
      startMeasure: start,
      endMeasure: end,
      currentIteration: 0,
    }));
  };

  return (
    <div
      id="ab-loop-rehearsal-bar"
      className={`w-full px-4 sm:px-6 py-3.5 rounded-2xl border transition-all duration-200 shadow-md select-none ${
        abLoop.enabled
          ? 'bg-[#10121a]/98 border-amber-500/70 ring-2 ring-amber-500/20'
          : 'bg-[#10121a]/85 border-zinc-800'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Master Toggle & Title */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            id="ab-loop-master-toggle-btn"
            type="button"
            onClick={handleToggleEnabled}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px] ${
              abLoop.enabled
                ? 'bg-amber-500 text-zinc-950 font-black shadow-md ring-2 ring-amber-400'
                : 'bg-[#0a0c10] hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
            }`}
            title="Toggle A-B Phrase Rehearsal Loop Mode"
          >
            <Repeat className={`w-4 h-4 ${abLoop.enabled ? 'animate-spin-slow' : ''}`} />
            <span>{abLoop.enabled ? 'A–B Loop Active' : 'Enable A–B Loop'}</span>
          </button>

          {abLoop.enabled && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Point A Selector */}
              <div className="flex items-center gap-1.5 bg-[#0a0c10] border border-zinc-800 px-3 py-1.5 rounded-xl text-xs min-h-[38px]">
                <span className="font-bold text-amber-400">Point A:</span>
                <select
                  id="ab-loop-start-select"
                  value={abLoop.startMeasure}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    onUpdateAbLoop(prev => ({
                      ...prev,
                      startMeasure: val,
                      endMeasure: Math.max(val, prev.endMeasure),
                      currentIteration: 0,
                    }));
                  }}
                  className="bg-transparent text-white font-mono font-bold focus:outline-hidden cursor-pointer"
                >
                  {song.measures.map((m, idx) => (
                    <option key={`start-${idx}`} value={idx} className="bg-zinc-900 text-white">
                      Measure #{idx + 1} {m.section ? `(${m.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />

              {/* Point B Selector */}
              <div className="flex items-center gap-1.5 bg-[#0a0c10] border border-zinc-800 px-3 py-1.5 rounded-xl text-xs min-h-[38px]">
                <span className="font-bold text-amber-400">Point B:</span>
                <select
                  id="ab-loop-end-select"
                  value={abLoop.endMeasure}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    onUpdateAbLoop(prev => ({
                      ...prev,
                      endMeasure: val,
                      startMeasure: Math.min(val, prev.startMeasure),
                      currentIteration: 0,
                    }));
                  }}
                  className="bg-transparent text-white font-mono font-bold focus:outline-hidden cursor-pointer"
                >
                  {song.measures.map((m, idx) => (
                    <option key={`end-${idx}`} value={idx} className="bg-zinc-900 text-white">
                      Measure #{idx + 1} {m.section ? `(${m.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Span Badge */}
              <span className="daw-lcd text-xs px-2.5 py-1 rounded-lg font-mono font-bold shadow-xs">
                {abLoop.endMeasure - abLoop.startMeasure + 1} Measures
              </span>
            </div>
          )}
        </div>

        {/* Right: Quick Action Presets & Trigger */}
        {abLoop.enabled && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Presets */}
            <div className="flex items-center bg-[#0a0c10] rounded-xl p-0.5 border border-zinc-800 text-[11px]">
              <button
                type="button"
                onClick={handleSetPresetSection}
                className="px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer font-medium min-h-[36px] touch-manipulation"
                title="Set A-B range to current section"
              >
                Current Section
              </button>
              <button
                type="button"
                onClick={handleSetPreset2Bars}
                className="px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer font-medium min-h-[36px] touch-manipulation"
                title="Set A-B range to current 2 measures"
              >
                2 Measures
              </button>
              <button
                type="button"
                onClick={handleSetPreset4Bars}
                className="px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer font-medium min-h-[36px] touch-manipulation"
                title="Set A-B range to current 4 measures"
              >
                4 Measures
              </button>
            </div>

            {/* Start / Stop Rehearsal Button */}
            <button
              id="ab-loop-run-btn"
              type="button"
              onClick={() => {
                if (isPlaying) {
                  onStopAbRehearsal();
                } else {
                  onStartAbRehearsal();
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title="Start loop rehearsal from Point A"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isPlaying ? 'Restart A–B' : 'Start A–B Loop'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Advanced Rehearsal Options Tray (Shown when enabled) */}
      {abLoop.enabled && (
        <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Loop Count Target */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-400 font-medium">Repetitions:</span>
            {[
              { label: 'Infinite (∞)', val: 0 },
              { label: '3x', val: 3 },
              { label: '5x', val: 5 },
              { label: '10x', val: 10 },
            ].map(opt => (
              <button
                key={opt.val}
                type="button"
                onClick={() =>
                  onUpdateAbLoop(prev => ({
                    ...prev,
                    loopTarget: opt.val,
                  }))
                }
                className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-colors cursor-pointer ${
                  abLoop.loopTarget === opt.val
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700/60'
                }`}
              >
                {opt.label}
              </button>
            ))}

            {/* Current Iteration Counter */}
            <div className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 text-amber-300 rounded-lg border border-zinc-700 font-mono font-bold">
              <span>Count: {abLoop.currentIteration}</span>
              {abLoop.loopTarget > 0 && <span>/ {abLoop.loopTarget}</span>}
            </div>
          </div>

          {/* Tempo Trainer */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="ab-loop-tempo-trainer-btn"
              type="button"
              onClick={() =>
                onUpdateAbLoop(prev => ({
                  ...prev,
                  tempoTrainer: !prev.tempoTrainer,
                }))
              }
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation ${
                abLoop.tempoTrainer
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-400/40'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700/60'
              }`}
              title="Enable tempo trainer: automatically accelerate 5% after each loop until 100%"
            >
              <Zap className={`w-3.5 h-3.5 ${abLoop.tempoTrainer ? 'text-emerald-400' : ''}`} />
              <span>Tempo Trainer (+5%/loop)</span>
              {abLoop.tempoTrainer && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            {/* Current Tempo Multiplier */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 rounded-xl border border-zinc-700 text-zinc-300 font-mono">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              <span>Speed: {Math.round(tempoMultiplier * 100)}%</span>
            </div>

            {/* Reset Tempo */}
            <button
              type="button"
              onClick={onResetTempo}
              className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
              title="Reset speed to 100%"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* 1-Bar Pre-Count-in Metronome Toggle */}
            <button
              type="button"
              onClick={() =>
                onUpdateAbLoop(prev => ({
                  ...prev,
                  countInEnabled: !prev.countInEnabled,
                }))
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                abLoop.countInEnabled
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/60 font-bold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700/60'
              }`}
              title="1-measure count-in before playback starts"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Count-in</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
