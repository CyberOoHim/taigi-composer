import { JianpuNote, KeySignature, Measure, NoteDuration, PitchNumber, Song, VerseItem, VerseNoteRef } from '@/types/song';

// Semitones relative to C4 (MIDI note 60)
export const KEY_SEMITONES: Record<KeySignature, number> = {
  'C': 0,
  'Db': 1,
  'D': 2,
  'Eb': 3,
  'E': 4,
  'F': 5,
  'F#': 6,
  'G': 7,
  'Ab': 8,
  'A': 9,
  'Bb': 10,
  'B': 11,
};

// Major scale scale degree intervals from root 1 (in semitones)
// 1 = 0, 2 = 2, 3 = 4, 4 = 5, 5 = 7, 6 = 9, 7 = 11
export const SCALE_DEGREE_SEMITONES: Record<string, number> = {
  0: -100, // Rest
  'empty': -100, // Empty notation / spacer / punctuation slot
  1: 0,
  2: 2,
  3: 4,
  4: 5,
  5: 7,
  6: 9,
  7: 11,
};

/**
 * Calculate frequency in Hz for a given Key, Pitch number (1-7), Octave offset, and Accidental.
 */
export function getPitchFrequency(
  key: KeySignature,
  pitch: PitchNumber,
  octave: number = 0,
  accidental: '' | '#' | 'b' = '',
  transposeSemitones: number = 0
): number {
  if (pitch === 0 || pitch === 'empty' || !pitch) return 0; // Rest or empty space


  // Base C4 = 261.63 Hz, MIDI 60
  const baseKeyOffset = KEY_SEMITONES[key] || 0;
  const degreeOffset = SCALE_DEGREE_SEMITONES[pitch] || 0;
  let accidentalOffset = 0;
  if (accidental === '#') accidentalOffset = 1;
  if (accidental === 'b') accidentalOffset = -1;

  const totalSemitonesFromC4 =
    baseKeyOffset + degreeOffset + octave * 12 + accidentalOffset + transposeSemitones;
  const midiNote = 60 + totalSemitonesFromC4;

  // A4 = 440Hz = MIDI 69
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Chord note frequencies for accompaniment synthesis
 */
export function getChordNotes(chordName: string, transposeSemitones: number = 0): number[] {
  if (!chordName || chordName.trim() === '') return [];

  const rootMatch = chordName.match(/^([A-G][#b]?)(.*)$/);
  if (!rootMatch) return [];

  const rootStr = rootMatch[1] as KeySignature;
  const quality = rootMatch[2].toLowerCase();

  const rootSemitone = (KEY_SEMITONES[rootStr] ?? 0) + transposeSemitones;
  const rootMidi = 48 + rootSemitone; // C3 octave range for accompaniment

  let intervals = [0, 4, 7]; // Major triad

  if (quality.includes('m') && !quality.includes('maj')) {
    intervals = [0, 3, 7]; // Minor triad
  } else if (quality.includes('dim')) {
    intervals = [0, 3, 6];
  } else if (quality.includes('aug')) {
    intervals = [0, 4, 8];
  } else if (quality.includes('sus4')) {
    intervals = [0, 5, 7];
  } else if (quality.includes('7')) {
    if (quality.includes('maj7')) {
      intervals = [0, 4, 7, 11];
    } else if (quality.includes('m7')) {
      intervals = [0, 3, 7, 10];
    } else {
      intervals = [0, 4, 7, 10]; // Dominant 7th
    }
  }

  return intervals.map(semitone => 440 * Math.pow(2, (rootMidi + semitone - 69) / 12));
}

// Special Taigi (POJ and Tâi-lô / PIJ) characters and tone diacritics
export const TAIGI_TONE_CHARS = [
  // Tone marks for vowels
  { label: 'á', char: 'á', desc: 'Tone 2 (陰上)' },
  { label: 'à', char: 'à', desc: 'Tone 3 (陰去)' },
  { label: 'â', char: 'â', desc: 'Tone 5 (陽平)' },
  { label: 'ā', char: 'ā', desc: 'Tone 7 (陽去)' },
  { label: 'a̍', char: 'a̍', desc: 'Tone 8 (陽入 / vertical dot)' },
  { label: 'a̋', char: 'a̋', desc: 'Tone 9 (高平)' },
  { label: 'é', char: 'é', desc: 'Tone 2' },
  { label: 'è', char: 'è', desc: 'Tone 3' },
  { label: 'ê', char: 'ê', desc: 'Tone 5 / POJ e-circumflex' },
  { label: 'ē', char: 'ē', desc: 'Tone 7' },
  { label: 'e̍', char: 'e̍', desc: 'Tone 8' },
  { label: 'í', char: 'í', desc: 'Tone 2' },
  { label: 'ì', char: 'ì', desc: 'Tone 3' },
  { label: 'î', char: 'î', desc: 'Tone 5' },
  { label: 'ī', char: 'ī', desc: 'Tone 7' },
  { label: 'i̍', char: 'i̍', desc: 'Tone 8' },
  { label: 'ó', char: 'ó', desc: 'Tone 2' },
  { label: 'ò', char: 'ò', desc: 'Tone 3' },
  { label: 'ô', char: 'ô', desc: 'Tone 5' },
  { label: 'ō', char: 'ō', desc: 'Tone 7' },
  { label: 'o̍', char: 'o̍', desc: 'Tone 8' },
  { label: 'ú', char: 'ú', desc: 'Tone 2' },
  { label: 'ù', char: 'ù', desc: 'Tone 3' },
  { label: 'û', char: 'û', desc: 'Tone 5' },
  { label: 'ū', char: 'ū', desc: 'Tone 7' },
  { label: 'u̍', char: 'u̍', desc: 'Tone 8' },
  { label: 'o͘', char: 'o͘', desc: 'POJ Open O (dot above right)' },
  { label: 'ó͘', char: 'ó͘', desc: 'POJ Open O Tone 2' },
  { label: 'ò͘', char: 'ò͘', desc: 'POJ Open O Tone 3' },
  { label: 'ô͘', char: 'ô͘', desc: 'POJ Open O Tone 5' },
  { label: 'ō͘', char: 'ō͘', desc: 'POJ Open O Tone 7' },
  { label: 'o̍͘', char: 'o̍͘', desc: 'POJ Open O Tone 8' },
  { label: 'ⁿ', char: 'ⁿ', desc: 'POJ Nasal superscript n' },
  { label: 'm̄', char: 'm̄', desc: 'Syllabic m Tone 7' },
  { label: 'ḿ', char: 'ḿ', desc: 'Syllabic m Tone 2' },
  { label: 'ńg', char: 'ńg', desc: 'Syllabic ng Tone 2' },
  { label: 'n̂g', char: 'n̂g', desc: 'Syllabic ng Tone 5' },
  { label: 'n̄g', char: 'n̄g', desc: 'Syllabic ng Tone 7' },
  { label: 'ê', char: 'ê', desc: 'ê (的/之)' },
  { label: 'tio̍h', char: 'tio̍h', desc: '著/應' },
  { label: 'bô', char: 'bô', desc: '無' },
  { label: 'hó', char: 'hó', desc: '好' },
  { label: 'kui', char: 'kui', desc: '歸' },
];

// Common Punctuation Marks for Jianpu sheet lyrics and notations
export const PUNCTUATION_MARKS = [
  { label: '，', char: '，', desc: '逗號 (Comma)' },
  { label: '。', char: '。', desc: '句號 (Period)' },
  { label: '、', char: '、', desc: '頓號 (Pause / Enumeration)' },
  { label: '！', char: '！', desc: '驚嘆號 (Exclamation)' },
  { label: '？', char: '？', desc: '問號 (Question mark)' },
  { label: '—', char: '—', desc: '破折號 (Em Dash)' },
  { label: '…', char: '…', desc: '省略號 (Ellipsis)' },
  { label: '「', char: '「', desc: '前引號 (Left Quote)' },
  { label: '」', char: '」', desc: '後引號 (Right Quote)' },
  { label: 'V', char: 'V', desc: '換氣記號 (Breath Mark)' },
  { label: ' ', char: ' ', desc: '空白留白 (Space)' },
  { label: '↵ 換行', char: '\n', desc: '換行標記 (Line Break)' },
];

// Musical & Vocal Performance Annotations (註解 / 演奏與演唱標記)
export const ANNOTATION_MARKS = [
  { label: '(漸慢)', text: '(漸慢)', desc: 'rit. / 速度漸慢' },
  { label: '(合唱)', text: '(合唱)', desc: '眾人合唱' },
  { label: '(副歌)', text: '(副歌)', desc: '副歌段落' },
  { label: '(主歌)', text: '(主歌)', desc: '主歌段落' },
  { label: '(伴奏)', text: '(伴奏)', desc: '樂器伴奏段' },
  { label: '(獨唱)', text: '(獨唱)', desc: '單人獨唱' },
  { label: '(男)', text: '(男)', desc: '男聲演唱' },
  { label: '(女)', text: '(女)', desc: '女聲演唱' },
  { label: '(口白)', text: '(口白)', desc: '朗誦/口白' },
  { label: '[間奏]', text: '[間奏]', desc: '間奏段' },
  { label: '[尾奏]', text: '[尾奏]', desc: '尾奏結尾' },
  { label: 'rit.', text: 'rit.', desc: 'Ritardando (漸慢)' },
  { label: 'fine', text: 'fine', desc: 'Fine (曲終)' },
  { label: 'f', text: 'f', desc: 'Forte (強)' },
  { label: 'p', text: 'p', desc: 'Piano (弱)' },
  { label: 'mp', text: 'mp', desc: 'Mezzo-piano (中弱)' },
  { label: 'mf', text: 'mf', desc: 'Mezzo-forte (中強)' },
];

/**
 * Split text into Taigi syllables based on whether it's Hanji, POJ/PIJ (hyphens/spaces), or mixed Han-lo.
 * e.g., "獨夜無伴守燈下" -> ["獨", "夜", "無", "伴", "守", "燈", "下"]
 * e.g., "To̍k-iā bô-phōaⁿ siú teng-ē" -> ["To̍k", "iā", "bô", "phōaⁿ", "siú", "teng", "ē"]
 * e.g., "阮ê故鄉" -> ["阮", "ê", "故", "鄉"]
 */
export function splitTaigiLyricSyllables(text: string): string[] {
  if (!text) return [];

  // Normalize separators: replace full-width punctuation or commas with spaces
  const cleaned = text
    .replace(/[，。！？、；：""''（）(),.!?;:]/g, ' ')
    .trim();

  const tokens: string[] = [];
  const rawWords = cleaned.split(/\s+/).filter(Boolean);

  for (const word of rawWords) {
    // If the word contains hyphens (common in POJ/PIJ like "bô-phōaⁿ" or "chhun-hong")
    if (word.includes('-')) {
      const parts = word.split('-').filter(Boolean);
      for (const part of parts) {
        tokens.push(...splitTokenCharacters(part));
      }
    } else {
      tokens.push(...splitTokenCharacters(word));
    }
  }

  return tokens;
}

function splitTokenCharacters(token: string): string[] {
  const result: string[] = [];
  let currentLatin = '';

  // Iterate codepoints / characters
  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    const code = char.charCodeAt(0);

    // Hanji character check (CJK Unified Ideographs range)
    const isHan =
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df);

    if (isHan) {
      if (currentLatin.trim()) {
        result.push(currentLatin.trim());
        currentLatin = '';
      }
      result.push(char);
    } else {
      // Latin letters, combining diacritics, superscript n (ⁿ), dot above right (͘)
      currentLatin += char;
    }
  }

  if (currentLatin.trim()) {
    result.push(currentLatin.trim());
  }

  return result;
}

/**
 * Format duration into human readable fraction or symbol
 */
export function formatDurationName(duration: number): string {
  switch (duration) {
    case 4:
      return 'Whole Note (4)';
    case 3:
      return 'Dotted Half (3)';
    case 2:
      return 'Half Note (2)';
    case 1.75:
      return 'Double Dotted Quarter (1.75)';
    case 1.5:
      return 'Dotted Quarter (1.5 / 1½)';
    case 1.25:
      return 'Tied Quarter+16th (1.25)';
    case 1:
      return 'Quarter Note (1)';
    case 0.75:
      return 'Dotted Eighth (0.75 / ¾)';
    case 0.5:
      return '8th Note (1/2)';
    case 0.375:
      return 'Dotted 16th (0.375 / ⅜)';
    case 0.25:
      return '16th Note (1/4)';
    case 0.125:
      return '32nd Note (1/8)';
    case 0:
      return '0 beats (不占拍)';
    default:
      return `${duration} beats`;
  }
}

export interface DurationChineseInfo {
  name: string;
  fractionLabel: string;
  beatsLabel: string;
  jianpuSymbol: string;
  description: string;
  isDotted: boolean;
}

export function getDurationChineseInfo(duration: number): DurationChineseInfo {
  switch (duration) {
    case 0:
      return {
        name: '不占拍 (0 拍)',
        fractionLabel: '0 拍 (留白/標點/換行)',
        beatsLabel: '0 拍',
        jianpuSymbol: '—',
        description: '無時間長度：純文字留白、標點符號或換行標記，不消耗小節拍數',
        isDotted: false,
      };
    case 1.5:
      return {
        name: '附點四分音符',
        fractionLabel: '一又二分之一拍 (1½ 拍)',
        beatsLabel: '1.5 拍',
        jianpuSymbol: '5·',
        description: '四分音符 (1拍) + 附點 (0.5拍) = 1.5拍',
        isDotted: true,
      };
    case 0.75:
      return {
        name: '附點八分音符',
        fractionLabel: '四分之三拍 (¾ 拍)',
        beatsLabel: '0.75 拍',
        jianpuSymbol: '5· (下一線)',
        description: '八分音符 (0.5拍) + 附點 (0.25拍) = 0.75拍',
        isDotted: true,
      };
    case 1:
      return {
        name: '四分音符',
        fractionLabel: '一拍 (1 拍)',
        beatsLabel: '1 拍',
        jianpuSymbol: '5',
        description: '標準單拍音符 (1拍)',
        isDotted: false,
      };
    case 0.5:
      return {
        name: '八分音符',
        fractionLabel: '半拍 / 二分之一拍 (½ 拍)',
        beatsLabel: '0.5 拍',
        jianpuSymbol: '5 (下一線)',
        description: '半拍 (0.5拍)',
        isDotted: false,
      };
    case 0.25:
      return {
        name: '十六分音符',
        fractionLabel: '四分之一拍 (¼ 拍)',
        beatsLabel: '0.25 拍',
        jianpuSymbol: '5 (下兩線)',
        description: '四分之一拍 (0.25拍)',
        isDotted: false,
      };
    case 2:
      return {
        name: '二分音符',
        fractionLabel: '兩拍 (2 拍)',
        beatsLabel: '2 拍',
        jianpuSymbol: '5 -',
        description: '兩拍 (2拍，右側一條增時線)',
        isDotted: false,
      };
    case 3:
      return {
        name: '附點二分音符',
        fractionLabel: '三拍 (3 拍)',
        beatsLabel: '3 拍',
        jianpuSymbol: '5 - -',
        description: '二分音符 (2拍) + 附點 (1拍) = 3拍',
        isDotted: true,
      };
    case 4:
      return {
        name: '全音符',
        fractionLabel: '四拍 (4 拍)',
        beatsLabel: '4 拍',
        jianpuSymbol: '5 - - -',
        description: '四拍 (4拍，右側三條增時線)',
        isDotted: false,
      };
    case 0.375:
      return {
        name: '附點十六分音符',
        fractionLabel: '八分之三拍 (⅜ 拍)',
        beatsLabel: '0.375 拍',
        jianpuSymbol: '5· (下兩線)',
        description: '十六分音符 (0.25拍) + 附點 (0.125拍) = 0.375拍',
        isDotted: true,
      };
    case 1.75:
      return {
        name: '複附點四分音符',
        fractionLabel: '一又四分之三拍 (1¾ 拍)',
        beatsLabel: '1.75 拍',
        jianpuSymbol: '5··',
        description: '四分音符 (1拍) + 雙附點 (0.75拍) = 1.75拍',
        isDotted: true,
      };
    default:
      return {
        name: `自訂音長 (${duration} 拍)`,
        fractionLabel: `${duration} 拍`,
        beatsLabel: `${duration} 拍`,
        jianpuSymbol: `${duration} 拍`,
        description: `自訂節奏長度: ${duration} 拍`,
        isDotted: duration % 1 !== 0 && duration !== 0.5 && duration !== 0.25,
      };
  }
}

/**
 * Check if a note is punctuation (標點), an annotation (註解), a newline (換行), or whitespace/blank spacer (空白).
 * Punctuation, annotations, newlines, and whitespace are NOT treated as musical notation
 * and do NOT occupy any time duration when playing (0 duration).
 */
export function isNonNotationItem(note: JianpuNote | null | undefined): boolean {
  if (!note) return false;

  // 1. Explicit 0 or negative duration
  if (typeof note.duration === 'number' && note.duration <= 0) return true;

  // 2. Explicit 'empty' pitch (blank notation / spacer for punctuation/annotation/newline)
  if (note.pitch === 'empty') return true;

  const isMusicalPitch = typeof note.pitch === 'number' && note.pitch > 0;

  // 3. Note has an annotation and has no active musical pitch (1-7)
  if (note.annotation && !isMusicalPitch) {
    return true;
  }

  // 4. Note contains punctuation or newline in lyrics and does not have a pitched melody note (1-7)
  const hanji = note.lyric?.hanji?.trim() || '';
  const custom = note.lyric?.custom?.trim() || '';
  const poj = note.lyric?.poj?.trim() || '';
  const pij = note.lyric?.pij?.trim() || '';

  const isHanjiPunct = isPunctuationOrSpacer(hanji);
  const isCustomPunct = isPunctuationOrSpacer(custom);
  const isPojPunct = isPunctuationOrSpacer(poj);
  const isPijPunct = isPunctuationOrSpacer(pij);

  const isPurePunctuationLyric =
    (hanji ? isHanjiPunct : false) ||
    (custom ? isCustomPunct : false) ||
    (poj ? isPojPunct : false) ||
    (pij ? isPijPunct : false);

  if (isPurePunctuationLyric && !isMusicalPitch) {
    return true;
  }

  return false;
}

/**
 * Check if a character or string is a punctuation mark, newline, or spacer
 */
export function isPunctuationOrSpacer(str?: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  if (
    trimmed === '' ||
    trimmed === '—' ||
    trimmed === '…' ||
    trimmed === 'V' ||
    trimmed === '↵' ||
    trimmed === '\n' ||
    trimmed === '\r'
  ) {
    return true;
  }
  return /^[，。！？、；：""''（）()「」,.!?;:\s—…\n\r↵]+$/.test(trimmed);
}

/**
 * Check if a note is a verse separator (punctuation, delimiter, or space/rest pause)
 */
export function isVerseBreakNote(note: JianpuNote): boolean {
  if (isNonNotationItem(note)) return true;

  // Check if note lyrics contain punctuation marks or newline delimiters
  const hanji = note.lyric?.hanji?.trim() || '';
  const custom = note.lyric?.custom?.trim() || '';
  const poj = note.lyric?.poj?.trim() || '';
  const pij = note.lyric?.pij?.trim() || '';

  const delimPattern = /[，。！？、；：\n\r↵—…]/;
  if (
    delimPattern.test(hanji) ||
    delimPattern.test(custom) ||
    delimPattern.test(poj) ||
    delimPattern.test(pij)
  ) {
    return true;
  }

  // Rest note with empty or dash lyric
  if (
    note.pitch === 0 &&
    (!note.lyric.hanji || isPunctuationOrSpacer(note.lyric.hanji)) &&
    (!note.lyric.poj || isPunctuationOrSpacer(note.lyric.poj))
  ) {
    return true;
  }

  return false;
}

/**
 * Group song into Verses (句 / 樂句) sectioned by punctuation (標點) or whitespace/rest (空白)
 */
export function groupSongIntoVerses(song: Song): VerseItem[] {
  const verses: VerseItem[] = [];
  let currentNotes: VerseNoteRef[] = [];
  let currentSection: string | undefined = undefined;

  const pushCurrentVerse = () => {
    if (currentNotes.length === 0) return;

    const startMNum = currentNotes[0].measureNumber;
    const endMNum = currentNotes[currentNotes.length - 1].measureNumber;

    const chords = Array.from(
      new Set(currentNotes.map(n => n.chord).filter(Boolean) as string[])
    );

    const hanjiParts: string[] = [];
    const pojParts: string[] = [];
    const pijParts: string[] = [];
    const customParts: string[] = [];

    currentNotes.forEach(n => {
      if (n.note.lyric.hanji) hanjiParts.push(n.note.lyric.hanji);
      if (n.note.lyric.poj) pojParts.push(n.note.lyric.poj);
      if (n.note.lyric.pij) pijParts.push(n.note.lyric.pij);
      if (n.note.lyric.custom) customParts.push(n.note.lyric.custom);
    });

    const verseIndex = verses.length;
    verses.push({
      id: `verse-${verseIndex + 1}-${startMNum}-${endMNum}`,
      verseIndex,
      notes: [...currentNotes],
      startMeasureNumber: startMNum,
      endMeasureNumber: endMNum,
      section: currentSection || currentNotes[0].section,
      chords,
      lyricSummary: {
        hanji: hanjiParts.join(''),
        poj: pojParts.join(' '),
        pij: pijParts.join(' '),
        custom: customParts.join(' '),
      },
    });

    currentNotes = [];
  };

  song.measures.forEach((measure, mIdx) => {
    measure.notes.forEach((note, nIdx) => {
      const isFirstInMeasure = nIdx === 0;

      // If a measure has a new explicit section tag and we already have notes in the current verse, close the verse
      if (measure.section && isFirstInMeasure && currentNotes.length > 0 && currentSection !== measure.section) {
        pushCurrentVerse();
        currentSection = measure.section;
      } else if (measure.section && !currentSection) {
        currentSection = measure.section;
      }

      const noteRef: VerseNoteRef = {
        note,
        measureIdx: mIdx,
        noteIdx: nIdx,
        measureIndex: mIdx,
        noteIndex: nIdx,
        measureNumber: measure.measureNumber,
        chord: measure.chord,
        section: measure.section,
        isFirstInMeasure,
      };

      currentNotes.push(noteRef);

      // Check if this note acts as a phrase / verse ending separator
      const isSeparator = isVerseBreakNote(note);

      if (isSeparator) {
        // If we have accumulated at least one pitched/lyrical note before this separator, close the verse here
        const hasContent = currentNotes.some(
          n => (typeof n.note.pitch === 'number' && n.note.pitch > 0) || (n.note.lyric.hanji && !isPunctuationOrSpacer(n.note.lyric.hanji))
        );

        if (hasContent) {
          pushCurrentVerse();
          currentSection = undefined;
        }
      }
    });
  });

  // Push remaining notes
  pushCurrentVerse();

  // If for some reason song has no notes or produced empty verses, provide a fallback single verse
  if (verses.length === 0 && song.measures.length > 0) {
    const allNotes: VerseNoteRef[] = [];
    song.measures.forEach((m, mIdx) => {
      m.notes.forEach((n, nIdx) => {
        allNotes.push({
          note: n,
          measureIdx: mIdx,
          noteIdx: nIdx,
          measureIndex: mIdx,
          noteIndex: nIdx,
          measureNumber: m.measureNumber,
          chord: m.chord,
          section: m.section,
          isFirstInMeasure: nIdx === 0,
        });
      });
    });

    if (allNotes.length > 0) {
      verses.push({
        id: 'verse-1',
        verseIndex: 0,
        notes: allNotes,
        startMeasureNumber: 1,
        endMeasureNumber: song.measures[song.measures.length - 1].measureNumber,
        section: song.measures[0]?.section,
        chords: Array.from(new Set(allNotes.map(n => n.chord).filter(Boolean) as string[])),
        lyricSummary: {
          hanji: allNotes.map(n => n.note.lyric.hanji || '').join(''),
          poj: allNotes.map(n => n.note.lyric.poj || '').join(' '),
          pij: allNotes.map(n => n.note.lyric.pij || '').join(' '),
          custom: allNotes.map(n => n.note.lyric.custom || '').join(' '),
        },
      });
    }
  }

  return verses;
}

/**
 * Tokenize verse text into syllables while preserving or recognizing punctuation marks
 */
export function splitVerseTextTokens(text: string): { text: string; isPunct: boolean }[] {
  if (!text) return [];

  const tokens: { text: string; isPunct: boolean }[] = [];
  let currentLatin = '';

  const flushLatin = () => {
    if (currentLatin.trim()) {
      tokens.push({ text: currentLatin.trim(), isPunct: false });
      currentLatin = '';
    }
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isPunct = isPunctuationOrSpacer(char);

    if (isPunct) {
      flushLatin();
      if (char.trim()) {
        tokens.push({ text: char, isPunct: true });
      }
      continue;
    }

    const code = char.charCodeAt(0);
    const isHan =
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df);

    if (isHan) {
      flushLatin();
      tokens.push({ text: char, isPunct: false });
    } else if (char === '-' || char === ' ') {
      flushLatin();
    } else {
      currentLatin += char;
    }
  }

  flushLatin();
  return tokens;
}

/**
 * Get effective beat duration of a note without double scaling.
 * Returns 0 for non-notation items (punctuation, annotations, blank spaces, newlines).
 */
export function getNoteBeatDuration(note: JianpuNote | null | undefined): number {
  if (!note || isNonNotationItem(note) || note.pitch === 'empty') return 0;
  const dur = typeof note.duration === 'number' ? note.duration : 1;
  if (dur <= 0) return 0;
  // If duration is already a dotted value (1.5, 0.75, 3, 0.375, 1.75), do not scale again
  if (note.isDotted && (dur === 1 || dur === 0.5 || dur === 2 || dur === 0.25 || dur === 4)) {
    return Math.round(dur * 1.5 * 1000) / 1000;
  }
  return dur;
}

/**
 * Normalizes a note so that non-notation items (punctuation, annotations, newlines, empty pitches)
 * strictly have duration: 0 and pitch: 'empty', with no unnecessary time duration activated.
 */
export function normalizeNoteDuration(note: JianpuNote): JianpuNote {
  if (
    isNonNotationItem(note) ||
    note.pitch === 'empty' ||
    (typeof note.duration === 'number' && note.duration <= 0)
  ) {
    return {
      ...note,
      pitch: 'empty',
      duration: 0 as NoteDuration,
      isDotted: false,
      isTied: false,
      accidental: '',
      octave: 0,
    };
  }
  return note;
}

/**
 * Normalizes all notes across all measures of a song to ensure zero-duration rules are strictly enforced.
 */
export function normalizeSongDurations(song: Song): Song {
  return {
    ...song,
    measures: song.measures.map(m => ({
      ...m,
      notes: m.notes.map(normalizeNoteDuration),
    })),
  };
}

/**
 * Calculate the total beats currently inside a measure's notes
 */
export function calculateMeasureBeats(notes: JianpuNote[]): number {
  if (!notes || notes.length === 0) return 0;
  const total = notes.reduce((sum, n) => sum + getNoteBeatDuration(n), 0);
  return Math.round(total * 1000) / 1000;
}

/**
 * Calculate expected beats per measure according to the time signature (e.g. 4/4 -> 4, 3/4 -> 3, 6/8 -> 3, 2/4 -> 2)
 */
export function getExpectedMeasureBeats(timeSignature: string): number {
  if (!timeSignature) return 4;
  const parts = timeSignature.split('/');
  const num = parseInt(parts[0], 10) || 4;
  const den = parseInt(parts[1], 10) || 4;
  return Math.round(num * (4 / den) * 1000) / 1000;
}

export interface MeasureRhythmReport {
  currentBeats: number;
  expectedBeats: number;
  beatDiff: number; // positive = over-beat, negative = under-beat
  absDiff: number;
  isFull: boolean;
  isUnder: boolean;
  isOver: boolean;
  percentage: number; // 0 to 100+
}

/**
 * Comprehensive rhythm health check for a measure
 */
export function getMeasureRhythmReport(measure: Measure, fallbackTimeSignature = '4/4'): MeasureRhythmReport {
  const currentBeats = calculateMeasureBeats(measure?.notes || []);
  const timeSig = measure?.timeSignature || fallbackTimeSignature;
  const expectedBeats = getExpectedMeasureBeats(timeSig);
  const rawDiff = currentBeats - expectedBeats;
  const beatDiff = Math.round(rawDiff * 1000) / 1000;
  const absDiff = Math.abs(beatDiff);
  const isFull = absDiff < 0.001;
  const isUnder = beatDiff < -0.001;
  const isOver = beatDiff > 0.001;
  const percentage = expectedBeats > 0 ? Math.min(200, Math.round((currentBeats / expectedBeats) * 100)) : 100;

  return {
    currentBeats,
    expectedBeats,
    beatDiff,
    absDiff,
    isFull,
    isUnder,
    isOver,
    percentage,
  };
}

/**
 * Decompose a deficit in beats into a clean set of standard rest note durations
 * E.g. 1 -> [1], 0.5 -> [0.5], 1.5 -> [1, 0.5] or [1.5], 2 -> [2], 3 -> [2, 1] or [3]
 */
export function getRestDurationsForDeficit(deficit: number): NoteDuration[] {
  let remaining = Math.round(Math.abs(deficit) * 1000) / 1000;
  if (remaining <= 0) return [];

  // Match exact single rest values first
  const exactSupported: NoteDuration[] = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.125];
  if (exactSupported.includes(remaining)) {
    return [remaining];
  }

  const results: NoteDuration[] = [];
  const standardBeats = [4, 2, 1, 0.5, 0.25, 0.125];

  while (remaining >= 0.12) {
    let chosen: number | null = null;
    for (const b of standardBeats) {
      if (remaining >= b - 0.001) {
        chosen = b;
        break;
      }
    }
    if (chosen !== null) {
      results.push(chosen);
      remaining = Math.round((remaining - chosen) * 1000) / 1000;
    } else {
      break;
    }
  }

  return results.length > 0 ? results : [1];
}

