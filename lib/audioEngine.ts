import { ArticulationType, GraceNote, InstrumentType, JianpuNote, KeySignature, Measure, Song } from '@/types/song';
import { getChordNotes, getMeasureChords, getPitchFrequency, isNonNotationItem, isSamePitch, isSlurActive, isTieActive } from './taigiUtils';

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
  backingVolume?: number;   // 0 to 1
  metronomeVolume?: number; // 0 to 1
  transpose?: number;       // Semitones (-12 to +12)
  tempoMultiplier?: number; // 0.5 to 2.0
  loopMeasure?: number | null; // index of measure to loop, or null
  loopRange?: LoopRange | null; // A-B loop range, or null
  targetFps?: number;       // Target frame rate for UI updates (e.g. 30 normal, 20 eco)
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private melodyGain: GainNode | null = null;
  private backingGain: GainNode | null = null;
  private metronomeGain: GainNode | null = null;

  private currentSong: Song | null = null;
  private options: Required<AudioEngineOptions> = {
    instrument: 'piano',
    melodyVolume: 0.85,
    backingVolume: 0.45,
    metronomeVolume: 0.2,
    transpose: 0,
    tempoMultiplier: 1.0,
    loopMeasure: null,
    loopRange: null,
    targetFps: 30,
  };

  private isPlaying = false;
  private isPaused = false;
  private startAudioTime = 0;
  private pausedSongTime = 0;
  private animationFrameId: number | null = null;
  private scheduledTimeoutIds: number[] = [];
  private activeOscillators: OscillatorNode[] = [];
  private idleSuspendTimer: NodeJS.Timeout | null = null;

  // Listeners
  private stateListeners: ((state: PlaybackState) => void)[] = [];
  private endedListeners: (() => void)[] = [];
  private tabInterruptionListeners: ((info: { pausedAtTime: number }) => void)[] = [];
  public onNoteStart?: (measureIndex: number, noteIndex: number, note: JianpuNote, durationSec: number) => void;
  public onMeasureStart?: (measureIndex: number) => void;
  public onLoopIteration?: (iterationCount: number) => void;
  private currentLoopIteration = 0;

  private wasInterruptedByTabSwitch = false;
  private interruptedSongTime = 0;

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

  public subscribeEnded(listener: () => void): () => void {
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
    this.endedListeners.forEach(l => l());
  }

  /**
   * Transparent iOS Web Audio unlocker triggered on first user interaction.
   * Plays a 1ms inaudible buffer to wake up the iOS/iPadOS audio mixer if interrupted.
   */
  public unlockOnUserGesture = () => {
    if (typeof window === 'undefined') return;
    this.initContext();
    if (!this.ctx) return;

    const state = this.ctx.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      this.ctx.resume().catch(() => {});
    }

    try {
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
    } catch {
      // ignore
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
    if (typeof document !== 'undefined' && !document.hidden) {
      this.ensureContextActive().catch(() => {});
    }
  };

  private handleWindowBlur = () => {
    this.cancelAutoSuspend();
  };

  private handleLeavingTab = () => {
    this.cancelAutoSuspend();

    if (this.isPlaying) {
      // Accurately capture current playback timestamp before iOS freezes timers
      const currentPos = this.getCurrentPlaybackTime();
      this.interruptedSongTime = currentPos;
      this.pausedSongTime = currentPos;
      this.wasInterruptedByTabSwitch = true;

      // Cleanly stop scheduled audio oscillators and animation frame
      this.isPlaying = false;
      this.isPaused = true;
      this.stopAudioNodes();
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
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
    // 1. Recover / inspect AudioContext
    if (!this.ctx || this.ctx.state === 'closed') {
      this.initContext(true);
    } else {
      const state = this.ctx.state as string;
      if (state === 'suspended' || state === 'interrupted') {
        this.ctx.resume().catch(() => {});
      }
    }

    // 2. If playback was paused when leaving tab, notify listeners with the exact paused timestamp
    if (this.wasInterruptedByTabSwitch) {
      const pausedAt = this.interruptedSongTime;
      this.tabInterruptionListeners.forEach(listener => {
        try {
          listener({ pausedAtTime: pausedAt });
        } catch {}
      });
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

        this.backingGain = this.ctx.createGain();
        this.backingGain.gain.setValueAtTime(this.options.backingVolume, this.ctx.currentTime);
        this.backingGain.connect(this.masterGain);

        this.metronomeGain = this.ctx.createGain();
        this.metronomeGain.gain.setValueAtTime(this.options.metronomeVolume, this.ctx.currentTime);
        this.metronomeGain.connect(this.masterGain);
      } catch (e) {
        console.warn('[AudioEngine] Gain node initialization warning:', e);
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
    this.options = { ...this.options, ...opts };
    if (this.ctx && this.melodyGain && this.backingGain && this.metronomeGain) {
      this.melodyGain.gain.setValueAtTime(this.options.melodyVolume, this.ctx.currentTime);
      this.backingGain.gain.setValueAtTime(this.options.backingVolume, this.ctx.currentTime);
      this.metronomeGain.gain.setValueAtTime(this.options.metronomeVolume, this.ctx.currentTime);
    }
  }

  public getOptions(): Required<AudioEngineOptions> {
    return { ...this.options };
  }

  /**
   * Play a single preview note (e.g. clicking a note in the editor)
   */
  public previewNote(key: KeySignature, note: JianpuNote) {
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
    note: JianpuNote,
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

  /**
   * Synthesize instrument sound
   */
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

    if (options?.glideFromFreq && options.glideFromFreq > 0) {
      osc.frequency.setValueAtTime(options.glideFromFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq, startTime + Math.min(0.08, effectiveDuration * 0.5));
    }

    switch (instrument) {
      case 'piano': {
        // Multi-harmonic acoustic piano-like simulation
        osc.type = 'triangle';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }

        // Sub oscillator for depth
        const subOsc = this.ctx.createOscillator();
        this.registerOscillator(subOsc);
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(freq * 2, startTime);
        subGain.gain.setValueAtTime(0.3 * volMul, startTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, startTime + Math.max(effectiveDuration * 0.7, 0.1));
        subOsc.connect(subGain);
        subGain.connect(gain);
        subOsc.start(startTime);
        subOsc.stop(startTime + effectiveDuration + 0.1);

        // Fast punch attack or softened legato attack
        gain.gain.setValueAtTime(0.0001, startTime);
        if (isLegato) {
          gain.gain.linearRampToValueAtTime(0.7 * volMul, startTime + 0.022);
          gain.gain.setValueAtTime(0.5 * volMul, startTime + effectiveDuration * 0.85);
          gain.gain.linearRampToValueAtTime(0.0001, startTime + effectiveDuration);
        } else {
          gain.gain.linearRampToValueAtTime(0.8 * volMul, startTime + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.35 * volMul, startTime + 0.15);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(effectiveDuration * 0.95, 0.2));
        }
        break;
      }
      case 'flute': {
        // Traditional Taiwanese bamboo flute / Xiao / Dizi style
        osc.type = 'sine';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }

        // Subtle vibrato LFO
        const lfo = this.ctx.createOscillator();
        this.registerOscillator(lfo);
        const lfoGain = this.ctx.createGain();
        lfo.frequency.setValueAtTime(5.5, startTime); // 5.5 Hz vibrato
        lfoGain.gain.setValueAtTime(freq * 0.015, startTime);
        lfo.connect(osc.frequency);
        lfo.start(startTime + 0.1);
        lfo.stop(startTime + effectiveDuration);

        // Overtone harmonic for breathy timber
        const overtone = this.ctx.createOscillator();
        this.registerOscillator(overtone);
        const overtoneGain = this.ctx.createGain();
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 3, startTime);
        overtoneGain.gain.setValueAtTime(0.08 * volMul, startTime);
        overtoneGain.gain.exponentialRampToValueAtTime(0.001, startTime + effectiveDuration);
        overtone.connect(overtoneGain);
        overtoneGain.connect(gain);
        overtone.start(startTime);
        overtone.stop(startTime + effectiveDuration);

        // Soft breathy attack and smooth sustain
        gain.gain.setValueAtTime(0.0001, startTime);
        const fluteAttack = isLegato ? 0.02 : 0.06;
        gain.gain.linearRampToValueAtTime(0.7 * volMul, startTime + fluteAttack);
        gain.gain.setValueAtTime(0.65 * volMul, startTime + effectiveDuration * 0.85);
        gain.gain.linearRampToValueAtTime(0.0001, startTime + effectiveDuration);
        break;
      }
      case 'whistle': {
        // Expressive Traditional Chinese Koudi / Whistle (口笛)
        osc.type = 'sine';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }

        // Gentle whistle vibrato LFO (5.8 Hz)
        const lfo = this.ctx.createOscillator();
        this.registerOscillator(lfo);
        const lfoGain = this.ctx.createGain();
        lfo.frequency.setValueAtTime(5.8, startTime);
        lfoGain.gain.setValueAtTime(freq * 0.012, startTime);
        lfo.connect(osc.frequency);
        lfo.start(startTime + 0.08);
        lfo.stop(startTime + effectiveDuration);

        // Breath / air overtone for authentic whistle timbre
        const breath = this.ctx.createOscillator();
        this.registerOscillator(breath);
        const breathGain = this.ctx.createGain();
        breath.type = 'sine';
        breath.frequency.setValueAtTime(freq * 2, startTime);
        breathGain.gain.setValueAtTime(0.04 * volMul, startTime);
        breathGain.gain.exponentialRampToValueAtTime(0.001, startTime + effectiveDuration);
        breath.connect(breathGain);
        breathGain.connect(gain);
        breath.start(startTime);
        breath.stop(startTime + effectiveDuration);

        gain.gain.setValueAtTime(0.0001, startTime);
        const whistleAttack = isLegato ? 0.02 : 0.04;
        gain.gain.linearRampToValueAtTime(0.85 * volMul, startTime + whistleAttack);
        gain.gain.setValueAtTime(0.75 * volMul, startTime + effectiveDuration * 0.82);
        gain.gain.linearRampToValueAtTime(0.0001, startTime + effectiveDuration);
        break;
      }
      case 'guitar': {
        // Nylon acoustic guitar pluck
        osc.type = 'sawtooth';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 4, startTime);
        filter.frequency.exponentialRampToValueAtTime(freq * 1.2, startTime + Math.max(effectiveDuration * 0.6, 0.15));

        osc.disconnect();
        osc.connect(filter);
        filter.connect(gain);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.75 * volMul, startTime + (isLegato ? 0.018 : 0.008));
        gain.gain.exponentialRampToValueAtTime(0.25 * volMul, startTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration * (isLegato ? 0.98 : 0.9));
        break;
      }
      case 'synth': {
        // Classic 80s/90s KTV Karaoke FM Brass / Synth Lead
        osc.type = 'sawtooth';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, startTime);
        filter.Q.setValueAtTime(3.0, startTime);

        osc.disconnect();
        osc.connect(filter);
        filter.connect(gain);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.6 * volMul, startTime + (isLegato ? 0.015 : 0.03));
        gain.gain.setValueAtTime(0.5 * volMul, startTime + effectiveDuration * 0.75);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
        break;
      }
      case 'bell': {
        // Glockenspiel / music box bell
        osc.type = 'sine';
        if (!options?.glideFromFreq) {
          osc.frequency.setValueAtTime(freq, startTime);
        }

        const bell2 = this.ctx.createOscillator();
        this.registerOscillator(bell2);
        const bell2Gain = this.ctx.createGain();
        bell2.type = 'sine';
        bell2.frequency.setValueAtTime(freq * 2.756, startTime);
        bell2Gain.gain.setValueAtTime(0.4 * volMul, startTime);
        bell2Gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(effectiveDuration * 0.5, 0.2));
        bell2.connect(bell2Gain);
        bell2Gain.connect(gain);
        bell2.start(startTime);
        bell2.stop(startTime + effectiveDuration);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.8 * volMul, startTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + effectiveDuration);
        break;
      }
    }

    osc.connect(gain);
    gain.connect(destination);

    osc.start(startTime);
    osc.stop(startTime + effectiveDuration + 0.05);
  }

  /**
   * Play a metronome click
   */
  private playMetronomeClick(startTime: number, isDownbeat: boolean) {
    if (!this.ctx || !this.metronomeGain || this.options.metronomeVolume <= 0.01) return;

    const osc = this.ctx.createOscillator();
    this.registerOscillator(osc);
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDownbeat ? 1200 : 800, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(isDownbeat ? 0.6 : 0.35, startTime + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.04);

    osc.connect(gain);
    gain.connect(this.metronomeGain);

    osc.start(startTime);
    osc.stop(startTime + 0.05);
  }

  /**
   * Play chord accompaniment pattern
   */
  private playChordBeat(chordName: string, startTime: number, beatDuration: number, isDownbeat: boolean) {
    if (!this.ctx || !this.backingGain || this.options.backingVolume <= 0.01) return;
    const chordFrequencies = getChordNotes(chordName, this.options.transpose);
    if (chordFrequencies.length === 0) return;

    // Arpeggiate / strum chord notes
    chordFrequencies.forEach((freq, idx) => {
      const stagger = idx * 0.015;
      const noteTime = startTime + stagger;
      const osc = this.ctx!.createOscillator();
      this.registerOscillator(osc);
      const gain = this.ctx!.createGain();

      osc.type = isDownbeat && idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      const noteDuration = beatDuration * 0.9;
      const vol = isDownbeat ? 0.35 : 0.22;

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(vol, noteTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + noteDuration);

      osc.connect(gain);
      gain.connect(this.backingGain!);

      osc.start(noteTime);
      osc.stop(noteTime + noteDuration + 0.05);
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
    this.stop(); // Stop any existing playback

    const targetMeasure = song.measures[measureIndex];
    if (!targetMeasure || targetMeasure.notes.length === 0 || !this.ctx) return;

    this.currentSong = song;
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedSongTime = 0;

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

    const audioStart = this.ctx!.currentTime + 0.05;
    this.startAudioTime = audioStart;

    const timelineEvents: {
      time: number;
      measureIndex: number;
      noteIndex: number;
      note: JianpuNote;
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
    const measureChords = getMeasureChords(targetMeasure);
    for (let b = 0; b < beatsPerBar; b++) {
      const beatTime = audioStart + b * secPerBeat;
      this.playMetronomeClick(beatTime, b === 0);
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
   * Play only a specific verse (sequence of notes across measures)
   */
  public playVerse(
    song: Song,
    verseNotes: { note: JianpuNote; measureIdx: number; noteIdx: number }[],
    onFinished?: () => void
  ) {
    this.initContext();
    this.stop(); // Stop any existing playback

    if (!verseNotes || verseNotes.length === 0 || !this.ctx) return;

    this.currentSong = song;
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedSongTime = 0;

    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;

    let totalVerseBeats = 0;
    for (const item of verseNotes) {
      if (!isNonNotationItem(item.note) && item.note.duration > 0 && item.note.pitch !== 'empty') {
        totalVerseBeats += item.note.duration;
      }
    }
    const totalVerseDurationSec = totalVerseBeats * secPerBeat;

    const audioStart = this.ctx!.currentTime + 0.05;
    this.startAudioTime = audioStart;

    const timelineEvents: {
      time: number;
      measureIndex: number;
      noteIndex: number;
      note: JianpuNote;
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
    let lastChord = '';

    verseNotes.forEach((item, itemIdx) => {
      const { note, measureIdx, noteIdx } = item;
      const isNonNotation = isNonNotationItem(note) || note.pitch === 'empty' || note.duration <= 0;
      const noteDurationSec = isNonNotation ? 0 : note.duration * secPerBeat;
      const scheduleAt = audioStart + noteTime;

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

        const m = song.measures[measureIdx];
        const mChords = getMeasureChords(m);
        if (mChords.length > 0) {
          const beatsInMeasure = (m.timeSignature || song.timeSignature) ? parseInt(m.timeSignature || song.timeSignature) || 4 : 4;
          const noteBeatInMeasure = (noteTime / secPerBeat) % beatsInMeasure;
          const chordIdx = Math.min(
            mChords.length - 1,
            Math.floor((noteBeatInMeasure / beatsInMeasure) * mChords.length)
          );
          const currentChord = mChords[chordIdx];
          if (currentChord && currentChord !== lastChord) {
            this.playChordBeat(currentChord, scheduleAt, Math.min(secPerBeat, noteDurationSec), true);
            lastChord = currentChord;
          }
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

      // Schedule UI callback for visual flashing dot
      const delayMs = Math.max(0, (scheduleAt - this.ctx.currentTime) * 1000);
      const timerId = setTimeout(() => {
        onBeat(b + 1, beatsPerBar);
      }, delayMs);
      this.scheduledTimeoutIds.push(timerId as unknown as number);
    }

    // Schedule finish callback right when count-in measure completes
    const totalLeadInSec = beatsPerBar * secPerBeat;
    const finishTimer = setTimeout(() => {
      onFinished();
    }, totalLeadInSec * 1000);
    this.scheduledTimeoutIds.push(finishTimer as unknown as number);
  }

  /**
   * Start song playback from specified time or beginning
   */
  public play(song: Song, startFromSec: number = 0) {
    this.initContext();
    this.stop(); // Stop any existing playback

    if (!this.ctx) return;

    this.currentSong = song;
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedSongTime = startFromSec;

    const totalDuration = this.calculateSongDuration(song);
    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;

    const audioStart = this.ctx!.currentTime + 0.08; // Small lookahead buffer
    this.startAudioTime = audioStart - startFromSec;

    // Schedule all notes, chords, metronome ticks
    let accumulatedSongTime = 0;

    // Store timelines for UI tracking
    const timelineEvents: {
      time: number;
      measureIndex: number;
      noteIndex: number;
      note: JianpuNote;
      durationSec: number;
    }[] = [];

    // Flatten all notes across the song to detect cross-measure ties and slurs
    interface FlatSongNote {
      measureIndex: number;
      noteIndex: number;
      note: JianpuNote;
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

        // Schedule melody note if it starts at or after our playback cursor
        if (!isNonNotation && note.duration > 0) {
          if (!isTiedContinuation[currentFlatIdx]) {
            const soundDuration = combinedSoundDurations[currentFlatIdx] || noteDurationSec;
            if (noteStartTime + soundDuration >= startFromSec) {
              const scheduleAt = this.startAudioTime + noteStartTime;
              if (scheduleAt >= this.ctx!.currentTime) {
                const nextFn = flatSongNotes[currentFlatIdx + 1];
                const prevFn = currentFlatIdx > 0 ? flatSongNotes[currentFlatIdx - 1] : null;
                const isSlurred = isSlurActive(note, nextFn?.note) || (prevFn ? isSlurActive(prevFn.note, note) : false);

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

      // Schedule chord backing and metronome per beat of this measure
      const measureChords = getMeasureChords(measure);
      for (let b = 0; b < beatsPerBar; b++) {
        const beatTime = accumulatedSongTime + b * secPerBeat;
        if (beatTime >= startFromSec) {
          const scheduleAt = this.startAudioTime + beatTime;
          if (scheduleAt >= this.ctx!.currentTime) {
            // Metronome
            this.playMetronomeClick(scheduleAt, b === 0);
            // Chord backing
            if (measureChords.length > 0) {
              const chordIdx = Math.min(
                measureChords.length - 1,
                Math.floor((b / beatsPerBar) * measureChords.length)
              );
              const currentChord = measureChords[chordIdx];
              const isChordChange = b === 0 || chordIdx !== Math.floor(((b - 1) / beatsPerBar) * measureChords.length);
              this.playChordBeat(currentChord, scheduleAt, secPerBeat, isChordChange);
            }
          }
        }
      }

      accumulatedSongTime += measureBeatsCount * secPerBeat;
    });

    // Start UI update animation loop
    this.startTrackingLoop(totalDuration, timelineEvents);
  }

  private startTrackingLoop(
    totalDuration: number,
    timelineEvents: {
      time: number;
      measureIndex: number;
      noteIndex: number;
      note: JianpuNote;
      durationSec: number;
    }[]
  ) {
    let lastActiveEventIdx = -1;
    let lastEmitTime = 0;
    const targetFps = this.options.targetFps || 30;
    const frameIntervalMs = 1000 / targetFps;

    const tick = (timestamp: number) => {
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
      let isEventChanged = false;

      if (activeIdx !== lastActiveEventIdx && activeEvent) {
        lastActiveEventIdx = activeIdx;
        isEventChanged = true;
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

      // Frame budgeting: throttle continuous UI time updates to target FPS (e.g. 30 normal, 20 eco),
      // but always dispatch immediately on note/measure transitions so visual sync is instant.
      const now = typeof performance !== 'undefined' ? performance.now() : timestamp || Date.now();
      if (isEventChanged || now - lastEmitTime >= frameIntervalMs || lastEmitTime === 0) {
        lastEmitTime = now;
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
      }

      this.animationFrameId = requestAnimationFrame(tick);
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
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
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

  public stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedSongTime = 0;
    this.wasInterruptedByTabSwitch = false;
    this.stopAudioNodes();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.scheduledTimeoutIds.forEach(id => clearTimeout(id));
    this.scheduledTimeoutIds = [];

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
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
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
        this.backingGain?.disconnect();
        this.metronomeGain?.disconnect();
      } catch {}

      this.melodyGain = this.ctx.createGain();
      this.melodyGain.gain.setValueAtTime(this.options.melodyVolume, this.ctx.currentTime);
      this.melodyGain.connect(this.masterGain);

      this.backingGain = this.ctx.createGain();
      this.backingGain.gain.setValueAtTime(this.options.backingVolume, this.ctx.currentTime);
      this.backingGain.connect(this.masterGain);

      this.metronomeGain = this.ctx.createGain();
      this.metronomeGain.gain.setValueAtTime(this.options.metronomeVolume, this.ctx.currentTime);
      this.metronomeGain.connect(this.masterGain);
    }
  }
}

// Global singleton instance for easy cross-component access
export const audioEngine = new AudioEngine();
