import { ArticulationType, GraceNote, InstrumentType, NumberedNotationNote, KeySignature, Measure, Song } from '@/types/song';
import { getChordNotes, getEffectiveMeasureChords, getMeasureChords, getPitchFrequency, isNonNotationItem, isSamePitch, isSlurActive, isTieActive } from './taigiUtils';

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentMeasureIndex: number;
  currentNoteIndex: number;
  currentNoteId: string | null;
  currentTime: number;
  totalDuration: number;
  progressPercent: number;
}

export interface LoopRange {
  startMeasure: number;
  endMeasure: number;
}

export interface AudioEngineOptions {
  instrument?: InstrumentType;
  melodyVolume?: number;    // 0 to 1
  backingVolume?: number;   // 0 to 1 (chord accompaniment volume)
  chordEnabled?: boolean;   // chord accompaniment toggle (default true)
  metronomeVolume?: number; // 0 to 1
  transpose?: number;       // Semitones (-12 to +12)
  tempoMultiplier?: number; // 0.5 to 2.0
  loopMeasure?: number | null; // index of measure to loop, or null
  loopRange?: LoopRange | null; // A-B loop range, or null
  targetFps?: number;       // Target frame rate for UI updates (e.g. 30 normal, 20 eco)
  ecoMode?: boolean;        // 1-osc melody, downbeat-only metronome, thinned chords, lookahead scheduler
}

export type PlaybackEndedReason = 'song' | 'preview';

interface PendingMelodyEvent {
  songTime: number;
  note: NumberedNotationNote;
  soundDuration: number;
  isSlurred: boolean;
}

interface PendingBeatEvent {
  songTime: number;
  isDownbeat: boolean;
  chord: string | null;
  isChordChange: boolean;
  beatDuration: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private melodyGain: GainNode | null = null;
  private backingGain: GainNode | null = null;
  private backingFilter: BiquadFilterNode | null = null;
  private metronomeGain: GainNode | null = null;

  private currentSong: Song | null = null;
  private options: Required<AudioEngineOptions> = {
    instrument: 'piano',
    melodyVolume: 0.85,
    backingVolume: 0.6,
    chordEnabled: true,
    metronomeVolume: 0.45,
    transpose: 0,
    tempoMultiplier: 1.0,
    loopMeasure: null,
    loopRange: null,
    targetFps: 30,
    ecoMode: false,
  };

  private isPlaying = false;
  private isPaused = false;
  private startAudioTime = 0;
  private pausedSongTime = 0;
  private animationFrameId: number | null = null;
  private scheduledTimeoutIds: number[] = [];
  private scheduledCancels: Array<() => void> = [];
  private activeOscillators: OscillatorNode[] = [];
  private activeSustainedVoices: Map<
    string,
    {
      oscillators: OscillatorNode[];
      gainNodes: GainNode[];
      gainMaster: GainNode;
      stopTimeoutId?: ReturnType<typeof setTimeout>;
    }
  > = new Map();
  private idleSuspendTimer: ReturnType<typeof setTimeout> | null = null;
  private trackingTimerId: ReturnType<typeof setTimeout> | null = null;
  private schedulerTimerId: ReturnType<typeof setTimeout> | null = null;
  private pendingMelodyEvents: PendingMelodyEvent[] = [];
  private pendingBeatEvents: PendingBeatEvent[] = [];
  private melodyScheduleCursor = 0;
  private beatScheduleCursor = 0;
  private playbackEndedReason: PlaybackEndedReason = 'song';

  private static readonly AUDIO_LOOKAHEAD_SEC = 0.32;
  private static readonly SCHEDULER_INTERVAL_MS = 50;

  // Listeners
  private stateListeners: ((state: PlaybackState) => void)[] = [];
  private endedListeners: ((info: { reason: PlaybackEndedReason }) => void)[] = [];
  private tabInterruptionListeners: ((info: { pausedAtTime: number }) => void)[] = [];
  public onNoteStart?: (measureIndex: number, noteIndex: number, note: NumberedNotationNote, durationSec: number) => void;
  public onMeasureStart?: (measureIndex: number) => void;
  public onLoopIteration?: (iterationCount: number) => void;
  private currentLoopIteration = 0;

  private wasInterruptedByTabSwitch = false;
  private interruptedSongTime = 0;
  private isBackgrounded = false;
  private interruptionDispatchPending = false;

  private currentState: PlaybackState = {
    isPlaying: false,
    isPaused: false,
    currentMeasureIndex: 0,
    currentNoteIndex: 0,
    currentNoteId: null,
    currentTime: 0,
    totalDuration: 0,
    progressPercent: 0,
  };

