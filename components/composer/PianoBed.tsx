'use client';

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { KeySignature, PitchNumber } from '@/types/song';
import { midiToNumberedPitch } from '@/lib/pitch/scoreQuantizer';
import { Sparkles, Volume2, ChevronLeft, ChevronRight, Compass } from 'lucide-react';

export type OctaveBedView =
  | '88keys'
  | '61keys'
  | '49keys'
  | 'all'
  | 'mid_high'
  | 'low_mid';

export interface KeyDefinition {
  isBlack: boolean;
  midi: number;
  pitch: PitchNumber;
  accidental: '' | '#' | 'b';
  octave: number; // Scale degree octave relative to active key
  numberedNotationLabel: string;
  solfege: string;
  noteName: string;
  isMiddleC: boolean;
  isC: boolean;
  qwertyKey?: string;
  leftPercent?: number;
  widthPercent?: number;
}

export interface PianoBedProps {
  activeKey: KeySignature;
  accidentalPreference?: 'auto' | 'sharp' | 'flat';
  octaveBedView: OctaveBedView;
  onOctaveBedViewChange?: (view: OctaveBedView) => void;
  activeMidiSet: Set<number>;
  onNoteDown?: (midi: number, sourceId?: string) => void;
  onNoteUp?: (midi: number, sourceId?: string) => void;
  isRecording?: boolean;
  showQwertyHints?: boolean;
  disabled?: boolean;
  className?: string;
  octaveShiftVal?: number;
  statusTitle?: string;
  statusSubtitle?: string;
}

const CHROMATIC_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SOLFEGE_MAP: Record<string, string> = {
  '1': 'Do',
  '#1': 'Di',
  'b1': 'Ti',
  'b2': 'Ra',
  '2': 'Re',
  '#2': 'Ri',
  'b3': 'Me',
  '3': 'Mi',
  '#3': 'Fa',
  'b4': 'Mi',
  '4': 'Fa',
  '#4': 'Fi',
  'b5': 'Se',
  '5': 'Sol',
  '#5': 'Si',
  'b6': 'Le',
  '6': 'La',
  '#6': 'Li',
  'b7': 'Te',
  '7': 'Ti',
};

