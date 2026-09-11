import { useReducer, useCallback } from 'react';
import { Song } from '@/types/song';
import { createSongHistoryState, songHistoryReducer } from '@/lib/songHistory';

export interface SongHistoryState {
  song: Song;
  setSong: (newSong: Song | ((current: Song) => Song)) => void;
  loadNewSong: (newSong: Song, options?: { unsaved?: boolean }) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  pastCount: number;
  futureCount: number;
  /** Increments on SET_SONG / UNDO / REDO; resets to 0 on LOAD_SONG (unless unsaved). */
  contentRevision: number;
}

export function useSongHistory(initialSong: Song): SongHistoryState {
  const [state, dispatch] = useReducer(songHistoryReducer, initialSong, createSongHistoryState);

  const loadNewSong = useCallback((newSong: Song, options?: { unsaved?: boolean }) => {
    dispatch({ type: 'LOAD_SONG', payload: newSong, unsaved: options?.unsaved });
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
    contentRevision: state.contentRevision,
  };
}
