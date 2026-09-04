import { useReducer, useCallback } from 'react';
import { Song } from '@/types/song';

const MAX_HISTORY_LENGTH = 60;

export interface SongHistoryState {
  song: Song;
  setSong: (newSong: Song | ((current: Song) => Song)) => void;
  loadNewSong: (newSong: Song) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  pastCount: number;
  futureCount: number;
}

interface State {
  past: Song[];
  present: Song;
  future: Song[];
}

type Action =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_SONG'; payload: Song | ((current: Song) => Song) }
  | { type: 'LOAD_SONG'; payload: Song };

function historyReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [state.present, ...state.future],
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
      };
    }
    case 'LOAD_SONG': {
      return {
        past: [],
        present: action.payload,
        future: [],
      };
    }
    default:
      return state;
  }
}

export function useSongHistory(initialSong: Song): SongHistoryState {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialSong,
    future: [],
  });

  const loadNewSong = useCallback((newSong: Song) => {
    dispatch({ type: 'LOAD_SONG', payload: newSong });
  }, []);

  const setSong = useCallback(
    (newSongOrUpdater: Song | ((current: Song) => Song)) => {
      dispatch({ type: 'SET_SONG', payload: newSongOrUpdater });
    },
    []
  );

  const undo = useCallback((): boolean => {
    if (state.past.length === 0) return false;
    dispatch({ type: 'UNDO' });
    return true;
  }, [state.past.length]);

  const redo = useCallback((): boolean => {
    if (state.future.length === 0) return false;
    dispatch({ type: 'REDO' });
    return true;
  }, [state.future.length]);

  return {
    song: state.present,
    setSong,
    loadNewSong,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    pastCount: state.past.length,
    futureCount: state.future.length,
  };
}