export const PianoBed: React.FC<PianoBedProps> = ({
  activeKey,
  accidentalPreference = 'auto',
  octaveBedView,
  onOctaveBedViewChange,
  activeMidiSet,
  onNoteDown,
  onNoteUp,
  isRecording = false,
  showQwertyHints = true,
  disabled = false,
  className = '',
  octaveShiftVal = 0,
  statusTitle,
  statusSubtitle,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const middleCElementRef = useRef<HTMLDivElement>(null);

  // Active glide note tracking for glissando / slide
  const isPointerDownRef = useRef<boolean>(false);
  const activeGlideMidiRef = useRef<number | null>(null);

  // Closure-safe callbacks
  const onNoteDownRef = useRef(onNoteDown);
  const onNoteUpRef = useRef(onNoteUp);
  useEffect(() => {
    onNoteDownRef.current = onNoteDown;
    onNoteUpRef.current = onNoteUp;
  }, [onNoteDown, onNoteUp]);

  // Determine MIDI range based on selected octave/range view
  const { startMidi, endMidi, isScrollableMode, defaultKeyWidthPx } = useMemo(() => {
    switch (octaveBedView) {
      case '88keys':
        // Full 88 keys: A0 (MIDI 21) to C8 (MIDI 108)
        return { startMidi: 21, endMidi: 108, isScrollableMode: true, defaultKeyWidthPx: 32 };
      case '61keys':
        // Standard 61-key keyboard: C2 (MIDI 36) to C7 (MIDI 96)
        return { startMidi: 36, endMidi: 96, isScrollableMode: true, defaultKeyWidthPx: 34 };
      case '49keys':
        // 49-key keyboard: C2 (MIDI 36) to C6 (MIDI 84)
        return { startMidi: 36, endMidi: 84, isScrollableMode: true, defaultKeyWidthPx: 36 };
      case 'all':
        // 3 octaves: C3 (MIDI 48) to C6 (MIDI 84)
        return { startMidi: 48, endMidi: 84, isScrollableMode: false, defaultKeyWidthPx: 0 };
      case 'low_mid':
        // 2 octaves: C3 (MIDI 48) to C5 (MIDI 72)
        return { startMidi: 48, endMidi: 72, isScrollableMode: false, defaultKeyWidthPx: 0 };
      case 'mid_high':
      default:
        // 2 octaves: C4 (MIDI 60) to C6 (MIDI 84)
        return { startMidi: 60, endMidi: 84, isScrollableMode: false, defaultKeyWidthPx: 0 };
    }
  }, [octaveBedView]);

  // Generate piano keys (white keys and black keys)
  const { whiteKeys, blackKeys, totalWhiteKeys } = useMemo(() => {
    const wKeys: KeyDefinition[] = [];
    const bKeys: KeyDefinition[] = [];

    // Helper to check if MIDI note is a black key
    const isMidiBlack = (m: number) => {
      const semitone = m % 12;
      return semitone === 1 || semitone === 3 || semitone === 6 || semitone === 8 || semitone === 10;
    };

    // First pass: collect all white keys
    for (let m = startMidi; m <= endMidi; m++) {
      if (!isMidiBlack(m)) {
        const noteIndex = m % 12;
        const noteOctave = Math.floor(m / 12) - 1;
        const noteName = `${CHROMATIC_NOTE_NAMES[noteIndex]}${noteOctave}`;
        const isMiddleC = m === 60;
        const isC = noteIndex === 0;

        const numbered = midiToNumberedPitch(m, activeKey, { accidentalPreference });
        const accPrefix = numbered.accidental === '#' ? '#' : numbered.accidental === 'b' ? 'b' : '';
        const accDisplay = numbered.accidental === '#' ? '♯' : numbered.accidental === 'b' ? '♭' : '';
        const solfegeKey = `${accPrefix}${numbered.pitch}`;
        const solfege = SOLFEGE_MAP[solfegeKey] || SOLFEGE_MAP[`${numbered.pitch}`] || 'Do';
        const label = `${accDisplay}${numbered.pitch}`;

        // QWERTY label for C4-B4 and C5-F5
        let qwertyKey = '';
        if (m >= 60 && m <= 71) {
          const qwertyMap: Record<number, string> = {
            60: 'A',
            62: 'S',
            64: 'D',
            65: 'F',
            67: 'G',
            69: 'H',
            71: 'J',
          };
          qwertyKey = qwertyMap[m] || '';
        } else if (m >= 72 && m <= 77) {
          const qwertyMap: Record<number, string> = {
            72: 'K',
            74: 'L',
            76: ';',
            77: "'",
          };
          qwertyKey = qwertyMap[m] || '';
        }

        wKeys.push({
          isBlack: false,
          midi: m,
          pitch: numbered.pitch,
          accidental: numbered.accidental,
          octave: numbered.octave,
          numberedNotationLabel: label,
          solfege,
          noteName,
          isMiddleC,
          isC,
          qwertyKey,
        });
      }
    }

    const totalWhite = wKeys.length;

    // Second pass: position black keys between white keys
    for (let m = startMidi; m <= endMidi; m++) {
      if (isMidiBlack(m)) {
        const noteIndex = m % 12;
        const noteOctave = Math.floor(m / 12) - 1;
        const noteName = `${CHROMATIC_NOTE_NAMES[noteIndex]}${noteOctave}`;

        const numbered = midiToNumberedPitch(m, activeKey, { accidentalPreference });
        const accPrefix = numbered.accidental === '#' ? '#' : numbered.accidental === 'b' ? 'b' : '';
        const accDisplay = numbered.accidental === '#' ? '♯' : numbered.accidental === 'b' ? '♭' : '';
        const solfegeKey = `${accPrefix}${numbered.pitch}`;
        const solfege = SOLFEGE_MAP[solfegeKey] || SOLFEGE_MAP[`${numbered.pitch}`] || 'Di';
        const label = `${accDisplay}${numbered.pitch}`;

        // Find white key immediately to the left
        const prevWhiteMidi = m - 1;
        const prevWhiteIndex = wKeys.findIndex(wk => wk.midi === prevWhiteMidi);

        if (prevWhiteIndex >= 0) {
          // Standard acoustic piano key offsets
          let offsetRatio = 0.62;
          if (noteIndex === 1) offsetRatio = 0.6; // C#
          else if (noteIndex === 3) offsetRatio = 0.68; // D#
          else if (noteIndex === 6) offsetRatio = 0.58; // F#
          else if (noteIndex === 8) offsetRatio = 0.65; // G#
          else if (noteIndex === 10) offsetRatio = 0.72; // A#

          const leftFraction = prevWhiteIndex + offsetRatio;
          const leftPercent = (leftFraction / totalWhite) * 100;
          const widthPercent = (0.64 / totalWhite) * 100;

          // QWERTY hints for black keys
          let qwertyKey = '';
          if (m === 61) qwertyKey = 'W';
          else if (m === 63) qwertyKey = 'E';
          else if (m === 66) qwertyKey = 'T';
          else if (m === 68) qwertyKey = 'Y';
          else if (m === 70) qwertyKey = 'U';
          else if (m === 73) qwertyKey = 'O';
          else if (m === 75) qwertyKey = 'P';

          bKeys.push({
            isBlack: true,
            midi: m,
            pitch: numbered.pitch,
            accidental: numbered.accidental,
            octave: numbered.octave,
            numberedNotationLabel: label,
            solfege,
            noteName,
            isMiddleC: false,
            isC: false,
            qwertyKey,
            leftPercent,
            widthPercent,
          });
        }
      }
    }

    return { whiteKeys: wKeys, blackKeys: bKeys, totalWhiteKeys: totalWhite };
  }, [startMidi, endMidi, activeKey, accidentalPreference]);

  // Center on Middle C (C4 / MIDI 60) smoothly
  const scrollToMiddleC = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const middleCEl = container.querySelector('[data-middle-c="true"]') as HTMLElement | null;

    if (middleCEl) {
      const containerWidth = container.clientWidth;
      const keyLeft = middleCEl.offsetLeft;
      const keyWidth = middleCEl.offsetWidth;
      const targetScroll = keyLeft - containerWidth / 2 + keyWidth / 2;
      container.scrollTo({ left: Math.max(0, targetScroll), behavior });
    }
  }, []);

  // Step scroll by octave (7 white keys)
  const scrollOctave = useCallback((direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = (container.clientWidth * 0.45) * (direction === 'left' ? -1 : 1);
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }, []);

  // Auto-scroll to Middle C when switching to scrollable 88-key or 61-key mode
  useEffect(() => {
    if (isScrollableMode) {
      const timer = setTimeout(() => {
        scrollToMiddleC('auto');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isScrollableMode, octaveBedView, scrollToMiddleC]);

  // Helper to release the active glide note cleanly
  const releaseActiveGlideNote = useCallback(() => {
    if (activeGlideMidiRef.current !== null) {
      const prevMidi = activeGlideMidiRef.current;
      activeGlideMidiRef.current = null;
      onNoteUpRef.current?.(prevMidi, `touch-${prevMidi}`);
    }
  }, []);

  // Helper to trigger note on during glide
  const playGlideNote = useCallback(
    (midi: number) => {
      if (disabled) return;
      if (activeGlideMidiRef.current === midi) return;

      if (activeGlideMidiRef.current !== null) {
        const prevMidi = activeGlideMidiRef.current;
        onNoteUpRef.current?.(prevMidi, `touch-${prevMidi}`);
      }

      activeGlideMidiRef.current = midi;
      onNoteDownRef.current?.(midi, `touch-${midi}`);
    },
    [disabled]
  );

  // Global safety handlers: release notes when pointer lifts or leaves anywhere in browser
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isPointerDownRef.current || activeGlideMidiRef.current !== null) {
        releaseActiveGlideNote();
        isPointerDownRef.current = false;
      }
    };

    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!isPointerDownRef.current) return;

      // Find element under pointer
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el) {
        releaseActiveGlideNote();
        return;
      }

      const keyEl = el.closest('[data-midi]') as HTMLElement | null;
      if (keyEl) {
        const midiStr = keyEl.getAttribute('data-midi');
        if (midiStr) {
          const midi = parseInt(midiStr, 10);
          if (!isNaN(midi)) {
            playGlideNote(midi);
            return;
          }
        }
      }

      // Pointer moved off the piano keys
      releaseActiveGlideNote();
    };

    const handleBlurOrVisibility = () => {
      releaseActiveGlideNote();
      isPointerDownRef.current = false;
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('touchend', handleGlobalPointerUp);
    window.addEventListener('touchcancel', handleGlobalPointerUp);
    window.addEventListener('mouseup', handleGlobalPointerUp);
    window.addEventListener('blur', handleBlurOrVisibility);
    document.addEventListener('visibilitychange', handleBlurOrVisibility);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('touchend', handleGlobalPointerUp);
      window.removeEventListener('touchcancel', handleGlobalPointerUp);
      window.removeEventListener('mouseup', handleGlobalPointerUp);
      window.removeEventListener('blur', handleBlurOrVisibility);
      document.removeEventListener('visibilitychange', handleBlurOrVisibility);
    };
  }, [playGlideNote, releaseActiveGlideNote]);

  // Pointer Down on piano surface or key
  const handleSurfacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    isPointerDownRef.current = true;

    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const keyEl = el?.closest('[data-midi]') as HTMLElement | null;
    if (keyEl) {
      const midiStr = keyEl.getAttribute('data-midi');
      if (midiStr) {
        const midi = parseInt(midiStr, 10);
        if (!isNaN(midi)) {
          playGlideNote(midi);
        }
      }
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Mode Status & Octave Controls Bar */}
      <div className="flex items-center justify-between px-1 flex-wrap gap-2 text-xs min-h-[34px]">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
          {statusTitle ? (
            <>
              {isRecording ? (
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className="font-extrabold text-[11px]">{statusTitle}</span>
              {statusSubtitle && <span className="text-[11px] text-zinc-300">{statusSubtitle}</span>}
            </>
          ) : isRecording ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              <span className="font-extrabold text-[11px]">琴鍵即時收音中：</span>
              <span className="text-[11px] text-zinc-300">按住保持時值，鬆開自動量化</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-extrabold text-[11px]">琴鍵試音練習：</span>
              <span className="text-[11px] text-zinc-300">支援滑音(Glissando)與點擊，鬆開即停</span>
            </>
          )}
        </div>

        {/* Range Presets & Navigation Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {onOctaveBedViewChange && (
            <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
              <span className="text-zinc-500 text-[10px] font-bold px-1 hidden sm:inline">琴鍵：</span>
              {(
                [
                  { id: '88keys', label: '88鍵全鋼琴' },
                  { id: '61keys', label: '61鍵' },
                  { id: 'all', label: '3八度' },
                  { id: 'mid_high', label: '中高音' },
                  { id: 'low_mid', label: '低中音' },
                ] as const
              ).map(viewOption => (
                <button
                  key={viewOption.id}
                  type="button"
                  onClick={() => onOctaveBedViewChange(viewOption.id as OctaveBedView)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                    octaveBedView === viewOption.id
                      ? 'bg-amber-500 text-zinc-950 border-amber-400 font-extrabold shadow-xs'
                      : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 border-zinc-700/60'
                  }`}
                >
                  {viewOption.label}
                </button>
              ))}
            </div>
          )}

          {/* Quick Navigator for scrollable modes */}
          {isScrollableMode && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollOctave('left')}
                title="向左滾動低音區"
                className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollToMiddleC('smooth')}
                title="快速對齊中央 C (C4)"
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] font-bold text-amber-300 transition-colors cursor-pointer"
              >
                <Compass className="w-3 h-3 text-amber-400" />
                中央 C
              </button>
              <button
                type="button"
                onClick={() => scrollOctave('right')}
                title="向右滾動高音區"
                className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="text-[11px] text-zinc-400 font-mono hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <span className="font-bold text-amber-400">1 = {activeKey}</span>
            {octaveShiftVal !== 0 && (
              <span className="text-zinc-500">· 移調 {octaveShiftVal > 0 ? `+${octaveShiftVal}` : octaveShiftVal}</span>
            )}
          </div>
        </div>
      </div>

      {/* On-screen Piano Bed Surface */}
      <div
        id="piano-bed-surface"
        ref={scrollContainerRef}
        onPointerDown={handleSurfacePointerDown}
        onContextMenu={e => e.preventDefault()}
        className={`relative select-none touch-none w-full bg-zinc-950 p-2 sm:p-2.5 rounded-2xl border border-zinc-800 shadow-2xl ${
          isScrollableMode ? 'overflow-x-auto scroll-smooth' : 'overflow-hidden'
        }`}
        style={{
          minHeight: '175px',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      >
        {/* Keyboard container */}
        <div
          className="relative flex h-40 sm:h-44 select-none touch-none"
          style={{
            width: isScrollableMode
              ? `max(100%, ${totalWhiteKeys * (defaultKeyWidthPx || 32)}px)`
              : '100%',
          }}
        >
          {/* White Keys */}
          {whiteKeys.map(wk => {
            const isActive = activeMidiSet.has(wk.midi);

            return (
              <div
                key={`wk-${wk.midi}`}
                data-midi={wk.midi}
                data-middle-c={wk.isMiddleC ? 'true' : 'false'}
                ref={wk.isMiddleC ? middleCElementRef : undefined}
                className={`flex-1 flex flex-col justify-end items-center pb-2 border-r border-zinc-300 dark:border-zinc-800 rounded-b-lg cursor-pointer select-none touch-none transition-all duration-75 relative ${
                  isActive
                    ? 'bg-amber-300 dark:bg-amber-400 text-zinc-950 shadow-md transform translate-y-0.5 font-bold'
                    : wk.isMiddleC
                      ? 'bg-amber-50/90 dark:bg-zinc-100 hover:bg-amber-100 text-zinc-900'
                      : 'bg-white hover:bg-zinc-100 text-zinc-800'
                }`}
                style={{
                  minWidth: isScrollableMode ? `${defaultKeyWidthPx || 32}px` : undefined,
                }}
              >
                {/* Middle C marker or Octave Note Name on C keys */}
                {wk.isMiddleC ? (
                  <div className="absolute top-1.5 px-1 py-0.2 rounded bg-amber-500/90 text-zinc-950 text-[7px] font-black tracking-tight uppercase shadow-xs">
                    C4 (中央)
                  </div>
                ) : wk.isC ? (
                  <div className="absolute top-1.5 text-[8px] font-bold text-zinc-400">
                    {wk.noteName}
                  </div>
                ) : null}

                {/* Numbered Notation Degree */}
                <div className="flex flex-col items-center">
                  {wk.octave > 0 && (
                    <span className="text-[8px] leading-none -mb-1 text-amber-600 dark:text-amber-500 font-black">
                      {wk.octave === 1 ? '●' : '●●'}
                    </span>
                  )}
                  <span className="text-sm font-black font-mono tracking-tighter">
                    {wk.numberedNotationLabel}
                  </span>
                  {wk.octave < 0 && (
                    <span className="text-[8px] leading-none -mt-1 text-amber-600 dark:text-amber-500 font-black">
                      {wk.octave === -1 ? '●' : '●●'}
                    </span>
                  )}
                </div>

                {/* Solfege Name */}
                <span className="text-[9px] font-sans text-zinc-500 font-medium leading-tight">
                  {wk.solfege}
                </span>

                {/* QWERTY Key Label */}
                {showQwertyHints && wk.qwertyKey && (
                  <span className="text-[8px] font-mono font-extrabold px-1 rounded bg-zinc-200 text-zinc-700 mt-0.5 shadow-2xs">
                    {wk.qwertyKey}
                  </span>
                )}
              </div>
            );
          })}

          {/* Black Keys */}
          {blackKeys.map(bk => {
            const isActive = activeMidiSet.has(bk.midi);

            return (
              <div
                key={`bk-${bk.midi}`}
                data-midi={bk.midi}
                style={{
                  left: `${bk.leftPercent}%`,
                  width: `${bk.widthPercent}%`,
                  height: '62%',
                }}
                className={`absolute top-0 z-10 flex flex-col justify-end items-center pb-1.5 rounded-b-md cursor-pointer select-none touch-none transition-all duration-75 shadow-lg ${
                  isActive
                    ? 'bg-amber-400 text-zinc-950 shadow-amber-500/50 transform translate-y-0.5'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-x border-b border-black'
                }`}
              >
                {/* Numbered Notation Degree */}
                <div className="flex flex-col items-center">
                  {bk.octave > 0 && (
                    <span className="text-[7px] leading-none -mb-0.5 text-amber-400 font-black">
                      {bk.octave === 1 ? '●' : '●●'}
                    </span>
                  )}
                  <span className="text-[10px] font-black font-mono tracking-tighter leading-tight">
                    {bk.numberedNotationLabel}
                  </span>
                  {bk.octave < 0 && (
                    <span className="text-[7px] leading-none -mt-0.5 text-amber-400 font-black">
                      {bk.octave === -1 ? '●' : '●●'}
                    </span>
                  )}
                </div>

                {/* Solfege Name */}
                <span className="text-[7.5px] font-sans text-zinc-400 font-semibold leading-none mt-0.5">
                  {bk.solfege}
                </span>

                {/* QWERTY Key Hint */}
                {showQwertyHints && bk.qwertyKey && (
                  <span className="text-[7px] font-mono font-bold px-0.5 rounded bg-zinc-800 text-amber-400 mt-0.5 shadow-2xs">
                    {bk.qwertyKey}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
