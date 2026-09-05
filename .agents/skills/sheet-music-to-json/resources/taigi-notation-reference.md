# Taigi Jianpu & Song Notation Reference

This guide provides transcription and encoding guidelines for converting physical sheet music (Jianpu 簡譜 or standard staff notation) into the digital representation supported by this application.

---

## 1. Numbered Musical Notation (Jianpu 簡譜) Basics

### Scale Degrees & Pitch
| Notation | Scale Degree | Solfège | App `pitch` Value |
| :--- | :--- | :--- | :--- |
| **1** | Tonic | Do | `1` |
| **2** | Supertonic | Re | `2` |
| **3** | Mediant | Mi | `3` |
| **4** | Subdominant | Fa | `4` |
| **5** | Dominant | Sol | `5` |
| **6** | Submediant | La | `6` |
| **7** | Leading Tone | Ti / Si | `7` |
| **0** | Rest (休止符) | Silence | `0` |
| **— / ␣** | Spacer / Punctuation | Non-sounding | `'empty'` (duration `0`) |

### Octave Dots
- **Middle Register (中音)**: Plain number `1`, `2`, `3` $\rightarrow$ `octave: 0`
- **High Register (高音)**: Single dot above $\dot{1}$, $\dot{5}$ $\rightarrow$ `octave: 1`
- **Double High Register (倍高音)**: Double dot above $\ddot{1}$ $\rightarrow$ `octave: 2`
- **Low Register (低音)**: Single dot below $\d{5}$, $\d{6}$ $\rightarrow$ `octave: -1`
- **Double Low Register (倍低音)**: Double dot below $\d{\d{5}}$ $\rightarrow$ `octave: -2`

### Rhythm & Durations (Quarter Note = 1 Beat)
| Printed Symbol | Duration Name | Beats Value | Note Properties |
| :--- | :--- | :--- | :--- |
| `5 - - -` | Whole note (全音符) | **4.0** | `{ duration: 4 }` |
| `5 - -` | Dotted half note (附點二分音符) | **3.0** | `{ duration: 3, isDotted: true }` |
| `5 -` | Half note (二分音符) | **2.0** | `{ duration: 2 }` |
| `5·` | Dotted quarter note (附點四分音符) | **1.5** | `{ duration: 1.5, isDotted: true }` |
| `5` | Quarter note (四分音符) | **1.0** | `{ duration: 1 }` |
| `5̲·` (1 underline + dot) | Dotted 8th note (附點八分音符) | **0.75** | `{ duration: 0.75, isDotted: true }` |
| `5̲` (1 underline) | 8th note (八分音符) | **0.5** | `{ duration: 0.5 }` |
| `5̳` (2 underlines) | 16th note (十六分音符) | **0.25** | `{ duration: 0.25 }` |
| `5̲̳̲` (3 underlines) | 32nd note (三十二分音符) | **0.125** | `{ duration: 0.125 }` |
| `┌ 3 ┐` (triplet bracket) | 8th note triplet (三連音) | **0.333** | `{ duration: 0.333, isTriplet: true }` |

---

## 2. Key Signatures (調號) & Transposition

In Jianpu, key signatures appear as `1 = C`, `1 = F`, `1 = G`, etc.

The application supports:
`C`, `Db`, `D`, `Eb`, `E`, `F`, `F#`, `G`, `Ab`, `A`, `Bb`, `B`.

Mappings for enharmonics:
- `1 = C#` $\rightarrow$ `Db`
- `1 = D#` $\rightarrow$ `Eb`
- `1 = F#` or `1 = Gb` $\rightarrow$ `F#`
- `1 = G#` $\rightarrow$ `Ab`
- `1 = A#` $\rightarrow$ `Bb`

---

## 3. Taiwanese Hokkien Lyrics (Taigi 歌詞)

Each note with a sung syllable holds a `lyric` object:
```json
"lyric": {
  "hanlo": "獨",
  "poj": "To̍k"
}
```

- **`hanlo` (漢羅)**: Traditional Chinese characters (漢字) or mixed Han-lo (e.g., "阮ê", "看無", "心酸酸").
- **`poj` (白話字 / Pe̍h-ōe-jī)**: Church Romanization with proper tone diacritics:
  - 1st tone: `a`, `e`, `i`, `o`, `o͘`, `u`
  - 2nd tone (high falling): `á`, `é`, `í`, `ó`, `ó͘`, `ú`
  - 3rd tone (low falling): `à`, `è`, `ì`, `ò`, `ò͘`, `ù`
  - 4th tone (entering): `ap`, `at`, `ak`, `ah`
  - 5th tone (low rising): `â`, `ê`, `î`, `ô`, `ô͘`, `û`
  - 7th tone (mid level): `ā`, `ē`, `ī`, `ō`, `ō͘`, `ū`
  - 8th tone (high entering): `a̍p`, `a̍t`, `a̍k`, `a̍h`
  - Nasalization: indicated by superscript `ⁿ` or `nn` (e.g. `chhun-hong`, `phōaⁿ`).

---

## 4. Ties vs. Slurs

- **Tie (`tieToNext: true`)**:
  - Connects two consecutive notes of the **same pitch**.
  - In audio playback, the pitch is held continuously without re-triggering the envelope.
  - The second note should have an empty lyric `{}`.
- **Slur (`slurToNext: true`)**:
  - Connects notes across **different pitches** for vocal phrasing (melisma / 轉音 / 拖腔).
  - Melisma continuation notes also usually have an empty lyric `{}` or a dash/continuation line.

---

## 5. Measure Rhythm Integrity Check

For any measure:
$$\sum \text{Note Durations} = \text{Expected Beats for Time Signature}$$

- In **4/4**: Total duration per measure must equal **4 beats**.
- In **3/4**: Total duration per measure must equal **3 beats**.
- In **2/4**: Total duration per measure must equal **2 beats**.
- In **6/8**: Total duration per measure must equal **3 beats** (in dotted-quarter groupings).

Notes with `pitch: "empty"` or `duration: 0` are spacers and do not contribute to measure beat sums.
