'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  KeySignature,
  Measure,
  NumberedNotationNote,
  PitchNumber,
  Song,
  TimeSignature,
  InstrumentType,
} from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import {
  KeyEventEngine,
  resolveQwertyKey,
  QwertyMappingMode,
  ActiveNoteState,
} from '@/lib/keyboard/keyEventEngine';
import { useWebMidi } from '@/lib/keyboard/webMidi';
import {
  QuantizeGrid,
  midiToNumberedPitch,
  type TranscriptionResult,
} from '@/lib/pitch/scoreQuantizer';
import { CHROMATIC_KEYS, STANDARD_TIME_SIGNATURES } from '@/lib/taigiUtils';
import { NumberedNotationNoteComponent } from '@/components/NumberedNotationNoteComponent';
import {
  Keyboard,
  Square,
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Music2,
  Activity,
  Radio,
  Clock,
  Layers,
  HelpCircle,
  Delete,
  Sparkles,
} from 'lucide-react';

export type KeyboardModalStep = 'SETUP' | 'COUNTING_IN' | 'RECORDING' | 'REVIEW';
export type InsertionMode = 'cursor' | 'append' | 'replace';

export interface KeyboardToScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
  selectedMeasureIndex?: number | null;
  audioEngine: AudioEngine;
  onCommitTranscription: (measures: Measure[], mode: InsertionMode) => void;
}

// 12 chromatic note names
const CHROMATIC_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface KeyDefinition {
  isBlack: boolean;
  midi: number;
  pitch: PitchNumber;
  accidental: '' | '#' | 'b';
  octave: number;
  numberedNotationLabel: string;
  solfege: string;
  noteName: string;
  qwertyKey?: string;
  leftPercent?: number; // for black keys positioning
}

