import { JianpuNote, KeySignature, Measure, NoteDuration, PitchNumber, Song, TimeSignature } from '@/types/song';

/**
 * Export song to JSON string
 */
export function exportSongToJson(song: Song): string {
  return JSON.stringify(song, null, 2);
}

/**
 * Import song from JSON string
 */
export function importSongFromJson(jsonString: string): Song {
  const parsed = JSON.parse(jsonString);
  if (!parsed.title || !parsed.measures || !Array.isArray(parsed.measures)) {
    throw new Error('Invalid song format: missing title or measures.');
  }
  return {
    id: parsed.id || `song-${Date.now()}`,
    title: parsed.title || 'Untitled Song',
    subtitle: parsed.subtitle || '',
    composer: parsed.composer || '',
    lyricist: parsed.lyricist || '',
    key: (parsed.key as KeySignature) || 'C',
    timeSignature: (parsed.timeSignature as TimeSignature) || '4/4',
    bpm: Number(parsed.bpm) || 80,
    measures: parsed.measures,
    notesPerLine: parsed.notesPerLine || 4,
    description: parsed.description || '',
  };
}

/**
 * Format a single Jianpu note into readable notation string
 * e.g., 5 with octave 1 = 5̇, octave -1 = 5̣, duration 0.5 = 5_, duration 2 = 5 -
 */
export function formatNoteToJianpuString(note: JianpuNote): string {
  let p = note.pitch === 'empty' ? '_' : `${note.pitch}`;
  if (note.accidental && note.pitch !== 'empty') p = `${note.accidental}${p}`;

  // Octave representation
  if (note.pitch !== 'empty') {
    if (note.octave > 0) p = `${p}${'+'.repeat(note.octave)}`;
    if (note.octave < 0) p = `${p}${'-'.repeat(Math.abs(note.octave))}`;
  }

  // Duration representation
  if (note.duration === 0.5) p = `${p}_`;
  else if (note.duration === 0.25) p = `${p}__`;
  else if (note.duration === 1.5) p = `${p}.`;
  else if (note.duration === 2) p = `${p}-`;
  else if (note.duration === 3) p = `${p}--`;
  else if (note.duration === 4) p = `${p}---`;

  return p;
}

/**
 * Export song to Human-Readable Text Format
 */
export function exportSongToText(song: Song): string {
  const lines: string[] = [
    `# Taigi Jianpu Score Format`,
    `Title: ${song.title}`,
    song.subtitle ? `Subtitle: ${song.subtitle}` : '',
    song.composer ? `Composer: ${song.composer}` : '',
    song.lyricist ? `Lyricist: ${song.lyricist}` : '',
    `Key: ${song.key}`,
    `Time: ${song.timeSignature}`,
    `BPM: ${song.bpm}`,
    ``,
  ].filter(Boolean);

  song.measures.forEach((m, idx) => {
    lines.push(`[Measure ${idx + 1}]${m.section ? ` (${m.section})` : ''}${m.chord ? ` Chord: ${m.chord}` : ''}`);

    const jianpuTokens = m.notes.map(n => formatNoteToJianpuString(n));
    const hanjiTokens = m.notes.map(n => n.lyric.hanji || '—');
    const pojTokens = m.notes.map(n => n.lyric.poj || '—');
    const pijTokens = m.notes.map(n => n.lyric.pij || '—');
    const customTokens = m.notes.map(n => n.lyric.custom || '—');

    lines.push(`Jianpu:  ${jianpuTokens.join('  ')}`);
    lines.push(`Hanji:   ${hanjiTokens.join('  ')}`);
    lines.push(`POJ:     ${pojTokens.join('  ')}`);
    lines.push(`PIJ:     ${pijTokens.join('  ')}`);
    lines.push(`Custom:  ${customTokens.join('  ')}`);
    lines.push(``);
  });

  return lines.join('\n');
}

/**
 * Parse text format back into Song
 */
