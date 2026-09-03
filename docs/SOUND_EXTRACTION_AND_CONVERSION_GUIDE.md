# Sound Extraction & Conversion Guide (聲音擷取與轉換工程指南)

> **Document Version:** 1.0.0  
> **Target Audience:** Audio Engineers, Music Transcribers, Full-stack Developers, Taiwanese Hokkien (Taigi) Linguists  
> **Scope:** Complete methodology, architecture, and practical workflows for audio extraction, acoustic analysis, pitch transcription to Jianpu (Numbered Musical Notation), Web Audio synthesis, multimodal score recognition, and lessons learned from production implementations.

---

## 目錄 (Table of Contents)
1. [系統全貌與架構設計 (System Architecture & Overview)](#1-系統全貌與架構設計)
2. [聲音轉樂譜核心流程 (Audio-to-Score Extraction Pipeline)](#2-聲音轉樂譜核心流程)
   - 2.1 人聲與伴奏音軌分離 (Vocal Stems Separation)
   - 2.2 單音旋律與基頻追蹤 (F0 Pitch Detection)
   - 2.3 節拍量化與小節對齊 (Beat Quantization & Meter Alignment)
   - 2.4 調性判定與五聲音階映射 (Key & Pentatonic Scale Recognition)
   - 2.5 台語語音辨識與歌詞斷詞 (Taigi ASR & Syllable Alignment)
3. [樂譜圖片多模態辨識 (Multimodal Sheet Music OCR to Jianpu)](#3-樂譜圖片多模態辨識)
   - 3.1 提示詞工程與資料結構規範
   - 3.2 多頁樂譜拼接與小節序號重整
4. [前端聲音合成與音訊引擎 (Web Audio Synthesis Engine)](#4-前端聲音合成與音訊引擎)
   - 4.1 輕量零依賴振盪器合成架構
   - 4.2 五大樂器聲音物理模擬配方 (DSP Signal Chains)
   - 4.3 自動和弦伴奏演算法 (Harmonic Backing Generator)
   - 4.4 節拍器與時間對齊
5. [實戰經驗與踩坑記錄 (Previous Experiences & Critical Lessons Learned)](#5-實戰經驗與踩坑記錄)
   - 5.1 標點符號與非演奏元素污染問題 (The Punctuation Bug)
   - 5.2 圓滑線與台語一字多音 (Melisma & Slur / Tied Notes)
   - 5.3 iOS Safari / 行動裝置 Web Audio 限制與待機省電
   - 5.4 Lookahead 時間排程與 UI 同步防卡頓
   - 5.5 小節拍數校準與自動修復 (Measure Integrity Normalization)
6. [實戰轉換腳本與操作手冊 (Practical Tooling & Step-by-Step Recipes)](#6-實戰轉換腳本與操作手冊)
   - 6.1 配方 A: 音訊檔案 (MP3/WAV) 轉簡譜 JSON
   - 6.2 配方 B: 簡譜 JSON 離線渲染匯出 WAV 音訊
   - 6.3 配方 C: 簡譜轉 MIDI 檔案規格
7. [檔案格式規範 (Data Schema Reference)](#7-檔案格式規範)

---

## 1. 系統全貌與架構設計

本專案致力於台語經典歌曲與簡譜（Jianpu / 記譜法）的數位化創作、卡拉OK伴奏、羅馬字歌詞對齊（POJ 白話字 / TL 臺羅拼音）與聲音合成。

```
                               ┌────────────────────────────────┐
                               │       原始音訊 (Audio File)      │
                               │     (MP3 / WAV / KTV Track)    │
                               └───────────────┬────────────────┘
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │  音軌分離 (Vocal Separation)    │
                               │ (Demucs / Spleeter / UVR5)     │
                               └───────┬────────────────┬───────┘
                                       │                │
                        [純人聲音軌]    │                │  [伴奏音軌]
                                       ▼                ▼
                     ┌───────────────────┐    ┌───────────────────┐
                     │ 基頻追蹤 (F0 Track)│    │ 和弦偵測 (Chord)   │
                     │ (Basic Pitch/CREPE)│    │ (Madmom/Librosa)  │
                     └─────────┬─────────┘    └─────────┬─────────┘
                               │                        │
                               ▼                        ▼
                     ┌───────────────────┐              │
                     │ 台語歌詞 ASR 對齊  │              │
                     │ (Whisper + Gemini)│              │
                     └─────────┬─────────┘              │
                               │                        │
                               └───────────┬────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │ 簡譜資料結構 (Song JSON)│
                               │ Measures, Notes, Lyrics│
                               └───────────┬────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             ┌─────────────────────┐               ┌─────────────────────┐
             │ 樂譜編輯器 / 卡拉OK  │               │ Web Audio 合成引擎  │
             │   (Next.js / React) │ ────────────> │ (Piano, Flute, etc.)│
             └─────────────────────┘               └─────────────────────┘
```

### 核心音階與頻率轉換公式
簡譜採用首調唱名法（Movable-Do），音符記為 `1`（Do）、`2`（Re）、`3`（Mi）、`4`（Fa）、`5`（Sol）、`6`（La）、`7`（Ti）、`0`（休止符）。

在以十二平均律（$A_4 = 440\,\text{Hz}$）為基準的音訊系統中，由調號（Key Signature）與簡譜唱名計算絕對頻率之數學關係如下：

$$f = 440 \times 2^{\frac{\text{semitones} - 69}{12}}$$

其中 MIDI 音高編號計算為：
$$\text{MIDI} = \text{KeyBaseMidi} + \text{ScaleInterval}[\text{pitch}] + (\text{octave} \times 12) + \text{accidentalOffset} + \text{transpose}$$

各調基礎根音（KeyBaseMidi，以第 4 八度為基準）：
- $C_4 = 60$, $D_4 = 62$, $E_4 = 64$, $F_4 = 65$, $G_4 = 67$, $A_4 = 69$, $B_4 = 71$
- 降號調：$\text{Db}_4 = 61$, $\text{Eb}_4 = 63$, $\text{Ab}_4 = 68$, $\text{Bb}_4 = 70$
- 升號調：$\text{F\#}_4 = 66$

---

## 2. 聲音轉樂譜核心流程 (Audio-to-Score Extraction Pipeline)

若需將既有台語歌曲（例如鄧麗君版《雨夜花》或江蕙版《望春風》錄音）轉錄為本系統支援之數位簡譜，建議遵循以下五階段標準流程：

### 2.1 人聲與伴奏音軌分離 (Vocal Stems Separation)
- **問題**：若直接對全頻帶混音（Full Mix）做音高偵測，鼓聲、重低音與吉他掃弦會造成嚴重的泛音干擾與誤判。
- **最佳實踐**：
  1. 使用 **Demucs v4 (Hybrid Transformer)** 或 **UVR5 (Ultimate Vocal Remover)** 將音訊拆分為：
     - `vocals.wav`（主旋律人聲音軌）
     - `no_vocals.wav` / `accompaniment.wav`（純伴奏音軌）
  2. 命令列範例（使用 Demucs）：
     ```bash
     demucs --two-stems=vocals -n htdemucs_ft "input_song.mp3"
     ```

### 2.2 單音旋律與基頻追蹤 (F0 Pitch Detection)
- **工具選擇**：
  - **Spotify Basic Pitch**（輕量神經網路，具備音符起始點 Onset 偵測與時長估計）
  - **torchcrepe (CREPE)**（基於卷積神經網路的高精度基頻估算）
- **轉換步驟**：
  1. 輸入切除殘響後的 `vocals.wav`。
  2. 設定人聲音高範圍限制（台語女聲一般落在 $130\,\text{Hz} \sim 880\,\text{Hz}$，即 $C_3 \sim A_5$；男聲約 $80\,\text{Hz} \sim 500\,\text{Hz}$）。
  3. 產出連續音高曲率（Pitch Contour）並切分為離散 Note Events（Start Time, End Time, Pitch in Hz）。

### 2.3 節拍量化與小節對齊 (Beat Quantization & Meter Alignment)
- **拍速（BPM）與拍號（Meter）判定**：
  - 多數傳統台語民謠為 **$2/4$ 拍**（如《雨夜花》每小節 2 拍，重-輕節奏）或 **$4/4$ 拍**（如《望春風》慢板 4 拍）。
  - 使用 Librosa 提取節拍網格（Beat Grid）：
    ```python
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    ```
- **音符時長量化階梯（Quantization Grid）**：
  - 將連續秒數對齊至音樂時值分母：
    - 全音符 $= 4.0$ 拍
    - 二分音符 $= 2.0$ 拍
    - 四分音符 $= 1.0$ 拍
    - 八分音符 $= 0.5$ 拍
    - 十六分音符 $= 0.25$ 拍
    - 三十二分音符 $= 0.125$ 拍
  - 避免產生非標準長度（如 0.33 拍），強制對齊至最近的 $1/8$ 或 $1/16$ 拍。

### 2.4 調性判定與五聲音階映射 (Key & Pentatonic Scale Recognition)
- **台語傳統歌謠特性**：
  - 絕大多數位在**中國傳統五聲音階**（宮、商、角、徵、羽，即簡譜 $1, 2, 3, 5, 6$）或六聲音階。
  - 《雨夜花》為標準**羽調式**（主音為 $6$ 或 $1$，降B大調/G小調系統），罕見出現 $4$（Fa）與 $7$（Ti），若偵測演算法頻繁產出 $4$ 或 $7$，通常為人聲轉音或抖音（Vibrato）誤判，需做五聲化平滑濾波（Pentatonic Snapping）。
- **調性統計檢測法**：
  - 收集全曲所有音高累計時長，建立 12 音級 Pitch Class Profile (PCP)。
  - 與 12 種 Key Signature 進行相關性運算，選取匹配係數最高者（如 $1=\text{Bb}$）。

### 2.5 台語語音辨識與歌詞斷詞 (Taigi ASR & Syllable Alignment)
- **音節對齊原則**：
  - 台語屬於單音節語素文字（Monosyllabic），一個漢字對應一個音節（Syllable）及一組羅馬字（POJ/TL）。
  - 使用 Whisper 配合臺灣閩南語聲調字典，辨識歌詞文本。
  - 將歌詞音節依照時間戳記（Word-level Timestamps）與各小節音符一對一配對。

---

## 3. 樂譜圖片多模態辨識 (Multimodal Sheet Music OCR to Jianpu)

本專案實作了以 Gemini 3.7 多模態視覺神經網路（`gemini-3.7-flash` 與 `gemini-3.7-flash-lite`）為核心的簡譜影像辨識系統（`lib/geminiService.ts`）。

### 3.1 提示詞工程核心重點 (Prompting Architecture)
1. **強制輸出嚴格 JSON 格式**：避免任何自然語言前綴或 Markdown 雜訊，使用 `responseMimeType: 'application/json'`。
2. **思維預算配置 (Thinking Config)**：
   - 簡譜記號細微（高低音點、減時線、附點），建議開啟 `thinkingLevel: 'HIGH'` 或 `thinkingBudget: 8192`，讓模型逐步推理小節拍數總和。
3. **音符屬性精確規範**：
   - `pitch`: $1 \sim 7$ 為唱名音高，$0$ 為休止符，`'empty'` 為無發音空位（文字/排版占位）。
   - `octave`: $0$ 為中音，$1$ 為高音（上加一點），$-1$ 為低音（下加一點）。
   - `duration`: 以四分音符為 $1.0$ 拍，八分音符（下一橫線）為 $0.5$ 拍，十六分音符（下二橫線）為 $0.25$ 拍，二分音符（後加一橫）為 $2.0$ 拍。

### 3.2 多頁樂譜拼接與小節序號重整
- **支援頁數**：最多 3 頁連貫辨識。
- **跨頁銜接常見問題**：
  - 第二頁開頭的模型常重新從小節 1 開始計數。
  - 解決方案：系統於後處理端透過 `measures.forEach((m, idx) => m.measureNumber = idx + 1)` 進行全域時序重新排序，避免跳號或號碼衝突。

---

## 4. 前端聲音合成與音訊引擎 (Web Audio Synthesis Engine)

本專案在 `lib/audioEngine.ts` 中設計了兼具**高保真度**、**零外裝依賴**、**低延遲**且**行動裝置高省電**的 Web Audio API 合成器。

### 4.1 輕量零依賴振盪器合成架構
傳統 Web 音樂播放器常載入高達 30MB~80MB 的 SoundFont（SF2）音色取樣檔，容易造成載入遲緩、記憶體消耗過大與行動裝置爆音問題。

本引擎採用**物理聲學合成法（Additive + Subtractive Synthesis + DSP Filter Envelopes）**，僅以 Web Audio 原生節點建構五種獨特音色：

```
[Oscillator 1] ──┐
                 ├──> [BiquadFilter] ──> [ADSR GainNode] ──> [Track Gain] ──> [Master Gain] ──> [AudioContext.destination]
[Oscillator 2] ──┘
```

### 4.2 五大樂器聲音物理模擬配方 (DSP Signal Chains)

#### 1. 鋼琴 (Piano)
- **聲學特徵**：三角波主震盪器提供基頻木質敲擊感，輔以 2 倍頻正弦波（Sub-Oscillator）強化泛音共鳴，極短起音（Attack: 12ms），自然指數釋放（Decay）。
- **信號鏈配方**：
  ```typescript
  // 主震盪器：三角波
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, startTime);

  // 泛音副震盪器：2 倍頻正弦波
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(freq * 2, startTime);
  subGain.gain.setValueAtTime(0.3, startTime);
  subGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.7);

  // 音量封包：快擊軟退
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(0.8, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.95);
  ```

#### 2. 台語竹笛 / 簫 (Flute / Xiao)
- **聲學特徵**：傳統台灣歌仔戲與老歌必備管樂。純淨正弦波為底，加上 5.5Hz 微弱顫音（Vibrato LFO），並串聯 3 倍頻三角波模擬竹管吹孔的沙沙氣流聲（Breathy Overtones）。
- **信號鏈配方**：
  ```typescript
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  // 5.5 Hz 顫音 LFO
  lfo.frequency.setValueAtTime(5.5, startTime);
  lfoGain.gain.setValueAtTime(freq * 0.015, startTime);
  lfo.connect(osc.frequency);

  // 氣流泛音：3 倍頻三角波
  overtone.type = 'triangle';
  overtone.frequency.setValueAtTime(freq * 3, startTime);
  overtoneGain.gain.setValueAtTime(0.08, startTime);

  // 氣鳴柔和起音（Attack: 60ms）
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(0.7, startTime + 0.06);
  gain.gain.setValueAtTime(0.65, startTime + duration * 0.8);
  gain.gain.linearRampToValueAtTime(0.0001, startTime + duration);
  ```

#### 3. 尼龍民謠吉他 (Acoustic Nylon Guitar)
- **聲學特徵**：鋸齒波產生豐富諧波，透過低通濾波器（Lowpass Filter）進行頻率衰減動態掃描（從 $4 \times \text{freq}$ 驟降至 $1.2 \times \text{freq}$），模擬指彈撥弦瞬間的亮色隨琴身吸音而迅速溫暖暗沉。
- **信號鏈配方**：
  ```typescript
  osc.type = 'sawtooth';
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 4, startTime);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.2, startTime + duration * 0.6);
  ```

#### 4. 復古 KTV 合成音色 (80s/90s KTV Synth Lead / FM Brass)
- **聲學特徵**：台灣 1980~1990 年代台語卡拉OK伴奏帶常見之合成器音色。固定截止頻率 1600Hz 配合共振峰值 $Q=3.0$ 的二階低通濾波，呈現標誌性的穿透力與懷舊復古電子感。
- **信號鏈配方**：
  ```typescript
  osc.type = 'sawtooth';
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1600, startTime);
  filter.Q.setValueAtTime(3.0, startTime);
  ```

#### 5. 鐘琴 / 音樂盒 (Bell / Glockenspiel)
- **聲學特徵**：正弦波基頻搭配非整數倍頻比率（$2.756 \times \text{freq}$），精確重現金屬打擊樂器的非諧波碰撞聲（Inharmonic clangorous partials）。

### 4.3 自動和弦伴奏演算法 (Harmonic Backing Generator)
- 根據小節設定之和弦記號（如 `Bb`, `F7`, `Gm`, `Dm`, `Eb`），透過 `getChordNotes()` 動態解析各和弦組成音。
- **微琶音效果（Staggered Strumming）**：
  - 每個和弦音符依序微幅推遲 15ms（`idx * 0.015s`），消除多音同時發聲的冰冷數位感。
  - 第一拍（Downbeat）根音強化為鋸齒波並賦予較高動態音量，其餘各拍則為三角波輕柔分解伴奏。

### 4.4 節拍器與時間對齊
- 節拍器使用高頻率短波：
  - 第一拍（Downbeat）：1200Hz 正弦波，持續 40ms。
  - 其餘拍：800Hz 正弦波，持續 30ms。
- 與主旋律及和弦共享精確音訊時間戳記（AudioContext Time），杜絕使用 `setInterval` 帶來的幾十毫秒時鐘抖動。

---

## 5. 實戰經驗與踩坑記錄 (Previous Experiences & Critical Lessons Learned)

本節彙整專案自開發以來，在實際處理台語歌曲《雨夜花》、《望春風》及 AI 識譜時遭遇的重大核心陷阱與標準解決方案：

### 5.1 標點符號與非演奏元素污染問題 (The Punctuation Bug)
- **症狀**：
  - 歌詞中的破折號（`—`）、逗號（`，`）、句號（`。`）、換行符（`\n`）若直接被填入音符的 `lyric.hanji`，常被當作有效歌詞音節。
  - 當使用者點擊卡拉OK播放或高亮跟唱時，游標會卡在逗號上，甚至觸發多餘的發音事件。
  - 舊版《雨夜花》第 1、2、7、11、15 小節出現了將「—」與「，」作為獨立音符的嚴重瑕疵。
- **核心解決架構**：
  1. **非發音記號隔離 (Non-Notation Isolation)**：
     ```typescript
     export function isPunctuationOrSpacer(text: string): boolean {
       return /^[，。、；：！？—…～\-_~↵\s]+$/.test(text);
     }
     export function isNonNotationItem(note: JianpuNote): boolean {
       if (note.pitch === 'empty' || (typeof note.duration === 'number' && note.duration <= 0)) return true;
       const hanji = note.lyric?.hanji || '';
       return isPunctuationOrSpacer(hanji);
     }
     ```
  2. **音訊播放守門員**：
     - 在 `playTone` 與 `audioEngine.scheduleSong()` 中強制檢查：
       ```typescript
       if (isNonNotationItem(note)) return; // 絕不對標點符號發出聲音
       ```
  3. **資料庫升級快取清理 (Storage Cache Migration)**：
     - 瀏覽器 `localStorage` 若快取了舊版含標點符號的樂譜，必須在 `storage.ts` 加入版本校驗及主動替換邏輯，檢測到包含 `范炎燁` 或 `—` 即刷新為乾淨的新版預設曲。

### 5.2 圓滑線與台語一字多音 (Melisma & Slur / Tied Notes)
- **文化與音樂特徵**：
  - 台語傳統歌曲注重「轉音」（哭腔、依韻入樂）。同一個漢字常橫跨多個音符（如《雨夜花》中的「花」，唱名從 $3 \rightarrow 2 \rightarrow 1 \rightarrow 6 \rightarrow 5$ 連續延伸）。
- **正確處理規則**：
  - 首個起音音符填入歌詞漢字與羅馬字（`hanji: "花", poj: "hoe", pij: "hue"`）。
  - 後續延伸之轉音音符將 `isTied` 設為 `true`，其 `lyric` 物件留空 `{}` 或標記空字串。
  - **嚴禁**在後續延伸音符填入重複漢字、破折號或逗號，否則卡拉OK滾動條會發生文字跳動。

### 5.3 iOS Safari / 行動裝置 Web Audio 限制與待機省電
- **挑戰**：
  - iOS Safari 與多數行動瀏覽器在使用者點擊螢幕前，強制將 `AudioContext.state` 鎖定為 `suspended`。
  - 若在背景常態開啟 `AudioContext`，會霸佔硬體 DSP 晶片，造成手機發燙並大幅耗電。
- **解決方案**：
  1. **使用者手勢解鎖**：在任何播放或預聽按鈕的事件中優先呼叫 `await ctx.resume()`。
  2. **自動待機休眠機制 (Idle Auto-Suspend)**：
     - 當最後一個音符播放完畢，啟動 30 秒倒數計時器。若無後續操作，主動執行 `ctx.suspend()` 讓音訊晶片進入休眠省電模式。
  3. **頁面可見性偵測 (Page Visibility API)**：
     - 當使用者切換分頁或鎖定螢幕（`document.hidden === true`），且當前未在播放音樂時，立即 suspend 音訊上下文。

### 5.4 Lookahead 時間排程與 UI 同步防卡頓
- **問題**：若直接在 `requestAnimationFrame` 中觸發 `audioCtx.currentTime` 發聲，只要主執行緒發生 10ms 的 React 重新渲染卡頓，音樂就會破音或跳拍。
- **雙時鐘排程模型 (Lookahead Scheduler)**：
  - **音訊執行緒**：在播放開始時，預先將未來 80ms（Lookahead Buffer）的音符排程進 Web Audio 的硬體時鐘（`osc.start(startTime + offset)`）。
  - **動畫執行緒**：UI 介面（卡拉OK游標、滾動條）透過比對 `ctx.currentTime - startAudioTime` 取得毫秒級進度，將視覺更新降頻（支援 30fps 或省電 20fps），即使 UI 稍微掉幀，聲音依舊保持 100% 絕對平滑無雜音。

### 5.5 小節拍數校準與自動修復 (Measure Integrity Normalization)
- **問題**：人工鍵入或 AI 識譜常出現小節拍數不匹配（例如 $2/4$ 拍小節總時值卻只有 1.75 拍或多出 2.5 拍）。
- **解決方案**：在 `lib/taigiUtils.ts` 中建立 `normalizeSongDurations()`：
  - 自動累計小節內所有有效音符的時值總和。
  - 若不足一小節，自動在小節末尾補足休止符（Rest note `0`）；若超出，標記告警或合理壓縮附點時值，維持時序對稱。

---

## 6. 實戰轉換腳本與操作手冊 (Practical Tooling & Step-by-Step Recipes)

### 6.1 配方 A: 音訊檔案 (MP3/WAV) 轉簡譜 JSON

若您有實體錄音檔案，可透過以下 Python 腳本（使用 Basic Pitch 與 Librosa）將錄音轉換為本專案相容之 JSON 格式：

```python
#!/usr/bin/env python3
"""
audio_to_taigi_jianpu.py
將純旋律音訊轉為本專案支援之簡譜 JSON 基礎結構
依賴: pip install basic-pitch librosa numpy
"""

import json
import numpy as np
import librosa
from basic_pitch.inference import predict
from basic_pitch import ICASSP_2022_MODEL_PATH

def hz_to_midi(hz):
    return 69 + 12 * np.log2(hz / 440.0)

def midi_to_jianpu(midi_num, key_root_midi=70): # 預設 Bb4 = 70 (雨夜花調性)
    # 半音階到大調音階唱名映射 (0:Do, 2:Re, 4:Mi, 5:Fa, 7:Sol, 9:La, 11:Ti)
    scale_map = {0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7}
    diff = int(round(midi_num)) - key_root_midi
    octave = diff // 12
    semitone = diff % 12
    
    # 簡化就近吸附至大調音階
    closest = min(scale_map.keys(), key=lambda k: abs(k - semitone))
    pitch = scale_map[closest]
    return pitch, octave

def convert_audio_to_song_json(audio_path, song_title="轉換歌曲", bpm=72, key="Bb"):
    # 1. 預測音符事件
    model_output, midi_data, note_events = predict(audio_path)
    
    measures = []
    current_notes = []
    current_measure_beats = 0.0
    beats_per_measure = 2.0  # 2/4 拍
    sec_per_beat = 60.0 / bpm
    
    m_idx = 1
    for start_t, end_t, pitch_hz, amp, _ in note_events:
        duration_sec = end_t - start_t
        duration_beats = round((duration_sec / sec_per_beat) * 2) / 2 # 量化至 0.5 拍
        if duration_beats <= 0:
            duration_beats = 0.5
            
        midi_pitch = hz_to_midi(pitch_hz)
        pitch_num, octave_offset = midi_to_jianpu(midi_pitch)
        
        note_obj = {
            "id": f"n_{m_idx}_{len(current_notes)+1}",
            "pitch": pitch_num,
            "octave": octave_offset,
            "duration": duration_beats,
            "lyric": {"hanji": "", "poj": "", "pij": "", "custom": ""}
        }
        
        current_notes.append(note_obj)
        current_measure_beats += duration_beats
        
        if current_measure_beats >= beats_per_measure:
            measures.append({
                "id": f"m_{m_idx}",
                "measureNumber": m_idx,
                "notes": current_notes
            })
            current_notes = []
            current_measure_beats = 0.0
            m_idx += 1
            
    if current_notes:
        measures.append({
            "id": f"m_{m_idx}",
            "measureNumber": m_idx,
            "notes": current_notes
        })
        
    song_json = {
        "id": f"audio-extracted-{int(librosa.get_duration(path=audio_path))}",
        "title": song_title,
        "key": key,
        "timeSignature": "2/4",
        "bpm": bpm,
        "notesPerLine": 4,
        "measures": measures
    }
    
    return song_json

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        result = convert_audio_to_song_json(sys.argv[1])
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("Usage: python audio_to_taigi_jianpu.py input_melody.wav")
```

---

### 6.2 配方 B: 簡譜 JSON 離線渲染匯出 WAV 音訊

利用瀏覽器環境中的 `OfflineAudioContext`，可以在免連網、無伺服器後端的情況下，以數百倍速直接將簡譜曲目渲染為無損 WAV 檔案：

```typescript
/**
 * 離線快速將 Song 渲染為立體聲 WAV Blob
 */
export async function renderSongToWavBlob(song: Song): Promise<Blob> {
  const sampleRate = 44100;
  const secPerBeat = 60 / song.bpm;
  let totalBeats = 0;
  song.measures.forEach((m) => {
    m.notes.forEach((n) => {
      if (n.pitch !== 'empty' && n.duration > 0) {
        totalBeats += n.duration;
      }
    });
  });

  const totalDurationSec = totalBeats * secPerBeat + 1.5; // 保留 1.5s 殘響衰減
  const offlineCtx = new OfflineAudioContext(2, sampleRate * totalDurationSec, sampleRate);

  let currentBeat = 0;
  song.measures.forEach((m) => {
    m.notes.forEach((n) => {
      if (n.pitch !== 'empty' && n.duration > 0 && n.pitch !== 0) {
        const startTime = currentBeat * secPerBeat;
        const freq = getPitchFrequency(song.key, n.pitch, n.octave, n.accidental, 0);

        // 建立音符合成信號鏈
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.7, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + n.duration * secPerBeat * 0.95);

        osc.connect(gain);
        gain.connect(offlineCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + n.duration * secPerBeat);
      }
      currentBeat += n.duration;
    });
  });

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(renderedBuffer);
}

// 輔助函式：將 AudioBuffer 編碼為標準 16-bit PCM WAV
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // 寫入交錯音訊資料 (Interleaved PCM)
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
```

---

### 6.3 配方 C: 簡譜轉 MIDI 檔案規格

將簡譜輸出為標準 MIDI Format 1 檔案，可直接匯入 GarageBand、Cubase、Logic Pro 或 Sibelius 做專業編曲：

| 欄位 | 映射規則 |
| :--- | :--- |
| **Track 0 (Conductor)** | Tempo Meta Event (`FF 51 03`, 設定微秒/四分音符)，Time Signature (`FF 58 04 02 02 18 08` 代表 2/4 拍)。 |
| **Track 1 (Melody)** | Note-On / Note-Off 事件，MIDI 通道 1，音色程式（Program Change 0: Acoustic Grand Piano 或 73: Flute）。 |
| **Track 2 (Chords)** | 依小節伴奏音符輸出，MIDI 通道 2（Program Change 24: Acoustic Guitar (Nylon)）。 |
| **Track 3 (Lyrics)** | 歌詞 Meta Event (`FF 05 <len> <text>`)，填寫 POJ / TL 羅馬字以便於國際 DAW 顯示。 |

---

## 7. 檔案格式規範 (Data Schema Reference)

本專案之全曲資料庫儲存規格（TypeScript 型別宣告詳見 `types/song.ts`）：

```typescript
export interface Song {
  id: string;              // 唯一代碼，例如 "u-ia-hoe"
  title: string;           // 歌曲主標題，例如 "雨夜花 (Hō͘-iā-hoe)"
  subtitle?: string;        // 副標題 / 詞曲演唱註釋
  composer?: string;        // 作曲者
  lyricist?: string;        // 作詞者
  key: KeySignature;       // 調號 ('C'|'Db'|'D'|'Eb'|'E'|'F'|'F#'|'G'|'Ab'|'A'|'Bb'|'B')
  timeSignature: TimeSignature; // 拍號 ('2/4'|'3/4'|'4/4'|'6/8')
  bpm: number;             // 每分鐘節拍速度 (40 - 240)
  notesPerLine?: number;   // 介面每行顯示小節數 (預設 4)
  description?: string;    // 歌曲賞析與典故說明
  measures: Measure[];     // 小節陣列
}

export interface Measure {
  id: string;              // 小節識別代碼
  measureNumber: number;   // 小節號碼 (1, 2, 3...)
  chord?: string;          // 小節和弦 (例如 "Bb", "F7", "Gm")
  section?: string;        // 段落標記 (例如 "Verse 1", "Chorus")
  notes: JianpuNote[];     // 音符集合 (該小節時值總和必須符合拍號)
  barlineType?: 'single' | 'double' | 'end' | 'repeat_start' | 'repeat_end';
  isLineBreak?: boolean;   // 是否強制排版換行
}

export interface JianpuNote {
  id: string;              // 音符代碼
  pitch: PitchNumber;      // 1-7 (唱名), 0 (休止符), 'empty' (排版空位/標點)
  octave: number;          // -2 (下加兩點) 到 +2 (上加兩點)
  accidental?: '' | '#' | 'b'; // 臨時升降記號
  duration: NoteDuration;  // 時值 (1 = 四分音符, 0.5 = 八分音符, 2 = 二分音符)
  isDotted?: boolean;      // 是否為附點音符
  isTied?: boolean;        // 是否有連結線 / 圓滑線至下一個音
  lyric: {
    hanji?: string;        // 漢字 (例如 "雨")
    poj?: string;          // 白話字 (例如 "Hō͘")
    pij?: string;          // 臺羅拼音 (例如 "Hōo")
    custom?: string;       // 漢羅或自訂字
  };
  annotation?: string;     // 演奏表情記號 (如 "漸慢", "V", "rit.")
}
```

---

## 8. 結論與未來演進方向

本指南記錄了自傳統台語老歌採譜至現代瀏覽器互動呈現的完整音訊轉換鏈。在未來的迭代中，建議擴充：
1. **WebAssembly (WASM) Basic Pitch 核心**：將 Python 版音高提取移植為純前端 WASM，達成使用者直接在瀏覽器拖入錄音即可自動產出簡譜。
2. **微音程台語裝飾音合成 (Pitch Bend Envelopes)**：台語民謠中獨特的「溜音」、「拋音」可透過 Web Audio API 之 `osc.frequency.linearRampToValueAtTime` 進行細膩的連續音高平滑滑動，大幅提升合成歌聲的擬真度。
