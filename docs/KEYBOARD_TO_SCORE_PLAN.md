# Technical Feasibility Study & Implementation Plan: "Keyboard-to-Score" Real-Time Screen Piano & Musical Typing Transcription

## 1. Executive Summary

This document establishes the comprehensive technical feasibility study, mathematical algorithms, architectural blueprint, and staged execution roadmap for **"Keyboard-to-Score" (螢幕鋼琴彈奏即時轉譜 / 琴鍵入譜與節拍量化)** within the Taigi Numbered Notation (簡譜) Composer.

Building upon and extending the existing **"Hum-to-Score" (哼唱記譜)** system, this module allows composers and learners to perform melodies freely on an on-screen multi-touch piano keyboard (or computer QWERTY keyboard / external USB Web MIDI controller) accompanied by an interactive metronome, and have their live performance automatically transcribed into precise, beat-quantized numbered notation measures (`1, 2, 3, 5, 6`, rests `0`, dots, and cross-barline ties).

### Core Feasibility Verdict: **Exceptionally High Feasibility & Precision (100% Deterministic Pitch Accuracy)**
- **Zero Pitch Drift & Zero Acoustic Distortion:** Unlike acoustic microphone recording (which requires complex DSP pitch tracking, YIN algorithms, harmonic suppression, and bandpass noise filtering), keyboard touch/key events deliver **100% deterministic pitch accuracy** with exact MIDI note numbers, scale degrees, and accidental identities.
- **Client-Side, Microsecond-Precision Timing:** Utilizes high-resolution browser performance timing (`performance.now()`) to measure exact keydown/keyup durations, velocity, and inter-note pause durations with $< 1\text{ms}$ jitter.
- **Direct Reuse of Quantization & Barline Engine:** Inherits and extends the battle-tested `lib/pitch/scoreQuantizer.ts` pipeline, including beat-grid snapping (quarter ♩, eighth ♪, sixteenth 𝅘𝅥𝅯, triplets), key signature diatonic degree mapping, and automatic cross-measure tie splitting (`tieToNext: true`).
- **Unified Creative Suite:** Can function both as a dedicated recording modal (`KeyboardToScoreModal`) and as a live "Record Mode" directly on the persistent `PianoKeyboard.tsx` canvas.

---

## 2. Synergies & Architectural Comparison: Hum-to-Score vs. Keyboard-to-Score

