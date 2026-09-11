import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createAudioClockMetronome } from '../lib/keyboard/audioClockMetronome.ts';

describe('audioClockMetronome', () => {
  it('schedules clicks on the audio clock, not wall-clock interval period', () => {
    let now = 10;
    const clicks: number[] = [];
    const beats: number[] = [];

    const metro = createAudioClockMetronome({
      getCurrentTime: () => now,
      scheduleClick: when => clicks.push(when),
      onBeat: ({ beatInBar }) => beats.push(beatInBar),
      bpm: 120,
      beatsPerBar: 4,
      startAt: 10,
      lookaheadSec: 0.6,
      syncUi: true,
    });

    metro.tick();
    assert.deepEqual(clicks, [10, 10.5]);
    assert.deepEqual(beats, [1, 2]);

    now = 10.6;
    metro.tick();
    assert.deepEqual(clicks, [10, 10.5, 11]);
    assert.deepEqual(beats, [1, 2, 3]);
    metro.stop();
  });

  it('skips clicks that are already late after a clock jump', () => {
    let now = 0;
    const clicks: number[] = [];
    const metro = createAudioClockMetronome({
      getCurrentTime: () => now,
      scheduleClick: when => clicks.push(when),
      bpm: 120,
      beatsPerBar: 4,
      startAt: 0,
      lookaheadSec: 0.3,
      syncUi: true,
    });

    metro.tick();
    assert.deepEqual(clicks, [0]);

    now = 2;
    metro.tick();
    assert.ok(clicks.every(t => t === 0 || t >= 2 - 0.08));
    assert.ok(!clicks.includes(0.5));
    metro.stop();
  });

  it('invokes onComplete at the beat after maxBeats', () => {
    let now = 0;
    let completeAt: number | null = null;
    const clicks: number[] = [];

    const metro = createAudioClockMetronome({
      getCurrentTime: () => now,
      scheduleClick: when => clicks.push(when),
      bpm: 120,
      beatsPerBar: 4,
      startAt: 0,
      lookaheadSec: 2,
      maxBeats: 3,
      syncUi: true,
      scheduleCallback: (when, cb) => {
        cb();
        return () => {};
      },
      onComplete: when => {
        completeAt = when;
      },
    });

    metro.tick();
    assert.deepEqual(clicks, [0, 0.5, 1]);
    assert.equal(completeAt, 1.5);
    metro.stop();
  });
});
