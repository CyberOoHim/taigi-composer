import { KeySignature, PitchNumber } from '@/types/song';

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
