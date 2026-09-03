import { Song, VerseItem, VerseNoteRef } from '@/types/song';
import { isNonNotationItem, isPunctuationOrSpacer } from './taigiUtils';

export interface NoteTiming {
  measureIndex: number;
  noteIndex: number;
  noteId: string;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  isVocal: boolean;
}

export interface VerseTiming {
  verse: VerseItem;
  verseIndex: number;
  startSec: number;
  endSec: number;
  firstVocalStartSec: number;
  lastVocalEndSec: number;
  firstVocalNote: VerseNoteRef | null;
  firstVocalWord: string;
  firstVocalRoman: string;
  firstVocalPitchDisplay: string;
  hasVocal: boolean;
  notesTimeline: NoteTiming[];
}

export interface KaraokeLeadInState {
  isLeadIn: boolean;
  isIntro: boolean;
  isInterlude: boolean;
  timeUntilVocalSec: number;
  totalLeadInSec: number;
  beatsRemaining: number;
  totalBeats: number;
  beatsPerBar: number;
  currentBeatIndex: number;
  isBreathCue: boolean;
  progressPercent: number;
  firstVocalWord: string;
  firstVocalPitchDisplay: string;
}

export interface KaraokeStageSequence {
  activeVerse: VerseItem | null;
  activeVerseTiming: VerseTiming | null;
  activeVerseIndex: number;
  nextVerse: VerseItem | null;
  nextVerseTiming: VerseTiming | null;
  isAwaitingVocal: boolean;
  leadIn?: KaraokeLeadInState | null;
  isVerseCompleted: boolean;
  statusMessage?: string;
}

/**
 * Pre-calculate high-precision timeline metadata for all verses in a song
 */
export function computeVersesTiming(
  song: Song,
  verses: VerseItem[],
  tempoMultiplier: number = 1.0
): VerseTiming[] {
  if (!song.measures || song.measures.length === 0 || !verses || verses.length === 0) {
    return [];
  }

  const effectiveBpm = Math.max(20, (song.bpm || 80) * tempoMultiplier);
  const secPerBeat = 60 / effectiveBpm;

  // Build a lookup map of note timing across all measures in the song
  const noteTimingsMap = new Map<string, NoteTiming>();
  let accumulatedTime = 0;

  song.measures.forEach((measure, mIdx) => {
    measure.notes.forEach((note, nIdx) => {
      const isNonNotation =
        isNonNotationItem(note) ||
        note.pitch === 'empty' ||
        typeof note.duration !== 'number' ||
        note.duration <= 0;
      const durationBeats = isNonNotation ? 0 : note.duration;
      const durationSec = durationBeats * secPerBeat;
      const startTimeSec = accumulatedTime;
      const endTimeSec = accumulatedTime + durationSec;

      const rawHanji = note.lyric.hanji ?? note.lyric.custom ?? '';
      const rawRoman = note.lyric.poj ?? note.lyric.pij ?? '';
      const hasLyricText =
        Boolean(rawHanji && !isPunctuationOrSpacer(rawHanji) && rawHanji !== '\n' && rawHanji !== '↵') ||
        Boolean(rawRoman && !isPunctuationOrSpacer(rawRoman) && rawRoman !== '\n' && rawRoman !== '↵');
      const isPitched = !isNonNotation && typeof note.pitch === 'number' && note.pitch > 0;
      const isVocal = !isNonNotation && (hasLyricText || isPitched) && durationSec > 0;

      const noteKey = `${mIdx}-${nIdx}`;
      noteTimingsMap.set(noteKey, {
        measureIndex: mIdx,
        noteIndex: nIdx,
        noteId: note.id,
        startTimeSec,
        endTimeSec,
        durationSec,
        isVocal,
      });

      if (!isNonNotation && durationSec > 0) {
        accumulatedTime += durationSec;
      }
    });
  });

  // Calculate verse-level boundaries and first vocal onset
  return verses.map((verse, vIdx) => {
    const notesTimeline: NoteTiming[] = [];
    const vocalNotes: VerseNoteRef[] = [];

    verse.notes.forEach(item => {
      const timing = noteTimingsMap.get(`${item.measureIndex}-${item.noteIndex}`);
      if (timing) {
        notesTimeline.push(timing);
        if (timing.isVocal) {
          vocalNotes.push(item);
        }
      }
    });

    const startSec = notesTimeline[0]?.startTimeSec ?? 0;
    const endSec = notesTimeline[notesTimeline.length - 1]?.endTimeSec ?? startSec;

    let firstVocalStartSec = startSec;
    let lastVocalEndSec = endSec;
    let firstVocalNote: VerseNoteRef | null = null;
    let firstVocalWord = '';
    let firstVocalRoman = '';
    let firstVocalPitchDisplay = '';
    const hasVocal = vocalNotes.length > 0;

    if (hasVocal) {
      firstVocalNote = vocalNotes[0];
      const firstTiming = noteTimingsMap.get(
        `${firstVocalNote.measureIndex}-${firstVocalNote.noteIndex}`
      );
      if (firstTiming) {
        firstVocalStartSec = firstTiming.startTimeSec;
      }

      const lastVocalNote = vocalNotes[vocalNotes.length - 1];
      const lastTiming = noteTimingsMap.get(
        `${lastVocalNote.measureIndex}-${lastVocalNote.noteIndex}`
      );
      if (lastTiming) {
        lastVocalEndSec = lastTiming.endTimeSec;
      }

      const noteObj = firstVocalNote.note;
      firstVocalWord =
        noteObj.lyric.hanji ||
        noteObj.lyric.custom ||
        noteObj.lyric.poj ||
        noteObj.lyric.pij ||
        (noteObj.pitch && noteObj.pitch !== 'empty' ? String(noteObj.pitch) : '');

      firstVocalRoman = noteObj.lyric.poj || noteObj.lyric.pij || '';
      firstVocalPitchDisplay =
        noteObj.pitch && noteObj.pitch !== 'empty' && noteObj.pitch > 0
          ? `${noteObj.accidental || ''}${noteObj.pitch}`
          : '';
    }

    return {
      verse,
      verseIndex: vIdx,
      startSec,
      endSec,
      firstVocalStartSec,
      lastVocalEndSec,
      firstVocalNote,
      firstVocalWord,
      firstVocalRoman,
      firstVocalPitchDisplay,
      hasVocal,
      notesTimeline,
    };
  });
}

