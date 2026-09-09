'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  KeySignature,
  Measure,
  NoteDuration,
  NumberedNotationNote,
  PitchNumber,
  Song,
  TimeSignature,
  InstrumentType,
} from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import {
  YinDetector,
  YinDetectorConfig,
  getMidiNoteInfo,
  calculateRms,
  NOTE_NAMES,
  frequencyToCents,
  midiToFrequency,
} from '@/lib/pitch/yinDetector';
import {
  NoteSegmenter,
  OnsetDetectorConfig,
  RawNoteSegment,
} from '@/lib/pitch/onsetDetector';
import {
  transcribeAudioSegmentsToMeasures,
  QuantizeGrid,
  shiftOctaves,
  cleanRawSegments,
  midiToNumberedPitch,
} from '@/lib/pitch/scoreQuantizer';
import { wakeLockManager } from '@/lib/wakeLock';
import { CHROMATIC_KEYS, STANDARD_TIME_SIGNATURES } from '@/lib/taigiUtils';
import { NumberedNotationNoteComponent } from '@/components/NumberedNotationNoteComponent';
import {
  Mic,
  Mic2,
  Square,
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Sparkles,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Music2,
  Activity,
  Radio,
  Clock,
  Layers,
  HelpCircle,
  Wand2,
} from 'lucide-react';

export type InstrumentPresetId = 'vocal' | 'flute' | 'cello' | 'guitar' | 'erhu';

export interface InstrumentPresetConfig {
  id: InstrumentPresetId;
  name: string;
  nameZh: string;
  icon: string;
  description: string;
  tips: string;
  yinConfig: Partial<YinDetectorConfig>;
  onsetConfig: Partial<OnsetDetectorConfig>;
  filterType: 'highpass' | 'bandpass';
  filterFreq: number;
  filterQ?: number;
}

export const INSTRUMENT_PRESETS: InstrumentPresetConfig[] = [
  {
    id: 'vocal',
    name: 'Vocal Humming',
    nameZh: '人聲哼唱',
    icon: '🎙️',
    description: 'Vocal humming or singing with micro-vibrato smoothing',
    tips: '建議以清脆的「噠 (da)」或「啦 (la)」起音，保持音量穩定',
    yinConfig: {
      threshold: 0.15,
      minFrequency: 75,
      maxFrequency: 1200,
      silenceThreshold: 0.008,
      medianFilterSize: 5,
    },
    onsetConfig: {
      silenceThresholdRms: 0.008,
      attackRmsDeltaThreshold: 0.02,
      attackRelativeRiseThreshold: 1.8,
      refractoryPeriodMs: 70,
    },
    filterType: 'highpass',
    filterFreq: 80,
  },
  {
    id: 'flute',
    name: 'Bamboo Flute',
    nameZh: '竹笛 / 笛子',
    icon: '🎋',
    description: 'Acoustic flute with breath turbulence filtering & tonguing attack',
    tips: '帶音頭吐音可獲得最佳音符切分，竹笛高音純淨易辨識',
    yinConfig: {
      threshold: 0.12,
      minFrequency: 280,
      maxFrequency: 2800,
      silenceThreshold: 0.007,
      medianFilterSize: 3,
    },
    onsetConfig: {
      silenceThresholdRms: 0.007,
      attackRmsDeltaThreshold: 0.015,
      attackRelativeRiseThreshold: 1.6,
      refractoryPeriodMs: 60,
    },
    filterType: 'bandpass',
    filterFreq: 1200,
    filterQ: 0.8,
  },
  {
    id: 'cello',
    name: 'Cello',
    nameZh: '大提琴 / 擦弦',
    icon: '🎻',
    description: 'Bowed strings with harmonic suppression & glissando protection',
    tips: '換弓與清晰換把運指有助精確分音，已抗二次泛音八度跳音',
    yinConfig: {
      threshold: 0.12,
      minFrequency: 65,
      maxFrequency: 1800,
      silenceThreshold: 0.009,
      medianFilterSize: 5,
    },
    onsetConfig: {
      silenceThresholdRms: 0.009,
      attackRmsDeltaThreshold: 0.022,
      attackRelativeRiseThreshold: 1.7,
      refractoryPeriodMs: 90,
    },
    filterType: 'highpass',
    filterFreq: 60,
  },
  {
    id: 'guitar',
    name: 'Acoustic Guitar',
    nameZh: '木吉他單音',
    icon: '🎸',
    description: 'Plucked single-note acoustic solos with transient attack detection',
    tips: '手指或撥片彈奏清晰單音，每次撥弦皆自動觸發起音偵測',
    yinConfig: {
      threshold: 0.15,
      minFrequency: 80,
      maxFrequency: 1200,
      silenceThreshold: 0.008,
      medianFilterSize: 3,
    },
    onsetConfig: {
      silenceThresholdRms: 0.008,
      attackRmsDeltaThreshold: 0.025,
      attackRelativeRiseThreshold: 2.0,
      spectralFluxThreshold: 0.06,
      refractoryPeriodMs: 70,
    },
    filterType: 'highpass',
    filterFreq: 75,
  },
];

const SOLFEGE_MAP: Record<string, string> = {
  '0': 'Rest',
  '1': 'Do',
  '2': 'Re',
  '3': 'Mi',
  '4': 'Fa',
  '5': 'Sol',
  '6': 'La',
  '7': 'Ti',
  'empty': '',
};

export type HumModalStep = 'SETUP' | 'COUNTING_IN' | 'RECORDING' | 'REVIEW';
export type InsertionMode = 'cursor' | 'append' | 'replace';

export interface HumToScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
  selectedMeasureIndex?: number | null;
  audioEngine: AudioEngine;
  onCommitTranscription: (measures: Measure[], mode: InsertionMode) => void;
}

