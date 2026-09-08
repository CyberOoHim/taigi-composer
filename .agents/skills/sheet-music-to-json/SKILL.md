---
name: "sheet-music-to-json"
description: >
  Converts musical scores and notations from Text-based Numbered Notation (簡譜)
  with lyrics (.txt, .md), Standard MIDI files (.mid, .midi), scanned sheet music
  images (PNG, JPG, WEBP), and PDF documents into the standardized Song JSON format
  qualified for direct import into the Taigi Composer / Karaoke application.
---

# Sheet Music & Score to JSON Conversion Skill

This skill enables agents and automated workflows to take musical scores from diverse input formats—including **text-based numbered notation with lyrics**, **standard MIDI files**, **scanned sheet images**, and **multi-page PDF documents**—and convert them into 100% compliant Song JSON for instant playback, rehearsal, karaoke stage rendering, and interactive editing in the Taigi Composer app.

---

## 1. Quick Start

### Supported Input Modalities
1. **Visual Sheet Music (Scanned Images & Multi-Page PDFs)**:
   - Formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.pdf`
   - **Direct Agent Multimodal Handling**: The Antigravity Agent inspects the images/PDF directly using its native `view_file` tool and transcribes the score into Song JSON adhering strictly to `schema.json`. Zero external API calls or API keys are required.
2. **Text-Based Numbered Notation with Lyrics (`.txt`, `.md`, `--text`, `stdin`)**:
   - **Canonical App Text Format**: Deterministic, offline, zero-cost parser (`convert-sheet.mjs`).
   - **Freeform / Markdown Notation**: Direct Agent handling without external API calls.
3. **Standard MIDI Files (`.mid`, `.midi`)**:
   - Deterministic offline extraction of note pitches, scale degrees (1–7), note durations, rests, tempo, time signature, markers, and embedded lyrics via `convert-sheet.mjs`.
   - Direct Agent lyric enrichment: The Agent directly adds authentic Taiwanese Pe̍h-ōe-jī (POJ) tone diacritics to lyrics without external API calls.

### CLI Usage Examples
```bash
# 1. Text-based numbered notation with lyrics (canonical format):
node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs score.txt -o my_song.taigi.json

# Piped text from standard input:
cat score.txt | node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs - -o my_song.taigi.json

# Direct command-line text string:
node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs --text "Title: 望春風\nKey: F\n[Measure 1]\nNumbered Notation: 5 6 1 2\n漢羅: 獨 夜 無 伴"

# 2. Standard MIDI file conversion:
node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs track.mid --auto-fix-rhythm -o song.taigi.json

# 3. Sanitize and balance draft Song JSON (e.g. created by Agent transcription):
node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs draft.json --auto-fix-rhythm -o final.taigi.json

# 4. Validate output against the app schema and import test:
node .agents/skills/sheet-music-to-json/scripts/validate-song-json.mjs ./final.taigi.json
```

---

## 2. Input Formats & Grammar

### A. Text-Based Numbered Notation Format (Recommended)
This human-readable text format can be edited in any text editor and parses deterministically without requiring an API key:

```text
Title: 望春風
Subtitle: Bāng Chhun-hong
Composer: 鄧雨賢
Lyricist: 李臨秋
Key: F
Time: 4/4
BPM: 80

[Measure 1] (Verse 1) Chord: F
Numbered Notation: 5_ 6_ 1 2_ 3_
羅馬字: To̍k iā bô phōaⁿ siú
漢羅: 獨 夜 無 伴 守