  public getState(): PlaybackState {
    return this.currentState;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getCurrentSong(): Song | null {
    return this.currentSong;
  }

  public subscribeState(listener: (state: PlaybackState) => void): () => void {
    this.stateListeners.push(listener);
    if (this.isPlaying || this.isPaused) {
      listener(this.currentState);
    }
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  public subscribeEnded(listener: (info: { reason: PlaybackEndedReason }) => void): () => void {
    this.endedListeners.push(listener);
    return () => {
      this.endedListeners = this.endedListeners.filter(l => l !== listener);
    };
  }

  public subscribeTabInterruption(listener: (info: { pausedAtTime: number }) => void): () => void {
    this.tabInterruptionListeners.push(listener);
    return () => {
      this.tabInterruptionListeners = this.tabInterruptionListeners.filter(l => l !== listener);
    };
  }

  public getWasInterrupted(): boolean {
    return this.wasInterruptedByTabSwitch;
  }

  public clearInterruption(): void {
    this.wasInterruptedByTabSwitch = false;
  }

  public setLoopIterationListener(callback?: (iterationCount: number) => void) {
    this.onLoopIteration = callback;
  }

  private notifyState(state: PlaybackState) {
    this.currentState = state;
    this.stateListeners.forEach(l => l(state));
  }

  private notifyEnded() {
    const reason = this.playbackEndedReason;
    this.endedListeners.forEach(l => l({ reason }));
  }

  /**
   * Transparent iOS Web Audio unlocker triggered on first user interaction.
   * Plays a 1ms inaudible buffer to wake up the iOS/iPadOS audio mixer if interrupted.
   */
  public unlockOnUserGesture = () => {
    if (typeof window === 'undefined') return;

    if (!this.ctx || this.ctx.state === 'closed') {
      this.initContext();
    }
    if (!this.ctx) return;

    const state = this.ctx.state as string;
    if (state !== 'suspended' && state !== 'interrupted') {
      if (!this.isPlaying) {
        this.scheduleAutoSuspend(3000);
      }
      return;
    }

    this.ctx.resume().catch(() => {});

    try {
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
    } catch {
      // ignore
    }

    if (!this.isPlaying) {
      this.scheduleAutoSuspend(3000);
    }
  };

  constructor() {
    // AudioContext and lifecycle management
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // Document visibility change (switching tabs, minimizing browser, screen lock)
      document.addEventListener('visibilitychange', this.handleVisibilityChange);

      // Mobile Safari / iPadOS Page Lifecycle events
      window.addEventListener('pageshow', this.handlePageShow);
      window.addEventListener('pagehide', this.handlePageHide);
      window.addEventListener('focus', this.handleWindowFocus);
      window.addEventListener('blur', this.handleWindowBlur);

      // Global iOS Safari audio unlock on user gesture (passive, capture)
      window.addEventListener('pointerdown', this.unlockOnUserGesture, { capture: true, passive: true });
      window.addEventListener('touchstart', this.unlockOnUserGesture, { capture: true, passive: true });
      window.addEventListener('keydown', this.unlockOnUserGesture, { capture: true, passive: true });

      // Initialize persistent volume & chord settings if available
      try {
        const savedChord = localStorage.getItem('taigi_composer_chord_enabled');
        if (savedChord !== null) {
          this.options.chordEnabled = savedChord === 'true';
        }
        const savedBacking = localStorage.getItem('taigi_composer_backing_volume');
        if (savedBacking !== null) {
          const num = parseFloat(savedBacking);
          if (!isNaN(num) && num >= 0 && num <= 1) {
            this.options.backingVolume = num;
          }
        }
      } catch {}
    }
  }

  private handleVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.handleLeavingTab();
    } else {
      this.handleReturningToTab();
    }
  };

  private handlePageHide = () => {
    this.handleLeavingTab();
  };

  private handlePageShow = () => {
    if (typeof document !== 'undefined' && !document.hidden) {
      this.handleReturningToTab();
    }
  };

  private handleWindowFocus = () => {
    if (typeof document !== 'undefined' && !document.hidden && this.isPlaying) {
      this.ensureContextActive().catch(() => {});
    }
  };

  private handleWindowBlur = () => {
    if (!this.isPlaying) {
      this.scheduleAutoSuspend(500);
    }
  };

  private handleLeavingTab = () => {
    if (this.isBackgrounded) return;
    this.isBackgrounded = true;
    this.cancelAutoSuspend();

    if (this.isPlaying) {
      // Accurately capture current playback timestamp before iOS freezes timers
      const currentPos = this.getCurrentPlaybackTime();
      this.interruptedSongTime = currentPos;
      this.pausedSongTime = currentPos;
      this.wasInterruptedByTabSwitch = true;
      this.interruptionDispatchPending = true;

      // Cleanly stop scheduled audio oscillators and animation frame
      this.isPlaying = false;
      this.isPaused = true;
      this.stopAudioNodes();
      this.cancelTrackingLoop();
      this.clearPlaybackSchedule();
      this.scheduledTimeoutIds.forEach(id => clearTimeout(id));
      this.scheduledTimeoutIds = [];

      const duration = this.currentSong ? this.calculateSongDuration(this.currentSong) : 0;
      const loc = this.currentSong
        ? this.getPlaybackLocationAtTime(this.currentSong, currentPos)
        : {
            measureIndex: this.currentState.currentMeasureIndex,
            noteIndex: this.currentState.currentNoteIndex,
            noteId: this.currentState.currentNoteId,
          };

      this.notifyState({
        isPlaying: false,
        isPaused: true,
        currentMeasureIndex: loc.measureIndex,
        currentNoteIndex: loc.noteIndex,
        currentNoteId: loc.noteId,
        currentTime: currentPos,
        totalDuration: duration,
        progressPercent: duration > 0 ? (currentPos / duration) * 100 : 0,
      });
    }

    // Cleanly suspend context to release iPad audio hardware session
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  };

  private handleReturningToTab = () => {
    if (!this.isBackgrounded) {
      if (this.isPlaying) {
        this.ensureContextActive().catch(() => {});
      }
      return;
    }
    this.isBackgrounded = false;

    if (!this.ctx || this.ctx.state === 'closed') {
      this.initContext(true);
    } else {
      const state = this.ctx.state as string;
      if (state === 'suspended' || state === 'interrupted') {
        this.ctx.resume().catch(() => {});
      }
    }

    if (this.interruptionDispatchPending) {
      this.interruptionDispatchPending = false;
      const pausedAt = this.interruptedSongTime;
      this.tabInterruptionListeners.forEach(listener => {
        try {
          listener({ pausedAtTime: pausedAt });
        } catch {}
      });
    }

    if (!this.isPlaying) {
      this.scheduleAutoSuspend(3000);
    }
  };

  /**
   * Schedule automatic AudioContext suspension after inactivity (e.g. 3000ms)
   * Prevents mobile/iPad audio DSP hardware from draining battery when idle.
   */
  public scheduleAutoSuspend(delayMs = 3000) {
    this.cancelAutoSuspend();
    if (typeof window === 'undefined') return;
    this.idleSuspendTimer = setTimeout(() => {
      if (!this.isPlaying && this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    }, delayMs);
  }

  /**
   * Cancel pending auto-suspension timer
   */
  public cancelAutoSuspend() {
    if (this.idleSuspendTimer) {
      clearTimeout(this.idleSuspendTimer);
      this.idleSuspendTimer = null;
    }
  }

  /**
   * Initializes or recreates the AudioContext with proper graph wiring.
   * If forceRecreate is true or the context was closed, a fresh AudioContext is spawned.
   */
  public initContext(forceRecreate = false) {
    if (typeof window === 'undefined') return;
    this.cancelAutoSuspend();

    if (forceRecreate && this.ctx) {
      try {
        this.ctx.close().catch(() => {});
      } catch {}
      this.ctx = null;
    }

    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      try {
        this.ctx = new AudioCtx();
      } catch (err) {
        console.warn('[AudioEngine] Failed to instantiate AudioContext:', err);
        return;
      }

      try {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.melodyGain = this.ctx.createGain();
        this.melodyGain.gain.setValueAtTime(this.options.melodyVolume, this.ctx.currentTime);
        this.melodyGain.connect(this.masterGain);

        this.backingFilter = this.ctx.createBiquadFilter();
        this.backingFilter.type = 'lowpass';
        this.backingFilter.frequency.setValueAtTime(1600, this.ctx.currentTime);
        this.backingFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

        this.backingGain = this.ctx.createGain();
        const effectiveBacking = this.options.chordEnabled !== false ? this.options.backingVolume : 0;
        this.backingGain.gain.setValueAtTime(effectiveBacking, this.ctx.currentTime);
        this.backingFilter.connect(this.backingGain);
        this.backingGain.connect(this.masterGain);

        this.metronomeGain = this.ctx.createGain();
        this.metronomeGain.gain.setValueAtTime(this.options.metronomeVolume, this.ctx.currentTime);
        this.metronomeGain.connect(this.masterGain);
      } catch (e) {
        console.warn('[AudioEngine] Gain node initialization warning:', e);
      }
    } else if (this.ctx && this.masterGain) {
      if (!this.metronomeGain) {
        try {
          this.metronomeGain = this.ctx.createGain();
          this.metronomeGain.gain.setValueAtTime(this.options.metronomeVolume, this.ctx.currentTime);
          this.metronomeGain.connect(this.masterGain);
        } catch {}
      }
    }

    const state = this.ctx.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Ensures AudioContext is active and ready to produce sound.
   * Handles iOS / iPadOS WebKit 'interrupted' state and closed state recovery.
   */
  public async ensureContextActive(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    this.cancelAutoSuspend();

    if (!this.ctx || this.ctx.state === 'closed') {
      this.initContext(true);
    }
    if (!this.ctx) return false;

    const state = this.ctx.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('[AudioEngine] ctx.resume() waiting for user interaction:', err);
        return false;
      }
    }

    return (this.ctx.state as string) === 'running';
  }

  /**
   * Accurately calculates current playback time in seconds
   */
  public getCurrentPlaybackTime(): number {
    if (!this.ctx) return this.pausedSongTime || 0;
    if (!this.isPlaying) return this.pausedSongTime || 0;

    const rawSongTime = this.ctx.currentTime - this.startAudioTime;
    const targetStart = this.pausedSongTime || 0;
    const currentSongTime =
      rawSongTime < targetStart
        ? Math.max(0, targetStart)
        : Math.max(0, rawSongTime);

    const total = this.currentSong ? this.calculateSongDuration(this.currentSong) : 0;
    return total > 0 ? Math.min(Math.max(0, currentSongTime), total) : Math.max(0, currentSongTime);
  }

  public setOptions(opts: Partial<AudioEngineOptions>) {
    const prevInstrument = this.options.instrument;
    this.options = { ...this.options, ...opts };
    if (this.ctx) {
      if (this.melodyGain && this.options.melodyVolume !== undefined) {
        this.melodyGain.gain.setValueAtTime(this.options.melodyVolume, this.ctx.currentTime);
      }
      if (this.backingGain && (this.options.backingVolume !== undefined || this.options.chordEnabled !== undefined)) {
        const effectiveBacking = this.options.chordEnabled !== false ? this.options.backingVolume : 0;
        this.backingGain.gain.setValueAtTime(effectiveBacking, this.ctx.currentTime);
      }
      if (this.metronomeGain && this.options.metronomeVolume !== undefined) {
        this.metronomeGain.gain.setValueAtTime(this.options.metronomeVolume, this.ctx.currentTime);
      }
    }
    // Seamlessly re-seek if primary instrument changed during active playback so subsequent notes use the new sound tone
    if (opts.instrument && opts.instrument !== prevInstrument && this.isPlaying && this.currentSong) {
      const curTime = this.getCurrentPlaybackTime();
      this.seek(this.currentSong, curTime);
    }
  }

  public getOptions(): Required<AudioEngineOptions> {
    return { ...this.options };
  }

  /**
   * Play a quick audition tone for a given instrument (e.g. Do / tonic note)
   */
  public previewInstrumentTone(key: KeySignature = 'C', instrument?: InstrumentType) {
    const inst = instrument || this.options.instrument;
    const testNote: NumberedNotationNote = {
      id: `preview-inst-${inst}`,
      pitch: 1,
      octave: 0,
      duration: 1,
      lyric: { hanlo: '音' },
      instrument: inst,
    };
    this.previewNote(key, testNote);
  }

  /**
   * Play a single preview note (e.g. clicking a note in the editor)
   */
  public previewNote(key: KeySignature, note: NumberedNotationNote) {
    if (isNonNotationItem(note)) return; // Punctuation, annotations, and whitespace produce no sound
    this.initContext();
    if (!this.ctx || !this.melodyGain) return;

    const freq = getPitchFrequency(key, note.pitch, note.octave, note.accidental, this.options.transpose);
    if (freq <= 0) return;

    const effectiveBpm = 80 * this.options.tempoMultiplier;
    const durationSec = (note.duration * (60 / effectiveBpm));
    const playDuration = Math.min(durationSec, 1.4);

    this.playMelodyNoteWithDetails(
      key,
      note,
      this.ctx.currentTime,
      playDuration,
      this.melodyGain,
      note.instrument || this.options.instrument,
      { isPreview: true }
    );

    // Auto suspend AudioContext after preview note finishes to power down audio hardware
    this.scheduleAutoSuspend(Math.round((playDuration + 2.0) * 1000));
  }

  /**
   * Start playing a sustained musical note (for live screen piano, QWERTY typing, or Web MIDI).
   * Holds the note steadily for as long as the key is depressed, and smoothly releases when stopSustainedNote is called.
   */
  public startSustainedNote(
    key: KeySignature,
    note: NumberedNotationNote,
    voiceId: string,
    instrument?: InstrumentType
  ): void {
    if (isNonNotationItem(note)) return;
    this.initContext();
    if (!this.ctx || !this.melodyGain) return;
    this.cancelAutoSuspend();

    // If this voice is already singing, release old instance first
    this.stopSustainedNote(voiceId, 0.03);

    const freq = getPitchFrequency(key, note.pitch, note.octave, note.accidental, this.options.transpose);
    if (freq <= 0) return;

    const chosenInstrument = instrument || note.instrument || this.options.instrument || 'piano';
    const startTime = this.ctx.currentTime;
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, startTime);

    const volMul = 1.0;
    const mainOsc = this.ctx.createOscillator();
    this.registerOscillator(mainOsc);
    oscs.push(mainOsc);

    switch (chosenInstrument) {
      case 'piano': {
        const pianoFilter = this.ctx.createBiquadFilter();
        pianoFilter.type = 'lowpass';
        pianoFilter.frequency.setValueAtTime(Math.min(5000, Math.max(1400, freq * 3.8)), startTime);
        pianoFilter.Q.setValueAtTime(1.2, startTime);
        pianoFilter.frequency.exponentialRampToValueAtTime(
          Math.max(250, freq * 1.5),
          startTime + 0.35
        );

        // String 1 (center trichord string)
        mainOsc.type = 'triangle';
        mainOsc.frequency.setValueAtTime(freq, startTime);
        mainOsc.connect(pianoFilter);

        // String 2 (detuned by +2.5 cents for realistic grand piano multi-string chorus shimmer)
        const str2 = this.ctx.createOscillator();
        this.registerOscillator(str2);
        oscs.push(str2);
        str2.type = 'triangle';
        str2.frequency.setValueAtTime(freq * 1.0015, startTime);
        str2.connect(pianoFilter);
        str2.start(startTime);

        // 2nd Harmonic (Octave string partial)
        const harm2 = this.ctx.createOscillator();
        this.registerOscillator(harm2);
        oscs.push(harm2);
        const harm2Gain = this.ctx.createGain();
        gains.push(harm2Gain);
        harm2.type = 'sine';
        harm2.frequency.setValueAtTime(freq * 2, startTime);
        harm2Gain.gain.setValueAtTime(0.35 * volMul, startTime);
        harm2Gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.3);
        harm2.connect(harm2Gain);
        harm2Gain.connect(voiceGain);
        harm2.start(startTime);

        // Hammer felt strike percussive knock
        const hammer = this.ctx.createOscillator();
        this.registerOscillator(hammer);
        oscs.push(hammer);
        const hammerGain = this.ctx.createGain();
        gains.push(hammerGain);
        hammer.type = 'sine';
        hammer.frequency.setValueAtTime(180, startTime);
        hammer.frequency.exponentialRampToValueAtTime(60, startTime + 0.025);
        hammerGain.gain.setValueAtTime(0.4 * volMul, startTime);
        hammerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.028);
        hammer.connect(hammerGain);
        hammerGain.connect(voiceGain);
        hammer.start(startTime);

        // Main acoustic envelope: crisp hammer strike attack (3ms), settling to steady sustain floor
        pianoFilter.connect(voiceGain);
        voiceGain.gain.setValueAtTime(0.0001, startTime);
        voiceGain.gain.linearRampToValueAtTime(0.85 * volMul, startTime + 0.004);
        voiceGain.gain.exponentialRampToValueAtTime(0.48 * volMul, startTime + 0.12);
        // Very slow natural acoustic piano string energy decay while held (up to 15s)
        voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.05, 0.22 * volMul), startTime + 10.0);
        break;
      }
      case 'flute': {
        mainOsc.type = 'sine';
        mainOsc.frequency.setValueAtTime(freq, startTime);

        const oddHarm = this.ctx.createOscillator();
        this.registerOscillator(oddHarm);
        oscs.push(oddHarm);
        const oddGain = this.ctx.createGain();
        gains.push(oddGain);
        oddHarm.type = 'sine';
        oddHarm.frequency.setValueAtTime(freq * 3, startTime);
        oddGain.gain.setValueAtTime(0.16 * volMul, startTime);
        oddHarm.connect(oddGain);
        oddGain.connect(voiceGain);
        oddHarm.start(startTime);

        mainOsc.connect(voiceGain);
        voiceGain.gain.setValueAtTime(0.0001, startTime);
        voiceGain.gain.linearRampToValueAtTime(0.7 * volMul, startTime + 0.035);
        break;
      }
      case 'guitar': {
        mainOsc.type = 'sawtooth';
        mainOsc.frequency.setValueAtTime(freq, startTime);

        const pluckFilter = this.ctx.createBiquadFilter();
        pluckFilter.type = 'lowpass';
        pluckFilter.frequency.setValueAtTime(Math.min(4500, freq * 4.5), startTime);
        pluckFilter.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.2), startTime + 0.3);

        mainOsc.connect(pluckFilter);
        pluckFilter.connect(voiceGain);

        voiceGain.gain.setValueAtTime(0.0001, startTime);
        voiceGain.gain.linearRampToValueAtTime(0.85 * volMul, startTime + 0.005);
        voiceGain.gain.exponentialRampToValueAtTime(0.38 * volMul, startTime + 0.15);
        break;
      }
      default: {
        mainOsc.type = 'triangle';
        mainOsc.frequency.setValueAtTime(freq, startTime);
        mainOsc.connect(voiceGain);

        voiceGain.gain.setValueAtTime(0.0001, startTime);
        voiceGain.gain.linearRampToValueAtTime(0.75 * volMul, startTime + 0.01);
        break;
      }
    }

    voiceGain.connect(this.melodyGain);
    mainOsc.start(startTime);

    // Ultimate hardware safety ceiling: stop oscillators after 25s to guarantee no infinite hanging voices
    const MAX_SUSTAIN_HARDWARE_LIMIT_SEC = 25.0;
    for (const osc of oscs) {
      try {
        osc.stop(startTime + MAX_SUSTAIN_HARDWARE_LIMIT_SEC);
      } catch {}
    }

    this.activeSustainedVoices.set(voiceId, {
      oscillators: oscs,
      gainNodes: gains,
      gainMaster: voiceGain,
    });
  }

  /**
   * Smoothly release and stop a sustained note voice when key is released.
   */
  public stopSustainedNote(voiceId: string, releaseTimeSec: number = 0.08): void {
    const voice = this.activeSustainedVoices.get(voiceId);
    if (!voice || !this.ctx) return;
    this.activeSustainedVoices.delete(voiceId);

    const now = this.ctx.currentTime;
    try {
      if (typeof (voice.gainMaster.gain as any).cancelAndHoldAtTime === 'function') {
        (voice.gainMaster.gain as any).cancelAndHoldAtTime(now);
      } else {
        voice.gainMaster.gain.cancelScheduledValues(now);
        const currentGain = Math.max(0.0001, voice.gainMaster.gain.value);
        voice.gainMaster.gain.setValueAtTime(currentGain, now);
      }
      // Linear ramp to absolute silence guarantees no RangeError and smooth click-free release
      voice.gainMaster.gain.linearRampToValueAtTime(0.00001, now + releaseTimeSec);
      voice.gainMaster.gain.setValueAtTime(0, now + releaseTimeSec + 0.01);
    } catch {
      try {
        voice.gainMaster.gain.setValueAtTime(0, now);
      } catch {}
    }

    // Schedule stop on Web Audio rendering thread immediately so hardware sound cuts at exact release time
    const oscStopTime = now + releaseTimeSec + 0.03;
    for (const osc of voice.oscillators) {
      try {
        osc.stop(oscStopTime);
      } catch {}
    }

    // Clean up nodes after release is complete
    const stopDelayMs = Math.ceil(releaseTimeSec * 1000) + 40;
    setTimeout(() => {
      for (const osc of voice.oscillators) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {}
      }
      for (const gn of voice.gainNodes) {
        try {
          gn.disconnect();
        } catch {}
      }
      try {
        voice.gainMaster.disconnect();
      } catch {}
    }, stopDelayMs);

    if (this.activeSustainedVoices.size === 0) {
      this.scheduleAutoSuspend(3000);
    }
  }

  /**
   * Stop and release all active sustained keyboard/MIDI voice notes immediately.
   */
  public stopAllSustainedNotes(): void {
    if (this.activeSustainedVoices.size === 0) return;
    const voiceIds = Array.from(this.activeSustainedVoices.keys());
    for (const voiceId of voiceIds) {
      this.stopSustainedNote(voiceId, 0.04);
    }
    this.activeSustainedVoices.clear();
  }

  /**
   * Preview a chord sound instantly when selecting from the chord palette
   */
  public previewChord(chordName: string) {
    if (!chordName) return;
    this.initContext();
    if (!this.ctx || !this.backingGain) return;
    const now = this.ctx.currentTime;
    this.playChordBeat(chordName, now, 0.7, true);
    this.scheduleAutoSuspend(2500);
  }

  /**
   * Play a metronome click instantly (for count-in lead-in or recording tempo grid)
   */
  public playMetronomeTick(isDownbeat = false) {
    this.initContext();
    if (!this.ctx || !this.metronomeGain) return;
    this.playMetronomeClick(this.ctx.currentTime, isDownbeat);
    this.scheduleAutoSuspend(2000);
  }

  public getAudioContextState(): AudioContextState | 'none' {
    return this.ctx?.state ?? 'none';
  }

  public getAudioContextTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /**
   * Schedule a metronome click at an AudioContext time. Does not auto-suspend;
   * the caller owns the recording / count-in session lifetime.
   */
  public scheduleMetronomeTick(when: number, isDownbeat = false) {
    this.initContext();
    if (!this.ctx || !this.metronomeGain) return;
    this.cancelAutoSuspend();
    this.playMetronomeClick(when, isDownbeat);
  }

  /**
   * Fire `cb` at (or immediately after) an AudioContext time using a silent oscillator.
   * Falls back to setTimeout if the context cannot schedule.
   */
  public scheduleAudioCallback(when: number, cb: () => void): () => void {
    this.initContext();
    if (!this.ctx) {
      const id = setTimeout(cb, 0);
      return () => clearTimeout(id);
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (!Number.isFinite(when) || when <= now + 0.004) {
      const id = setTimeout(cb, 0);
      return () => clearTimeout(id);
    }

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      cb();
    };

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.onended = () => fire();
      osc.start(when);
      osc.stop(when + 0.001);
      return () => {
        fired = true;
        osc.onended = null;
        try {
          osc.stop();
        } catch {
          // already stopped
        }
      };
    } catch {
      const id = setTimeout(fire, Math.max(0, (when - now) * 1000));
      return () => {
        fired = true;
        clearTimeout(id);
      };
    }
  }

  private registerOscillator(osc: OscillatorNode) {
    this.activeOscillators.push(osc);
    osc.onended = () => {
      this.activeOscillators = this.activeOscillators.filter(o => o !== osc);
    };
  }

  /**
   * Synthesize a melody note including pre-grace notes, main tone with articulations, and post-grace notes.
   */
  private playMelodyNoteWithDetails(
    key: KeySignature,
    note: NumberedNotationNote,
    scheduleAt: number,
    noteDurationSec: number,
    destination: GainNode,
    instrument: InstrumentType,
    options?: {
      isLegato?: boolean;
      isPreview?: boolean;
      glideFromFreq?: number;
    }
  ) {
    if (!this.ctx || noteDurationSec <= 0) return;

    const mainFreq = getPitchFrequency(
      key,
      note.pitch,
      note.octave,
      note.accidental,
      this.options.transpose
    );
    if (mainFreq <= 0) return;

    const preGrace = (note.preGraceNotes || []).slice(0, 3);
    const postGrace = (note.postGraceNotes || []).slice(0, 3);

    // Calculate ornament time slices
    const maxOrnamentPortion = Math.min(0.24, noteDurationSec * 0.4);
    const preCount = preGrace.length;
    const postCount = postGrace.length;
    const totalCount = preCount + postCount;

    const graceNoteDur = totalCount > 0
      ? Math.min(0.07, maxOrnamentPortion / totalCount)
      : 0;

    const totalPreDur = preCount * graceNoteDur;
    const totalPostDur = postCount * graceNoteDur;
    const mainDur = Math.max(0.05, noteDurationSec - totalPreDur - totalPostDur);

    // 1. Play Pre-Grace Notes (前裝飾音 / 前倚音)
    preGrace.forEach((g, idx) => {
      const gFreq = getPitchFrequency(key, g.pitch, g.octave, g.accidental, this.options.transpose);
      if (gFreq > 0) {
        this.playTone(
          gFreq,
          scheduleAt + idx * graceNoteDur,
          graceNoteDur * 0.95,
          destination,
          instrument,
          { isLegato: true, volumeMultiplier: 0.82 }
        );
      }
    });

    // 2. Play Main Note with articulation & portamento
    const mainStartTime = scheduleAt + totalPreDur;
    let glideFreq = options?.glideFromFreq;
    if (note.articulation === 'portamento_up') {
      glideFreq = mainFreq * 0.89; // Glide up from ~2 semitones below
    } else if (note.articulation === 'portamento_down') {
      glideFreq = mainFreq * 1.12; // Glide down from ~2 semitones above
    }

    this.playTone(
      mainFreq,
      mainStartTime,
      mainDur,
      destination,
      instrument,
      {
        isLegato: options?.isLegato || preCount > 0 || postCount > 0,
        articulation: note.articulation,
        glideFromFreq: glideFreq,
      }
    );

    // 3. Play Post-Grace Notes (後裝飾音 / 尾裝飾音)
    postGrace.forEach((g, idx) => {
      const gFreq = getPitchFrequency(key, g.pitch, g.octave, g.accidental, this.options.transpose);
      if (gFreq > 0) {
        this.playTone(
          gFreq,
          scheduleAt + totalPreDur + mainDur + idx * graceNoteDur,
          graceNoteDur * 0.95,
          destination,
          instrument,
          { isLegato: true, volumeMultiplier: 0.82 }
        );
      }
    });
  }

  private cancelTrackingLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.trackingTimerId !== null) {
      clearTimeout(this.trackingTimerId);
      this.trackingTimerId = null;
    }
  }

  private playTone(
    freq: number,
    startTime: number,
    duration: number,
    destination: GainNode,
    instrument: InstrumentType,
    options?: {
      isLegato?: boolean;
      articulation?: ArticulationType;
      volumeMultiplier?: number;
      glideFromFreq?: number;
    }
  ) {
    if (!this.ctx || freq <= 0) return;

    let effectiveDuration = duration;
    let volMul = options?.volumeMultiplier ?? 1.0;
    const isLegato = options?.isLegato ?? false;

    if (options?.articulation === 'staccato') {
      effectiveDuration = Math.max(0.06, duration * 0.45);
    } else if (options?.articulation === 'fermata') {
      effectiveDuration = duration * 1.75;
    } else if (options?.articulation === 'accent') {
      volMul *= 1.35;
    }

    const osc = this.ctx.createOscillator();
    this.registerOscillator(osc);
    const gain = this.ctx.createGain();
    let outputNode: AudioNode = osc;

    if (options?.glideFromFreq && options.glideFromFreq > 0) {
      osc.frequency.setValueAtTime(options.glideFromFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq, startTime + Math.min(0.08, effectiveDuration * 0.5));
    }

    // Eco: one oscillator, no filter / extra partials / LFO. Cuts the iPad audio graph ~4x.
    if (this.options.ecoMode) {
      osc.type = instrument === 'flute' || instrument === 'whistle' ? 'sine' : 'triangle';
      if (!options?.glideFromFreq) {
        osc.frequency.setValueAtTime(freq, startTime);
      }
      gain.gain.setValueAtTime(0.0001, startTime);
      const ecoAttack = isLegato ? 0.016 : 0.008;
      gain.gain.linearRampToValueAtTime(0.78 * volMul, startTime + ecoAttack);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(startTime);
      osc.stop(startTime + effectiveDuration + 0.05);
      return;
    }

    switch (instrument) {
      case 'piano': {
        // True acoustic piano synthesis with dual detuned string chorusing, hammer felt strike transient, and soundboard lowpass filter
        const pianoFilter = this.ctx.createBiquadFilter();
        pianoFilter.type = 'lowpass';
        pianoFilter.frequency.setValueAtTime(Math.min(5000, Math.max(1400, freq * 3.8)), startTime);
        pianoFilter.Q.setValueAtTime(1.2, startTime);
        pianoFilter.frequency.exponentialRampToValueAtTime(
          Math.max(250, freq * 1.4),
          startTime + Math.min(0.2, effectiveDuration * 0.5)
        );

        // String 1 (center trichord string)
        osc.type = 'triangle';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }
        osc.connect(pianoFilter);

        // String 2 (detuned by +2.5 cents for realistic grand piano multi-string chorus shimmer)
        const str2 = this.ctx.createOscillator();
        this.registerOscillator(str2);
        str2.type = 'triangle';
        str2.frequency.setValueAtTime(freq * 1.0015, startTime);
        str2.connect(pianoFilter);
        str2.start(startTime);
        str2.stop(startTime + effectiveDuration + 0.08);

        // 2nd Harmonic (Octave string partial that decays faster than fundamental)
        const harm2 = this.ctx.createOscillator();
        this.registerOscillator(harm2);
        const harm2Gain = this.ctx.createGain();
        harm2.type = 'sine';
        harm2.frequency.setValueAtTime(freq * 2, startTime);
        harm2Gain.gain.setValueAtTime(0.35 * volMul, startTime);
        harm2Gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.min(0.18, effectiveDuration * 0.45));
        harm2.connect(harm2Gain);
        harm2Gain.connect(gain);
        harm2.start(startTime);
        harm2.stop(startTime + effectiveDuration + 0.08);

        // Hammer felt strike percussive knock (crisp initial hammer contact thunk)
        const hammer = this.ctx.createOscillator();
        this.registerOscillator(hammer);
        const hammerGain = this.ctx.createGain();
        hammer.type = 'sine';
        hammer.frequency.setValueAtTime(180, startTime);
        hammer.frequency.exponentialRampToValueAtTime(60, startTime + 0.025);
        hammerGain.gain.setValueAtTime(0.4 * volMul, startTime);
        hammerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.028);
        hammer.connect(hammerGain);
        hammerGain.connect(gain);
        hammer.start(startTime);
        hammer.stop(startTime + 0.04);

        // Main envelope: crisp hammer strike (3ms) dropping to singing sustain, then exponential piano string tail
        outputNode = pianoFilter;
        gain.gain.setValueAtTime(0.0001, startTime);
        const pianoAttack = isLegato ? 0.015 : 0.003;
        gain.gain.linearRampToValueAtTime(0.85 * volMul, startTime + pianoAttack);
        const strikeDropTime = startTime + Math.min(0.14, effectiveDuration * 0.35);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.42 * volMul), strikeDropTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(effectiveDuration * 0.96, strikeDropTime + 0.04));
        break;
      }
      case 'flute': {
        // Traditional Bamboo Flute (Dizi / 竹笛) with cylindrical tube odd harmonics, Di Mo (笛膜) reed buzzing membrane, and deep poetic vibrato
        osc.type = 'sine';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }

        // 1. Odd harmonics for hollow cylindrical bamboo tube body (fundamental + 3rd harmonic)
        const oddHarm = this.ctx.createOscillator();
        this.registerOscillator(oddHarm);
        const oddGain = this.ctx.createGain();
        oddHarm.type = 'sine';
        oddHarm.frequency.setValueAtTime(freq * 3, startTime);
        oddGain.gain.setValueAtTime(0.16 * volMul, startTime);
        oddGain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
        oddHarm.connect(oddGain);
        oddGain.connect(gain);
        oddHarm.start(startTime);
        oddHarm.stop(startTime + effectiveDuration + 0.05);

        // 2. Di Mo (笛膜) Resonant Buzzing Membrane
        // Chinese bamboo flutes have a thin reed membrane covering an extra hole between the embouchure and finger holes.
        // It produces a distinctive bright, slightly nasal buzzy timbre modeled via 2nd & 4th harmonic passed through a 2.4kHz bandpass filter.
        const membrane = this.ctx.createOscillator();
        this.registerOscillator(membrane);
        const membraneFilter = this.ctx.createBiquadFilter();
        membraneFilter.type = 'bandpass';
        membraneFilter.frequency.setValueAtTime(2400, startTime);
        membraneFilter.Q.setValueAtTime(3.2, startTime);
        const membraneGain = this.ctx.createGain();
        membrane.type = 'sawtooth';
        membrane.frequency.setValueAtTime(freq * 2, startTime);
        membraneGain.gain.setValueAtTime(0.0001, startTime);
        membraneGain.gain.linearRampToValueAtTime(0.14 * volMul, startTime + 0.04);
        membraneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
        membrane.connect(membraneFilter);
        membraneFilter.connect(membraneGain);
        membraneGain.connect(gain);
        membrane.start(startTime);
        membrane.stop(startTime + effectiveDuration + 0.05);

        // 3. Expressive Traditional Flute Vibrato (4.2 Hz with delayed swelling onset)
        const lfo = this.ctx.createOscillator();
        this.registerOscillator(lfo);
        const lfoGain = this.ctx.createGain();
        lfo.frequency.setValueAtTime(4.2, startTime);
        const fluteVibStart = startTime + Math.min(0.12, effectiveDuration * 0.3);
        lfoGain.gain.setValueAtTime(0.0001, startTime);
        lfoGain.gain.setValueAtTime(0.0001, fluteVibStart);
        lfoGain.gain.linearRampToValueAtTime(freq * 0.022, fluteVibStart + Math.min(0.2, effectiveDuration * 0.3));
        lfo.connect(osc.frequency);
        lfo.connect(membrane.frequency);
        lfo.start(startTime);
        lfo.stop(startTime + effectiveDuration + 0.05);

        // 4. Soft breath swell attack and warm woody sustain
        gain.gain.setValueAtTime(0.0001, startTime);
        const fluteAttack = isLegato ? 0.016 : 0.038;
        gain.gain.linearRampToValueAtTime(0.72 * volMul, startTime + fluteAttack);
        gain.gain.setValueAtTime(0.66 * volMul, startTime + effectiveDuration * 0.85);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
        break;
      }
      case 'whistle': {
        // High soprano folk mouth whistle / koudi: high, piercing, soaring, with pitch-scoop fipple chirp & fast flutter vibrato
        // Whistle sounds in high soprano register (raised 1 octave for notes below 900Hz so it truly whistles)
        const whistleFreq = freq < 900 ? freq * 2 : freq;
        osc.type = 'sine';

        // 1. Characteristic pitch-scoop chirp attack (lip/fipple vortex stabilizes upward)
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(whistleFreq * 0.94, startTime);
          osc.frequency.exponentialRampToValueAtTime(whistleFreq, startTime + 0.022);
        } else {
          osc.frequency.setValueAtTime(options.glideFromFreq < 900 ? options.glideFromFreq * 2 : options.glideFromFreq, startTime);
          osc.frequency.exponentialRampToValueAtTime(whistleFreq, startTime + Math.min(0.08, effectiveDuration * 0.5));
        }

        // 2. High breath/fipple air shimmer (overtone at 2x)
        const airOsc = this.ctx.createOscillator();
        this.registerOscillator(airOsc);
        const airGain = this.ctx.createGain();
        airOsc.type = 'sine';
        airOsc.frequency.setValueAtTime(whistleFreq * 2, startTime);
        airGain.gain.setValueAtTime(0.07 * volMul, startTime);
        airGain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
        airOsc.connect(airGain);
        airGain.connect(gain);
        airOsc.start(startTime);
        airOsc.stop(startTime + effectiveDuration + 0.05);

        // 3. Fast folk flutter vibrato (6.8 Hz, energetic and bright)
        const lfo = this.ctx.createOscillator();
        this.registerOscillator(lfo);
        const lfoGain = this.ctx.createGain();
        lfo.frequency.setValueAtTime(6.8, startTime);
        const whistleLfoStart = startTime + Math.min(0.05, effectiveDuration * 0.15);
        lfoGain.gain.setValueAtTime(0.0001, startTime);
        lfoGain.gain.setValueAtTime(0.0001, whistleLfoStart);
        lfoGain.gain.linearRampToValueAtTime(whistleFreq * 0.016, whistleLfoStart + 0.08);
        lfo.connect(osc.frequency);
        lfo.start(startTime);
        lfo.stop(startTime + effectiveDuration + 0.05);

        // 4. Quick, responsive breath envelope
        gain.gain.setValueAtTime(0.0001, startTime);
        const whistleAttack = isLegato ? 0.012 : 0.018;
        gain.gain.linearRampToValueAtTime(0.85 * volMul, startTime + whistleAttack);
        gain.gain.setValueAtTime(0.78 * volMul, startTime + effectiveDuration * 0.86);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
        break;
      }
      case 'guitar': {
        // Plucked acoustic string synthesis: sharp fingernail/pick transient snap, steep dynamic lowpass filter decay (Karplus-Strong pluck curve), and wooden soundhole resonance
        osc.type = 'sawtooth';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }

        // 1. Dynamic Lowpass Filter (simulating string physics where high harmonics damp out rapidly)
        const guitarFilter = this.ctx.createBiquadFilter();
        guitarFilter.type = 'lowpass';
        // At pluck start, filter is wide open for bright string twang
        guitarFilter.frequency.setValueAtTime(Math.min(5200, Math.max(1800, freq * 5.5)), startTime);
        guitarFilter.Q.setValueAtTime(2.2, startTime);
        // Rapid exponential damping of high frequencies down to warm string fundamental
        const pluckDampTime = Math.min(0.09, effectiveDuration * 0.35);
        guitarFilter.frequency.exponentialRampToValueAtTime(Math.max(130, freq * 1.3), startTime + pluckDampTime);

        osc.connect(guitarFilter);
        outputNode = guitarFilter;

        // 2. Pick snap / fingernail transient click (highpass impulse)
        const snap = this.ctx.createOscillator();
        this.registerOscillator(snap);
        const snapGain = this.ctx.createGain();
        const snapFilter = this.ctx.createBiquadFilter();
        snapFilter.type = 'highpass';
        snapFilter.frequency.setValueAtTime(2800, startTime);
        snap.type = 'sawtooth';
        snap.frequency.setValueAtTime(freq * 3, startTime);
        snapGain.gain.setValueAtTime(0.5 * volMul, startTime);
        snapGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.012);
        snap.connect(snapFilter);
        snapFilter.connect(snapGain);
        snapGain.connect(gain);
        snap.start(startTime);
        snap.stop(startTime + 0.02);

        // 3. Wooden soundhole acoustic cavity body resonance (warm low thump)
        const bodyOsc = this.ctx.createOscillator();
        this.registerOscillator(bodyOsc);
        const bodyGain = this.ctx.createGain();
        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(freq, startTime);
        bodyGain.gain.setValueAtTime(0.35 * volMul, startTime);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.min(0.25, effectiveDuration * 0.6));
        bodyOsc.connect(bodyGain);
        bodyGain.connect(gain);
        bodyOsc.start(startTime);
        bodyOsc.stop(startTime + effectiveDuration + 0.05);

        // 4. Pluck envelope: instantaneous attack (1ms), steep drop from initial twang to warm ringing string
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.9 * volMul, startTime + (isLegato ? 0.012 : 0.002));
        const midPluck = startTime + Math.min(0.06, effectiveDuration * 0.2);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.3 * volMul), midPluck);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration * 0.95);
        break;
      }
      case 'synth': {
        // Bold 80s analog synthesizer: detuned dual super-saws + square sub-oscillator + juicy resonant 24dB VCF filter sweep (brass bite)
        // Oscillator 1: Sawtooth (-5 cents detuned)
        osc.type = 'sawtooth';
        const synthFreq = options?.glideFromFreq || freq;
        osc.frequency.setValueAtTime(synthFreq * 0.997, startTime);
        if (options?.glideFromFreq) {
          osc.frequency.exponentialRampToValueAtTime(freq * 0.997, startTime + Math.min(0.08, effectiveDuration * 0.5));
        }

        // Oscillator 2: Sawtooth (+5 cents detuned for rich analog chorus width)
        const osc2 = this.ctx.createOscillator();
        this.registerOscillator(osc2);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(synthFreq * 1.003, startTime);
        if (options?.glideFromFreq) {
          osc2.frequency.exponentialRampToValueAtTime(freq * 1.003, startTime + Math.min(0.08, effectiveDuration * 0.5));
        }

        // Oscillator 3: Sub-Oscillator (Square wave 1 octave down for massive low-end punch)
        const subOsc = this.ctx.createOscillator();
        this.registerOscillator(subOsc);
        const subGain = this.ctx.createGain();
        subOsc.type = 'square';
        subOsc.frequency.setValueAtTime(synthFreq * 0.5, startTime);
        if (options?.glideFromFreq) {
          subOsc.frequency.exponentialRampToValueAtTime(freq * 0.5, startTime + Math.min(0.08, effectiveDuration * 0.5));
        }
        subGain.gain.setValueAtTime(0.28, startTime);
        subOsc.connect(subGain);

        // Resonant VCF Lowpass Filter with classic analog brass "WAOW" sweep
        const vcf = this.ctx.createBiquadFilter();
        vcf.type = 'lowpass';
        vcf.Q.setValueAtTime(4.2, startTime); // juicy analog resonance
        const filterStart = Math.min(6500, Math.max(2200, freq * 4.8));
        const filterEnd = Math.max(380, freq * 1.4);
        vcf.frequency.setValueAtTime(filterStart, startTime);
        vcf.frequency.exponentialRampToValueAtTime(filterEnd, startTime + Math.min(0.18, effectiveDuration * 0.45));

        osc.connect(vcf);
        osc2.connect(vcf);
        subGain.connect(vcf);
        outputNode = vcf;

        osc2.start(startTime);
        osc2.stop(startTime + effectiveDuration + 0.05);
        subOsc.start(startTime);
        subOsc.stop(startTime + effectiveDuration + 0.05);

        // Analog drift vibrato LFO (5.0 Hz)
        const lfo = this.ctx.createOscillator();
        this.registerOscillator(lfo);
        const lfoGain = this.ctx.createGain();
        lfo.frequency.setValueAtTime(5.0, startTime);
        lfoGain.gain.setValueAtTime(freq * 0.008, startTime);
        lfo.connect(osc.frequency);
        lfo.connect(osc2.frequency);
        lfo.start(startTime + Math.min(0.1, effectiveDuration * 0.25));
        lfo.stop(startTime + effectiveDuration + 0.05);

        // Punchy synth envelope: 12ms punch, full sustaining power, snappy release
        gain.gain.setValueAtTime(0.0001, startTime);
        const synthAttack = isLegato ? 0.01 : 0.02;
        gain.gain.linearRampToValueAtTime(0.78 * volMul, startTime + synthAttack);
        gain.gain.setValueAtTime(0.68 * volMul, startTime + effectiveDuration * 0.82);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
        break;
      }
      case 'bell': {
        // Glockenspiel / Celesta: Struck metallic tuned bars with true non-harmonic inharmonic vibration modes (f, 2.756f, 5.404f, 8.933f) and crystalline ringing decay
        osc.type = 'sine';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }

        // Mode 2: Inharmonic chime overtone (2.756x)
        const mode2 = this.ctx.createOscillator();
        this.registerOscillator(mode2);
        const mode2Gain = this.ctx.createGain();
        mode2.type = 'sine';
        mode2.frequency.setValueAtTime(freq * 2.756, startTime);
        mode2Gain.gain.setValueAtTime(0.48 * volMul, startTime);
        mode2Gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.min(effectiveDuration * 0.85, 0.9));
        mode2.connect(mode2Gain);
        mode2Gain.connect(gain);
        mode2.start(startTime);
        mode2.stop(startTime + effectiveDuration + 0.1);

        // Mode 3: Sparkling high metallic shimmer (5.404x)
        const mode3 = this.ctx.createOscillator();
        this.registerOscillator(mode3);
        const mode3Gain = this.ctx.createGain();
        mode3.type = 'sine';
        mode3.frequency.setValueAtTime(freq * 5.404, startTime);
        mode3Gain.gain.setValueAtTime(0.26 * volMul, startTime);
        mode3Gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.min(effectiveDuration * 0.45, 0.35));
        mode3.connect(mode3Gain);
        mode3Gain.connect(gain);
        mode3.start(startTime);
        mode3.stop(startTime + effectiveDuration + 0.1);

        // Mode 4: Hard mallet ping strike transient (8.933x, ultra-fast 20ms metallic strike click)
        const mode4 = this.ctx.createOscillator();
        this.registerOscillator(mode4);
        const mode4Gain = this.ctx.createGain();
        mode4.type = 'sine';
        mode4.frequency.setValueAtTime(freq * 8.933, startTime);
        mode4Gain.gain.setValueAtTime(0.35 * volMul, startTime);
        mode4Gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.035);
        mode4.connect(mode4Gain);
        mode4Gain.connect(gain);
        mode4.start(startTime);
        mode4.stop(startTime + 0.05);

        // Crystalline pure ring: instant mallet attack (0.8ms), long sustaining metallic ring
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.9 * volMul, startTime + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(effectiveDuration * 0.98, 0.3));
        break;
      }
      case 'cello': {
        // Expressive bowed acoustic cello (violoncello) / bowed strings:
        // Rich sawtooth string oscillation with bow friction / rosin scrape, wooden body resonance cavity (130Hz air cavity + 450Hz wood formant), and expressive delayed warm vibrato
        osc.type = 'sawtooth';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }

        // 1. Cello Wooden Body Formant Filter (dual-stage warmth: lowpass + resonant peak around 450Hz)
        const celloFilter = this.ctx.createBiquadFilter();
        celloFilter.type = 'lowpass';
        // Warm cello body cutoff: rich harmonic warmth without harsh treble
        celloFilter.frequency.setValueAtTime(Math.min(3800, Math.max(900, freq * 3.2)), startTime);
        celloFilter.Q.setValueAtTime(1.8, startTime);

        // Body resonance peak (simulating the wooden soundbox cavity at ~450 Hz)
        const bodyPeaking = this.ctx.createBiquadFilter();
        bodyPeaking.type = 'peaking';
        bodyPeaking.frequency.setValueAtTime(450, startTime);
        bodyPeaking.Q.setValueAtTime(1.5, startTime);
        bodyPeaking.gain.setValueAtTime(3.5, startTime); // +3.5dB body resonance

        osc.connect(celloFilter);
        celloFilter.connect(bodyPeaking);
        outputNode = bodyPeaking;

        // 2. Deep Sub-body Resonance (Air Cavity Helmholtz Resonance)
        // Adds acoustic body weight and depth
        const airCavity = this.ctx.createOscillator();
        this.registerOscillator(airCavity);
        const airCavityGain = this.ctx.createGain();
        airCavity.type = 'triangle';
        airCavity.frequency.setValueAtTime(freq, startTime);
        airCavityGain.gain.setValueAtTime(0.25 * volMul, startTime);
        airCavityGain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
        airCavity.connect(airCavityGain);
        airCavityGain.connect(gain);
        airCavity.start(startTime);
        airCavity.stop(startTime + effectiveDuration + 0.05);

        // 3. Rosin / Bow Scrape Initial Friction Transient (highpass bow bite on string)
        const rosinBite = this.ctx.createOscillator();
        this.registerOscillator(rosinBite);
        const rosinGain = this.ctx.createGain();
        const rosinFilter = this.ctx.createBiquadFilter();
        rosinFilter.type = 'bandpass';
        rosinFilter.frequency.setValueAtTime(2200, startTime);
        rosinFilter.Q.setValueAtTime(2.0, startTime);
        rosinBite.type = 'sawtooth';
        rosinBite.frequency.setValueAtTime(freq * 2.5, startTime);
        rosinGain.gain.setValueAtTime(0.22 * volMul, startTime);
        rosinGain.gain.exponentialRampToValueAtTime(0.0001, startTime + (isLegato ? 0.025 : 0.045));
        rosinBite.connect(rosinFilter);
        rosinFilter.connect(rosinGain);
        rosinGain.connect(gain);
        rosinBite.start(startTime);
        rosinBite.stop(startTime + 0.06);

        // 4. Warm delayed cello vibrato (5.2 Hz classical singing vibrato)
        const lfo = this.ctx.createOscillator();
        this.registerOscillator(lfo);
        const lfoGain = this.ctx.createGain();
        lfo.frequency.setValueAtTime(5.2, startTime);
        const celloVibStart = startTime + Math.min(0.08, effectiveDuration * 0.25);
        lfoGain.gain.setValueAtTime(0.0001, startTime);
        lfoGain.gain.setValueAtTime(0.0001, celloVibStart);
        lfoGain.gain.linearRampToValueAtTime(freq * 0.015, celloVibStart + Math.min(0.18, effectiveDuration * 0.35));
        lfo.connect(osc.frequency);
        lfo.connect(airCavity.frequency);
        lfo.start(startTime);
        lfo.stop(startTime + effectiveDuration + 0.05);

        // 5. Bow envelope: realistic bow attack (26ms, or 12ms for legato), singing sustain, smooth bow release
        gain.gain.setValueAtTime(0.0001, startTime);
        const bowAttack = isLegato ? 0.012 : 0.026;
        gain.gain.linearRampToValueAtTime(0.82 * volMul, startTime + bowAttack);
        gain.gain.setValueAtTime(0.74 * volMul, startTime + effectiveDuration * 0.88);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
        break;
      }
      default: {
        // Baseline acoustic reference tone (pure warm triangle oscillator with smooth envelope)
        osc.type = 'triangle';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }
        gain.gain.setValueAtTime(0.0001, startTime);
        const attack = isLegato ? 0.02 : 0.012;
        gain.gain.linearRampToValueAtTime(0.75 * volMul, startTime + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
        break;
      }
    }

    outputNode.connect(gain);
    gain.connect(destination);

    osc.start(startTime);
    osc.stop(startTime + effectiveDuration + 0.05);
  }

  /**
   * Play a metronome click (punchy woodblock tone with crisp transient)
   */
  private playMetronomeClick(startTime: number, isDownbeat: boolean) {
    if (!this.ctx || !this.metronomeGain || this.options.metronomeVolume <= 0.01) return;

    try {
      const osc = this.ctx.createOscillator();
      this.registerOscillator(osc);
      const gain = this.ctx.createGain();

      // Punchy woodblock click with clear harmonic body that cuts through instruments
      osc.type = 'triangle';
      const startFreq = isDownbeat ? 2200 : 1400;
      const targetFreq = isDownbeat ? 1600 : 1000;
      osc.frequency.setValueAtTime(startFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(targetFreq, startTime + 0.008);

      const peakGain = isDownbeat ? 0.95 : 0.75;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.045);

      osc.connect(gain);
      gain.connect(this.metronomeGain);

      osc.start(startTime);
      osc.stop(startTime + 0.05);
    } catch (err) {
      console.warn('[AudioEngine] playMetronomeClick error:', err);
    }
  }

  /**
   * Play chord accompaniment pattern with low bass foundation and warm harmonic pad.
   * Chords are routed through the backing low-pass filter to ensure clarity for the melody.
   * When ecoMode is active, uses an energy-efficient reduced oscillator graph (2 voices, direct routing)
   * to conserve CPU and battery without muting the harmonic accompaniment.
   */
  private playChordBeat(chordName: string, startTime: number, beatDuration: number, isDownbeat: boolean) {
    if (this.options.chordEnabled === false) return;
    if (!this.ctx || !this.backingGain || this.options.backingVolume <= 0.01) return;
    const chordFrequencies = getChordNotes(chordName, this.options.transpose);
    if (chordFrequencies.length === 0) return;

    const isEco = Boolean(this.options.ecoMode);
    // In ecoMode, bypass the biquad lowpass filter DSP to conserve processing power
    const targetDestination: AudioNode = isEco ? this.backingGain : (this.backingFilter || this.backingGain);
    const now = this.ctx.currentTime;
    const safeStart = Math.max(startTime, now + 0.005);

    // In ecoMode, synthesize a streamlined harmonic set to cut oscillator overhead by ~60-75%:
    // - On downbeats: bass root + primary harmonic tone
    // - On offbeats: bass root only
    const activeFrequencies = isEco
      ? (isDownbeat
          ? [chordFrequencies[0], chordFrequencies[Math.min(2, chordFrequencies.length - 1)]]
          : [chordFrequencies[0]])
      : chordFrequencies;

    activeFrequencies.forEach((freq, idx) => {
      const isBass = idx === 0;

      // Skip stagger timing ramps in ecoMode to reduce timer complexity
      const stagger = !isEco && isDownbeat && !isBass ? (idx - 1) * 0.016 : 0;
      const noteTime = safeStart + stagger;
      const osc = this.ctx!.createOscillator();
      this.registerOscillator(osc);
      const gain = this.ctx!.createGain();

      osc.type = isBass ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      const noteDuration = isDownbeat ? beatDuration * 0.94 : beatDuration * 0.78;
      const vol = isDownbeat
        ? (isBass ? 0.38 : 0.26)
        : (isBass ? 0.20 : 0.18);

      const attackTime = 0.012;
      const decayDuration = Math.max(0.06, noteDuration);
      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(vol, noteTime + attackTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + decayDuration);

      osc.connect(gain);
      gain.connect(targetDestination);

      osc.start(noteTime);
      osc.stop(noteTime + noteDuration + 0.04);
    });
  }

  /**
   * Calculate total song duration in seconds
   */
  public calculateSongDuration(song: Song): number {
    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;
    let totalBeats = 0;

    for (const measure of song.measures) {
      let measureBeats = 0;
      for (const note of measure.notes) {
        // Punctuation, annotations, newlines, and blank whitespace do not occupy any time duration when playing
        if (!isNonNotationItem(note) && note.duration > 0 && note.pitch !== 'empty') {
          measureBeats += note.duration;
        }
      }
      totalBeats += measureBeats;
    }

    return totalBeats * secPerBeat;
  }

  /**
   * Play only a single measure (for instant composer verification)
   */
  public playMeasure(song: Song, measureIndex: number, onFinished?: () => void) {
    this.initContext();
    this.stop(false); // Stop any existing playback without notifying state listeners prior to starting new playback

    const targetMeasure = song.measures[measureIndex];
    if (!targetMeasure || targetMeasure.notes.length === 0 || !this.ctx) return;

    this.currentSong = song;
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedSongTime = 0;
    this.playbackEndedReason = 'preview';

    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;

    let measureBeats = 0;
    for (const note of targetMeasure.notes) {
      if (!isNonNotationItem(note) && note.duration > 0 && note.pitch !== 'empty') {
        measureBeats += note.duration;
      }
    }

    const tsParts = (targetMeasure.timeSignature || song.timeSignature).split('/');
    const beatsPerBar = parseInt(tsParts[0], 10) || 4;
    const totalMeasureDurationSec = Math.max(measureBeats, beatsPerBar) * secPerBeat;

    const audioStart = this.ctx!.currentTime + 0.08;
    this.startAudioTime = audioStart;

    const timelineEvents: {
      time: number;
      measureIndex: number;
      noteIndex: number;
      note: NumberedNotationNote;
      durationSec: number;
    }[] = [];

    // Pre-calculate true tie chains and combined sound durations for this measure
    const notesCount = targetMeasure.notes.length;
    const isTiedContinuation = new Array<boolean>(notesCount).fill(false);
    const combinedSoundDurations = new Array<number>(notesCount).fill(0);

    for (let i = 0; i < notesCount; i++) {
      if (isTiedContinuation[i]) continue;
      const n = targetMeasure.notes[i];
      const isNon = isNonNotationItem(n) || n.pitch === 'empty' || n.duration <= 0;
      let durSec = isNon ? 0 : n.duration * secPerBeat;
      let k = i;
      while (k + 1 < notesCount && isTieActive(targetMeasure.notes[k], targetMeasure.notes[k + 1])) {
        k++;
        isTiedContinuation[k] = true;
        const nextN = targetMeasure.notes[k];
        const nextDurSec = isNonNotationItem(nextN) || nextN.pitch === 'empty' || nextN.duration <= 0 ? 0 : nextN.duration * secPerBeat;
        durSec += nextDurSec;
      }
      combinedSoundDurations[i] = durSec;
    }

    let noteTime = 0;
    targetMeasure.notes.forEach((note, nIdx) => {
      const isNonNotation = isNonNotationItem(note) || note.pitch === 'empty' || note.duration <= 0;
      const noteDurationSec = isNonNotation ? 0 : note.duration * secPerBeat;
      const scheduleAt = audioStart + noteTime;

      if (!isNonNotation && note.duration > 0) {
        // Only trigger audio if this note is NOT a continuation of an already-sustained tie
        if (!isTiedContinuation[nIdx]) {
          const soundDuration = combinedSoundDurations[nIdx] || noteDurationSec;
          const nextNote = targetMeasure.notes[nIdx + 1];
          const prevNote = nIdx > 0 ? targetMeasure.notes[nIdx - 1] : null;
          const isSlurred = isSlurActive(note, nextNote) || (prevNote ? isSlurActive(prevNote, note) : false);

          this.playMelodyNoteWithDetails(
            song.key,
            note,
            scheduleAt,
            soundDuration,
            this.melodyGain!,
            note.instrument || this.options.instrument,
            { isLegato: isSlurred }
          );
        }
      }

      timelineEvents.push({
        time: noteTime,
        measureIndex,
        noteIndex: nIdx,
        note,
        durationSec: noteDurationSec,
      });

      // Punctuation, annotations, and blank whitespace do not occupy any time duration
      if (!isNonNotation) {
        noteTime += noteDurationSec;
      }
    });

    // Schedule chord backing & metronome for this measure
    const measureChords = getEffectiveMeasureChords(song, measureIndex);
    for (let b = 0; b < beatsPerBar; b++) {
      const beatTime = audioStart + b * secPerBeat;
      if (!this.options.ecoMode || b === 0) {
        this.playMetronomeClick(beatTime, b === 0);
      }
      if (measureChords.length > 0) {
        const chordIdx = Math.min(
          measureChords.length - 1,
          Math.floor((b / beatsPerBar) * measureChords.length)
        );
        const currentChord = measureChords[chordIdx];
        const isChordChange = b === 0 || chordIdx !== Math.floor(((b - 1) / beatsPerBar) * measureChords.length);
        this.playChordBeat(currentChord, beatTime, secPerBeat, isChordChange);
      }
    }

    // Start UI tracking loop
    this.startTrackingLoop(totalMeasureDurationSec, timelineEvents);

    // Auto stop when measure finishes
    const stopTimer = setTimeout(() => {
      if (this.isPlaying && this.currentSong === song) {
        this.stop();
        this.notifyEnded();
        if (onFinished) onFinished();
      }
    }, (totalMeasureDurationSec + 0.08) * 1000);

    this.scheduledTimeoutIds.push(stopTimer as unknown as number);
  }

  /**
   * Play a system of measures (a staff line across the score)
   */
  public playSystem(song: Song, measureIndices: number[], onFinished?: () => void) {
    this.initContext();
    this.stop(false); // Stop any existing playback without notifying state listeners prior to starting new playback

    if (!measureIndices || measureIndices.length === 0 || !this.ctx) return;

    this.currentSong = song;
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedSongTime = 0;
    this.playbackEndedReason = 'preview';

    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;

    interface SystemNoteRef {
      measureIndex: number;
      noteIndex: number;
      note: NumberedNotationNote;
      noteStartTime: number;
      noteDurationSec: number;
      isNonNotation: boolean;
    }

    const flatNotes: SystemNoteRef[] = [];
    let systemAccumTime = 0;

    measureIndices.forEach(mIdx => {
      const measure = song.measures[mIdx];
      if (!measure) return;

      const measureStart = systemAccumTime;
      let measureBeats = 0;

      measure.notes.forEach((note, nIdx) => {
        const isNon = isNonNotationItem(note) || note.pitch === 'empty' || note.duration <= 0;
        const noteDurSec = isNon ? 0 : note.duration * secPerBeat;
        flatNotes.push({
          measureIndex: mIdx,
          noteIndex: nIdx,
          note,
          noteStartTime: measureStart + measureBeats * secPerBeat,
          noteDurationSec: noteDurSec,
          isNonNotation: isNon,
        });
        if (!isNon) {
          measureBeats += note.duration;
        }
      });

      const tsParts = (measure.timeSignature || song.timeSignature).split('/');
      const beatsPerBar = parseInt(tsParts[0], 10) || 4;
      const measureDurationBeats = Math.max(measureBeats, beatsPerBar);
      systemAccumTime += measureDurationBeats * secPerBeat;
    });

    const totalSystemDurationSec = systemAccumTime;
    const audioStart = this.ctx!.currentTime + 0.05;
    this.startAudioTime = audioStart;

    const timelineEvents: {
      time: number;
      measureIndex: number;
      noteIndex: number;
      note: NumberedNotationNote;
      durationSec: number;
    }[] = [];

    // Pre-calculate true ties across system notes
    const flatTotal = flatNotes.length;
    const isTiedContinuation = new Array<boolean>(flatTotal).fill(false);
    const combinedSoundDurations = new Array<number>(flatTotal).fill(0);

    for (let i = 0; i < flatTotal; i++) {
      if (isTiedContinuation[i]) continue;
      const fn = flatNotes[i];
      let durSec = fn.noteDurationSec;
      let k = i;
      while (k + 1 < flatTotal && isTieActive(flatNotes[k].note, flatNotes[k + 1].note)) {
        k++;
        isTiedContinuation[k] = true;
        durSec += flatNotes[k].noteDurationSec;
      }
      combinedSoundDurations[i] = durSec;
    }

    // Schedule melody notes
    flatNotes.forEach((fn, idx) => {
      const scheduleAt = audioStart + fn.noteStartTime;
      if (!fn.isNonNotation && fn.note.duration > 0) {
        if (!isTiedContinuation[idx]) {
          const soundDuration = combinedSoundDurations[idx] || fn.noteDurationSec;
          const nextFn = flatNotes[idx + 1];
          const prevFn = idx > 0 ? flatNotes[idx - 1] : null;
          const isSlurred = isSlurActive(fn.note, nextFn?.note) || (prevFn ? isSlurActive(prevFn.note, fn.note) : false);

          this.playMelodyNoteWithDetails(
            song.key,
            fn.note,
            scheduleAt,
            soundDuration,
            this.melodyGain!,
            fn.note.instrument || this.options.instrument,
            { isLegato: isSlurred }
          );
        }
      }

      timelineEvents.push({
        time: fn.noteStartTime,
        measureIndex: fn.measureIndex,
        noteIndex: fn.noteIndex,
        note: fn.note,
        durationSec: fn.noteDurationSec,
      });
    });

    // Schedule chords and metronome clicks for each measure in the system
    let measureAccumTime = 0;
    measureIndices.forEach(mIdx => {
      const measure = song.measures[mIdx];
      if (!measure) return;

      const tsParts = (measure.timeSignature || song.timeSignature).split('/');
      const beatsPerBar = parseInt(tsParts[0], 10) || 4;
      const measureChords = getEffectiveMeasureChords(song, mIdx);

      for (let b = 0; b < beatsPerBar; b++) {
        const beatTime = audioStart + measureAccumTime + b * secPerBeat;
        if (!this.options.ecoMode || b === 0) {
          this.playMetronomeClick(beatTime, b === 0);
        }
        if (measureChords.length > 0) {
          const chordIdx = Math.min(
            measureChords.length - 1,
            Math.floor((b / beatsPerBar) * measureChords.length)
          );
          const currentChord = measureChords[chordIdx];
          const isChordChange = b === 0 || chordIdx !== Math.floor(((b - 1) / beatsPerBar) * measureChords.length);
          this.playChordBeat(currentChord, beatTime, secPerBeat, isChordChange);
        }
      }

      let mBeats = 0;
      measure.notes.forEach(n => {
        if (!isNonNotationItem(n) && n.duration > 0 && n.pitch !== 'empty') {
          mBeats += n.duration;
        }
      });
      measureAccumTime += Math.max(mBeats, beatsPerBar) * secPerBeat;
    });

    // Start UI tracking loop for real-time note highlighting
    this.startTrackingLoop(totalSystemDurationSec, timelineEvents);

    // Auto stop when system finishes
    const stopTimer = setTimeout(() => {
      if (this.isPlaying && this.currentSong === song) {
        this.stop();
        this.notifyEnded();
        if (onFinished) onFinished();
      }
    }, (totalSystemDurationSec + 0.08) * 1000);

    this.scheduledTimeoutIds.push(stopTimer as unknown as number);
  }

  /**
   * Play only a specific verse (sequence of notes across measures)
   */
  public playVerse(
    song: Song,
    verseNotes: { note: NumberedNotationNote; measureIdx: number; noteIdx: number }[],
    onFinished?: () => void
  ) {
    this.initContext();
    this.stop(false); // Stop any existing playback without notifying state listeners prior to starting new playback

    if (!verseNotes || verseNotes.length === 0 || !this.ctx) return;

    this.currentSong = song;
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedSongTime = 0;
    this.playbackEndedReason = 'preview';

    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;

    let totalVerseBeats = 0;
    for (const item of verseNotes) {
      if (!isNonNotationItem(item.note) && item.note.duration > 0 && item.note.pitch !== 'empty') {
        totalVerseBeats += item.note.duration;
      }
    }
    const totalVerseDurationSec = totalVerseBeats * secPerBeat;

    const audioStart = this.ctx!.currentTime + 0.08;
    this.startAudioTime = audioStart;

    const timelineEvents: {
      time: number;
      measureIndex: number;
      noteIndex: number;
      note: NumberedNotationNote;
      durationSec: number;
    }[] = [];

    // Pre-calculate true tie chains for verse notes
    const vCount = verseNotes.length;
    const isTiedContinuation = new Array<boolean>(vCount).fill(false);
    const combinedSoundDurations = new Array<number>(vCount).fill(0);

    for (let i = 0; i < vCount; i++) {
      if (isTiedContinuation[i]) continue;
      const n = verseNotes[i].note;
      const isNon = isNonNotationItem(n) || n.pitch === 'empty' || n.duration <= 0;
      let durSec = isNon ? 0 : n.duration * secPerBeat;
      let k = i;
      while (k + 1 < vCount && isTieActive(verseNotes[k].note, verseNotes[k + 1].note)) {
        k++;
        isTiedContinuation[k] = true;
        const nextN = verseNotes[k].note;
        const nextDurSec = isNonNotationItem(nextN) || nextN.pitch === 'empty' || nextN.duration <= 0 ? 0 : nextN.duration * secPerBeat;
        durSec += nextDurSec;
      }
      combinedSoundDurations[i] = durSec;
    }

    let noteTime = 0;
    const measureStartTimeMap = new Map<number, number>();

    verseNotes.forEach((item, itemIdx) => {
      const { note, measureIdx, noteIdx } = item;
      const isNonNotation = isNonNotationItem(note) || note.pitch === 'empty' || note.duration <= 0;
      const noteDurationSec = isNonNotation ? 0 : note.duration * secPerBeat;
      const scheduleAt = audioStart + noteTime;

      if (!measureStartTimeMap.has(measureIdx)) {
        measureStartTimeMap.set(measureIdx, noteTime);
      }

      if (!isNonNotation && note.duration > 0) {
        if (!isTiedContinuation[itemIdx]) {
          const soundDuration = combinedSoundDurations[itemIdx] || noteDurationSec;
          const nextItem = verseNotes[itemIdx + 1];
          const prevItem = verseNotes[itemIdx - 1];
          const isSlurred = isSlurActive(note, nextItem?.note) || (prevItem ? isSlurActive(prevItem.note, note) : false);

          this.playMelodyNoteWithDetails(
            song.key,
            note,
            scheduleAt,
            soundDuration,
            this.melodyGain!,
            note.instrument || this.options.instrument,
            { isLegato: isSlurred }
          );
        }
      }

      timelineEvents.push({
        time: noteTime,
        measureIndex: measureIdx,
        noteIndex: noteIdx,
        note,
        durationSec: noteDurationSec,
      });

      if (!isNonNotation) {
        noteTime += noteDurationSec;
      }
    });

    // Schedule chords and metronome clicks accurately per measure in the verse
    measureStartTimeMap.forEach((mStartTimeSec, mIdx) => {
      const targetMeasure = song.measures[mIdx];
      if (!targetMeasure) return;

      const tsParts = (targetMeasure.timeSignature || song.timeSignature || '4/4').split('/');
      const beatsPerBar = parseInt(tsParts[0], 10) || 4;
      const measureChords = getEffectiveMeasureChords(song, mIdx);

      for (let b = 0; b < beatsPerBar; b++) {
        const beatTime = audioStart + mStartTimeSec + b * secPerBeat;
        if (!this.options.ecoMode || b === 0) {
          this.playMetronomeClick(beatTime, b === 0);
        }

        if (measureChords.length > 0) {
          const chordIdx = Math.min(
            measureChords.length - 1,
            Math.floor((b / beatsPerBar) * measureChords.length)
          );
          const currentChord = measureChords[chordIdx];
          const isChordChange = b === 0 || chordIdx !== Math.floor(((b - 1) / beatsPerBar) * measureChords.length);
          this.playChordBeat(currentChord, beatTime, secPerBeat, isChordChange);
        }
      }
    });

    // Start UI tracking loop
    this.startTrackingLoop(totalVerseDurationSec, timelineEvents);

    // Auto stop when verse finishes
    const stopTimer = setTimeout(() => {
      if (this.isPlaying && this.currentSong === song) {
        this.stop();
        this.notifyEnded();
        if (onFinished) onFinished();
      }
    }, (totalVerseDurationSec + 0.08) * 1000);

    this.scheduledTimeoutIds.push(stopTimer as unknown as number);
  }

  /**
   * Play a single preview metronome click immediately (useful for mixer slider feedback & testing)
   */
  public previewMetronome(isDownbeat = true): void {
    if (typeof window === 'undefined') return;
    this.initContext();
    if (!this.ctx) return;

    const state = this.ctx.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.metronomeGain && this.masterGain) {
      this.metronomeGain = this.ctx.createGain();
      this.metronomeGain.connect(this.masterGain);
    }

    if (!this.metronomeGain) return;

    // Use current metronome volume if > 0, otherwise temporary audible volume for preview
    const originalVol = this.options.metronomeVolume;
    const testVol = originalVol > 0.01 ? originalVol : 0.45;
    this.metronomeGain.gain.setValueAtTime(testVol, this.ctx.currentTime);

    this.playMetronomeClick(this.ctx.currentTime + 0.01, isDownbeat);

    if (originalVol <= 0.01) {
      setTimeout(() => {
        if (this.ctx && this.metronomeGain) {
          this.metronomeGain.gain.setValueAtTime(originalVol, this.ctx.currentTime);
        }
      }, 70);
    }
  }

  /**
   * Play a 1-measure preparatory count-in (1, 2, 3, 4) with audible metronome clicks
   * and visual beat callbacks before song starts.
   */
  public playCountIn(
    song: Song,
    onBeat: (currentBeat: number, totalBeats: number) => void,
    onFinished: () => void
  ) {
    this.initContext();
    this.stop();

    if (!this.ctx) {
      onFinished();
      return;
    }

    const tsParts = (song.measures[0]?.timeSignature || song.timeSignature || '4/4').split('/');
    const beatsPerBar = parseInt(tsParts[0], 10) || 4;
    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;

    const audioStart = this.ctx.currentTime + 0.05;

    for (let b = 0; b < beatsPerBar; b++) {
      const scheduleAt = audioStart + b * secPerBeat;
      // Synthesize audible metronome beep (high pitch for beat 1, e.g. 1500Hz, 1000Hz for other beats)
      const osc = this.ctx.createOscillator();
      this.registerOscillator(osc);
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(b === 0 ? 1500 : 1000, scheduleAt);

      gain.gain.setValueAtTime(0.001, scheduleAt);
      gain.gain.linearRampToValueAtTime(0.65, scheduleAt + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, scheduleAt + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(scheduleAt);
      osc.stop(scheduleAt + 0.07);

      // Schedule UI callback for visual flashing dot on the audio clock
      this.scheduledCancels.push(
        this.scheduleAudioCallback(scheduleAt, () => {
          onBeat(b + 1, beatsPerBar);
        })
      );
    }

    // Schedule finish callback on the AudioContext clock (not wall-clock setTimeout)
    const totalLeadInSec = beatsPerBar * secPerBeat;
    this.scheduledCancels.push(
      this.scheduleAudioCallback(audioStart + totalLeadInSec, onFinished)
    );
  }

  /**
   * Start song playback from specified time or beginning
   */
  public play(song: Song, startFromSec: number = 0) {
    this.initContext();
    this.stop(false); // Stop any existing playback without notifying state listeners prior to starting new playback

    if (!this.ctx) return;

    this.currentSong = song;
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedSongTime = startFromSec;
    this.playbackEndedReason = 'song';

    const totalDuration = this.calculateSongDuration(song);
    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;

    const audioStart = this.ctx!.currentTime + 0.08; // Small lookahead buffer
    this.startAudioTime = audioStart - startFromSec;

    // Immediately notify UI state with initial playback position
    const initialLoc = this.getPlaybackLocationAtTime(song, startFromSec);
    const initialProgress = totalDuration > 0 ? Math.min(100, (startFromSec / totalDuration) * 100) : 0;
    this.notifyState({
      isPlaying: true,
      isPaused: false,
      currentMeasureIndex: initialLoc.measureIndex,
      currentNoteIndex: initialLoc.noteIndex,
      currentNoteId: initialLoc.noteId,
      currentTime: startFromSec,
      totalDuration,
      progressPercent: initialProgress,
    });

    // Schedule all notes, chords, metronome ticks
    let accumulatedSongTime = 0;

    // Store timelines for UI tracking
    const timelineEvents: {
      time: number;
      measureIndex: number;
      noteIndex: number;
      note: NumberedNotationNote;
      durationSec: number;
    }[] = [];

    // Flatten all notes across the song to detect cross-measure ties and slurs
    interface FlatSongNote {
      measureIndex: number;
      noteIndex: number;
      note: NumberedNotationNote;
      noteStartTime: number;
      noteDurationSec: number;
      isNonNotation: boolean;
    }

    const flatSongNotes: FlatSongNote[] = [];
    let songAccumTime = 0;

    song.measures.forEach((measure, mIdx) => {
      measure.notes.forEach((note, nIdx) => {
        const isNon = isNonNotationItem(note) || note.pitch === 'empty' || note.duration <= 0;
        const noteDurSec = isNon ? 0 : note.duration * secPerBeat;
        flatSongNotes.push({
          measureIndex: mIdx,
          noteIndex: nIdx,
          note,
          noteStartTime: songAccumTime,
          noteDurationSec: noteDurSec,
          isNonNotation: isNon,
        });
        if (!isNon) {
          songAccumTime += noteDurSec;
        }
      });
    });

    const flatTotal = flatSongNotes.length;
    const isTiedContinuation = new Array<boolean>(flatTotal).fill(false);
    const combinedSoundDurations = new Array<number>(flatTotal).fill(0);

    for (let i = 0; i < flatTotal; i++) {
      if (isTiedContinuation[i]) continue;
      const fn = flatSongNotes[i];
      let durSec = fn.noteDurationSec;
      let k = i;
      while (k + 1 < flatTotal && isTieActive(flatSongNotes[k].note, flatSongNotes[k + 1].note)) {
        k++;
        isTiedContinuation[k] = true;
        durSec += flatSongNotes[k].noteDurationSec;
      }
      combinedSoundDurations[i] = durSec;
    }

    this.pendingMelodyEvents = [];
    this.pendingBeatEvents = [];
    this.melodyScheduleCursor = 0;
    this.beatScheduleCursor = 0;

    let flatCursor = 0;
    song.measures.forEach((measure, mIdx) => {
      let measureTime = accumulatedSongTime;
      let measureBeatsCount = 0;

      // Determine time signature beats
      const tsParts = (measure.timeSignature || song.timeSignature).split('/');
      const beatsPerBar = parseInt(tsParts[0], 10) || 4;

      measure.notes.forEach((note, nIdx) => {
        const currentFlatIdx = flatCursor++;
        const fn = flatSongNotes[currentFlatIdx];
        const isNonNotation = fn.isNonNotation;
        const noteDurationSec = fn.noteDurationSec;
        const noteStartTime = measureTime;

        // Queue melody notes; the lookahead scheduler creates Web Audio nodes in a 320ms window
        if (!isNonNotation && note.duration > 0 && !isTiedContinuation[currentFlatIdx]) {
          const soundDuration = combinedSoundDurations[currentFlatIdx] || noteDurationSec;
          if (noteStartTime + soundDuration >= startFromSec) {
            const nextFn = flatSongNotes[currentFlatIdx + 1];
            const prevFn = currentFlatIdx > 0 ? flatSongNotes[currentFlatIdx - 1] : null;
            const isSlurred = isSlurActive(note, nextFn?.note) || (prevFn ? isSlurActive(prevFn.note, note) : false);
            this.pendingMelodyEvents.push({
              songTime: noteStartTime,
              note,
              soundDuration,
              isSlurred,
            });
          }
        }

        timelineEvents.push({
          time: noteStartTime,
          measureIndex: mIdx,
          noteIndex: nIdx,
          note,
          durationSec: noteDurationSec,
        });

        if (!isNonNotation && note.duration > 0) {
          measureTime += noteDurationSec;
          measureBeatsCount += note.duration;
        }
      });

      const measureChords = getEffectiveMeasureChords(song, mIdx);
      for (let b = 0; b < beatsPerBar; b++) {
        const beatTime = accumulatedSongTime + b * secPerBeat;
        if (beatTime >= startFromSec) {
          const chordIdx =
            measureChords.length > 0
              ? Math.min(
                  measureChords.length - 1,
                  Math.floor((b / beatsPerBar) * measureChords.length)
                )
              : 0;
          const currentChord = measureChords.length > 0 ? measureChords[chordIdx] : null;
          const isChordChange =
            b === 0 ||
            (measureChords.length > 0 &&
              chordIdx !== Math.floor(((b - 1) / beatsPerBar) * measureChords.length));
          this.pendingBeatEvents.push({
            songTime: beatTime,
            isDownbeat: b === 0,
            chord: currentChord,
            isChordChange,
            beatDuration: secPerBeat,
          });
        }
      }

      accumulatedSongTime += measureBeatsCount * secPerBeat;
    });

    this.startTrackingLoop(totalDuration, timelineEvents);
    this.scheduleLookahead();
    this.startSchedulerLoop();
  }

  private scheduleLookahead() {
    if (!this.isPlaying || !this.ctx || !this.currentSong || !this.melodyGain) return;

    const audioNow = this.ctx.currentTime;
    const horizon = audioNow - this.startAudioTime + AudioEngine.AUDIO_LOOKAHEAD_SEC;
    const isEco = Boolean(this.options.ecoMode);
    const song = this.currentSong;

    while (this.melodyScheduleCursor < this.pendingMelodyEvents.length) {
      const ev = this.pendingMelodyEvents[this.melodyScheduleCursor];
      if (ev.songTime > horizon) break;
      const scheduleAt = this.startAudioTime + ev.songTime;
      if (scheduleAt >= audioNow - 0.01) {
        this.playMelodyNoteWithDetails(
          song.key,
          ev.note,
          scheduleAt,
          ev.soundDuration,
          this.melodyGain,
          ev.note.instrument || this.options.instrument,
          { isLegato: ev.isSlurred }
        );
      }
      this.melodyScheduleCursor += 1;
    }

    while (this.beatScheduleCursor < this.pendingBeatEvents.length) {
      const ev = this.pendingBeatEvents[this.beatScheduleCursor];
      if (ev.songTime > horizon) break;
      const scheduleAt = this.startAudioTime + ev.songTime;
      if (scheduleAt >= audioNow - 0.01) {
        if (!isEco || ev.isDownbeat) {
          this.playMetronomeClick(scheduleAt, ev.isDownbeat);
        }
        if (ev.chord) {
          this.playChordBeat(ev.chord, scheduleAt, ev.beatDuration, ev.isChordChange);
        }
      }
      this.beatScheduleCursor += 1;
    }
  }

  private startSchedulerLoop() {
    this.cancelSchedulerTimer();
    const tick = () => {
      this.schedulerTimerId = null;
      if (!this.isPlaying) return;
      this.scheduleLookahead();
      this.schedulerTimerId = setTimeout(tick, AudioEngine.SCHEDULER_INTERVAL_MS);
    };
    this.schedulerTimerId = setTimeout(tick, AudioEngine.SCHEDULER_INTERVAL_MS);
  }

  private cancelSchedulerTimer() {
    if (this.schedulerTimerId !== null) {
      clearTimeout(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
  }

  private clearPlaybackSchedule() {
    this.cancelSchedulerTimer();
    this.pendingMelodyEvents = [];
    this.pendingBeatEvents = [];
    this.melodyScheduleCursor = 0;
    this.beatScheduleCursor = 0;
    for (const cancel of this.scheduledCancels) {
      try {
        cancel();
      } catch {
        // already cancelled
      }
    }
    this.scheduledCancels = [];
  }

  private startTrackingLoop(
    totalDuration: number,
    timelineEvents: {
      time: number;
      measureIndex: number;
      noteIndex: number;
      note: NumberedNotationNote;
      durationSec: number;
    }[]
  ) {
    let lastActiveEventIdx = -1;
    const targetFps = this.options.targetFps || 30;
    const frameIntervalMs = 1000 / Math.max(8, targetFps);

    const tick = () => {
      this.animationFrameId = null;
      if (!this.isPlaying || !this.ctx) return;

      const rawSongTime = this.ctx.currentTime - this.startAudioTime;
      const targetStart = this.pausedSongTime || 0;
      // Before startAudioTime (e.g. during the 80ms lookahead audio lead-in), cursor sits at the intended start time
      const currentSongTime =
        rawSongTime < targetStart
          ? Math.max(0, targetStart)
          : Math.max(0, rawSongTime);

      if (currentSongTime >= totalDuration) {
        this.stop();
        this.notifyEnded();
        return;
      }

      // Check for single measure loop or A-B loop range
      if (this.currentSong) {
        if (this.options.loopRange) {
          const { startMeasure, endMeasure } = this.options.loopRange;
          const rangeStart = this.getMeasureStartTime(this.currentSong, startMeasure);
          const rangeEnd = this.getMeasureEndTime(this.currentSong, endMeasure);
          if (currentSongTime >= rangeEnd - 0.03) {
            this.currentLoopIteration++;
            if (this.onLoopIteration) {
              this.onLoopIteration(this.currentLoopIteration);
            }
            this.seek(this.currentSong, rangeStart);
            return;
          }
        } else if (this.options.loopMeasure !== null) {
          const mIdx = this.options.loopMeasure;
          const mStart = this.getMeasureStartTime(this.currentSong, mIdx);
          const mEnd = this.getMeasureEndTime(this.currentSong, mIdx);
          if (currentSongTime >= mEnd - 0.03) {
            this.currentLoopIteration++;
            if (this.onLoopIteration) {
              this.onLoopIteration(this.currentLoopIteration);
            }
            this.seek(this.currentSong, mStart);
            return;
          }
        }
      }

      // Find current active note in timeline with 1ms float tolerance
      let activeIdx = 0;
      for (let i = 0; i < timelineEvents.length; i++) {
        if (timelineEvents[i].time <= currentSongTime + 0.001) {
          activeIdx = i;
        } else {
          break;
        }
      }

      const activeEvent = timelineEvents[activeIdx];

      if (activeIdx !== lastActiveEventIdx && activeEvent) {
        lastActiveEventIdx = activeIdx;
        if (this.onNoteStart) {
          this.onNoteStart(
            activeEvent.measureIndex,
            activeEvent.noteIndex,
            activeEvent.note,
            activeEvent.durationSec
          );
        }
        if (activeEvent.noteIndex === 0 && this.onMeasureStart) {
          this.onMeasureStart(activeEvent.measureIndex);
        }
      }

      const progressPercent = Math.min(100, (currentSongTime / totalDuration) * 100);
      this.notifyState({
        isPlaying: true,
        isPaused: false,
        currentMeasureIndex: activeEvent ? activeEvent.measureIndex : 0,
        currentNoteIndex: activeEvent ? activeEvent.noteIndex : 0,
        currentNoteId: activeEvent ? activeEvent.note.id : null,
        currentTime: Math.max(0, currentSongTime),
        totalDuration,
        progressPercent,
      });

      this.trackingTimerId = setTimeout(() => {
        this.trackingTimerId = null;
        if (this.isPlaying) {
          this.animationFrameId = requestAnimationFrame(tick);
        }
      }, frameIntervalMs);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  public pause() {
    if (!this.isPlaying || this.isPaused) return;
    this.pausedSongTime = this.getCurrentPlaybackTime();
    this.isPaused = true;
    this.isPlaying = false;
    this.wasInterruptedByTabSwitch = false;
    this.stopAudioNodes();
    this.cancelTrackingLoop();
    this.clearPlaybackSchedule();
    this.scheduledTimeoutIds.forEach(id => clearTimeout(id));
    this.scheduledTimeoutIds = [];

    const duration = this.currentSong ? this.calculateSongDuration(this.currentSong) : 0;
    const loc = this.currentSong
      ? this.getPlaybackLocationAtTime(this.currentSong, this.pausedSongTime)
      : {
          measureIndex: this.currentState.currentMeasureIndex,
          noteIndex: this.currentState.currentNoteIndex,
          noteId: this.currentState.currentNoteId,
        };

    this.notifyState({
      isPlaying: false,
      isPaused: true,
      currentMeasureIndex: loc.measureIndex,
      currentNoteIndex: loc.noteIndex,
      currentNoteId: loc.noteId,
      currentTime: this.pausedSongTime,
      totalDuration: duration,
      progressPercent: duration > 0 ? (this.pausedSongTime / duration) * 100 : 0,
    });
    this.scheduleAutoSuspend(2000);
  }

  public resume() {
    this.wasInterruptedByTabSwitch = false;
    if (this.currentSong && (this.isPaused || !this.isPlaying)) {
      this.play(this.currentSong, this.pausedSongTime);
    }
  }

  public stop(notify: boolean = true) {
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedSongTime = 0;
    this.wasInterruptedByTabSwitch = false;
    this.stopAudioNodes();
    this.cancelTrackingLoop();
    this.clearPlaybackSchedule();
    this.scheduledTimeoutIds.forEach(id => clearTimeout(id));
    this.scheduledTimeoutIds = [];

    if (notify) {
      const duration = this.currentSong ? this.calculateSongDuration(this.currentSong) : 0;
      this.notifyState({
        isPlaying: false,
        isPaused: false,
        currentMeasureIndex: 0,
        currentNoteIndex: 0,
        currentNoteId: null,
        currentTime: 0,
        totalDuration: duration,
        progressPercent: 0,
      });
      this.scheduleAutoSuspend(1500);
    }
  }

  /**
   * Get the start time of a specific measure in seconds
   */
  public getMeasureStartTime(song: Song, measureIndex: number): number {
    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;
    let accumulatedTime = 0;

    const limit = Math.min(measureIndex, song.measures.length);
    for (let i = 0; i < limit; i++) {
      let measureBeats = 0;
      for (const note of song.measures[i].notes) {
        if (!isNonNotationItem(note) && note.duration > 0 && note.pitch !== 'empty') {
          measureBeats += note.duration;
        }
      }
      accumulatedTime += measureBeats * secPerBeat;
    }
    return accumulatedTime;
  }

  /**
   * Get the end time of a specific measure in seconds
   */
  public getMeasureEndTime(song: Song, measureIndex: number): number {
    return this.getMeasureStartTime(song, measureIndex + 1);
  }

  /**
   * Get the start time of a specific note in a song in seconds
   */
  public getNoteStartTime(song: Song, measureIndex: number, noteIndex: number): number {
    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;
    let accumulatedTime = 0;

    const mLimit = Math.max(0, Math.min(measureIndex, song.measures.length));
    for (let i = 0; i < mLimit; i++) {
      let measureBeats = 0;
      for (const note of song.measures[i].notes) {
        if (!isNonNotationItem(note) && note.duration > 0 && note.pitch !== 'empty') {
          measureBeats += note.duration;
        }
      }
      accumulatedTime += measureBeats * secPerBeat;
    }

    if (measureIndex >= 0 && measureIndex < song.measures.length) {
      const targetMeasure = song.measures[measureIndex];
      const nLimit = Math.max(0, Math.min(noteIndex, targetMeasure.notes.length));
      for (let j = 0; j < nLimit; j++) {
        const note = targetMeasure.notes[j];
        if (!isNonNotationItem(note) && note.duration > 0 && note.pitch !== 'empty') {
          accumulatedTime += note.duration * secPerBeat;
        }
      }
    }

    return accumulatedTime;
  }

  /**
   * Determine exact measureIndex and noteIndex at a given target time
   */
  public getPlaybackLocationAtTime(song: Song, targetTimeSec: number): {
    measureIndex: number;
    noteIndex: number;
    noteId: string | null;
  } {
    if (!song.measures.length) {
      return { measureIndex: 0, noteIndex: 0, noteId: null };
    }

    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;
    let accumulatedTime = 0;
    const EPSILON = 0.001; // 1ms tolerance to avoid float boundary overshoots

    for (let mIdx = 0; mIdx < song.measures.length; mIdx++) {
      const measure = song.measures[mIdx];
      const isLastMeasure = mIdx === song.measures.length - 1;

      for (let nIdx = 0; nIdx < measure.notes.length; nIdx++) {
        const note = measure.notes[nIdx];
        const isNonNotation = isNonNotationItem(note) || note.pitch === 'empty' || note.duration <= 0;
        const noteDurationSec = isNonNotation ? 0 : note.duration * secPerBeat;
        const isLastNote = isLastMeasure && nIdx === measure.notes.length - 1;

        // If targetTime falls within this note's window or at the end of the song
        if (
          isLastNote ||
          (noteDurationSec > 0 && targetTimeSec < accumulatedTime + noteDurationSec - EPSILON)
        ) {
          return {
            measureIndex: mIdx,
            noteIndex: nIdx,
            noteId: note.id,
          };
        }

        accumulatedTime += noteDurationSec;
      }
    }

    return {
      measureIndex: 0,
      noteIndex: 0,
      noteId: song.measures[0]?.notes[0]?.id || null,
    };
  }

  public seekToMeasure(song: Song, measureIndex: number) {
    const targetTime = this.getMeasureStartTime(song, measureIndex);
    this.seek(song, targetTime);
  }

  public seek(song: Song, targetTimeSec: number) {
    const wasPlaying = this.isPlaying;
    this.stopAudioNodes();
    this.cancelTrackingLoop();
    this.clearPlaybackSchedule();
    this.currentSong = song;
    this.pausedSongTime = targetTimeSec;

    const totalDuration = this.calculateSongDuration(song);
    const progressPercent = totalDuration > 0 ? Math.min(100, (targetTimeSec / totalDuration) * 100) : 0;

    if (wasPlaying) {
      this.play(song, targetTimeSec);
    } else {
      this.isPaused = true;
      this.isPlaying = false;
      const loc = this.getPlaybackLocationAtTime(song, targetTimeSec);
      this.notifyState({
        isPlaying: false,
        isPaused: true,
        currentMeasureIndex: loc.measureIndex,
        currentNoteIndex: loc.noteIndex,
        currentNoteId: loc.noteId,
        currentTime: targetTimeSec,
        totalDuration,
        progressPercent,
      });
    }
  }

  private stopAudioNodes() {
    this.stopAllSustainedNotes();
    // 1. Immediately stop and disconnect all scheduled/playing oscillators
    const currentOscs = [...this.activeOscillators];
    this.activeOscillators = [];
    for (const osc of currentOscs) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // already stopped or disconnected
      }
    }

    // 2. Disconnect and recreate track sub-gains so any orphaned nodes can never produce sound
    if (this.ctx && this.masterGain) {
      try {
        this.melodyGain?.disconnect();
        this.backingFilter?.disconnect();
        this.backingGain?.disconnect();
        this.metronomeGain?.disconnect();
      } catch {}

      this.melodyGain = this.ctx.createGain();
      this.melodyGain.gain.setValueAtTime(this.options.melodyVolume, this.ctx.currentTime);
      this.melodyGain.connect(this.masterGain);

      this.backingFilter = this.ctx.createBiquadFilter();
      this.backingFilter.type = 'lowpass';
      this.backingFilter.frequency.setValueAtTime(1600, this.ctx.currentTime);
      this.backingFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

      this.backingGain = this.ctx.createGain();
      const effectiveBacking = this.options.chordEnabled !== false ? this.options.backingVolume : 0;
      this.backingGain.gain.setValueAtTime(effectiveBacking, this.ctx.currentTime);
      this.backingFilter.connect(this.backingGain);
      this.backingGain.connect(this.masterGain);

      this.metronomeGain = this.ctx.createGain();
      this.metronomeGain.gain.setValueAtTime(this.options.metronomeVolume, this.ctx.currentTime);
      this.metronomeGain.connect(this.masterGain);
    }
  }
}

// Global singleton instance for easy cross-component access
export const audioEngine = new AudioEngine();