export const KeyboardToScoreModal: React.FC<KeyboardToScoreModalProps> = ({
  isOpen,
  onClose,
  song,
  selectedMeasureIndex = 0,
  audioEngine,
  onCommitTranscription,
}) => {
  // Modal flow state
  const [step, setStep] = useState<KeyboardModalStep>('SETUP');
  const [activeKey, setActiveKey] = useState<KeySignature>(song.key || 'C');
  const [activeBpm, setActiveBpm] = useState<number>(song.bpm || 80);
  const [activeTimeSignature, setActiveTimeSignature] = useState<TimeSignature>(
    song.timeSignature || '4/4'
  );
  const [quantizeGrid, setQuantizeGrid] = useState<QuantizeGrid>('eighth');
  const [enableCountIn, setEnableCountIn] = useState<boolean>(true);
  const [audibleClickDuringRecording, setAudibleClickDuringRecording] = useState<boolean>(true);
  const [octaveShiftVal, setOctaveShiftVal] = useState<number>(0);
  const [accidentalPref, setAccidentalPref] = useState<'auto' | 'sharp' | 'flat'>('auto');
  const [allowTriplets, setAllowTriplets] = useState<boolean>(false);
  const [qwertyMappingMode, setQwertyMappingMode] =
    useState<QwertyMappingMode>('chromatic_piano');
  const [insertionMode, setInsertionMode] = useState<InsertionMode>('cursor');
  const [synthInstrument, setSynthInstrument] = useState<InstrumentType>('piano');

  // Octave display view for piano bed: 'low_mid' (-1, 0), 'mid_high' (0, 1), 'all' (-1, 0, 1)
  const [octaveBedView, setOctaveBedView] = useState<'low_mid' | 'mid_high' | 'all'>('mid_high');

  // Count-in state
  const [countdownBeat, setCountdownBeat] = useState<number>(4);

  // Metronome Pulse & Recording State
  const [currentBeatInBar, setCurrentBeatInBar] = useState<number>(1);
  const [isBeatPulse, setIsBeatPulse] = useState<boolean>(false);
  const [isDownbeatFlash, setIsDownbeatFlash] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  // Setup preview metronome pulse
  const [setupPreviewBeat, setSetupPreviewBeat] = useState<number>(1);
  const [setupPreviewPulse, setSetupPreviewPulse] = useState<boolean>(false);

  // Active played notes state
  const [activeMidiSet, setActiveMidiSet] = useState<Set<number>>(new Set());
  const [lastPlayedNote, setLastPlayedNote] = useState<{
    pitch: PitchNumber;
    octave: number;
    accidental: '' | '#' | 'b';
    solfege: string;
    midi: number;
  } | null>(null);

  // Transcription output
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);

  // Audio audition state (Review step)
  const [isRawPlaying, setIsRawPlaying] = useState<boolean>(false);
  const [rawPlaybackProgress, setRawPlaybackProgress] = useState<number>(0);
  const [isSynthPlaying, setIsSynthPlaying] = useState<boolean>(false);

  // Refs
  const keyEngineRef = useRef<KeyEventEngine | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const metronomeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audibleClickRef = useRef<boolean>(audibleClickDuringRecording);
  const isPointerDownRef = useRef<boolean>(false);
  const rawPlaybackTimersRef = useRef<number[]>([]);

  useEffect(() => {
    audibleClickRef.current = audibleClickDuringRecording;
  }, [audibleClickDuringRecording]);

  // Web MIDI Hook
  const handleIncomingMidiMessage = useCallback(
    (event: { data: Uint8Array | number[] }) => {
      if (keyEngineRef.current) {
        keyEngineRef.current.handleMidiMessage(event);
      }
    },
    []
  );

  const {
    isSupported: isMidiSupported,
    devices: midiDevices,
    activeDevice: activeMidiDevice,
    isConnected: isMidiConnected,
  } = useWebMidi(handleIncomingMidiMessage, isOpen);

  // Initialize and synchronize KeyEventEngine
  useEffect(() => {
    const engine = new KeyEventEngine(
      {
        keySignature: activeKey,
        timeSignature: activeTimeSignature,
        bpm: activeBpm,
        octaveShift: octaveShiftVal,
        quantizeGrid,
        allowTriplets,
        accidentalPreference: accidentalPref,
        qwertyMappingMode,
        restThresholdMs: 80,
        extendLegatoGaps: true,
      },
      {
        onNoteOn: (note: ActiveNoteState) => {
          setActiveMidiSet(prev => new Set(prev).add(note.midi));
          setLastPlayedNote({
            pitch: note.pitch,
            octave: note.octave,
            accidental: note.accidental,
            solfege:
              note.pitch === 1
                ? 'Do'
                : note.pitch === 2
                  ? 'Re'
                  : note.pitch === 3
                    ? 'Mi'
                    : note.pitch === 4
                      ? 'Fa'
                      : note.pitch === 5
                        ? 'Sol'
                        : note.pitch === 6
                          ? 'La'
                          : note.pitch === 7
                            ? 'Ti'
                            : 'Rest',
            midi: note.midi,
          });

          // Zero-latency real-time preview audio
          const tempNote: NumberedNotationNote = {
            id: `live-key-${note.midi}-${Date.now()}`,
            pitch: note.pitch,
            octave: note.octave,
            accidental: note.accidental,
            duration: 1,
            lyric: {},
          };
          audioEngine.previewNote(activeKey, tempNote);
        },
        onNoteOff: (midi: number) => {
          setActiveMidiSet(prev => {
            const next = new Set(prev);
            next.delete(midi);
            return next;
          });
        },
        onOctaveShiftChange: shift => {
          setOctaveShiftVal(shift);
        },
      }
    );

    keyEngineRef.current = engine;

    return () => {
      if (engine.isRecordingActive()) {
        engine.stopRecording();
      }
    };
  }, [activeKey, activeTimeSignature, activeBpm, octaveShiftVal, quantizeGrid, allowTriplets, accidentalPref, qwertyMappingMode, audioEngine]);

  // Setup step: lightweight visual metronome pulse
  useEffect(() => {
    if (step !== 'SETUP' || !isOpen) return;
    const beats = parseInt(activeTimeSignature.split('/')[0], 10) || 4;
    const intervalMs = (60 / activeBpm) * 1000;
    let b = 1;
    let pulseTimeout: ReturnType<typeof setTimeout> | null = null;
    const timer = setInterval(() => {
      b = (b % beats) + 1;
      setSetupPreviewBeat(b);
      setSetupPreviewPulse(true);
      if (pulseTimeout) clearTimeout(pulseTimeout);
      pulseTimeout = setTimeout(() => setSetupPreviewPulse(false), 140);
    }, intervalMs);

    return () => {
      clearInterval(timer);
      if (pulseTimeout) clearTimeout(pulseTimeout);
    };
  }, [step, isOpen, activeTimeSignature, activeBpm]);

  // Clean up all audio and tickers
  const stopAllPlayback = useCallback(() => {
    audioEngine.stop();
    setIsSynthPlaying(false);
    setIsRawPlaying(false);
    rawPlaybackTimersRef.current.forEach(id => clearTimeout(id));
    rawPlaybackTimersRef.current = [];
  }, [audioEngine]);

  const stopAllPipelines = useCallback(() => {
    stopAllPlayback();

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (metronomeIntervalRef.current) {
      clearInterval(metronomeIntervalRef.current);
      metronomeIntervalRef.current = null;
    }

    if (keyEngineRef.current && keyEngineRef.current.isRecordingActive()) {
      keyEngineRef.current.stopRecording();
    }
    setActiveMidiSet(new Set());
  }, [stopAllPlayback]);

  // Actual recording execution
  const beginActiveRecording = useCallback(() => {
    setStep('RECORDING');
    setRecordingSeconds(0);
    setActiveMidiSet(new Set());
    setLastPlayedNote(null);

    const engine = keyEngineRef.current;
    if (engine) {
      engine.startRecording();
    }

    recordingStartTimeRef.current = performance.now();

    // Elapsed time ticker
    recordingTimerRef.current = setInterval(() => {
      const elapsed = (performance.now() - recordingStartTimeRef.current) / 1000;
      setRecordingSeconds(Math.round(elapsed * 10) / 10);
    }, 100);

    // Metronome ticker during recording
    const beatsPerBar = parseInt(activeTimeSignature.split('/')[0], 10) || 4;
    const intervalMs = (60 / activeBpm) * 1000;
    let b = 1;

    setCurrentBeatInBar(1);
    setIsBeatPulse(true);
    setIsDownbeatFlash(true);
    if (audibleClickRef.current) {
      audioEngine.playMetronomeTick(true);
    }
    setTimeout(() => {
      setIsBeatPulse(false);
      setIsDownbeatFlash(false);
    }, 140);

    metronomeIntervalRef.current = setInterval(() => {
      b = (b % beatsPerBar) + 1;
      setCurrentBeatInBar(b);
      setIsBeatPulse(true);
      const isDown = b === 1;
      setIsDownbeatFlash(isDown);

      if (audibleClickRef.current) {
        audioEngine.playMetronomeTick(isDown);
      }

      setTimeout(() => {
        setIsBeatPulse(false);
        setIsDownbeatFlash(false);
      }, 140);
    }, intervalMs);
  }, [activeTimeSignature, activeBpm, audioEngine]);

  // Handle Count-in and Start Recording
  const startRecordingFlow = useCallback(() => {
    stopAllPipelines();

    const beatsPerBar = parseInt(activeTimeSignature.split('/')[0], 10) || 4;
    const secPerBeat = 60 / activeBpm;

    if (!enableCountIn) {
      beginActiveRecording();
      return;
    }

    setStep('COUNTING_IN');
    setCountdownBeat(beatsPerBar);

    let count = beatsPerBar;
    audioEngine.playMetronomeTick(true);

    const countInTimer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownBeat(count);
        audioEngine.playMetronomeTick(false);
      } else {
        clearInterval(countInTimer);
        beginActiveRecording();
      }
    }, secPerBeat * 1000);
  }, [activeTimeSignature, activeBpm, enableCountIn, stopAllPipelines, audioEngine, beginActiveRecording]);

  // Finish recording and transcribe
  const handleFinishRecording = useCallback(() => {
    stopAllPipelines();

    const engine = keyEngineRef.current;
    if (!engine) return;

    const result = engine.transcribe({
      key: activeKey,
      bpm: activeBpm,
      timeSignature: activeTimeSignature,
      grid: quantizeGrid,
      allowTriplets,
      octaveShift: octaveShiftVal,
      accidentalPreference: accidentalPref,
      autoFillTrailingRests: false,
    });

    setTranscriptionResult(result);
    setStep('REVIEW');
  }, [stopAllPipelines, activeKey, activeBpm, activeTimeSignature, quantizeGrid, allowTriplets, octaveShiftVal, accidentalPref]);

  // Re-transcribe with new options during Review
  const retranscribeCurrent = useCallback(
    (overrides?: {
      grid?: QuantizeGrid;
      octaveShift?: number;
      accidentalPreference?: 'auto' | 'sharp' | 'flat';
      allowTriplets?: boolean;
    }) => {
      const engine = keyEngineRef.current;
      if (!engine) return;

      const newGrid = overrides?.grid ?? quantizeGrid;
      const newOct = overrides?.octaveShift ?? octaveShiftVal;
      const newAcc = overrides?.accidentalPreference ?? accidentalPref;
      const newTriplets = overrides?.allowTriplets ?? allowTriplets;

      const result = engine.transcribe({
        key: activeKey,
        bpm: activeBpm,
        timeSignature: activeTimeSignature,
        grid: newGrid,
        allowTriplets: newTriplets,
        octaveShift: newOct,
        accidentalPreference: newAcc,
        autoFillTrailingRests: false,
      });

      setTranscriptionResult(result);
    },
    [activeKey, activeBpm, activeTimeSignature, quantizeGrid, octaveShiftVal, accidentalPref, allowTriplets]
  );

  // Global Keydown / Keyup listener for computer QWERTY keyboard
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Escape to close or cancel
      if (e.key === 'Escape') {
        stopAllPipelines();
        onClose();
        return;
      }

      if (step === 'SETUP') {
        if (e.code === 'Space') {
          e.preventDefault();
          startRecordingFlow();
          return;
        }
      }

      if (step === 'RECORDING') {
        if (e.code === 'Enter') {
          e.preventDefault();
          handleFinishRecording();
          return;
        }

        if (keyEngineRef.current) {
          keyEngineRef.current.handleKeyDown(e);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (step === 'RECORDING' && keyEngineRef.current) {
        keyEngineRef.current.handleKeyUp(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, step, startRecordingFlow, handleFinishRecording, stopAllPipelines, onClose]);

  // Dual-Track Playback: Track 1 (Raw Performance Timing Playback)
  const handleToggleRawPlay = useCallback(() => {
    if (isRawPlaying) {
      stopAllPlayback();
      return;
    }

    const engine = keyEngineRef.current;
    if (!engine) return;

    const segments = engine.getSegments();
    if (segments.length === 0) return;

    stopAllPlayback();
    setIsRawPlaying(true);
    setRawPlaybackProgress(0);

    const totalDurationMs = segments[segments.length - 1].endTimeMs;
    const startTime = performance.now();

    // Schedule each note preview at exact recorded timestamp
    segments.forEach((seg, idx) => {
      if (seg.midi !== null) {
        const timer = setTimeout(() => {
          const pitchInfo = midiToNumberedPitch(seg.midi!, activeKey, {
            octaveShift: octaveShiftVal,
            accidentalPreference: accidentalPref,
          });
          const note: NumberedNotationNote = {
            id: `raw-play-${idx}`,
            pitch: pitchInfo.pitch,
            octave: pitchInfo.octave,
            accidental: pitchInfo.accidental,
            duration: Math.max(0.25, (seg.durationMs / 1000) * (activeBpm / 60)),
            lyric: {},
          };
          audioEngine.previewNote(activeKey, note);
        }, seg.startTimeMs);

        rawPlaybackTimersRef.current.push(timer as unknown as number);
      }
    });

    // Progress ticker
    const progressTicker = setInterval(() => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= totalDurationMs) {
        clearInterval(progressTicker);
        setIsRawPlaying(false);
        setRawPlaybackProgress(100);
      } else {
        setRawPlaybackProgress((elapsed / totalDurationMs) * 100);
      }
    }, 50);
    rawPlaybackTimersRef.current.push(progressTicker as unknown as number);
  }, [isRawPlaying, stopAllPlayback, activeKey, octaveShiftVal, accidentalPref, activeBpm, audioEngine]);

  // Dual-Track Playback: Track 2 (Quantized Synth Preview)
  const handleToggleSynthPlay = useCallback(() => {
    if (isSynthPlaying) {
      audioEngine.stop();
      setIsSynthPlaying(false);
      return;
    }

    if (!transcriptionResult || transcriptionResult.measures.length === 0) return;

    stopAllPlayback();

    const previewSong: Song = {
      id: `keyboard-preview-${Date.now()}`,
      title: 'Keyboard Transcription Preview',
      composer: '',
      lyricist: '',
      key: activeKey,
      timeSignature: activeTimeSignature,
      bpm: activeBpm,
      measures: transcriptionResult.measures,
    };

    audioEngine.setOptions({ instrument: synthInstrument });
    audioEngine.play(previewSong);
    setIsSynthPlaying(true);
  }, [isSynthPlaying, transcriptionResult, stopAllPlayback, activeKey, activeTimeSignature, activeBpm, audioEngine, synthInstrument]);

  // Commit Transcribed Measures to Composer
  const handleCommit = useCallback(() => {
    if (!transcriptionResult || transcriptionResult.measures.length === 0) {
      onClose();
      return;
    }

    stopAllPipelines();
    onCommitTranscription(transcriptionResult.measures, insertionMode);
    onClose();
  }, [transcriptionResult, stopAllPipelines, onCommitTranscription, insertionMode, onClose]);

  // Piano Bed Key Definitions Generator
  const pianoOctaves = useMemo(() => {
    switch (octaveBedView) {
      case 'low_mid':
        return [-1, 0];
      case 'all':
        return [-1, 0, 1];
      case 'mid_high':
      default:
        return [0, 1];
    }
  }, [octaveBedView]);

  const pianoKeys = useMemo(() => {
    const keys: { whiteKeys: KeyDefinition[]; blackKeys: KeyDefinition[] } = {
      whiteKeys: [],
      blackKeys: [],
    };

    pianoOctaves.forEach(oct => {
      // 7 White keys per octave
      const whiteDegreeOffsets = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B relative to C
      const whitePitches: PitchNumber[] = [1, 2, 3, 4, 5, 6, 7];
      const solfegeNames = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'];

      whiteDegreeOffsets.forEach((semi, idx) => {
        const midi = 60 + oct * 12 + semi;
        const noteName = `${CHROMATIC_NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
        const pitch = whitePitches[idx];

        // QWERTY key lookup for middle and high octaves
        let qwertyLabel = '';
        if (oct === 0) {
          const qwertyChars = ['A', 'S', 'D', 'F', 'G', 'H', 'J'];
          qwertyLabel = qwertyChars[idx] || '';
        } else if (oct === 1) {
          const qwertyChars = ['K', 'L', ';', "'", '', '', ''];
          qwertyLabel = qwertyChars[idx] || '';
        }

        // Relative numbered notation display in active key
        const numbered = midiToNumberedPitch(midi, activeKey, {
          accidentalPreference: accidentalPref,
        });

        keys.whiteKeys.push({
          isBlack: false,
          midi,
          pitch,
          accidental: '',
          octave: oct,
          numberedNotationLabel: `${numbered.pitch}`,
          solfege: solfegeNames[idx],
          noteName,
          qwertyKey: qwertyLabel,
        });
      });

      // 5 Black keys per octave
      const blackDefs = [
        { semi: 1, leftPercent: 9.7, pitch: 1 as PitchNumber, qwerty0: 'W', qwerty1: 'O' },
        { semi: 3, leftPercent: 24.0, pitch: 2 as PitchNumber, qwerty0: 'E', qwerty1: 'P' },
        { semi: 6, leftPercent: 52.5, pitch: 4 as PitchNumber, qwerty0: 'T', qwerty1: '' },
        { semi: 8, leftPercent: 66.8, pitch: 5 as PitchNumber, qwerty0: 'Y', qwerty1: '' },
        { semi: 10, leftPercent: 81.1, pitch: 6 as PitchNumber, qwerty0: 'U', qwerty1: '' },
      ];

      blackDefs.forEach(bk => {
        const midi = 60 + oct * 12 + bk.semi;
        const noteName = `${CHROMATIC_NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
        const qwertyLabel = oct === 0 ? bk.qwerty0 : oct === 1 ? bk.qwerty1 : '';

        const numbered = midiToNumberedPitch(midi, activeKey, {
          accidentalPreference: accidentalPref,
        });

        keys.blackKeys.push({
          isBlack: true,
          midi,
          pitch: bk.pitch,
          accidental: '#',
          octave: oct,
          numberedNotationLabel: `${numbered.accidental === '#' ? '♯' : '♭'}${numbered.pitch}`,
          solfege:
            bk.pitch === 1
              ? 'Di'
              : bk.pitch === 2
                ? 'Ri'
                : bk.pitch === 4
                  ? 'Fi'
                  : bk.pitch === 5
                    ? 'Si'
                    : 'Li',
          noteName,
          qwertyKey: qwertyLabel,
          leftPercent: bk.leftPercent,
        });
      });
    });

    return keys;
  }, [pianoOctaves, activeKey, accidentalPref]);

  // Touch / Pointer Event Handlers for on-screen piano
  const handleKeyPointerDown = (midi: number) => {
    isPointerDownRef.current = true;
    if (keyEngineRef.current) {
      keyEngineRef.current.noteOn(midi, 0.9, undefined, `touch-${midi}`);
    }
  };

  const handleKeyPointerUp = (midi: number) => {
    isPointerDownRef.current = false;
    if (keyEngineRef.current) {
      keyEngineRef.current.noteOff(midi, undefined, `touch-${midi}`);
    }
  };

  const handleKeyPointerEnter = (midi: number) => {
    if (isPointerDownRef.current && keyEngineRef.current) {
      keyEngineRef.current.noteOn(midi, 0.9, undefined, `touch-${midi}`);
    }
  };

  const handleKeyPointerLeave = (midi: number) => {
    if (keyEngineRef.current) {
      keyEngineRef.current.noteOff(midi, undefined, `touch-${midi}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="keyboard-to-score-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={e => {
        if (e.target === e.currentTarget) {
          stopAllPipelines();
          onClose();
        }
      }}
    >
      <div
        id="keyboard-to-score-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-modal-title"
        className="relative w-full max-w-4xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 backdrop-blur-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="keyboard-modal-title"
                  className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-100"
                >
                  鍵盤彈奏即時轉譜
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold uppercase font-mono tracking-wider">
                  Keyboard-to-Score
                </span>
                {isMidiConnected && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    MIDI: {activeMidiDevice || 'Connected'}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                支援螢幕觸控鋼琴、電腦鍵盤打字 (QWERTY)、USB/藍牙 Web MIDI 實體電子琴
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* STEP PROGRESS PILL */}
            <div className="hidden sm:flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-800/60 p-1 rounded-xl text-[11px] font-bold">
              <span
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  step === 'SETUP'
                    ? 'bg-amber-500 text-zinc-950 shadow-2xs font-extrabold'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                1. 設定
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  step === 'COUNTING_IN' || step === 'RECORDING'
                    ? 'bg-amber-500 text-zinc-950 shadow-2xs font-extrabold'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                2. 彈奏
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  step === 'REVIEW'
                    ? 'bg-amber-500 text-zinc-950 shadow-2xs font-extrabold'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                3. 轉譜
              </span>
            </div>

            <button
              id="keyboard-modal-close-btn"
              type="button"
              onClick={() => {
                stopAllPipelines();
                onClose();
              }}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
              title="關閉 (Esc)"
              aria-label="關閉"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* ========================================================================= */}
          {/* STEP 1: SETUP & CONFIGURATION                                             */}
          {/* ========================================================================= */}
          {step === 'SETUP' && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-150">
              {/* Top Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Key Signature & Accidental */}
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Music2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>調號 (Key Signature)</span>
                  </label>
                  <select
                    id="keyboard-key-select"
                    value={activeKey}
                    onChange={e => setActiveKey(e.target.value as KeySignature)}
                    aria-label="調號"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-zinc-100 cursor-pointer shadow-2xs focus:ring-2 focus:ring-amber-500"
                  >
                    {CHROMATIC_KEYS.map(k => (
                      <option key={k} value={k}>
                        1 = {k}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center justify-between gap-1 mt-1">
                    <span className="text-[11px] text-zinc-500">升降偏好：</span>
                    <div className="flex gap-1">
                      {(['auto', 'sharp', 'flat'] as const).map(pref => (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => setAccidentalPref(pref)}
                          className={`px-2 py-0.5 text-[10px] rounded-lg font-bold border transition-colors cursor-pointer ${
                            accidentalPref === pref
                              ? 'bg-amber-500 text-zinc-950 border-amber-400 font-extrabold'
                              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          {pref === 'auto' ? '自動' : pref === 'sharp' ? '♯' : '♭'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Tempo BPM & Time Signature */}
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>速度與拍號 (BPM &amp; Meter)</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                      {activeBpm} BPM
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="keyboard-bpm-slider"
                      type="range"
                      min={40}
                      max={200}
                      step={1}
                      value={activeBpm}
                      onChange={e => setActiveBpm(parseInt(e.target.value, 10))}
                      aria-label="彈奏速度 BPM"
                      className="flex-1 accent-amber-500 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg"
                    />
                    <select
                      id="keyboard-time-sig-select"
                      value={activeTimeSignature}
                      onChange={e => setActiveTimeSignature(e.target.value as TimeSignature)}
                      aria-label="拍號"
                      className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl font-mono font-bold text-xs cursor-pointer"
                    >
                      {STANDARD_TIME_SIGNATURES.map(ts => (
                        <option key={ts.value} value={ts.value}>
                          {ts.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Metronome Setup Visual Ring */}
                  <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full transition-transform duration-100 ${
                          setupPreviewPulse
                            ? 'bg-amber-500 scale-125 shadow-sm shadow-amber-500/50'
                            : 'bg-zinc-300 dark:bg-zinc-700 scale-100'
                        }`}
                      />
                      <span className="font-mono font-bold">
                        第 {setupPreviewBeat} 拍 /{' '}
                        {activeTimeSignature.split('/')[0]} 拍
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAudibleClickDuringRecording(!audibleClickDuringRecording)
                      }
                      className="flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-amber-500 cursor-pointer"
                    >
                      {audibleClickDuringRecording ? (
                        <Volume2 className="w-3 h-3 text-amber-500" />
                      ) : (
                        <VolumeX className="w-3 h-3" />
                      )}
                      <span>
                        {audibleClickDuringRecording ? '節拍器有聲' : '節拍器靜音'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 3. Quantization Grid & Count-in */}
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
                    <span>節拍量化顆粒 (Quantize Grid)</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    {(['quarter', 'eighth', 'sixteenth'] as QuantizeGrid[]).map(grid => (
                      <button
                        key={grid}
                        type="button"
                        onClick={() => setQuantizeGrid(grid)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          quantizeGrid === grid
                            ? 'bg-amber-500 text-zinc-950 border-amber-400 font-extrabold shadow-xs'
                            : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
                        }`}
                      >
                        {grid === 'quarter' ? '♩ 四分' : grid === 'eighth' ? '♪ 八分' : '𝅘𝅥𝅯 十六分'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableCountIn}
                        onChange={e => setEnableCountIn(e.target.checked)}
                        className="rounded-md accent-amber-500 cursor-pointer"
                      />
                      <span>預備拍倒數 (Count-in 4 beats)</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowTriplets}
                        onChange={e => setAllowTriplets(e.target.checked)}
                        className="rounded-md accent-amber-500 cursor-pointer"
                      />
                      <span>三連音 (Triplets)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* INPUT MODALITIES INSTRUCTION CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Touch Piano */}
                <div className="p-3.5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-zinc-800 dark:text-zinc-200">
                    <span className="text-base">📱</span>
                    <span>螢幕多點觸控鋼琴</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    在下方琴鍵上自由單音演奏，支援多指滑音 (Glissando) 與零延遲發聲。
                  </p>
                </div>

                {/* 2. QWERTY Typing Guide */}
                <div className="p-3.5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs text-zinc-800 dark:text-zinc-200">
                      <span className="text-base">⌨️</span>
                      <span>電腦鍵盤打字 (QWERTY)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setQwertyMappingMode(
                          qwertyMappingMode === 'chromatic_piano'
                            ? 'movable_solfege'
                            : 'chromatic_piano'
                        )
                      }
                      className="text-[10px] text-amber-600 dark:text-amber-400 underline font-bold cursor-pointer"
                      title="切換首調唱名 / 固定音高模式"
                    >
                      {qwertyMappingMode === 'chromatic_piano' ? '固定音高' : '首調唱名'}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-mono">
                    白鍵：<span className="text-amber-600 dark:text-amber-400 font-bold">A S D F G H J K</span> (1-7)<br />
                    黑鍵：<span className="text-zinc-700 dark:text-zinc-300 font-bold">W E T Y U</span> (♯1, ♯2, ♯4, ♯5, ♯6)<br />
                    休止符：<span className="font-bold">Space</span> · 撤銷：<span className="font-bold">Backspace</span>
                  </p>
                </div>

                {/* 3. Web MIDI Hardware */}
                <div className="p-3.5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-zinc-800 dark:text-zinc-200">
                    <span className="text-base">𝄢</span>
                    <span>Web MIDI 實體電子琴</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {isMidiConnected ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        🟢 已連接：{activeMidiDevice}，直接彈奏鍵盤即可入譜！
                      </span>
                    ) : isMidiSupported ? (
                      '接上 USB 或藍牙 MIDI 鍵盤後將自動連線，即插即彈。'
                    ) : (
                      '瀏覽器未啟用 Web MIDI API，仍可使用螢幕鋼琴與電腦鍵盤。'
                    )}
                  </p>
                </div>
              </div>

              {/* PRIMARY START RECORDING BUTTON */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-xs text-zinc-500">
                  按 <kbd className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono font-bold">空白鍵</kbd> 或點擊按鈕開始
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    id="keyboard-setup-cancel-btn"
                    type="button"
                    onClick={() => {
                      stopAllPipelines();
                      onClose();
                    }}
                    className="flex-1 sm:flex-initial px-5 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                  >
                    取消
                  </button>

                  <button
                    id="keyboard-start-record-btn"
                    type="button"
                    onClick={startRecordingFlow}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[48px]"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                    <span>開始彈奏錄音 (Start Recording)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: COUNT-IN                                                          */}
          {/* ========================================================================= */}
          {step === 'COUNTING_IN' && (
            <div className="flex flex-col items-center justify-center py-16 gap-6 animate-in zoom-in-95 duration-150">
              <div className="relative flex items-center justify-center w-36 h-36 rounded-full border-4 border-amber-500/30 bg-amber-500/10">
                <span className="text-6xl font-black font-mono text-amber-500 animate-pulse">
                  {countdownBeat}
                </span>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                  預備開始... (Get Ready)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  跟隨節拍聲，第 1 拍即刻開始彈奏
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: RECORDING & LIVE PIANO BED                                        */}
          {/* ========================================================================= */}
          {step === 'RECORDING' && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              {/* Telemetry & Metronome Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-900 text-white rounded-2xl border border-zinc-800 shadow-md">
                {/* Timer & Pulsing Dot */}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 font-bold text-xs">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span>REC</span>
                  </div>
                  <span className="text-lg font-mono font-bold tracking-wider text-amber-400">
                    {recordingSeconds.toFixed(1)}s
                  </span>
                </div>

                {/* Metronome Beat Pulse */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3 h-3 rounded-full transition-all duration-75 ${
                        isBeatPulse
                          ? isDownbeatFlash
                            ? 'bg-amber-400 scale-125 shadow-md shadow-amber-400/80'
                            : 'bg-emerald-400 scale-110 shadow-sm shadow-emerald-400/80'
                          : 'bg-zinc-700 scale-100'
                      }`}
                    />
                    <span className="text-xs font-mono font-bold text-zinc-300">
                      第 {currentBeatInBar} 拍 / {activeTimeSignature.split('/')[0]} 拍
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setAudibleClickDuringRecording(!audibleClickDuringRecording)
                    }
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                    title={audibleClickDuringRecording ? '靜音節拍聲' : '開啟節拍聲'}
                  >
                    {audibleClickDuringRecording ? (
                      <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                    )}
                  </button>
                </div>

                {/* Last Played Note Readout */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">當前音高：</span>
                  {lastPlayedNote ? (
                    <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold text-xs">
                      <span className="text-sm font-black">
                        {lastPlayedNote.accidental}
                        {lastPlayedNote.pitch}
                        {lastPlayedNote.octave > 0 ? '̇' : lastPlayedNote.octave < 0 ? '̣' : ''}
                      </span>
                      <span className="text-[10px] text-amber-200">
                        ({lastPlayedNote.solfege})
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500 italic">等待彈奏...</span>
                  )}
                </div>

                {/* Quick Rest & Undo Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    id="keyboard-trigger-rest-btn"
                    type="button"
                    onClick={() => keyEngineRef.current?.triggerRest(500)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
                    title="輸入休止符 0 (Spacebar)"
                  >
                    休止符 (0)
                  </button>

                  <button
                    id="keyboard-undo-note-btn"
                    type="button"
                    onClick={() => keyEngineRef.current?.undoLastNote()}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
                    title="撤銷上一個音 (Backspace)"
                  >
                    撤銷 (Undo)
                  </button>
                </div>
              </div>

              {/* PIANO BED OCTAVE SWITCHER */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span className="font-bold">顯示範圍：</span>
                  {(['low_mid', 'mid_high', 'all'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setOctaveBedView(mode)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        octaveBedView === mode
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 font-extrabold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {mode === 'low_mid'
                        ? '低+中八度'
                        : mode === 'mid_high'
                          ? '中+高八度'
                          : '全 3 八度'}
                    </button>
                  ))}
                </div>

                <div className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
                  <span>調號 1 = {activeKey}</span> · <span>八度位移 {octaveShiftVal}</span>
                </div>
              </div>

              {/* INTERACTIVE ON-SCREEN PIANO BED */}
              <div
                id="keyboard-piano-bed-container"
                className="relative select-none touch-none w-full bg-zinc-900 p-2.5 rounded-2xl border border-zinc-800 shadow-inner overflow-x-auto"
                style={{ minHeight: '180px' }}
              >
                {/* White Keys Row */}
                <div className="flex w-full h-44 relative">
                  {pianoKeys.whiteKeys.map(wk => {
                    const isActive = activeMidiSet.has(wk.midi);
                    return (
                      <div
                        key={`wk-${wk.midi}`}
                        onPointerDown={e => {
                          e.preventDefault();
                          handleKeyPointerDown(wk.midi);
                        }}
                        onPointerUp={e => {
                          e.preventDefault();
                          handleKeyPointerUp(wk.midi);
                        }}
                        onPointerEnter={e => {
                          e.preventDefault();
                          handleKeyPointerEnter(wk.midi);
                        }}
                        onPointerLeave={e => {
                          e.preventDefault();
                          handleKeyPointerLeave(wk.midi);
                        }}
                        className={`flex-1 flex flex-col justify-end items-center pb-2 border-r border-zinc-300 dark:border-zinc-800 rounded-b-lg cursor-pointer transition-all duration-75 relative ${
                          isActive
                            ? 'bg-amber-300 dark:bg-amber-400 text-zinc-950 shadow-md transform translate-y-0.5'
                            : 'bg-white hover:bg-zinc-100 text-zinc-800'
                        }`}
                      >
                        {/* Numbered Notation Pitch Degree */}
                        <div className="flex flex-col items-center">
                          {wk.octave > 0 && <span className="text-[8px] leading-none -mb-1">●</span>}
                          <span className="text-sm font-black font-mono">
                            {wk.numberedNotationLabel}
                          </span>
                          {wk.octave < 0 && <span className="text-[8px] leading-none -mt-1">●</span>}
                        </div>

                        {/* Solfege Name */}
                        <span className="text-[9px] font-sans text-zinc-500 font-medium">
                          {wk.solfege}
                        </span>

                        {/* QWERTY Key Label Badge */}
                        {wk.qwertyKey && (
                          <span className="text-[9px] font-mono font-extrabold px-1 rounded bg-zinc-200 text-zinc-700 mt-0.5">
                            {wk.qwertyKey}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Black Keys Layer */}
                  {pianoOctaves.map((oct, oIdx) => {
                    const octWidthPercent = 100 / pianoOctaves.length;
                    const bKeysInOct = pianoKeys.blackKeys.filter(bk => bk.octave === oct);

                    return bKeysInOct.map(bk => {
                      const isActive = activeMidiSet.has(bk.midi);
                      const leftPos = oIdx * octWidthPercent + ((bk.leftPercent || 0) * octWidthPercent) / 100;

                      return (
                        <div
                          key={`bk-${bk.midi}`}
                          onPointerDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleKeyPointerDown(bk.midi);
                          }}
                          onPointerUp={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleKeyPointerUp(bk.midi);
                          }}
                          onPointerEnter={e => {
                            e.preventDefault();
                            handleKeyPointerEnter(bk.midi);
                          }}
                          onPointerLeave={e => {
                            e.preventDefault();
                            handleKeyPointerLeave(bk.midi);
                          }}
                          style={{
                            left: `${leftPos}%`,
                            width: `${octWidthPercent * 0.09}%`,
                            height: '62%',
                          }}
                          className={`absolute top-0 z-10 flex flex-col justify-end items-center pb-1.5 rounded-b-md cursor-pointer transition-all duration-75 ${
                            isActive
                              ? 'bg-amber-400 text-zinc-950 shadow-lg transform translate-y-0.5'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-x border-b border-black shadow-md'
                          }`}
                        >
                          <span className="text-[10px] font-black font-mono">
                            {bk.numberedNotationLabel}
                          </span>
                          {bk.qwertyKey && (
                            <span className="text-[8px] font-mono font-bold px-0.5 rounded bg-zinc-800 text-amber-400 mt-0.5">
                              {bk.qwertyKey}
                            </span>
                          )}
                        </div>
                      );
                    });
                  })}
                </div>
              </div>

              {/* BOTTOM ACTIONS: FINISH OR RE-RECORD */}
              <div className="flex items-center justify-between pt-2">
                <button
                  id="keyboard-recording-restart-btn"
                  type="button"
                  onClick={() => {
                    stopAllPipelines();
                    setStep('SETUP');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                  <span>重新開始 (Restart)</span>
                </button>

                <button
                  id="keyboard-finish-record-btn"
                  type="button"
                  onClick={handleFinishRecording}
                  className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[44px]"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>完成彈奏轉譜 (Finish &amp; Transcribe)</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: REVIEW & DUAL AUDIO PLAYBACK                                      */}
          {/* ========================================================================= */}
          {step === 'REVIEW' && transcriptionResult && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-150">
              {/* Summary Telemetry Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">轉譜成果：</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold">
                    {transcriptionResult.measures.length} 個小節
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
                    1 = {activeKey}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
                    {activeBpm} BPM
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold">
                    音準精準度 100% (Zero Drift)
                  </span>
                </div>

                <button
                  id="keyboard-retake-btn"
                  type="button"
                  onClick={() => {
                    stopAllPipelines();
                    setStep('SETUP');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                  <span>重新彈奏 (Re-take)</span>
                </button>
              </div>

              {/* DUAL-TRACK AUDIO AUDITION COMPARISON */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-zinc-900 text-white rounded-2xl border border-zinc-800 shadow-sm">
                {/* TRACK 1: Raw Performance Timing */}
                <div className="flex flex-col gap-2 p-3 bg-zinc-950/80 rounded-xl border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>軌道 1：原始按鍵回放 (Raw Keystrokes)</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {isRawPlaying ? `${Math.round(rawPlaybackProgress)}%` : '微秒級精準時序'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id="keyboard-play-raw-btn"
                      type="button"
                      onClick={handleToggleRawPlay}
                      className="p-2.5 rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 font-bold transition-all cursor-pointer shrink-0"
                      title={isRawPlaying ? '暫停原始回放' : '播放原始按鍵'}
                    >
                      {isRawPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-xs font-mono text-zinc-300">
                        {isRawPlaying ? '原始按鍵時序播放中...' : '聆聽彈奏原貌與停頓'}
                      </span>
                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 transition-all duration-75"
                          style={{ width: `${rawPlaybackProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* TRACK 2: Quantized Synthesizer Score Preview */}
                <div className="flex flex-col gap-2 p-3 bg-zinc-950/80 rounded-xl border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>軌道 2：簡譜合成試聽 (Synth Preview)</span>
                    </span>
                    <select
                      id="keyboard-synth-instrument-select"
                      value={synthInstrument}
                      onChange={e => setSynthInstrument(e.target.value as InstrumentType)}
                      aria-label="合成樂器"
                      className="px-2 py-0.5 text-[10px] bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg cursor-pointer"
                    >
                      <option value="piano">鋼琴 (Piano)</option>
                      <option value="flute">竹笛 (Flute)</option>
                      <option value="erhu">二胡 (Erhu)</option>
                      <option value="guitar">吉他 (Guitar)</option>
                      <option value="synth">合成器 (Synth)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id="keyboard-play-synth-btn"
                      type="button"
                      onClick={handleToggleSynthPlay}
                      className="p-2.5 rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 font-bold transition-all cursor-pointer shrink-0"
                      title={isSynthPlaying ? '停止合成試聽' : '播放簡譜合成音'}
                    >
                      {isSynthPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                    <span className="text-xs font-mono text-zinc-300">
                      {isSynthPlaying ? '合成樂器演奏中...' : '聆聽量化後簡譜拍點'}
                    </span>
                  </div>
                </div>
              </div>

              {/* TRANSCRIBED NUMBERED NOTATION SCORE PREVIEW */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Music2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>轉譜簡譜預覽 (Transcribed Numbered Notation Sheet)</span>
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {activeTimeSignature} 拍 · 1 = {activeKey}
                  </span>
                </div>

                <div
                  id="keyboard-transcribed-measures-container"
                  className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-wrap items-center gap-3 min-h-[90px] overflow-x-auto"
                >
                  {transcriptionResult.measures.length === 0 ? (
                    <span className="text-xs text-zinc-400 italic">未偵測到足夠音符</span>
                  ) : (
                    transcriptionResult.measures.map((measure, mIdx) => (
                      <div
                        key={measure.id || `transcribed-m-${mIdx}`}
                        className="flex items-center p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs gap-1.5"
                      >
                        <span className="text-[10px] font-mono text-zinc-400 font-bold self-start mr-1">
                          M.{mIdx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          {measure.notes.map((note, nIdx) => (
                            <NumberedNotationNoteComponent
                              key={note.id || `trans-note-${mIdx}-${nIdx}`}
                              note={note}
                              className="scale-90 cursor-pointer hover:opacity-80"
                              onClick={() => audioEngine.previewNote(activeKey, note)}
                            />
                          ))}
                        </div>
                        <span className="text-zinc-400 dark:text-zinc-600 font-bold ml-1">|</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* QUICK FINE-TUNING TOOLBAR (Instant re-quantize!) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                {/* 1. Octave Shift */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    八度微調 (Shift Octave)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      id="keyboard-octave-down-btn"
                      type="button"
                      onClick={() => {
                        const next = Math.max(-2, octaveShiftVal - 1);
                        setOctaveShiftVal(next);
                        retranscribeCurrent({ octaveShift: next });
                      }}
                      className="p-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 rounded-lg text-xs font-bold cursor-pointer"
                      title="降 1 八度"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-amber-500" />
                    </button>
                    <span className="text-xs font-mono font-bold px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex-1 text-center">
                      {octaveShiftVal === 0 ? '原八度' : `${octaveShiftVal > 0 ? '+' : ''}${octaveShiftVal} Oct`}
                    </span>
                    <button
                      id="keyboard-octave-up-btn"
                      type="button"
                      onClick={() => {
                        const next = Math.min(2, octaveShiftVal + 1);
                        setOctaveShiftVal(next);
                        retranscribeCurrent({ octaveShift: next });
                      }}
                      className="p-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 rounded-lg text-xs font-bold cursor-pointer"
                      title="升 1 八度"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-amber-500" />
                    </button>
                  </div>
                </div>

                {/* 2. Re-Quantize Grid */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    重新量化 (Re-Quantize)
                  </label>
                  <div className="flex items-center gap-1">
                    {(['quarter', 'eighth', 'sixteenth'] as QuantizeGrid[]).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setQuantizeGrid(g);
                          retranscribeCurrent({ grid: g });
                        }}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                          quantizeGrid === g
                            ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black'
                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {g === 'quarter' ? '♩' : g === 'eighth' ? '♪' : '𝅘𝅥𝅯'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Accidental Preference */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    升降記號偏好 (Accidental)
                  </label>
                  <div className="flex items-center gap-1">
                    {(['auto', 'sharp', 'flat'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setAccidentalPref(p);
                          retranscribeCurrent({ accidentalPreference: p });
                        }}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                          accidentalPref === p
                            ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black'
                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {p === 'auto' ? '自動' : p === 'sharp' ? '升 (#)' : '降 (b)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* INSERTION TARGET OPTIONS */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    插入樂譜位置：
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    id="keyboard-insert-mode-cursor-btn"
                    type="button"
                    onClick={() => setInsertionMode('cursor')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      insertionMode === 'cursor'
                        ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-xs'
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    當前游標後 (M.{selectedMeasureIndex ? selectedMeasureIndex + 1 : 1})
                  </button>

                  <button
                    id="keyboard-insert-mode-append-btn"
                    type="button"
                    onClick={() => setInsertionMode('append')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      insertionMode === 'append'
                        ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-xs'
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    追加至曲末 (Append)
                  </button>

                  <button
                    id="keyboard-insert-mode-replace-btn"
                    type="button"
                    onClick={() => setInsertionMode('replace')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      insertionMode === 'replace'
                        ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-xs'
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    替換當前小節 (Replace)
                  </button>
                </div>
              </div>

              {/* COMMIT ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  id="keyboard-cancel-btn"
                  type="button"
                  onClick={() => {
                    stopAllPipelines();
                    onClose();
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  取消
                </button>

                <button
                  id="keyboard-commit-btn"
                  type="button"
                  onClick={handleCommit}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[44px]"
                >
                  <Check className="w-4 h-4 text-zinc-950 stroke-[3]" />
                  <span>確定置入樂譜 (Insert into Score)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