/**
 * Determine the optimal active verse, next verse preview, and rhythmic lead-in cues
 */
export function getKaraokeStageSequenceState(
  timings: VerseTiming[],
  currentTime: number,
  song: Song,
  tempoMultiplier: number = 1.0,
  leadInEnabled: boolean = true
): KaraokeStageSequence {
  if (!timings || timings.length === 0) {
    return {
      activeVerse: null,
      activeVerseTiming: null,
      activeVerseIndex: 0,
      nextVerse: null,
      nextVerseTiming: null,
      isAwaitingVocal: false,
      leadIn: null,
      isVerseCompleted: false,
    };
  }

  const effectiveBpm = Math.max(20, (song.bpm || 80) * tempoMultiplier);
  const secPerBeat = 60 / effectiveBpm;
  const tsParts = (song.measures[0]?.timeSignature || song.timeSignature || '4/4').split('/');
  const beatsPerBar = parseInt(tsParts[0], 10) || 4;

  let activeIndex = 0;
  let isLeadIn = false;
  let isIntro = false;
  let isInterlude = false;
  let timeUntilVocalSec = 0;
  let totalLeadInSec = 0;
  let isVerseCompleted = false;

  const firstVerse = timings[0];

  // Case 1: Intro before the first verse vocal onset
  if (currentTime < firstVerse.firstVocalStartSec) {
    activeIndex = 0;
    isLeadIn = true;
    isIntro = true;
    timeUntilVocalSec = Math.max(0, firstVerse.firstVocalStartSec - currentTime);
    totalLeadInSec = firstVerse.firstVocalStartSec;
  } else {
    // Search which verse window we are in
    let found = false;

    for (let i = 0; i < timings.length; i++) {
      const currentTiming = timings[i];
      const nextTiming = timings[i + 1] ?? null;

      // Actively singing within this verse
      if (currentTime >= currentTiming.firstVocalStartSec && currentTime <= currentTiming.lastVocalEndSec) {
        activeIndex = i;
        isLeadIn = false;
        isVerseCompleted = false;
        found = true;
        break;
      }

      // Between this verse and the next verse (interlude / gap):
      // Immediately javelin / advance to next verse so it is displayed early during the entire interlude!
      if (nextTiming && currentTime > currentTiming.lastVocalEndSec && currentTime < nextTiming.firstVocalStartSec) {
        const gapStart = currentTiming.lastVocalEndSec;
        const gapEnd = nextTiming.firstVocalStartSec;
        const gapDuration = gapEnd - gapStart;

        activeIndex = i + 1;
        isLeadIn = true;
        isInterlude = true;
        timeUntilVocalSec = Math.max(0, gapEnd - currentTime);
        totalLeadInSec = Math.max(0.5, gapDuration);
        found = true;
        break;
      }
    }

    // If beyond last verse singing
    if (!found) {
      activeIndex = timings.length - 1;
      isVerseCompleted = true;
      isLeadIn = false;
    }
  }

  const activeTiming = timings[activeIndex] || timings[0];
  const nextTiming = timings[activeIndex + 1] || null;
  const isAwaitingVocal = isLeadIn && activeTiming.hasVocal && currentTime < activeTiming.firstVocalStartSec;

  // Compute detailed rhythmic lead-in state if lead-in is active
  let leadInState: KaraokeLeadInState | null = null;

  if (isLeadIn && leadInEnabled && activeTiming.hasVocal) {
    const countdownWindowSec = beatsPerBar * secPerBeat;
    const beatsRemaining = Math.max(1, Math.ceil(timeUntilVocalSec / secPerBeat));
    const isWithinBarCountdown = timeUntilVocalSec <= countdownWindowSec + 0.05;

    // Current countdown beat: 1 to beatsPerBar
    let currentBeatIndex = 1;
    if (isWithinBarCountdown) {
      const barBeatsLeft = Math.min(beatsPerBar, beatsRemaining);
      currentBeatIndex = Math.max(1, Math.min(beatsPerBar, beatsPerBar - barBeatsLeft + 1));
    }

    // Breath cue: during the last 0.85s / 1 beat before vocal attack
    const isBreathCue = timeUntilVocalSec <= Math.min(0.9, secPerBeat * 1.1) && timeUntilVocalSec > 0;

    const progressPercent = totalLeadInSec > 0
      ? Math.min(100, Math.max(0, ((totalLeadInSec - timeUntilVocalSec) / totalLeadInSec) * 100))
      : 100;

    leadInState = {
      isLeadIn: true,
      isIntro,
      isInterlude,
      timeUntilVocalSec,
      totalLeadInSec,
      beatsRemaining,
      totalBeats: beatsPerBar,
      beatsPerBar,
      currentBeatIndex,
      isBreathCue,
      progressPercent,
      firstVocalWord: activeTiming.firstVocalWord,
      firstVocalPitchDisplay: activeTiming.firstVocalPitchDisplay,
    };
  }

  let statusMessage = '';
  if (leadInState) {
    if (leadInState.isBreathCue) {
      statusMessage = 'Breathe in · Get ready';
    } else if (leadInState.isIntro) {
      statusMessage = `Intro count-in · ${leadInState.beatsRemaining} beat(s)`;
    } else {
      statusMessage = `Interlude count-in · ${leadInState.beatsRemaining} beat(s)`;
    }
  } else if (isVerseCompleted) {
    statusMessage = 'Phrase complete';
  }

  return {
    activeVerse: activeTiming.verse,
    activeVerseTiming: activeTiming,
    activeVerseIndex: activeIndex,
    nextVerse: nextTiming?.verse ?? null,
    nextVerseTiming: nextTiming,
    isAwaitingVocal,
    leadIn: leadInState,
    isVerseCompleted,
    statusMessage,
  };
}
