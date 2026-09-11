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
import type { RawNoteSegment } from '@/lib/pitch/onsetDetector';
import {
  QuantizeGrid,
  getExpectedMeasureBeats,
  midiToNumberedPitch,
  quantizeDurationToBeats,
  transcribeKeyboardSegmentsToMeasures,
  type TranscriptionResult,
} from '@/lib/pitch/scoreQuantizer';
import { wakeLockManager } from '@/lib/wakeLock';
import { startAudioClockMetronome } from '@/lib/keyboard/audioClockMetronome';
import { CHROMATIC_KEYS, STANDARD_TIME_SIGNATURES } from '@/lib/taigiUtils';
import { NumberedNotationNoteComponent } from '@/components/NumberedNotationNoteComponent';
import { PianoBed, OctaveBedView } from './PianoBed';
import {
  Keyboard,
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Music2,
  Clock,
  Layers,
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

export const KeyboardToScoreModal: React.FC<KeyboardToScoreModalProps> = ({
  isOpen,
  onClose,
  song,
  selectedMeasureIndex = 0,
  audioEngine,
  onCommitTranscription,
}) => {
  // Modal flow step state
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

  // Octave display view for persistent piano bed: 'low_mid' (-1, 0), 'mid_high' (0, 1), 'all' (-1, 0, 1)
  const [octaveBedView, setOctaveBedView] = useState<OctaveBedView>('mid_high');

  // Standardized 3-beat countdown: 3 -> 2 -> 1 -> Record
  const [countdownBeat, setCountdownBeat] = useState<number>(3);

  // Metronome Pulse & Recording State
  const [currentBeatInBar, setCurrentBeatInBar] = useState<number>(1);
  const [isBeatPulse, setIsBeatPulse] = useState<boolean>(false);
  const [isDownbeatFlash, setIsDownbeatFlash] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  // Setup preview metronome pulse
  const [setupPreviewBeat, setSetupPreviewBeat] = useState<number>(1);
  const [setupPreviewPulse, setSetupPreviewPulse] = useState<boolean>(false);

  // Active played notes state & live held duration tracking
  const [activeMidiSet, setActiveMidiSet] = useState<Set<number>>(new Set());
  const [activeHeldBeats, setActiveHeldBeats] = useState<number | null>(null);
  const [liveRecordedNotes, setLiveRecordedNotes] = useState<
    Array<{
      id: string;
      pitch: PitchNumber;
      octave: number;
      accidental: '' | '#' | 'b';
      duration: number;
      solfege: string;
    }>
  >([]);
  const [lastPlayedNote, setLastPlayedNote] = useState<{
    pitch: PitchNumber;
    octave: number;
    accidental: '' | '#' | 'b';
    solfege: string;
    midi: number;
  } | null>(null);

  // Transcription output
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [rawSegments, setRawSegments] = useState<RawNoteSegment[]>([]);

  // Audio audition state (Review step)
  const [isRawPlaying, setIsRawPlaying] = useState<boolean>(false);
  const [rawPlaybackProgress, setRawPlaybackProgress] = useState<number>(0);
  const [isSynthPlaying, setIsSynthPlaying] = useState<boolean>(false);

  // Refs
  const keyEngineRef = useRef<KeyEventEngine | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingAudioOriginRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);
  const metronomeStopRef = useRef<(() => void) | null>(null);
  const metronomePulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audibleClickRef = useRef<boolean>(audibleClickDuringRecording);
  const rawPlaybackTimersRef = useRef<number[]>([]);
  const pauseFinishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden
  );
  const isRecordingPausedRef = useRef(false);

  // Closure-safe parameter refs for live callbacks
  const activeKeyRef = useRef(activeKey);
  const activeBpmRef = useRef(activeBpm);
  const octaveShiftRef = useRef(octaveShiftVal);
  const accidentalPrefRef = useRef(accidentalPref);
  const quantizeGridRef = useRef(quantizeGrid);
  const allowTripletsRef = useRef(allowTriplets);

  useEffect(() => {
    audibleClickRef.current = audibleClickDuringRecording;
  }, [audibleClickDuringRecording]);

  useEffect(() => {
    activeKeyRef.current = activeKey;
    activeBpmRef.current = activeBpm;
    octaveShiftRef.current = octaveShiftVal;
    accidentalPrefRef.current = accidentalPref;
    quantizeGridRef.current = quantizeGrid;
    allowTripletsRef.current = allowTriplets;
  }, [activeKey, activeBpm, octaveShiftVal, accidentalPref, quantizeGrid, allowTriplets]);

  // Synchronize audio engine state to automatically toggle off Synth Playing state when playback ends
  useEffect(() => {
    const unsubEnded = audioEngine.subscribeEnded(() => {
      setIsSynthPlaying(false);
    });
    const unsubState = audioEngine.subscribeState(st => {
      if (!st.isPlaying && !st.isPaused) {
        setIsSynthPlaying(false);
      }
    });
    return () => {
      unsubEnded();
      unsubState();
    };
  }, [audioEngine]);

  // Web MIDI Hook with Step Gating (audition preview during SETUP/COUNTING_IN/REVIEW; recording in RECORDING)
  const handleIncomingMidiMessage = useCallback(
    (event: { data: Uint8Array | number[] }) => {
      if (!keyEngineRef.current) return;

      if (step === 'RECORDING') {
        if (isRecordingPausedRef.current) return;
        keyEngineRef.current.handleMidiMessage(event);
      } else {
        // Audition note without modifying performance buffer
        const data = event.data;
        if (data && (data[0] & 0xf0) === 0x90 && (data.length <= 2 || data[2] > 0)) {
          const midi = data[1];
          const pitchInfo = midiToNumberedPitch(midi, activeKeyRef.current, {
            accidentalPreference: accidentalPrefRef.current,
            octaveShift: octaveShiftRef.current,
          });
          audioEngine.previewNote(activeKeyRef.current, {
            id: `midi-audition-${midi}`,
            pitch: pitchInfo.pitch,
            octave: pitchInfo.octave,
            accidental: pitchInfo.accidental,
            duration: 1,
            lyric: {},
          });
          setActiveMidiSet(prev => new Set(prev).add(midi));
        } else if (
          data &&
          ((data[0] & 0xf0) === 0x80 || ((data[0] & 0xf0) === 0x90 && data[2] === 0))
        ) {
          const midi = data[1];
          setActiveMidiSet(prev => {
            const next = new Set(prev);
            next.delete(midi);
            return next;
          });
        }
      }
    },
    [step, audioEngine]
  );

  const {
    isSupported: isMidiSupported,
    activeDevice: activeMidiDevice,
    isConnected: isMidiConnected,
  } = useWebMidi(handleIncomingMidiMessage, isOpen);

  // Initialize KeyEventEngine
  useEffect(() => {
    const engine = new KeyEventEngine(
      {
        keySignature: activeKeyRef.current,
        timeSignature: activeTimeSignature,
        bpm: activeBpmRef.current,
        octaveShift: octaveShiftRef.current,
        quantizeGrid: quantizeGridRef.current,
        allowTriplets: allowTripletsRef.current,
        accidentalPreference: accidentalPrefRef.current,
        qwertyMappingMode,
        extendLegatoGaps: true,
        filterOneFingerGaps: true,
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

          // Zero-latency real-time preview audio during recording
          const tempNote: NumberedNotationNote = {
            id: `live-key-${note.midi}-${Date.now()}`,
            pitch: note.pitch,
            octave: note.octave,
            accidental: note.accidental,
            duration: 1,
            lyric: {},
          };
          audioEngine.previewNote(activeKeyRef.current, tempNote);
        },
        onNoteOff: (midi: number) => {
          setActiveMidiSet(prev => {
            const next = new Set(prev);
            next.delete(midi);
            return next;
          });
        },
        onSegmentCommitted: (seg: RawNoteSegment) => {
          if (seg.midi !== null) {
            const pitchInfo = midiToNumberedPitch(seg.midi, activeKeyRef.current, {
              accidentalPreference: accidentalPrefRef.current,
              octaveShift: octaveShiftRef.current,
            });
            const q = quantizeDurationToBeats(
              seg.durationMs,
              activeBpmRef.current,
              quantizeGridRef.current,
              allowTripletsRef.current,
              true
            );
            const solfege =
              pitchInfo.pitch === 1
                ? 'Do'
                : pitchInfo.pitch === 2
                  ? 'Re'
                  : pitchInfo.pitch === 3
                    ? 'Mi'
                    : pitchInfo.pitch === 4
                      ? 'Fa'
                      : pitchInfo.pitch === 5
                        ? 'Sol'
                        : pitchInfo.pitch === 6
                          ? 'La'
                          : pitchInfo.pitch === 7
                            ? 'Ti'
                            : '';

            setLiveRecordedNotes(prev => [
              ...prev.slice(-9),
              {
                id: `live-rec-${seg.startTimeMs}-${Date.now()}`,
                pitch: pitchInfo.pitch,
                octave: pitchInfo.octave,
                accidental: pitchInfo.accidental,
                duration: q.duration,
                solfege,
              },
            ]);
          }
        },
        onOctaveShiftChange: shift => {
          setOctaveShiftVal(shift);
        },
      },
      () => {
        if (audioEngine.getAudioContextState() === 'running') {
          return audioEngine.getAudioContextTime() * 1000;
        }
        return performance.now();
      }
    );

    keyEngineRef.current = engine;

    return () => {
      engine.releaseAllActiveKeys();
      if (engine.isRecordingActive()) {
        engine.stopRecording();
      }
      engine.destroy();
    };
  }, [audioEngine, activeTimeSignature, qwertyMappingMode]);

  // Synchronize configuration changes to keyEngine
  useEffect(() => {
    keyEngineRef.current?.updateConfig({
      keySignature: activeKey,
      timeSignature: activeTimeSignature,
      bpm: activeBpm,
      octaveShift: octaveShiftVal,
      quantizeGrid,
      allowTriplets,
      accidentalPreference: accidentalPref,
      qwertyMappingMode,
    });
  }, [
    activeKey,
    activeTimeSignature,
    activeBpm,
    octaveShiftVal,
    quantizeGrid,
    allowTriplets,
    accidentalPref,
    qwertyMappingMode,
  ]);

  // Throttled live held duration ticker during active recording
  useEffect(() => {
    if (step !== 'RECORDING') return;

    const ticker = setInterval(() => {
      const active = keyEngineRef.current?.getActiveNoteHeldDuration();
      if (active) {
        setActiveHeldBeats(active.estimatedBeats);
      } else {
        setActiveHeldBeats(prev => (prev === null ? prev : null));
      }
    }, 75);

    return () => {
      clearInterval(ticker);
      setActiveHeldBeats(null);
    };
  }, [step]);

  // Visual metronome preview pulse in SETUP step (audio-clock lookahead, not setInterval-per-beat)
  useEffect(() => {
    if (step !== 'SETUP' || !isOpen || !isPageVisible) return;
    const beatsPerBar = Math.max(1, Math.round(getExpectedMeasureBeats(activeTimeSignature))) || 4;
    audioEngine.initContext();
    const usingAudio = audioEngine.getAudioContextState() === 'running';
    const wallOriginSec = performance.now() / 1000;
    const audioOrigin = audioEngine.getAudioContextTime();
    let pulseTimeout: ReturnType<typeof setTimeout> | null = null;

    const stop = startAudioClockMetronome({
      getCurrentTime: () =>
        usingAudio ? audioEngine.getAudioContextTime() : audioOrigin + (performance.now() / 1000 - wallOriginSec),
      bpm: activeBpm,
      beatsPerBar,
      shouldClick: () => false,
      onBeat: ({ beatInBar }) => {
        setSetupPreviewBeat(beatInBar);
        setSetupPreviewPulse(true);
        if (pulseTimeout) clearTimeout(pulseTimeout);
        pulseTimeout = setTimeout(() => setSetupPreviewPulse(false), 140);
      },
    });

    return () => {
      stop();
      if (pulseTimeout) clearTimeout(pulseTimeout);
    };
  }, [step, isOpen, isPageVisible, activeTimeSignature, activeBpm, audioEngine]);

  // Clean up all audio audition and tickers
  const stopAllPlayback = useCallback(() => {
    audioEngine.stop();
    setIsSynthPlaying(false);
    setIsRawPlaying(false);
    rawPlaybackTimersRef.current.forEach(id => clearTimeout(id));
    rawPlaybackTimersRef.current = [];
  }, [audioEngine]);

  const stopAllPipelines = useCallback(() => {
    stopAllPlayback();
    void wakeLockManager.release();

    if (metronomeStopRef.current) {
      metronomeStopRef.current();
      metronomeStopRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (pauseFinishTimerRef.current) {
      clearTimeout(pauseFinishTimerRef.current);
      pauseFinishTimerRef.current = null;
    }
    isRecordingPausedRef.current = false;
    setIsRecordingPaused(false);
    if (metronomePulseTimeoutRef.current) {
      clearTimeout(metronomePulseTimeoutRef.current);
      metronomePulseTimeoutRef.current = null;
    }
    setIsBeatPulse(false);
    setIsDownbeatFlash(false);

    if (keyEngineRef.current) {
      keyEngineRef.current.releaseAllActiveKeys();
      if (keyEngineRef.current.isRecordingActive()) {
        keyEngineRef.current.stopRecording();
      }
    }
    setActiveMidiSet(new Set());
    setActiveHeldBeats(null);
  }, [stopAllPlayback]);

  // Unmount lifecycle cleanup
  useEffect(() => {
    return () => {
      stopAllPipelines();
      keyEngineRef.current?.destroy();
      void wakeLockManager.release();
    };
  }, [stopAllPipelines]);

  const flashMetronomeBeat = useCallback((beatInBar: number, isDownbeat: boolean) => {
    setCurrentBeatInBar(beatInBar);
    setIsBeatPulse(true);
    setIsDownbeatFlash(isDownbeat);
    if (metronomePulseTimeoutRef.current) clearTimeout(metronomePulseTimeoutRef.current);
    metronomePulseTimeoutRef.current = setTimeout(() => {
      setIsBeatPulse(false);
      setIsDownbeatFlash(false);
      metronomePulseTimeoutRef.current = null;
    }, 140);
  }, []);

  // Actual recording execution. `startAudioTime` is beat-1 origin on the AudioContext clock.
  const beginActiveRecording = useCallback((startAudioTime?: number) => {
    setStep('RECORDING');
    setRecordingSeconds(0);
    setActiveMidiSet(new Set());
    setActiveHeldBeats(null);
    setLiveRecordedNotes([]);
    setLastPlayedNote(null);
    void wakeLockManager.request();

    audioEngine.initContext();
    audioEngine.cancelAutoSuspend();
    const originSec = startAudioTime ?? audioEngine.getAudioContextTime();
    recordingAudioOriginRef.current = originSec;
    setIsRecordingPaused(false);
    isRecordingPausedRef.current = false;

    const engine = keyEngineRef.current;
    if (engine) {
      engine.startRecording(originSec * 1000);
    }

    recordingStartTimeRef.current = performance.now();
    recordingSecondsRef.current = 0;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingTimerRef.current = setInterval(() => {
      if (isRecordingPausedRef.current) return;
      const elapsed = (performance.now() - recordingStartTimeRef.current) / 1000;
      const rounded = Math.round(elapsed * 10) / 10;
      recordingSecondsRef.current = rounded;
      setRecordingSeconds(rounded);
    }, 100);

    if (metronomeStopRef.current) {
      metronomeStopRef.current();
      metronomeStopRef.current = null;
    }

    const beatsPerBar = Math.max(1, Math.round(getExpectedMeasureBeats(activeTimeSignature))) || 4;
    metronomeStopRef.current = startAudioClockMetronome({
      getCurrentTime: () => audioEngine.getAudioContextTime(),
      startAt: originSec,
      bpm: activeBpm,
      beatsPerBar,
      shouldClick: () => audibleClickRef.current,
      scheduleClick: (when, isDownbeat) => {
        audioEngine.scheduleMetronomeTick(when, isDownbeat);
      },
      scheduleCallback: (when, cb) => audioEngine.scheduleAudioCallback(when, cb),
      onBeat: ({ beatInBar, isDownbeat }) => {
        audioEngine.cancelAutoSuspend();
        flashMetronomeBeat(beatInBar, isDownbeat);
      },
    });
  }, [activeTimeSignature, activeBpm, audioEngine, flashMetronomeBeat]);

  // Handle Count-in and Start Recording (standardized 3-beat countdown: 3 -> 2 -> 1 -> Record)
  const startRecordingFlow = useCallback(() => {
    stopAllPipelines();
    audioEngine.initContext();
    audioEngine.unlockOnUserGesture();
    audioEngine.cancelAutoSuspend();

    if (!enableCountIn) {
      beginActiveRecording();
      return;
    }

    const COUNT_IN_BEATS = 3;
    setStep('COUNTING_IN');
    setCountdownBeat(COUNT_IN_BEATS);

    let remaining = COUNT_IN_BEATS;
    const beatsPerBar = Math.max(1, Math.round(getExpectedMeasureBeats(activeTimeSignature))) || 4;

    metronomeStopRef.current = startAudioClockMetronome({
      getCurrentTime: () => audioEngine.getAudioContextTime(),
      bpm: activeBpm,
      beatsPerBar,
      maxBeats: COUNT_IN_BEATS,
      scheduleClick: (when, isDownbeat) => {
        audioEngine.scheduleMetronomeTick(when, isDownbeat);
      },
      scheduleCallback: (when, cb) => audioEngine.scheduleAudioCallback(when, cb),
      onBeat: ({ isDownbeat }) => {
        audioEngine.cancelAutoSuspend();
        setCountdownBeat(remaining);
        if (isDownbeat) {
          setIsDownbeatFlash(true);
          setTimeout(() => setIsDownbeatFlash(false), 140);
        }
        remaining -= 1;
      },
      onComplete: nextBeatTime => {
        metronomeStopRef.current = null;
        beginActiveRecording(nextBeatTime);
      },
    });
  }, [
    activeBpm,
    activeTimeSignature,
    enableCountIn,
    stopAllPipelines,
    audioEngine,
    beginActiveRecording,
  ]);

  const clearPauseFinishTimer = useCallback(() => {
    if (pauseFinishTimerRef.current) {
      clearTimeout(pauseFinishTimerRef.current);
      pauseFinishTimerRef.current = null;
    }
  }, []);

  // Finish recording and transcribe
  const handleFinishRecording = useCallback(() => {
    stopAllPipelines();

    const engine = keyEngineRef.current;
    if (!engine) return;

    const segments = engine.finalize();
    setRawSegments(segments);

    const result = transcribeKeyboardSegmentsToMeasures(segments, {
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
    setIsRecordingPaused(false);
    isRecordingPausedRef.current = false;
    clearPauseFinishTimer();
  }, [
    stopAllPipelines,
    activeKey,
    activeBpm,
    activeTimeSignature,
    quantizeGrid,
    allowTriplets,
    octaveShiftVal,
    accidentalPref,
    clearPauseFinishTimer,
  ]);

  const pauseRecordingSession = useCallback(() => {
    if (step !== 'RECORDING' || isRecordingPausedRef.current) return;
    isRecordingPausedRef.current = true;
    setIsRecordingPaused(true);
    keyEngineRef.current?.pauseRecording();
    if (metronomeStopRef.current) {
      metronomeStopRef.current();
      metronomeStopRef.current = null;
    }
    void wakeLockManager.release();
    clearPauseFinishTimer();
    pauseFinishTimerRef.current = setTimeout(() => {
      pauseFinishTimerRef.current = null;
      handleFinishRecording();
    }, 3 * 60 * 1000);
  }, [step, clearPauseFinishTimer, handleFinishRecording]);

  const resumeRecordingSession = useCallback(() => {
    if (!isRecordingPausedRef.current) return;
    clearPauseFinishTimer();
    audioEngine.unlockOnUserGesture();
    audioEngine.cancelAutoSuspend();
    void wakeLockManager.request();
    keyEngineRef.current?.resumeRecording();

    recordingStartTimeRef.current = performance.now() - recordingSecondsRef.current * 1000;
    isRecordingPausedRef.current = false;
    setIsRecordingPaused(false);

    const beatsPerBar = Math.max(1, Math.round(getExpectedMeasureBeats(activeTimeSignature))) || 4;
    // Use the (pause-shifted) recording origin so clicks resume on the same
    // beat grid the transcriber uses for key-press times.
    const originSec =
      (keyEngineRef.current?.getRecordingStartTime() ?? 0) / 1000 ||
      recordingAudioOriginRef.current ||
      audioEngine.getAudioContextTime();
    metronomeStopRef.current = startAudioClockMetronome({
      getCurrentTime: () => audioEngine.getAudioContextTime(),
      startAt: originSec,
      bpm: activeBpm,
      beatsPerBar,
      shouldClick: () => audibleClickRef.current,
      scheduleClick: (when, isDownbeat) => {
        audioEngine.scheduleMetronomeTick(when, isDownbeat);
      },
      scheduleCallback: (when, cb) => audioEngine.scheduleAudioCallback(when, cb),
      onBeat: ({ beatInBar, isDownbeat }) => {
        audioEngine.cancelAutoSuspend();
        flashMetronomeBeat(beatInBar, isDownbeat);
      },
    });
  }, [audioEngine, activeTimeSignature, activeBpm, flashMetronomeBeat, clearPauseFinishTimer]);

  // Pause (do not auto-finish) recording when the tab/app is hidden.
  useEffect(() => {
    if (!isOpen) return;
    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsPageVisible(!hidden);
      if (!hidden) return;
      if (step === 'RECORDING') {
        pauseRecordingSession();
      } else if (step === 'COUNTING_IN') {
        stopAllPipelines();
        setStep('SETUP');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, step, pauseRecordingSession, stopAllPipelines]);

  // Re-transcribe with new options during Review
  const retranscribeCurrent = useCallback(
    (overrides?: {
      grid?: QuantizeGrid;
      octaveShift?: number;
      accidentalPreference?: 'auto' | 'sharp' | 'flat';
      allowTriplets?: boolean;
    }) => {
      const segs =
        rawSegments.length > 0 ? rawSegments : (keyEngineRef.current?.getSegments() ?? []);
      if (segs.length === 0) return;

      const newGrid = overrides?.grid ?? quantizeGrid;
      const newOct = overrides?.octaveShift ?? octaveShiftVal;
      const newAcc = overrides?.accidentalPreference ?? accidentalPref;
      const newTriplets = overrides?.allowTriplets ?? allowTriplets;

      const result = transcribeKeyboardSegmentsToMeasures(segs, {
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
    [
      rawSegments,
      activeKey,
      activeBpm,
      activeTimeSignature,
      quantizeGrid,
      octaveShiftVal,
      accidentalPref,
      allowTriplets,
    ]
  );

  // Global Keydown / Keyup listener for computer QWERTY keyboard
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopAllPipelines();
        onClose();
        return;
      }

      if (step === 'SETUP' || step === 'COUNTING_IN') {
        if (step === 'SETUP' && e.code === 'Space') {
          e.preventDefault();
          startRecordingFlow();
          return;
        }

        // Audition key in SETUP or COUNTING_IN
        const resolved = resolveQwertyKey(
          e.code,
          activeKeyRef.current,
          octaveShiftRef.current,
          qwertyMappingMode,
          accidentalPrefRef.current
        );
        if (resolved) {
          e.preventDefault();
          audioEngine.previewNote(activeKeyRef.current, {
            id: `qwerty-audition-${resolved.midi}-${Date.now()}`,
            pitch: resolved.pitch,
            octave: resolved.octave,
            accidental: resolved.accidental,
            duration: 1,
            lyric: {},
          });
          setActiveMidiSet(prev => new Set(prev).add(resolved.midi));
        }
        return;
      }

      if (step === 'RECORDING') {
        if (isRecordingPausedRef.current) {
          if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            resumeRecordingSession();
          }
          return;
        }
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
      if (step === 'SETUP' || step === 'COUNTING_IN') {
        const resolved = resolveQwertyKey(
          e.code,
          activeKeyRef.current,
          octaveShiftRef.current,
          qwertyMappingMode,
          accidentalPrefRef.current
        );
        if (resolved) {
          setActiveMidiSet(prev => {
            const next = new Set(prev);
            next.delete(resolved.midi);
            return next;
          });
        }
        return;
      }

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
  }, [
    isOpen,
    step,
    startRecordingFlow,
    handleFinishRecording,
    resumeRecordingSession,
    stopAllPipelines,
    onClose,
    qwertyMappingMode,
    audioEngine,
  ]);

  // Dual-Track Playback: Track 1 (Raw Performance Timing Playback)
  const handleToggleRawPlay = useCallback(() => {
    if (isRawPlaying) {
      stopAllPlayback();
      return;
    }

    const segments =
      rawSegments.length > 0 ? rawSegments : (keyEngineRef.current?.getSegments() ?? []);
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
  }, [
    isRawPlaying,
    stopAllPlayback,
    rawSegments,
    activeKey,
    octaveShiftVal,
    accidentalPref,
    activeBpm,
    audioEngine,
  ]);

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
  }, [
    isSynthPlaying,
    transcriptionResult,
    stopAllPlayback,
    activeKey,
    activeTimeSignature,
    activeBpm,
    audioEngine,
    synthInstrument,
  ]);

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

  // Handle touch piano note events
  const handlePianoNoteDown = useCallback(
    (midi: number, sourceId?: string) => {
      if (step === 'RECORDING') {
        if (isRecordingPausedRef.current) return;
        if (keyEngineRef.current) {
          keyEngineRef.current.noteOn(midi, 0.9, undefined, sourceId);
        }
      } else {
        // Audition note in SETUP, COUNTING_IN, or REVIEW
        const pitchInfo = midiToNumberedPitch(midi, activeKeyRef.current, {
          accidentalPreference: accidentalPrefRef.current,
          octaveShift: octaveShiftRef.current,
        });
        audioEngine.previewNote(activeKeyRef.current, {
          id: `piano-audition-${midi}-${Date.now()}`,
          pitch: pitchInfo.pitch,
          octave: pitchInfo.octave,
          accidental: pitchInfo.accidental,
          duration: 1,
          lyric: {},
        });
        setActiveMidiSet(prev => new Set(prev).add(midi));
      }
    },
    [step, audioEngine]
  );

  const handlePianoNoteUp = useCallback(
    (midi: number, sourceId?: string) => {
      if (step === 'RECORDING') {
        if (keyEngineRef.current) {
          keyEngineRef.current.noteOff(midi, undefined, sourceId);
        }
      } else {
        setActiveMidiSet(prev => {
          const next = new Set(prev);
          next.delete(midi);
          return next;
        });
      }
    },
    [step]
  );

  const getBeatDurationLabel = useCallback((beats: number): string => {
    if (beats >= 3.65) return '4.0 拍 (全音符 1 - - -)';
    if (beats >= 2.65) return '3.0 拍 (附點二分 1 - -)';
    if (beats >= 1.65) return '2.0 拍 (二分音符 1 -)';
    if (beats >= 1.35) return '1.5 拍 (附點四分 ♩·)';
    if (beats >= 0.7) return '1.0 拍 (四分音符 ♩)';
    if (beats >= 0.35) return '0.5 拍 (八分音符 ♪)';
    return `${beats.toFixed(2)} 拍 (十六分 𝅘𝅥𝅯)`;
  }, []);

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
                  鍵盤彈奏即時轉譜工作站
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold uppercase font-mono tracking-wider">
                  Keyboard Studio
                </span>
                {isMidiConnected && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    MIDI: {activeMidiDevice || 'Connected'}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                專業即時簡譜轉錄工作站 · 支援螢幕觸控鋼琴、電腦鍵盤打字 (QWERTY)、USB/藍牙 Web MIDI 實體電子琴
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
                        第 {setupPreviewBeat} 拍 / {activeTimeSignature.split('/')[0]} 拍
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
                      <span>預備拍倒數 (3 拍)</span>
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
                    白鍵：
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      A S D F G H J K
                    </span>{' '}
                    (1-7)
                    <br />
                    黑鍵：
                    <span className="text-zinc-700 dark:text-zinc-300 font-bold">
                      W E T Y U
                    </span>{' '}
                    (♯1, ♯2, ♯4, ♯5, ♯6)
                    <br />
                    休止符：<span className="font-bold">Space</span> · 撤銷：
                    <span className="font-bold">Backspace</span>
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

              {/* PERSISTENT AUDITION PIANO BED */}
              <div className="flex flex-col gap-2">
                <PianoBed
                  activeKey={activeKey}
                  accidentalPreference={accidentalPref}
                  octaveBedView={octaveBedView}
                  onOctaveBedViewChange={setOctaveBedView}
                  activeMidiSet={activeMidiSet}
                  onNoteDown={handlePianoNoteDown}
                  onNoteUp={handlePianoNoteUp}
                  isRecording={false}
                  octaveShiftVal={octaveShiftVal}
                />
              </div>

              {/* PRIMARY START RECORDING BUTTON */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-xs text-zinc-500">
                  按{' '}
                  <kbd className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono font-bold">
                    空白鍵
                  </kbd>{' '}
                  或點擊按鈕開始
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
          {/* STEP 2: COUNT-IN / RECORDING INTEGRATED STUDIO VIEW                        */}
          {/* ========================================================================= */}
          {(step === 'COUNTING_IN' || step === 'RECORDING') && (
            <div className="relative flex flex-col gap-4 animate-in fade-in duration-150">
              {isRecordingPaused && step === 'RECORDING' && (
                <button
                  type="button"
                  onClick={resumeRecordingSession}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-zinc-950/80 text-white cursor-pointer touch-manipulation"
                >
                  <Pause className="w-10 h-10 text-amber-400" />
                  <span className="text-base font-black">錄音已暫停</span>
                  <span className="text-xs text-zinc-300">點擊繼續 · recording paused — tap to continue</span>
                </button>
              )}
              {/* Telemetry & Metronome Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-900 text-white rounded-2xl border border-zinc-800 shadow-md">
                {step === 'COUNTING_IN' ? (
                  <>
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-amber-400 animate-ping" />
                      <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                        琴鍵預備 · 倒數 {countdownBeat} 拍
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-amber-400 font-bold hidden sm:inline">
                        3 拍預備 · 速度 {activeBpm} BPM
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          stopAllPipelines();
                          setStep('SETUP');
                        }}
                        className="px-3 py-1 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        取消預備
                      </button>
                    </div>
                  </>
                ) : (
                  <>
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

                    {/* Last Played Note & Live Held Duration Readout */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-zinc-400">當前音高：</span>
                      {lastPlayedNote ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold text-xs">
                            <span className="text-sm font-black">
                              {lastPlayedNote.accidental}
                              {lastPlayedNote.pitch}
                              {lastPlayedNote.octave > 0
                                ? '̇'
                                : lastPlayedNote.octave < 0
                                  ? '̣'
                                  : ''}
                            </span>
                            <span className="text-[10px] text-amber-200">
                              ({lastPlayedNote.solfege})
                            </span>
                          </div>
                          {activeHeldBeats !== null && (
                            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-xs animate-pulse">
                              <span className="text-[10px] text-emerald-400 uppercase tracking-wider">
                                持續按住:
                              </span>
                              <span>{getBeatDurationLabel(activeHeldBeats)}</span>
                            </div>
                          )}
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
                  </>
                )}
              </div>

              {/* LIVE RECORDED NOTES STREAM OR COUNTDOWN HINT */}
              <div className="h-14 bg-zinc-950/80 rounded-xl border border-zinc-800 p-2 flex items-center overflow-x-auto gap-1.5">
                {step === 'COUNTING_IN' ? (
                  <div className="flex items-center justify-between w-full px-2 text-xs text-amber-400/90 font-mono">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                      <span>預備拍倒數中 ({countdownBeat})... 請準備在第 1 拍開始彈奏！</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 shrink-0">
                      1 = {activeKey} · {activeTimeSignature}
                    </span>
                  </div>
                ) : liveRecordedNotes.length > 0 ? (
                  <>
                    <span className="text-[10px] font-bold text-zinc-400 font-mono shrink-0">
                      已錄入音符：
                    </span>
                    <div className="flex items-center gap-1.5 flex-nowrap">
                      {liveRecordedNotes.map(n => (
                        <div
                          key={n.id}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono font-bold shadow-xs shrink-0"
                        >
                          <span className="text-amber-400 font-black">
                            {n.accidental}
                            {n.pitch}
                            {n.octave > 0 ? '̇' : n.octave < 0 ? '̣' : ''}
                          </span>
                          <span className="text-[10px] px-1 rounded bg-zinc-800 text-zinc-300">
                            {n.duration >= 1
                              ? `${n.duration}拍`
                              : n.duration === 0.5
                                ? '½拍'
                                : `${n.duration}拍`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full px-2 text-xs text-zinc-500">
                    <span>🎹 彈奏中，音符將隨彈奏即時顯示在此流水線中。</span>
                    <span className="font-mono text-[10px] text-zinc-600 shrink-0">
                      1 = {activeKey} · {activeTimeSignature}
                    </span>
                  </div>
                )}
              </div>

              {/* PERSISTENT INTERACTIVE PIANO BED */}
              <div className="flex flex-col gap-2">
                <PianoBed
                  activeKey={activeKey}
                  accidentalPreference={accidentalPref}
                  octaveBedView={octaveBedView}
                  onOctaveBedViewChange={setOctaveBedView}
                  activeMidiSet={activeMidiSet}
                  onNoteDown={handlePianoNoteDown}
                  onNoteUp={handlePianoNoteUp}
                  isRecording={step === 'RECORDING' && !isRecordingPaused}
                  disabled={isRecordingPaused}
                  octaveShiftVal={octaveShiftVal}
                />
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

                {step === 'RECORDING' && (
                  <button
                    id="keyboard-finish-record-btn"
                    type="button"
                    onClick={handleFinishRecording}
                    className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[44px]"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>完成彈奏轉譜 (Finish &amp; Transcribe)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: REVIEW & DUAL AUDIO PLAYBACK                                      */}
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
                      <option value="cello">大提琴 (Cello)</option>
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
                      {isSynthPlaying ? '合成樂器演奏中...' : '聆聽量化後簡譜拍點 (曲終自動停止)'}
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
                      {octaveShiftVal === 0
                        ? '原八度'
                        : `${octaveShiftVal > 0 ? '+' : ''}${octaveShiftVal} Oct`}
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