export interface TaigiToneInfo {
  toneNumber: number;
  superscript: string; // e.g. '¹', '²', '³', '⁴', '⁵', '⁷', '⁸', '⁹'
  contour: string;     // e.g. '55', '51', '21', '32', '24', '33', '4', '55'
  symbol: string;      // e.g. '˥', '˥˩', '˨˩', '˨', '˨˦', '˧', '˦', '˥'
  name: string;        // e.g. '陰平', '陰上', '陰去', '陰入', '陽平', '陽去', '陽入'
}

/**
 * Extract Taiwanese Hokkien tone number and contour for learning aids.
 * Supports Pe̍h-ōe-jī (POJ), Tâi-lô (PIJ), and numeric tone notations.
 */
export function extractTaigiTone(syllable: string): TaigiToneInfo | null {
  if (!syllable || !syllable.trim()) return null;
  const s = syllable.trim();

  // If purely punctuation or CJK characters, return null
  if (/^[\p{P}\p{S}\s]+$/u.test(s) || /^[\u4e00-\u9fa5]+$/u.test(s)) return null;

  // 1. Check explicit digit tone (1-9) inside or at end of syllable
  const digitMatch = s.match(/([1-9])/);
  if (digitMatch) {
    const num = parseInt(digitMatch[1], 10);
    return getToneInfoByNumber(num);
  }

  // 2. Decompose unicode (NFD) to check combining diacritics
  const nfd = s.normalize('NFD');

  // Tone 8: vertical line \u030D, or explicit ̍ or vertical dot / bar
  if (nfd.includes('\u030D') || nfd.includes('\u0308') || /\|/.test(s) || /[a-z]+̍/i.test(s)) {
    return getToneInfoByNumber(8);
  }
  // Tone 9: double acute \u030B
  if (nfd.includes('\u030B')) {
    return getToneInfoByNumber(9);
  }
  // Tone 2: acute \u0301 (á, é, í, ó, ú, ḿ, ńg)
  if (nfd.includes('\u0301')) {
    return getToneInfoByNumber(2);
  }
  // Tone 3: grave \u0300 (à, è, ì, ò, ù)
  if (nfd.includes('\u0300')) {
    return getToneInfoByNumber(3);
  }
  // Tone 5: circumflex \u0302 (â, ê, î, ô, û)
  if (nfd.includes('\u0302')) {
    return getToneInfoByNumber(5);
  }
  // Tone 7: macron \u0304 (ā, ē, ī, ō, ū, m̄, n̄g)
  if (nfd.includes('\u0304')) {
    return getToneInfoByNumber(7);
  }

  // 3. No diacritic: check coda (ends with p, t, k, h)
  const cleanAlpha = s.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (/[ptkh]$/.test(cleanAlpha)) {
    return getToneInfoByNumber(4);
  }

  // If contains English letters, default unchecked tone is Tone 1 (陰平)
  if (/[a-zA-Z]/.test(s)) {
    return getToneInfoByNumber(1);
  }

  return null;
}

