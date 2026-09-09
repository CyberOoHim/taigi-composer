import {
  KeySignature,
  Measure,
  NumberedNotationNote,
  Song,
  TimeSignature,
  VerseItem,
} from '@/types/song';
import {
  KEY_SEMITONES,
  getMeasureChords,
  formatMeasureChords,
  isNonNotationItem,
} from './taigiUtils';

export interface CandidateChord {
  chord: string;
  degree: string;
  label: string;
  rootSemitone: number;
  /** Scale degrees that make up the chord (1-7) */
  chordTones: number[];
  rootDegree: number;
  quality: 'major' | 'minor' | 'dim' | 'dom7' | 'maj7' | 'm7';
}

export interface HarmonizationResult {
  chords: string[];
  formatted: string;
  confidence: number; // 0 to 100
  rationale: string;
  alternatives?: string[];
}

export interface HarmonizationContext {
  isFirst?: boolean;
  isLast?: boolean;
  prevChord?: string;
  nextChord?: string;
  allowDualChords?: boolean;
}

/**
 * Get the diatonic candidate chords for a key signature with their scale degree constituents.
 */
export function getDiatonicCandidateChords(key: KeySignature): CandidateChord[] {
  const flatKeys: KeySignature[] = ['F', 'Bb', 'Eb', 'Ab', 'Db'];
  const preferFlats = flatKeys.includes(key);

  const getRootName = (semitone: number): string => {
    const mod = ((semitone % 12) + 12) % 12;
    if (preferFlats) {
      const flatMap: Record<number, string> = {
        0: 'C', 1: 'Db', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F',
        6: 'Gb', 7: 'G', 8: 'Ab', 9: 'A', 10: 'Bb', 11: 'B',
      };
      return flatMap[mod];
    } else {
      const sharpMap: Record<number, string> = {
        0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E', 5: 'F',
        6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'A#', 11: 'B',
      };
      return sharpMap[mod];
    }
  };

  const base = KEY_SEMITONES[key] ?? 0;

  return [
    {
      chord: getRootName(base),
      degree: 'I',
      label: '主和弦 (I)',
      rootSemitone: (base + 0) % 12,
      chordTones: [1, 3, 5],
      rootDegree: 1,
      quality: 'major',
    },
    {
      chord: `${getRootName(base + 2)}m`,
      degree: 'ii',
      label: '上主和弦 (ii)',
      rootSemitone: (base + 2) % 12,
      chordTones: [2, 4, 6],
      rootDegree: 2,
      quality: 'minor',
    },
    {
      chord: `${getRootName(base + 4)}m`,
      degree: 'iii',
      label: '中音和弦 (iii)',
      rootSemitone: (base + 4) % 12,
      chordTones: [3, 5, 7],
      rootDegree: 3,
      quality: 'minor',
    },
    {
      chord: getRootName(base + 5),
      degree: 'IV',
      label: '下屬和弦 (IV)',
      rootSemitone: (base + 5) % 12,
      chordTones: [4, 6, 1],
      rootDegree: 4,
      quality: 'major',
    },
    {
      chord: getRootName(base + 7),
      degree: 'V',
      label: '屬和弦 (V)',
      rootSemitone: (base + 7) % 12,
      chordTones: [5, 7, 2],
      rootDegree: 5,
      quality: 'major',
    },
    {
      chord: `${getRootName(base + 7)}7`,
      degree: 'V7',
      label: '屬七和弦 (V7)',
      rootSemitone: (base + 7) % 12,
      chordTones: [5, 7, 2, 4],
      rootDegree: 5,
      quality: 'dom7',
    },
    {
      chord: `${getRootName(base + 9)}m`,
      degree: 'vi',
      label: '下中音和弦 (vi)',
      rootSemitone: (base + 9) % 12,
      chordTones: [6, 1, 3],
      rootDegree: 6,
      quality: 'minor',
    },
  ];
}

interface TimedNote {
  pitch: number; // 1-7
  accidental: '' | '#' | 'b';
  duration: number;
  beatStart: number;
  weight: number;
}

/**
 * Extract active pitched notes from a measure with their beat positions and metric weights.
 */
