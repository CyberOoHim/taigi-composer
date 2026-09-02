'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { JianpuNote, KeySignature, PitchNumber } from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import { KEY_SEMITONES, SCALE_DEGREE_SEMITONES } from '@/lib/taigiUtils';
import { Music, Sparkles } from 'lucide-react';

interface PianoKeyboardProps {
  keySignature: KeySignature;
  currentNote: JianpuNote | null;
  onSelectPitch: (pitch: PitchNumber, octave: number, accidental: '' | '#' | 'b') => void;
  audioEngine: AudioEngine;
  className?: string;
}

// 12 chromatic note names
const CHROMATIC_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface KeyDefinition {
  isBlack: boolean;
  pitch: PitchNumber;
  accidental: '' | '#' | 'b';
  octave: number;
  jianpuLabel: string;
  accidentalLabel?: string;
  solfege: string;
  noteName: string;
  leftPercent?: number; // for black keys positioning
}

export const PianoKeyboard: React.FC<PianoKeyboardProps> = React.memo(({
  keySignature,
  currentNote,
  onSelectPitch,
  audioEngine,
  className = '',
}) => {
  // Octave display range view: 'low_mid' (-1, 0), 'mid_high' (0, 1), 'all' (-1, 0, 1), 'mid' (0)
  const [octaveView, setOctaveView] = useState<'low_mid' | 'mid_high' | 'all' | 'mid'>('low_mid');
  // Label mode: 'both' | 'jianpu' | 'note'
  const [labelMode, setLabelMode] = useState<'both' | 'jianpu' | 'note'>('both');

  // Base key semitone relative to C4 (0 = C)
  const baseKeySemitone = KEY_SEMITONES[keySignature] ?? 0;

  // Helper to compute absolute note name and octave from Jianpu scale degree + key
  const getNoteDetails = useMemo(() => {
    return (pitch: PitchNumber, octave: number, accidental: '' | '#' | 'b') => {
      if (pitch === 'empty' || pitch === 0) {
        return { noteName: '', solfege: '', midiNote: 0 };
      }

      const degreeOffset = SCALE_DEGREE_SEMITONES[pitch] || 0;
      let accOffset = 0;
      if (accidental === '#') accOffset = 1;
      if (accidental === 'b') accOffset = -1;

      const totalSemitones = baseKeySemitone + degreeOffset + octave * 12 + accOffset;
      const midiNote = 60 + totalSemitones; // 60 = C4

      const noteIndex = ((midiNote % 12) + 12) % 12;
      const calcOctave = Math.floor(midiNote / 12) - 1;
      const rawName = CHROMATIC_NOTE_NAMES[noteIndex];

      const solfegeMap: Record<string, string> = {
        '1': 'Do',
        '1#': 'Di',
        '2b': 'Ra',
        '2': 'Re',
        '2#': 'Ri',
        '3b': 'Me',
        '3': 'Mi',
        '4': 'Fa',
        '4#': 'Fi',
        '5b': 'Se',
        '5': 'Sol',
        '5#': 'Si',
        '6b': 'Le',
        '6': 'La',
        '6#': 'Li',
        '7b': 'Te',
        '7': 'Ti',
      };

      const keyTag = `${pitch}${accidental || ''}`;
      const solfege = solfegeMap[keyTag] || `${pitch}`;

      return {
        noteName: `${rawName}${calcOctave}`,
        solfege,
        midiNote,
      };
    };
  }, [baseKeySemitone]);

  // Generate keys for a single octave
  const generateOctaveKeys = useCallback((octaveNum: number) => {
    // 7 White keys (1, 2, 3, 4, 5, 6, 7)
    const whiteKeys: KeyDefinition[] = [1, 2, 3, 4, 5, 6, 7].map(p => {
      const pitch = p as PitchNumber;
      const { noteName, solfege } = getNoteDetails(pitch, octaveNum, '');
      return {
        isBlack: false,
        pitch,
        accidental: '',
        octave: octaveNum,
        jianpuLabel: `${pitch}`,
        solfege,
        noteName,
      };
    });

    const blackKeys: KeyDefinition[] = [
      {
        pitch: 1 as PitchNumber,
        accidental: '#' as const,
        leftPercent: 9.7,
        jianpuLabel: '♯1',
        accidentalLabel: '♭2',
      },
      {
        pitch: 2 as PitchNumber,
        accidental: '#' as const,
        leftPercent: 24.0,
        jianpuLabel: '♯2',
        accidentalLabel: '♭3',
      },
      {
        pitch: 4 as PitchNumber,
        accidental: '#' as const,
        leftPercent: 52.5,
        jianpuLabel: '♯4',
        accidentalLabel: '♭5',
      },
      {
        pitch: 5 as PitchNumber,
        accidental: '#' as const,
        leftPercent: 66.8,
        jianpuLabel: '♯5',
        accidentalLabel: '♭6',
      },
      {
        pitch: 6 as PitchNumber,
        accidental: '#' as const,
        leftPercent: 81.1,
        jianpuLabel: '♯6',
        accidentalLabel: '♭7',
      },
    ].map(bk => {
      const { noteName, solfege } = getNoteDetails(bk.pitch, octaveNum, bk.accidental);
      return {
        isBlack: true,
        pitch: bk.pitch,
        accidental: bk.accidental,
        octave: octaveNum,
        jianpuLabel: bk.jianpuLabel,
        accidentalLabel: bk.accidentalLabel,
        solfege,
        noteName,
        leftPercent: bk.leftPercent,
      };
    });

    return { whiteKeys, blackKeys, octaveNum };
  }, [getNoteDetails]);

  // Determine active octaves to show
  const activeOctaves = useMemo(() => {
    switch (octaveView) {
      case 'mid':
        return [0];
      case 'low_mid':
        return [-1, 0];
      case 'mid_high':
        return [0, 1];
      case 'all':
      default:
        return [-1, 0, 1];
    }
  }, [octaveView]);

  const octavesData = useMemo(() => {
    return activeOctaves.map(oct => generateOctaveKeys(oct));
  }, [activeOctaves, generateOctaveKeys]);

  // Check if a key is currently selected
  const isKeyActive = (keyDef: KeyDefinition) => {
    if (!currentNote) return false;
    if (currentNote.pitch === 'empty' || currentNote.pitch === 0) return false;

    const curPitch = currentNote.pitch;
    const curOct = currentNote.octave ?? 0;
    const curAcc = currentNote.accidental || '';

    // Direct match
    if (curPitch === keyDef.pitch && curOct === keyDef.octave && curAcc === keyDef.accidental) {
      return true;
    }

    // Enharmonic equivalent check
    if (keyDef.isBlack && curOct === keyDef.octave) {
      if (keyDef.pitch === 1 && keyDef.accidental === '#' && curPitch === 2 && curAcc === 'b') return true;
      if (keyDef.pitch === 2 && keyDef.accidental === '#' && curPitch === 3 && curAcc === 'b') return true;
      if (keyDef.pitch === 4 && keyDef.accidental === '#' && curPitch === 5 && curAcc === 'b') return true;
      if (keyDef.pitch === 5 && keyDef.accidental === '#' && curPitch === 6 && curAcc === 'b') return true;
      if (keyDef.pitch === 6 && keyDef.accidental === '#' && curPitch === 7 && curAcc === 'b') return true;
    }

    return false;
  };

  // Handle key press
  const handleKeyClick = (keyDef: KeyDefinition) => {
    onSelectPitch(keyDef.pitch, keyDef.octave, keyDef.accidental);

    // Audio preview
    const tempNote: JianpuNote = {
      id: 'preview',
      pitch: keyDef.pitch,
      octave: keyDef.octave,
      accidental: keyDef.accidental,
      duration: currentNote?.duration || 1,
      lyric: {},
    };
    audioEngine.previewNote(keySignature, tempNote);
  };

  return (
    <div
      id="piano-keyboard-container"
      className={`flex flex-col gap-2 p-3 bg-zinc-900 text-zinc-100 rounded-2xl border border-zinc-700/80 shadow-xl select-none ${className}`}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <Music className="w-3.5 h-3.5" />
            <span>鋼琴鍵盤 (Piano Roll)</span>
          </div>

          <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-200 font-mono text-xs border border-zinc-700">
            調號: <strong className="text-amber-400 font-bold">1 = {keySignature}</strong>
          </span>
        </div>

        {/* View Mode & Octave Selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Label mode toggle */}
          <div className="flex items-center bg-zinc-800/90 p-0.5 rounded-xl border border-zinc-700 text-[11px]">
            <button
              type="button"
              onClick={() => setLabelMode('both')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all min-h-[30px] cursor-pointer ${
                labelMode === 'both'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              簡譜+音名
            </button>
            <button
              type="button"
              onClick={() => setLabelMode('jianpu')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all min-h-[30px] cursor-pointer ${
                labelMode === 'jianpu'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              純簡譜 1-7
            </button>
            <button
              type="button"
              onClick={() => setLabelMode('note')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all min-h-[30px] cursor-pointer ${
                labelMode === 'note'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              音名 (C D E)
            </button>
          </div>

          {/* Octave Range Tabs */}
          <div className="flex items-center bg-zinc-800/90 p-0.5 rounded-xl border border-zinc-700 text-[11px]">
            <button
              type="button"
              onClick={() => setOctaveView('low_mid')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all min-h-[30px] cursor-pointer ${
                octaveView === 'low_mid'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              低音+中音
            </button>
            <button
              type="button"
              onClick={() => setOctaveView('mid_high')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all min-h-[30px] cursor-pointer ${
                octaveView === 'mid_high'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              中音+高音
            </button>
            <button
              type="button"
              onClick={() => setOctaveView('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all min-h-[30px] cursor-pointer ${
                octaveView === 'all'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              三八度全覽
            </button>
            <button
              type="button"
              onClick={() => setOctaveView('mid')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all min-h-[30px] cursor-pointer ${
                octaveView === 'mid'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              單中音組
            </button>
          </div>
        </div>
      </div>

      {/* Main Piano Bed Area */}
      <div className="flex items-stretch gap-2 w-full overflow-x-auto pb-1 pt-1 select-none">
        {/* Special Auxiliary Keys: Rest 0 & Blank ␣ */}
        <div className="flex flex-col gap-2 shrink-0 justify-between w-14 sm:w-16">
          <button
            id="piano-key-rest"
            type="button"
            onClick={() => {
              onSelectPitch(0, 0, '');
            }}
            className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl border transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[48px] ${
              currentNote?.pitch === 0
                ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-md ring-2 ring-amber-400'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 shadow-xs'
            }`}
            title="休止符 (Rest 0)"
          >
            <span className="font-mono text-lg font-black">0</span>
            <span className="text-[10px] font-sans font-semibold">休止符</span>
          </button>

          <button
            id="piano-key-empty"
            type="button"
            onClick={() => {
              onSelectPitch('empty', 0, '');
            }}
            className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl border border-dashed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[48px] ${
              currentNote?.pitch === 'empty'
                ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-md ring-2 ring-amber-400'
                : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-600 shadow-xs'
            }`}
            title="空白音符 / 標點符號留白 (Empty)"
          >
            <span className="font-mono text-sm font-bold">␣ 空</span>
            <span className="text-[10px] font-sans">標點/留白</span>
          </button>
        </div>

        {/* Realistic Piano Keyboard Bed */}
        <div
          id="piano-keys-bed"
          className="flex-1 flex items-stretch bg-zinc-950 p-1.5 rounded-xl border border-zinc-800 shadow-inner relative min-w-[340px]"
        >
          {octavesData.map((octData, octIdx) => {
            const octLabel =
              octData.octaveNum === -1
                ? '低音組 (-1)'
                : octData.octaveNum === 1
                ? '高音組 (+1)'
                : '中音組 (0)';

            return (
              <div
                key={`piano-oct-${octData.octaveNum}`}
                className="flex-1 relative flex flex-col min-w-[170px]"
              >
                {/* Octave Badge */}
                <div className="absolute top-1 left-2 z-20 pointer-events-none">
                  <span className="text-[9px] font-bold font-mono tracking-tight px-1.5 py-0.2 rounded bg-zinc-900/90 text-zinc-400 border border-zinc-700/60 backdrop-blur-xs">
                    {octLabel}
                  </span>
                </div>

                {/* Octave Container: White Keys Row + Overlayed Black Keys */}
                <div className="relative flex w-full h-24 sm:h-28">
                  {/* WHITE KEYS */}
                  {octData.whiteKeys.map((wKey, wIdx) => {
                    const active = isKeyActive(wKey);
                    const isFirstInOctave = wIdx === 0;
                    const isLastInOctave = wIdx === octData.whiteKeys.length - 1;

                    return (
                      <button
                        key={`w-${octData.octaveNum}-${wKey.pitch}`}
                        id={`piano-white-key-${octData.octaveNum}-${wKey.pitch}`}
                        type="button"
                        onClick={() => handleKeyClick(wKey)}
                        className={`group relative flex-1 flex flex-col items-center justify-end pb-2 pt-6 transition-all border-r last:border-r-0 cursor-pointer active:translate-y-0.5 active:shadow-none touch-manipulation ${
                          active
                            ? '!bg-amber-400 !border-amber-500 !text-zinc-950 ring-2 ring-amber-500 z-10 shadow-lg font-black'
                            : 'bg-linear-to-b from-zinc-100 via-white to-zinc-200 hover:from-amber-50 hover:to-amber-100 text-zinc-900 border-zinc-300 dark:border-zinc-400 shadow-[0_4px_3px_rgba(0,0,0,0.12)]'
                        } ${isFirstInOctave && octIdx === 0 ? 'rounded-bl-lg' : ''} ${
                          isLastInOctave && octIdx === octavesData.length - 1 ? 'rounded-br-lg' : ''
                        } rounded-b-md border-b-4 ${
                          active ? 'border-b-amber-600' : 'border-b-zinc-400'
                        }`}
                        title={`音高: ${wKey.jianpuLabel} (${wKey.noteName} - ${wKey.solfege})`}
                      >
                        {/* Active Dot Indicator */}
                        {active && (
                          <div className="absolute top-2 w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                        )}

                        {/* Top Jianpu Octave Dot */}
                        {wKey.octave > 0 && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full mb-0.5 ${
                              active ? 'bg-zinc-950' : 'bg-zinc-900'
                            }`}
                          />
                        )}

                        {/* Jianpu Pitch Number */}
                        {(labelMode === 'both' || labelMode === 'jianpu') && (
                          <span
                            className={`font-mono text-base sm:text-lg font-black leading-none ${
                              active ? 'text-zinc-950 scale-110' : 'text-zinc-900'
                            }`}
                          >
                            {wKey.jianpuLabel}
                          </span>
                        )}

                        {/* Bottom Jianpu Octave Dot */}
                        {wKey.octave < 0 && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                              active ? 'bg-zinc-950' : 'bg-zinc-900'
                            }`}
                          />
                        )}

                        {/* Note Name & Solfege Subtitle */}
                        {(labelMode === 'both' || labelMode === 'note') && (
                          <span
                            className={`text-[9px] sm:text-[10px] font-semibold mt-0.5 leading-tight ${
                              active ? 'text-zinc-900 font-bold' : 'text-zinc-600'
                            }`}
                          >
                            {wKey.noteName}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* BLACK KEYS (OVERLAYED WITH EXACT PIANO SPACING) */}
                  {octData.blackKeys.map((bKey) => {
                    const active = isKeyActive(bKey);

                    return (
                      <button
                        key={`b-${octData.octaveNum}-${bKey.pitch}-${bKey.accidental}`}
                        id={`piano-black-key-${octData.octaveNum}-${bKey.pitch}`}
                        type="button"
                        onClick={() => handleKeyClick(bKey)}
                        style={{
                          left: `${bKey.leftPercent}%`,
                          width: '9.2%',
                        }}
                        className={`absolute top-0 h-14 sm:h-16 z-20 flex flex-col items-center justify-end pb-1.5 rounded-b-sm border transition-all cursor-pointer shadow-md active:translate-y-0.5 touch-manipulation ${
                          active
                            ? '!bg-amber-400 !border-amber-500 !text-zinc-950 ring-2 ring-amber-400 font-black shadow-lg border-b-4 border-b-amber-600'
                            : 'bg-linear-to-b from-zinc-800 via-zinc-900 to-black hover:from-zinc-700 hover:to-zinc-900 text-zinc-100 border-zinc-950 border-b-4 border-b-black shadow-[0_4px_6px_rgba(0,0,0,0.6)]'
                        }`}
                        title={`黑鍵音高: ${bKey.jianpuLabel} / ${bKey.accidentalLabel} (${bKey.noteName} - ${bKey.solfege})`}
                      >
                        {/* Top Active Indicator */}
                        {active && (
                          <div className="absolute top-1.5 w-1.5 h-1.5 rounded-full bg-zinc-950 animate-pulse" />
                        )}

                        {/* Octave Top Dot */}
                        {bKey.octave > 0 && (
                          <span
                            className={`w-1 h-1 rounded-full mb-0.5 ${
                              active ? 'bg-zinc-950' : 'bg-amber-400'
                            }`}
                          />
                        )}

                        {/* Jianpu Accidental Pitch */}
                        {(labelMode === 'both' || labelMode === 'jianpu') && (
                          <span
                            className={`font-mono text-[10px] sm:text-xs font-black tracking-tighter leading-none ${
                              active ? 'text-zinc-950' : 'text-amber-300'
                            }`}
                          >
                            {bKey.jianpuLabel}
                          </span>
                        )}

                        {/* Octave Bottom Dot */}
                        {bKey.octave < 0 && (
                          <span
                            className={`w-1 h-1 rounded-full mt-0.5 ${
                              active ? 'bg-zinc-950' : 'bg-amber-400'
                            }`}
                          />
                        )}

                        {/* Note Name */}
                        {(labelMode === 'both' || labelMode === 'note') && (
                          <span
                            className={`text-[8px] font-mono leading-none mt-0.5 ${
                              active ? 'text-zinc-900 font-bold' : 'text-zinc-400'
                            }`}
                          >
                            {bKey.noteName.replace(/([0-9])/, '')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom helper tip */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 px-1 border-t border-zinc-800/80">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>
            選取音符:{' '}
            {currentNote ? (
              <span className="text-amber-300 font-bold font-mono">
                {currentNote.pitch === 0
                  ? '0 (休止符)'
                  : currentNote.pitch === 'empty'
                  ? '␣ (空白/標點)'
                  : `${currentNote.accidental || ''}${currentNote.pitch}${
                      currentNote.octave > 0
                        ? ` (高音 ${currentNote.octave}點)`
                        : currentNote.octave < 0
                        ? ` (低音 ${Math.abs(currentNote.octave)}點)`
                        : ' (中音)'
                    }`}
              </span>
            ) : (
              '未選取音符'
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-zinc-400 hidden sm:flex">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-white border border-zinc-400" />
            <span>白鍵 (自然音 1-7)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-black border border-zinc-600" />
            <span>黑鍵 (變化音 ♯/♭)</span>
          </span>
        </div>
      </div>
    </div>
  );
});

PianoKeyboard.displayName = 'PianoKeyboard';
