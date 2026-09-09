# Documentation (文件專區)

歡迎查閱本專案之核心架構與工程指南文件：

- **[Keyboard-to-Score Screen Piano & Musical Typing Plan](./KEYBOARD_TO_SCORE_PLAN.md)**
  - Technical feasibility study and implementation plan for real-time on-screen piano keyboard, QWERTY typing, and Web MIDI transcription.
  - 100% deterministic pitch fidelity, high-resolution performance timing (`performance.now()`), and monophonic legato overlap resolution.
  - Direct reuse of `scoreQuantizer.ts` for beat quantization, barline splitting with ties, and 4-stage execution roadmap.
- **[Hum-to-Score Voice & Acoustic Instrument Transcription Plan](./HUM_TO_SCORE_PLAN.md)**
  - Technical feasibility study and implementation roadmap for humming-to-score and acoustic instruments (Bamboo Flute, Erhu, Guitar).
  - Web Audio client-side YIN pitch tracking, onset detection, and beat quantization to numbered notation (簡譜).
  - UX workflow, acoustic preset matrices, and 4-stage delivery plan.
- **[Composer GUI & Workflow Enhancement Plan (作曲介面與流程改進計畫)](./COMPOSER_UX_ENHANCEMENT_PLAN.md)**
  - 現況摩擦診斷（chrome 堆疊、首進 Splits、Space 衝突、空白曲種子、節奏提示）。
  - 漸進式作曲流程：安靜 chrome、空白曲 30 秒路徑、end-of-bar 矩陣、compact HUD。
  - 十個可獨立合併的 PR 順序（hotkeys → chrome → Split 捲動 → HUD → wizard → rhythm → scan → lyric-first）。
- **[Sound Extraction & Conversion Guide (聲音擷取與轉換工程指南)](./SOUND_EXTRACTION_AND_CONVERSION_GUIDE.md)**
  - 聲音轉樂譜核心流程（人聲分離、基頻偵測、節拍量化、五聲音階與台語拼音對齊）。
  - Gemini 多模態 AI 簡譜影像辨識與跨頁拼接機制。
  - Web Audio API 零依賴五大樂器（鋼琴、竹笛、吉他、KTV合成器、鐘琴）物理模擬配方。
  - 實戰經驗與踩坑復盤（標點符號發音隔離、圓滑線轉音、iOS Safari 待機省電與 Lookahead 雙時鐘排程）。
  - 完整 Python 轉換腳本、OfflineAudioContext WAV 離線渲染與 MIDI 匯出規範。
