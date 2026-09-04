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
  ArticulationType,
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
  getMeasureChords,
  isVerseBreakNote,
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
  Mic2,
  Play,
  Square,
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
  onPlayKaraoke?: (startMeasureIndex?: number) => void;
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
  onPlayKaraoke,
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

  const [isSongPlaying, setIsSongPlaying] = useState<boolean>(() => (audioEngine ? audioEngine.getIsPlaying() : false));

  // Handle stop audio playback directly from score editor deck
  const handleStopAudio = useCallback(() => {
    if (audioEngine) {
      audioEngine.stop();
    }
  }, [audioEngine]);

  // Subscribe to audio engine playback state
  useEffect(() => {
    const unsub = audioEngine.subscribeState(state => {
      setIsSongPlaying(state.isPlaying);
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
      const nextM = selectedMeasureIndex + 1;
      handleSelectNote(nextM, 0);
      if (editMode === 'verse') {
        const vIdx = verses.findIndex(v =>
          v.notes.some(n => n.measureIndex === nextM && n.noteIndex === 0)
        );
        if (vIdx !== -1) {
          scrollToCardElement(`verse-card-${vIdx}`);
        }
      } else {
        scrollToCardElement(`measure-card-${nextM}`);
      }
    }
  }, [selectedMeasureIndex, selectedNoteIndex, song.measures, handleSelectNote, editMode, verses]);

  const handleNavigatePrevNote = useCallback(() => {
    if (selectedMeasureIndex === null || selectedNoteIndex === null) return;
    if (selectedNoteIndex > 0) {
      handleSelectNote(selectedMeasureIndex, selectedNoteIndex - 1);
    } else if (selectedMeasureIndex > 0) {
      const prevMIdx = selectedMeasureIndex - 1;
      const prevM = song.measures[prevMIdx];
      if (prevM && prevM.notes.length > 0) {
        const prevNoteIdx = prevM.notes.length - 1;
        handleSelectNote(prevMIdx, prevNoteIdx);
        if (editMode === 'verse') {
          const vIdx = verses.findIndex(v =>
            v.notes.some(n => n.measureIndex === prevMIdx && n.noteIndex === prevNoteIdx)
          );
          if (vIdx !== -1) {
            scrollToCardElement(`verse-card-${vIdx}`);
          }
        } else {
          scrollToCardElement(`measure-card-${prevMIdx}`);
        }
      }
    }
  }, [selectedMeasureIndex, selectedNoteIndex, song.measures, handleSelectNote, editMode, verses]);

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
    updateSelectedNote(n => {
      const nextTie = !(n.tieToNext ?? n.isTied);
      showNotice(nextTie ? '已設定連結音 ⌒ (Tie - 融合成一音)' : '已關閉連結音');
      return { ...n, tieToNext: nextTie, isTied: nextTie };
    });
  }, [updateSelectedNote, showNotice]);

  // Toggle slur
  const handleToggleSlur = useCallback(() => {
    updateSelectedNote(n => {
      const nextSlur = !n.slurToNext;
      showNotice(nextSlur ? '已設定圓滑線 ⌢ (Slur / 一字多音)' : '已關閉圓滑線');
      return { ...n, slurToNext: nextSlur };
    });
  }, [updateSelectedNote, showNotice]);

  // Set articulation
  const handleSetArticulation = useCallback((art: ArticulationType) => {
    updateSelectedNote(n => {
      showNotice(`記號設定：${art}`);
      return { ...n, articulation: art };
    });
  }, [updateSelectedNote, showNotice]);

  // Toggle triplet
  const handleToggleTriplet = useCallback(() => {
    updateSelectedNote(n => {
      const nextTrip = !n.isTriplet;
      let nextDur = n.duration;
      if (nextTrip) {
        if (n.duration === 0.5) nextDur = 0.333;
        else if (n.duration === 1) nextDur = 0.667;
        else nextDur = 0.333;
      } else {
        if (n.duration === 0.333) nextDur = 0.5;
        else if (n.duration === 0.667) nextDur = 1;
      }
      showNotice(nextTrip ? '已切換為三連音 ┌ 3 ┐' : '已關閉三連音');
      return { ...n, isTriplet: nextTrip, duration: nextDur };
    });
  }, [updateSelectedNote, showNotice]);

  // Toggle double dotted
  const handleToggleDoubleDotted = useCallback(() => {
    updateSelectedNote(n => {
      const nextDouble = !n.isDoubleDotted;
      let nextDur = n.duration;
      if (nextDouble) {
        if (n.duration === 1) nextDur = 1.75;
        else if (n.duration === 2) nextDur = 3.5;
      } else {
        if (n.duration === 1.75) nextDur = 1;
        else if (n.duration === 3.5) nextDur = 2;
      }
      showNotice(nextDouble ? '已切換為雙附點 ··' : '已關閉雙附點');
      return { ...n, isDoubleDotted: nextDouble, duration: nextDur };
    });
  }, [updateSelectedNote, showNotice]);

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
    type: 'hanji' | 'poj' | 'pij' | 'custom' | 'roman' | 'hanlo',
    val: string
  ) => {
    updateNoteAt(mIdx, nIdx, n => {
      const updatedLyric = {
        ...n.lyric,
      };
      if (type === 'roman') {
        updatedLyric.poj = val;
        updatedLyric.pij = val;
      } else if (type === 'hanlo') {
        updatedLyric.hanji = val;
        updatedLyric.custom = val;
      } else if (type === 'poj') {
        updatedLyric.poj = val;
      } else if (type === 'pij') {
        updatedLyric.pij = val;
      } else if (type === 'hanji') {
        updatedLyric.hanji = val;
      } else if (type === 'custom') {
        updatedLyric.custom = val;
      }
      const rawHanji = updatedLyric.hanji ?? '';
      const rawCustom = updatedLyric.custom ?? '';
      const rawPoj = updatedLyric.poj ?? '';
      const rawPij = updatedLyric.pij ?? '';

      const hasAnyLyric =
        rawHanji.length > 0 ||
        rawCustom.length > 0 ||
        rawPoj.length > 0 ||
        rawPij.length > 0;

      const isPurePunct =
        hasAnyLyric &&
        (!rawHanji || isPunctuationOrSpacer(rawHanji)) &&
        (!rawCustom || isPunctuationOrSpacer(rawCustom)) &&
        (!rawPoj || isPunctuationOrSpacer(rawPoj)) &&
        (!rawPij || isPunctuationOrSpacer(rawPij));

      return {
        ...n,
        lyric: updatedLyric,
        pitch: isPurePunct ? 'empty' : n.pitch,
        duration: isPurePunct ? (0 as NoteDuration) : n.duration,
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
      const isNewline = punct === '\n' || punct === '\r' || punct === '↵';
      if (isNewline) {
        showNotice('Inserted newline verse break "↵" (0 beats)');
      } else if (punct === ' ') {
        showNotice('Inserted space spacer "␣" (0 beats, no verse split)');
      } else {
        showNotice(`Inserted delimiter "${punct}" (0 beats, no verse split)`);
      }
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
  const handleGoToNextNote = (currentMIdx: number, currentNIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom' | 'roman' | 'hanlo') => {
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
  const handleGoToPrevNote = (currentMIdx: number, currentNIdx: number, type: 'hanji' | 'poj' | 'pij' | 'custom' | 'roman' | 'hanlo') => {
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

    const tokens = splitVerseTextTokens(text);
    if (tokens.length === 0) return;

    let appendedCount = 0;
    const newMeasures = song.measures.map((m, idx) => {
      if (idx !== mIdx) return m;

      const newNotes: JianpuNote[] = [];
      let tokenIdx = 0;

      for (let nIdx = 0; nIdx < m.notes.length; nIdx++) {
        const note = { ...m.notes[nIdx], lyric: { ...m.notes[nIdx].lyric } };
        if (tokenIdx >= tokens.length) {
          newNotes.push(note);
          continue;
        }

        const tok = tokens[tokenIdx];
        const tokStr = tok.text;
        const isPunct = tok.isPunct || isPunctuationOrSpacer(tokStr) || tokStr === '\n' || tokStr === '↵';
        const isTargetNonNotation = isNonNotationItem(note);

        // If target note on score is already a non-notation delimiter/spacer and incoming token is a sung syllable,
        // skip it so the syllable aligns to a pitched note
        if (isTargetNonNotation && !isPunct) {
          newNotes.push(note);
          continue;
        }

        const isHan = /[\u4e00-\u9fa5]/.test(tokStr);
        note.pitch = isPunct ? 'empty' : note.pitch;
        note.duration = isPunct ? (0 as NoteDuration) : note.duration;
        note.lyric = {
          ...note.lyric,
          hanji: isHan || isPunct ? tokStr : note.lyric.hanji || '',
          poj: !isHan && !isPunct ? tokStr : note.lyric.poj || '',
          pij: !isHan && !isPunct ? tokStr : note.lyric.pij || '',
          custom: tokStr,
        };
        newNotes.push(note);
        tokenIdx++;
      }

      // If input is longer than existing notes in measure, append empty notes
      if (tokenIdx < tokens.length) {
        // Find if measure ends with trailing verse break note(s) (e.g. ↵)
        let insertIdx = newNotes.length;
        while (insertIdx > 0 && isVerseBreakNote(newNotes[insertIdx - 1])) {
          insertIdx--;
        }

        const extraNotes: JianpuNote[] = [];
        while (tokenIdx < tokens.length) {
          const tok = tokens[tokenIdx];
          const tokStr = tok.text;
          const isPunct = tok.isPunct || isPunctuationOrSpacer(tokStr) || tokStr === '\n' || tokStr === '↵';
          const isHan = /[\u4e00-\u9fa5]/.test(tokStr);

          extraNotes.push({
            id: generateId('n'),
            pitch: 'empty',
            duration: 0 as NoteDuration,
            octave: 0,
            lyric: {
              hanji: isHan || isPunct ? tokStr : '',
              poj: !isHan && !isPunct ? tokStr : '',
              pij: !isHan && !isPunct ? tokStr : '',
              custom: tokStr,
            },
          });
          tokenIdx++;
        }
        appendedCount = extraNotes.length;
        newNotes.splice(insertIdx, 0, ...extraNotes);
      }

      return { ...m, notes: newNotes };
    });

    onUpdateSong(normalizeSongDurations({ ...song, measures: newMeasures }));
    if (appendedCount > 0) {
      showNotice(`Distributed "${text}" across Measure ${mIdx + 1} (appended ${appendedCount} empty note${appendedCount > 1 ? 's' : ''})!`);
    } else {
      showNotice(`Distributed "${text}" across notes in Measure ${mIdx + 1}!`);
    }
    setMeasureBatchTexts(prev => ({ ...prev, [mIdx]: '' }));
  };

  // Quick whole-verse lyric distributor (Verse Mode & Verse Organizer)
  const handleDistributeVerseLyrics = (verse: VerseItem, vIdx: number, overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : (verseBatchTexts[vIdx] || '')).trim();
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

      const isPunct = tok.isPunct || isPunctuationOrSpacer(tokStr) || tokStr === '\n' || tokStr === '↵';

      // If target note on score is already a non-notation delimiter/spacer (e.g. comma, newline)
      // and incoming token is a sung syllable, skip it so the syllable aligns to a pitched note
      const isTargetNonNotation = isNonNotationItem(targetNote);
      if (isTargetNonNotation && !isPunct) {
        return;
      }

      const isHan = /[\u4e00-\u9fa5]/.test(tokStr);

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

    let appendedCount = 0;
    // If input is longer than existing notes in verse, append empty notes instead of truncating
    if (tokenIdx < tokens.length) {
      let targetMeasureIdx = 0;
      let targetInsertIdx = 0;

      if (verse.notes.length === 0) {
        if (newMeasures.length === 0) {
          newMeasures.push({
            id: generateId('m'),
            measureNumber: 1,
            notes: [],
          });
        }
        targetMeasureIdx = newMeasures.length - 1;
        targetInsertIdx = newMeasures[targetMeasureIdx].notes.length;
      } else {
        // Find the first trailing verse break note in verse.notes, if any
        let firstTrailingBreakIdx = verse.notes.length;
        while (
          firstTrailingBreakIdx > 0 &&
          isVerseBreakNote(verse.notes[firstTrailingBreakIdx - 1].note)
        ) {
          firstTrailingBreakIdx--;
        }

        if (firstTrailingBreakIdx < verse.notes.length) {
          // Insert right BEFORE the first trailing verse break note
          const breakRef = verse.notes[firstTrailingBreakIdx];
          targetMeasureIdx = breakRef.measureIndex;
          const foundIdx = newMeasures[targetMeasureIdx].notes.findIndex(n => n.id === breakRef.note.id);
          targetInsertIdx = foundIdx !== -1 ? foundIdx : breakRef.noteIndex;
        } else {
          // No trailing verse break note; insert right after the last note of this verse
          const lastRef = verse.notes[verse.notes.length - 1];
          targetMeasureIdx = lastRef.measureIndex;
          const foundIdx = newMeasures[targetMeasureIdx].notes.findIndex(n => n.id === lastRef.note.id);
          targetInsertIdx = (foundIdx !== -1 ? foundIdx : lastRef.noteIndex) + 1;
        }
      }

      const extraNotes: JianpuNote[] = [];
      while (tokenIdx < tokens.length) {
        const tok = tokens[tokenIdx];
        const tokStr = tok.text;
        const isPunct = tok.isPunct || isPunctuationOrSpacer(tokStr) || tokStr === '\n' || tokStr === '↵';
        const isHan = /[\u4e00-\u9fa5]/.test(tokStr);

        extraNotes.push({
          id: generateId('n'),
          pitch: 'empty',
          duration: 0 as NoteDuration,
          octave: 0,
          lyric: {
            hanji: isHan || isPunct ? tokStr : '',
            poj: !isHan && !isPunct ? tokStr : '',
            pij: !isHan && !isPunct ? tokStr : '',
            custom: tokStr,
          },
        });
        tokenIdx++;
      }

      appendedCount = extraNotes.length;
      newMeasures[targetMeasureIdx].notes.splice(targetInsertIdx, 0, ...extraNotes);
    }

    onUpdateSong(normalizeSongDurations({ ...song, measures: newMeasures }));
    if (appendedCount > 0) {
      showNotice(`Distributed "${text}" across Verse ${vIdx + 1} (appended ${appendedCount} empty note${appendedCount > 1 ? 's' : ''})!`);
    } else {
      showNotice(`Distributed "${text}" across notes in Verse ${vIdx + 1}!`);
    }
    if (overrideText === undefined) {
      setVerseBatchTexts(prev => ({ ...prev, [vIdx]: '' }));
    }
  };

  // Add note to the end of a verse
  const handleAddNoteToVerseEnd = (verse: VerseItem) => {
    if (verse.notes.length === 0) {
      handleAddMeasure();
      return;
    }
    // If verse ends with verse break note(s), insert before the first trailing break note
    let firstTrailingBreakIdx = verse.notes.length;
    while (
      firstTrailingBreakIdx > 0 &&
      isVerseBreakNote(verse.notes[firstTrailingBreakIdx - 1].note)
    ) {
      firstTrailingBreakIdx--;
    }

    if (firstTrailingBreakIdx < verse.notes.length) {
      const breakRef = verse.notes[firstTrailingBreakIdx];
      handleInsertNoteAt(breakRef.measureIndex, breakRef.noteIndex - 1);
    } else {
      const lastNoteRef = verse.notes[verse.notes.length - 1];
      handleInsertNoteAt(lastNoteRef.measureIndex, lastNoteRef.noteIndex);
    }
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
    showNotice(`Duplicated Measure #${mIdx + 1}`);
    setTimeout(() => {
      scrollToCardElement(`measure-card-${mIdx + 1}`);
    }, 100);
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
      const chords = getMeasureChords({ chord });
      return { ...m, chord, chords };
    });
    onUpdateSong({ ...song, measures: newMeasures });
  };

  // Measure Section change
  const handleUpdateMeasureSection = useCallback(
    (mIdx: number, section: string) => {
      const newMeasures = song.measures.map((m, idx) => {
        if (idx !== mIdx) return m;
        return { ...m, section };
      });
      onUpdateSong({ ...song, measures: newMeasures });
    },
    [song, onUpdateSong]
  );

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
      setTimeout(() => {
        scrollToCardElement(`measure-card-${toIdx}`);
      }, 100);
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

  // Move verse order (reorder entire block of measures for a verse)
  const handleMoveVerseOrder = useCallback(
    (fromVerseIdx: number, toVerseIdx: number) => {
      if (
        fromVerseIdx < 0 ||
        fromVerseIdx >= verses.length ||
        toVerseIdx < 0 ||
        toVerseIdx >= verses.length ||
        fromVerseIdx === toVerseIdx
      )
        return;

      const fromVerse = verses[fromVerseIdx];
      const toVerse = verses[toVerseIdx];

      const fromIndices = Array.from(new Set(fromVerse.notes.map(n => n.measureIndex))).sort((a, b) => a - b);
      const toIndices = Array.from(new Set(toVerse.notes.map(n => n.measureIndex))).sort((a, b) => a - b);

      if (fromIndices.length === 0 || toIndices.length === 0) return;

      // Check for measure overlap
      const hasOverlap = fromIndices.some(idx => toIndices.includes(idx));
      if (hasOverlap) {
        showNotice('Cannot reorder verses that share the same measure. Please split the measure first.');
        return;
      }

      const minFrom = fromIndices[0];
      const maxFrom = fromIndices[fromIndices.length - 1];
      const minTo = toIndices[0];
      const maxTo = toIndices[toIndices.length - 1];

      const currentMeasures = song.measures;
      let newMeasures: Measure[] = [];
      let newSelectedMIdx = minTo;
      if (fromVerseIdx > toVerseIdx) {
        // Moving up: from block placed before to block
        const beforeTo = currentMeasures.slice(0, minTo);
        const fromBlock = currentMeasures.slice(minFrom, maxFrom + 1);
        const betweenToAndFrom = currentMeasures.slice(minTo, minFrom);
        const afterFrom = currentMeasures.slice(maxFrom + 1);
        newMeasures = [...beforeTo, ...fromBlock, ...betweenToAndFrom, ...afterFrom];
        newSelectedMIdx = minTo;
      } else {
        // Moving down: from block placed after to block
        const beforeFrom = currentMeasures.slice(0, minFrom);
        const betweenFromAndTo = currentMeasures.slice(maxFrom + 1, maxTo + 1);
        const fromBlock = currentMeasures.slice(minFrom, maxFrom + 1);
        const afterTo = currentMeasures.slice(maxTo + 1);
        newMeasures = [...beforeFrom, ...betweenFromAndTo, ...fromBlock, ...afterTo];
        newSelectedMIdx = minFrom + (maxTo - maxFrom);
      }

      const renumbered = renumberMeasures(newMeasures);
      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([newSelectedMIdx, 0]);
      showNotice(`Moved Verse #${fromVerseIdx + 1} to position #${toVerseIdx + 1}`);
      setTimeout(() => {
        scrollToCardElement(`verse-card-${toVerseIdx}`);
      }, 100);
    },
    [verses, song, onUpdateSong, showNotice]
  );

  // Jump to edit verse in score editor
  const handleJumpToVerse = useCallback(
    (verse: VerseItem) => {
      if (verse.notes.length === 0) return;
      setEditMode('verse');
      const firstNote =
        verse.notes.find(
          n =>
            !isNonNotationItem(n.note) &&
            ((typeof n.note.pitch === 'number' && n.note.pitch > 0) ||
              Boolean(n.note.lyric.hanji && !isPunctuationOrSpacer(n.note.lyric.hanji)))
        ) || verse.notes[0];

      handleSelectNote(firstNote.measureIndex, firstNote.noteIndex);
      setTimeout(() => {
        scrollToCardElement(`verse-card-${verse.verseIndex}`);
      }, 100);
    },
    [handleSelectNote, setEditMode]
  );

  // Toggle verse line break (sets isLineBreak on the last measure of the verse)
  const handleToggleVerseLineBreak = useCallback(
    (verse: VerseItem) => {
      const mIndices = Array.from(new Set(verse.notes.map(n => n.measureIndex))).sort((a, b) => a - b);
      if (mIndices.length === 0) return;
      const lastMIdx = mIndices[mIndices.length - 1];
      handleToggleMeasureLineBreak(lastMIdx);
    },
    [handleToggleMeasureLineBreak]
  );

  // Update verse section name on its starting measure
  const handleUpdateVerseSection = useCallback(
    (verse: VerseItem, section: string) => {
      const mIndices = Array.from(new Set(verse.notes.map(n => n.measureIndex))).sort((a, b) => a - b);
      if (mIndices.length === 0) return;
      const firstMIdx = mIndices[0];
      handleUpdateMeasureSection(firstMIdx, section);
    },
    [handleUpdateMeasureSection]
  );

  // Auto-fill missing rests in all under-beat measures of a verse
  const handleAutoFillVerseRests = useCallback(
    (verse: VerseItem) => {
      const mIndices = Array.from(new Set(verse.notes.map(n => n.measureIndex))).sort((a, b) => a - b);
      if (mIndices.length === 0) return;

      let paddedCount = 0;
      const updatedMeasures = song.measures.map((m, idx) => {
        if (!mIndices.includes(idx)) return m;
        const report = getMeasureRhythmReport(m, song.timeSignature || '4/4');
        if (!report.isUnder || report.absDiff <= 0) return m;

        paddedCount++;
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
      });

      if (paddedCount > 0) {
        onUpdateSong({ ...song, measures: updatedMeasures });
        showNotice(`Auto-padded ${paddedCount} measure(s) in Verse #${verse.verseIndex + 1}`);
      } else {
        showNotice(`All measures in Verse #${verse.verseIndex + 1} already have full beats.`);
      }
    },
    [song, onUpdateSong, showNotice]
  );

  // Duplicate entire verse
  const handleDuplicateVerse = useCallback(
    (verse: VerseItem) => {
      const mIndices = Array.from(new Set(verse.notes.map(n => n.measureIndex))).sort((a, b) => a - b);
      if (mIndices.length === 0) return;

      const maxMIdx = mIndices[mIndices.length - 1];
      const targetMeasures = mIndices.map(idx => song.measures[idx]).filter(Boolean);

      const clonedMeasures: Measure[] = targetMeasures.map((m, i) => ({
        ...m,
        id: generateId('m'),
        section: i === 0 && m.section ? `${m.section} (Copy)` : m.section,
        notes: m.notes.map(n => ({
          ...n,
          id: generateId('n'),
          lyric: { ...n.lyric },
        })),
      }));

      const newMeasures = [
        ...song.measures.slice(0, maxMIdx + 1),
        ...clonedMeasures,
        ...song.measures.slice(maxMIdx + 1),
      ];

      const renumbered = renumberMeasures(newMeasures);
      onUpdateSong({ ...song, measures: renumbered });
      setSelectedCoord([maxMIdx + 1, 0]);
      showNotice(`Duplicated Verse #${verse.verseIndex + 1} (${clonedMeasures.length} measures)`);
      setTimeout(() => {
        scrollToCardElement(`verse-card-${verse.verseIndex + 1}`);
      }, 100);
    },
    [song, onUpdateSong, showNotice]
  );

  // Delete entire verse
  const handleDeleteVerse = useCallback(
    (verse: VerseItem) => {
      const mIndices = new Set(verse.notes.map(n => n.measureIndex));
      if (song.measures.length - mIndices.size < 1) {
        showNotice('Cannot delete verse: the song must have at least one measure.');
        return;
      }

      const newMeasures = song.measures.filter((_, idx) => !mIndices.has(idx));
      const renumbered = renumberMeasures(newMeasures);
      onUpdateSong({ ...song, measures: renumbered });
      showNotice(`Deleted Verse #${verse.verseIndex + 1}`);
    },
    [song, onUpdateSong, showNotice]
  );

  // Add new verse (phrase) with 4 empty measures
  const handleAddVerse = useCallback(() => {
    const nextVerseNum = verses.length + 1;
    const newMeasures: Measure[] = Array.from({ length: 4 }).map((_, i) => ({
      id: generateId('m'),
      measureNumber: song.measures.length + i + 1,
      section: i === 0 ? `Verse ${nextVerseNum}` : undefined,
      notes: [
        { id: generateId('n'), pitch: 1, octave: 0, duration: 1, lyric: {} },
        { id: generateId('n'), pitch: 2, octave: 0, duration: 1, lyric: {} },
        { id: generateId('n'), pitch: 3, octave: 0, duration: 1, lyric: {} },
        { id: generateId('n'), pitch: 5, octave: 0, duration: 1, lyric: {} },
      ],
    }));

    const renumbered = renumberMeasures([...song.measures, ...newMeasures]);
    onUpdateSong({ ...song, measures: renumbered });
    showNotice(`Added new Verse #${nextVerseNum} (4 measures)`);
  }, [verses.length, song, onUpdateSong, showNotice]);

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
        // Toggle tie
        e.preventDefault();
        handleToggleTie();
      } else if (e.key === 's' || e.key === 'S') {
        // Toggle slur
        e.preventDefault();
        handleToggleSlur();
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
    handleToggleSlur,
    handleSetAccidental,
    handleNavigateNextNote,
    handleNavigatePrevNote,
    handleInsertPunctuationToNote,
  ]);

  return (
    <div id="composer-editor-root" className="flex flex-col gap-5 w-full pb-36 sm:pb-52">
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
        onPlayKaraoke={onPlayKaraoke}
        isPlaying={isSongPlaying}
        onStopPlayback={handleStopAudio}
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

          <div className="flex items-center gap-2 text-xs flex-wrap">
            {/* Karaoke Play / Stop Playback in Score Header */}
            {isSongPlaying ? (
              <button
                id="composer-score-stop-btn"
                type="button"
                onClick={handleStopAudio}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] animate-pulse"
                title="Stop current audio playback"
              >
                <Square className="w-3.5 h-3.5 fill-current text-white" />
                <span>Stop Playback</span>
              </button>
            ) : onPlayKaraoke ? (
              <div
                id="composer-score-karaoke-play-group"
                className="flex items-center bg-amber-500/15 dark:bg-amber-500/20 p-0.5 rounded-xl border border-amber-400/80 dark:border-amber-600/80 shadow-2xs"
              >
                <button
                  id="composer-score-karaoke-play-btn"
                  type="button"
                  onClick={() => onPlayKaraoke()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
                  title="Directly jump to Karaoke deck and play from beginning"
                >
                  <Mic2 className="w-3.5 h-3.5 text-zinc-950" />
                  <Play className="w-3 h-3 fill-current text-zinc-950" />
                  <span>Karaoke Play</span>
                </button>
                {selectedMeasureIndex !== null && selectedMeasureIndex > 0 && (
                  <button
                    id="composer-score-karaoke-play-from-measure-btn"
                    type="button"
                    onClick={() => onPlayKaraoke(selectedMeasureIndex)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
                    title={`Jump to Karaoke deck and play starting from Measure ${selectedMeasureIndex + 1}`}
                  >
                    <span>From M.{selectedMeasureIndex + 1}</span>
                  </button>
                )}
              </div>
            ) : null}
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

            {/* Verse & Measure Organizer and Layout Trigger */}
            <button
              id="composer-open-organizer-btn"
              type="button"
              onClick={() => setIsOrganizerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 rounded-xl font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title="Verse & Measure Organizer, rhythm health, and layout"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Organizer &amp; Layout</span>
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
            onToggleSlur={handleToggleSlur}
            onSetArticulation={handleSetArticulation}
            onToggleTriplet={handleToggleTriplet}
            onToggleDoubleDotted={handleToggleDoubleDotted}
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
            onDuplicateVerse={handleDuplicateVerse}
            onMoveVerseOrder={handleMoveVerseOrder}
            onDeleteVerse={handleDeleteVerse}
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
            onToggleSlur={handleToggleSlur}
            onSetArticulation={handleSetArticulation}
            onToggleTriplet={handleToggleTriplet}
            onToggleDoubleDotted={handleToggleDoubleDotted}
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

      {/* Consolidated Organizer & Layout Inspector Modal (Verses & Measures) */}
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
        initialTab={editMode}
        verses={verses}
        playingVerseIdx={playingVerseIdx}
        onTogglePlayVerse={handleTogglePlayVerse}
        onMoveVerse={handleMoveVerseOrder}
        onSelectVerse={handleJumpToVerse}
        onToggleVerseLineBreak={handleToggleVerseLineBreak}
        onUpdateVerseSection={handleUpdateVerseSection}
        onAutoFillVerseRests={handleAutoFillVerseRests}
        onDistributeVerseLyrics={handleDistributeVerseLyrics}
        onDuplicateVerse={handleDuplicateVerse}
        onDeleteVerse={handleDeleteVerse}
        onAddVerse={handleAddVerse}
      />
    </div>
  );
};
