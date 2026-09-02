'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  EditorEditMode,
  JianpuNote,
  KeySignature,
  LyricDisplayMode,
  Measure,
  NoteDuration,
  PitchNumber,
  Song,
  TimeSignature,
  VerseItem,
  VerseNoteRef,
} from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import {
  getDurationChineseInfo,
  splitTaigiLyricSyllables,
  PUNCTUATION_MARKS,
  ANNOTATION_MARKS,
  groupSongIntoVerses,
  splitVerseTextTokens,
  isVerseBreakNote,
  isPunctuationOrSpacer,
  isNonNotationItem,
} from '@/lib/taigiUtils';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import {
  Plus,
  Trash2,
  Copy,
  Music2,
  Volume2,
  AlignLeft,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Play,
  Square,
  Sparkles,
  Type,
  Music,
  Check,
  Zap,
  CornerDownRight,
  MessageSquareQuote,
  FileText,
  Layers,
  ListMusic,
  Undo2,
  Redo2,
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
  const [activeLyricField, setActiveLyricField] = useState<{
    mIdx: number;
    nIdx: number;
    type: 'hanji' | 'poj' | 'pij' | 'custom';
  } | null>(null);

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
  const handleSelectNote = React.useCallback(
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
  const updateNoteAt = React.useCallback(
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
  const updateSelectedNote = React.useCallback(
    (updater: (note: JianpuNote) => JianpuNote) => {
      if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
      updateNoteAt(selectedMeasureIndex, selectedNoteIndex, updater);
    },
    [selectedMeasureIndex, selectedNoteIndex, updateNoteAt]
  );

  // Change pitch
  const handleSetPitch = React.useCallback(
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
      setActiveLyricField({ mIdx: currentMIdx, nIdx: nextNIdx, type });
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
      setActiveLyricField({ mIdx: nextMIdx, nIdx: 0, type });
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
      setActiveLyricField({ mIdx: currentMIdx, nIdx: prevNIdx, type });
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
        setActiveLyricField({ mIdx: prevMIdx, nIdx: prevNIdx, type });
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

  // Add note to the end of a verse (inserts after the last note in that verse)
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

  // Global Keyboard listener for quick score editing (1-7 pitch, 0 rest, Undo/Redo when not typing in text field)
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

  const renderNoteCell = (
    note: JianpuNote,
    mIdx: number,
    nIdx: number,
    keyPrefix = ''
  ) => {
    const isSelected = selectedMeasureIndex === mIdx && selectedNoteIndex === nIdx;
    const isPlaybackActive = activePlaybackNoteId === note.id;

    const isNonNotation = isNonNotationItem(note);
    const isPitched = !isNonNotation && typeof note.pitch === 'number' && note.pitch > 0;
    const isEmptyNote = isNonNotation || note.pitch === 'empty' || (!note.pitch && note.pitch !== 0);
    const octaveTopDots = isPitched && note.octave > 0 ? note.octave : 0;
    const octaveBottomDots = isPitched && note.octave < 0 ? Math.abs(note.octave) : 0;
    const isEighth = !isNonNotation && (note.duration === 0.5 || note.duration === 0.75);
    const isSixteenth = !isNonNotation && (note.duration <= 0.25 || note.duration === 0.375);
    const showDot =
      !isNonNotation &&
      (note.isDotted ||
        note.duration === 1.5 ||
        note.duration === 0.75 ||
        note.duration === 3 ||
        note.duration === 0.375 ||
        note.duration === 1.75);
    const dashesCount = !isNonNotation
      ? note.duration === 2
        ? 1
        : note.duration === 3
        ? 2
        : note.duration === 4
        ? 3
        : 0
      : 0;

    const hanji = note.lyric?.hanji || '';
    const custom = note.lyric?.custom || '';

    return (
      <div
        key={`${keyPrefix}${note.id}-${mIdx}-${nIdx}`}
        id={`wysiwyg-note-cell-${mIdx}-${nIdx}`}
        onClick={() => handleSelectNote(mIdx, nIdx)}
        className={`group relative flex flex-col items-center justify-between p-2 rounded-xl border cursor-pointer transition-all duration-150 min-w-[72px] sm:min-w-[88px] flex-1 ${
          isPlaybackActive
            ? 'bg-amber-400/25 ring-2 ring-amber-500 scale-[1.03] shadow-md border-amber-500'
            : isSelected
            ? 'border-amber-500 bg-amber-50/90 dark:bg-amber-950/60 shadow-md ring-2 ring-amber-400/60'
            : isNonNotation
            ? 'border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/40 hover:border-amber-400'
            : 'border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 hover:border-amber-300 dark:hover:border-amber-700'
        }`}
      >
        {/* Note Duration & Index Badge */}
        <div className="w-full flex items-center justify-between text-[10px] text-zinc-600 dark:text-zinc-400 font-mono mb-1">
          <span>
            {isNonNotation
              ? note.annotation
                ? '註解'
                : isPunctuationOrSpacer(hanji || custom)
                ? '標點'
                : '空白'
              : getDurationChineseInfo(note.duration).jianpuSymbol}
          </span>
          <span className="font-semibold text-[9px]">{isNonNotation ? '0拍 (非音符)' : `${note.duration}拍`}</span>
        </div>

        {/* Jianpu Musical Pitch Number Container */}
        <div className="flex items-center justify-center relative min-h-[46px] my-1">
          {/* Slur / Tie Arc */}
          {note.isTied && !isNonNotation && (
            <span className="absolute -top-3 text-amber-600 dark:text-amber-400 text-sm font-bold">
              ⌒
            </span>
          )}

          {/* Annotation Pill above pitch */}
          {note.annotation && (
            <span className="absolute -top-3.5 text-[10px] font-sans font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/90 px-1.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 whitespace-nowrap shadow-2xs">
              {note.annotation}
            </span>
          )}

          <div className="flex flex-col items-center">
            {/* Top Octave Dots */}
            {octaveTopDots > 0 && (
              <div className="flex gap-0.5 mb-[-2px]">
                {Array.from({ length: octaveTopDots }).map((_, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full inline-block bg-zinc-900 dark:bg-zinc-100"
                  />
                ))}
              </div>
            )}

            {/* Pitch Number & Accidental */}
            <div className="flex items-baseline font-mono text-2xl font-black tracking-tight select-none">
              {isPitched && note.accidental && (
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400 mr-0.5">
                  {note.accidental === '#' ? '♯' : '♭'}
                </span>
              )}
              <span
                className={`${
                  isNonNotation
                    ? 'text-zinc-400 dark:text-zinc-500 font-mono text-lg font-normal'
                    : note.pitch === 0
                    ? 'text-zinc-400 dark:text-zinc-600 font-normal'
                    : isPlaybackActive
                    ? 'text-amber-600 dark:text-amber-300 scale-110'
                    : isSelected
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {isNonNotation
                  ? note.annotation
                    ? ''
                    : isPunctuationOrSpacer(hanji || custom)
                    ? hanji || custom
                    : '␣'
                  : note.pitch}
              </span>
              {showDot && (
                <span className="text-base font-black text-amber-600 dark:text-amber-400 ml-0.5">
                  ·
                </span>
              )}
              {dashesCount > 0 && (
                <span className="font-mono text-zinc-500 dark:text-zinc-400 text-base ml-1 font-bold">
                  {' -'.repeat(dashesCount)}
                </span>
              )}
            </div>

            {/* Bottom Octave Dots */}
            {octaveBottomDots > 0 && (
              <div className="flex gap-0.5 mt-[-2px]">
                {Array.from({ length: octaveBottomDots }).map((_, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full inline-block bg-zinc-900 dark:bg-zinc-100"
                  />
                ))}
              </div>
            )}

            {/* Duration Underlines */}
            {isEighth && (
              <div className="w-full h-[2.5px] mt-0.5 rounded-full bg-zinc-900 dark:bg-zinc-200" />
            )}
            {isSixteenth && (
              <div className="flex flex-col gap-[2px] w-full mt-0.5">
                <div className="w-full h-[2px] rounded-full bg-zinc-900 dark:bg-zinc-200" />
                <div className="w-full h-[2px] rounded-full bg-zinc-900 dark:bg-zinc-200" />
              </div>
            )}
          </div>
        </div>

        {/* DIRECT IN-SCORE EDITABLE LYRIC INPUTS */}
        <div className="w-full flex flex-col gap-1.5 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          {/* POJ (白話字) Lyric Input */}
          {(displayMode === 'all' ||
            displayMode === 'hanji_poj' ||
            displayMode === 'poj_only') && (
            <div className="w-full flex flex-col">
              <input
                id={`lyric-input-${mIdx}-${nIdx}-poj`}
                type="text"
                value={note.lyric.poj || ''}
                onFocus={() => {
                  setSelectedCoord([mIdx, nIdx]);
                  setActiveLyricField({ mIdx, nIdx, type: 'poj' });
                }}
                onChange={e =>
                  handleUpdateLyricAt(mIdx, nIdx, 'poj', e.target.value)
                }
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleGoToNextNote(mIdx, nIdx, 'poj');
                    } else {
                      e.preventDefault();
                      handleGoToPrevNote(mIdx, nIdx, 'poj');
                    }
                  }
                }}
                placeholder="POJ"
                className="w-full text-center font-serif italic text-xs font-semibold px-1 py-0.5 rounded bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-800"
                title="白話字 (POJ)"
              />
            </div>
          )}

          {/* Hanji (漢字) Lyric Input */}
          {(displayMode === 'all' ||
            displayMode === 'hanji_poj' ||
            displayMode === 'hanji_pij' ||
            displayMode === 'hanji_only') && (
            <div className="w-full flex flex-col">
              <input
                id={`lyric-input-${mIdx}-${nIdx}-hanji`}
                type="text"
                value={note.lyric.hanji || ''}
                onFocus={() => {
                  setSelectedCoord([mIdx, nIdx]);
                  setActiveLyricField({ mIdx, nIdx, type: 'hanji' });
                }}
                onChange={e =>
                  handleUpdateLyricAt(mIdx, nIdx, 'hanji', e.target.value)
                }
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleGoToNextNote(mIdx, nIdx, 'hanji');
                    } else {
                      e.preventDefault();
                      handleGoToPrevNote(mIdx, nIdx, 'hanji');
                    }
                  }
                }}
                placeholder="字"
                className="w-full text-center font-bold text-sm px-1 py-0.5 rounded bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-zinc-800"
                title="漢字 (Hanji)"
              />
            </div>
          )}

          {/* PIJ (臺羅拼音) Lyric Input (in 'all' or 'hanji_pij' mode) */}
          {(displayMode === 'all' || displayMode === 'hanji_pij') && (
            <div className="w-full flex flex-col">
              <input
                id={`lyric-input-${mIdx}-${nIdx}-pij`}
                type="text"
                value={note.lyric.pij || ''}
                onFocus={() => {
                  setSelectedCoord([mIdx, nIdx]);
                  setActiveLyricField({ mIdx, nIdx, type: 'pij' });
                }}
                onChange={e =>
                  handleUpdateLyricAt(mIdx, nIdx, 'pij', e.target.value)
                }
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleGoToNextNote(mIdx, nIdx, 'pij');
                    } else {
                      e.preventDefault();
                      handleGoToPrevNote(mIdx, nIdx, 'pij');
                    }
                  }
                }}
                placeholder="臺羅"
                className="w-full text-center font-serif text-[11px] px-1 py-0.5 rounded bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 text-cyan-800 dark:text-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 focus:bg-white dark:focus:bg-zinc-800"
                title="臺羅拼音 (PIJ)"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

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
            className="px-2 py-0.5 bg-zinc-950/20 hover:bg-zinc-950/30 rounded text-xs"
          >
            關閉
          </button>
        </div>
      )}

      {/* Song Metadata Card & Global Setting Header */}
      <div
        id="song-metadata-card"
        className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[240px]">
            <label
              htmlFor="composer-song-title-input"
              className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1"
            >
              樂曲名稱 (Song Title)
            </label>
            <input
              id="composer-song-title-input"
              type="text"
              value={song.title}
              onChange={e => onUpdateSong({ ...song, title: e.target.value })}
              className="w-full text-lg font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              placeholder="望春風 (Bāng Chhun-hong)"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Key Signature */}
            <div>
              <label
                htmlFor="composer-key-select"
                className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1"
              >
                調號 (Key 1=?)
              </label>
              <select
                id="composer-key-select"
                value={song.key}
                onChange={e => onUpdateSong({ ...song, key: e.target.value as KeySignature })}
                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
              >
                {['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                  <option key={k} value={k}>
                    1 = {k}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Signature */}
            <div>
              <label
                htmlFor="composer-time-signature-select"
                className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1"
              >
                拍號 (Time)
              </label>
              <select
                id="composer-time-signature-select"
                value={song.timeSignature}
                onChange={e =>
                  onUpdateSong({ ...song, timeSignature: e.target.value as TimeSignature })
                }
                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
              >
                <option value="4/4">4/4 拍</option>
                <option value="3/4">3/4 拍</option>
                <option value="2/4">2/4 拍</option>
                <option value="6/8">6/8 拍</option>
              </select>
            </div>

            {/* BPM */}
            <div>
              <label
                htmlFor="composer-bpm-input"
                className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1"
              >
                速度 (BPM)
              </label>
              <input
                id="composer-bpm-input"
                type="number"
                min="40"
                max="240"
                value={song.bpm}
                onChange={e => onUpdateSong({ ...song, bpm: parseInt(e.target.value, 10) || 80 })}
                className="w-20 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono font-bold rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Batch Lyric Aligner Modal Trigger */}
            <div className="self-end">
              <button
                id="composer-open-aligner-btn"
                type="button"
                onClick={onOpenAligner}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
              >
                <AlignLeft className="w-4 h-4" />
                <span>整段歌詞對齊匯入</span>
              </button>
            </div>
          </div>
        </div>

        {/* Display Mode Switcher & Sheet Status */}
        <div
          id="composer-lyric-mode-bar"
          className="flex flex-wrap items-center justify-between pt-3 border-t border-zinc-200/80 dark:border-zinc-800 text-xs gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-500">曲譜歌詞顯示模式:</span>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
              <button
                id="composer-mode-all"
                type="button"
                onClick={() => setDisplayMode('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  displayMode === 'all'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                    : 'text-zinc-500'
                }`}
              >
                全部顯示 (漢字+POJ+臺羅)
              </button>
              <button
                id="composer-mode-hanji-poj"
                type="button"
                onClick={() => setDisplayMode('hanji_poj')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  displayMode === 'hanji_poj'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                    : 'text-zinc-500'
                }`}
              >
                漢字 + 白話字
              </button>
              <button
                id="composer-mode-hanji-pij"
                type="button"
                onClick={() => setDisplayMode('hanji_pij')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  displayMode === 'hanji_pij'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                    : 'text-zinc-500'
                }`}
              >
                漢字 + 臺羅
              </button>
              <button
                id="composer-mode-hanji-only"
                type="button"
                onClick={() => setDisplayMode('hanji_only')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  displayMode === 'hanji_only'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                    : 'text-zinc-500'
                }`}
              >
                純漢字
              </button>
              <button
                id="composer-mode-poj-only"
                type="button"
                onClick={() => setDisplayMode('poj_only')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  displayMode === 'poj_only'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold'
                    : 'text-zinc-500'
                }`}
              >
                純POJ
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium">
            <span>全曲共 {song.measures.length} 小節</span>
            <span>·</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              直接在下方曲譜點擊音符即可原地修改簡譜與歌詞
            </span>
          </div>
        </div>
      </div>

      {/* WYSIWYG JIANPU SCORE SHEET - EVERYTHING IS INTEGRATED DIRECTLY IN THE SHEET */}
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
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95"
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
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95"
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl font-bold shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增小節 (Add Measure)</span>
            </button>
          </div>
        </div>

        {/* EDIT MODE TOGGLE SWITCHER (Verse Mode separated by punctuation/space vs Measure Mode sectioned by score measures) */}
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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

        {/* PERSISTENT STICKY NOTE EDITING TOOLBAR (Docked at the top of the entire score area so it never scrolls out of view across any section or measure) */}
        {currentNote && selectedMeasureIndex !== null && (
          <div
            id={`inline-note-hud-${selectedMeasureIndex}`}
            className="sticky top-[68px] z-30 p-3.5 bg-amber-50/95 dark:bg-zinc-900/95 backdrop-blur-md border-2 border-amber-500 dark:border-amber-500 rounded-2xl shadow-xl flex flex-col gap-2.5 animate-in fade-in duration-150"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 dark:border-zinc-700 pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-500 text-zinc-950 rounded-md font-bold text-xs">
                  音符 #{selectedMeasureIndex + 1}.{(selectedNoteIndex ?? 0) + 1}
                </span>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {getDurationChineseInfo(currentNote.duration).name} ({currentNote.duration} 拍)
                </span>
                {currentNote.isTied && (
                  <span className="text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded font-bold">
                    延音線 ⌒
                  </span>
                )}
                <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                  (點選下方曲譜音符即時編輯 · 按數字鍵 1-7/0 或點選按鈕切換音高)
                </span>
              </div>

              {/* Audition & Note Insert / Delete / Undo / Redo */}
              <div className="flex items-center gap-1.5">
                {onUndo && onRedo && (
                  <div className="flex items-center bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-amber-300 dark:border-zinc-700 mr-1">
                    <button
                      id="hud-undo-btn"
                      type="button"
                      onClick={handleUndo}
                      disabled={!canUndo}
                      title={canUndo ? `復原 (Undo) [Ctrl+Z] · 尚有 ${pastCount} 步` : '無可復原步驟'}
                      className="p-1 rounded text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-[1px] h-3 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
                    <button
                      id="hud-redo-btn"
                      type="button"
                      onClick={handleRedo}
                      disabled={!canRedo}
                      title={canRedo ? `重做 (Redo) [Ctrl+Y] · 尚有 ${futureCount} 步` : '無可重做步驟'}
                      className="p-1 rounded text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => audioEngine.previewNote(song.key, currentNote)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-200 hover:bg-amber-300 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 rounded-lg text-xs font-bold transition-all shadow-2xs"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>試聽單音</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertNoteAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg text-xs font-bold transition-all"
                  title="在當前音符後插入新音符"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>插入音符</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteNoteAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
                  className="p-1 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 text-rose-700 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-900 text-xs"
                  title="刪除當前音符"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Interactive Piano Keyboard for Intuitive Pitch Entry (Differentiating White & Black Keys) */}
            <PianoKeyboard
              keySignature={song.key}
              currentNote={currentNote}
              onSelectPitch={(pitch, octave, accidental) => {
                updateSelectedNote(n => ({
                  ...n,
                  pitch,
                  octave,
                  accidental: accidental || '',
                }));
              }}
              audioEngine={audioEngine}
            />

            {/* Integrated In-Score Pitch & Duration Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Pitch selector */}
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <span className="text-[11px] font-bold text-zinc-500 px-1">快速音高:</span>
                {[1, 2, 3, 4, 5, 6, 7, 0].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSetPitch(p as PitchNumber)}
                    className={`w-7 h-7 rounded-lg font-mono text-sm font-bold transition-all ${
                      currentNote.pitch === p
                        ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 font-black shadow-xs'
                        : 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {p === 0 ? '0' : p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleSetPitch('empty')}
                  title="空白音符 / 標點符號 / 註解留白 (空)"
                  className={`px-2 h-7 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1 ${
                    currentNote.pitch === 'empty'
                      ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 font-black shadow-xs'
                      : 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-dashed border-zinc-300 dark:border-zinc-600'
                  }`}
                >
                  <span>␣ 空</span>
                </button>
              </div>

              {/* Octave Controls */}
              <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold">
                <span className="text-[11px] font-bold text-zinc-500 px-1">八度:</span>
                <button
                  type="button"
                  onClick={() => handleSetOctave(-1)}
                  className={`px-2 py-1 rounded-lg ${
                    currentNote.octave === -1
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  低音 (5̣)
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedNote(n => ({ ...n, octave: 0 }))}
                  className={`px-2 py-1 rounded-lg ${
                    currentNote.octave === 0
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  中音 (5)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetOctave(1)}
                  className={`px-2 py-1 rounded-lg ${
                    currentNote.octave === 1
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  高音 (5̇)
                </button>
              </div>

              {/* Accidental */}
              <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleSetAccidental('#')}
                  className={`px-2 py-1 rounded-lg ${
                    currentNote.accidental === '#'
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  ♯ 升
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAccidental('b')}
                  className={`px-2 py-1 rounded-lg ${
                    currentNote.accidental === 'b'
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  ♭ 降
                </button>
              </div>

              {/* Duration Chips */}
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs">
                <span className="text-[11px] font-bold text-zinc-500 px-1">拍數:</span>
                {[
                  { label: '1.5 拍', dur: 1.5 },
                  { label: '1 拍', dur: 1 },
                  { label: '0.75 拍', dur: 0.75 },
                  { label: '0.5 拍', dur: 0.5 },
                  { label: '0.25 拍', dur: 0.25 },
                  { label: '2 拍', dur: 2 },
                  { label: '3 拍', dur: 3 },
                ].map(d => (
                  <button
                    key={d.dur}
                    type="button"
                    onClick={() => handleSetDuration(d.dur as NoteDuration)}
                    className={`px-2 py-1 rounded-lg font-bold transition-all ${
                      currentNote.duration === d.dur
                        ? 'bg-amber-500 text-zinc-950 font-black shadow-2xs'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleToggleDotted}
                  className={`px-2 py-1 rounded-lg font-bold border transition-all ${
                    currentNote.isDotted
                      ? 'bg-amber-500 text-zinc-950 border-amber-500'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  · 附點
                </button>
                <button
                  type="button"
                  onClick={handleToggleTie}
                  className={`px-2 py-1 rounded-lg font-bold border transition-all ${
                    currentNote.isTied
                      ? 'bg-amber-500 text-zinc-950 border-amber-500'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  ⌒ 延音
                </button>
              </div>
            </div>

            {/* Punctuation & Annotation Quick Toolbar in HUD */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200/80 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Punctuation Row */}
                <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-2 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <MessageSquareQuote className="w-3.5 h-3.5" /> 標點:
                  </span>
                  {PUNCTUATION_MARKS.slice(0, 9).map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleInsertPunctuationToNote(p.char)}
                      title={`填入標點 ${p.label} (${p.desc})`}
                      className="w-6 h-6 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900 text-amber-950 dark:text-amber-200 font-mono font-bold text-xs border border-amber-200 dark:border-amber-800 transition-colors active:scale-95 flex items-center justify-center shadow-2xs"
                    >
                      {p.label === ' ' ? '␣' : p.label}
                    </button>
                  ))}
                </div>

                {/* Annotations Row */}
                <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-2 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> 註解:
                  </span>
                  {ANNOTATION_MARKS.slice(0, 7).map(ann => (
                    <button
                      key={ann.label}
                      type="button"
                      onClick={() => handleInsertAnnotationToNote(ann.text)}
                      title={`填入註解 ${ann.label} (${ann.desc})`}
                      className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-950 dark:text-indigo-200 font-semibold text-[11px] border border-indigo-200 dark:border-indigo-800 transition-colors active:scale-95 whitespace-nowrap shadow-2xs"
                    >
                      {ann.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Annotation Input */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs">
                <span className="text-[11px] font-bold text-zinc-500">自訂註解:</span>
                <input
                  type="text"
                  placeholder="如: (漸快/合唱/副歌)..."
                  value={currentNote.annotation || ''}
                  onChange={e => handleSetAnnotation(e.target.value)}
                  className="w-32 px-2 py-0.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleSetPitch('empty');
                    showNotice('已設定自訂註解並將音高設為留白 (Empty)');
                  }}
                  className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded text-[11px] transition-colors"
                >
                  設為留白註解
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Score Grid: Conditional by Edit Mode ('verse' vs 'measure') */}
        {editMode === 'verse' ? (
          /* ============================================================ */
          /* VERSE EDIT MODE (Default: Segmented by 標點 or 空白音符)       */
          /* ============================================================ */
          <div id="verse-mode-container" className="flex flex-col gap-6">
            {verses.map((verse, vIdx) => {
              const isPlayingThisVerse = playingVerseIdx === vIdx;
              const hasSelectedNoteInVerse = verse.notes.some(
                item =>
                  item.measureIndex === selectedMeasureIndex &&
                  item.noteIndex === selectedNoteIndex
              );

              return (
                <div
                  key={`verse-card-${verse.id}-${vIdx}`}
                  id={`verse-card-${vIdx}`}
                  className={`flex flex-col p-4 sm:p-5 rounded-2xl border transition-all duration-200 shadow-xs ${
                    isPlayingThisVerse
                      ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-50/50 dark:bg-amber-950/40 shadow-md'
                      : hasSelectedNoteInVerse
                      ? 'border-amber-400 dark:border-amber-600/90 bg-amber-50/20 dark:bg-amber-950/20'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/95'
                  }`}
                >
                  {/* Verse Header Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-zinc-200/80 dark:border-zinc-800 text-xs">
                    {/* Left: Dedicated Play Button & Verse Info */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        id={`verse-play-btn-${vIdx}`}
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleTogglePlayVerse(vIdx, verse.notes);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                          isPlayingThisVerse
                            ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 animate-pulse font-black'
                            : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                        }`}
                        title={`試聽第 ${vIdx + 1} 句 (Play Verse #${vIdx + 1})`}
                      >
                        {isPlayingThisVerse ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current text-zinc-950" />
                            <span>停止試聽</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>試聽第 {vIdx + 1} 句</span>
                          </>
                        )}
                      </button>

                      <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold font-mono text-xs border border-amber-300/60 dark:border-amber-700/60">
                        第 {vIdx + 1} 句
                      </span>

                      {verse.section && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                          {verse.section}
                        </span>
                      )}

                      <span className="text-zinc-600 dark:text-zinc-400 text-xs font-medium">
                        涵蓋小節 #{verse.startMeasureNumber} ~ #{verse.endMeasureNumber} (共 {verse.notes.length} 音)
                      </span>

                      {verse.chords.length > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-bold text-xs bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
                          和弦: {verse.chords.join(' → ')}
                        </span>
                      )}
                    </div>

                    {/* Right: Quick Verse Actions */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        id={`verse-add-note-btn-${vIdx}`}
                        type="button"
                        onClick={() => handleAddNoteToVerseEnd(verse)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg font-semibold text-xs border border-zinc-200 dark:border-zinc-700 transition-colors"
                        title="在此句尾端增加一個音符"
                      >
                        <Plus className="w-3 h-3" />
                        <span>句末加音符</span>
                      </button>
                    </div>
                  </div>

                  {/* WYSIWYG JIANPU SCORE ROW WITH MEASURE DIVIDERS */}
                  <div className="flex items-stretch overflow-x-auto pb-2 pt-1 gap-2 sm:gap-2.5">
                    {verse.notes.map((item, itemIdx) => {
                      return (
                        <React.Fragment key={`v-frag-${item.measureIndex}-${item.noteIndex}-${itemIdx}`}>
                          {item.isFirstInMeasure && (
                            <div
                              className="flex flex-col items-center justify-center px-1.5 py-1 text-zinc-400 dark:text-zinc-500 font-mono text-[10px] select-none shrink-0 self-stretch rounded-lg bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60"
                              title={`第 ${item.measureNumber} 小節`}
                            >
                              <span className="font-bold text-zinc-600 dark:text-zinc-400">#{item.measureNumber}</span>
                              <div className="w-[2px] flex-1 bg-zinc-300 dark:bg-zinc-600 my-1 rounded-full" />
                              {item.chord && (
                                <span className="font-bold text-amber-600 dark:text-amber-400 text-[10px]">
                                  {item.chord}
                                </span>
                              )}
                            </div>
                          )}
                          {renderNoteCell(item.note, item.measureIndex, item.noteIndex, `v-${vIdx}-`)}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Verse-Wide Batch Lyric & Punctuation Helper Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 shrink-0 flex items-center gap-1">
                        <MessageSquareQuote className="w-3.5 h-3.5" />
                        <span>整句快速填詞:</span>
                      </span>
                      <input
                        type="text"
                        value={verseBatchTexts[vIdx] || ''}
                        onChange={e =>
                          setVerseBatchTexts(prev => ({ ...prev, [vIdx]: e.target.value }))
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleDistributeVerseLyrics(verse, vIdx);
                          }
                        }}
                        placeholder={`輸入第 ${vIdx + 1} 句歌詞 (如: 獨夜無伴守燈下， 或 To̍k iā bô phōaⁿ...)`}
                        className="flex-1 px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-zinc-800"
                      />
                      <button
                        type="button"
                        onClick={() => handleDistributeVerseLyrics(verse, vIdx)}
                        disabled={!(verseBatchTexts[vIdx] || '').trim()}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-lg text-xs transition-colors shrink-0 shadow-2xs"
                      >
                        分配至此句
                      </button>
                    </div>

                    {/* Quick Punctuation Break chips */}
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500 shrink-0">
                      <span className="text-[10px]">選取音符插入標點斷句:</span>
                      {['，', '。', '！', '？', '、', '—', '…'].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleInsertPunctuationToNote(p)}
                          disabled={selectedMeasureIndex === null || selectedNoteIndex === null}
                          className="w-5 h-5 flex items-center justify-center bg-zinc-100 hover:bg-amber-100 dark:bg-zinc-800 dark:hover:bg-amber-950/70 text-zinc-800 dark:text-zinc-200 hover:text-amber-800 dark:hover:text-amber-200 rounded font-bold border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-30"
                          title={`為選取的音符插入標點「${p}」`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ============================================================ */
          /* MEASURE EDIT MODE (Sectioned by 樂譜小節)                     */
          /* ============================================================ */
          <div id="measure-mode-container" className="flex flex-col gap-6">
            {song.measures.map((measure, mIdx) => {
              const isSelectedMeasure = selectedMeasureIndex === mIdx;
              const isPlayingThisMeasure = playingMeasureIdx === mIdx;

              return (
                <div
                  key={measure.id}
                  id={`measure-card-${mIdx}`}
                  className={`flex flex-col p-4 sm:p-5 rounded-2xl border transition-all duration-200 shadow-xs ${
                    isPlayingThisMeasure
                      ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-50/50 dark:bg-amber-950/40 shadow-md'
                      : isSelectedMeasure
                      ? 'border-amber-400 dark:border-amber-600/90 bg-amber-50/20 dark:bg-amber-950/20'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/95'
                  }`}
                >
                  {/* Measure Header Toolbar (Dedicated Play Button, Measure #, Section, Chord, Duplicate, Delete) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-zinc-200/80 dark:border-zinc-800 text-xs">
                    {/* Left: Dedicated Play Button & Measure Info */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* DEDICATED MEASURE PLAY BUTTON FOR INSTANT VERIFY */}
                      <button
                        id={`measure-play-btn-${mIdx}`}
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleTogglePlayMeasure(mIdx);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                          isPlayingThisMeasure
                            ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 animate-pulse font-black'
                            : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                        }`}
                        title={`試聽第 ${mIdx + 1} 小節 (Play Measure #${mIdx + 1})`}
                      >
                        {isPlayingThisMeasure ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current text-zinc-950" />
                            <span>停止試聽</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>試聽第 {mIdx + 1} 小節</span>
                          </>
                        )}
                      </button>

                      <span className="w-7 h-7 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold flex items-center justify-center font-mono text-xs border border-zinc-200 dark:border-zinc-700">
                        #{mIdx + 1}
                      </span>

                      {/* Section Selector */}
                      <select
                        id={`measure-section-select-${mIdx}`}
                        value={measure.section || ''}
                        onChange={e => handleUpdateMeasureSection(mIdx, e.target.value)}
                        className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold rounded-lg px-2 py-1 text-xs"
                        title="段落標籤"
                      >
                        <option value="">無段落標記</option>
                        <option value="前奏">前奏 (Intro)</option>
                        <option value="主歌 A">主歌 A (Verse 1)</option>
                        <option value="主歌 B">主歌 B (Verse 2)</option>
                        <option value="導歌">導歌 (Pre-Chorus)</option>
                        <option value="副歌">副歌 (Chorus)</option>
                        <option value="間奏">間奏 (Interlude)</option>
                        <option value="尾奏">尾奏 (Outro)</option>
                      </select>

                      {/* Chord Selector */}
                      <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-0.5 text-xs">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">和弦:</span>
                        <select
                          id={`measure-chord-select-${mIdx}`}
                          value={measure.chord || ''}
                          onChange={e => handleUpdateMeasureChord(mIdx, e.target.value)}
                          className="bg-transparent font-bold text-amber-600 dark:text-amber-400 focus:outline-hidden text-xs"
                        >
                          <option value="">無和弦</option>
                          {['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'G7', 'C7', 'Fm', 'A', 'D', 'E', 'Bb'].map(
                            c => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Right: Quick Measure Actions & Batch Lyric */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Add note to this measure */}
                      <button
                        id={`measure-add-note-btn-${mIdx}`}
                        type="button"
                        onClick={() => handleAddNoteToMeasure(mIdx)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg font-semibold text-xs border border-zinc-200 dark:border-zinc-700 transition-colors"
                        title="在此小節尾端增加一個音符"
                      >
                        <Plus className="w-3 h-3" />
                        <span>加音符</span>
                      </button>

                      {/* Duplicate measure */}
                      <button
                        id={`measure-duplicate-btn-${mIdx}`}
                        type="button"
                        onClick={() => handleDuplicateMeasure(mIdx)}
                        className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors"
                        title="複製此小節"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete measure */}
                      <button
                        id={`measure-delete-btn-${mIdx}`}
                        type="button"
                        onClick={() => handleDeleteMeasure(mIdx)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-900 transition-colors"
                        title="刪除此小節"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* THE WYSIWYG JIANPU SCORE ROW */}
                  <div className="flex items-stretch overflow-x-auto pb-2 pt-1 gap-2 sm:gap-3">
                    {measure.notes.map((note, nIdx) =>
                      renderNoteCell(note, mIdx, nIdx, `m-${mIdx}-`)
                    )}
                  </div>

                  {/* Quick Measure-Wide Batch Lyric Input Row */}
                  <div className="flex items-center gap-2 pt-2.5 mt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs">
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 shrink-0">
                      整小節快速填詞:
                    </span>
                    <input
                      type="text"
                      value={measureBatchTexts[mIdx] || ''}
                      onChange={e =>
                        setMeasureBatchTexts(prev => ({ ...prev, [mIdx]: e.target.value }))
                      }
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleDistributeMeasureLyrics(mIdx);
                        }
                      }}
                      placeholder={`輸入第 ${mIdx + 1} 小節完整歌詞 (如: 獨夜無伴 或 To̍k iā bô phōaⁿ)`}
                      className="flex-1 px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-zinc-800"
                    />
                    <button
                      type="button"
                      onClick={() => handleDistributeMeasureLyrics(mIdx)}
                      disabled={!(measureBatchTexts[mIdx] || '').trim()}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-lg text-xs transition-colors shrink-0 shadow-2xs"
                    >
                      分配至此小節
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}


        {/* Bottom Append Measure Button */}
        <div className="flex justify-center pt-2">
          <button
            id="composer-add-measure-bottom-btn"
            type="button"
            onClick={handleAddMeasure}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-sm rounded-2xl shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>在曲末新增小節 (Append Measure)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