function extractTimedNotes(measure: Measure, beatsPerBar: number): TimedNote[] {
  const result: TimedNote[] = [];
  let currentBeat = 0;

  for (const note of measure.notes) {
    if (isNonNotationItem(note) || note.pitch === 'empty' || !note.pitch || typeof note.pitch !== 'number') {
      continue;
    }

    const dur = typeof note.duration === 'number' && note.duration > 0 ? note.duration : 0;
    if (dur <= 0) continue;

    if (note.pitch >= 1 && note.pitch <= 7) {
      // Metric weight based on beat placement:
      // Downbeat (beat 0) = 1.6x, Halfway downbeat (e.g. beat 2 in 4/4) = 1.3x, integer beats = 1.0x, syncopations = 0.7x
      let metricMultiplier = 1.0;
      const beatInBar = currentBeat % beatsPerBar;
      if (Math.abs(beatInBar) < 0.01) {
        metricMultiplier = 1.6;
      } else if (beatsPerBar === 4 && Math.abs(beatInBar - 2) < 0.01) {
        metricMultiplier = 1.3;
      } else if (Math.abs(beatInBar - Math.round(beatInBar)) < 0.01) {
        metricMultiplier = 1.0;
      } else {
        metricMultiplier = 0.7;
      }

      const weight = dur * metricMultiplier;

      result.push({
        pitch: note.pitch,
        accidental: note.accidental || '',
        duration: dur,
        beatStart: currentBeat,
        weight,
      });
    }

    currentBeat += dur;
  }

  return result;
}

/**
 * Score how well a candidate chord harmonizes a set of timed notes.
 */
function scoreChordForNotes(
  chord: CandidateChord,
  notes: TimedNote[],
  context: HarmonizationContext = {}
): { score: number; matchedNotes: number[]; rationaleDetails: string[] } {
  if (notes.length === 0) {
    // If measure has no pitched notes (rests), favor Tonic (I) or retaining previous chord
    let emptyScore = 5.0;
    if (context.isFirst || context.isLast) {
      if (chord.degree === 'I') emptyScore += 4.0;
    } else if (context.prevChord && chord.chord === context.prevChord) {
      emptyScore += 3.0;
    } else if (chord.degree === 'I') {
      emptyScore += 2.0;
    }
    return { score: emptyScore, matchedNotes: [], rationaleDetails: ['休止小節以主和弦或延續前和小節為基準'] };
  }

  let totalWeight = 0;
  let rawScore = 0;
  const matchedNotes: number[] = [];
  const rationaleDetails: string[] = [];

  for (const n of notes) {
    totalWeight += n.weight;

    if (n.pitch === chord.rootDegree) {
      // Exact chord root note in melody: strongest harmony match
      rawScore += 4.5 * n.weight;
      if (!matchedNotes.includes(n.pitch)) matchedNotes.push(n.pitch);
    } else if (chord.chordTones.includes(n.pitch)) {
      // 3rd, 5th, or 7th of chord: very strong harmony match
      rawScore += 3.5 * n.weight;
      if (!matchedNotes.includes(n.pitch)) matchedNotes.push(n.pitch);
    } else {
      // Non-chord tones: check if consonant extensions or dissonant clashes
      // E.g. Note 2 over C major (I): major 2nd / 9th extension (pleasant tension)
      // E.g. Note 6 over C major (I): major 6th extension (pentatonic friendly)
      const distFromRoot = (n.pitch - chord.rootDegree + 7) % 7;
      if (distFromRoot === 1 || distFromRoot === 5) {
        // 9th or 6th extension
        rawScore += 0.8 * n.weight;
      } else if (distFromRoot === 3 && chord.quality === 'major') {
        // Natural 4th over major triad (harsh clash with 3rd unless sus4)
        rawScore -= 2.0 * n.weight;
      } else {
        rawScore -= 0.5 * n.weight;
      }
    }
  }

  let normalizedScore = totalWeight > 0 ? (rawScore / totalWeight) * 10 : 0;

  // Context bonuses:
  // 1. First measure of song / section favors Tonic (I)
  if (context.isFirst) {
    if (chord.degree === 'I') {
      normalizedScore += 3.5;
      rationaleDetails.push('首小節主和弦開場');
    }
  }

  // 2. Final measure favors Tonic (I) or Dominant (V)
  if (context.isLast) {
    if (chord.degree === 'I') {
      normalizedScore += 4.5;
      rationaleDetails.push('終止小節回歸主和弦 (I)');
    } else if (chord.degree === 'V' || chord.degree === 'V7') {
      normalizedScore += 2.0;
      rationaleDetails.push('半終止屬和弦 (V)');
    }
  }

  // 3. Voice-leading & functional progression from previous chord
  if (context.prevChord) {
    if (context.prevChord === chord.chord) {
      // Harmonic stability: retaining the same chord if melody still fits
      normalizedScore += 1.2;
    } else {
      // Common Taiwanese folk & pop cadence patterns:
      // V / V7 -> I (Authentic cadence)
      // IV -> I (Plagal cadence)
      // I -> IV (Subdominant movement)
      // I -> vi (Relative minor emotive movement)
      // vi -> IV or vi -> ii
      // ii -> V / V7
      const isPrevV = context.prevChord.startsWith('G') || context.prevChord.endsWith('7');
      if (isPrevV && chord.degree === 'I') {
        normalizedScore += 2.5;
        rationaleDetails.push('正格終止 (V → I)');
      } else if (chord.degree === 'I' && (context.prevChord.includes('IV') || context.prevChord.startsWith('F'))) {
        normalizedScore += 2.0;
        rationaleDetails.push('變格終止 (IV → I)');
      } else if (chord.degree === 'V' || chord.degree === 'V7') {
        normalizedScore += 1.0;
      }
    }
  }

  return { score: normalizedScore, matchedNotes, rationaleDetails };
}