function getToneInfoByNumber(num: number): TaigiToneInfo {
  switch (num) {
    case 1:
      return { toneNumber: 1, superscript: '¹', contour: '55', symbol: '˥', name: '陰平' };
    case 2:
      return { toneNumber: 2, superscript: '²', contour: '51', symbol: '˥˩', name: '陰上' };
    case 3:
      return { toneNumber: 3, superscript: '³', contour: '21', symbol: '˨˩', name: '陰去' };
    case 4:
      return { toneNumber: 4, superscript: '⁴', contour: '32', symbol: '˨', name: '陰入' };
    case 5:
      return { toneNumber: 5, superscript: '⁵', contour: '24', symbol: '˨˦', name: '陽平' };
    case 6:
      return { toneNumber: 6, superscript: '⁶', contour: '22', symbol: '˨', name: '陽上' };
    case 7:
      return { toneNumber: 7, superscript: '⁷', contour: '33', symbol: '˧', name: '陽去' };
    case 8:
      return { toneNumber: 8, superscript: '⁸', contour: '4', symbol: '˦', name: '陽入' };
    case 9:
      return { toneNumber: 9, superscript: '⁹', contour: '55', symbol: '˥', name: '高平' };
    default:
      return { toneNumber: num, superscript: `${num}`, contour: '', symbol: '', name: `聲調${num}` };
  }
}

