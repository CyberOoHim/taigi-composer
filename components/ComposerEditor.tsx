'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarlineType,
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
  isNonNotationItem,
  normalizeSongDurations,
  getMeasureRhythmReport,
  getRestDurationsForDeficit,
  getNoteBeatDuration,
} from '@/lib/taigiUtils';
import { scrollToCardElement } from '@/lib/utils';
import {
  getStoredEditorEditMode,
  setStoredEditorEditMode,
  getStoredAutoStepAdvance,
  setStoredAutoStepAdvance,
} from '@/lib/storage';
import { SongMetadataHeader } from './composer/SongMetadataHeader';
import { NoteEditorHud } from './composer/NoteEditorHud';
import { SectionRail } from './composer/SectionRail';
import { VerseModeView } from './composer/VerseModeView';
import { MeasureModeView } from './composer/MeasureModeView';
import { MeasureOrganizerModal } from './composer/MeasureOrganizerModal';
import {
  Plus,
  Music2,
  Undo2,
  Redo2,
  AlignLeft,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Wand2,
} from 'lucide-react';

interface ComposerEditorProps {
  song: Song;
  onUpdateSong: (updatedSong: Song) => void;
  audioEngine: AudioEngine;
  displayMode: LyricDisplayMode;
  setDisplayMode: (mode: LyricDisplayMode) => void;
  onOpenAligner: () => void;
  onOpenScanner?: () => void;
  onStartFreshSong?: () => void;
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

const renumberMeasures = (measures: Measure[]): Measure[] =>
  measures.map((m, idx) => (m.measureNumber === idx + 1 ? m : { ...m, measureNumber: idx + 1 }));

export const ComposerEditor: React.FC<ComposerEditorProps> = ({
  song,
  onUpdateSong,
  audioEngine,
  displayMode,
  setDisplayMode,
  onOpenAligner,
  onOpenScanner,
  onStartFreshSong,
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
  const [editMode, setEditModeState] = useState<EditorEditMode>(() => {
    if (typeof window !== 'undefined') return getStoredEditorEditMode();
    return 'verse';
  });
  const [selectedCoord, setSelectedCoord] = useState<[number, number] | null>([0, 0]);
  const [autoStepAdvance, setAutoStepAdvanceState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return getStoredAutoStepAdvance(false);
    return false;
  });

  const setEditMode = useCallback((mode: EditorEditMode) => {
    setEditModeState(mode);
    setStoredEditorEditMode(mode);
  }, []);

  const setAutoStepAdvance = useCallback((adv: boolean | ((prev: boolean) => boolean)) => {
    setAutoStepAdvanceState(prev => {
      const next = typeof adv === 'function' ? adv(prev) : adv;
      setStoredAutoStepAdvance(next);
      return next;
    });
  }, []);

  const [notification, setNotification] = useState<string | null>(null);
  const [playingMeasureIdx, setPlayingMeasureIdx] = useState<number | null>(null);
  const [playingVerseIdx, setPlayingVerseIdx] = useState<number | null>(null);
  const [activePlaybackNoteId, setActivePlaybackNoteId] = useState<string | null>(null);
  const [measureBatchTexts, setMeasureBatchTexts] = useState<{ [mIdx: number]: string }>({});
  const [verseBatchTexts, setVerseBatchTexts] = useState<{ [vIdx: number]: string }>({});
  const [isOrganizerOpen, setIsOrganizerOpen] = useState<boolean>(false);

  // Incomplete / Over-beat measures count for whole song
  const incompleteMeasuresCount = useMemo(() => {
    return song.measures.filter(m => !getMeasureRhythmReport(m, song.timeSignature || '4/4').isFull).length;
  }, [song.measures, song.timeSignature]);

  const showNotice = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(prev => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Compute segmented verses based on punctuation or whitespace/rest pause
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
        // Find the first pitched/content note in this measure, defaulting to note 0
        const m = song.measures[validMeasureIdx];
        let targetNoteIdx = 0;
        if (m && m.notes.length > 0) {
          const firstPitchedIdx = m.notes.findIndex(
            n => !isNonNotationItem(n) && (typeof n.pitch === 'number' && n.pitch > 0 || Boolean(n.lyric.hanji && !isPunctuationOrSpacer(n.lyric.hanji)))
          );
          targetNoteIdx = firstPitchedIdx !== -1 ? firstPitchedIdx : 0;
        }

        setSelectedCoord([validMeasureIdx, targetNoteIdx]);

        // Preview the target note of this section/measure
        const note = song.measures[validMeasureIdx]?.notes[targetNoteIdx] || song.measures[validMeasureIdx]?.notes[0];
        if (note) {
          audioEngine.previewNote(song.key, note);
        }

        if (editMode === 'verse') {
          // Find the verse containing this measure and note, or starting in this measure
          let vIdx = verses.findIndex(v =>
            v.notes.some(n => n.measureIndex === validMeasureIdx && n.noteIndex === targetNoteIdx)
          );
          if (vIdx === -1) {
            vIdx = verses.findIndex(v =>
              v.notes.some(n => n.measureIndex === validMeasureIdx)
            );
          }
          if (vIdx !== -1) {
            scrollToCardElement(`verse-card-${vIdx}`);
            const el = document.getElementById(`verse-card-${vIdx}`);
            if (el) {
              el.classList.add('ring-4', 'ring-amber-500', 'bg-amber-100/30', 'dark:bg-amber-950/50');
              setTimeout(() => {
                el.classList.remove('ring-4', 'ring-amber-500', 'bg-amber-100/30', 'dark:bg-amber-950/50');
              }, 2200);
            }
          }
        } else {
          scrollToCardElement(`measure-card-${validMeasureIdx}`);
          const el = document.getElementById(`measure-card-${validMeasureIdx}`);
          if (el) {
            el.classList.add('ring-4', 'ring-amber-500', 'bg-amber-100/30', 'dark:bg-amber-950/50');
            setTimeout(() => {
              el.classList.remove('ring-4', 'ring-amber-500', 'bg-amber-100/30', 'dark:bg-amber-950/50');
            }, 2200);
          }
        }

        const secName = song.measures[validMeasureIdx]?.section || `Measure ${validMeasureIdx + 1}`;
        showNotice(`Jumped to section "${secName}" for editing`);

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

  // Note Navigation: Previous and Next note
  const handleNavigateNextNote = useCallback(() => {
    if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
    const curM = song.measures[selectedMeasureIndex];
    if (curM && selectedNoteIndex < curM.notes.length - 1) {
      handleSelectNote(selectedMeasureIndex, selectedNoteIndex + 1);
    } else if (selectedMeasureIndex < song.measures.length - 1) {
      handleSelectNote(selectedMeasureIndex + 1, 0);
    }
  }, [selectedMeasureIndex, selectedNoteIndex, song.measures, handleSelectNote]);

  const handleNavigatePrevNote = useCallback(() => {
    if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
    if (selectedNoteIndex > 0) {
      handleSelectNote(selectedMeasureIndex, selectedNoteIndex - 1);
    } else if (selectedMeasureIndex > 0) {
      const prevM = song.measures[selectedMeasureIndex - 1];
      if (prevM && prevM.notes.length > 0) {
        handleSelectNote(selectedMeasureIndex - 1, prevM.notes.length - 1);
      }
    }
  }, [selectedMeasureIndex, selectedNoteIndex, song.measures, handleSelectNote]);

  // Change pitch (with optional auto-advance)
  const handleSetPitch = useCallback(
    (pitch: PitchNumber) => {
      updateSelectedNote(n => {
        const isEmpty = pitch === 'empty';
        const updated = {
          ...n,
          pitch,
          duration: isEmpty ? (0 as NoteDuration) : (n.duration <= 0 ? (1 as NoteDuration) : n.duration),
        };
        if (pitch !== 0 && pitch !== 'empty') {
          audioEngine.previewNote(song.key, updated);
        }
        return updated;
      });

      if (autoStepAdvance) {
        setTimeout(() => {
          handleNavigateNextNote();
        }, 120);
      }
    },
    [updateSelectedNote, audioEngine, song.key, autoStepAdvance, handleNavigateNextNote]
  );

  // Change octave
  const handleSetOctave = useCallback((delta: number) => {
    updateSelectedNote(n => {
      const newOctave = Math.max(-2, Math.min(2, n.octave + delta));
      const updated = { ...n, octave: newOctave };
      audioEngine.previewNote(song.key, updated);
      return updated;
    });
  }, [updateSelectedNote, audioEngine, song.key]);

  // Change accidental
  const handleSetAccidental = useCallback((acc: '' | '#' | 'b') => {
    updateSelectedNote(n => {
      const updated = { ...n, accidental: n.accidental === acc ? '' : acc };
      audioEngine.previewNote(song.key, updated);
      return updated;
    });
  }, [updateSelectedNote, audioEngine, song.key]);

  // Change duration
  const handleSetDuration = (duration: NoteDuration) => {
    updateSelectedNote(n => ({
      ...n,
      duration,
      pitch: duration === 0 ? 'empty' : (n.pitch === 'empty' ? 1 : n.pitch),
      isDotted:
        duration === 1.5 ||
        duration === 0.75 ||
        duration === 3 ||
        duration === 0.375 ||
        duration === 1.75,
    }));
  };

  // Toggle dotted
  const handleToggleDotted = useCallback(() => {
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
  }, [updateSelectedNote]);

  // Toggle tie
  const handleToggleTie = useCallback(() => {
    updateSelectedNote(n => ({ ...n, isTied: !n.isTied }));
  }, [updateSelectedNote]);

  // Halve note duration (e.g. 1 -> 0.5 -> 0.25 -> 0.125)
  const handleHalveDuration = useCallback(() => {
    updateSelectedNote(n => {
      let newDur: NoteDuration = 0.5;
      if (n.duration >= 4) newDur = 2;
      else if (n.duration >= 2) newDur = 1;
      else if (n.duration >= 1) newDur = 0.5;
      else if (n.duration >= 0.5) newDur = 0.25;
      else newDur = 0.125;
      showNotice(`Halved duration: ${newDur} beats (/)`);
      return { ...n, duration: newDur };
    });
  }, [updateSelectedNote, showNotice]);

  // Double note duration (e.g. 0.125 -> 0.25 -> 0.5 -> 1 -> 2 -> 4)
  const handleDoubleDuration = useCallback(() => {
    updateSelectedNote(n => {
      let newDur: NoteDuration = 1;
      if (n.duration <= 0.125) newDur = 0.25;
      else if (n.duration <= 0.25) newDur = 0.5;
      else if (n.duration <= 0.5) newDur = 1;
      else if (n.duration <= 1) newDur = 2;
      else newDur = 4;
      showNotice(`Doubled duration: ${newDur} beats (*)`);
      return { ...n, duration: newDur };
    });
  }, [updateSelectedNote, showNotice]);

  // Update lyric text on a specific note
  const handleUpdateLyricAt = (
    mIdx: number,
    nIdx: number,
    type: 'hanji' | 'poj' | 'pij' | 'custom',
    val: string
  ) => {
    updateNoteAt(mIdx, nIdx, n => {
      const updatedLyric = {
        ...n.lyric,
        [type]: val,
      };
      const text = updatedLyric.hanji || updatedLyric.custom || '';
      const isPunct = isPunctuationOrSpacer(text) || text === '\n' || text === '↵';
      return {
        ...n,
        lyric: updatedLyric,
        pitch: isPunct ? 'empty' : n.pitch,
        duration: isPunct ? (0 as NoteDuration) : n.duration,
      };
    });
  };

  // Quick insert punctuation to note (setting pitch to empty spacer and duration to 0)
  const handleInsertPunctuationToNote = useCallback(
    (punct: string) => {
      if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
      updateSelectedNote(n => ({
        ...n,
        pitch: 'empty',
        duration: 0 as NoteDuration,
        isDotted: false,
        isTied: false,
        lyric: {
          ...n.lyric,
          hanji: punct,
          custom: punct,
        },
      }));
      const label = punct === '\n' ? '↵ newline' : punct;
      showNotice(`Inserted punctuation "${label}" with 0 beats`);
    },
    [selectedMeasureIndex, selectedNoteIndex, updateSelectedNote, showNotice]
  );

  // Quick insert annotation to note
  const handleInsertAnnotationToNote = (annot: string) => {
    if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
    updateSelectedNote(n => ({
      ...n,
      pitch: 'empty',
      duration: 0 as NoteDuration,
      isDotted: false,
      isTied: false,
      annotation: annot,
      lyric: {
        ...n.lyric,
        hanji: annot,
        custom: annot,
      },
    }));
    showNotice(`Inserted annotation "${annot}" (0 beats)`);
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
        const isPunct = isPunctuationOrSpacer(syl) || syl === '\n' || syl === '↵';
        return {
          ...note,
          pitch: isPunct ? 'empty' : note.pitch,
          duration: isPunct ? 0 : note.duration,
          lyric: {
            ...note.lyric,
            hanji: isHan || isPunct ? syl : note.lyric.hanji || '',
            poj: !isHan && !isPunct ? syl : note.lyric.poj || '',
            pij: !isHan && !isPunct ? syl : note.lyric.pij || '',
            custom: syl,
          },
        };
      });
      return { ...m, notes: newNotes };
    });

    onUpdateSong(normalizeSongDurations({ ...song, measures: newMeasures }));
    showNotice(`Distributed "${text}" across notes in Measure ${mIdx + 1}!`);
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
      const isPunct = tok.isPunct || isPunctuationOrSpacer(tokStr) || tokStr === '\n' || tokStr === '↵';

      targetNote.lyric = {
        ...targetNote.lyric,
        hanji: isHan || isPunct ? tokStr : targetNote.lyric.hanji || '',
        poj: !isHan && !isPunct ? tokStr : targetNote.lyric.poj || '',
        pij: !isHan && !isPunct ? tokStr : targetNote.lyric.pij || '',
        custom: tokStr,
      };
      if (isPunct) {
        targetNote.pitch = 'empty';
        targetNote.duration = 0;
      }
      tokenIdx++;
    });

    onUpdateSong(normalizeSongDurations({ ...song, measures: newMeasures }));
    showNotice(`Distributed "${text}" across notes in Verse ${vIdx + 1}!`);
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
      showNotice('Measure must retain at least one note. To delete, remove the entire measure.');
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
    const renumbered = renumberMeasures(newMeasures);

    onUpdateSong({ ...song, measures: renumbered });
    setSelectedCoord([mIdx + 1, 0]);
  };

  // Measure Management: Delete Measure
  const handleDeleteMeasure = (mIdx: number) => {
    if (song.measures.length <= 1) {
      showNotice('Song must retain at least one measure.');
      return;
    }

    const newMeasures = song.measures.filter((_, idx) => idx !== mIdx);
    const renumbered = renumberMeasures(newMeasures);

    onUpdateSong({ ...song, measures: renumbered });
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

  // Split Measure at specific note index
  const handleSplitMeasureAtNote = useCallback(
    (mIdx: number, splitAtIndex: number) => {
      const targetM = song.measures[mIdx];
      if (!targetM || splitAtIndex <= 0 || splitAtIndex >= targetM.notes.length) return;

      const firstPartNotes = targetM.notes.slice(0, splitAtIndex);
      const secondPartNotes = targetM.notes.slice(splitAtIndex);

      const firstMeasure: Measure = {
        ...targetM,
        notes: firstPartNotes,
      };

      const secondMeasure: Measure = {
        id: generateId('m'),
        measureNumber: targetM.measureNumber + 1,
        chord: targetM.chord,
        section: undefined,
        notes: secondPartNotes,
        barlineType: targetM.barlineType || 'single',
      };

      firstMeasure.barlineType = 'single';

      const newMeasures = [...song.measures];
      newMeasures.splice(mIdx, 1, firstMeasure, secondMeasure);
      const renumbered = renumberMeasures(newMeasures);

      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([mIdx + 1, 0]);
      showNotice(`Inserted barline at note, splitting into Measures ${mIdx + 1} and ${mIdx + 2}`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Merge Measure with next measure
  const handleMergeWithNextMeasure = useCallback(
    (mIdx: number) => {
      if (mIdx >= song.measures.length - 1) return;
      const currentM = song.measures[mIdx];
      const nextM = song.measures[mIdx + 1];
      if (!currentM || !nextM) return;

      const mergedMeasure: Measure = {
        ...currentM,
        notes: [...currentM.notes, ...nextM.notes],
        barlineType: nextM.barlineType || currentM.barlineType || 'single',
      };

      const newMeasures = [...song.measures];
      newMeasures.splice(mIdx, 2, mergedMeasure);
      const renumbered = renumberMeasures(newMeasures);

      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([mIdx, currentM.notes.length]);
      showNotice(`Merged Measures ${mIdx + 1} and ${mIdx + 2} into one measure`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Shift last note of measure to next measure
  const handleShiftNoteToNextMeasure = useCallback(
    (mIdx: number) => {
      const currentM = song.measures[mIdx];
      if (!currentM || currentM.notes.length <= 1) {
        showNotice('Measure must retain at least one note');
        return;
      }

      const noteToShift = currentM.notes[currentM.notes.length - 1];
      const newCurrentNotes = currentM.notes.slice(0, currentM.notes.length - 1);

      const newMeasures = [...song.measures];

      if (mIdx < song.measures.length - 1) {
        const nextM = song.measures[mIdx + 1];
        const newNextNotes = [noteToShift, ...nextM.notes];
        newMeasures[mIdx] = { ...currentM, notes: newCurrentNotes };
        newMeasures[mIdx + 1] = { ...nextM, notes: newNextNotes };
      } else {
        const newMeasure: Measure = {
          id: generateId('m'),
          measureNumber: song.measures.length + 1,
          chord: currentM.chord,
          notes: [noteToShift],
        };
        newMeasures[mIdx] = { ...currentM, notes: newCurrentNotes };
        newMeasures.push(newMeasure);
      }

      const renumbered = renumberMeasures(newMeasures);

      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([mIdx + 1, 0]);
      showNotice(`Moved last note into Measure ${mIdx + 2}`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Pull first note from next measure into current measure
  const handlePullNoteFromNextMeasure = useCallback(
    (mIdx: number) => {
      if (mIdx >= song.measures.length - 1) return;
      const currentM = song.measures[mIdx];
      const nextM = song.measures[mIdx + 1];
      if (!currentM || !nextM || nextM.notes.length === 0) return;

      const noteToPull = nextM.notes[0];
      const newCurrentNotes = [...currentM.notes, noteToPull];
      const newNextNotes = nextM.notes.slice(1);

      const newMeasures = [...song.measures];

      if (newNextNotes.length === 0) {
        newMeasures.splice(mIdx, 2, { ...currentM, notes: newCurrentNotes });
      } else {
        newMeasures[mIdx] = { ...currentM, notes: newCurrentNotes };
        newMeasures[mIdx + 1] = { ...nextM, notes: newNextNotes };
      }

      const renumbered = renumberMeasures(newMeasures);

      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([mIdx, newCurrentNotes.length - 1]);
      showNotice(`Borrowed first note from Measure ${mIdx + 2}`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Move measure order (reordering relative location)
  const handleMoveMeasureOrder = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (fromIdx < 0 || fromIdx >= song.measures.length || toIdx < 0 || toIdx >= song.measures.length || fromIdx === toIdx) return;

      const newMeasures = [...song.measures];
      const [moved] = newMeasures.splice(fromIdx, 1);
      newMeasures.splice(toIdx, 0, moved);

      const renumbered = renumberMeasures(newMeasures);

      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([toIdx, 0]);
      showNotice(`Moved Measure ${fromIdx + 1} to position ${toIdx + 1}`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Toggle measure line break
  const handleToggleMeasureLineBreak = useCallback(
    (mIdx: number) => {
      const newMeasures = song.measures.map((m, idx) => {
        if (idx !== mIdx) return m;
        return { ...m, isLineBreak: !m.isLineBreak };
      });
      onUpdateSong({ ...song, measures: newMeasures });
      const willBreak = !song.measures[mIdx]?.isLineBreak;
      showNotice(willBreak ? `Set line break after Measure ${mIdx + 1}` : `Removed line break after Measure ${mIdx + 1}`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Update barline type
  const handleUpdateBarlineType = useCallback(
    (mIdx: number, barlineType: BarlineType) => {
      const newMeasures = song.measures.map((m, idx) => {
        if (idx !== mIdx) return m;
        return { ...m, barlineType };
      });
      onUpdateSong({ ...song, measures: newMeasures });
    },
    [song, onUpdateSong]
  );

  // Auto-fill rest note for under-beat measure
  const handleAutoFillMeasureRest = useCallback(
    (mIdx: number) => {
      const targetM = song.measures[mIdx];
      if (!targetM) return;
      const report = getMeasureRhythmReport(targetM, song.timeSignature || '4/4');
      if (!report.isUnder) return;

      const restDurations = getRestDurationsForDeficit(report.absDiff);
      const newRestNotes: JianpuNote[] = restDurations.map(dur => ({
        id: generateId('n'),
        pitch: 0,
        octave: 0,
        duration: dur,
        lyric: {},
      }));

      const newMeasures = song.measures.map((m, idx) => {
        if (idx !== mIdx) return m;
        return {
          ...m,
          notes: [...m.notes, ...newRestNotes],
        };
      });

      onUpdateSong({ ...song, measures: newMeasures });
      showNotice(`Padded Measure ${mIdx + 1} with ${report.absDiff} beats of rest (0)`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Trim excess notes into next measure
  const handleTrimExcessNotes = useCallback(
    (mIdx: number) => {
      const targetM = song.measures[mIdx];
      if (!targetM) return;
      const report = getMeasureRhythmReport(targetM, song.timeSignature || '4/4');
      if (!report.isOver) return;

      let accumulated = 0;
      let splitIdx = targetM.notes.length - 1;

      for (let i = 0; i < targetM.notes.length; i++) {
        accumulated += getNoteBeatDuration(targetM.notes[i]);
        if (accumulated >= report.expectedBeats && i < targetM.notes.length - 1) {
          splitIdx = i + 1;
          break;
        }
      }

      handleSplitMeasureAtNote(mIdx, splitIdx);
    },
    [song, handleSplitMeasureAtNote]
  );

  // Batch fix all under-beat measures in whole song
  const handleBatchFixAllIncompleteMeasures = useCallback(() => {
    let fixedCount = 0;
    const newMeasures = song.measures.map((m) => {
      const report = getMeasureRhythmReport(m, song.timeSignature || '4/4');
      if (report.isUnder) {
        fixedCount++;
        const restDurations = getRestDurationsForDeficit(report.absDiff);
        const newRestNotes: JianpuNote[] = restDurations.map(dur => ({
          id: generateId('n'),
          pitch: 0,
          octave: 0,
          duration: dur,
          lyric: {},
        }));
        return {
          ...m,
          notes: [...m.notes, ...newRestNotes],
        };
      }
      return m;
    });

    if (fixedCount === 0) {
      showNotice('All measures already have full beats!');
      return;
    }

    onUpdateSong({ ...song, measures: newMeasures });
    showNotice(`Automatically padded ${fixedCount} incomplete measure(s) with rests!`);
  }, [song, onUpdateSong, showNotice]);

  // Undo / Redo triggers with user feedback
  const handleUndo = useCallback(() => {
    if (!onUndo) return false;
    const success = onUndo();
    if (success) {
      showNotice('Undo modification');
    }
    return success;
  }, [onUndo, showNotice]);

  const handleRedo = useCallback(() => {
    if (!onRedo) return false;
    const success = onRedo();
    if (success) {
      showNotice('Redo modification');
    }
    return success;
  }, [onRedo, showNotice]);

  // Jump to specific measure from SectionRail
  const handleJumpToMeasure = useCallback((mIdx: number) => {
    const m = song.measures[mIdx];
    let targetNoteIdx = 0;
    if (m && m.notes.length > 0) {
      const firstPitchedIdx = m.notes.findIndex(
        n => !isNonNotationItem(n) && (typeof n.pitch === 'number' && n.pitch > 0 || Boolean(n.lyric.hanji && !isPunctuationOrSpacer(n.lyric.hanji)))
      );
      targetNoteIdx = firstPitchedIdx !== -1 ? firstPitchedIdx : 0;
    }

    setSelectedCoord([mIdx, targetNoteIdx]);
    const note = song.measures[mIdx]?.notes[targetNoteIdx] || song.measures[mIdx]?.notes[0];
    if (note) {
      audioEngine.previewNote(song.key, note);
    }
    if (editMode === 'verse') {
      let vIdx = verses.findIndex(v =>
        v.notes.some(n => n.measureIndex === mIdx && n.noteIndex === targetNoteIdx)
      );
      if (vIdx === -1) {
        vIdx = verses.findIndex(v => v.notes.some(n => n.measureIndex === mIdx));
      }
      if (vIdx !== -1) {
        scrollToCardElement(`verse-card-${vIdx}`);
      }
    } else {
      scrollToCardElement(`measure-card-${mIdx}`);
    }
  }, [song, audioEngine, editMode, verses]);

  // Keyboard listener for quick score editing (undo/redo handled globally at master transport)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute('contenteditable') === 'true';

      if (isTyping) return;
      if (selectedMeasureIndex === null || selectedNoteIndex === null) return;

      // 1-7 or 0 (Numpad or number row): Pitch input
      if (
        ['1', '2', '3', '4', '5', '6', '7', '0'].includes(e.key) ||
        (e.code && /^Numpad[0-7]$/.test(e.code))
      ) {
        e.preventDefault();
        const digitStr = e.code && /^Numpad[0-7]$/.test(e.code) ? e.code.replace('Numpad', '') : e.key;
        const p = parseInt(digitStr, 10) as PitchNumber;
        handleSetPitch(p);
      } else if (['e', 'E', '_', 'x', 'X', 'Backspace', 'Delete'].includes(e.key)) {
        e.preventDefault();
        handleSetPitch('empty');
      } else if (e.key === '/' || e.code === 'NumpadDivide') {
        // Halve duration: / or NumpadDivide
        e.preventDefault();
        handleHalveDuration();
      } else if (e.key === '*' || e.code === 'NumpadMultiply') {
        // Double duration: * or NumpadMultiply
        e.preventDefault();
        handleDoubleDuration();
      } else if (e.key === '-' || e.code === 'NumpadSubtract') {
        // Octave down
        e.preventDefault();
        handleSetOctave(-1);
      } else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        // Octave up
        e.preventDefault();
        handleSetOctave(1);
      } else if (e.key === '.' || e.code === 'NumpadDecimal') {
        // Toggle dotted note
        e.preventDefault();
        handleToggleDotted();
      } else if (e.key === 't' || e.key === 'T') {
        // Toggle tie / slur
        e.preventDefault();
        handleToggleTie();
      } else if (e.key === '#') {
        // Toggle sharp accidental
        e.preventDefault();
        handleSetAccidental('#');
      } else if (e.key === 'b') {
        // Toggle flat accidental
        e.preventDefault();
        handleSetAccidental('b');
      } else if (['，', '。', '！', '？', '、', '—', '…', '「', '」', ','].includes(e.key)) {
        e.preventDefault();
        const mark = e.key === ',' ? '，' : e.key;
        handleInsertPunctuationToNote(mark);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigateNextNote();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigatePrevNote();
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
    currentNote,
    audioEngine,
    song.key,
    handleSetPitch,
    handleHalveDuration,
    handleDoubleDuration,
    handleSetOctave,
    handleToggleDotted,
    handleToggleTie,
    handleSetAccidental,
    handleNavigateNextNote,
    handleNavigatePrevNote,
    handleInsertPunctuationToNote,
  ]);

  return (
    <div id="composer-editor-root" className="flex flex-col gap-5 w-full pb-10">
      {/* Inline Notification Banner */}
      {notification && (
        <div
          id="composer-notice-banner"
          className="p-3 bg-amber-500 text-zinc-950 font-bold text-xs rounded-2xl shadow-md flex items-center justify-between animate-in fade-in duration-150"
        >
          <span>{notification}</span>
          <button
            id="composer-notice-dismiss-btn"
            type="button"
            onClick={() => setNotification(null)}
            className="px-2.5 py-1 bg-zinc-950/20 hover:bg-zinc-950/30 rounded-lg text-xs cursor-pointer font-bold"
          >
            Close
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
        onOpenScanner={onOpenScanner}
        onStartFreshSong={onStartFreshSong}
        onOpenOrganizer={() => setIsOrganizerOpen(true)}
        incompleteMeasuresCount={incompleteMeasuresCount}
      />

      {/* Persistent Section Navigation Rail (Quick Section Jump) */}
      <SectionRail
        song={song}
        selectedMeasureIndex={selectedMeasureIndex}
        onSelectMeasure={handleJumpToMeasure}
        playingMeasureIdx={playingMeasureIdx}
      />

      {/* WYSIWYG NUMBERED NOTATION SCORE SHEET CONTAINER */}
      <div id="wysiwyg-jianpu-score-container" className="flex flex-col gap-4">
        {/* Score Sheet Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Music2 className="w-5 h-5 text-amber-500" />
            <span>Numbered Notation Score Editor</span>
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
                  title={canUndo ? `Undo [Ctrl+Z] · ${pastCount} step(s)` : 'No steps to undo'}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                  {canUndo && pastCount > 0 && (
                    <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono font-bold">
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
                  title={canRedo ? `Redo [Ctrl+Y] · ${futureCount} step(s)` : 'No steps to redo'}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  <span>Redo</span>
                  {canRedo && futureCount > 0 && (
                    <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono font-bold">
                      {futureCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Measure Organizer & Rhythm Health Inspector Trigger */}
            <button
              id="composer-open-organizer-btn"
              type="button"
              onClick={() => setIsOrganizerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 rounded-xl font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title="Measure overview, rhythm check, and layout"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Measure Organizer</span>
              {incompleteMeasuresCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-mono font-black" title={`${incompleteMeasuresCount} measure(s) under or over beat limit`}>
                  {incompleteMeasuresCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleAddMeasure}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl font-bold shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Measure</span>
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
              <span>Editor View Mode:</span>
            </span>
            <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-700">
              <button
                id="editor-mode-verse-btn"
                type="button"
                onClick={() => setEditMode('verse')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[36px] ${
                  editMode === 'verse'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Verse Mode</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-600/30 text-zinc-950 dark:text-zinc-900 font-extrabold ml-1">
                  Recommended
                </span>
              </button>

              <button
                id="editor-mode-measure-btn"
                type="button"
                onClick={() => setEditMode('measure')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[36px] ${
                  editMode === 'measure'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Measure Mode</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            {editMode === 'verse' ? (
              <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/60 font-medium">
                <span className="font-bold text-amber-600 dark:text-amber-400">Verse Mode:</span>
                Auto-grouped by punctuation and breath rests · {verses.length} verses total
              </span>
            ) : (
              <span className="flex items-center gap-1.5 bg-zinc-200/70 dark:bg-zinc-700/60 text-zinc-800 dark:text-zinc-200 px-3 py-1.5 rounded-xl font-medium">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">Measure Mode:</span>
                Arranged by score barlines · {song.measures.length} measures total
              </span>
            )}
          </div>
        </div>

        {/* Score Grid: Conditional by Edit Mode ('verse' vs 'measure') with In-Card Note Editing */}
        {editMode === 'verse' ? (
          <VerseModeView
            verses={verses}
            selectedMeasureIndex={selectedMeasureIndex}
            selectedNoteIndex={selectedNoteIndex}
            currentNote={currentNote}
            keySignature={song.key}
            audioEngine={audioEngine}
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
            onNavigateNextNote={handleNavigateNextNote}
            onNavigatePrevNote={handleNavigatePrevNote}
            autoStepAdvance={autoStepAdvance}
            onToggleAutoStepAdvance={() => setAutoStepAdvance(prev => !prev)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            pastCount={pastCount}
            futureCount={futureCount}
            showNotice={showNotice}
            onSplitMeasureAtNote={handleSplitMeasureAtNote}
          />
        ) : (
          <MeasureModeView
            song={song}
            selectedMeasureIndex={selectedMeasureIndex}
            selectedNoteIndex={selectedNoteIndex}
            currentNote={currentNote}
            keySignature={song.key}
            audioEngine={audioEngine}
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
            onNavigateNextNote={handleNavigateNextNote}
            onNavigatePrevNote={handleNavigatePrevNote}
            autoStepAdvance={autoStepAdvance}
            onToggleAutoStepAdvance={() => setAutoStepAdvance(prev => !prev)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            pastCount={pastCount}
            futureCount={futureCount}
            showNotice={showNotice}
            onSplitMeasureAtNote={handleSplitMeasureAtNote}
            onMergeWithNextMeasure={handleMergeWithNextMeasure}
            onShiftNoteToNextMeasure={handleShiftNoteToNextMeasure}
            onPullNoteFromNextMeasure={handlePullNoteFromNextMeasure}
            onMoveMeasureOrder={handleMoveMeasureOrder}
            onToggleLineBreak={handleToggleMeasureLineBreak}
            onUpdateBarlineType={handleUpdateBarlineType}
            onAutoFillRest={handleAutoFillMeasureRest}
            onTrimExcessNotes={handleTrimExcessNotes}
          />
        )}

        {/* Bottom Append Measure Button */}
        <div className="flex justify-center pt-2">
          <button
            id="composer-add-measure-bottom-btn"
            type="button"
            onClick={handleAddMeasure}
            className="flex items-center gap-2 px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Append Measure</span>
          </button>
        </div>
      </div>

      {/* Measure Organizer & Layout Inspector Modal */}
      <MeasureOrganizerModal
        isOpen={isOrganizerOpen}
        onClose={() => setIsOrganizerOpen(false)}
        song={song}
        onMoveMeasure={handleMoveMeasureOrder}
        onSelectMeasure={handleJumpToMeasure}
        onToggleLineBreak={handleToggleMeasureLineBreak}
        onUpdateBarlineType={handleUpdateBarlineType}
        onAutoFillRest={handleAutoFillMeasureRest}
        onBatchAutoFillAllRests={handleBatchFixAllIncompleteMeasures}
        onDeleteMeasure={handleDeleteMeasure}
        onAddMeasure={handleAddMeasure}
      />
    </div>
  );
};
