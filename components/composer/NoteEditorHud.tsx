'use client';

import React, { useState } from 'react';
import {
  ArticulationType,
  GraceNote,
  InstrumentType,
  NumberedNotationNote,
  KeySignature,
  NoteDuration,
  PitchNumber,
  Measure,
  TimeSignature,
} from '@/types/song';
import { AudioEngine } from '@/lib/audioEngine';
import {
  getDurationChineseInfo,
  PUNCTUATION_MARKS,
  ANNOTATION_MARKS,
  formatGraceNotes,
  INSTRUMENT_OPTIONS,
  INSTRUMENT_LABELS,
  extractTaigiTone,
  isPunctuationZeroNote,
  isStandaloneAnnotationNote,
  getPunctuationDisplayChar,
  getMeasureChords,
  formatMeasureChords,
} from '@/lib/taigiUtils';
import { getDiatonicCandidateChords, suggestChordsForMeasure } from '@/lib/chordArranger';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import { getStoredDeckTab, setStoredDeckTab } from '@/lib/storage';
import {
  Volume2,
  Play,
  Square,
  Plus,
  PlusCircle,
  Trash2,
  Undo2,
  Redo2,
  MessageSquareQuote,
  FileText,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Music,
  Music2,
  Grid,
  Zap,
  Sparkles,
  Scissors,
  Sliders,
  Wand2,
  Disc,
  ArrowLeft,
  ArrowRight,
  Copy,
  CornerDownLeft,
  Check,
  Bell,
  Wind,
  Mic2,
  Keyboard,
  Layers,
  X,
  RefreshCw,
} from 'lucide-react';

export type DeckTabMode = 'numpad' | 'piano' | 'chords' | 'ornaments' | 'lyrics';

export interface NoteEditorHudProps {
  currentNote: NumberedNotationNote;
  selectedMeasureIndex: number;
  selectedNoteIndex: number | null;
  keySignature: KeySignature;
  audioEngine: AudioEngine;
  currentMeasure?: Measure;
  timeSignature?: TimeSignature;
  onUpdateMeasureChord?: (mIdx: number, chord: string) => void;
  onUpdateSelectedNote: (updater: (note: NumberedNotationNote) => NumberedNotationNote) => void;
  onSetPitch: (pitch: PitchNumber) => void;
  onSetOctave: (delta: number) => void;
  onSetAccidental: (acc: '' | '#' | 'b') => void;
  onSetDuration: (duration: NoteDuration) => void;
  onToggleDotted: () => void;
  onToggleTie: () => void;
  onToggleSlur?: () => void;
  onSetArticulation?: (art: ArticulationType) => void;
  onToggleTriplet?: () => void;
  onToggleDoubleDotted?: () => void;
  onInsertPunctuation: (punct: string) => void;
  onInsertAnnotation: (annot: string) => void;
  onSetAnnotation: (annot: string) => void;
  onInsertNoteAt: (mIdx: number, nIdx: number) => void;
  onInsertNoteBeforeAt?: (mIdx: number, nIdx: number) => void;
  onInsertBreakAt?: (mIdx: number, nIdx: number) => void;
  onDeleteNoteAt: (mIdx: number, nIdx: number) => void;
  onSplitMeasureBeforeNote?: (mIdx: number, nIdx: number) => void;
  onPushNoteToNextMeasure?: (mIdx: number, nIdx?: number) => void;
  onMoveNoteBackward?: () => void;
  onMoveNoteForward?: () => void;
  canMoveNoteBackward?: boolean;
  canMoveNoteForward?: boolean;
  onNavigateNextNote?: () => void;
  onNavigatePrevNote?: () => void;
  autoStepAdvance?: boolean;
  onToggleAutoStepAdvance?: () => void;
  onUndo?: () => boolean;
  onRedo?: () => boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  pastCount?: number;
  futureCount?: number;
  showNotice: (msg: string) => void;
  inCard?: boolean;

  // Measure-level Quick Duration actions
  onQuickToggleMeasureDuration?: (mIdx?: number) => void;
  onScaleMeasureDuration?: (factor: 0.5 | 2.0, mIdx?: number) => void;
  onSetUniformMeasureDuration?: (duration: NoteDuration, mIdx?: number) => void;

  // Container (Measure / Verse) actions
  containerType?: 'measure' | 'verse';
  containerLabel?: string;
  onDuplicateContainer?: () => void;
  onDeleteMeasure?: () => void;
  onMoveContainerBackward?: () => void;
  onMoveContainerForward?: () => void;
  canMoveContainerBackward?: boolean;
  canMoveContainerForward?: boolean;
  onTogglePlayMeasure?: (mIdx: number) => void;
  isPlayingMeasure?: boolean;
  onOpenHumToScore?: () => void;
  onOpenKeyboardToScore?: () => void;
}

const PITCH_SOLFEGE: Record<number, string> = {
  1: 'Do',
  2: 'Re',
  3: 'Mi',
  4: 'Fa',
  5: 'Sol',
  6: 'La',
  7: 'Ti',
};

export type NoteGlyphType =
  | 'quarter'
  | 'eighth'
  | 'half'
  | 'whole'
  | 'sixteenth'
  | 'thirtysecond'
  | 'dotted-quarter'
  | 'dotted-eighth'
  | 'dotted-half'
  | 'double-dot'
  | 'triplet'
  | 'spacer';