export interface DiatonicChordOption {
  chord: string;
  degree: string;
  label: string;
  colorClass: string;
}

/**
 * Generate diatonic chords for any key signature (I, ii, iii, IV, V, vi, vii°, V7)
 */
export function getDiatonicChords(key: KeySignature): DiatonicChordOption[] {
  const flatKeys: KeySignature[] = ['F', 'Bb', 'Eb', 'Ab', 'Db'];
  const preferFlats = flatKeys.includes(key);

  const getRootName = (semitone: number): string => {
    const mod = ((semitone % 12) + 12) % 12;
    if (preferFlats) {
      const flatMap: Record<number, string> = {
        0: 'C', 1: 'Db', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F',
        6: 'Gb', 7: 'G', 8: 'Ab', 9: 'A', 10: 'Bb', 11: 'B'
      };
      return flatMap[mod];
    } else {
      const sharpMap: Record<number, string> = {
        0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E', 5: 'F',
        6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'A#', 11: 'B'
      };
      return sharpMap[mod];
    }
  };

  const base = KEY_SEMITONES[key] ?? 0;

  return [
    {
      chord: getRootName(base),
      degree: 'I',
      label: '主和弦 (Tonic)',
      colorClass: 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    },
    {
      chord: `${getRootName(base + 2)}m`,
      degree: 'ii',
      label: '二級小 (Supertonic)',
      colorClass: 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    },
    {
      chord: `${getRootName(base + 4)}m`,
      degree: 'iii',
      label: '三級小 (Mediant)',
      colorClass: 'bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-900 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700',
    },
    {
      chord: getRootName(base + 5),
      degree: 'IV',
      label: '下屬和弦 (Subdominant)',
      colorClass: 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    },
    {
      chord: getRootName(base + 7),
      degree: 'V',
      label: '屬和弦 (Dominant)',
      colorClass: 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-950/60 dark:hover:bg-orange-900/60 text-orange-900 dark:text-orange-300 border-orange-300 dark:border-orange-700',
    },
    {
      chord: `${getRootName(base + 9)}m`,
      degree: 'vi',
      label: '下中音小 (Submediant)',
      colorClass: 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700',
    },
    {
      chord: `${getRootName(base + 7)}7`,
      degree: 'V7',
      label: '屬七和弦 (Dominant 7th)',
      colorClass: 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-700',
    },
  ];
}
