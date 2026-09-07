/**
 * text-parser.mjs
 * 
 * High-performance parser and preprocessor for Text-based Numbered Musical Notation (簡譜)
 * with Taiwanese Hokkien (Taigi) lyrics.
 */

export function isStructuredAppText(text) {
  if (!text || typeof text !== 'string') return false;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const hasMeasureHeader = lines.some(l => /^\[(Measure|Bar)\s*\d+\]/i.test(l));
  const hasNumberedNotation = lines.some(l => /^Numbered [Nn]otation:/i.test(l));
  return hasMeasureHeader || (hasNumberedNotation && lines.some(l => /^Title:/i.test(l)));
}

function parseToken(tok, id) {
  let pitch = 1;
  let octave = 0;
  let accidental = '';
  let duration = 1;
  let isDotted = false;
  let tieToNext = false;
  let slurToNext = false;

  let clean = tok.trim();

  // Annotations [xxx]
  if (clean.startsWith('[') && clean.endsWith(']')) {
    const annot = clean.slice(1, -1).trim();
    return {
      id,
      pitch: 'empty',
      octave: 0,
      accidental: '',
      duration: 0,
      isDotted: false,
      annotation: annot,
      lyric: { hanlo: annot, hanji: annot, poj: '', custom: annot },
    };
  }

  // Spacer / Punctuation
  if (clean === '_' || clean === '↵' || clean === '空' || clean === 'empty' || clean === 'V' || /^[，。！？、；：,.!?]+$/.test(clean)) {
    return {
      id,
      pitch: 'empty',
      octave: 0,
      accidental: '',
      duration: 0,
      isDotted: false,
      lyric: clean === '_' ? {} : { hanlo: clean, hanji: clean, poj: '', custom: clean },
    };
  }

  // Ties & slurs at end
  if (clean.endsWith('~')) {
    tieToNext = true;
    clean = clean.slice(0, -1);
  }
  if (clean.endsWith('^')) {
    slurToNext = true;
    clean = clean.slice(0, -1);
  }

  // Accidental prefix
  if (clean.startsWith('#')) {
    accidental = '#';
    clean = clean.substring(1);
  } else if (clean.startsWith('b')) {
    accidental = 'b';
    clean = clean.substring(1);
  }

  // Empty pitch representation
  if (clean.startsWith('_') || clean.startsWith('空') || clean.startsWith('empty')) {
    return {
      id,
      pitch: 'empty',
      octave: 0,
      accidental: '',
      duration: 0,
      isDotted: false,
      lyric: {},
    };
  }

  // Pitch number (0..7)
  const pitchMatch = clean.match(/^([0-7])/);
  if (pitchMatch) {
    pitch = parseInt(pitchMatch[1], 10);
    clean = clean.substring(1);
  }

  // Octave indicators (+ or ' for octave up, , or - for octave down)
  const plusCount = (clean.match(/[\+']/g) || []).length;
  const commaCount = (clean.match(/,/g) || []).length;
  if (plusCount > 0) {
    octave = Math.min(2, plusCount);
  } else if (commaCount > 0) {
    octave = -Math.min(2, commaCount);
  }

  // Underlines for durations (subdivisions)
  if (clean.includes('___')) duration = 0.125;
  else if (clean.includes('__')) duration = 0.25;
  else if (clean.includes('_')) duration = 0.5;
  else if (clean.includes('---')) duration = 4;
  else if (clean.includes('--')) duration = 3;
  else if (clean.includes('-')) duration = 2;

  // Dotted
  if (clean.includes('.') || clean.includes('·')) {
    isDotted = true;
    if (duration === 1) duration = 1.5;
    else if (duration === 0.5) duration = 0.75;
    else if (duration === 2) duration = 3.0;
  }

  return {
    id,
    pitch,
    octave,
    accidental: accidental || undefined,
    duration,
    isDotted: isDotted || undefined,
    tieToNext: tieToNext || undefined,
    slurToNext: slurToNext || undefined,
    lyric: {},
  };
}

/**
 * Deterministically parse structured app text format into Song JSON
 */
export function parseStructuredTextScore(text, options = {}) {
  const lines = text.split(/\r?\n/);
  const song = {
    id: `song-${Date.now()}`,
    title: options.title || 'Imported Song',
    subtitle: '',
    composer: '',
    lyricist: '',
    key: options.key || 'F',
    timeSignature: options.time || '4/4',
    bpm: options.bpm || 80,
    notesPerLine: 4,
    description: '',
    measures: [],
  };

  let currentMeasure = null;
  let measureIndex = 1;
  let pendingRoman = null;
  let pendingHanlo = null;

  function applyLyrics() {
    if (!currentMeasure || !currentMeasure.notes || currentMeasure.notes.length === 0) return;
    if (pendingRoman) {
      pendingRoman.forEach((tok, idx) => {
        if (currentMeasure.notes[idx]) {
          const val = tok === '—' || tok === '-' ? '' : tok;
          currentMeasure.notes[idx].lyric.poj = val;
        }
      });
    }
    if (pendingHanlo) {
      pendingHanlo.forEach((tok, idx) => {
        if (currentMeasure.notes[idx]) {
          const val = tok === '—' || tok === '-' ? '' : tok;
          currentMeasure.notes[idx].lyric.hanlo = val;
          currentMeasure.notes[idx].lyric.hanji = val;
          currentMeasure.notes[idx].lyric.custom = val;
        }
      });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('Title:')) {
      song.title = line.replace('Title:', '').trim();
    } else if (line.startsWith('Subtitle:')) {
      song.subtitle = line.replace('Subtitle:', '').trim();
    } else if (line.startsWith('Composer:')) {
      song.composer = line.replace('Composer:', '').trim();
    } else if (line.startsWith('Lyricist:')) {
      song.lyricist = line.replace('Lyricist:', '').trim();
    } else if (line.startsWith('Description:')) {
      song.description = line.replace('Description:', '').trim();
    } else if (line.startsWith('Key:')) {
      const k = line.replace('Key:', '').trim();
      if (k) song.key = k;
    } else if (line.startsWith('Time:') || line.startsWith('TimeSignature:')) {
      const t = line.replace(/^(Time:|TimeSignature:)/, '').trim();
      if (t) song.timeSignature = t;
    } else if (line.startsWith('BPM:')) {
      const b = parseInt(line.replace('BPM:', '').trim(), 10);
      if (b > 0) song.bpm = b;
    } else if (line.startsWith('[Measure') || line.startsWith('[Bar') || (line.startsWith('[') && line.includes(']'))) {
      if (currentMeasure && currentMeasure.notes && currentMeasure.notes.length > 0) {
        applyLyrics();
        song.measures.push(currentMeasure);
      }

      pendingRoman = null;
      pendingHanlo = null;

      const chordMatch = line.match(/Chord:\s*([A-Za-z0-9#b\/\s]+)/i);
      const sectionMatch = line.match(/\(([^)]+)\)/);

      currentMeasure = {
        id: `m-${measureIndex}-${Date.now().toString(36)}`,
        measureNumber: measureIndex++,
        chord: chordMatch ? chordMatch[1].trim() : undefined,
        section: sectionMatch ? sectionMatch[1].trim() : undefined,
        notes: [],
      };
    } else if (currentMeasure) {
      if (/^Numbered [Nn]otation:/i.test(line)) {
        const tokens = line.replace(/^Numbered [Nn]otation:/i, '').trim().split(/\s+/).filter(Boolean);
        currentMeasure.notes = tokens.map((tok, nIdx) => parseToken(tok, `${currentMeasure.id}-n${nIdx + 1}`));
        applyLyrics();
      } else if (/^(羅馬字|Roman|POJ|TL):/i.test(line)) {
        pendingRoman = line.replace(/^(羅馬字|Roman|POJ|TL):/i, '').trim().split(/\s+/).filter(Boolean);
        applyLyrics();
      } else if (/^(漢羅|Hanlo|Hanji|Custom|歌詞|Lyrics):/i.test(line)) {
        pendingHanlo = line.replace(/^(漢羅|Hanlo|Hanji|Custom|歌詞|Lyrics):/i, '').trim().split(/\s+/).filter(Boolean);
        applyLyrics();
      }
    }
  }

  if (currentMeasure && currentMeasure.notes && currentMeasure.notes.length > 0) {
    applyLyrics();
    song.measures.push(currentMeasure);
  }

  if (song.measures.length === 0) {
    throw new Error('No valid measures found in text file.');
  }

  return song;
}

/**
 * Generate Gemini prompt for unstructured or freeform text numbered notation with lyrics
 */
export function buildTextTranscriptionPrompt(rawText, options = {}) {
  return `You are an expert Taiwanese Hokkien (Taigi / 臺語) music theorist, Numbered Musical Notation (簡譜) transcriber, and lyric editor.

The user provided the following text-based Numbered Musical Notation and Lyrics:

---
${rawText}
---

Your task is to transcribe this text input into a complete, pristine, and syntactically valid JSON object adhering strictly to the Taigi Song Schema.

### Key Rules & Requirements:
1. **Metadata**:
   - Extract or deduce: \`title\`, \`key\` (e.g. 'F', 'C', 'G', 'Bb', 'D'), \`timeSignature\` ('4/4', '3/4', '2/4', '6/8'), and \`bpm\` (e.g. 80).
   ${options.key ? `- Use forced key: "${options.key}"` : ''}
   ${options.time ? `- Use forced timeSignature: "${options.time}"` : ''}
   ${options.bpm ? `- Use forced bpm: ${options.bpm}` : ''}
   ${options.title ? `- Use forced title: "${options.title}"` : ''}

2. **Measures & Barlines**:
   - Group notes into measures using '|' or measure bounds.
   - Each measure must have sequential \`measureNumber\` starting from 1.
   - Extract chord symbols (e.g. "F", "C7", "Dm", "Bb") into \`measure.chord\`.
   - Extract section markers (e.g. "Verse 1", "Chorus", "前奏") into \`measure.section\`.

3. **Numbered Notation Pitch & Durations**:
   - \`pitch\`: 1 (Do), 2 (Re), 3 (Mi), 4 (Fa), 5 (Sol), 6 (La), 7 (Ti), 0 (Rest).
   - Non-notation spacers or annotations: \`pitch: 'empty'\`, \`duration: 0\`.
   - \`octave\`: 0 for middle octave, 1 for high dot (1̇ or 1'), 2 for double high dot, -1 for low dot (1̣ or 1,), -2 for double low dot.
   - \`duration\` (in quarter note beats):
     - Quarter note: 1.0
     - Half note: 2.0 (e.g. "5 -")
     - Dotted half note: 3.0 (e.g. "5 - -")
     - Whole note: 4.0 (e.g. "5 - - -")
     - Eighth note: 0.5 (single underline "5_")
     - Sixteenth note: 0.25 (double underline "5__")
     - Dotted quarter note: 1.5, with \`isDotted: true\` (e.g. "5.")
     - Dotted eighth note: 0.75, with \`isDotted: true\` (e.g. "5_.")
   - Measure rhythm balance: The sum of note durations in each measure MUST equal the time signature's expected beats (e.g. 4.0 for 4/4). Use rest notes (\`pitch: 0\`) if necessary to balance the measure.

4. **Taigi / Taiwanese Lyrics Alignment**:
   - Align lyrics syllable-by-syllable to each sung note.
   - Every sung note must have:
     \`lyric: { "hanlo": "<Traditional Han Character / Hanlo>", "poj": "<Pe̍h-ōe-jī with tone marks>" }\`
   - If the original text only has Han characters (or only romanization), provide BOTH \`hanlo\` and accurate Pe̍h-ōe-jī (\`poj\`) with official tone diacritics (e.g. "To̍k", "iā", "bô", "phōaⁿ", "siú", "teng").
   - Rest notes (\`pitch: 0\`) have empty lyric: \`lyric: {}\`.

5. **Karaoke Phrase Structuring**:
   - Organize measures so lyrics form natural singing phrases (typically 2 to 4 measures, 4 to 8 syllables).
   - Set \`isLineBreak: true\` on the last measure of each singing phrase to trigger a line break in the karaoke display.

Return ONLY the raw JSON object conforming to the schema.`;
}
