'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  EditorEditMode,
  JianpuNote,
  LyricDisplayMode,
  Measure,
  NoteDuration,
  PitchNumber,
  Song,
  VerseItem,
  VerseNoteRef,
} from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import {
  splitTaigiLyricSyllables,
  groupSongIntoVerses,
  splitVerseTextTokens,
  isPunctuationOrSpacer,
} from '@/lib/taigiUtils';
import { SongMetadataHeader } from './composer/SongMetadataHeader';
import { NoteEditorHud } from './composer/NoteEditorHud';
import { VerseModeView } from './composer/VerseModeView';
import { MeasureModeView } from './composer/MeasureModeView';
import {
  Plus,
  Music2,
  Undo2,
  Redo2,
  AlignLeft,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ComposerEditorProps {
  song: Song;
  onUpdateSong: (updatedSong: Song) => void;
  audioEngine: AudioEngine;
  displayMode: LyricDisplayMode;
  setDisplayMode: (mode: LyricDisplayMode) => void;
  onOpenAligner: () => void;
  targetMeasureIndex?: number | null;
  onTargetMeasureHandled?: () => void;
  onUndo?: () => boolean;
  onRedo?: () => boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  pastCount?: number;
  futureCount?: number;
}

let uniqueIdCounter = 0;
const generateId = (prefix: string) => {
  uniqueIdCounter += 1;
  return `${prefix}-${Date.now()}-${uniqueIdCounter}`;
};

export const ComposerEditor: React.FC<ComposerEditorProps> = ({
  song,
  onUpdateSong,
  audioEngine,
  displayMode,
  setDisplayMode,
  onOpenAligner,
  targetMeasureIndex,
  onTargetMeasureHandled,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  pastCount = 0,
  futureCount = 0,
}) => {
  // Edit Mode: 'verse' (default, separated by punctuation or spaces) vs 'measure' (sectioned by musical measures)
  const [editMode, setEditMode] = useState<EditorEditMode>('verse');
  const [selectedCoord, setSelectedCoord] = useState<[number, number] | null>([0, 0]);

  const [notification, setNotification] = useState<string | null>(null);
  const [playingMeasureIdx, setPlayingMeasureIdx] = useState<number | null>(null);
  const [playingVerseIdx, setPlayingVerseIdx] = useState<number | null>(null);
  const [activePlaybackNoteId, setActivePlaybackNoteId] = useState<string | null>(null);
  const [measureBatchTexts, setMeasureBatchTexts] = useState<{ [mIdx: number]: string }>({});
  const [verseBatchTexts, setVerseBatchTexts] = useState<{ [vIdx: number]: string }>({});

  const showNotice = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(prev => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Compute segmented verses based on punctuation (標點) or whitespace/rest pause (空白)
  const verses = useMemo(() => groupSongIntoVerses(song), [song]);

  // Subscribe to audio engine playback state
  useEffect(() => {
    const unsub = audioEngine.subscribeState(state => {
      setActivePlaybackNoteId(state.isPlaying ? state.currentNoteId : null);
      if (!state.isPlaying) {
        setPlayingMeasureIdx(null);
        setPlayingVerseIdx(null);
      }
    });
    return () => {
      unsub();
    };
  }, [audioEngine]);

  // Handle jump-to-section / target measure index request
  useEffect(() => {
    if (targetMeasureIndex !== null && targetMeasureIndex !== undefined && targetMeasureIndex >= 0) {
      const validMeasureIdx = Math.min(song.measures.length - 1, Math.max(0, targetMeasureIndex));

      // Smooth scroll and select corresponding note
      const timer = setTimeout(() => {
        setSelectedCoord([validMeasureIdx, 0]);

        // Preview the first note of this section/measure
        const note = song.measures[validMeasureIdx]?.notes[0];
        if (note) {
          audioEngine.previewNote(song.key, note);
        }

        if (editMode === 'verse') {
          const vIdx = verses.findIndex(v =>
            v.notes.some(n => n.measureIndex === validMeasureIdx)
          );
          if (vIdx !== -1) {
            const el = document.getElementById(`verse-card-${vIdx}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-4', 'ring-amber-500', 'bg-amber-100/30', 'dark:bg-amber-950/50');
              setTimeout(() => {
                el.classList.remove('ring-4', 'ring-amber-500', 'bg-amber-100/30', 'dark:bg-amber-950/50');
              }, 2200);
            }
          }
        } else {
          const el = document.getElementById(`measure-card-${validMeasureIdx}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-4', 'ring-amber-500', 'bg-amber-100/30', 'dark:bg-amber-950/50');
            setTimeout(() => {
              el.classList.remove('ring-4', 'ring-amber-500', 'bg-amber-100/30', 'dark:bg-amber-950/50');
            }, 2200);
          }
        }

        const secName = song.measures[validMeasureIdx]?.section || `第 ${validMeasureIdx + 1} 小節`;
        showNotice(`已跳轉至段落「${secName}」進行編寫`);

        if (onTargetMeasureHandled) {
          onTargetMeasureHandled();
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [targetMeasureIndex, editMode, verses, song, audioEngine, showNotice, onTargetMeasureHandled]);

  const selectedMeasureIndex = selectedCoord ? selectedCoord[0] : null;
  const selectedNoteIndex = selectedCoord ? selectedCoord[1] : null;

  const currentMeasure: Measure | null =
    selectedMeasureIndex !== null && song.measures[selectedMeasureIndex]
      ? song.measures[selectedMeasureIndex]
      : null;

  const currentNote: JianpuNote | null =
    currentMeasure && selectedNoteIndex !== null && currentMeasure.notes[selectedNoteIndex]
      ? currentMeasure.notes[selectedNoteIndex]
      : null;

  // Sound note on select
  const handleSelectNote = useCallback(
    (mIdx: number, nIdx: number, preview = true) => {
      setSelectedCoord([mIdx, nIdx]);
      const note = song.measures[mIdx]?.notes[nIdx];
      if (note && preview) {
        audioEngine.previewNote(song.key, note);
      }
    },
    [song, audioEngine]
  );

  // Dedicated Play/Stop Measure verification
  const handleTogglePlayMeasure = (mIdx: number) => {
    if (playingMeasureIdx === mIdx && audioEngine.getIsPlaying()) {
      audioEngine.stop();
      setPlayingMeasureIdx(null);
    } else {
      setPlayingVerseIdx(null);
      setPlayingMeasureIdx(mIdx);
      audioEngine.playMeasure(song, mIdx, () => {
        setPlayingMeasureIdx(null);
      });
    }
  };

  // Dedicated Play/Stop Verse verification (Verse Mode)
  const handleTogglePlayVerse = (vIdx: number, verseNotes: VerseNoteRef[]) => {
    if (playingVerseIdx === vIdx && audioEngine.getIsPlaying()) {
      audioEngine.stop();
      setPlayingVerseIdx(null);
    } else {
      setPlayingMeasureIdx(null);
      setPlayingVerseIdx(vIdx);
      audioEngine.playVerse(song, verseNotes, () => {
        setPlayingVerseIdx(null);
      });
    }
  };

  // Mutate specific note helper
  const updateNoteAt = useCallback(
    (
      mIdx: number,
      nIdx: number,
      updater: (note: JianpuNote) => JianpuNote
    ) => {
      const newMeasures = song.measures.map((m, currentMIdx) => {
        if (currentMIdx !== mIdx) return m;
        const newNotes = m.notes.map((n, currentNIdx) => {
          if (currentNIdx !== nIdx) return n;
          return updater({ ...n });
        });
        return { ...m, notes: newNotes };
      });

      onUpdateSong({ ...song, measures: newMeasures });
    },
    [song, onUpdateSong]
  );

  // Mutate currently selected note
  const updateSelectedNote = useCallback(
    (updater: (note: JianpuNote) => JianpuNote) => {
      if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
      updateNoteAt(selectedMeasureIndex, selectedNoteIndex, updater);
    },
    [selectedMeasureIndex, selectedNoteIndex, updateNoteAt]
  );

  // Change pitch
  const handleSetPitch = useCallback(
    (pitch: PitchNumber) => {
      updateSelectedNote(n => {
        const updated = { ...n, pitch };
        audioEngine.previewNote(song.key, updated);
        return updated;
      });
    },
    [updateSelectedNote, audioEngine, song.key]
  );

  // Change octave
  const handleSetOctave = (delta: number) => {
    updateSelectedNote(n => {
      const newOctave = Math.max(-2, Math.min(2, n.octave + delta));
      const updated = { ...n, octave: newOctave };
      audioEngine.previewNote(song.key, updated);
      return updated;
    });
  };

  // Change accidental
  const handleSetAccidental = (acc: '' | '#' | 'b') => {
    updateSelectedNote(n => {
      const updated = { ...n, accidental: n.accidental === acc ? '' : acc };
      audioEngine.previewNote(song.key, updated);
      return updated;
    });
  };

  // Change duration
  const handleSetDuration = (duration: NoteDuration) => {
    updateSelectedNote(n => ({
      ...n,
      duration,
      isDotted:
        duration === 1.5 ||
        duration === 0.75 ||
        duration === 3 ||
        duration === 0.375 ||
        duration === 1.75,
    }));
  };

  // Toggle dotted
  const handleToggleDotted = () => {
    updateSelectedNote(n => {
      let newDur = n.duration;
      let newDotted = !n.isDotted;
      if (newDotted) {
        if (n.duration === 1) newDur = 1.5;
        else if (n.duration === 0.5) newDur = 0.75;
        else if (n.duration === 2) newDur = 3;
        else if (n.duration === 0.25) newDur = 0.375;
        else newDur = Math.round(n.duration * 1.5 * 1000) / 1000;
      } else {
        if (n.duration === 1.5) newDur = 1;
        else if (n.duration === 0.75) newDur = 0.5;
        else if (n.duration === 3) newDur = 2;
        else if (n.duration === 0.375) newDur = 0.25;
        else newDur = Math.round((n.duration / 1.5) * 1000) / 1000;
      }
      return { ...n, duration: newDur, isDotted: newDotted };
    });
  };

  // Toggle tie
  const handleToggleTie = () => {
    updateSelectedNote(n => ({ ...n, isTied: !n.isTied }));
  };

  // Update lyric text on a specific note
  const handleUpdateLyricAt = (
    mIdx: number,
    nIdx: number,
    type: 'hanji' | 'poj' | 'pij' | 'custom',
    val: string
  ) => {
    updateNoteAt(mIdx, nIdx, n => ({
      ...n,
      lyric: {
        ...n.lyric,
        [type]: val,
      },
    }));
  };

  // Quick insert punctuation to note (setting pitch to empty spacer)
  const handleInsertPunctuationToNote = useCallback(
    (punct: string) => {
      if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
      updateSelectedNote(n => ({
        ...n,
        pitch: 'empty',
        lyric: {
          ...n.lyric,
          hanji: punct,
          custom: punct,
        },
      }));
      showNotice(`已填入標點「${punct}」並將音高設為留白 (Empty)`);
    },
    [selectedMeasureIndex, selectedNoteIndex, updateSelectedNote, showNotice]
  );

  // Quick insert annotation to note
  const handleInsertAnnotationToNote = (annot: string) => {
    if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
    updateSelectedNote(n => ({
      ...n,
      pitch: 'empty',
      annotation: annot,
      lyric: {
        ...n.lyric,
        hanji: annot,
        custom: annot,
      },
    }));
    showNotice(`已填入樂曲/演唱註解「${annot}」`);
  };

  // Set custom annotation text on selected note
  const handleSetAnnotation = (annot: string) => {
    updateSelectedNote(n => ({
      ...n,
      annotation: annot,
    }));
  };

  // Navigate to next note (focus lyric input)
  const handleGoToNextNote = (currentMIdx: number, currentNIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom') => {
    const curM = song.measures[currentMIdx];
    if (!curM) return;

    if (currentNIdx < curM.notes.length - 1) {
      const nextNIdx = currentNIdx + 1;
      setSelectedCoord([currentMIdx, nextNIdx]);
      const nextInputId = `lyric-input-${currentMIdx}-${nextNIdx}-${type}`;
      setTimeout(() => {
        const el = document.getElementById(nextInputId) as HTMLInputElement;
        if (el) {
          el.focus();
          el.select();
        }
      }, 30);
    } else if (currentMIdx < song.measures.length - 1) {
      const nextMIdx = currentMIdx + 1;
      setSelectedCoord([nextMIdx, 0]);
      const nextInputId = `lyric-input-${nextMIdx}-0-${type}`;
      setTimeout(() => {
        const el = document.getElementById(nextInputId) as HTMLInputElement;
        if (el) {
          el.focus();
          el.select();
        }
      }, 30);
    }
  };

  // Navigate to previous note
  const handleGoToPrevNote = (currentMIdx: number, currentNIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom') => {
    if (currentNIdx > 0) {
      const prevNIdx = currentNIdx - 1;
      setSelectedCoord([currentMIdx, prevNIdx]);
      const prevInputId = `lyric-input-${currentMIdx}-${prevNIdx}-${type}`;
      setTimeout(() => {
        const el = document.getElementById(prevInputId) as HTMLInputElement;
        if (el) {
          el.focus();
          el.select();
        }
      }, 30);
    } else if (currentMIdx > 0) {
      const prevMIdx = currentMIdx - 1;
      const prevM = song.measures[prevMIdx];
      if (prevM && prevM.notes.length > 0) {
        const prevNIdx = prevM.notes.length - 1;
        setSelectedCoord([prevMIdx, prevNIdx]);
        const prevInputId = `lyric-input-${prevMIdx}-${prevNIdx}-${type}`;
        setTimeout(() => {
          const el = document.getElementById(prevInputId) as HTMLInputElement;
          if (el) {
            el.focus();
            el.select();
          }
        }, 30);
      }
    }
  };

  // Quick whole-measure lyric distributor
  const handleDistributeMeasureLyrics = (mIdx: number) => {
    const text = (measureBatchTexts[mIdx] || '').trim();
    if (!text) return;

    const syllables = splitTaigiLyricSyllables(text);
    if (syllables.length === 0) return;

    const newMeasures = song.measures.map((m, idx) => {
      if (idx !== mIdx) return m;
      const newNotes = m.notes.map((note, nIdx) => {
        const syl = syllables[nIdx];
        if (!syl) return note;

        const isHan = /[\u4e00-\u9fa5]/.test(syl);
        return {
          ...note,
          lyric: {
            ...note.lyric,
            hanji: isHan ? syl : note.lyric.hanji || '',
            poj: !isHan ? syl : note.lyric.poj || '',
            pij: !isHan ? syl : note.lyric.pij || '',
            custom: syl,
          },
        };
      });
      return { ...m, notes: newNotes };
    });

    onUpdateSong({ ...song, measures: newMeasures });
    showNotice(`已將「${text}」分配至第 ${mIdx + 1} 小節各音符！`);
    setMeasureBatchTexts(prev => ({ ...prev, [mIdx]: '' }));
  };

  // Quick whole-verse lyric distributor (Verse Mode)
  const handleDistributeVerseLyrics = (verse: VerseItem, vIdx: number) => {
    const text = (verseBatchTexts[vIdx] || '').trim();
    if (!text) return;

    const tokens = splitVerseTextTokens(text);
    if (tokens.length === 0) return;

    const newMeasures = song.measures.map(m => ({
      ...m,
      notes: m.notes.map(n => ({ ...n, lyric: { ...n.lyric } })),
    }));

    let tokenIdx = 0;
    verse.notes.forEach(ref => {
      if (tokenIdx >= tokens.length) return;
      const tok = tokens[tokenIdx];
      const tokStr = tok.text;
      const targetNote = newMeasures[ref.measureIndex]?.notes[ref.noteIndex];
      if (!targetNote) return;

      const isHan = /[\u4e00-\u9fa5]/.test(tokStr);
      const isPunct = tok.isPunct || isPunctuationOrSpacer(tokStr);

      targetNote.lyric = {
        ...targetNote.lyric,
        hanji: isHan || isPunct ? tokStr : targetNote.lyric.hanji || '',
        poj: !isHan && !isPunct ? tokStr : targetNote.lyric.poj || '',
        pij: !isHan && !isPunct ? tokStr : targetNote.lyric.pij || '',
        custom: tokStr,
      };
      tokenIdx++;
    });

    onUpdateSong({ ...song, measures: newMeasures });
    showNotice(`已將「${text}」分配至第 ${vIdx + 1} 句各音符！`);
    setVerseBatchTexts(prev => ({ ...prev, [vIdx]: '' }));
  };

  // Add note to the end of a verse
  const handleAddNoteToVerseEnd = (verse: VerseItem) => {
    if (verse.notes.length === 0) {
      handleAddMeasure();
      return;
    }
    const lastNoteRef = verse.notes[verse.notes.length - 1];
    handleInsertNoteAt(lastNoteRef.measureIndex, lastNoteRef.noteIndex);
  };

  // Note management: Insert Note after specific note
  const handleInsertNoteAt = (mIdx: number, nIdx: number) => {
    const newNote: JianpuNote = {
      id: generateId('n'),
      pitch: 1,
      octave: 0,
      duration: 1,
      lyric: {},
    };

    const newMeasures = song.measures.map((m, currentMIdx) => {
      if (currentMIdx !== mIdx) return m;
      const notes = [...m.notes];
      notes.splice(nIdx + 1, 0, newNote);
      return { ...m, notes };
    });

    onUpdateSong({ ...song, measures: newMeasures });
    setSelectedCoord([mIdx, nIdx + 1]);
    audioEngine.previewNote(song.key, newNote);
  };

  // Note management: Delete Note at specific position
  const handleDeleteNoteAt = (mIdx: number, nIdx: number) => {
    const targetMeasure = song.measures[mIdx];
    if (targetMeasure && targetMeasure.notes.length <= 1) {
      showNotice('小節內至少需保留一個音符。如需刪除請直接刪除整個小節。');
      return;
    }

    const newMeasures = song.measures.map((m, currentMIdx) => {
      if (currentMIdx !== mIdx) return m;
      const notes = m.notes.filter((_, currentNIdx) => currentNIdx !== nIdx);
      return { ...m, notes };
    });

    onUpdateSong({ ...song, measures: newMeasures });
    setSelectedCoord([mIdx, Math.max(0, nIdx - 1)]);
  };

  // Add Note to end of measure
  const handleAddNoteToMeasure = (mIdx: number) => {
    const targetMeasure = song.measures[mIdx];
    if (!targetMeasure) return;
    handleInsertNoteAt(mIdx, targetMeasure.notes.length - 1);
  };

  // Measure Management: Add New Measure at End
  const handleAddMeasure = () => {
    const newMeasureNum = song.measures.length + 1;
    const newMeasure: Measure = {
      id: generateId('m'),
      measureNumber: newMeasureNum,
      chord: 'C',
      notes: [
        { id: generateId('n'), pitch: 1, octave: 0, duration: 1, lyric: {} },
        { id: generateId('n'), pitch: 2, octave: 0, duration: 1, lyric: {} },
        { id: generateId('n'), pitch: 3, octave: 0, duration: 1, lyric: {} },
        { id: generateId('n'), pitch: 5, octave: 0, duration: 1, lyric: {} },
      ],
    };

    onUpdateSong({
      ...song,
      measures: [...song.measures, newMeasure],
    });
    setSelectedCoord([song.measures.length, 0]);
  };

  // Measure Management: Duplicate Measure
  const handleDuplicateMeasure = (mIdx: number) => {
    const targetM = song.measures[mIdx];
    if (!targetM) return;

    const dupMeasure: Measure = {
      ...targetM,
      id: generateId('m'),
      measureNumber: song.measures.length + 1,
      notes: targetM.notes.map((n) => ({
        ...n,
        id: generateId('n'),
        lyric: { ...n.lyric },
      })),
    };

    const newMeasures = [...song.measures];
    newMeasures.splice(mIdx + 1, 0, dupMeasure);
    newMeasures.forEach((m, idx) => {
      m.measureNumber = idx + 1;
    });

    onUpdateSong({ ...song, measures: newMeasures });
    setSelectedCoord([mIdx + 1, 0]);
  };

  // Measure Management: Delete Measure
  const handleDeleteMeasure = (mIdx: number) => {
    if (song.measures.length <= 1) {
      showNotice('樂曲中至少需保留一個小節。');
      return;
    }

    const newMeasures = song.measures.filter((_, idx) => idx !== mIdx);
    newMeasures.forEach((m, idx) => {
      m.measureNumber = idx + 1;
    });

    onUpdateSong({ ...song, measures: newMeasures });
    setSelectedCoord([Math.max(0, mIdx - 1), 0]);
  };

  // Measure Chord change
  const handleUpdateMeasureChord = (mIdx: number, chord: string) => {
    const newMeasures = song.measures.map((m, idx) => {
      if (idx !== mIdx) return m;
      return { ...m, chord };
    });
    onUpdateSong({ ...song, measures: newMeasures });
  };

  // Measure Section change
  const handleUpdateMeasureSection = (mIdx: number, section: string) => {
    const newMeasures = song.measures.map((m, idx) => {
      if (idx !== mIdx) return m;
      return { ...m, section };
    });
    onUpdateSong({ ...song, measures: newMeasures });
  };

  // Undo / Redo triggers with user feedback
  const handleUndo = useCallback(() => {
    if (!onUndo) return false;
    const success = onUndo();
    if (success) {
      showNotice('已復原上一步修改 (Undo)');
    }
    return success;
  }, [onUndo, showNotice]);

  const handleRedo = useCallback(() => {
    if (!onRedo) return false;
    const success = onRedo();
    if (success) {
      showNotice('已重做下一步修改 (Redo)');
    }
    return success;
  }, [onRedo, showNotice]);

  // Global Keyboard listener for quick score editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Undo / Redo keyboard shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute('contenteditable') === 'true';

      if (isTyping) return;
      if (selectedMeasureIndex === null || selectedNoteIndex === null) return;

      if (['1', '2', '3', '4', '5', '6', '7', '0'].includes(e.key)) {
        e.preventDefault();
        const p = parseInt(e.key, 10) as PitchNumber;
        handleSetPitch(p);
      } else if (['e', 'E', '_', 'x', 'X', 'Backspace', 'Delete'].includes(e.key)) {
        e.preventDefault();
        handleSetPitch('empty');
      } else if (['，', '。', '！', '？', '、', '—', '…', '「', '」', ','].includes(e.key)) {
        e.preventDefault();
        const mark = e.key === ',' ? '，' : e.key;
        handleInsertPunctuationToNote(mark);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const curM = song.measures[selectedMeasureIndex];
        if (curM && selectedNoteIndex < curM.notes.length - 1) {
          handleSelectNote(selectedMeasureIndex, selectedNoteIndex + 1);
        } else if (selectedMeasureIndex < song.measures.length - 1) {
          handleSelectNote(selectedMeasureIndex + 1, 0);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedNoteIndex > 0) {
          handleSelectNote(selectedMeasureIndex, selectedNoteIndex - 1);
        } else if (selectedMeasureIndex > 0) {
          const prevM = song.measures[selectedMeasureIndex - 1];
          if (prevM && prevM.notes.length > 0) {
            handleSelectNote(selectedMeasureIndex - 1, prevM.notes.length - 1);
          }
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        if (currentNote) {
          audioEngine.previewNote(song.key, currentNote);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    selectedMeasureIndex,
    selectedNoteIndex,
    song,
    currentNote,
    audioEngine,
    handleSetPitch,
    handleSelectNote,
    handleInsertPunctuationToNote,
    handleUndo,
    handleRedo,
  ]);

  return (
    <div id="composer-editor-root" className="flex flex-col gap-6 w-full pb-10">
      {/* Inline Notification Banner */}
      {notification && (
        <div
          id="composer-notice-banner"
          className="p-3 bg-amber-500 text-zinc-950 font-bold text-xs rounded-xl shadow-md flex items-center justify-between animate-in fade-in duration-150"
        >
          <span>{notification}</span>
          <button
            id="composer-notice-dismiss-btn"
            type="button"
            onClick={() => setNotification(null)}
            className="px-2 py-0.5 bg-zinc-950/20 hover:bg-zinc-950/30 rounded text-xs cursor-pointer"
          >
            關閉
          </button>
        </div>
      )}

      {/* Song Metadata Card & Global Setting Header */}
      <SongMetadataHeader
        song={song}
        onUpdateSong={onUpdateSong}
        displayMode={displayMode}
        setDisplayMode={setDisplayMode}
        onOpenAligner={onOpenAligner}
      />

      {/* WYSIWYG JIANPU SCORE SHEET CONTAINER */}
      <div id="wysiwyg-jianpu-score-container" className="flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Music2 className="w-5 h-5 text-amber-500" />
            <span>台語簡譜曲譜編輯區 (WYSIWYG Jianpu Score Sheet)</span>
          </h2>
          <div className="flex items-center gap-2 text-xs">
            {/* Undo / Redo in Score Header */}
            {onUndo && onRedo && (
              <div
                id="composer-undo-redo-score-bar"
                className="flex items-center bg-white dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xs"
              >
                <button
                  id="composer-score-undo-btn"
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title={canUndo ? `復原 (Undo) [Ctrl+Z] · 尚有 ${pastCount} 步` : '無可復原步驟 (Undo)'}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>復原</span>
                  {canUndo && pastCount > 0 && (
                    <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono">
                      {pastCount}
                    </span>
                  )}
                </button>

                <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

                <button
                  id="composer-score-redo-btn"
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title={canRedo ? `重做 (Redo) [Ctrl+Y] · 尚有 ${futureCount} 步` : '無可重做步驟 (Redo)'}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  <span>重做</span>
                  {canRedo && futureCount > 0 && (
                    <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono">
                      {futureCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddMeasure}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增小節 (Add Measure)</span>
            </button>
          </div>
        </div>

        {/* EDIT MODE TOGGLE SWITCHER (Verse Mode vs Measure Mode) */}
        <div
          id="editor-mode-toggle-container"
          className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-100/90 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>編輯檢視模式:</span>
            </span>
            <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-700">
              <button
                id="editor-mode-verse-btn"
                type="button"
                onClick={() => setEditMode('verse')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  editMode === 'verse'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>句編輯模式 (Verse Mode)</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-amber-600/30 text-zinc-950 dark:text-zinc-900 font-extrabold ml-1">
                  預設
                </span>
              </button>

              <button
                id="editor-mode-measure-btn"
                type="button"
                onClick={() => setEditMode('measure')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  editMode === 'measure'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>小節編輯模式 (Measure Mode)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            {editMode === 'verse' ? (
              <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/60 font-medium">
                <span className="font-bold text-amber-600 dark:text-amber-400">句模式：</span>
                依歌詞標點符號或空白留白自動分句 · 共 {verses.length} 句
              </span>
            ) : (
              <span className="flex items-center gap-1.5 bg-zinc-200/70 dark:bg-zinc-700/60 text-zinc-800 dark:text-zinc-200 px-2.5 py-1 rounded-lg font-medium">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">小節模式：</span>
                依樂譜小節線獨立分段 · 共 {song.measures.length} 小節
              </span>
            )}
          </div>
        </div>

        {/* PERSISTENT STICKY NOTE EDITING TOOLBAR */}
        {currentNote && selectedMeasureIndex !== null && (
          <NoteEditorHud
            currentNote={currentNote}
            selectedMeasureIndex={selectedMeasureIndex}
            selectedNoteIndex={selectedNoteIndex}
            keySignature={song.key}
            audioEngine={audioEngine}
            onUpdateSelectedNote={updateSelectedNote}
            onSetPitch={handleSetPitch}
            onSetOctave={handleSetOctave}
            onSetAccidental={handleSetAccidental}
            onSetDuration={handleSetDuration}
            onToggleDotted={handleToggleDotted}
            onToggleTie={handleToggleTie}
            onInsertPunctuation={handleInsertPunctuationToNote}
            onInsertAnnotation={handleInsertAnnotationToNote}
            onSetAnnotation={handleSetAnnotation}
            onInsertNoteAt={handleInsertNoteAt}
            onDeleteNoteAt={handleDeleteNoteAt}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            pastCount={pastCount}
            futureCount={futureCount}
            showNotice={showNotice}
          />
        )}

        {/* Score Grid: Conditional by Edit Mode ('verse' vs 'measure') */}
        {editMode === 'verse' ? (
          <VerseModeView
            verses={verses}
            selectedMeasureIndex={selectedMeasureIndex}
            selectedNoteIndex={selectedNoteIndex}
            playingVerseIdx={playingVerseIdx}
            activePlaybackNoteId={activePlaybackNoteId}
            displayMode={displayMode}
            verseBatchTexts={verseBatchTexts}
            onSetVerseBatchTexts={setVerseBatchTexts}
            onSelectNote={handleSelectNote}
            onTogglePlayVerse={handleTogglePlayVerse}
            onAddNoteToVerseEnd={handleAddNoteToVerseEnd}
            onDistributeVerseLyrics={handleDistributeVerseLyrics}
            onInsertPunctuationToNote={handleInsertPunctuationToNote}
            onUpdateLyric={handleUpdateLyricAt}
            onGoToNextNote={handleGoToNextNote}
            onGoToPrevNote={handleGoToPrevNote}
          />
        ) : (
          <MeasureModeView
            song={song}
            selectedMeasureIndex={selectedMeasureIndex}
            selectedNoteIndex={selectedNoteIndex}
            playingMeasureIdx={playingMeasureIdx}
            activePlaybackNoteId={activePlaybackNoteId}
            displayMode={displayMode}
            measureBatchTexts={measureBatchTexts}
            onSetMeasureBatchTexts={setMeasureBatchTexts}
            onSelectNote={handleSelectNote}
            onTogglePlayMeasure={handleTogglePlayMeasure}
            onAddNoteToMeasure={handleAddNoteToMeasure}
            onDuplicateMeasure={handleDuplicateMeasure}
            onDeleteMeasure={handleDeleteMeasure}
            onUpdateMeasureSection={handleUpdateMeasureSection}
            onUpdateMeasureChord={handleUpdateMeasureChord}
            onDistributeMeasureLyrics={handleDistributeMeasureLyrics}
            onUpdateLyric={handleUpdateLyricAt}
            onGoToNextNote={handleGoToNextNote}
            onGoToPrevNote={handleGoToPrevNote}
          />
        )}

        {/* Bottom Append Measure Button */}
        <div className="flex justify-center pt-2">
          <button
            id="composer-add-measure-bottom-btn"
            type="button"
            onClick={handleAddMeasure}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>在曲末新增小節 (Append Measure)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