[Measure 2] Chord: F
Numbered Notation: 3- 2_ 1_
羅馬字: teng — ē
漢羅: 燈 — 下
```

**Notation Syntax**:
- `1` to `7`: Scale degrees (Do, Re, Mi, Fa, Sol, La, Ti).
- `0`: Rest (休止符).
- `.` or `'` suffix: Octave up (e.g. `1.` or `1'` = high Do).
- `,` suffix: Octave down (e.g. `5,` = low Sol).
- `_` suffix: 8th note (half beat).
- `__` suffix: 16th note (quarter beat).
- `-` suffix: Sustained beat extender (`1-` = 2 beats, `1--` = 3 beats, `1---` = 4 beats).
- `*` or `d` suffix: Dotted note (+50% duration, e.g. `5_*` = dotted 8th note).

### B. Standard MIDI Files (.mid)
The parser extracts:
- Track events, tempos (Set Tempo meta events), and time signatures.
- Channel 0..15 note events; computes scale degree relative to the song's key.
- Converts gap intervals between notes into explicit rest notes (`pitch: 0`).
- Captures track lyrics (meta 0x05) and markers (meta 0x06) and pairs them with notes.
- Use `--auto-fix-rhythm` to automatically pad any incomplete measure with rest notes.

### C. Visual Scores (Images & PDF) - Direct Agent Handling
The Antigravity Agent inspects sheet music files directly without calling any external APIs:
1. **View Image or PDF**: The agent invokes `view_file` on the score image (`.png`, `.jpg`, `.webp`) or `.pdf`.
2. **Decode Notation Elements**:
   - Header: title, subtitle, composer, lyricist, key signature (e.g. `1=F`), time signature (`4/4`, `3/4`), tempo (BPM).
   - Systems & Measures: barlines, measure numbers, chords above numbers (`F`, `C7`, `Dm`), section markers (`前奏`, `主歌`, `副歌`).
   - Notes: scale degree pitches (`1` to `7`), rests (`0`), octave dots (above: `1, 2`, below: `-1, -2`), durations (`4`, `2`, `1`, `0.5`, `0.25`), dots, ties, and slurs.
   - Taiwanese Hokkien Lyrics: aligns each syllable to its note, transcribing traditional characters into `hanlo` and authentic Church Romanization with tone marks into `poj`.
3. **Format to Song JSON**: Emits compliant Song JSON matching the schema below.
4. **Sanitize & Validate**: The agent runs `validate-song-json.mjs` (and optionally `convert-sheet.mjs --auto-fix-rhythm` to balance measure beats).

---

## 3. The Target Song JSON Schema

The application requires a JSON file adhering to the `Song` interface (`types/song.ts`):

```typescript
export interface Song {
  id: string;               // Unique song id (e.g. "song-1718000000000")
  title: string;            // Song title (e.g. "望春風")
  subtitle?: string;         // Subtitle (e.g. "Bāng Chhun-hong")
  composer?: string;        // Composer (e.g. "鄧雨賢")
  lyricist?: string;        // Lyricist (e.g. "李臨秋")
  key: KeySignature;        // 'C' | 'Db' | 'D' | 'Eb' | 'E' | 'F' | 'F#' | 'G' | 'Ab' | 'A' | 'Bb' | 'B'
  timeSignature: TimeSignature; // '4/4' | '3/4' | '2/4' | '6/8'
  bpm: number;              // Tempo (default: 80)
  notesPerLine?: number;    // Measures per row (default: 4)
  description?: string;     // Notes, history, provenance
  measures: Measure[];      // Chronological array of measures
}
```

### Measure Structure
```typescript
export interface Measure {
  id: string;               // e.g. "m-1-abc"
  measureNumber: number;    // 1-based sequential index (1, 2, 3...)
  chord?: string;           // Harmonic chord (e.g. "F", "C7", "Am", "Dm", "Bb")
  chords?: string[];        // Multiple chords array
  section?: string;         // Section tag (e.g. "前奏", "主歌", "副歌", "尾奏", "Verse 1")
  barlineType?: 'single' | 'double' | 'end' | 'repeat_start' | 'repeat_end';
  isLineBreak?: boolean;    // Line/system break flag
  notes: NumberedNotationNote[];      // Notes in this measure
}
```

### Numbered Notation Note Structure
```typescript
export interface NumberedNotationNote {
  id: string;               // Unique note id (e.g. "n-1-1")
  pitch: PitchNumber;       // 1-7 (scale degrees), 0 (rest), or 'empty' (spacer/pause)
  octave: number;           // -2 (double low), -1 (low), 0 (middle), 1 (high), 2 (double high)
  accidental?: '' | '#' | 'b';
  duration: number;         // In beats: 4 (whole), 2 (half), 1 (quarter), 0.5 (8th), 0.25 (16th)
  isDotted?: boolean;       // Display dot (+50% duration)
  isDoubleDotted?: boolean; // Display double dot (+75% duration)
  tieToNext?: boolean;      // Sustained tie to next note of identical pitch
  slurToNext?: boolean;     // Legato slur to next note across differing pitches
  preGraceNotes?: GraceNote[];  // Optional pre-grace decorative notes
  postGraceNotes?: GraceNote[]; // Optional post-grace notes
  articulation?: 'none' | 'staccato' | 'tenuto' | 'accent' | 'fermata';
  annotation?: string;      // Direction (e.g. "rit.", "合唱", "V")
  lyric: {
    hanlo?: string;         // Traditional Hanji or mixed Han-lo (e.g. "獨", "阮ê")
    poj?: string;           // Pe̍h-ōe-jī with tone marks (e.g. "To̍k", "gún ê")
  };
}
```

---

## 4. Transcription Rules for Numbered Notation & Taiwanese Hokkien Music

### A. Numbered Notation (簡譜) Mapping
- `1` = Do, `2` = Re, `3` = Mi, `4` = Fa, `5` = Sol, `6` = La, `7` = Ti.
- `0` = Rest (休止符). Rests do not have lyrics (`lyric: {}`).
- `octave: 0` = Middle octave (numbers with no dots).
- `octave: 1` = High octave ($\dot{1}, \dot{5}$ - dot above).
- `octave: -1` = Low octave ($\d{5}, \d{6}$ - dot below).

### B. Duration Conversions (Quarter Note = 1 Beat)
- `5 - - -` $\rightarrow$ `duration: 4` (Whole note)
- `5 - -` $\rightarrow$ `duration: 3` (Dotted half note)
- `5 -` $\rightarrow$ `duration: 2` (Half note)
- `5·` $\rightarrow$ `duration: 1.5`, `isDotted: true` (Dotted quarter note)
- `5` $\rightarrow$ `duration: 1` (Quarter note)
- `5̲·` $\rightarrow$ `duration: 0.75`, `isDotted: true` (Dotted 8th note)
- `5̲` $\rightarrow$ `duration: 0.5` (8th note, 1 underline)
- `5̳` $\rightarrow$ `duration: 0.25` (16th note, 2 underlines)
- `5̲̳̲` $\rightarrow$ `duration: 0.125` (32nd note, 3 underlines)

### C. Rhythm Balancing (Crucial)
For every measure, sum all sounding note durations:
$$\sum \text{duration} = \text{Expected Beats per Measure}$$
- In `4/4`: 4 beats per measure.
- In `3/4`: 3 beats per measure.
- In `2/4`: 2 beats per measure.
- In `6/8`: 3 beats per measure.

Use `--auto-fix-rhythm` to automatically insert padding rests into any measure that falls short of the expected beats.

### D. Lyrics Extraction (Taigi / Taiwanese Hokkien)
- Transcribe **both** `hanlo` (漢字/漢羅) and `poj` (白話字/Pe̍h-ōe-jī).
- The Agent directly provides both `hanlo` (漢字/漢羅) and accurate `poj` (白話字) with official tone diacritics using its Taiwanese Hokkien linguistic knowledge, without calling external APIs.
- For notes that continue a sustained syllable under a tie or slur, set `lyric: { hanlo: "—", poj: "—" }` or `{}`.

### E. Verse & Phrase Segmentation for Karaoke Readability (Short While Meaningful)

In Karaoke Mode, lyrics are projected in prominent stage typography one active phrase at a time, accompanied by a preview of the upcoming next phrase and real-time bouncing ball tracking.

To deliver an optimal singing and reading experience, **the skill must split verses into short while meaningful musical phrases**:

1. **Target Phrase Length**:
   - **Ideal syllable count**: **4 to 8 sung syllables** per verse (e.g. 5-character 五言 or 7-character 七言 poetic lines in Taiwanese Hokkien songs).
   - **Ideal measure span**: **2 to 4 measures** per phrase.
   - **Anti-Pattern**: NEVER lump an entire multi-sentence stanza (8–16 measures or 15+ syllables) into a single continuous verse.

2. **Natural Phrasing Boundaries**:
   - Split at **syntactic and poetic clauses** (e.g. "獨夜無伴守燈下" is 1 verse; "清風對面吹" is the next verse).
   - Split at **melodic cadences, punctuation marks (，, 。)**, and **breath/rest points**.

3. **Encoding Phrase Breaks in Song JSON**:
   - **Newline on Concluding Syllable**: Append `\n` to the last syllable's `hanlo` and `poj` (e.g. `hanlo: "下\n", poj: "ē\n"`).
   - **Measure Line Break**: Set `"isLineBreak": true` on the measure that concludes the phrase.
   - **Informative Section Headers**: Subdivide sections into distinct phrase labels (e.g. `"section": "主歌 1-A"`, `"section": "主歌 1-B"`).

---

## 5. Workflow: From Score File to In-App Playback

### Workflow A: Visual Sheet Music (Images & PDF) and Freeform Text (Direct Agent Handling)
1. **Step 1 - Inspect**: The Agent inspects the visual score or freeform score directly using `view_file`.
2. **Step 2 - Transcribe**: The Agent decodes key, meter, measures, Numbered Notation pitch numbers, durations, ties/slurs, and bilingual lyrics (Hanlo + POJ tone marks), structuring karaoke phrases.
3. **Step 3 - Write & Balance**: The Agent writes the Song JSON directly, or passes draft JSON through the sanitizer to auto-pad deficit measures:
   ```bash
   node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs draft.json --auto-fix-rhythm -o my-song.taigi.json
   ```
4. **Step 4 - Validate**:
   ```bash
   node .agents/skills/sheet-music-to-json/scripts/validate-song-json.mjs ./my-song.taigi.json
   ```

### Workflow B: Structured Text & Standard MIDI Files (Deterministic Local CLI)
1. **Step 1**: Place your canonical structured text score (`.txt`) or Standard MIDI file (`.mid`) in the workspace.
2. **Step 2**: Run the deterministic conversion script:
   ```bash
   node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs ./track.mid --auto-fix-rhythm -o ./my-song.taigi.json
   ```
3. **Step 3**: Verify with the validator:
   ```bash
   node .agents/skills/sheet-music-to-json/scripts/validate-song-json.mjs ./my-song.taigi.json
   ```

### Step 4: Import into the Application
- In the web app, click **"Library / Import"** in the top navigation bar.
- Switch to the **"Import"** tab.
- Click **"Choose File"** and select `my-song.taigi.json` (or paste its content).
- The song is automatically loaded into the **Interactive Score Editor**, **Virtual Piano Keyboard**, **Rehearsal Stage**, and **Karaoke Prompter**.

---

## 6. Directory Structure of this Skill

```text
.agents/skills/sheet-music-to-json/
├── SKILL.md                          # Main skill documentation
├── scripts/
│   ├── convert-sheet.mjs             # CLI converter (Text, MIDI) & JSON sanitizer/rhythm balancer
│   ├── midi-parser.mjs               # Standard MIDI file parser & scale-degree mapper
│   ├── text-parser.mjs               # Structured text score parser & prompt specification
│   └── validate-song-json.mjs        # Schema, rhythm & karaoke readability validator
├── resources/
│   ├── schema.json                   # Formal Song JSON Schema
│   └── taigi-notation-reference.md   # Music theory, notation & multi-format reference
└── examples/
    ├── sample-output.taigi.json      # Complete, verified example of "望春風"
    ├── sample-numbered-notation.txt  # Human-readable structured text score example
    └── sample-prompt.txt             # Agent transcription reference & prompt specification
```

---

## 7. Troubleshooting & FAQ

- **Q: What if the score is in Western 5-line staff notation rather than Numbered Notation?**
  - The Agent transcribes pitch degrees and key signatures into Numbered Notation representation relative to the detected key. For example, in Key F, note F4 maps to pitch `1`, G4 to `2`, A4 to `3`, Bb4 to `4`, C5 to `5`, etc.
- **Q: What if a PDF has multiple songs?**
  - Extract only the relevant page range before converting, or pass individual page images to avoid combining separate songs into one.
- **Q: Rhythm Warning on pickup measures?**
  - Pickup measures (e.g. 1 beat before measure 1) legitimately contain fewer beats. Tag the measure with `section: "Pickup"` or `section: "前奏"` to indicate an intro/pickup measure.