/**
 * Suggest optimal chord(s) for a single measure.
 * Checks both single-chord and dual-chord configurations (for 4/4 or 6/8 measures).
 */
export function suggestChordsForMeasure(
  measure: Measure,
  key: KeySignature,
  timeSignature: TimeSignature = '4/4',
  context: HarmonizationContext = {}
): HarmonizationResult {
  const candidates = getDiatonicCandidateChords(key);
  const tsParts = (measure.timeSignature || timeSignature).split('/');
  const beatsPerBar = parseInt(tsParts[0], 10) || 4;
  const timedNotes = extractTimedNotes(measure, beatsPerBar);

  // 1. Evaluate single chord for the entire measure
  const singleScores = candidates.map(chord => {
    const res = scoreChordForNotes(chord, timedNotes, context);
    return {
      chord: chord.chord,
      degree: chord.degree,
      label: chord.label,
      score: res.score,
      matchedNotes: res.matchedNotes,
      rationaleDetails: res.rationaleDetails,
    };
  });

  singleScores.sort((a, b) => b.score - a.score);
  const bestSingle = singleScores[0];

  // 2. Evaluate dual chords if measure has 4 beats (or 6/8) and allowDualChords is enabled
  const allowDual = context.allowDualChords !== false && beatsPerBar >= 4 && timedNotes.length >= 2;

  let dualResult: { chords: string[]; formatted: string; confidence: number; rationale: string } | null = null;

  if (allowDual) {
    const halfBeat = beatsPerBar / 2;
    const firstHalfNotes = timedNotes.filter(n => n.beatStart < halfBeat);
    const secondHalfNotes = timedNotes.filter(n => n.beatStart >= halfBeat);

    if (firstHalfNotes.length > 0 && secondHalfNotes.length > 0) {
      const firstScores = candidates.map(c => ({
        c,
        ...scoreChordForNotes(c, firstHalfNotes, { ...context, isLast: false }),
      }));
      firstScores.sort((a, b) => b.score - a.score);
      const bestFirst = firstScores[0];

      const secondScores = candidates.map(c => ({
        c,
        ...scoreChordForNotes(c, secondHalfNotes, {
          ...context,
          isFirst: false,
          prevChord: bestFirst.c.chord,
        }),
      }));
      secondScores.sort((a, b) => b.score - a.score);
      const bestSecond = secondScores[0];

      // If the two halves clearly favor different chords and the average score is significantly higher (>20%)
      if (bestFirst.c.chord !== bestSecond.c.chord) {
        const avgDualScore = (bestFirst.score + bestSecond.score) / 2;
        if (avgDualScore > bestSingle.score * 1.22) {
          const dualConfidence = Math.min(99, Math.max(50, Math.round((avgDualScore / 25) * 100)));
          dualResult = {
            chords: [bestFirst.c.chord, bestSecond.c.chord],
            formatted: `${bestFirst.c.chord} ${bestSecond.c.chord}`,
            confidence: dualConfidence,
            rationale: `前段含音 [${bestFirst.matchedNotes.sort().join(', ')}] 配 ${bestFirst.c.chord} (${bestFirst.c.degree})，後段含音 [${bestSecond.matchedNotes.sort().join(', ')}] 配 ${bestSecond.c.chord} (${bestSecond.c.degree})`,
          };
        }
      }
    }
  }

  if (dualResult) {
    return {
      chords: dualResult.chords,
      formatted: dualResult.formatted,
      confidence: dualResult.confidence,
      rationale: dualResult.rationale,
      alternatives: [bestSingle.chord],
    };
  }

  // Calculate single chord confidence (scaled 0-99%)
  const confidence = Math.min(99, Math.max(55, Math.round((bestSingle.score / 22) * 100)));
  const matchedStr = bestSingle.matchedNotes.length > 0
    ? `旋律主音：${bestSingle.matchedNotes.sort().join(', ')}`
    : '依調性機能配置';
  const detailStr = bestSingle.rationaleDetails.length > 0
    ? ` · ${bestSingle.rationaleDetails.join(' · ')}`
    : '';

  const alternatives = singleScores.slice(1, 3).map(s => s.chord);

  return {
    chords: [bestSingle.chord],
    formatted: bestSingle.chord,
    confidence,
    rationale: `${matchedStr} → 配 ${bestSingle.chord} (${bestSingle.degree})${detailStr}`,
    alternatives,
  };
}

