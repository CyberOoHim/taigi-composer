/**
 * Lookahead metronome driven by an audio (or virtual) clock.
 * Beat times come from getCurrentTime(), not from setInterval period — iPadOS
 * may coalesce wall-clock timers, but already-scheduled Web Audio nodes stay on grid.
 */

export interface AudioClockBeatInfo {
  beatInBar: number;
  isDownbeat: boolean;
  audioTime: number;
}

export interface AudioClockMetronomeOptions {
  getCurrentTime: () => number;
  scheduleClick?: (when: number, isDownbeat: boolean) => void;
  onBeat?: (info: AudioClockBeatInfo) => void;
  /** Called at the audio time immediately after `maxBeats` have been produced. */
  onComplete?: (nextBeatTime: number) => void;
  bpm: number;
  beatsPerBar: number;
  /** 1-based beat index to start on. Default 1. */
  startBeat?: number;
  /** Audio time of the first beat. Default getCurrentTime(). */
  startAt?: number;
  lookaheadSec?: number;
  schedulerIntervalMs?: number;
  shouldClick?: () => boolean;
  /** Stop after this many beats and invoke onComplete at the following beat time. */
  maxBeats?: number;
  scheduleCallback?: (when: number, cb: () => void) => () => void;
  /** Fire onBeat when the beat is scheduled (tests) instead of delaying to audio time. */
  syncUi?: boolean;
}

export interface AudioClockMetronomeController {
  tick: () => void;
  stop: () => void;
  start: () => () => void;
}

export function createAudioClockMetronome(
  options: AudioClockMetronomeOptions
): AudioClockMetronomeController {
  const bpm = Math.max(20, Math.min(300, options.bpm || 80));
  const secondsPerBeat = 60 / bpm;
  const beatsPerBar = Math.max(1, Math.floor(options.beatsPerBar) || 4);
  const lookaheadSec = options.lookaheadSec ?? 0.25;
  const schedulerIntervalMs = options.schedulerIntervalMs ?? 25;

  let nextNoteTime = options.startAt ?? options.getCurrentTime();
  let beatInBar = options.startBeat ?? 1;
  let beatsScheduled = 0;
  let stopped = false;
  let completeArmed = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let cancelComplete: (() => void) | null = null;
  const uiTimers: Array<ReturnType<typeof setTimeout>> = [];

  function stop() {
    if (stopped) return;
    stopped = true;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    for (const id of uiTimers) clearTimeout(id);
    uiTimers.length = 0;
    cancelComplete?.();
    cancelComplete = null;
  }

  function fireUi(beat: number, isDownbeat: boolean, when: number) {
    if (!options.onBeat || stopped) return;
    options.onBeat({ beatInBar: beat, isDownbeat, audioTime: when });
  }

  function scheduleUi(beat: number, isDownbeat: boolean, when: number) {
    if (!options.onBeat) return;
    if (options.syncUi) {
      fireUi(beat, isDownbeat, when);
      return;
    }
    const delayMs = Math.max(0, (when - options.getCurrentTime()) * 1000);
    const id = setTimeout(() => fireUi(beat, isDownbeat, when), delayMs);
    uiTimers.push(id);
  }

  function armComplete(when: number) {
    if (completeArmed || !options.onComplete) return;
    completeArmed = true;
    const fire = () => {
      if (stopped) return;
      const cb = options.onComplete;
      stop();
      cb?.(when);
    };

    if (options.scheduleCallback) {
      cancelComplete = options.scheduleCallback(when, fire);
      return;
    }

    const delayMs = Math.max(0, (when - options.getCurrentTime()) * 1000);
    const id = setTimeout(fire, delayMs);
    cancelComplete = () => clearTimeout(id);
  }

  function tick() {
    if (stopped) return;
    const now = options.getCurrentTime();
    const horizon = now + lookaheadSec;

    if (options.maxBeats != null && beatsScheduled >= options.maxBeats) {
      if (now >= nextNoteTime - 0.008) {
        armComplete(nextNoteTime);
      }
      return;
    }

    while (!stopped && nextNoteTime < horizon) {
      if (options.maxBeats != null && beatsScheduled >= options.maxBeats) {
        armComplete(nextNoteTime);
        break;
      }

      const isLate = nextNoteTime < now - 0.08;
      if (!isLate) {
        const isDownbeat = beatInBar === 1;
        if (options.shouldClick?.() !== false) {
          options.scheduleClick?.(nextNoteTime, isDownbeat);
        }
        scheduleUi(beatInBar, isDownbeat, nextNoteTime);
      }

      beatsScheduled += 1;
      beatInBar = (beatInBar % beatsPerBar) + 1;
      nextNoteTime += secondsPerBeat;
    }
  }

  function start() {
    tick();
    if (!stopped && intervalId === null) {
      intervalId = setInterval(tick, schedulerIntervalMs);
    }
    return stop;
  }

  return { tick, stop, start };
}

export function startAudioClockMetronome(options: AudioClockMetronomeOptions): () => void {
  return createAudioClockMetronome(options).start();
}