export const NoteGlyph: React.FC<{ type: NoteGlyphType; className?: string }> = ({
  type,
  className = 'w-3.5 h-3.5',
}) => {
  switch (type) {
    case 'whole': // 4 beats (Whole note / 全音符)
      return (
        <svg viewBox="0 0 18 16" className={`${className} inline-block shrink-0`} fill="none" stroke="currentColor">
          <ellipse cx="9" cy="8.5" rx="6.5" ry="4" transform="rotate(-15 9 8.5)" strokeWidth="2.2" />
        </svg>
      );
    case 'half': // 2 beats (Half note / 二分音符)
      return (
        <svg viewBox="0 0 16 16" className={`${className} inline-block shrink-0`} fill="currentColor">
          <ellipse cx="5.5" cy="11.5" rx="4.5" ry="3" transform="rotate(-20 5.5 11.5)" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9.5 11.5 V 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'quarter': // 1 beat (Quarter note / 四分音符)
      return (
        <svg viewBox="0 0 16 16" className={`${className} inline-block shrink-0`} fill="currentColor">
          <ellipse cx="5.5" cy="11.5" rx="4.5" ry="3" transform="rotate(-20 5.5 11.5)" />
          <path d="M9.5 11.5 V 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'eighth': // 0.5 beat (8th note / 八分音符)
      return (
        <svg viewBox="0 0 16 16" className={`${className} inline-block shrink-0`} fill="currentColor">
          <ellipse cx="5" cy="11.5" rx="4" ry="2.8" transform="rotate(-20 5 11.5)" />
          <path d="M8.5 11.5 V 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8.5 2 C 11.5 3.5, 13 5.5, 12 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'sixteenth': // 0.25 beat (16th note / 十六分音符)
      return (
        <svg viewBox="0 0 16 16" className={`${className} inline-block shrink-0`} fill="currentColor">
          <ellipse cx="5" cy="12" rx="3.8" ry="2.6" transform="rotate(-20 5 12)" />
          <path d="M8.5 12 V 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8.5 1.5 C 11 3, 12.5 5, 11.5 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8.5 4.5 C 11 6, 12.5 8, 11.5 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'thirtysecond': // 0.125 beat (32nd note / 三十二分音符)
      return (
        <svg viewBox="0 0 16 16" className={`${className} inline-block shrink-0`} fill="currentColor">
          <ellipse cx="5" cy="12.5" rx="3.8" ry="2.6" transform="rotate(-20 5 12.5)" />
          <path d="M8.5 12.5 V 1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8.5 1.2 C 11 2.5, 12.5 4, 11.5 5.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8.5 4 C 11 5.3, 12.5 6.8, 11.5 8.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8.5 6.8 C 11 8.1, 12.5 9.6, 11.5 11.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'dotted-quarter': // 1.5 beats (Dotted Quarter / 附點四分)
      return (
        <svg viewBox="0 0 18 16" className={`${className} inline-block shrink-0`} fill="currentColor">
          <ellipse cx="5" cy="11.5" rx="4.5" ry="3" transform="rotate(-20 5 11.5)" />
          <path d="M9 11.5 V 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="13.5" cy="10.5" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'dotted-eighth': // 0.75 beats (Dotted 8th / 附點八分)
      return (
        <svg viewBox="0 0 18 16" className={`${className} inline-block shrink-0`} fill="currentColor">
          <ellipse cx="4.5" cy="11.5" rx="4" ry="2.8" transform="rotate(-20 4.5 11.5)" />
          <path d="M8 11.5 V 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 2 C 10.5 3.5, 12 5.5, 11 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="13.5" cy="10.5" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'dotted-half': // 3 beats (Dotted Half / 附點二分)
      return (
        <svg viewBox="0 0 18 16" className={`${className} inline-block shrink-0`} fill="currentColor">
          <ellipse cx="5" cy="11.5" rx="4.5" ry="3" transform="rotate(-20 5 11.5)" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 11.5 V 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="13.5" cy="10.5" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'double-dot': // 1.75 beats (Double Dot / 雙附點)
      return (
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
        </div>
      );
    case 'triplet': // Triplet / 三連音
      return (
        <span className="font-mono text-xs font-black tracking-tighter shrink-0 leading-none">
          ┌3┐
        </span>
      );
    case 'spacer': // Spacer / 空白
      return (
        <svg viewBox="0 0 16 16" className={`${className} inline-block shrink-0`} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7 V 11 H 13 V 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
};

interface DurationPresetItem {
  dur: NoteDuration;
  glyphType: NoteGlyphType;
  beatLabel: string;
  subLabel: string;
  jianpuSymbol: string;
  desc: string;
  category: 'core' | 'subdivision' | 'dotted' | 'triplet' | 'rest';
}

const DURATION_PRESETS: DurationPresetItem[] = [
  // Core Beats (Primary pulse values)
  { dur: 1, glyphType: 'quarter', beatLabel: '1 拍', subLabel: '四分', jianpuSymbol: '5', desc: 'Quarter Note (1 beat) · 基準四分音符', category: 'core' },
  { dur: 0.5, glyphType: 'eighth', beatLabel: '½ 拍', subLabel: '八分', jianpuSymbol: '5̲', desc: '8th Note (0.5 beats) · 八分音符 (單底線)', category: 'core' },
  { dur: 2, glyphType: 'half', beatLabel: '2 拍', subLabel: '二分', jianpuSymbol: '5 -', desc: 'Half Note (2 beats) · 二分音符 (加一橫線)', category: 'core' },
  { dur: 4, glyphType: 'whole', beatLabel: '4 拍', subLabel: '全音', jianpuSymbol: '5 - - -', desc: 'Whole Note (4 beats) · 全音符 (加三橫線)', category: 'core' },

  // Subdivisions (Rapid runs)
  { dur: 0.25, glyphType: 'sixteenth', beatLabel: '¼ 拍', subLabel: '16分', jianpuSymbol: '5̳', desc: '16th Note (0.25 beats) · 十六分音符 (雙底線)', category: 'subdivision' },
  { dur: 0.125, glyphType: 'thirtysecond', beatLabel: '⅛ 拍', subLabel: '32分', jianpuSymbol: '5̷', desc: '32nd Note (0.125 beats) · 三十二分音符 (三底線)', category: 'subdivision' },

  // Dotted & Compound
  { dur: 1.5, glyphType: 'dotted-quarter', beatLabel: '1½ 拍', subLabel: '附點4', jianpuSymbol: '5·', desc: 'Dotted Quarter Note (1.5 beats) · 附點四分', category: 'dotted' },
  { dur: 0.75, glyphType: 'dotted-eighth', beatLabel: '¾ 拍', subLabel: '附點8', jianpuSymbol: '5̲·', desc: 'Dotted 8th Note (0.75 beats) · 附點八分', category: 'dotted' },
  { dur: 3, glyphType: 'dotted-half', beatLabel: '3 拍', subLabel: '附點2', jianpuSymbol: '5 - -', desc: 'Dotted Half Note (3 beats) · 附點二分', category: 'dotted' },
  { dur: 1.75, glyphType: 'double-dot', beatLabel: '1¾ 拍', subLabel: '雙附點', jianpuSymbol: '5··', desc: 'Double Dotted Quarter (1.75 beats) · 雙附點四分', category: 'dotted' },

  // Triplets & Spacers
  { dur: 0.333, glyphType: 'triplet', beatLabel: '⅓ 拍', subLabel: '三連8', jianpuSymbol: '⅓', desc: '8th Note Triplet (0.333 beats) · 八分三連音', category: 'triplet' },
  { dur: 0.667, glyphType: 'triplet', beatLabel: '⅔ 拍', subLabel: '三連4', jianpuSymbol: '⅔', desc: 'Quarter Note Triplet (0.667 beats) · 四分三連音', category: 'triplet' },
  { dur: 0, glyphType: 'spacer', beatLabel: '0 拍', subLabel: '空/間隔', jianpuSymbol: '␣', desc: 'Zero Duration · 空音符/標點間隔 (0拍)', category: 'rest' },
];

export const NoteEditorHud: React.FC<NoteEditorHudProps> = ({
  currentNote,
  selectedMeasureIndex,
  selectedNoteIndex,
  keySignature,
  audioEngine,
  currentMeasure,
  timeSignature,
  onUpdateMeasureChord,
  onUpdateSelectedNote,
  onSetPitch,
  onSetOctave,
  onSetAccidental,
  onSetDuration,
  onToggleDotted,
  onToggleTie,
  onToggleSlur,
  onSetArticulation,
  onToggleTriplet,
  onToggleDoubleDotted,
  onInsertPunctuation,
  onInsertAnnotation,
  onSetAnnotation,
  onInsertNoteAt,
  onInsertNoteBeforeAt,
  onInsertBreakAt,
  onDeleteNoteAt,
  onSplitMeasureBeforeNote,
  onPushNoteToNextMeasure,
  onMoveNoteBackward,
  onMoveNoteForward,
  canMoveNoteBackward = false,
  canMoveNoteForward = false,
  onNavigateNextNote,
  onNavigatePrevNote,
  autoStepAdvance = false,
  onToggleAutoStepAdvance,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  pastCount = 0,
  futureCount = 0,
  showNotice,
  inCard = true,
  onQuickToggleMeasureDuration,
  onScaleMeasureDuration,
  onSetUniformMeasureDuration,
  containerType,
  containerLabel,
  onDuplicateContainer,
  onDeleteMeasure,
  onMoveContainerBackward,
  onMoveContainerForward,
  canMoveContainerBackward = false,
  canMoveContainerForward = false,
  onTogglePlayMeasure,
  isPlayingMeasure = false,
  onOpenHumToScore,
  onOpenKeyboardToScore,
}) => {
  const [activeTab, setActiveTabState] = useState<DeckTabMode>(() => {
    if (typeof window !== 'undefined') return getStoredDeckTab();
    return 'numpad';
  });

  const setActiveTab = React.useCallback((tab: DeckTabMode) => {
    setActiveTabState(tab);
    setStoredDeckTab(tab);
  }, []);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isPianoCollapsed, setIsPianoCollapsed] = useState<boolean>(false);

  // Multi-Chord State
  const [chordMode, setChordMode] = useState<'append' | 'replace'>('append');
  const [chordInputText, setChordInputText] = useState<string>('');
  const [lastHarmonization, setLastHarmonization] = useState<any>(null);

  const handleCommitFreeformChord = React.useCallback(() => {
    if (!onUpdateMeasureChord || selectedMeasureIndex === null) return;
    const tokens = getMeasureChords({ chord: chordInputText });
    if (tokens.length === 0) return;

    const current = currentMeasure ? getMeasureChords(currentMeasure) : [];
    const updated = chordMode === 'append' ? [...current, ...tokens] : tokens;
    onUpdateMeasureChord(selectedMeasureIndex, formatMeasureChords(updated));
    setChordInputText('');
    showNotice(`已更新第 ${selectedMeasureIndex + 1} 小節和弦：${formatMeasureChords(updated)}`);
    if (tokens[0]) audioEngine.previewChord(tokens[0]);
  }, [chordInputText, chordMode, currentMeasure, onUpdateMeasureChord, selectedMeasureIndex, showNotice, audioEngine]);

  const handleAddDiatonicChord = React.useCallback((chord: string) => {
    if (!onUpdateMeasureChord || selectedMeasureIndex === null) return;
    const current = currentMeasure ? getMeasureChords(currentMeasure) : [];
    const updated = chordMode === 'append' ? [...current, chord] : [chord];
    onUpdateMeasureChord(selectedMeasureIndex, formatMeasureChords(updated));
    audioEngine.previewChord(chord);
    showNotice(`已設定和弦：${formatMeasureChords(updated)}`);
  }, [chordMode, currentMeasure, onUpdateMeasureChord, selectedMeasureIndex, showNotice, audioEngine]);

  const handleReorderChord = React.useCallback((fromIdx: number, toIdx: number) => {
    if (!onUpdateMeasureChord || selectedMeasureIndex === null || !currentMeasure) return;
    const current = [...getMeasureChords(currentMeasure)];
    if (fromIdx < 0 || fromIdx >= current.length || toIdx < 0 || toIdx >= current.length) return;
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    onUpdateMeasureChord(selectedMeasureIndex, formatMeasureChords(current));
  }, [currentMeasure, onUpdateMeasureChord, selectedMeasureIndex]);

  const handleRemoveChord = React.useCallback((removeIdx: number) => {
    if (!onUpdateMeasureChord || selectedMeasureIndex === null || !currentMeasure) return;
    const current = getMeasureChords(currentMeasure).filter((_, i) => i !== removeIdx);
    onUpdateMeasureChord(selectedMeasureIndex, formatMeasureChords(current));
  }, [currentMeasure, onUpdateMeasureChord, selectedMeasureIndex]);

  const handleClearAllChords = React.useCallback(() => {
    if (!onUpdateMeasureChord || selectedMeasureIndex === null) return;
    onUpdateMeasureChord(selectedMeasureIndex, '');
    showNotice(`已清除第 ${selectedMeasureIndex + 1} 小節所有和弦`);
  }, [onUpdateMeasureChord, selectedMeasureIndex, showNotice]);

  const handleAutoHarmonizeCurrentMeasure = React.useCallback(() => {
    if (!currentMeasure || !onUpdateMeasureChord || selectedMeasureIndex === null) return;
    const result = suggestChordsForMeasure(
      currentMeasure,
      keySignature,
      timeSignature || '4/4',
      { allowDualChords: true }
    );
    setLastHarmonization(result);
    onUpdateMeasureChord(selectedMeasureIndex, result.formatted);
    showNotice(`🪄 智慧配和弦：${result.formatted} (${result.rationale})`);
    if (result.chords[0]) {
      audioEngine.previewChord(result.chords[0]);
    }
  }, [currentMeasure, keySignature, onUpdateMeasureChord, selectedMeasureIndex, showNotice, timeSignature, audioEngine]);

  const durationInfo = getDurationChineseInfo(currentNote.duration);

  // Pitch formatted label
  const rawHanlo = currentNote.lyric?.hanlo || currentNote.lyric?.hanji || currentNote.lyric?.custom || '';
  const isLineBreakNote =
    currentNote.pitch === 'empty' &&
    (rawHanlo === '\n' || rawHanlo === '↵');

  const punctChar = getPunctuationDisplayChar(currentNote);

  const pitchLabel =
    currentNote.pitch === 0
      ? '0 (Rest)'
      : isStandaloneAnnotationNote(currentNote)
      ? `標記: ${currentNote.annotation} (0拍)`
      : isLineBreakNote
      ? '↵ (Line Break · 0拍)'
      : isPunctuationZeroNote(currentNote)
      ? `"${punctChar}" (標點符號 · 0拍)`
      : currentNote.pitch === 'empty'
      ? '␣ (Empty / 0拍)'
      : `${currentNote.accidental || ''}${currentNote.pitch}${
          currentNote.octave > 0
            ? '̇'.repeat(currentNote.octave)
            : currentNote.octave < 0
            ? '̣'.repeat(Math.abs(currentNote.octave))
            : ''
        }`;

  // Grace Notes handlers
  const handleAddPreGrace = () => {
    const existing = currentNote.preGraceNotes || [];
    if (existing.length >= 3) {
      showNotice('前裝飾音最多支援 3 個小音符');
      return;
    }
    const defaultPitch = (typeof currentNote.pitch === 'number' && currentNote.pitch > 0 ? currentNote.pitch : 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    const newNote: GraceNote = { pitch: defaultPitch, octave: currentNote.octave || 0, accidental: '' };
    onUpdateSelectedNote(n => ({
      ...n,
      preGraceNotes: [...(n.preGraceNotes || []), newNote],
    }));
  };

  const handleUpdatePreGrace = (index: number, updater: (g: GraceNote) => GraceNote) => {
    onUpdateSelectedNote(n => {
      const list = [...(n.preGraceNotes || [])];
      if (list[index]) {
        list[index] = updater(list[index]);
      }
      return { ...n, preGraceNotes: list };
    });
  };

  const handleRemovePreGrace = (index: number) => {
    onUpdateSelectedNote(n => ({
      ...n,
      preGraceNotes: (n.preGraceNotes || []).filter((_, i) => i !== index),
    }));
  };

  const handleAddPostGrace = () => {
    const existing = currentNote.postGraceNotes || [];
    if (existing.length >= 3) {
      showNotice('後裝飾音最多支援 3 個小音符');
      return;
    }
    const defaultPitch = (typeof currentNote.pitch === 'number' && currentNote.pitch > 0 ? currentNote.pitch : 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    const newNote: GraceNote = { pitch: defaultPitch, octave: currentNote.octave || 0, accidental: '' };
    onUpdateSelectedNote(n => ({
      ...n,
      postGraceNotes: [...(n.postGraceNotes || []), newNote],
    }));
  };

  const handleUpdatePostGrace = (index: number, updater: (g: GraceNote) => GraceNote) => {
    onUpdateSelectedNote(n => {
      const list = [...(n.postGraceNotes || [])];
      if (list[index]) {
        list[index] = updater(list[index]);
      }
      return { ...n, postGraceNotes: list };
    });
  };

  const handleRemovePostGrace = (index: number) => {
    onUpdateSelectedNote(n => ({
      ...n,
      postGraceNotes: (n.postGraceNotes || []).filter((_, i) => i !== index),
    }));
  };

  const handleApplyOrnamentPreset = (type: 'upper_single' | 'lower_single' | 'double_slide' | 'triple_turn' | 'post_drop' | 'post_lift' | 'clear') => {
    const baseP = (typeof currentNote.pitch === 'number' && currentNote.pitch > 0 ? currentNote.pitch : 5);
    const wrapPitch = (p: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 => {
      let norm = ((p - 1) % 7) + 1;
      if (norm <= 0) norm += 7;
      return norm as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    };

    let updatedPre: GraceNote[] = currentNote.preGraceNotes || [];
    let updatedPost: GraceNote[] = currentNote.postGraceNotes || [];

    switch (type) {
      case 'upper_single':
        updatedPre = [{ pitch: wrapPitch(baseP + 1), octave: currentNote.octave || 0 }];
        showNotice('已套用：單音上倚音');
        break;
      case 'lower_single':
        updatedPre = [{ pitch: wrapPitch(baseP - 1), octave: currentNote.octave || 0 }];
        showNotice('已套用：單音下倚音');
        break;
      case 'double_slide':
        updatedPre = [
          { pitch: wrapPitch(baseP - 2), octave: currentNote.octave || 0 },
          { pitch: wrapPitch(baseP - 1), octave: currentNote.octave || 0 },
        ];
        showNotice('已套用：雙音滑轉');
        break;
      case 'triple_turn':
        updatedPre = [
          { pitch: wrapPitch(baseP + 1), octave: currentNote.octave || 0 },
          { pitch: wrapPitch(baseP), octave: currentNote.octave || 0 },
          { pitch: wrapPitch(baseP - 1), octave: currentNote.octave || 0 },
        ];
        showNotice('已套用：三音迴音');
        break;
      case 'post_drop':
        updatedPost = [{ pitch: wrapPitch(baseP - 1), octave: currentNote.octave || 0 }];
        showNotice('已套用：尾音下拋');
        break;
      case 'post_lift':
        updatedPost = [{ pitch: wrapPitch(baseP + 1), octave: currentNote.octave || 0 }];
        showNotice('已套用：尾音上提');
        break;
      case 'clear':
        updatedPre = [];
        updatedPost = [];
        showNotice('已清除裝飾音');
        break;
    }

    const updatedNote: NumberedNotationNote = {
      ...currentNote,
      preGraceNotes: updatedPre,
      postGraceNotes: updatedPost,
    };
    onUpdateSelectedNote(() => updatedNote);
    audioEngine.previewNote(keySignature, updatedNote);
  };

  return (
    <div
      id={`inline-note-hud-${selectedMeasureIndex}`}
      onClick={e => e.stopPropagation()}
      className={`w-full transition-all duration-200 overflow-hidden ${
        inCard
          ? 'my-3.5 bg-white dark:bg-[#141720] border border-zinc-300 dark:border-zinc-700/80 rounded-2xl shadow-lg ring-1 ring-black/5 dark:ring-white/5'
          : 'sticky top-[68px] z-30 bg-white/95 dark:bg-[#141720]/95 backdrop-blur-md border-2 border-amber-500 rounded-2xl shadow-xl'
      }`}
    >
      {/* Top Header Bar: Note Summary & Instant Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-zinc-100/90 dark:bg-[#0c0e14]/90 border-b border-zinc-200/90 dark:border-zinc-800/90 text-xs">
        {/* Selected Note Badge & LCD Readout */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-3 py-1.5 bg-amber-500 text-zinc-950 rounded-lg font-black font-mono text-xs shadow-2xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>#{selectedMeasureIndex + 1}.{(selectedNoteIndex ?? 0) + 1}</span>
          </span>

          <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100 flex-wrap">
            <span className="daw-lcd text-sm px-3 py-1 rounded-lg font-mono font-bold shadow-xs">
              {pitchLabel}
            </span>
            <span className="text-zinc-600 dark:text-zinc-300 font-medium">
              {durationInfo.beatsLabel} ({durationInfo.name})
            </span>

            {/* Note Sound Source Override Selector (Matching Screenshot 2) */}
            <div className="flex items-center gap-1 bg-zinc-200/90 dark:bg-zinc-800/90 px-2 py-1 rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-2xs">
              <Disc className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <select
                id={`hud-note-instrument-select-${selectedMeasureIndex}-${selectedNoteIndex}`}
                value={currentNote.instrument || ''}
                onChange={e => {
                  const val = (e.target.value as InstrumentType) || undefined;
                  onUpdateSelectedNote(prev => ({
                    ...prev,
                    instrument: val,
                  }));
                  audioEngine.previewNote(keySignature, { ...currentNote, instrument: val });
                }}
                className="bg-transparent font-bold text-xs text-amber-600 dark:text-amber-400 focus:outline-hidden cursor-pointer"
                title="音色覆蓋 (Sound Source Override - Overrides primary song tone)"
              >
                <option value="" className="bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                  預設 (Default)
                </option>
                {INSTRUMENT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                    {opt.labelZh} ({opt.value})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(currentNote.tieToNext || (currentNote.isTied && !currentNote.slurToNext)) && (
            <span className="text-xs bg-amber-400/20 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-md font-bold border border-amber-400/40" title="Tie: 連結音 (音色融合成一音)">
              Tie ⌒ (連結)
            </span>
          )}

          {currentNote.slurToNext && (
            <span className="text-xs bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-md font-bold border border-purple-400/40" title="Slur: 圓滑音 (連音/一字多音)">
              Slur ⌢ (圓滑)
            </span>
          )}

          {currentNote.articulation && currentNote.articulation !== 'none' && (
            <span className="text-xs bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-1 rounded-md font-bold border border-cyan-400/40">
              {currentNote.articulation === 'fermata' && '延長 𝄐'}
              {currentNote.articulation === 'accent' && '重音 >'}
              {currentNote.articulation === 'staccato' && '跳音 ·'}
              {currentNote.articulation === 'tenuto' && '保持 —'}
              {currentNote.articulation === 'portamento_up' && '上滑 ↗'}
              {currentNote.articulation === 'portamento_down' && '下滑 ↘'}
            </span>
          )}

          {currentNote.isTriplet && (
            <span className="text-xs bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md font-bold border border-indigo-400/40">
              三連音 3
            </span>
          )}

          {((currentNote.preGraceNotes?.length || 0) + (currentNote.postGraceNotes?.length || 0) > 0) && (
            <span className="text-xs bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-md font-bold border border-rose-400/30">
              裝飾: {formatGraceNotes(currentNote.preGraceNotes)} {currentNote.pitch} {formatGraceNotes(currentNote.postGraceNotes)}
            </span>
          )}

          {isStandaloneAnnotationNote(currentNote) && (
            <span className="text-xs bg-indigo-600 text-white dark:bg-indigo-500 px-2.5 py-1 rounded-md font-bold shadow-xs">
              標記 · 0拍: {currentNote.annotation}
            </span>
          )}

          {isPunctuationZeroNote(currentNote) && (
            <span className="text-xs bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-md font-bold border border-amber-400/40">
              標點/間隔 (0拍) · 僅佔 1 字元
            </span>
          )}

          {currentNote.annotation && !isStandaloneAnnotationNote(currentNote) && (
            <span className="text-xs bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-md font-bold border border-indigo-400/30">
              附屬標記: {currentNote.annotation}
            </span>
          )}
        </div>

        {/* Action Tools & Navigation (Touch Targets >= 40px) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Audition Button */}
          <button
            type="button"
            onClick={() => audioEngine.previewNote(keySignature, currentNote)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
            title="Play note"
          >
            <Volume2 className="w-4 h-4" />
            <span>Play</span>
          </button>

          {/* Quick Play Measure Audition */}
          {onTogglePlayMeasure && (
            <button
              id="hud-play-measure-btn"
              type="button"
              onClick={() => onTogglePlayMeasure(selectedMeasureIndex)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px] ${
                isPlayingMeasure
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse font-black'
                  : 'bg-zinc-200/90 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700'
              }`}
              title={
                isPlayingMeasure
                  ? `Stop playing Measure #${selectedMeasureIndex + 1}`
                  : `Play current Measure #${selectedMeasureIndex + 1} only`
              }
            >
              {isPlayingMeasure ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop M#{selectedMeasureIndex + 1}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current text-amber-500" />
                  <span>Play Measure #{selectedMeasureIndex + 1}</span>
                </>
              )}
            </button>
          )}

          {/* Prev / Next Note Quick Navigation */}
          {onNavigatePrevNote && onNavigateNextNote && (
            <div className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 rounded-xl border border-zinc-300 dark:border-zinc-700 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={onNavigatePrevNote}
                className="p-2 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 cursor-pointer touch-manipulation min-h-[38px] min-w-[38px] flex items-center justify-center"
                title="Select previous note (←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-700" />
              <button
                type="button"
                onClick={onNavigateNextNote}
                className="p-2 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 cursor-pointer touch-manipulation min-h-[38px] min-w-[38px] flex items-center justify-center"
                title="Select next note (→)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Move Note Backward / Forward in score order */}
          {(onMoveNoteBackward || onMoveNoteForward) && (
            <div
              id="hud-move-note-group"
              className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-2xs"
            >
              <button
                id="hud-move-note-backward-btn"
                type="button"
                onClick={onMoveNoteBackward}
                disabled={!canMoveNoteBackward}
                title={canMoveNoteBackward ? 'Move note backward in score (Alt + ←)' : 'Cannot move backward (start of song)'}
                className="p-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] min-w-[36px] flex items-center justify-center"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
              </button>
              <span className="text-[11px] font-bold px-1.5 text-zinc-700 dark:text-zinc-200 select-none whitespace-nowrap">
                Move Note
              </span>
              <button
                id="hud-move-note-forward-btn"
                type="button"
                onClick={onMoveNoteForward}
                disabled={!canMoveNoteForward}
                title={canMoveNoteForward ? 'Move note forward in score (Alt + →)' : 'Cannot move forward (end of song)'}
                className="p-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] min-w-[36px] flex items-center justify-center"
              >
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          )}

          {/* Insert Note Group: Before & After */}
          <div
            id="hud-insert-note-group"
            className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-2xs gap-0.5"
          >
            {onInsertNoteBeforeAt && (
              <button
                id="hud-insert-before-btn"
                type="button"
                onClick={() => onInsertNoteBeforeAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-white dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
                title="Insert new note BEFORE current note (Shift + Insert or Shift + I)"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Insert Before</span>
                <span className="sm:hidden">+ Before</span>
              </button>
            )}

            <button
              id="hud-insert-after-btn"
              type="button"
              onClick={() => onInsertNoteAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title="Insert new note AFTER current note (Insert or I)"
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Insert After</span>
              <span className="sm:hidden">+ After</span>
            </button>
          </div>

          {/* Insert Break (Line break note directly after current note) */}
          {onInsertBreakAt && (
            <button
              id="hud-insert-break-btn"
              type="button"
              onClick={() => onInsertBreakAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title="Insert line break note (↵) directly after current note (splits verse, 0 beats)"
            >
              <CornerDownLeft className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Insert Break</span>
              <span className="sm:hidden">Break</span>
            </button>
          )}

          {/* Delete Note */}
          <button
            type="button"
            onClick={() => onDeleteNoteAt(selectedMeasureIndex, selectedNoteIndex ?? 0)}
            className="p-2 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900/80 text-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Delete current note"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Undo / Redo in Input Deck */}
          {(onUndo || onRedo) && (
            <div
              id="hud-undo-redo-group"
              className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-2xs"
            >
              {onUndo && (
                <button
                  id="hud-undo-btn"
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  title={canUndo ? `Undo [Ctrl+Z] · ${pastCount} step(s)` : 'No steps to undo'}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px]"
                >
                  <Undo2 className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Undo</span>
                  {canUndo && pastCount > 0 && (
                    <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono font-bold">
                      {pastCount}
                    </span>
                  )}
                </button>
              )}

              {onUndo && onRedo && (
                <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />
              )}

              {onRedo && (
                <button
                  id="hud-redo-btn"
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  title={canRedo ? `Redo [Ctrl+Y] · ${futureCount} step(s)` : 'No steps to redo'}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px]"
                >
                  <Redo2 className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Redo</span>
                  {canRedo && futureCount > 0 && (
                    <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full font-mono font-bold">
                      {futureCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Hum-to-Score Audio Recording */}
          {onOpenHumToScore && (
            <button
              id="hud-open-hum-to-score-btn"
              type="button"
              onClick={onOpenHumToScore}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black rounded-xl text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title="哼唱與實體樂器收音記譜 (Hum-to-Score)"
            >
              <Mic2 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">哼唱收音</span>
              <span className="sm:hidden">哼唱</span>
            </button>
          )}

          {/* Keyboard-to-Score Audio Recording */}
          {onOpenKeyboardToScore && (
            <button
              id="hud-open-keyboard-to-score-btn"
              type="button"
              onClick={onOpenKeyboardToScore}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black rounded-xl text-xs shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title="鍵盤彈奏入譜 (Keyboard-to-Score)"
            >
              <Keyboard className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">鍵盤彈奏</span>
              <span className="sm:hidden">鍵盤</span>
            </button>
          )}

          {/* Split Measure before current note */}
          {onSplitMeasureBeforeNote && selectedNoteIndex !== null && selectedNoteIndex > 0 && (
            <button
              type="button"
              onClick={() => onSplitMeasureBeforeNote(selectedMeasureIndex, selectedNoteIndex)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title="Insert barline before this note and split measure"
            >
              <Scissors className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Split Measure</span>
            </button>
          )}

          {/* Push Note to Next Measure */}
          {onPushNoteToNextMeasure && selectedMeasureIndex !== null && (
            <button
              type="button"
              onClick={() => onPushNoteToNextMeasure(selectedMeasureIndex, selectedNoteIndex ?? undefined)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700/80 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title="Push this note into the next measure"
            >
              <ArrowRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Push Note →</span>
            </button>
          )}

          {/* Measure / Verse Actions: Move Backward / Forward */}
          {(onMoveContainerBackward || onMoveContainerForward) && (
            <div
              id="hud-move-container-group"
              className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-2xs"
            >
              <button
                id="hud-move-backward-btn"
                type="button"
                onClick={onMoveContainerBackward}
                disabled={!canMoveContainerBackward}
                title={canMoveContainerBackward ? `Move ${containerLabel || (containerType === 'verse' ? 'verse' : 'measure')} backward (earlier in song)` : 'Cannot move backward (already at first position)'}
                className="p-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] min-w-[36px] flex items-center justify-center"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
              </button>
              <span className="text-[11px] font-bold px-1.5 text-zinc-700 dark:text-zinc-200 select-none whitespace-nowrap">
                Move {containerType === 'verse' ? 'Verse' : 'Measure'}
              </span>
              <button
                id="hud-move-forward-btn"
                type="button"
                onClick={onMoveContainerForward}
                disabled={!canMoveContainerForward}
                title={canMoveContainerForward ? `Move ${containerLabel || (containerType === 'verse' ? 'verse' : 'measure')} forward (later in song)` : 'Already at last position'}
                className="p-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[38px] min-w-[36px] flex items-center justify-center"
              >
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          )}

          {/* Measure / Verse Actions: Duplicate */}
          {onDuplicateContainer && (
            <button
              id="hud-duplicate-container-btn"
              type="button"
              onClick={onDuplicateContainer}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold border border-zinc-300 dark:border-zinc-700 transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title={`Duplicate current ${containerType === 'verse' ? 'verse' : 'measure'}`}
            >
              <Copy className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Duplicate {containerType === 'verse' ? 'Verse' : 'Measure'}</span>
              <span className="sm:hidden">Dup {containerType === 'verse' ? 'Verse' : 'Bar'}</span>
            </button>
          )}

          {/* Delete Measure Action */}
          {onDeleteMeasure && (
            <button
              id="hud-delete-measure-btn"
              type="button"
              onClick={onDeleteMeasure}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900/60 transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              title={`Delete current measure (#${selectedMeasureIndex + 1})`}
            >
              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="hidden sm:inline">Delete Measure</span>
              <span className="sm:hidden">Del Bar</span>
            </button>
          )}

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-bold rounded-xl border border-amber-300 dark:border-amber-700 transition-all cursor-pointer min-h-[36px]"
            title={isCollapsed ? 'Expand Deck' : 'Collapse Deck'}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Expand</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Deck View */}
      {!isCollapsed && (
        <div className="p-3.5 flex flex-col gap-3">
          {/* Deck Mode Tabs & Auto-Step Switch */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
            {/* 3 Modular Tabs */}
            <div className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] p-1 rounded-xl border border-zinc-200/90 dark:border-zinc-800 text-xs font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('numpad')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  activeTab === 'numpad'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Quick Bar</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('piano')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  activeTab === 'piano'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Music className="w-4 h-4" />
                <span>Piano Roll</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ornaments')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  activeTab === 'ornaments'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>裝飾音 (Grace)</span>
                {((currentNote.preGraceNotes?.length || 0) + (currentNote.postGraceNotes?.length || 0) > 0) && (
                  <span className="ml-0.5 px-1.5 py-0.2 bg-purple-600 text-white rounded-full text-[10px] font-black">
                    {(currentNote.preGraceNotes?.length || 0) + (currentNote.postGraceNotes?.length || 0)}
                  </span>
                )}
              </button>

              <button
                id="hud-tab-chords-btn"
                type="button"
                onClick={() => setActiveTab('chords')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  activeTab === 'chords'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>和弦 (Chords)</span>
                {currentMeasure && getMeasureChords(currentMeasure).length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 bg-amber-600 text-white rounded-full text-[10px] font-black">
                    {getMeasureChords(currentMeasure).length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('lyrics')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  activeTab === 'lyrics'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <MessageSquareQuote className="w-4 h-4" />
                <span>歌詞 (羅馬字 / 漢羅) 與標點</span>
              </button>
            </div>

            {/* Auto-Step Next Note Mode Toggle */}
            {onToggleAutoStepAdvance && (
              <button
                type="button"
                onClick={onToggleAutoStepAdvance}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                  autoStepAdvance
                    ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-xs'
                    : 'bg-zinc-100 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 border-zinc-200/90 dark:border-zinc-800'
                }`}
                title="Auto-advance mode: automatically move to next note after selecting pitch"
              >
                <Zap className={`w-4 h-4 ${autoStepAdvance ? 'fill-current' : ''}`} />
                <span>Auto Step Advance: {autoStepAdvance ? 'ON' : 'OFF'}</span>
              </button>
            )}
          </div>

          {/* TAB 1: QUICK BAR */}
          {activeTab === 'numpad' && (
            <div className="flex flex-col gap-3.5">
              {/* Row 1: Pitches (1-7, 0, ␣) + Octaves + Accidentals */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Pitches (1-7, 0, ␣) as Tactile Audio Pads */}
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
                  <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 w-12 flex flex-col items-start leading-tight">
                    <span>Pitch:</span>
                    <span className="text-[10px] font-medium text-zinc-400">音高</span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap flex-1">
                    {[1, 2, 3, 4, 5, 6, 7].map(p => {
                      const isCurrent = currentNote.pitch === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onSetPitch(p as PitchNumber)}
                          className={`flex-1 min-w-[42px] sm:min-w-[48px] h-12 rounded-xl transition-all active:scale-95 cursor-pointer touch-manipulation flex flex-col items-center justify-center leading-none ${
                            isCurrent
                              ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md scale-105 font-black z-10'
                              : 'bg-zinc-100 dark:bg-[#0a0c10] hover:bg-amber-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs'
                          }`}
                          title={`${p} (${PITCH_SOLFEGE[p]})`}
                        >
                          <span className="font-mono text-lg sm:text-xl font-black">{p}</span>
                          <span className="text-[10px] font-sans font-semibold opacity-70 tracking-tight mt-0.5">{PITCH_SOLFEGE[p]}</span>
                        </button>
                      );
                    })}

                    {/* Rest 0 */}
                    <button
                      type="button"
                      onClick={() => onSetPitch(0)}
                      className={`min-w-[50px] sm:min-w-[56px] h-12 rounded-xl transition-all active:scale-95 cursor-pointer touch-manipulation flex flex-col items-center justify-center leading-none px-2.5 ${
                        currentNote.pitch === 0
                          ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md font-black z-10'
                          : 'bg-zinc-100 dark:bg-[#0a0c10] hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs'
                      }`}
                      title="Rest (0) · 休止符"
                    >
                      <span className="font-mono text-lg font-black">0</span>
                      <span className="text-[10px] font-sans font-semibold opacity-70 mt-0.5">休止</span>
                    </button>

                    {/* Empty ␣ */}
                    <button
                      type="button"
                      onClick={() => onSetPitch('empty')}
                      className={`min-w-[50px] sm:min-w-[56px] h-12 rounded-xl transition-all active:scale-95 cursor-pointer touch-manipulation flex flex-col items-center justify-center leading-none px-2.5 border-dashed ${
                        currentNote.pitch === 'empty'
                          ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-md font-black border-amber-400 z-10'
                          : 'bg-zinc-100/80 dark:bg-[#0a0c10]/80 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 shadow-2xs'
                      }`}
                      title="Empty / Spacer · 空格間隔"
                    >
                      <span className="font-mono text-base font-black">␣</span>
                      <span className="text-[10px] font-sans font-semibold opacity-70 mt-0.5">空白</span>
                    </button>
                  </div>
                </div>

                {/* Octave & Accidental Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Octave */}
                  <div className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] p-1 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs text-xs">
                    <button
                      type="button"
                      onClick={() => onSetOctave(-1)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] flex flex-col items-center justify-center leading-tight ${
                        currentNote.octave === -1
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                      title="Low (dot below 5̣) · 低音 (-1 八度)"
                    >
                      <span className="font-mono text-xs font-black">5̣ 低音</span>
                      <span className="text-[9px] opacity-70">Oct -1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSelectedNote(n => ({ ...n, octave: 0 }))}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] flex flex-col items-center justify-center leading-tight ${
                        currentNote.octave === 0
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                      title="Mid (natural 5) · 中音 (基準八度)"
                    >
                      <span className="font-mono text-xs font-black">5 中音</span>
                      <span className="text-[9px] opacity-70">Normal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetOctave(1)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] flex flex-col items-center justify-center leading-tight ${
                        currentNote.octave === 1
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                      title="High (dot above 5̇) · 高音 (+1 八度)"
                    >
                      <span className="font-mono text-xs font-black">5̇ 高音</span>
                      <span className="text-[9px] opacity-70">Oct +1</span>
                    </button>
                  </div>

                  {/* Accidentals */}
                  <div className="flex items-center bg-zinc-100 dark:bg-[#0a0c10] p-1 rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs text-xs">
                    <button
                      type="button"
                      onClick={() => onSetAccidental('')}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] flex flex-col items-center justify-center leading-tight ${
                        !currentNote.accidental
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                      title="Natural ♮ / 本音還原"
                    >
                      <span className="font-mono text-xs font-black">♮ 本音</span>
                      <span className="text-[9px] opacity-70">Natural</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetAccidental('#')}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] flex flex-col items-center justify-center leading-tight ${
                        currentNote.accidental === '#'
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                      title="Sharp ♯ / 升半音"
                    >
                      <span className="font-mono text-xs font-black">♯ 升半音</span>
                      <span className="text-[9px] opacity-70">Sharp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetAccidental('b')}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] flex flex-col items-center justify-center leading-tight ${
                        currentNote.accidental === 'b'
                          ? 'bg-amber-500 text-zinc-950 shadow-xs font-black'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                      title="Flat ♭ / 降半音"
                    >
                      <span className="font-mono text-xs font-black">♭ 降半音</span>
                      <span className="text-[9px] opacity-70">Flat</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Duration & Phrasing Controls */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200/80 dark:border-zinc-800/80">
                <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 w-12">
                  Duration:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {/* Rhythm Duration Presets with Musical Glyphs & Jianpu Sublabels */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DURATION_PRESETS.map(d => {
                      const isSelected = currentNote.duration === d.dur;
                      return (
                        <button
                          key={d.dur}
                          type="button"
                          onClick={() => onSetDuration(d.dur)}
                          className={`group relative flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[42px] select-none ${
                            isSelected
                              ? 'bg-amber-500 text-zinc-950 font-black shadow-md ring-2 ring-amber-400 scale-[1.04] z-10'
                              : 'bg-zinc-100/90 dark:bg-[#0a0c10] hover:bg-amber-100/70 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs'
                          }`}
                          title={d.desc}
                        >
                          <div className="flex items-center gap-1 leading-none">
                            <NoteGlyph type={d.glyphType} className="w-3.5 h-3.5" />
                            <span className="font-mono text-xs font-black tracking-tight whitespace-nowrap">
                              {d.beatLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] leading-tight opacity-75 font-sans font-medium mt-0.5">
                            <span>{d.subLabel}</span>
                            <span className="hidden sm:inline font-mono opacity-60">· {d.jianpuSymbol}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Visual Divider between durations and phrasing tools */}
                  <div className="hidden md:block w-[1px] h-9 bg-zinc-300 dark:bg-zinc-700 mx-1 shrink-0 self-center" />

                  {/* Phrasing & Modifier Toggles Cluster */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Toggle Dotted */}
                    <button
                      type="button"
                      onClick={onToggleDotted}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[42px] ${
                        currentNote.isDotted
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 ring-2 ring-amber-400 font-black shadow-md'
                          : 'border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100/90 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-amber-50 dark:hover:bg-zinc-800'
                      }`}
                      title="Dotted (附點 ·): 延長原音符時值的一半 (×1.5)"
                    >
                      <span className="font-mono text-base font-black leading-none text-amber-600 dark:text-amber-400">·</span>
                      <span className="whitespace-nowrap">附點 (Dot)</span>
                    </button>

                    {/* Toggle Double Dotted */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onToggleDoubleDotted) {
                          onToggleDoubleDotted();
                        } else {
                          onUpdateSelectedNote(n => {
                            const nextDouble = !n.isDoubleDotted;
                            let nextDur = n.duration;
                            if (nextDouble) {
                              if (n.duration === 1) nextDur = 1.75;
                              else if (n.duration === 2) nextDur = 3.5;
                            } else {
                              if (n.duration === 1.75) nextDur = 1;
                              else if (n.duration === 3.5) nextDur = 2;
                            }
                            return { ...n, isDoubleDotted: nextDouble, duration: nextDur };
                          });
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[42px] ${
                        currentNote.isDoubleDotted || currentNote.duration === 1.75 || currentNote.duration === 3.5
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 ring-2 ring-amber-400 font-black shadow-md'
                          : 'border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100/90 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-amber-50 dark:hover:bg-zinc-800'
                      }`}
                      title="Double Dotted (雙附點 ··): 延長原音符時值的四分之三 (×1.75)"
                    >
                      <span className="font-mono text-base font-black leading-none text-amber-600 dark:text-amber-400">··</span>
                      <span className="whitespace-nowrap">雙附點</span>
                    </button>

                    {/* Toggle Triplet */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onToggleTriplet) {
                          onToggleTriplet();
                        } else {
                          onUpdateSelectedNote(n => {
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
                            return { ...n, isTriplet: nextTrip, duration: nextDur };
                          });
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[42px] ${
                        currentNote.isTriplet || currentNote.duration === 0.333 || currentNote.duration === 0.667
                          ? 'bg-indigo-600 text-white border-indigo-500 ring-2 ring-indigo-400 font-black shadow-md'
                          : 'border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100/90 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-indigo-50 dark:hover:bg-zinc-800'
                      }`}
                      title="Triplet (三連音 ┌3┐): 三等分拍值"
                    >
                      <span className="font-mono font-black text-indigo-500 dark:text-indigo-400">┌3┐</span>
                      <span className="whitespace-nowrap">三連音</span>
                    </button>

                    {/* Toggle Tie */}
                    <button
                      type="button"
                      onClick={onToggleTie}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[42px] ${
                        currentNote.tieToNext || (currentNote.isTied && !currentNote.slurToNext)
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 ring-2 ring-amber-400 font-black shadow-md'
                          : 'border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100/90 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-amber-50 dark:hover:bg-zinc-800'
                      }`}
                      title="Tie (連結音 ⌒): 連接同音高，演奏時融合為一持續長音"
                    >
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">⌒</span>
                      <span className="whitespace-nowrap">Tie (連結)</span>
                    </button>

                    {/* Toggle Slur */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onToggleSlur) {
                          onToggleSlur();
                        } else {
                          onUpdateSelectedNote(n => ({
                            ...n,
                            slurToNext: !n.slurToNext,
                          }));
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[42px] ${
                        currentNote.slurToNext
                          ? 'bg-purple-600 text-white border-purple-500 ring-2 ring-purple-400 font-black shadow-md'
                          : 'border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-100/90 dark:bg-[#0a0c10] text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-purple-50 dark:hover:bg-zinc-800'
                      }`}
                      title="Slur (圓滑音 ⌢): 跨越不同音高圓滑唱奏，亦適用一字多音 (Melisma)"
                    >
                      <span className="text-sm font-bold text-purple-600 dark:text-purple-400">⌢</span>
                      <span className="whitespace-nowrap">Slur (圓滑)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2.5: Whole Measure Quick Duration Batch Strip */}
              {(onScaleMeasureDuration || onSetUniformMeasureDuration) && (
                <div
                  id="hud-measure-duration-quick-strip"
                  className="flex flex-wrap items-center gap-2 pt-1.5 pb-1 px-2.5 bg-amber-500/10 dark:bg-amber-950/25 border border-amber-300/80 dark:border-amber-800/60 rounded-xl"
                >
                  <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <span>M.{selectedMeasureIndex + 1} Batch:</span>
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Proportional Scaling: Halve & Double */}
                    {onScaleMeasureDuration && (
                      <div className="flex items-center bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-amber-300/80 dark:border-zinc-700 shadow-2xs gap-0.5">
                        <button
                          type="button"
                          onClick={() => onScaleMeasureDuration(0.5, selectedMeasureIndex)}
                          className="flex items-center gap-1 px-2.5 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-700 rounded-md text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[30px]"
                          title={`Proportionally halve (÷2) all note durations in Measure #${selectedMeasureIndex + 1} (e.g. 1 → 0.5, 0.5 → 0.25)`}
                        >
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400">÷2</span>
                          <span>Halve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onScaleMeasureDuration(2.0, selectedMeasureIndex)}
                          className="flex items-center gap-1 px-2.5 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-700 rounded-md text-xs font-bold transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[30px]"
                          title={`Proportionally double (×2) all note durations in Measure #${selectedMeasureIndex + 1} (e.g. 0.5 → 1, 1 → 2)`}
                        >
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400">×2</span>
                          <span>Double</span>
                        </button>
                      </div>
                    )}

                    {/* Direct Uniform Duration Presets: All to: ♪ 0.5 | ♩ 1.0 | 𝅗𝅥 2.0 */}
                    {onSetUniformMeasureDuration && (
                      <div className="flex items-center bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-amber-300/80 dark:border-zinc-700 shadow-2xs gap-0.5">
                        <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 px-1.5">All to:</span>
                        <button
                          type="button"
                          onClick={() => onSetUniformMeasureDuration(0.5, selectedMeasureIndex)}
                          className="px-2 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-700 rounded-md text-xs font-bold transition-all cursor-pointer min-h-[30px]"
                          title={`Set all notes in Measure #${selectedMeasureIndex + 1} to 8th note (0.5 beats)`}
                        >
                          ♪ 0.5
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetUniformMeasureDuration(1.0, selectedMeasureIndex)}
                          className="px-2 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-700 rounded-md text-xs font-bold transition-all cursor-pointer min-h-[30px]"
                          title={`Set all notes in Measure #${selectedMeasureIndex + 1} to Quarter note (1.0 beat)`}
                        >
                          ♩ 1.0
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetUniformMeasureDuration(2.0, selectedMeasureIndex)}
                          className="px-2 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-700 rounded-md text-xs font-bold transition-all cursor-pointer min-h-[30px]"
                          title={`Set all notes in Measure #${selectedMeasureIndex + 1} to Half note (2.0 beats)`}
                        >
                          𝅗𝅥 2.0
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Row 3: Articulations Palette */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
                <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 w-12">
                  Artic:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {[
                    { label: '自然 (None)', art: 'none' as const },
                    { label: '延長 𝄐 (Fermata)', art: 'fermata' as const },
                    { label: '重音 > (Accent)', art: 'accent' as const },
                    { label: '跳音 · (Staccato)', art: 'staccato' as const },
                    { label: '保持 — (Tenuto)', art: 'tenuto' as const },
                    { label: '上滑 ↗ (Port. Up)', art: 'portamento_up' as const },
                    { label: '下滑 ↘ (Port. Down)', art: 'portamento_down' as const },
                  ].map(a => {
                    const isSelected = (currentNote.articulation || 'none') === a.art;
                    return (
                      <button
                        key={a.art}
                        type="button"
                        onClick={() => {
                          if (onSetArticulation) {
                            onSetArticulation(a.art);
                          } else {
                            onUpdateSelectedNote(n => ({ ...n, articulation: a.art }));
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[38px] ${
                          isSelected
                            ? 'bg-amber-500 text-zinc-950 font-black shadow-xs ring-2 ring-amber-400'
                            : 'bg-zinc-100 dark:bg-[#0a0c10] hover:bg-amber-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs'
                        }`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PIANO ROLL */}
          {activeTab === 'piano' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-amber-500" />
                  <span>Interactive Piano Roll</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsPianoCollapsed(prev => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
                  title={isPianoCollapsed ? 'Expand Piano Keys' : 'Collapse Piano Keys'}
                >
                  {isPianoCollapsed ? (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                      <span>Expand Piano</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 text-amber-500" />
                      <span>Collapse Piano</span>
                    </>
                  )}
                </button>
              </div>

              {!isPianoCollapsed ? (
                <PianoKeyboard
                  keySignature={keySignature}
                  currentNote={currentNote}
                  onSelectPitch={(pitch, octave, accidental) => {
                    onUpdateSelectedNote(n => ({
                      ...n,
                      pitch,
                      octave,
                      accidental: accidental || '',
                    }));
                  }}
                  audioEngine={audioEngine}
                />
              ) : (
                <div
                  onClick={() => setIsPianoCollapsed(false)}
                  className="p-3 rounded-xl border border-dashed border-amber-300/80 dark:border-zinc-700 bg-amber-50/50 dark:bg-zinc-800/40 text-center cursor-pointer hover:bg-amber-100/60 dark:hover:bg-zinc-800/70 transition-colors"
                >
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-1.5 font-medium">
                    <Music className="w-3.5 h-3.5 text-amber-500" />
                    <span>Piano keyboard is collapsed (click here or top-right button to expand)</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ORNAMENTS / GRACE NOTES */}
          {activeTab === 'ornaments' && (() => {
            const baseP = typeof currentNote.pitch === 'number' && currentNote.pitch > 0 ? currentNote.pitch : 5;
            const wrapPitch = (p: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 => {
              let norm = ((p - 1) % 7) + 1;
              if (norm <= 0) norm += 7;
              return norm as 1 | 2 | 3 | 4 | 5 | 6 | 7;
            };

            const preList = currentNote.preGraceNotes || [];
            const postList = currentNote.postGraceNotes || [];

            const isPresetActive = (type: string): boolean => {
              switch (type) {
                case 'upper_single':
                  return preList.length === 1 && preList[0].pitch === wrapPitch(baseP + 1) && postList.length === 0;
                case 'lower_single':
                  return preList.length === 1 && preList[0].pitch === wrapPitch(baseP - 1) && postList.length === 0;
                case 'double_slide':
                  return preList.length === 2 && preList[0].pitch === wrapPitch(baseP - 2) && preList[1].pitch === wrapPitch(baseP - 1) && postList.length === 0;
                case 'triple_turn':
                  return preList.length === 3 && preList[0].pitch === wrapPitch(baseP + 1) && preList[1].pitch === wrapPitch(baseP) && preList[2].pitch === wrapPitch(baseP - 1) && postList.length === 0;
                case 'post_drop':
                  return postList.length === 1 && postList[0].pitch === wrapPitch(baseP - 1) && preList.length === 0;
                case 'post_lift':
                  return postList.length === 1 && postList[0].pitch === wrapPitch(baseP + 1) && preList.length === 0;
                case 'clear':
                  return preList.length === 0 && postList.length === 0;
                default:
                  return false;
              }
            };

            const instrumentHints: Record<InstrumentType, { timbre: string; icon: React.ComponentType<{ className?: string }> }> = {
              whistle: { timbre: '清亮', icon: Wind },
              flute: { timbre: '悠揚', icon: Music },
              piano: { timbre: '原聲', icon: Volume2 },
              guitar: { timbre: '撥弦', icon: Sliders },
              synth: { timbre: '電音', icon: Zap },
              bell: { timbre: '清脆', icon: Bell },
              cello: { timbre: '醇厚', icon: Music2 },
            };

            const ornamentPresets: {
              type: 'upper_single' | 'lower_single' | 'double_slide' | 'triple_turn' | 'post_drop' | 'post_lift' | 'clear';
              label: string;
              desc: string;
              contour: string;
              notation: string;
            }[] = [
              {
                type: 'upper_single',
                label: '單音上倚音',
                desc: `Pre-grace +1 (${wrapPitch(baseP + 1)}) · 高一音前置`,
                contour: '↗',
                notation: `⁽${wrapPitch(baseP + 1)}⁾${baseP}`,
              },
              {
                type: 'lower_single',
                label: '單音下倚音',
                desc: `Pre-grace -1 (${wrapPitch(baseP - 1)}) · 低一音前置`,
                contour: '↘',
                notation: `⁽${wrapPitch(baseP - 1)}⁾${baseP}`,
              },
              {
                type: 'double_slide',
                label: '雙音滑轉',
                desc: `Pre-grace double (${wrapPitch(baseP - 2)} ${wrapPitch(baseP - 1)}) · 雙音滑音`,
                contour: '↝',
                notation: `⁽${wrapPitch(baseP - 2)}${wrapPitch(baseP - 1)}⁾${baseP}`,
              },
              {
                type: 'triple_turn',
                label: '三音迴音',
                desc: `Pre-grace triple turn (${wrapPitch(baseP + 1)} ${baseP} ${wrapPitch(baseP - 1)}) · 迴旋轉音`,
                contour: '∿',
                notation: `⁽${wrapPitch(baseP + 1)}${baseP}${wrapPitch(baseP - 1)}⁾${baseP}`,
              },
              {
                type: 'post_drop',
                label: '尾音下拋',
                desc: `Post-grace drop (${wrapPitch(baseP - 1)}) · 結尾下拋滑音`,
                contour: '↘',
                notation: `${baseP}⁽${wrapPitch(baseP - 1)}⁾`,
              },
              {
                type: 'post_lift',
                label: '尾音上提',
                desc: `Post-grace lift (${wrapPitch(baseP + 1)}) · 結尾向上提音`,
                contour: '↗',
                notation: `${baseP}⁽${wrapPitch(baseP + 1)}⁾`,
              },
              {
                type: 'clear',
                label: '清除裝飾音',
                desc: 'Clear all ornaments · 清除前後裝飾音',
                contour: '✕',
                notation: '✕',
              },
            ];

            return (
            <div className="flex flex-col gap-4">
              {/* Header & Quick Audition Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-zinc-50 dark:bg-[#0c0e14] rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    裝飾音編輯 (前裝飾音與後裝飾音，支援 1 至 3 個小音符)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => audioEngine.previewNote(keySignature, currentNote)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-95 transition-all shadow-xs cursor-pointer"
                  title="試聽本音與裝飾音 (Preview note with ornaments)"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>試聽效果</span>
                </button>
              </div>

              {/* Note Sound Source Override Section */}
              <div className="flex flex-col gap-2 p-3 bg-zinc-100/70 dark:bg-[#0c0e14]/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Disc className="w-4 h-4 text-amber-500" />
                    <span>音色音源覆蓋 (Note Sound Source Override)</span>
                  </span>
                  {currentNote.instrument && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSelectedNote(prev => ({ ...prev, instrument: undefined }));
                      }}
                      className="text-[11px] text-zinc-500 hover:text-rose-500 underline cursor-pointer"
                    >
                      重設為預設 (Reset)
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSelectedNote(prev => ({ ...prev, instrument: undefined }));
                      audioEngine.previewNote(keySignature, { ...currentNote, instrument: undefined });
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] ${
                      !currentNote.instrument
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-xs ring-2 ring-amber-400 font-black'
                        : 'bg-white dark:bg-[#141720] border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-amber-400'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-900 dark:text-zinc-950 shrink-0" />
                    <span>預設 (Default)</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${
                        !currentNote.instrument
                          ? 'bg-zinc-950/20 text-zinc-950 font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      全局
                    </span>
                    {!currentNote.instrument && <Check className="w-3 h-3 text-zinc-950 stroke-[3]" />}
                  </button>
                  {INSTRUMENT_OPTIONS.map(opt => {
                    const isSelected = currentNote.instrument === opt.value;
                    const meta = instrumentHints[opt.value];
                    const IconComp = meta?.icon || Music;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onUpdateSelectedNote(prev => ({ ...prev, instrument: opt.value }));
                          audioEngine.previewNote(keySignature, { ...currentNote, instrument: opt.value });
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] ${
                          isSelected
                            ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-xs ring-2 ring-amber-400 font-black'
                            : 'bg-white dark:bg-[#141720] border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-amber-400'
                        }`}
                        title={`${opt.labelEn} · ${meta?.timbre || ''}`}
                      >
                        <IconComp className="w-3.5 h-3.5 shrink-0" />
                        <span>{opt.labelZh}</span>
                        {meta?.timbre && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              isSelected
                                ? 'bg-zinc-950/20 text-zinc-950 font-bold'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {meta.timbre}
                          </span>
                        )}
                        {isSelected && <Check className="w-3 h-3 text-zinc-950 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 經典唱腔裝飾音範本 (One-Tap Presets) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  經典台語 / 流行唱腔範本 (One-Tap Presets):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ornamentPresets.map(p => {
                    const isActive = isPresetActive(p.type);
                    return (
                      <button
                        key={p.type}
                        type="button"
                        onClick={() => handleApplyOrnamentPreset(p.type)}
                        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[36px] ${
                          p.type === 'clear'
                            ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                            : isActive
                            ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-xs ring-2 ring-amber-400 font-black'
                            : 'bg-white dark:bg-[#141720] hover:bg-amber-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/80 shadow-2xs hover:border-amber-400'
                        }`}
                        title={p.desc}
                      >
                        <span
                          className={`font-mono text-[11px] font-black px-1.5 py-0.5 rounded transition-colors ${
                            p.type === 'clear'
                              ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                              : isActive
                              ? 'bg-zinc-950/20 text-zinc-950 font-black'
                              : 'bg-amber-500/15 text-amber-900 dark:text-amber-300 group-hover:bg-amber-500/25'
                          }`}
                        >
                          {p.notation}
                        </span>
                        <span className="whitespace-nowrap">{p.label}</span>
                        {p.contour && (
                          <span
                            className={`text-[11px] font-bold ${
                              isActive
                                ? 'text-zinc-900 font-black'
                                : 'text-zinc-400 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                            }`}
                          >
                            {p.contour}
                          </span>
                        )}
                        {isActive && p.type !== 'clear' && (
                          <Check className="w-3 h-3 text-zinc-950 stroke-[3] ml-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 前裝飾音 (Pre-Grace Notes, 1 to 3 notes) */}
              <div className="flex flex-col gap-2 p-3 bg-zinc-100/70 dark:bg-[#0c0e14]/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                        前裝飾音 (前倚音 / Pre-Grace Notes)
                      </span>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-mono text-[11px] font-bold border border-amber-400/30">
                      <span className="text-[10px] text-zinc-500 font-sans">簡譜標示:</span>
                      <span className="font-black text-amber-600 dark:text-amber-400">⁽ⁿ⁾[主音]</span>
                    </span>
                    {preList.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono font-black border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        已設: ⁽{formatGraceNotes(currentNote.preGraceNotes)}⁾{currentNote.pitch}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium hidden md:inline">
                        主音前裝飾
                      </span>
                    )}
                    <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {preList.length} / 3 音
                    </span>
                  </div>
                  {preList.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddPreGrace}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-95 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>新增音符</span>
                    </button>
                  )}
                </div>

                {(!currentNote.preGraceNotes || currentNote.preGraceNotes.length === 0) ? (
                  <p className="text-xs text-zinc-500 italic py-1">尚未設定前裝飾音（點擊上方「新增音符」或點選唱腔範本）</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {currentNote.preGraceNotes.map((g, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white dark:bg-[#141720] rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded-md font-mono font-black text-xs">
                            #{idx + 1}
                          </span>

                          {/* Pitch Picker (1-7) */}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5, 6, 7].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleUpdatePreGrace(idx, old => ({ ...old, pitch: p as 1 | 2 | 3 | 4 | 5 | 6 | 7 }))}
                                className={`w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                                  g.pitch === p
                                    ? 'bg-amber-500 text-zinc-950 font-black ring-2 ring-amber-400'
                                    : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>

                          {/* Octave buttons */}
                          <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                            {[-1, 0, 1].map(oct => (
                              <button
                                key={oct}
                                type="button"
                                onClick={() => handleUpdatePreGrace(idx, old => ({ ...old, octave: oct }))}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                  (g.octave || 0) === oct
                                    ? 'bg-amber-500 text-zinc-950 font-black'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {oct === -1 ? '低̣' : oct === 1 ? '高̇' : '中'}
                              </button>
                            ))}
                          </div>

                          {/* Accidental buttons */}
                          <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                            {(['', '#', 'b'] as const).map(acc => (
                              <button
                                key={acc || 'nat'}
                                type="button"
                                onClick={() => handleUpdatePreGrace(idx, old => ({ ...old, accidental: acc }))}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                  (g.accidental || '') === acc
                                    ? 'bg-amber-500 text-zinc-950 font-black'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {acc === '#' ? '♯' : acc === 'b' ? '♭' : '♮'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemovePreGrace(idx)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="刪除此外飾音"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 後裝飾音 (Post-Grace Notes, 1 to 3 notes) */}
              <div className="flex flex-col gap-2 p-3 bg-zinc-100/70 dark:bg-[#0c0e14]/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1.5">
                      <CornerDownLeft className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>後裝飾音 (尾裝飾音 / Post-Grace Notes)</span>
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-mono text-[11px] font-bold border border-amber-400/30 font-normal">
                        <span className="text-[10px] text-zinc-500 font-sans">簡譜標示:</span>
                        <span className="font-black text-amber-600 dark:text-amber-400">[主音]⁽ⁿ⁾</span>
                      </span>
                    </span>
                    {postList.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono font-black border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        已設: {currentNote.pitch}⁽{formatGraceNotes(currentNote.postGraceNotes)}⁾
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium hidden md:inline">
                        主音後滑落
                      </span>
                    )}
                    <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {postList.length} / 3 音
                    </span>
                  </div>
                  {postList.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddPostGrace}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-95 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>新增音符</span>
                    </button>
                  )}
                </div>

                {(!currentNote.postGraceNotes || currentNote.postGraceNotes.length === 0) ? (
                  <p className="text-xs text-zinc-500 italic py-1">尚未設定後裝飾音（點擊上方「新增音符」或點選唱腔範本）</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {currentNote.postGraceNotes.map((g, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white dark:bg-[#141720] rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-800 dark:text-purple-300 rounded-md font-mono font-black text-xs">
                            #{idx + 1}
                          </span>

                          {/* Pitch Picker (1-7) */}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5, 6, 7].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleUpdatePostGrace(idx, old => ({ ...old, pitch: p as 1 | 2 | 3 | 4 | 5 | 6 | 7 }))}
                                className={`w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                                  g.pitch === p
                                    ? 'bg-amber-500 text-zinc-950 font-black ring-2 ring-amber-400'
                                    : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>

                          {/* Octave buttons */}
                          <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                            {[-1, 0, 1].map(oct => (
                              <button
                                key={oct}
                                type="button"
                                onClick={() => handleUpdatePostGrace(idx, old => ({ ...old, octave: oct }))}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                  (g.octave || 0) === oct
                                    ? 'bg-amber-500 text-zinc-950 font-black'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {oct === -1 ? '低̣' : oct === 1 ? '高̇' : '中'}
                              </button>
                            ))}
                          </div>

                          {/* Accidental buttons */}
                          <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                            {(['', '#', 'b'] as const).map(acc => (
                              <button
                                key={acc || 'nat'}
                                type="button"
                                onClick={() => handleUpdatePostGrace(idx, old => ({ ...old, accidental: acc }))}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                  (g.accidental || '') === acc
                                    ? 'bg-amber-500 text-zinc-950 font-black'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {acc === '#' ? '♯' : acc === 'b' ? '♭' : '♮'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemovePostGrace(idx)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="刪除此外飾音"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* TAB: CHORDS & HARMONY */}
          {activeTab === 'chords' && (
            <div className="flex flex-col gap-3.5">
              {/* Row 1: Measure Chord Status & Interactive Chips */}
              <div className="p-3 bg-zinc-50 dark:bg-[#0c0e14] rounded-xl border border-zinc-200/90 dark:border-zinc-800 flex flex-col gap-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-amber-500" />
                      <span>小節和弦配置 (Measure #{selectedMeasureIndex + 1})</span>
                    </span>
                    {currentMeasure?.section && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold">
                        {currentMeasure.section}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                      {timeSignature || '4/4'}
                    </span>
                  </div>

                  {/* Right action: Auto-Harmonize Measure Button */}
                  <button
                    id="hud-auto-harmonize-measure-btn"
                    type="button"
                    onClick={handleAutoHarmonizeCurrentMeasure}
                    disabled={!currentMeasure || !onUpdateMeasureChord}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-xs shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    title="根據本小節旋律音高智慧分析並配上最佳和弦"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>🪄 智慧配和弦</span>
                  </button>
                </div>

                {/* Interactive Chord Chips List with Beat Allocation */}
                {(() => {
                  const chords = currentMeasure ? getMeasureChords(currentMeasure) : [];
                  const [numStr] = (currentMeasure?.timeSignature || timeSignature || '4/4').split('/');
                  const beats = parseInt(numStr, 10) || 4;

                  if (chords.length === 0) {
                    return (
                      <div className="py-2.5 px-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-center text-xs text-zinc-400">
                        此小節目前無和弦 · 可使用下方和弦墊加入，或點擊「🪄 智慧配和弦」
                      </div>
                    );
                  }

                  const beatsPerChord = beats / chords.length;

                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {chords.map((ch, idx) => {
                          const startBeat = Math.round(idx * beatsPerChord * 10) / 10 + 1;
                          const endBeat = Math.round((idx + 1) * beatsPerChord * 10) / 10;
                          const beatLabel = chords.length === 1 ? '全小節' : `第 ${startBeat}–${endBeat} 拍`;

                          return (
                            <div
                              key={`${ch}-${idx}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-700/80 shadow-2xs group"
                            >
                              <button
                                type="button"
                                onClick={() => audioEngine.previewChord(ch)}
                                className="font-mono font-black text-sm text-amber-900 dark:text-amber-200 hover:text-amber-600 transition-colors cursor-pointer flex items-center gap-1"
                                title="點擊試聽和弦聲音 (Preview Chord)"
                              >
                                <Volume2 className="w-3 h-3 text-amber-500" />
                                <span>{ch}</span>
                              </button>

                              <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-mono bg-amber-200/50 dark:bg-amber-900/40 px-1.5 py-0.2 rounded-md">
                                {beatLabel}
                              </span>

                              {/* Reorder Left */}
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleReorderChord(idx, idx - 1)}
                                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs px-0.5 cursor-pointer font-bold"
                                  title="往前移動 (Move earlier)"
                                >
                                  ←
                                </button>
                              )}

                              {/* Reorder Right */}
                              {idx < chords.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleReorderChord(idx, idx + 1)}
                                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs px-0.5 cursor-pointer font-bold"
                                  title="往後移動 (Move later)"
                                >
                                  →
                                </button>
                              )}

                              {/* Delete Chord */}
                              <button
                                type="button"
                                onClick={() => handleRemoveChord(idx)}
                                className="text-zinc-400 hover:text-rose-500 ml-0.5 text-xs font-bold cursor-pointer"
                                title="刪除此和弦"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={handleClearAllChords}
                          className="px-2.5 py-1 text-[11px] font-semibold text-zinc-500 hover:text-rose-600 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer transition-colors shadow-2xs ml-auto"
                          title="清空此小節全部和弦"
                        >
                          全部清除
                        </button>
                      </div>

                      {/* Rationale feedback if auto-harmonized recently */}
                      {lastHarmonization && (
                        <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>分析：{lastHarmonization.rationale} (置信度 {lastHarmonization.confidence}%)</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Row 2: Freeform Text Multi-Chord Entry */}
              <div className="p-3 bg-zinc-50 dark:bg-[#0c0e14] rounded-xl border border-zinc-200/90 dark:border-zinc-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    文字輸入多和弦 (Multi-Chord Input):
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-zinc-400">模式：</span>
                    <button
                      type="button"
                      onClick={() => setChordMode(m => m === 'append' ? 'replace' : 'append')}
                      className={`px-2 py-0.5 rounded-md font-bold text-xs border transition-all cursor-pointer ${
                        chordMode === 'append'
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/50'
                          : 'bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600'
                      }`}
                    >
                      {chordMode === 'append' ? '+ 附加 (Append)' : '取代 (Replace)'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="hud-chord-freeform-input"
                    type="text"
                    value={chordInputText}
                    onChange={e => setChordInputText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCommitFreeformChord();
                      }
                    }}
                    placeholder="例如: C G 或 Bb F Gm C7 (以空格或逗號隔開多和弦)"
                    className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleCommitFreeformChord}
                    disabled={!chordInputText.trim() || !onUpdateMeasureChord}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-bold rounded-xl text-xs shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-40"
                  >
                    {chordMode === 'append' ? '加入' : '設定'}
                  </button>
                </div>
              </div>

              {/* Row 3: Key-Aware Diatonic Chord Palette (1-Tap Pads) */}
              <div className="p-3 bg-zinc-50 dark:bg-[#0c0e14] rounded-xl border border-zinc-200/90 dark:border-zinc-800 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>{keySignature} 調 順階自然和弦 (Diatonic Chords):</span>
                  </span>
                  <span className="text-[11px] text-zinc-400">點擊直接加入並試聽</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {getDiatonicCandidateChords(keySignature).map(c => {
                    const currentChords = currentMeasure ? getMeasureChords(currentMeasure) : [];
                    const isSelected = currentChords.includes(c.chord);

                    return (
                      <button
                        key={c.chord}
                        type="button"
                        onClick={() => handleAddDiatonicChord(c.chord)}
                        className={`h-13 rounded-xl transition-all active:scale-95 cursor-pointer touch-manipulation flex flex-col items-center justify-center border shadow-2xs ${
                          isSelected
                            ? 'bg-amber-500 text-zinc-950 border-amber-600 ring-2 ring-amber-400 font-black'
                            : 'bg-white dark:bg-zinc-900 hover:bg-amber-50 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                        }`}
                        title={`${c.label} (${c.degree}) - 點擊${chordMode === 'append' ? '附加' : '設定'}並試聽`}
                      >
                        <span className="font-mono font-black text-sm sm:text-base leading-tight">{c.chord}</span>
                        <span className="text-[10px] font-sans font-medium opacity-75">{c.degree}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Common Extended Qualities Bar */}
              <div className="p-3 bg-zinc-50 dark:bg-[#0c0e14] rounded-xl border border-zinc-200/90 dark:border-zinc-800 flex items-center gap-2 flex-wrap text-xs">
                <span className="font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 text-[11px]">
                  常用變化和弦 (Extended):
                </span>
                {['7', 'maj7', 'm7', 'sus4', 'sus2', 'dim', 'aug', 'add9'].map(q => {
                  const baseRoot = keySignature;
                  const testChord = `${baseRoot}${q}`;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleAddDiatonicChord(testChord)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono font-bold text-xs cursor-pointer shadow-2xs transition-all active:scale-95"
                      title={`點擊加入 ${testChord}`}
                    >
                      +{q}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: LYRICS & ANNOTATIONS */}
          {activeTab === 'lyrics' && (
            <div className="flex flex-col gap-3.5">
              {/* Single-Note Direct Lyric Syllable Editor (羅馬字 / 漢羅) */}
              <div className="p-3 bg-zinc-50 dark:bg-[#0c0e14] rounded-xl border border-zinc-200/90 dark:border-zinc-800 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <MessageSquareQuote className="w-4 h-4 text-amber-500" />
                    <span>本音歌詞設定 (羅馬字 / 漢羅)</span>
                  </span>
                  {(() => {
                    const tone = extractTaigiTone(currentNote.lyric?.poj || currentNote.lyric?.tl || '');
                    if (!tone) return null;
                    return (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-black border border-emerald-500/30"
                        title={`${tone.name} (聲調符號 ${tone.symbol})`}
                      >
                        第 {tone.toneNumber} 調 {tone.symbol}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      羅馬字 (POJ):
                    </label>
                    <input
                      type="text"
                      placeholder="例：teng-ē 或 siú..."
                      value={currentNote.lyric?.poj || currentNote.lyric?.tl || ''}
                      onChange={e => {
                        const val = e.target.value;
                        onUpdateSelectedNote(n => ({
                          ...n,
                          lyric: {
                            ...n.lyric,
                            poj: val,
                          },
                        }));
                      }}
                      className="px-3.5 py-2 text-xs bg-white dark:bg-[#141720] border border-zinc-200/90 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 font-serif min-h-[38px]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      漢羅 (Han-lô):
                    </label>
                    <input
                      type="text"
                      placeholder="例：燈下 或 守..."
                      value={currentNote.lyric?.hanlo || currentNote.lyric?.custom || currentNote.lyric?.hanji || ''}
                      onChange={e => {
                        const val = e.target.value;
                        onUpdateSelectedNote(n => ({
                          ...n,
                          lyric: {
                            ...n.lyric,
                            hanlo: val,
                          },
                        }));
                      }}
                      className="px-3.5 py-2 text-xs bg-white dark:bg-[#141720] border border-zinc-200/90 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 font-serif min-h-[38px]"
                    />
                  </div>
                </div>
              </div>

              {/* Punctuation Row */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 shrink-0 w-24">
                  <MessageSquareQuote className="w-4 h-4" /> Punctuation:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {PUNCTUATION_MARKS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => onInsertPunctuation(p.char)}
                      title={`Insert punctuation ${p.label} (${p.desc})`}
                      className={`min-w-[44px] h-11 px-2.5 rounded-xl font-mono font-black text-sm border transition-all active:scale-95 flex items-center justify-center shadow-2xs cursor-pointer touch-manipulation ${
                        p.char === '\n'
                          ? 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                          : 'bg-zinc-100 hover:bg-amber-100 dark:bg-[#0a0c10] dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200/90 dark:border-zinc-700/80'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Performance Annotations */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 shrink-0 w-24">
                  <FileText className="w-4 h-4" /> Annotations:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {ANNOTATION_MARKS.map(ann => (
                    <button
                      key={ann.label}
                      type="button"
                      onClick={() => onInsertAnnotation(ann.text)}
                      title={`Insert annotation ${ann.label} (${ann.desc})`}
                      className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-indigo-100 dark:bg-[#0a0c10] dark:hover:bg-zinc-800 text-indigo-900 dark:text-indigo-200 font-semibold text-xs border border-zinc-200/90 dark:border-zinc-700/80 transition-all active:scale-95 whitespace-nowrap shadow-2xs cursor-pointer touch-manipulation min-h-[40px]"
                    >
                      {ann.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Annotation Input */}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 shrink-0">Custom Annotation:</span>
                <input
                  type="text"
                  placeholder="e.g. (Pre-Chorus / Male Solo / Rubato)..."
                  value={currentNote.annotation || ''}
                  onChange={e => onSetAnnotation(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-[#0a0c10] border border-zinc-200/90 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 min-h-[40px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    onSetPitch('empty');
                    showNotice('Set custom annotation with empty pitch (Empty)');
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[40px] shadow-xs active:scale-95 touch-manipulation shrink-0"
                >
                  Set Annotation
                </button>
                {currentNote.annotation && (
                  <button
                    type="button"
                    onClick={() => {
                      onSetAnnotation('');
                      showNotice('Cleared annotation');
                    }}
                    className="px-3 py-2 bg-zinc-200 hover:bg-rose-100 hover:text-rose-700 dark:bg-zinc-800 dark:hover:bg-rose-950/50 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[40px] shadow-2xs active:scale-95 touch-manipulation shrink-0"
                    title="Clear annotation"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