/**
 * Auto-harmonize all measures in a song.
 * Preserves existing section names, line breaks, barlines, and lyrics.
 */
export function autoArrangeSongChords(song: Song): Song {
  if (!song.measures || song.measures.length === 0) return song;

  let prevChord = '';
  const updatedMeasures: Measure[] = song.measures.map((m, mIdx) => {
    const isFirst = mIdx === 0;
    const isLast = mIdx === song.measures.length - 1;

    const res = suggestChordsForMeasure(m, song.key, song.timeSignature, {
      isFirst,
      isLast,
      prevChord,
      allowDualChords: true,
    });

    prevChord = res.chords[res.chords.length - 1] || prevChord;

    return {
      ...m,
      chord: res.formatted,
      chords: res.chords,
    };
  });

  return {
    ...song,
    measures: updatedMeasures,
    updatedAt: Date.now(),
  };
}

/**
 * Auto-harmonize all measures that belong to a specific verse.
 */
export function autoArrangeVerseChords(
  song: Song,
  verseIndex: number,
  verses: VerseItem[]
): Song {
  const targetVerse = verses[verseIndex];
  if (!targetVerse || !song.measures || song.measures.length === 0) return song;

  // Find all measure indices in this verse
  const verseMeasureIndices = Array.from(
    new Set(targetVerse.notes.map(n => n.measureIndex))
  ).sort((a, b) => a - b);

  if (verseMeasureIndices.length === 0) return song;

  const firstMIdx = verseMeasureIndices[0];
  const lastMIdx = verseMeasureIndices[verseMeasureIndices.length - 1];

  let prevChord = firstMIdx > 0 ? song.measures[firstMIdx - 1]?.chord || '' : '';

  const updatedMeasures: Measure[] = song.measures.map((m, mIdx) => {
    if (!verseMeasureIndices.includes(mIdx)) {
      return m;
    }

    const isFirst = mIdx === firstMIdx;
    const isLast = mIdx === lastMIdx;

    const res = suggestChordsForMeasure(m, song.key, song.timeSignature, {
      isFirst,
      isLast,
      prevChord,
      allowDualChords: true,
    });

    prevChord = res.chords[res.chords.length - 1] || prevChord;

    return {
      ...m,
      chord: res.formatted,
      chords: res.chords,
    };
  });

  return {
    ...song,
    measures: updatedMeasures,
    updatedAt: Date.now(),
  };
}
