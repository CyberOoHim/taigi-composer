import { InstrumentType, JianpuNote, KeySignature, Measure, Song } from '@/types/song';
import { getChordNotes, getPitchFrequency, isNonNotationItem } from './taigiUtils';

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

export interface AudioEngineOptions {
  instrument?: InstrumentType;
  melodyVolume?: number;    // 0 to 1
  backingVolume?: number;   // 0 to 1
  metronomeVolume?: number; // 0 to 1
  transpose?: number;       // Semitones (-12 to +12)
  tempoMultiplier?: number; // 0.5 to 2.0
  loopMeasure?: number | null; // index of measure to loop, or null
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
  };

  private isPlaying = false;
  private isPaused = false;
  private startAudioTime = 0;
  private pausedSongTime = 0;
  private animationFrameId: number | null = null;
  private scheduledTimeoutIds: number[] = [];
  private activeOscillators: OscillatorNode[] = [];

  // Listeners
  private stateListeners: ((state: PlaybackState) => void)[] = [];
  private endedListeners: (() => void)[] = [];
  public onNoteStart?: (measureIndex: number, noteIndex: number, note: JianpuNote, durationSec: number) => void;
  public onMeasureStart?: (measureIndex: number) => void;

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

  private notifyState(state: PlaybackState) {
    this.stateListeners.forEach(l => l(state));
  }

  private notifyEnded() {
    this.endedListeners.forEach(l => l());
  }

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

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
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
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

    this.playTone(
      freq,
      this.ctx.currentTime,
      Math.min(durationSec, 1.2),
      this.melodyGain,
      this.options.instrument
    );
  }

  private registerOscillator(osc: OscillatorNode) {
    this.activeOscillators.push(osc);
    osc.onended = () => {
      this.activeOscillators = this.activeOscillators.filter(o => o !== osc);
    };
  }

  /**
   * Synthesize instrument sound
   */
  private playTone(
    freq: number,
    startTime: number,
    duration: number,
    destination: GainNode,
    instrument: InstrumentType
  ) {
    if (!this.ctx || freq <= 0) return;

    const osc = this.ctx.createOscillator();
    this.registerOscillator(osc);
    const gain = this.ctx.createGain();

    switch (instrument) {
      case 'piano': {
        // Multi-harmonic acoustic piano-like simulation
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        // Sub oscillator for depth
        const subOsc = this.ctx.createOscillator();
        this.registerOscillator(subOsc);
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(freq * 2, startTime);
        subGain.gain.setValueAtTime(0.3, startTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, startTime + Math.max(duration * 0.7, 0.1));
        subOsc.connect(subGain);
        subGain.connect(gain);
        subOsc.start(startTime);
        subOsc.stop(startTime + duration + 0.1);

        // Fast punch attack, natural exponential decay
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.8, startTime + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(duration * 0.95, 0.2));
        break;
      }
      case 'flute': {
        // Traditional Taiwanese bamboo flute / Xiao / Dizi style
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        // Subtle vibrato LFO
        const lfo = this.ctx.createOscillator();
        this.registerOscillator(lfo);
        const lfoGain = this.ctx.createGain();
        lfo.frequency.setValueAtTime(5.5, startTime); // 5.5 Hz vibrato
        lfoGain.gain.setValueAtTime(freq * 0.015, startTime);
        lfo.connect(osc.frequency);
        lfo.start(startTime + 0.1);
        lfo.stop(startTime + duration);

        // Overtone harmonic for breathy timber
        const overtone = this.ctx.createOscillator();
        this.registerOscillator(overtone);
        const overtoneGain = this.ctx.createGain();
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 3, startTime);
        overtoneGain.gain.setValueAtTime(0.08, startTime);
        overtoneGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        overtone.connect(overtoneGain);
        overtoneGain.connect(gain);
        overtone.start(startTime);
        overtone.stop(startTime + duration);

        // Soft breathy attack and smooth sustain
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.7, startTime + 0.06);
        gain.gain.setValueAtTime(0.65, startTime + duration * 0.8);
        gain.gain.linearRampToValueAtTime(0.0001, startTime + duration);
        break;
      }
      case 'guitar': {
        // Nylon acoustic guitar pluck
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 4, startTime);
        filter.frequency.exponentialRampToValueAtTime(freq * 1.2, startTime + Math.max(duration * 0.6, 0.15));

        osc.disconnect();
        osc.connect(filter);
        filter.connect(gain);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.75, startTime + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.9);
        break;
      }
      case 'synth': {
        // Classic 80s/90s KTV Karaoke FM Brass / Synth Lead
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, startTime);
        filter.Q.setValueAtTime(3.0, startTime);

        osc.disconnect();
        osc.connect(filter);
        filter.connect(gain);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.6, startTime + 0.03);
        gain.gain.setValueAtTime(0.5, startTime + duration * 0.75);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        break;
      }
      case 'bell': {
        // Glockenspiel / music box bell
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        const bell2 = this.ctx.createOscillator();
        this.registerOscillator(bell2);
        const bell2Gain = this.ctx.createGain();
        bell2.type = 'sine';
        bell2.frequency.setValueAtTime(freq * 2.756, startTime);
        bell2Gain.gain.setValueAtTime(0.4, startTime);
        bell2Gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(duration * 0.5, 0.2));
        bell2.connect(bell2Gain);
        bell2Gain.connect(gain);
        bell2.start(startTime);
        bell2.stop(startTime + duration);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.8, startTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        break;
      }
    }

    osc.connect(gain);
    gain.connect(destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
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
        // Punctuation, annotations, and blank whitespace do not occupy any time duration when playing
        if (!isNonNotationItem(note)) {
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
    if (!targetMeasure || targetMeasure.notes.length === 0) return;

    this.currentSong = song;
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedSongTime = 0;

    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;

    let measureBeats = 0;
    for (const note of targetMeasure.notes) {
      if (!isNonNotationItem(note)) {
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

    let noteTime = 0;
    targetMeasure.notes.forEach((note, nIdx) => {
      const isNonNotation = isNonNotationItem(note);
      const noteDurationSec = isNonNotation ? 0 : note.duration * secPerBeat;
      const scheduleAt = audioStart + noteTime;

      if (!isNonNotation) {
        const freq = getPitchFrequency(
          song.key,
          note.pitch,
          note.octave,
          note.accidental,
          this.options.transpose
        );

        if (freq > 0) {
          this.playTone(
            freq,
            scheduleAt,
            noteDurationSec,
            this.melodyGain!,
            this.options.instrument
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
    const chordName = targetMeasure.chord || '';
    for (let b = 0; b < beatsPerBar; b++) {
      const beatTime = audioStart + b * secPerBeat;
      this.playMetronomeClick(beatTime, b === 0);
      if (chordName) {
        this.playChordBeat(chordName, beatTime, secPerBeat, b === 0);
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

    if (!verseNotes || verseNotes.length === 0) return;

    this.currentSong = song;
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedSongTime = 0;

    const effectiveBpm = song.bpm * this.options.tempoMultiplier;
    const secPerBeat = 60 / effectiveBpm;

    let totalVerseBeats = 0;
    for (const item of verseNotes) {
      if (!isNonNotationItem(item.note)) {
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

    let noteTime = 0;
    let lastChord = '';

    verseNotes.forEach(item => {
      const { note, measureIdx, noteIdx } = item;
      const isNonNotation = isNonNotationItem(note);
      const noteDurationSec = isNonNotation ? 0 : note.duration * secPerBeat;
      const scheduleAt = audioStart + noteTime;

      if (!isNonNotation) {
        const freq = getPitchFrequency(
          song.key,
          note.pitch,
          note.octave,
          note.accidental,
          this.options.transpose
        );

        if (freq > 0) {
          this.playTone(
            freq,
            scheduleAt,
            noteDurationSec,
            this.melodyGain!,
            this.options.instrument
          );
        }

        const m = song.measures[measureIdx];
        if (m?.chord && m.chord !== lastChord) {
          this.playChordBeat(m.chord, scheduleAt, Math.min(secPerBeat, noteDurationSec), true);
          lastChord = m.chord;
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
   * Start song playback from specified time or beginning
   */
  public play(song: Song, startFromSec: number = 0) {
    this.initContext();
    this.stop(); // Stop any existing playback

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

    song.measures.forEach((measure, mIdx) => {
      let measureTime = accumulatedSongTime;
      let measureBeatsCount = 0;

      // Determine time signature beats
      const tsParts = (measure.timeSignature || song.timeSignature).split('/');
      const beatsPerBar = parseInt(tsParts[0], 10) || 4;

      measure.notes.forEach((note, nIdx) => {
        const isNonNotation = isNonNotationItem(note);
        const noteDurationSec = isNonNotation ? 0 : note.duration * secPerBeat;
        const noteStartTime = measureTime;

        // Schedule melody note if it starts at or after our playback cursor
        if (!isNonNotation) {
          if (noteStartTime + noteDurationSec >= startFromSec) {
            const scheduleAt = this.startAudioTime + noteStartTime;
            if (scheduleAt >= this.ctx!.currentTime) {
              const freq = getPitchFrequency(
                song.key,
                note.pitch,
                note.octave,
                note.accidental,
                this.options.transpose
              );

              if (freq > 0) {
                this.playTone(
                  freq,
                  scheduleAt,
                  noteDurationSec,
                  this.melodyGain!,
                  this.options.instrument
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

        if (!isNonNotation) {
          measureTime += noteDurationSec;
          measureBeatsCount += note.duration;
        }
      });

      // Schedule chord backing and metronome per beat of this measure
      const chordName = measure.chord || '';
      for (let b = 0; b < beatsPerBar; b++) {
        const beatTime = accumulatedSongTime + b * secPerBeat;
        if (beatTime >= startFromSec) {
          const scheduleAt = this.startAudioTime + beatTime;
          if (scheduleAt >= this.ctx!.currentTime) {
            // Metronome
            this.playMetronomeClick(scheduleAt, b === 0);
            // Chord backing
            if (chordName) {
              this.playChordBeat(chordName, scheduleAt, secPerBeat, b === 0);
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

    const tick = () => {
      if (!this.isPlaying || !this.ctx) return;

      const currentSongTime = this.ctx.currentTime - this.startAudioTime;

      if (currentSongTime >= totalDuration) {
        this.stop();
        this.notifyEnded();
        return;
      }

      // Find current active note in timeline
      let activeIdx = 0;
      for (let i = 0; i < timelineEvents.length; i++) {
        if (timelineEvents[i].time <= currentSongTime) {
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

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  public pause() {
    if (!this.isPlaying || this.isPaused || !this.ctx) return;
    this.pausedSongTime = Math.max(0, this.ctx.currentTime - this.startAudioTime);
    this.isPaused = true;
    this.isPlaying = false;
    this.stopAudioNodes();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    const duration = this.currentSong ? this.calculateSongDuration(this.currentSong) : 0;
    this.notifyState({
      isPlaying: false,
      isPaused: true,
      currentMeasureIndex: 0,
      currentNoteIndex: 0,
      currentNoteId: null,
      currentTime: this.pausedSongTime,
      totalDuration: duration,
      progressPercent: duration > 0 ? (this.pausedSongTime / duration) * 100 : 0,
    });
  }

  public resume() {
    if (this.currentSong && (this.isPaused || !this.isPlaying)) {
      this.play(this.currentSong, this.pausedSongTime);
    }
  }

  public stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedSongTime = 0;
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
        if (!isNonNotationItem(note)) {
          measureBeats += note.duration;
        }
      }
      accumulatedTime += measureBeats * secPerBeat;
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

    for (let mIdx = 0; mIdx < song.measures.length; mIdx++) {
      const measure = song.measures[mIdx];
      for (let nIdx = 0; nIdx < measure.notes.length; nIdx++) {
        const note = measure.notes[nIdx];
        const isNonNotation = isNonNotationItem(note);
        const noteDurationSec = isNonNotation ? 0 : note.duration * secPerBeat;

        // If targetTime falls within this note or at the end of the song
        if (
          accumulatedTime + noteDurationSec > targetTimeSec ||
          (mIdx === song.measures.length - 1 && nIdx === measure.notes.length - 1)
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
