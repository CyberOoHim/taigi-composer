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
      className={`w-full px-4 sm:px-6 py-3.5 rounded-2xl border transition-all duration-200 shadow-md ${
        abLoop.enabled
          ? 'bg-zinc-900/95 border-amber-500/80 ring-2 ring-amber-500/30'
          : 'bg-zinc-900/80 border-zinc-800'
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
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
            }`}
            title="開啟或關閉合唱團樂句 A-B 循環排練模式"
          >
            <Repeat className={`w-4 h-4 ${abLoop.enabled ? 'animate-spin-slow' : ''}`} />
            <span>{abLoop.enabled ? 'A–B 循環排練中' : '開啟 A–B 循環排練'}</span>
          </button>

          {abLoop.enabled && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Point A Selector */}
              <div className="flex items-center gap-1.5 bg-zinc-800/90 border border-zinc-700 px-2.5 py-1.5 rounded-xl text-xs">
                <span className="font-bold text-amber-400">起點 A:</span>
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
                      第 {idx + 1} 小節 {m.section ? `(${m.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />

              {/* Point B Selector */}
              <div className="flex items-center gap-1.5 bg-zinc-800/90 border border-zinc-700 px-2.5 py-1.5 rounded-xl text-xs">
                <span className="font-bold text-amber-400">終點 B:</span>
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
                      第 {idx + 1} 小節 {m.section ? `(${m.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Span Badge */}
              <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-700">
                共 {abLoop.endMeasure - abLoop.startMeasure + 1} 小節
              </span>
            </div>
          )}
        </div>

        {/* Right: Quick Action Presets & Trigger */}
        {abLoop.enabled && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Presets */}
            <div className="flex items-center bg-zinc-800/90 rounded-xl p-0.5 border border-zinc-700/80 text-[11px]">
              <button
                type="button"
                onClick={handleSetPresetSection}
                className="px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer font-medium"
                title="以當前段落設為 A-B 範圍"
              >
                當前段落
              </button>
              <button
                type="button"
                onClick={handleSetPreset2Bars}
                className="px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer font-medium"
                title="以當前 2 小節設為 A-B 範圍"
              >
                2 小節
              </button>
              <button
                type="button"
                onClick={handleSetPreset4Bars}
                className="px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer font-medium"
                title="以當前 4 小節設為 A-B 範圍"
              >
                4 小節
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
              title="從起點 A 啟動循環排練"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isPlaying ? '重新排練 A–B' : '開始 A–B 排練'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Advanced Rehearsal Options Tray (Shown when enabled) */}
      {abLoop.enabled && (
        <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Loop Count Target */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-400 font-medium">循環次數:</span>
            {[
              { label: '無限 (∞)', val: 0 },
              { label: '3 次', val: 3 },
              { label: '5 次', val: 5 },
              { label: '10 次', val: 10 },
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
              <span>已排練: {abLoop.currentIteration} 次</span>
              {abLoop.loopTarget > 0 && <span>/ {abLoop.loopTarget} 次</span>}
            </div>
          </div>

          {/* Tempo Trainer (漸進變速訓練器) */}
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
              title="啟用漸進變速訓練：每循環一次自動提速 5%，直到滿速 100%"
            >
              <Zap className={`w-3.5 h-3.5 ${abLoop.tempoTrainer ? 'text-emerald-400' : ''}`} />
              <span>速度訓練器 (+5%/次)</span>
              {abLoop.tempoTrainer && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            {/* Current Tempo Multiplier */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 rounded-xl border border-zinc-700 text-zinc-300 font-mono">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              <span>目前速度: {Math.round(tempoMultiplier * 100)}%</span>
            </div>

            {/* Reset Tempo */}
            <button
              type="button"
              onClick={onResetTempo}
              className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
              title="重設速度至基準 100%"
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
              title="起跑前先敲 1 小節預備節拍 (1-measure count-in)"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>預備拍 (Count-in)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
