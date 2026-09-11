import type { Song } from '../types/song.ts';

const MAX_HISTORY_LENGTH = 60;

export interface SongHistoryReducerState {
  past: Song[];
  present: Song;
  future: Song[];
  contentRevision: number;
}

export type SongHistoryAction =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_SONG'; payload: Song | ((current: Song) => Song) }
  | { type: 'LOAD_SONG'; payload: Song; unsaved?: boolean };

export function songHistoryReducer(
  state: SongHistoryReducerState,
  action: SongHistoryAction
): SongHistoryReducerState {
  switch (action.type) {
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [state.present, ...state.future],
        contentRevision: state.contentRevision + 1,
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        past: [...state.past, state.present],
        present: next,
        future: newFuture,
        contentRevision: state.contentRevision + 1,
      };
    }
    case 'SET_SONG': {
      const nextSong = typeof action.payload === 'function' ? action.payload(state.present) : action.payload;
      if (state.present === nextSong) {
        return state;
      }
      const newPast = [...state.past, state.present];
      return {
        past:
          newPast.length > MAX_HISTORY_LENGTH
            ? newPast.slice(newPast.length - MAX_HISTORY_LENGTH)
            : newPast,
        present: nextSong,
        future: [],
        contentRevision: state.contentRevision + 1,
      };
    }
    case 'LOAD_SONG': {
      return {
        past: [],
        present: action.payload,
        future: [],
        contentRevision: action.unsaved ? 1 : 0,
      };
    }
    default:
      return state;
  }
}

export function createSongHistoryState(present: Song): SongHistoryReducerState {
  return { past: [], present, future: [], contentRevision: 0 };
}