export const HumToScoreModal: React.FC<HumToScoreModalProps> = ({
  isOpen,
  onClose,
  song,
  selectedMeasureIndex = 0,
  audioEngine,
  onCommitTranscription,
}) => {
  // Modal flow state
  const [step, setStep] = useState<HumModalStep>('SETUP');
  const [presetId, setPresetId] = useState<InstrumentPresetId>('vocal');
  const [activeKey, setActiveKey] = useState<KeySignature>(song.key || 'C');
  const [activeBpm, setActiveBpm] = useState<number>(song.bpm || 80);
  const [activeTimeSignature, setActiveTimeSignature] = useState<TimeSignature>(
    song.timeSignature || '4/4'
  );
  const [quantizeGrid, setQuantizeGrid] = useState<QuantizeGrid>('eighth');
  const [enableCountIn, setEnableCountIn] = useState<boolean>(true);
  const [audibleClickDuringRecording, setAudibleClickDuringRecording] = useState<boolean>(false);
  const [octaveShiftVal, setOctaveShiftVal] = useState<number>(0);
  const [accidentalPref, setAccidentalPref] = useState<'auto' | 'sharp' | 'flat'>('auto');
  const [insertionMode, setInsertionMode] = useState<InsertionMode>('cursor');
  const [synthInstrument, setSynthInstrument] = useState<InstrumentType>('piano');

  // Count-in state
  const [countdownBeat, setCountdownBeat] = useState<number>(3);

  // Visual Metronome Click state (active during recording regardless of audible click setting)
  const [currentBeatInBar, setCurrentBeatInBar] = useState<number>(1);
  const [isBeatPulse, setIsBeatPulse] = useState<boolean>(false);
  const [isDownbeatFlash, setIsDownbeatFlash] = useState<boolean>(false);

  // Setup preview beat pulse
  const [setupPreviewBeat, setSetupPreviewBeat] = useState<number>(1);
  const [setupPreviewPulse, setSetupPreviewPulse] = useState<boolean>(false);

  const audibleClickRef = useRef<boolean>(audibleClickDuringRecording);
  useEffect(() => {
    audibleClickRef.current = audibleClickDuringRecording;
  }, [audibleClickDuringRecording]);

  // Setup screen lightweight visual metronome pulse
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
  }, [step, isOpen, activeBpm, activeTimeSignature]);

  // Live telemetry state (during recording)
  const [currentPitchHz, setCurrentPitchHz] = useState<number | null>(null);
  const [currentMidi, setCurrentMidi] = useState<number | null>(null);
  const [currentCents, setCurrentCents] = useState<number>(0);
  const [currentRms, setCurrentRms] = useState<number>(0);
  const [isVoiced, setIsVoiced] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [liveTranscribedNotes, setLiveTranscribedNotes] = useState<NumberedNotationNote[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Post-recording review state
  const [rawSegments, setRawSegments] = useState<RawNoteSegment[]>([]);
  const [transcribedMeasures, setTranscribedMeasures] = useState<Measure[]>([]);
  const [accuracyCents, setAccuracyCents] = useState<number>(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // Dual audio preview playback state
  const [isMicPlaying, setIsMicPlaying] = useState<boolean>(false);
  const [micAudioCurrentTime, setMicAudioCurrentTime] = useState<number>(0);
  const [micAudioDuration, setMicAudioDuration] = useState<number>(0);
  const [isSynthPlaying, setIsSynthPlaying] = useState<boolean>(false);

  // Microphone input gain state (large amplification for iPad / quiet microphones, 1x to 25x)
  const [micGain, setMicGain] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hum_to_score_mic_gain');
        if (saved) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
            return parsed;
          }
        }
      } catch {}
    }
    return 6.0; // Default to 6.0x (+15.6 dB) to give iPad and quiet mics healthy sensitivity out-of-the-box
  });

  // Web Audio & Recording pipeline references
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const yinDetectorRef = useRef<YinDetector | null>(null);
  const noteSegmenterRef = useRef<NoteSegmenter | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countInIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const metronomeClickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio elements
  const micAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Cancellation and telemetry throttling refs
  const isStartingStreamRef = useRef<boolean>(false);
  const metronomePulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTelemetryTimeRef = useRef<number>(0);

  // Selected preset configuration
  const activePreset = useMemo(() => {
    return INSTRUMENT_PRESETS.find(p => p.id === presetId || (presetId === 'erhu' && p.id === 'cello')) || INSTRUMENT_PRESETS[0];
  }, [presetId]);

  // Dynamic mic gain adjustment
  const handleMicGainChange = useCallback((newGain: number) => {
    const clamped = Math.max(1, Math.min(30, Math.round(newGain * 10) / 10));
    setMicGain(clamped);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('hum_to_score_mic_gain', String(clamped));
      } catch {}
    }
    if (micGainNodeRef.current && audioContextRef.current) {
      try {
        micGainNodeRef.current.gain.setTargetAtTime(clamped, audioContextRef.current.currentTime, 0.02);
      } catch {
        micGainNodeRef.current.gain.value = clamped;
      }
    }
    if (yinDetectorRef.current) {
      const baseSilenceThreshold = activePreset.yinConfig.silenceThreshold ?? 0.008;
      const effectiveSilenceThreshold =
        baseSilenceThreshold * Math.min(4.5, Math.max(1.0, 1.0 + (clamped - 1.0) * 0.25));
      yinDetectorRef.current.updateConfig({ silenceThreshold: effectiveSilenceThreshold });
    }
  }, [activePreset]);

  // Clean up all resources when modal closes
  const stopAllAudioPipelines = useCallback(() => {
    isStartingStreamRef.current = false;
    void wakeLockManager.release();

    // Stop timers
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (countInIntervalRef.current) {
      clearInterval(countInIntervalRef.current);
      countInIntervalRef.current = null;
    }
    if (metronomeClickIntervalRef.current) {
      clearInterval(metronomeClickIntervalRef.current);
      metronomeClickIntervalRef.current = null;
    }
    if (metronomePulseTimeoutRef.current) {
      clearTimeout(metronomePulseTimeoutRef.current);
      metronomePulseTimeoutRef.current = null;
    }
    setIsBeatPulse(false);
    setIsDownbeatFlash(false);
    setCurrentBeatInBar(1);
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    // Disconnect ScriptProcessor and Filter
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch {}
      scriptProcessorRef.current = null;
    }
    if (filterNodeRef.current) {
      try {
        filterNodeRef.current.disconnect();
      } catch {}
      filterNodeRef.current = null;
    }
    if (micGainNodeRef.current) {
      try {
        micGainNodeRef.current.disconnect();
      } catch {}
      micGainNodeRef.current = null;
    }
    if (silentGainRef.current) {
      try {
        silentGainRef.current.disconnect();
      } catch {}
      silentGainRef.current = null;
    }

    // Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close recording AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    // Stop mic preview audio playback
    if (micAudioElementRef.current) {
      micAudioElementRef.current.pause();
      micAudioElementRef.current.currentTime = 0;
    }
    setIsMicPlaying(false);

    // Stop AudioEngine synthesizer
    if (audioEngine) {
      audioEngine.stop();
    }
    setIsSynthPlaying(false);
  }, [audioEngine]);

  useEffect(() => {
    return () => {
      stopAllAudioPipelines();
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [stopAllAudioPipelines, recordedAudioUrl]);

  // Subscribe to AudioEngine state for synth playback tracking
  useEffect(() => {
    const unsub = audioEngine.subscribeState(state => {
      setIsSynthPlaying(state.isPlaying);
    });
    return () => unsub();
  }, [audioEngine]);

  // Live waveform visualizer canvas loop
  const startCanvasVisualizer = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f59e0b'; // Amber-500
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();
  }, []);

  // Run the core recording stream pipeline
  const startRecordingStream = useCallback(async () => {
    setAudioError(null);
    recordedChunksRef.current = [];
    isStartingStreamRef.current = true;

    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }

    // 1. Request microphone access
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: unknown) {
        isStartingStreamRef.current = false;
        const errorMsg = err instanceof Error ? err.message : String(err);
        setAudioError(`Microphone access failed: ${errorMsg}. Please allow microphone permission in your browser.`);
        setStep('SETUP');
        return;
      }
    }

    // Abort guard: if modal was closed while permission was pending, release stream and abort
    if (!isStartingStreamRef.current) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    mediaStreamRef.current = stream;

    // 2. Setup Web Audio context & signal processing graph
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    audioContextRef.current = audioCtx;

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    // Secondary abort guard after potential resume delay
    if (!isStartingStreamRef.current) {
      stream.getTracks().forEach(track => track.stop());
      try { audioCtx.close(); } catch {}
      return;
    }

    const sourceNode = audioCtx.createMediaStreamSource(stream);

    // High-Gain Microphone Input Amplifier (Large gain range 1x ~ 30x for iPad / quiet microphones)
    const micGainNode = audioCtx.createGain();
    micGainNode.gain.setValueAtTime(micGain, audioCtx.currentTime);
    micGainNodeRef.current = micGainNode;

    // Filter Node based on instrument preset
    const filterNode = audioCtx.createBiquadFilter();
    filterNode.type = activePreset.filterType;
    filterNode.frequency.setValueAtTime(activePreset.filterFreq, audioCtx.currentTime);
    if (activePreset.filterQ) {
      filterNode.Q.setValueAtTime(activePreset.filterQ, audioCtx.currentTime);
    }
    filterNodeRef.current = filterNode;

    // Analyser Node for live visualizer
    const analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 1024;
    analyserRef.current = analyserNode;

    // ScriptProcessorNode for real-time sample processing (2048 buffer size ~46ms at 44.1kHz)
    const scriptProcessor = audioCtx.createScriptProcessor(2048, 1, 1);
    scriptProcessorRef.current = scriptProcessor;

    // Silent Gain Node: prevents acoustic feedback into speakers
    const silentGain = audioCtx.createGain();
    silentGain.gain.setValueAtTime(0, audioCtx.currentTime);
    silentGainRef.current = silentGain;

    // Connect audio processing graph:
    // sourceNode -> micGainNode -> filterNode -> analyserNode -> scriptProcessor -> silentGain -> destination
    sourceNode.connect(micGainNode);
    micGainNode.connect(filterNode);
    filterNode.connect(analyserNode);
    analyserNode.connect(scriptProcessor);
    scriptProcessor.connect(silentGain);
    silentGain.connect(audioCtx.destination);

    // 3. Setup MediaRecorder for dual-track playback (records amplified stream when supported)
    try {
      let recStream: MediaStream = stream;
      try {
        if (typeof audioCtx.createMediaStreamDestination === 'function') {
          const recDest = audioCtx.createMediaStreamDestination();
          micGainNode.connect(recDest);
          if (recDest.stream && recDest.stream.getAudioTracks().length > 0) {
            recStream = recDest.stream;
          }
        }
      } catch {
        recStream = stream;
      }

      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const supportedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = new MediaRecorder(recStream, supportedMime ? { mimeType: supportedMime } : undefined);

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn('[HumToScore] MediaRecorder init failed, continuing pitch detection:', err);
    }

    // 4. Initialize YIN and Onset detectors with preset configuration and gain-scaled silence gate
    const baseSilenceThreshold = activePreset.yinConfig.silenceThreshold ?? 0.008;
    const effectiveSilenceThreshold =
      baseSilenceThreshold * Math.min(4.5, Math.max(1.0, 1.0 + (micGain - 1.0) * 0.25));

    const yin = new YinDetector({
      sampleRate: audioCtx.sampleRate,
      ...activePreset.yinConfig,
      silenceThreshold: effectiveSilenceThreshold,
    });
    yinDetectorRef.current = yin;

    const segmenter = new NoteSegmenter({
      sampleRate: audioCtx.sampleRate,
      ...activePreset.onsetConfig,
    });
    noteSegmenterRef.current = segmenter;

    recordingStartTimeRef.current = performance.now();
    setRecordingSeconds(0);
    setLiveTranscribedNotes([]);
    setStep('RECORDING');
    void wakeLockManager.request();

    // Start live visualizer
    startCanvasVisualizer();

    // Elapsed time ticker
    timerIntervalRef.current = setInterval(() => {
      const elapsedSec = (performance.now() - recordingStartTimeRef.current) / 1000;
      setRecordingSeconds(Math.round(elapsedSec * 10) / 10);
    }, 100);

    // Visual & optional audible metronome guide click during recording (visual indication ALWAYS active)
    const beatsPerBar = parseInt(activeTimeSignature.split('/')[0], 10) || 4;
    const secPerBeat = 60 / activeBpm;
    let beatCounter = 0;

    // Trigger beat 1 immediately upon start
    setCurrentBeatInBar(1);
    setIsBeatPulse(true);
    setIsDownbeatFlash(true);
    if (audibleClickRef.current) {
      audioEngine.playMetronomeTick(true);
    }
    if (metronomePulseTimeoutRef.current) clearTimeout(metronomePulseTimeoutRef.current);
    metronomePulseTimeoutRef.current = setTimeout(() => {
      setIsBeatPulse(false);
      setIsDownbeatFlash(false);
      metronomePulseTimeoutRef.current = null;
    }, 140);
    beatCounter = 1;

    metronomeClickIntervalRef.current = setInterval(() => {
      const beatIndex = (beatCounter % beatsPerBar) + 1;
      const isDownbeat = (beatCounter % beatsPerBar) === 0;

      setCurrentBeatInBar(beatIndex);
      setIsBeatPulse(true);
      setIsDownbeatFlash(isDownbeat);

      if (metronomePulseTimeoutRef.current) clearTimeout(metronomePulseTimeoutRef.current);
      metronomePulseTimeoutRef.current = setTimeout(() => {
        setIsBeatPulse(false);
        setIsDownbeatFlash(false);
        metronomePulseTimeoutRef.current = null;
      }, 140);

      if (audibleClickRef.current) {
        audioEngine.playMetronomeTick(isDownbeat);
      }
      beatCounter++;
    }, secPerBeat * 1000);

    // 5. Audio Process Handler (continuous stream analysis with throttled UI telemetry)
    scriptProcessor.onaudioprocess = e => {
      const channelData = e.inputBuffer.getChannelData(0);
      const rms = calculateRms(channelData);
      const timestampMs = performance.now() - recordingStartTimeRef.current;

      const pitchRes = yin.detectSmoothed(channelData);

      // Throttled UI telemetry to avoid React render storm (~10 Hz max)
      const now = performance.now();
      if (now - lastTelemetryTimeRef.current >= 80) {
        lastTelemetryTimeRef.current = now;
        setCurrentRms(rms);
        setIsVoiced(pitchRes.isPitched);

        if (pitchRes.isPitched && pitchRes.frequency !== null) {
          setCurrentPitchHz(pitchRes.frequency);
          setCurrentMidi(pitchRes.nearestMidi);
          setCurrentCents(pitchRes.centsOffNearestMidi);
        } else {
          setCurrentPitchHz(null);
          setCurrentMidi(null);
          setCurrentCents(0);
        }
      }

      // Feed frame to Onset / Segmenter engine
      const finishedSeg = segmenter.ingestFrame(
        channelData,
        timestampMs,
        pitchRes.isPitched ? pitchRes.frequency : null
      );

      // If a note segment finished, update live rolling notes preview
      if (finishedSeg) {
        const segs = segmenter.getSegments();
        const cleaned = cleanRawSegments(segs, 50, true);
        const liveNotes: NumberedNotationNote[] = cleaned.slice(-8).map((s, idx) => {
          if (s.midi !== null) {
            const pitchInfo = midiToNumberedPitch(s.midi, activeKey, {
              accidentalPreference: accidentalPref,
              octaveShift: octaveShiftVal,
            });
            return {
              id: `live-note-${idx}`,
              pitch: pitchInfo.pitch,
              octave: pitchInfo.octave,
              accidental: pitchInfo.accidental,
              duration: 1,
              lyric: {},
            };
          }
          return {
            id: `live-note-rest-${idx}`,
            pitch: 0,
            octave: 0,
            duration: 1,
            lyric: {},
          };
        });
        setLiveTranscribedNotes(liveNotes);
      }
    };
  }, [
    activePreset,
    activeKey,
    activeBpm,
    activeTimeSignature,
    accidentalPref,
    octaveShiftVal,
    audioEngine,
    startCanvasVisualizer,
    micGain,
    recordedAudioUrl,
  ]);

  // Start Count-in Lead-in or go straight to recording
  const handleInitiateRecording = useCallback(() => {
    if (!enableCountIn) {
      void startRecordingStream();
      return;
    }

    setStep('COUNTING_IN');
    let currentBeat = 3;
    setCountdownBeat(currentBeat);

    // First count-in click
    audioEngine.playMetronomeTick(true);

    const secPerBeat = 60 / activeBpm;
    countInIntervalRef.current = setInterval(() => {
      currentBeat -= 1;
      if (currentBeat > 0) {
        setCountdownBeat(currentBeat);
        audioEngine.playMetronomeTick(false);
      } else {
        if (countInIntervalRef.current) {
          clearInterval(countInIntervalRef.current);
          countInIntervalRef.current = null;
        }
        void startRecordingStream();
      }
    }, secPerBeat * 1000);
  }, [enableCountIn, activeBpm, audioEngine, startRecordingStream]);

  // Stop Recording & Run Final Transcription
  const handleStopRecording = useCallback(() => {
    void wakeLockManager.release();

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (metronomeClickIntervalRef.current) {
      clearInterval(metronomeClickIntervalRef.current);
      metronomeClickIntervalRef.current = null;
    }
    if (metronomePulseTimeoutRef.current) {
      clearTimeout(metronomePulseTimeoutRef.current);
      metronomePulseTimeoutRef.current = null;
    }
    setIsBeatPulse(false);
    setIsDownbeatFlash(false);
    setCurrentBeatInBar(1);
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    // Stop MediaRecorder to finalize blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    // Finalize note segments from segmenter
    const totalDurationMs = performance.now() - recordingStartTimeRef.current;
    let finalSegments: RawNoteSegment[] = [];
    if (noteSegmenterRef.current) {
      finalSegments = noteSegmenterRef.current.finalize(totalDurationMs);
    }
    setRawSegments(finalSegments);

    // Disconnect stream nodes and close AudioContext
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch {}
      scriptProcessorRef.current = null;
    }
    if (filterNodeRef.current) {
      try {
        filterNodeRef.current.disconnect();
      } catch {}
      filterNodeRef.current = null;
    }
    if (micGainNodeRef.current) {
      try {
        micGainNodeRef.current.disconnect();
      } catch {}
      micGainNodeRef.current = null;
    }
    if (silentGainRef.current) {
      try {
        silentGainRef.current.disconnect();
      } catch {}
      silentGainRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    // Run transcription pipeline
    const transcription = transcribeAudioSegmentsToMeasures(finalSegments, {
      key: activeKey,
      timeSignature: activeTimeSignature,
      bpm: activeBpm,
      grid: quantizeGrid,
      octaveShift: octaveShiftVal,
      accidentalPreference: accidentalPref,
      autoFillTrailingRests: true,
      startMeasureNumber: selectedMeasureIndex ? selectedMeasureIndex + 1 : 1,
    });

    setTranscribedMeasures(transcription.measures);
    setAccuracyCents(transcription.summary.averagePitchAccuracyCents);
    setStep('REVIEW');
  }, [
    activeKey,
    activeTimeSignature,
    activeBpm,
    quantizeGrid,
    octaveShiftVal,
    accidentalPref,
    selectedMeasureIndex,
  ]);

  // Page Visibility API handler: auto-finish recording if page goes to background
  useEffect(() => {
    if (!isOpen) return;
    const handleVisibilityChange = () => {
      if (document.hidden && step === 'RECORDING') {
        handleStopRecording();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, step, handleStopRecording]);

  // Re-transcribe with adjusted parameters in review mode
  const reTranscribeWithParams = useCallback(
    (newGrid: QuantizeGrid, newOctave: number, newAccidental: 'auto' | 'sharp' | 'flat') => {
      if (rawSegments.length === 0) return;

      const transcription = transcribeAudioSegmentsToMeasures(rawSegments, {
        key: activeKey,
        timeSignature: activeTimeSignature,
        bpm: activeBpm,
        grid: newGrid,
        octaveShift: newOctave,
        accidentalPreference: newAccidental,
        autoFillTrailingRests: true,
        startMeasureNumber: selectedMeasureIndex ? selectedMeasureIndex + 1 : 1,
      });

      setTranscribedMeasures(transcription.measures);
      setAccuracyCents(transcription.summary.averagePitchAccuracyCents);
    },
    [rawSegments, activeKey, activeTimeSignature, activeBpm, selectedMeasureIndex]
  );

  const handleOctaveShift = (delta: number) => {
    const nextOctave = Math.max(-2, Math.min(2, octaveShiftVal + delta));
    setOctaveShiftVal(nextOctave);
    reTranscribeWithParams(quantizeGrid, nextOctave, accidentalPref);
  };

  const handleGridChange = (grid: QuantizeGrid) => {
    setQuantizeGrid(grid);
    reTranscribeWithParams(grid, octaveShiftVal, accidentalPref);
  };

  const handleAccidentalChange = (pref: 'auto' | 'sharp' | 'flat') => {
    setAccidentalPref(pref);
    reTranscribeWithParams(quantizeGrid, octaveShiftVal, pref);
  };

  // Dual-Track Audio Playback: Track 1 (Mic Recording)
  const handleToggleMicPlay = () => {
    const audioEl = micAudioElementRef.current;
    if (!audioEl) return;

    if (isMicPlaying) {
      audioEl.pause();
      setIsMicPlaying(false);
    } else {
      if (isSynthPlaying) {
        audioEngine.stop();
        setIsSynthPlaying(false);
      }
      audioEl.play().catch(() => {});
      setIsMicPlaying(true);
    }
  };

  // Dual-Track Audio Playback: Track 2 (Synthesizer Preview)
  const handleToggleSynthPlay = () => {
    if (isSynthPlaying) {
      audioEngine.stop();
      setIsSynthPlaying(false);
    } else {
      if (isMicPlaying && micAudioElementRef.current) {
        micAudioElementRef.current.pause();
        setIsMicPlaying(false);
      }

      if (transcribedMeasures.length === 0) return;

      const previewSong: Song = {
        id: `hum-preview-${Date.now()}`,
        title: 'Humming Transcription Preview',
        composer: '',
        lyricist: '',
        key: activeKey,
        timeSignature: activeTimeSignature,
        bpm: activeBpm,
        measures: transcribedMeasures,
      };

      audioEngine.setOptions({ instrument: synthInstrument });
      audioEngine.play(previewSong);
      setIsSynthPlaying(true);
    }
  };

  // Commit and close
  const handleCommit = () => {
    if (transcribedMeasures.length === 0) {
      onClose();
      return;
    }
    stopAllAudioPipelines();
    onCommitTranscription(transcribedMeasures, insertionMode);
    onClose();
  };

  // Active Solfege Information during recording
  const activeSolfegInfo = useMemo(() => {
    if (!isVoiced || currentMidi === null) {
      return { noteNum: '0', solfege: 'Rest', octaveDots: 0, accidental: '' };
    }
    const numbered = midiToNumberedPitch(currentMidi, activeKey, {
      accidentalPreference: accidentalPref,
      octaveShift: octaveShiftVal,
    });
    return {
      noteNum: String(numbered.pitch),
      solfege: SOLFEGE_MAP[String(numbered.pitch)] || '',
      octaveDots: numbered.octave,
      accidental: numbered.accidental,
    };
  }, [isVoiced, currentMidi, activeKey, accidentalPref, octaveShiftVal]);

  if (!isOpen) return null;

  return (
    <div
      id="hum-to-score-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        id="hum-to-score-modal-dialog"
        className="w-full max-w-3xl bg-white dark:bg-[#12151c] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto transition-all"
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-[#161a24]/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black border border-amber-500/20 shrink-0">
              <Mic2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>哼唱與實體樂器收音記譜</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                  Hum-to-Score
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                單音收音、即時音準校正與拍號小節切分
              </p>
            </div>
          </div>

          <button
            id="hum-modal-close-btn"
            type="button"
            onClick={() => {
              stopAllAudioPipelines();
              onClose();
            }}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          {/* Error Banner */}
          {audioError && (
            <div
              id="hum-audio-error-banner"
              className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-2xl flex items-center gap-2"
            >
              <Activity className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{audioError}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: SETUP SCREEN                                                      */}
          {/* ========================================================================= */}
          {step === 'SETUP' && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              {/* Instrument Source Presets Grid */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-amber-500" />
                  <span>選擇收音樂器與人聲類型 (Sound Source Profile)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {INSTRUMENT_PRESETS.map(preset => {
                    const isSelected = preset.id === presetId;
                    return (
                      <button
                        key={preset.id}
                        id={`hum-preset-btn-${preset.id}`}
                        type="button"
                        onClick={() => setPresetId(preset.id)}
                        className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all cursor-pointer touch-manipulation ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-zinc-900 dark:text-zinc-100 ring-2 ring-amber-400 shadow-xs'
                            : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-amber-400/50 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">{preset.icon}</div>
                        <span className="font-extrabold text-xs">{preset.nameZh}</span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate w-full">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-bold">{activePreset.nameZh} 收音建議：</span>
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                      {activePreset.tips}
                    </span>
                  </div>
                </div>
              </div>

              {/* Musical Parameters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                {/* Key Signature */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    目前調號 (Key)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="daw-lcd px-3 py-1.5 rounded-xl text-xs font-mono font-bold">
                      1 = {activeKey}
                    </div>
                    <select
                      id="hum-select-key"
                      value={activeKey}
                      onChange={e => setActiveKey(e.target.value as KeySignature)}
                      aria-label="選取調號"
                      className="px-2 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold cursor-pointer"
                    >
                      {CHROMATIC_KEYS.map(k => (
                        <option key={k} value={k}>
                          1 = {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tempo BPM */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    拍速 (BPM)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="daw-lcd px-3 py-1.5 rounded-xl text-xs font-mono font-bold">
                      {activeBpm} BPM
                    </div>
                    <input
                      id="hum-input-bpm"
                      type="number"
                      min="40"
                      max="240"
                      value={activeBpm}
                      onChange={e => setActiveBpm(parseInt(e.target.value, 10) || 80)}
                      aria-label="拍速 BPM"
                      className="w-20 px-2 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Quantization Grid */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    拍點量化精度 (Grid)
                  </label>
                  <div className="flex items-center gap-1">
                    {(['quarter', 'eighth', 'sixteenth'] as QuantizeGrid[]).map(g => (
                      <button
                        key={g}
                        id={`hum-grid-btn-${g}`}
                        type="button"
                        onClick={() => setQuantizeGrid(g)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          quantizeGrid === g
                            ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-xs'
                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-amber-400/40'
                        }`}
                      >
                        {g === 'quarter' ? '四分 ♩' : g === 'eighth' ? '八分 ♪' : '十六 𝅘𝅥𝅯'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Microphone Input Gain Amplifier Slider (Large gain for iPad / mobile) */}
              <div
                id="hum-mic-gain-card"
                className="flex flex-col gap-2.5 p-4 bg-amber-500/10 dark:bg-amber-950/25 border border-amber-300 dark:border-amber-700/80 rounded-2xl"
              >
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="hum-mic-gain-slider"
                    className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5"
                  >
                    <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>麥克風輸入放大增益 (Mic Input Gain)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-200 font-extrabold">
                      iPad / 靜音設備必備
                    </span>
                  </label>
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className="text-base font-black text-amber-600 dark:text-amber-400">
                      {micGain.toFixed(1)}x
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
                      (+{(20 * Math.log10(micGain)).toFixed(1)} dB)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleMicGainChange(Math.max(1, micGain - 1))}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-base flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 cursor-pointer touch-manipulation"
                    title="降低增益 (-1x)"
                  >
                    -
                  </button>
                  <input
                    id="hum-mic-gain-slider"
                    type="range"
                    min="1"
                    max="25"
                    step="0.5"
                    value={micGain}
                    onChange={e => handleMicGainChange(parseFloat(e.target.value))}
                    className="flex-1 accent-amber-500 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => handleMicGainChange(Math.min(25, micGain + 1))}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-base flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 cursor-pointer touch-manipulation"
                    title="提高增益 (+1x)"
                  >
                    +
                  </button>
                </div>

                {/* Fast Preset Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mr-0.5">
                    快捷檔位:
                  </span>
                  {[
                    { label: '1x (標準 0dB)', val: 1.0 },
                    { label: '3x (普通 +9.5dB)', val: 3.0 },
                    { label: '6x (iPad 推薦 +15.6dB)', val: 6.0, highlight: true },
                    { label: '12x (大增益 +21.6dB)', val: 12.0 },
                    { label: '20x (超高增益 +26dB)', val: 20.0 },
                    { label: '25x (極大放大 +28dB)', val: 25.0 },
                  ].map(p => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => handleMicGainChange(p.val)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-xl border transition-all cursor-pointer touch-manipulation ${
                        Math.abs(micGain - p.val) < 0.2
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-xs'
                          : p.highlight
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-900 dark:text-amber-200 hover:bg-amber-500/30'
                          : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  提示：iPad、平板或外接微弱麥克風建議選取「6x (iPad 推薦)」或更高增益，可大幅提升音高偵測靈敏度，避免漏音或誤判為靜音。
                </p>
              </div>

              {/* Metronome & Options Toggles */}
              <div className="flex flex-col sm:flex-row gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 flex-1 cursor-pointer">
                  <input
                    id="hum-countin-checkbox"
                    type="checkbox"
                    checked={enableCountIn}
                    onChange={e => setEnableCountIn(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      錄音前節拍器預備拍 (Count-in 3 Beats)
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      開唱前自動倒數 3 拍引導節奏 (3 • 2 • 1)
                    </span>
                  </div>
                </label>

                <label className="flex flex-col gap-2.5 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 flex-1 cursor-pointer">
                  <div className="flex items-start gap-2.5">
                    <input
                      id="hum-recording-click-checkbox"
                      type="checkbox"
                      checked={audibleClickDuringRecording}
                      onChange={e => setAudibleClickDuringRecording(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 mt-0.5"
                    />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          錄音中持續節拍提示聲 (Metronome Click)
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                          視覺指示燈全程常開
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        無論是否勾選發聲提示，錄音時均有即時視覺節拍閃爍燈；開啟聲音建議佩戴耳機避免串音
                      </span>
                    </div>
                  </div>

                  {/* Visual Metronome Live Preview in Setup Card */}
                  <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <span className="text-[10px] font-bold text-zinc-400 shrink-0">
                      節拍燈預覽:
                    </span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: parseInt(activeTimeSignature.split('/')[0], 10) || 4 }).map((_, idx) => {
                        const beatNum = idx + 1;
                        const isCurrent = setupPreviewBeat === beatNum;
                        const isDownbeat = beatNum === 1;
                        return (
                          <span
                            key={beatNum}
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all duration-100 ${
                              isCurrent && setupPreviewPulse
                                ? isDownbeat
                                  ? 'bg-amber-400 text-zinc-950 font-black scale-110 shadow-xs ring-1 ring-amber-300'
                                  : 'bg-amber-500 text-zinc-950 font-black scale-105 shadow-xs'
                                : isDownbeat
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold'
                                : 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {isDownbeat ? '★' : '•'} {beatNum}
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 ml-auto">
                      {activeBpm} BPM ({activeTimeSignature})
                    </span>
                  </div>
                </label>
              </div>

              {/* Start Recording Button */}
              <div className="flex justify-center pt-2">
                <button
                  id="hum-start-recording-btn"
                  type="button"
                  onClick={handleInitiateRecording}
                  className="flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-base rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer touch-manipulation"
                >
                  <Mic className="w-5 h-5" />
                  <span>開始錄音記譜 (Start Recording)</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: COUNTING IN                                                       */}
          {/* ========================================================================= */}
          {step === 'COUNTING_IN' && (
            <div className="flex flex-col items-center justify-center py-12 gap-5 animate-in zoom-in-95 duration-150">
              <span className="text-xs font-extrabold uppercase tracking-widest text-amber-500 animate-pulse">
                節拍預備拍 · Ready to Sing or Play
              </span>
              <div
                key={countdownBeat}
                className="w-28 h-28 rounded-full bg-amber-500/20 border-4 border-amber-500 flex items-center justify-center text-5xl font-black text-amber-500 dark:text-amber-400 shadow-xl animate-in zoom-in-75 duration-150"
              >
                {countdownBeat}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                1 = {activeKey} · {activeBpm} BPM ({countdownBeat}/3)
              </p>
              <button
                type="button"
                onClick={stopAllAudioPipelines}
                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                取消 (Cancel)
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: LIVE RECORDING & PITCH GAUGE                                      */}
          {/* ========================================================================= */}
          {step === 'RECORDING' && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              {/* Header Status & Elapsed Timer */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-black text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                    錄音辨識中 (Recording Live) · {activePreset.nameZh}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono font-bold text-sm text-rose-700 dark:text-rose-300">
                  <Clock className="w-4 h-4" />
                  <span>{recordingSeconds.toFixed(1)}s</span>
                </div>
              </div>

              {/* VISUAL METRONOME CLICK BAR - ALWAYS ACTIVE WITH STRICTLY FIXED HEIGHT */}
              <div
                id="hum-visual-metronome-bar"
                className={`h-16 min-h-[64px] max-h-[64px] px-3.5 sm:px-4 rounded-2xl border transition-colors duration-100 flex items-center justify-between gap-3 overflow-hidden select-none box-border ${
                  isDownbeatFlash
                    ? 'bg-amber-500/20 border-amber-400 shadow-md'
                    : isBeatPulse
                    ? 'bg-zinc-800/95 border-amber-500/40 shadow-xs'
                    : 'bg-zinc-900/90 border-zinc-800'
                }`}
              >
                {/* Left: Metronome pulsing beacon & tempo metadata (Fixed width, strictly non-wrapping) */}
                <div className="flex items-center gap-3 shrink-0 w-48 sm:w-52">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-all duration-100 shrink-0 select-none ${
                      isDownbeatFlash
                        ? 'bg-amber-400 text-zinc-950 scale-105 shadow-md shadow-amber-400/40 ring-1 ring-amber-300'
                        : isBeatPulse
                        ? 'bg-amber-500 text-zinc-950 scale-102 shadow-xs'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700/80'
                    }`}
                  >
                    {currentBeatInBar}
                  </div>
                  <div className="flex flex-col min-w-0 justify-center">
                    <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 truncate leading-tight">
                      <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">節拍指示 (Metronome)</span>
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 mt-1 whitespace-nowrap leading-tight">
                      {activeBpm} BPM · {activeTimeSignature} 拍
                    </span>
                  </div>
                </div>

                {/* Center: Fixed-location Beat Pods for full measure (Stationary position) */}
                <div className="flex items-center justify-center gap-2 flex-1">
                  {Array.from({ length: parseInt(activeTimeSignature.split('/')[0], 10) || 4 }).map((_, idx) => {
                    const beatNum = idx + 1;
                    const isCurrent = currentBeatInBar === beatNum;
                    const isDownbeat = beatNum === 1;
                    return (
                      <div
                        key={beatNum}
                        className={`flex items-center justify-center w-12 h-9 rounded-xl text-xs font-mono font-bold transition-all duration-100 select-none ${
                          isCurrent
                            ? isDownbeat
                              ? 'bg-amber-400 text-zinc-950 font-black ring-1 ring-amber-300 shadow-sm scale-105'
                              : 'bg-amber-500 text-zinc-950 font-black ring-1 ring-amber-400/50 scale-105'
                            : isDownbeat
                            ? 'bg-zinc-800/90 border border-amber-500/40 text-amber-400'
                            : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/60'
                        }`}
                      >
                        <span className="text-[10px] mr-1">{isDownbeat ? '★' : '•'}</span>
                        <span>{beatNum}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Right: Audio click toggle on the fly */}
                <div className="flex items-center justify-end shrink-0 w-32 sm:w-36">
                  <button
                    type="button"
                    onClick={() => setAudibleClickDuringRecording(!audibleClickDuringRecording)}
                    className={`flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap select-none ${
                      audibleClickDuringRecording
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                    }`}
                    title="切換錄音時是否發出提示音（視覺節拍燈將始終保持閃爍）"
                  >
                    {audibleClickDuringRecording ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>提示音：開</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>提示音：靜音</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* LIVE PITCH TUNER GAUGE */}
              <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl text-white flex flex-col gap-4 shadow-inner">
                {/* Note Solfège Display */}
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-amber-400 font-mono tracking-tight">
                      {activeSolfegInfo.noteNum}
                    </span>
                    {activeSolfegInfo.octaveDots !== 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300">
                        {activeSolfegInfo.octaveDots > 0
                          ? `+${activeSolfegInfo.octaveDots} 八度`
                          : `${activeSolfegInfo.octaveDots} 八度`}
                      </span>
                    )}
                    <span className="text-lg font-bold text-zinc-400">
                      {activeSolfegInfo.solfege}
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-xs font-mono font-bold text-zinc-400">
                      {currentPitchHz ? `${currentPitchHz.toFixed(1)} Hz` : '靜音 / 偵測中'}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        Math.abs(currentCents) <= 15
                          ? 'text-emerald-400'
                          : Math.abs(currentCents) <= 30
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {currentPitchHz ? `${currentCents > 0 ? '+' : ''}${currentCents} cents` : ''}
                    </span>
                  </div>
                </div>

                {/* Pitch Cents Deviation Needle Bar (-50 to +50 cents) */}
                <div className="flex flex-col gap-1.5">
                  <div className="relative w-full h-4 bg-zinc-800 rounded-full overflow-hidden flex items-center">
                    {/* Center zero line */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-zinc-400 z-10" />
                    {/* In-tune sweet zone (±15 cents) */}
                    <div className="absolute left-[35%] right-[35%] top-0 bottom-0 bg-emerald-500/20" />
                    {/* Dynamic needle */}
                    {isVoiced && (
                      <div
                        className="absolute top-0 bottom-0 w-2.5 rounded-full bg-amber-400 shadow-md transition-all duration-75"
                        style={{
                          left: `calc(${50 + (Math.max(-50, Math.min(50, currentCents)) / 50) * 45}% - 5px)`,
                        }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>-50 ¢ (低)</span>
                    <span className="text-emerald-400 font-bold">準 (0 ¢)</span>
                    <span>+50 ¢ (高)</span>
                  </div>
                </div>

                {/* Live Audio Oscilloscope Canvas */}
                <div className="w-full h-12 bg-zinc-950 rounded-xl overflow-hidden relative">
                  <canvas ref={canvasRef} width={600} height={48} className="w-full h-full" />
                </div>

                {/* Live Audio VU Level Meter & Real-time Gain Slider */}
                <div
                  id="hum-live-vu-and-gain"
                  className="flex flex-col gap-2 p-3 bg-zinc-950/80 border border-zinc-800 rounded-2xl"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-zinc-300">
                      <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-bold text-zinc-400">收音強度:</span>
                      <span
                        className={`font-bold ${
                          currentRms > 0.05
                            ? 'text-emerald-400'
                            : currentRms > 0.015
                            ? 'text-amber-400'
                            : 'text-zinc-500'
                        }`}
                      >
                        {Math.min(100, Math.round(currentRms * 250))}%
                      </span>
                      {currentRms < 0.015 && isVoiced === false && (
                        <span className="text-[10px] text-amber-400/90 ml-1">
                          (太小聲？請向右拉大增益)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-amber-400 font-bold">
                      <span>增益: {micGain.toFixed(1)}x</span>
                      <span className="text-[10px] text-zinc-500">
                        (+{(20 * Math.log10(micGain)).toFixed(1)}dB)
                      </span>
                    </div>
                  </div>

                  {/* VU Meter Bar */}
                  <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden flex border border-zinc-800">
                    <div
                      className="h-full transition-all duration-75 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, currentRms * 250))}%`,
                        backgroundColor:
                          currentRms > 0.35 ? '#ef4444' : currentRms > 0.15 ? '#f59e0b' : '#10b981',
                      }}
                    />
                  </div>

                  {/* Real-time gain adjustment slider during recording */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] font-bold text-zinc-400 shrink-0">即時調放大:</span>
                    <input
                      id="hum-live-gain-slider"
                      type="range"
                      min="1"
                      max="25"
                      step="0.5"
                      value={micGain}
                      onChange={e => handleMicGainChange(parseFloat(e.target.value))}
                      className="flex-1 accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                      title="即時增益放大滑桿 (1x ~ 25x)"
                    />
                    <button
                      type="button"
                      onClick={() => handleMicGainChange(Math.min(25, micGain + 3))}
                      className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg border border-amber-500/40 cursor-pointer active:scale-95 touch-manipulation"
                      title="一鍵增加 +3x"
                    >
                      +3x 加強
                    </button>
                  </div>
                </div>
              </div>

              {/* Rolling Transcribed Notes Feed */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-500" />
                  <span>即時辨識簡譜音符流水帶 (Real-time Streaming Notes)</span>
                </label>
                <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl min-h-[64px] overflow-x-auto">
                  {liveTranscribedNotes.length === 0 ? (
                    <span className="text-xs text-zinc-400 italic">
                      請開始哼唱或演奏，音符將即時出現在此處...
                    </span>
                  ) : (
                    liveTranscribedNotes.map((note, idx) => (
                      <div
                        key={`${note.id}-${idx}`}
                        className="flex items-center justify-center min-w-[36px] h-10 px-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-zinc-900 dark:text-zinc-100 font-mono font-bold text-sm"
                      >
                        <span>{note.pitch === 0 ? '0' : note.pitch}</span>
                        {note.octave !== 0 && (
                          <span className="text-[10px] text-amber-500 font-bold ml-0.5">
                            {note.octave > 0 ? '˙' : '.'}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Stop Recording Action */}
              <div className="flex justify-center pt-2">
                <button
                  id="hum-stop-recording-btn"
                  type="button"
                  onClick={handleStopRecording}
                  className="flex items-center gap-2 px-8 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-sm rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[44px]"
                >
                  <Square className="w-4 h-4 fill-current text-white" />
                  <span>完成錄音並轉譜 (Finish & Transcribe)</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: REVIEW & DUAL AUDIO PLAYBACK                                      */}
          {/* ========================================================================= */}
          {step === 'REVIEW' && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              {/* Summary Telemetry Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">轉譜結果：</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold">
                    {transcribedMeasures.length} 個小節
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
                    1 = {activeKey}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
                    {activeBpm} BPM
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold">
                    音準誤差 ±{accuracyCents} ¢
                  </span>
                </div>

                <button
                  id="hum-retake-btn"
                  type="button"
                  onClick={() => {
                    stopAllAudioPipelines();
                    setStep('SETUP');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                  <span>重新錄音 (Re-take)</span>
                </button>
              </div>

              {/* DUAL-TRACK AUDIO PLAYBACK COMPARISON */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-zinc-900 text-white rounded-2xl border border-zinc-800 shadow-sm">
                {/* TRACK 1: Raw Microphone Recording Playback */}
                <div className="flex flex-col gap-2 p-3 bg-zinc-950/80 rounded-xl border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Mic2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>軌道 1：麥克風原聲收音 (Mic)</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {micAudioDuration > 0 ? `${micAudioDuration.toFixed(1)}s` : ''}
                    </span>
                  </div>

                  {recordedAudioUrl ? (
                    <div className="flex items-center gap-2">
                      <button
                        id="hum-play-mic-btn"
                        type="button"
                        onClick={handleToggleMicPlay}
                        className="p-2.5 rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 font-bold transition-all cursor-pointer shrink-0"
                        title={isMicPlaying ? 'Pause mic recording' : 'Play mic recording'}
                      >
                        {isMicPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>
                      <span className="text-xs font-mono text-zinc-300">
                        {isMicPlaying ? '播放錄音中...' : '聆聽原始哼唱聲'}
                      </span>
                      {/* Hidden audio tag */}
                      <audio
                        ref={micAudioElementRef}
                        src={recordedAudioUrl}
                        onTimeUpdate={e =>
                          setMicAudioCurrentTime((e.target as HTMLAudioElement).currentTime)
                        }
                        onLoadedMetadata={e =>
                          setMicAudioDuration((e.target as HTMLAudioElement).duration)
                        }
                        onEnded={() => setIsMicPlaying(false)}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500 italic">無收音音訊檔</span>
                  )}
                </div>

                {/* TRACK 2: Synthesizer Score Preview */}
                <div className="flex flex-col gap-2 p-3 bg-zinc-950/80 rounded-xl border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>軌道 2：簡譜合成試聽 (Synth)</span>
                    </span>
                    <select
                      id="hum-synth-instrument-select"
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
                      id="hum-play-synth-btn"
                      type="button"
                      onClick={handleToggleSynthPlay}
                      className="p-2.5 rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 font-bold transition-all cursor-pointer shrink-0"
                      title={isSynthPlaying ? 'Stop synthesizer' : 'Play synthesizer score'}
                    >
                      {isSynthPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                    <span className="text-xs font-mono text-zinc-300">
                      {isSynthPlaying ? '合成樂器演奏中...' : '聆聽簡譜音高切分'}
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
                  id="hum-transcribed-measures-container"
                  className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-wrap items-center gap-3 min-h-[90px] overflow-x-auto"
                >
                  {transcribedMeasures.length === 0 ? (
                    <span className="text-xs text-zinc-400 italic">未偵測到足夠音符</span>
                  ) : (
                    transcribedMeasures.map((measure, mIdx) => (
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
                              className="scale-90"
                            />
                          ))}
                        </div>
                        <span className="text-zinc-400 dark:text-zinc-600 font-bold ml-1">|</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* QUICK FINE-TUNING CONTROLS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                {/* Octave Shift */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    八度微調 (Shift Octave)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      id="hum-octave-down-btn"
                      type="button"
                      onClick={() => handleOctaveShift(-1)}
                      className="p-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 rounded-lg text-xs font-bold cursor-pointer"
                      title="Shift down 1 octave"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-amber-500" />
                    </button>
                    <span className="text-xs font-mono font-bold px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex-1 text-center">
                      {octaveShiftVal === 0 ? '原八度' : `${octaveShiftVal > 0 ? '+' : ''}${octaveShiftVal} Oct`}
                    </span>
                    <button
                      id="hum-octave-up-btn"
                      type="button"
                      onClick={() => handleOctaveShift(1)}
                      className="p-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 rounded-lg text-xs font-bold cursor-pointer"
                      title="Shift up 1 octave"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-amber-500" />
                    </button>
                  </div>
                </div>

                {/* Re-Quantize Grid */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    重新量化 (Re-Quantize)
                  </label>
                  <div className="flex items-center gap-1">
                    {(['quarter', 'eighth', 'sixteenth'] as QuantizeGrid[]).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleGridChange(g)}
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

                {/* Accidental Preference */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    升降記號偏好 (Accidental)
                  </label>
                  <div className="flex items-center gap-1">
                    {(['auto', 'sharp', 'flat'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleAccidentalChange(p)}
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
                    id="hum-insert-mode-cursor-btn"
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
                    id="hum-insert-mode-append-btn"
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
                    id="hum-insert-mode-replace-btn"
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
                  id="hum-cancel-btn"
                  type="button"
                  onClick={() => {
                    stopAllAudioPipelines();
                    onClose();
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  取消
                </button>

                <button
                  id="hum-commit-btn"
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
