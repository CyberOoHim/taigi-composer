'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  JianpuNote,
  KeySignature,
  LyricDisplayMode,
  Measure,
  NoteDuration,
  PitchNumber,
  Song,
  TimeSignature,
} from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import { getDurationChineseInfo, splitTaigiLyricSyllables, TAIGI_TONE_CHARS, PUNCTUATION_MARKS, ANNOTATION_MARKS } from '@/lib/taigiUtils';
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
  Keyboard,
  ChevronDown,
  ChevronUp,
  MessageSquareQuote,
  FileText,
} from 'lucide-react';

interface ComposerEditorProps {
  song: Song;
  onUpdateSong: (updatedSong: Song) => void;
  audioEngine: AudioEngine;
  displayMode: LyricDisplayMode;
  setDisplayMode: (mode: LyricDisplayMode) => void;
  onOpenAligner: () => void;
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
}) => {
  // Selected note coordinates: [measureIndex, noteIndex]
  const [selectedCoord, setSelectedCoord] = useState<[number, number] | null>([0, 0]);
  const [activeLyricField, setActiveLyricField] = useState<{
    mIdx: number;
    nIdx: number;
    type: 'hanji' | 'poj' | 'pij' | 'custom';
  } | null>(null);

  const [notification, setNotification] = useState<string | null>(null);
  const [playingMeasureIdx, setPlayingMeasureIdx] = useState<number | null>(null);
  const [activePlaybackNoteId, setActivePlaybackNoteId] = useState<string | null>(null);
  const [showTonePalette, setShowTonePalette] = useState<boolean>(true);
  const [measureBatchTexts, setMeasureBatchTexts] = useState<{ [mIdx: number]: string }>({});

  const showNotice = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(prev => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Subscribe to audio engine playback state
  useEffect(() => {
    const unsub = audioEngine.subscribeState(state => {
      setActivePlaybackNoteId(state.isPlaying ? state.currentNoteId : null);
      if (!state.isPlaying) {
        setPlayingMeasureIdx(null);
      }
    });
    return () => {
      unsub();
    };
  }, [audioEngine]);

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
      setPlayingMeasureIdx(mIdx);
      audioEngine.playMeasure(song, mIdx, () => {
        setPlayingMeasureIdx(null);
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

  // Insert character or punctuation from ToneHelperBar into the currently active or selected lyric field
  const handleInsertToneChar = (char: string) => {
    if (activeLyricField) {
      const { mIdx, nIdx, type } = activeLyricField;
      const note = song.measures[mIdx]?.notes[nIdx];
      if (note) {
        const cur = note.lyric[type] || '';
        handleUpdateLyricAt(mIdx, nIdx, type, `${cur}${char}`);
      }
    } else if (selectedMeasureIndex !== null && selectedNoteIndex !== null && currentNote) {
      const isPunct = /^[，。！？、；：—…「」()（）,\.!?\sV]+$/.test(char.trim());
      if (isPunct) {
        updateSelectedNote(n => ({
          ...n,
          pitch: 'empty',
          lyric: {
            ...n.lyric,
            hanji: char,
            custom: char,
          },
        }));
        showNotice(`已填入標點「${char}」並將音符設為空白留白`);
      } else if (char.startsWith('(') || char.startsWith('[')) {
        updateSelectedNote(n => ({
          ...n,
          pitch: 'empty',
          annotation: char,
          lyric: {
            ...n.lyric,
            hanji: char,
            custom: char,
          },
        }));
        showNotice(`已填入註解「${char}」`);
      } else {
        const cur = currentNote.lyric.poj || currentNote.lyric.hanji || '';
        handleUpdateLyricAt(selectedMeasureIndex, selectedNoteIndex, 'poj', `${cur}${char}`);
      }
    }
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

  // Global Keyboard listener for quick score editing (1-7 pitch, 0 rest when not typing in text field)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  ]);

  return (
    <div id="composer-editor-root" className="flex flex-col gap-6 w-full pb-24">
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
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Music2 className="w-5 h-5 text-amber-500" />
            <span>台語簡譜曲譜編輯區 (WYSIWYG Jianpu Score Sheet)</span>
          </h2>
          <div className="flex items-center gap-2 text-xs">
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

              {/* Audition & Note Insert / Delete */}
              <div className="flex items-center gap-1.5">
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

            {/* Integrated In-Score Pitch & Duration Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Pitch selector */}
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <span className="text-[11px] font-bold text-zinc-500 px-1">音高:</span>
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

        {/* Measure List / Score Grid */}
        <div className="flex flex-col gap-6">
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

                {/* THE WYSIWYG JIANPU SCORE ROW WITH DIRECT IN-PLACE EDITABLE LYRIC INPUTS */}
                <div className="flex items-stretch overflow-x-auto pb-2 pt-1 gap-2 sm:gap-3">
                  {measure.notes.map((note, nIdx) => {
                    const isSelected = selectedMeasureIndex === mIdx && selectedNoteIndex === nIdx;
                    const isPlaybackActive = activePlaybackNoteId === note.id;

                    const isPitched = typeof note.pitch === 'number' && note.pitch > 0;
                    const isEmptyNote = note.pitch === 'empty' || (!note.pitch && note.pitch !== 0);
                    const octaveTopDots = isPitched && note.octave > 0 ? note.octave : 0;
                    const octaveBottomDots = isPitched && note.octave < 0 ? Math.abs(note.octave) : 0;
                    const isEighth = !isEmptyNote && (note.duration === 0.5 || note.duration === 0.75);
                    const isSixteenth = !isEmptyNote && (note.duration <= 0.25 || note.duration === 0.375);
                    const showDot =
                      !isEmptyNote &&
                      (note.isDotted ||
                        note.duration === 1.5 ||
                        note.duration === 0.75 ||
                        note.duration === 3 ||
                        note.duration === 0.375 ||
                        note.duration === 1.75);
                    const dashesCount = !isEmptyNote
                      ? note.duration === 2
                        ? 1
                        : note.duration === 3
                        ? 2
                        : note.duration === 4
                        ? 3
                        : 0
                      : 0;

                    return (
                      <div
                        key={note.id}
                        id={`wysiwyg-note-cell-${mIdx}-${nIdx}`}
                        onClick={() => handleSelectNote(mIdx, nIdx)}
                        className={`group relative flex flex-col items-center justify-between p-2 rounded-xl border cursor-pointer transition-all duration-150 min-w-[72px] sm:min-w-[88px] flex-1 ${
                          isPlaybackActive
                            ? 'bg-amber-400/25 ring-2 ring-amber-500 scale-[1.03] shadow-md border-amber-500'
                            : isSelected
                            ? 'border-amber-500 bg-amber-50/90 dark:bg-amber-950/60 shadow-md ring-2 ring-amber-400/60'
                            : isEmptyNote
                            ? 'border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/40 hover:border-amber-400'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 hover:border-amber-300 dark:hover:border-amber-700'
                        }`}
                      >
                        {/* Note Duration & Index Badge */}
                        <div className="w-full flex items-center justify-between text-[10px] text-zinc-600 dark:text-zinc-400 font-mono mb-1">
                          <span>{isEmptyNote ? '空白' : getDurationChineseInfo(note.duration).jianpuSymbol}</span>
                          <span className="font-semibold text-[9px]">{note.duration}拍</span>
                        </div>

                        {/* Jianpu Musical Pitch Number Container */}
                        <div className="flex items-center justify-center relative min-h-[46px] my-1">
                          {/* Slur / Tie Arc */}
                          {note.isTied && !isEmptyNote && (
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
                                  isEmptyNote
                                    ? 'text-zinc-300 dark:text-zinc-600 font-mono text-xl font-normal'
                                    : note.pitch === 0
                                    ? 'text-zinc-400 dark:text-zinc-600 font-normal'
                                    : isPlaybackActive
                                    ? 'text-amber-600 dark:text-amber-300 scale-110'
                                    : isSelected
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : 'text-zinc-900 dark:text-zinc-100'
                                }`}
                              >
                                {isEmptyNote ? (note.annotation ? '' : '␣') : note.pitch}
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
                  })}
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

      {/* DOCKED BOTTOM TAIGI TONE & DIACRITIC PALETTE (Always accessible while editing lyrics in the score sheet) */}
      <div
        id="docked-tone-helper-bar"
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 shadow-2xl transition-all"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Keyboard className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                台語聲調盤 (Taigi Diacritics Palette)
              </span>
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 hidden sm:inline">
                · 點擊任一符號即時填入目前曲譜中選取的歌詞輸入框 (
                {activeLyricField
                  ? `第 ${activeLyricField.mIdx + 1} 小節 · 第 ${activeLyricField.nIdx + 1} 音符 [${
                      activeLyricField.type
                    }]`
                  : '請點選曲譜中的歌詞框'}
                )
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowTonePalette(prev => !prev)}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md"
            >
              {showTonePalette ? (
                <>
                  <span>收合聲調盤</span>
                  <ChevronDown className="w-3 h-3" />
                </>
              ) : (
                <>
                  <span>展開聲調盤</span>
                  <ChevronUp className="w-3 h-3" />
                </>
              )}
            </button>
          </div>

          {showTonePalette && (
            <div className="flex flex-wrap items-center gap-1 max-h-20 overflow-y-auto pb-1">
              {TAIGI_TONE_CHARS.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleInsertToneChar(item.char)}
                  className="px-2 py-0.5 text-xs font-serif bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-100 hover:text-amber-900 dark:hover:bg-amber-950 dark:hover:text-amber-200 border border-zinc-200 dark:border-zinc-700 rounded transition-colors select-none font-bold"
                  title={`${item.char} (${item.desc})`}
                >
                  {item.label}
                </button>
              ))}

              <div className="w-[1px] h-5 bg-zinc-300 dark:bg-zinc-700 mx-1 hidden sm:block" />

              {/* Common Han-lo phrases */}
              {['ê', 'bô', 'hó', 'tio̍h', 'beh', 'siūⁿ', 'lâi', 'kò͘', 'chhun', 'hong'].map(
                phrase => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => handleInsertToneChar(phrase)}
                    className="px-2 py-0.5 text-xs font-serif bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded transition-colors font-medium"
                  >
                    {phrase}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