export function importSongFromText(text: string): Song {
  const lines = text.split(/\r?\n/);
  const song: Song = {
    id: `song-${Date.now()}`,
    title: 'Imported Song',
    key: 'C',
    timeSignature: '4/4',
    bpm: 80,
    measures: [],
  };

  let currentMeasure: Partial<Measure> | null = null;
  let measureIndex = 1;

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
    } else if (line.startsWith('Key:')) {
      song.key = (line.replace('Key:', '').trim() as KeySignature) || 'C';
    } else if (line.startsWith('Time:')) {
      song.timeSignature = (line.replace('Time:', '').trim() as TimeSignature) || '4/4';
    } else if (line.startsWith('BPM:')) {
      song.bpm = parseInt(line.replace('BPM:', '').trim(), 10) || 80;
    } else if (line.startsWith('[Measure') || line.startsWith('[Bar') || line.startsWith('[')) {
      if (currentMeasure && currentMeasure.notes && currentMeasure.notes.length > 0) {
        song.measures.push(currentMeasure as Measure);
      }

      const chordMatch = line.match(/Chord:\s*([A-Za-z0-9#b]+)/i);
      const sectionMatch = line.match(/\(([^)]+)\)/);

      currentMeasure = {
        id: `m-${Date.now()}-${measureIndex}`,
        measureNumber: measureIndex++,
        chord: chordMatch ? chordMatch[1] : undefined,
        section: sectionMatch ? sectionMatch[1] : undefined,
        notes: [],
      };
    } else if (currentMeasure) {
      if (line.startsWith('Jianpu:')) {
        const tokens = line.replace('Jianpu:', '').trim().split(/\s+/).filter(Boolean);
        currentMeasure.notes = tokens.map((tok, nIdx) => parseJianpuToken(tok, `${currentMeasure!.id}-n${nIdx}`));
      } else if (line.startsWith('Hanji:') && currentMeasure.notes) {
        const tokens = line.replace('Hanji:', '').trim().split(/\s+/).filter(Boolean);
        tokens.forEach((tok, idx) => {
          if (currentMeasure!.notes![idx]) {
            currentMeasure!.notes![idx].lyric.hanji = tok === '—' ? '' : tok;
          }
        });
      } else if (line.startsWith('POJ:') && currentMeasure.notes) {
        const tokens = line.replace('POJ:', '').trim().split(/\s+/).filter(Boolean);
        tokens.forEach((tok, idx) => {
          if (currentMeasure!.notes![idx]) {
            currentMeasure!.notes![idx].lyric.poj = tok === '—' ? '' : tok;
          }
        });
      } else if (line.startsWith('PIJ:') && currentMeasure.notes) {
        const tokens = line.replace('PIJ:', '').trim().split(/\s+/).filter(Boolean);
        tokens.forEach((tok, idx) => {
          if (currentMeasure!.notes![idx]) {
            currentMeasure!.notes![idx].lyric.pij = tok === '—' ? '' : tok;
          }
        });
      } else if (line.startsWith('Custom:') && currentMeasure.notes) {
        const tokens = line.replace('Custom:', '').trim().split(/\s+/).filter(Boolean);
        tokens.forEach((tok, idx) => {
          if (currentMeasure!.notes![idx]) {
            currentMeasure!.notes![idx].lyric.custom = tok === '—' ? '' : tok;
          }
        });
      }
    }
  }

  if (currentMeasure && currentMeasure.notes && currentMeasure.notes.length > 0) {
    song.measures.push(currentMeasure as Measure);
  }

  if (song.measures.length === 0) {
    throw new Error('No valid measures found in text file.');
  }

  return song;
}

function parseJianpuToken(token: string, id: string): JianpuNote {
  let pitch: PitchNumber = 1;
  let octave = 0;
  let accidental: '' | '#' | 'b' = '';
  let duration: NoteDuration = 1;
  let isDotted = false;

  let clean = token.trim();

  // Accidental
  if (clean.startsWith('#')) {
    accidental = '#';
    clean = clean.substring(1);
  } else if (clean.startsWith('b')) {
    accidental = 'b';
    clean = clean.substring(1);
  }

  // Pitch number (0 to 7) or empty '_' / 'x' / '空'
  if (clean.startsWith('_') || clean.startsWith('空') || clean.startsWith('empty')) {
    pitch = 'empty';
    clean = clean.substring(1);
  } else {
    const pitchMatch = clean.match(/^([0-7])/);
    if (pitchMatch) {
      pitch = parseInt(pitchMatch[1], 10) as PitchNumber;
      clean = clean.substring(1);
    }
  }

  // Octave indicators (+ or - or dots)
  const plusCount = (clean.match(/\+/g) || []).length;
  const minusCount = (clean.match(/-/g) || []).length;
  if (plusCount > 0) octave = plusCount;
  else if (minusCount > 0 && !clean.includes('--')) octave = -minusCount;

  // Duration
  if (clean.includes('___')) duration = 0.125;
  else if (clean.includes('__')) duration = 0.25;
  else if (clean.includes('_')) duration = 0.5;
  else if (clean.includes('---')) duration = 4;
  else if (clean.includes('--')) duration = 3;
  else if (clean.includes('-')) duration = 2;

  if (clean.includes('.')) {
    isDotted = true;
    if (duration === 1) duration = 1.5;
    else if (duration === 0.5) duration = 0.75;
    else if (duration === 2) duration = 3;
  }

  return {
    id,
    pitch,
    octave,
    accidental,
    duration,
    isDotted,
    lyric: {},
  };
}