| Feature Dimension | 🎙️ Hum-to-Score (哼唱記譜) | 🎹 Keyboard-to-Score (鍵盤彈奏記譜) | Architectural Synergy / Shared Logic |
| :--- | :--- | :--- | :--- |
| **Input Source** | Microphone analog audio via Web Audio `MediaStreamAudioSourceNode` | Multi-touch screen piano, QWERTY typing, or Web MIDI `MIDIMessageEvent` | Decoupled front-end input adapters emitting identical `RawNoteSegment[]` streams. |
| **Pitch Detection** | YIN Algorithm ($d'_t(\tau)$ CMNDF calculation, sub-bin interpolation, median filtering) | **Direct Mathematical Mapping** (Exact Scale Degree $1\dots 7$, Octave $-2\dots +2$, Semitones) | Direct conversion to `NumberedPitchInfo` via existing `midiToNumberedPitch`. |
| **Onset / Note Boundary** | RMS energy differential ($\Delta \text{RMS}$) and spectral flux attack transient detection | **Hardware Event Triggers:** `pointerdown` / `touchstart` / `keydown` for note start; `pointerup` / `touchend` / `keyup` for note release | Perfect note start/end boundaries without microphone noise or breath turbulence. |
| **Silence / Rest Handling** | RMS below noise floor threshold (-42dB) | **Inter-Note Gap Calculation:** If $(t_{\text{down}}^{(i+1)} - t_{\text{up}}^{(i)}) > \theta_{\text{rest}}$, generate a rest segment (`isRest: true`, `midi: null`) | Both feed cleanly into `cleanRawSegments()` and `autoFillTrailingRests()`. |
| **Beat Quantization** | Quantizes raw duration in milliseconds to beats based on `song.bpm` and selected grid | Identical tempo-aware beat quantizer (`quantizeDurationToBeats`) | **100% Shared:** Reuses `QuantizeGrid` ('quarter', 'eighth', 'sixteenth', 'thirtysecond') and human tempo jitter tolerance. |
| **Measure Barline Packing** | Barline overflow split with ties (`tieToNext: true`) conforming to time signature | Identical barline packaging (`segmentNotesIntoMeasures`) | **100% Shared:** Reuses 4/4, 3/4, 2/4, 6/8 measure packing, trailing rest auto-fill, and barline numbering. |
| **Playback & Verification** | Dual-track player (recorded microphone audio vs. synthesized score preview) | Dual-mode player (live performance timestamp replay vs. quantized score synth playback) | Reuses `AudioEngine` synthesizer with selectable instrument timbers (Piano, Flute, Cello, Guitar, Synth). |

---

## 3. Input Modalities & Multi-Device Handling

The Keyboard-to-Score subsystem supports three distinct input modalities to ensure optimal usability across phones, tablets, laptops, and desktop workstations:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             INPUT MODALITIES                                │
├───────────────────────────────┬───────────────────────────────┬─────────────┤
│ 1. Multi-Touch Screen Piano   │ 2. QWERTY Musical Typing      │ 3. Web MIDI │
│ (iPad, Mobile, Touch Monitors)│ (Laptops, Desktop Workstations│ (Hardware)  │
└───────────────┬───────────────┴───────────────┬───────────────┴──────┬──────┘
                │                               │                      │
                ▼                               ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED KEY EVENT ADAPTER LAYER                          │
│ - pointerdown / pointerup      - e.repeat suppression         - 0x90 NoteOn │
│ - touch-action: none           - DAW-standard key mapping     - 0x80 NoteOff│
│ - multi-finger touch tracking  - Octave switch shortcuts      - Velocity    │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   MONOPHONIC / POLYPHONIC STREAM ENGINE                     │
│ - Precise timestamps via performance.now()                                  │
│ - Legato overlap resolver (auto-truncates preceding note if monophonic)     │
│ - Inter-note rest detector (generates rest segment for pauses)              │
│ - Emits standard RawNoteSegment[] { startTimeMs, endTimeMs, durationMs, ...}│
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SCORE QUANTIZER (lib/pitch/)                           │
│ - quantizeDurationToBeats() with tempo grid snapping (♩, ♪, 𝅘𝅥𝅯, triplets)    │
│ - segmentNotesIntoMeasures() with cross-barline tie handling (tieToNext)    │
│ - Key signature alignment (1=C, 1=D, 1=F, 1=G, etc.) & Octave Dots          │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMMIT TO COMPOSER SCORE                            │
│ - Insert at cursor / Replace measure / Append to song                       │
│ - Full Undo/Redo compatibility with useSongHistory                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Mode A: On-Screen Multi-Touch Piano Keyboard
- **Responsive Layout:** Adaptive key width for iPhone (1 octave visible + octave switcher), iPad/Tablet (2 octaves: Low + Mid or Mid + High), and Desktop (3 full octaves).
- **Pointer Event Management:**
  - Uses `PointerEvent` (`onPointerDown`, `onPointerUp`, `onPointerCancel`, `onPointerLeave`) with `setPointerCapture` where applicable to prevent missed releases when fingers slide across keys.
  - CSS `touch-action: manipulation` and `user-select: none` prevent viewport scrolling, double-tap zoom, and selection halos during fast performances.
- **Glissando & Sliding Support:** Tracks pointer movements across keys, correctly releasing the previous key and initiating the next key on boundary crossing.

### 3.2. Mode B: Computer QWERTY Musical Typing (DAW Standard)
Allows desktop and laptop users to type melodies naturally without taking their hands off the keyboard.
- **Diatonic White Keys (Middle Octave):**
  - `A` $\to$ 1 (Do), `S` $\to$ 2 (Re), `D` $\to$ 3 (Mi), `F` $\to$ 4 (Fa), `G` $\to$ 5 (Sol), `H` $\to$ 6 (La), `J` $\to$ 7 (Ti), `K` $\to$ 1̇ (High Do).
- **Chromatic Black Keys (Accidentals):**
  - `W` $\to$ ♯1 / ♭2, `E` $\to$ ♯2 / ♭3, `T` $\to$ ♯4 / ♭5, `Y` $\to$ ♯5 / ♭6, `U` $\to$ ♯6 / ♭7.
- **Auxiliary Controls:**
  - `Z` / `X`: Octave down / Octave up shift ($\pm 1$).
  - `Spacebar`: Tap for intentional musical rest (0) or hold for sustain.
  - `Backspace`: Delete last performed note.
  - `e.repeat` Guard: Blocks operating system auto-repeat key events so a held key is not erroneously chopped into a machine-gun stutter.

### 3.3. Mode C: Web MIDI Hardware Keyboard Integration
- Connects directly to external USB/Bluetooth MIDI keyboards (Casio, Yamaha, Roland, Novation, Akai) via the native browser `navigator.requestMIDIAccess()` API.
- Zero audio input lag; captures velocity dynamics (soft vs. loud keystrokes) and standard `0x90` (Note On) / `0x80` (Note Off) messages.

---

## 4. Key Technical Challenges & Algorithmic Solutions

### 4.1. Legato Overlap vs. Monophonic Melody Resolution
- **The Problem:** Natural human piano playing is rarely strictly detached (staccato). When playing legato, the player often presses the next key $20\text{ms}–80\text{ms}$ before fully lifting their previous finger. In a monophonic numbered notation melody, this momentary polyphony would cause colliding notes or rhythmic confusion.
- **The Solution: Intelligent Monophonic Prioritization Filter**
  - When keydown $K_{i+1}$ arrives at timestamp $t_{\text{down}}^{(i+1)}$ while previous key $K_i$ is still held:
    1. Instantly truncate $K_i$'s end timestamp to $t_{\text{up}}^{(i)} = t_{\text{down}}^{(i+1)}$.
    2. Commit $K_i$ into the segment queue.
    3. Start $K_{i+1}$ immediately at $t_{\text{down}}^{(i+1)}$.
  - When keyup $K_i$ subsequently fires late, ignore it since $K_i$ has already been resolved.

### 4.2. Rest Gap Detection & Thresholding
- **The Problem:** How to distinguish between an intentional rest (休止符 `0`) and the natural brief micro-silence (release transient) between two notes.
- **The Solution: Adaptive Silence Gate**
  - Compute inter-note silence $\Delta t_{\text{gap}} = t_{\text{down}}^{(i+1)} - t_{\text{up}}^{(i)}$.
  - If $\Delta t_{\text{gap}} < \theta_{\text{articulation}}$ (e.g. $< 75\text{ms}$ at 80 BPM, or $< 20\%$ of a sixteenth note beat):
    - Treat as note separation articulation; extend the duration of $K_i$ up to $t_{\text{down}}^{(i+1)}$ for a continuous musical line.
  - If $\Delta t_{\text{gap}} \ge \theta_{\text{articulation}}$:
    - Generate a discrete Rest Segment (`isRest: true`, `midi: null`, `durationMs: \Delta t_{\text{gap}}`).

### 4.3. Beat Grid Quantization & Swing Tolerance
Using the active song's tempo (`song.bpm`) and time signature (`song.timeSignature`):
1. Compute the millisecond duration of one quarter-note beat:
   $$T_{\text{beat}} = \frac{60000}{\text{BPM}} \text{ ms}$$
2. Convert raw duration in milliseconds to fractional beats:
   $$\text{rawBeats} = \frac{\text{durationMs}}{T_{\text{beat}}}$$
3. Snap to the selected `QuantizeGrid`:
   - **Quarter note (四分音符 / 1.0 beat)**
   - **Eighth note (八分音符 / 0.5 beat)** (Default)
   - **Sixteenth note (十六分音符 / 0.25 beat)**
   - **Triplets (三連音 / 0.333, 0.667 beats)**
4. Automatically recognize dotted values (`1.5` beats for dotted quarter, `0.75` beat for dotted eighth, `3.0` beats for dotted half).

### 4.4. Barline Splitting & Musical Ties across Measures
When a held note crosses a measure barline:
- Automatically split the note into two sub-notes:
  - First sub-note fills the remaining beats of the current measure and sets `tieToNext: true`.
  - Second sub-note starts at beat 1 of the next measure with `tieToNext: false`.
- If a note spans across multiple barlines (e.g. holding a note for 6 beats in 4/4 time), cleanly chain ties:
  $$\text{Measure } M: \text{Note (2 beats, tieToNext: true)} \longrightarrow \text{Measure } M+1: \text{Note (4 beats, tieToNext: false)}$$
- If an inter-note silence crosses a barline, divide the rest cleanly across the barline without ties (`tieToNext: false`).

---

## 5. Architectural System Diagram

```
 [User Performance Input]
 ┌──────────────────────────────────────────────────────────────────┐
 │ Screen Piano Touches  │  QWERTY Musical Keys  │  Web MIDI Device │
 └───────────────────────┴───────────────────────┴──────────────────┘
                                  │
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ KeyEventEngine (lib/keyboard/keyEventEngine.ts)                  │
 │ - High-resolution timestamping (performance.now())               │
 │ - Monophonic legato overlap resolution (truncation)              │
 │ - Rest duration calculation between keyup and keydown            │
 │ - Real-time Audio preview playback via audioEngine.previewNote() │
 └────────────────────────────────┬─────────────────────────────────┘
                                  │ emits RawNoteSegment[]
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ ScoreQuantizer (lib/pitch/scoreQuantizer.ts)                     │
 │ - Key Signature Degree Mapping (1=C, 1=F, accidentals #/b)       │
 │ - Grid Quantization (1.0, 0.5, 0.25, dotted, triplets)           │
 │ - Barline Boundary Division & Musical Ties (tieToNext: true)     │
 │ - Trailing measure rest auto-fill                                │
 └────────────────────────────────┬─────────────────────────────────┘
                                  │ produces Measure[] & Notes[]
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ KeyboardToScoreModal UI (components/composer/)                   │
 │ - Dual-view interactive piano bed (3-octave / QWERTY guide)      │
 │ - Metronome count-in (3-2-1-GO) & visual beat pulse indicator    │
 │ - Live scrolling performance roll (active played notes feedback) │
 │ - Transcribed numbered notation preview cards                    │
 │ - Post-recording A/B audio audition (Performance vs Synth)       │
 │ - Dynamic re-quantize (♩ / ♪ / 𝅘𝅥𝅯), octave transpose (±1, ±2)     │
 │ - Commit to Score (Insert at Cursor / Replace / Append)          │
 └────────────────────────────────┬─────────────────────────────────┘
                                  │ commits with Undo/Redo
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ ComposerEditor & useSongHistory                                  │
 │ - Active song measures updated                                   │
 │ - Ctrl+Z / Ctrl+Y history tracking                               │
 └──────────────────────────────────────────────────────────────────┘
```

---

## 6. File & Module Structure

### 6.1. New Core Engine
- **`lib/keyboard/keyEventEngine.ts`**:
  - Encapsulates key state tracking (`activeKeys`, `performanceTimestamps`).
  - Implements monophonic legato arbitration and rest gap calculation.
  - Produces standard `RawNoteSegment[]` compatible with `scoreQuantizer.ts`.
  - Provides QWERTY key mapping tables and Web MIDI event handlers.

### 6.2. Quantizer Extensions (`lib/pitch/scoreQuantizer.ts`)
- The existing `scoreQuantizer.ts` is already built with `transcribeAudioSegmentsToMeasures(segments: RawNoteSegment[], options)`.
- Reuses:
  - `quantizeDurationToBeats`
  - `segmentNotesIntoMeasures`
  - `midiToNumberedPitch`
  - `getExpectedMeasureBeats`
  - `autoFillTrailingRests`
- Enhances:
  - Adds `keyboardMode` flag to optimize quantization for crisp keyboard keystroke attacks (disables acoustic noise floor filtering while preserving beat alignment).

### 6.3. New UI Components
- **`components/composer/KeyboardToScoreModal.tsx`**:
  - Full-featured recording modal containing:
    - Interactive 3-octave piano keyboard with touch and mouse support.
    - Metronome beat visualizer and count-in sequence.
    - QWERTY key label overlay toggle.
    - Real-time live notation roll showing notes as they are played.
    - Transcribed numbered notation score preview with inline note auditioning.
    - Quick fine-tuning toolbar (Re-quantize ♩/♪/𝅘𝅥𝅯, Shift Octave, Accidental Preference).
    - Commit placement options (`cursor`, `replace`, `append`).
- **`components/PianoKeyboard.tsx` Integration**:
  - Optional inline "Live Record" toggle in the persistent piano roll for zero-modal spontaneous composition.

### 6.4. Composer Integration Points
- **`components/ComposerEditor.tsx`**:
  - Add "鍵盤彈奏入譜" (Keyboard-to-Score) button alongside "哼唱入譜" (Hum-to-Score) in the score action toolbar.
  - Wire `handleCommitKeyboardTranscription` through `onUpdateSong` and `useSongHistory` for complete Undo/Redo support.
- **`components/composer/NoteModeView.tsx`**:
  - Add quick-access button to perspective switch bar.
- **`components/composer/NoteEditorHud.tsx`**:
  - Add keyboard performance button to note editing actions.

---

## 7. Detailed UX Workflow

1. **Activation:**
   - User clicks the **"鍵盤彈奏入譜" (Keyboard to Score)** button in Composer mode.
2. **Setup & Configuration:**
   - The modal opens displaying:
     - Active Song Key (e.g. `1 = C` or `1 = F`) and BPM (e.g. `85 BPM`).
     - Metronome Count-in toggle (Default: ON, 4 beats lead-in).
     - Quantization Grid selector: [♩ Quarter] [♪ Eighth (Recommended)] [𝅘𝅥𝅯 Sixteenth].
     - Input Mode Indicators: [📱 Touch Screen] [⌨️ QWERTY Keys] [𝄢 MIDI Controller].
3. **Recording Phase:**
   - User taps **"Start Recording (開始錄音彈奏)"** or presses `Space`.
   - Metronome plays count-in: *Tick, Tok, Tok, Tok*.
   - User plays the melody on the screen piano or computer keyboard.
   - Each key tap plays instantaneous, zero-latency synthesizer audio via `AudioEngine`.
   - The on-screen keys light up with animated ripples; live transcribed numbered notation notes (`1 2 3 5 6`) stream across the live roll in real time.
4. **Review & Fine-Tuning Phase:**
   - User taps **"Finish & Transcribe (完成彈奏轉譜)"** or presses `Enter`.
   - Transcribed numbered notation measures appear in an interactive preview sheet.
   - A dual playback player allows listening to the raw performance timing vs. the quantized synthesizer score.
   - User can adjust quantization grid (e.g. snap 16ths to 8ths if tempo was uneven) or transpose octaves.
5. **Commit Phase:**
   - User chooses insertion target:
     - **Insert at Cursor (當前游標後)**
     - **Replace Current Measure (替換當前小節)**
     - **Append to Song (追加至曲末)**
   - Clicks **"Insert into Score (確定置入樂譜)"**.
   - Score updates immediately with full `Ctrl+Z` Undo capability.

---

## 8. Staged Implementation Roadmap

```
Stage 1: Input Engine & Segment Generator ──► Stage 2: Quantization & Barline Packaging
                    │                                            │
                    ▼                                            ▼
Stage 3: Keyboard-to-Score Modal UI       ──► Stage 4: Web MIDI & Composer Integration
```

| Stage | Focus Area | Deliverables / Verification | Status |
| :--- | :--- | :--- | :---: |
| **Stage 1** | Input Engine & Segment Generator (`lib/keyboard/keyEventEngine.ts`) | Touch/Mouse/QWERTY event tracking, high-res timestamping, monophonic legato overlap resolution, inter-note rest gap detection, automated unit test benchmarks. | ✅ Complete |
| **Stage 2** | Quantization & Barline Packaging Engine | Integration with `lib/pitch/scoreQuantizer.ts`, tempo-aware beat snapping, cross-measure tie splitting, key signature degree transposition, benchmark suite validation. | ✅ Complete |
| **Stage 3** | Keyboard-to-Score Recording Modal UI (`components/composer/KeyboardToScoreModal.tsx`) | Touch piano bed, metronome count-in, QWERTY typing overlays, live notation roll, A/B review audition player, quick fine-tuning bar, responsive layout. | ✅ Complete |
| **Stage 4** | Web MIDI Support & Full Composer Integration | `navigator.requestMIDIAccess()` hardware listener (`lib/keyboard/webMidi.ts`), Score bar button, Note Mode & HUD wiring, `useSongHistory` Undo/Redo integration, end-to-end user verification. | ✅ Complete |

---

### Stage 1: Input Engine & Segment Generator (`lib/keyboard/keyEventEngine.ts`)
- [x] Implement `KeyEventEngine` class managing active notes and timestamp queues using `performance.now()`.
- [x] Implement monophonic legato overlap arbitration (truncates held note upon next key onset).
- [x] Implement silence / rest gap detector converting idle intervals $> 80\text{ms}$ into `RawNoteSegment` rests.
- [x] Implement QWERTY key mapping tables for middle octave diatonic notes (`A-K`) and black accidentals (`W-U`).
- [x] Implement unit test benchmarks in `test/keyboardEngine.test.ts` verifying timing accuracy, legato truncation, and rest generation.

### Stage 2: Quantization & Barline Packaging Engine
- [x] Connect `KeyEventEngine.finalize()` output directly into `transcribeAudioSegmentsToMeasures` in `lib/pitch/scoreQuantizer.ts`.
- [x] Verify quarter, eighth, sixteenth, and triplet beat quantization with simulated human performance jitter ($\pm 30\text{ms}$).
- [x] Verify barline tie splitting (`tieToNext: true`) for sustained notes crossing measure boundaries.
- [x] Test key signature transposition across all 12 keys (Key of C, F, G, D, Bb, etc.) and accidental spelling preferences.

### Stage 3: Keyboard-to-Score Recording Modal UI
- [x] Create `components/composer/KeyboardToScoreModal.tsx` following the visual craftsmanship and layout established in `HumToScoreModal.tsx`.
- [x] Build responsive multi-octave piano keyboard bed with clear numbered notation labels (`1-7`, octave dots) and Solfege subtitles.
- [x] Build metronome audio clicks and visual beat pulse ring using `AudioEngine`.
- [x] Build live scrolling roll rendering notes as the user performs.
- [x] Build dual playback comparison player (original performance vs. quantized synthesizer).
- [x] Implement one-click fine-tuning controls: Re-quantize (♩/♪/𝅘𝅥𝅯), Shift Octaves ($\pm 1, \pm 2$), Accidental Preference (Auto/#/b).

### Stage 4: Web MIDI Support & Composer Integration
- [x] Add optional Web MIDI API controller listener (`navigator.requestMIDIAccess`) in `lib/keyboard/webMidi.ts` for plug-and-play hardware keyboard input.
- [x] Add "鍵盤入譜" button to `ComposerEditor.tsx` persistent score toolbar, `SongMetadataHeader.tsx`, `NoteModeView.tsx` perspective switch bar, `NoteEditorHud.tsx`, and `PianoKeyboard.tsx`.
- [x] Connect commit flow to `onUpdateSong` and `useSongHistory` ensuring seamless `Ctrl+Z` Undo and `Ctrl+Y` Redo.
- [x] Verify full test suite (`bun test`), TypeScript compiler (`tsc --noEmit`), and ESLint validation (`bun run lint`).
