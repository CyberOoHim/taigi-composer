---
name: "sheet-music-to-json"
description: >
  Converts musical sheets (Jianpu 簡譜 numbered notation or staff notation) from images
  (PNG, JPG, JPEG, WEBP) or PDF documents into the standardized Song JSON format
  compatible with the Taigi Composer / Karaoke application. Use when converting scanned
  scores, lead sheets, or song PDFs into importable song data.
---

# Sheet Music to JSON Conversion Skill

This skill enables agents and automated workflows to take scanned sheet music (in Image or PDF format) and transcribe it into the exact JSON format consumed by this application for playback, rehearsal, karaoke stage rendering, and music composition.

---

## 1. Quick Start

### Running the Conversion Script
You can convert any sheet music file (Image or PDF) directly from the command line:

```bash
# Convert a single image or PDF
node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs ./path/to/score.pdf -o ./my-song.taigi.json

# Convert multi-page images in sequence
node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs page1.png page2.png -o ./song.taigi.json

# Override key, time signature, or tempo
node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs score.jpg --key F --time 4/4 --bpm 84

# Validate an exported song JSON file
node .agents/skills/sheet-music-to-json/scripts/validate-song-json.mjs ./my-song.taigi.json
```

---

## 2. Supported Input Formats

1. **PDF Documents (`.pdf`)**:
   - Single-page or multi-page lead sheets, songbooks, choir arrangements.
   - Sent directly to the vision model with MIME type `application/pdf`.
2. **Images (`.png`, `.jpg`, `.jpeg`, `.webp`)**:
   - High-resolution scans, mobile photos, or screenshot crops.
   - Multiple pages can be passed sequentially (e.g. `page1.png page2.png page3.png`).

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
  notes: JianpuNote[];      // Notes in this measure
}
```

### Jianpu Note Structure
```typescript
export interface JianpuNote {
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

## 4. Transcription Rules for Jianpu & Taiwanese Hokkien Music

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

Pickup measures (弱起小節 / 前奏) can have partial beats.

### D. Lyrics Extraction (Taigi / Taiwanese Hokkien)
- Transcribe **both** `hanlo` (漢字/漢羅) and `poj` (白話字/Pe̍h-ōe-jī).
- If the original sheet music only prints Chinese characters, generate the standard corresponding POJ Romanization with correct tone diacritics.
- For notes that continue a sustained syllable under a tie or slur, set `lyric: { hanlo: "—", poj: "—" }` or `{}`.

---

## 5. Workflow: From Score File to In-App Playback

1. **Step 1**: Place image(s) or PDF file in the workspace (or specify an absolute path).
2. **Step 2**: Run the conversion script:
   ```bash
   node .agents/skills/sheet-music-to-json/scripts/convert-sheet.mjs ./path/to/sheet.pdf -o ./my-song.taigi.json
   ```
3. **Step 3**: Verify with the validator:
   ```bash
   node .agents/skills/sheet-music-to-json/scripts/validate-song-json.mjs ./my-song.taigi.json
   ```
4. **Step 4**: Import into the application:
   - In the web app, click **"Library / Import"** in the top navigation bar.
   - Switch to the **"Import"** tab.
   - Click **"Choose File"** and select `my-song.taigi.json` (or paste its content).
   - The song is automatically loaded into the **Interactive Score Editor**, **Virtual Piano Keyboard**, **Rehearsal Stage**, and **Karaoke Prompter**.

---

## 6. Directory Structure of this Skill

```text
.agents/skills/sheet-music-to-json/
├── SKILL.md                          # This document
├── scripts/
│   ├── convert-sheet.mjs             # CLI converter supporting Images & PDFs
│   └── validate-song-json.mjs        # JSON validator against the app schema
├── resources/
│   ├── schema.json                   # Formal JSON Schema
│   └── taigi-notation-reference.md   # Music theory and Taigi notation guidelines
└── examples/
    ├── sample-output.taigi.json      # Complete, verified example of "望春風"
    └── sample-prompt.txt             # Multimodal prompt template for vision models
```

---

## 7. Troubleshooting & FAQ

- **Q: What if the score is in Western 5-line staff notation rather than Jianpu?**
  - The conversion script instructs the vision model to transcribe pitch degrees and key signatures into Jianpu representation relative to the detected key. For example, in Key F, note F4 maps to pitch `1`, G4 to `2`, A4 to `3`, Bb4 to `4`, C5 to `5`, etc.
- **Q: What if a PDF has multiple songs?**
  - Extract only the relevant page range before converting, or pass individual page images to avoid combining separate songs into one.
- **Q: Rhythm Warning on pickup measures?**
  - Pickup measures (e.g. 1 beat before measure 1) legitimately contain fewer beats. Tag the measure with `section: "Pickup"` or `section: "前奏"` to indicate an intro/pickup measure.
