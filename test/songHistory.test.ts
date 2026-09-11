import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  songHistoryReducer,
  createSongHistoryState,
  type SongHistoryReducerState,
} from '../lib/songHistory.ts';
import type { Song } from '../types/song.ts';

function song(id: string, title = id): Song {
  return {
    id,
    title,
    key: 'C',
    timeSignature: '4/4',
    bpm: 80,
    measures: [],
  };
}

function initial(present: Song): SongHistoryReducerState {
  return createSongHistoryState(present);
}

describe('songHistoryReducer dirty/contentRevision', () => {
  it('does not increment contentRevision on LOAD_SONG', () => {
    const loaded = song('loaded');
    const next = songHistoryReducer(initial(song('seed')), {
      type: 'LOAD_SONG',
      payload: loaded,
    });
    assert.equal(next.present.id, 'loaded');
    assert.equal(next.contentRevision, 0);
    assert.equal(next.past.length, 0);
  });

  it('marks unsaved loads with contentRevision 1', () => {
    const next = songHistoryReducer(initial(song('seed')), {
      type: 'LOAD_SONG',
      payload: song('scanned'),
      unsaved: true,
    });
    assert.equal(next.contentRevision, 1);
    assert.equal(next.present.id, 'scanned');
  });

  it('increments contentRevision on SET_SONG, UNDO, and REDO', () => {
    const a = song('a');
    const b = song('b');
    let state = songHistoryReducer(initial(a), { type: 'SET_SONG', payload: b });
    assert.equal(state.contentRevision, 1);
    assert.equal(state.present.id, 'b');

    state = songHistoryReducer(state, { type: 'UNDO' });
    assert.equal(state.contentRevision, 2);
    assert.equal(state.present.id, 'a');

    state = songHistoryReducer(state, { type: 'REDO' });
    assert.equal(state.contentRevision, 3);
    assert.equal(state.present.id, 'b');
  });

  it('resets contentRevision when a library song is loaded after edits', () => {
    let state = songHistoryReducer(initial(song('a')), { type: 'SET_SONG', payload: song('edited') });
    assert.equal(state.contentRevision, 1);
    state = songHistoryReducer(state, { type: 'LOAD_SONG', payload: song('preset') });
    assert.equal(state.contentRevision, 0);
    assert.equal(state.past.length, 0);
  });

  it('ignores SET_SONG when the present reference is unchanged', () => {
    const present = song('same');
    const state = initial(present);
    const next = songHistoryReducer(state, { type: 'SET_SONG', payload: present });
    assert.equal(next, state);
    assert.equal(next.contentRevision, 0);
  });
});
