'use client';

import React, { useState, useEffect } from 'react';
import { LyricSyllable, NoteDuration, Song } from '@/types/song';
import {
  splitTaigiLyricSyllables,
  groupSongIntoVerses,
  isNonNotationItem,
  isPunctuationOrSpacer,
  normalizeSongDurations,
} from '@/lib/taigiUtils';
import {
  convertTaigiLyricsByVersesWithAi,
  convertTaigiLyricsWithAi,
  GeminiModelChoice,
  GeminiThinkingEffort,
} from '@/lib/geminiService';
import {
  isGeminiAuthenticated,
  verifyGeminiPasscode,
  revokeGeminiAuth,
  getActiveGeminiApiKey,
} from '@/lib/geminiAuth';
import {
  AlignLeft,
  Sparkles,
  X,
  Check,
  Loader2,
  Cpu,
  BrainCircuit,
  Key,
  Lock,
  Unlock,
  ShieldCheck,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  LogOut,
  ScanLine,
} from 'lucide-react';

interface QuickLyricAlignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
  onApplyLyrics: (updatedSong: Song) => void;
  onOpenScanner?: () => void;
}

interface VersePreviewItem {
  verseIndex: number;
  verseTitle: string;
  section?: string;
  measureRange: string;
  noteCount: number;
  tokens: LyricSyllable[];
}

export const QuickLyricAlignerModal: React.FC<QuickLyricAlignerModalProps> = ({
  isOpen,
  onClose,
  song,
  onApplyLyrics,
  onOpenScanner,
}) => {
  const [inputText, setInputText] = useState('');
  const [targetField, setTargetField] = useState<'hanji' | 'poj' | 'pij' | 'custom' | 'auto_ai'>('auto_ai');
  const [aiModel, setAiModel] = useState<GeminiModelChoice>(() => {
    if (typeof window !== 'undefined') {
      const savedModel = localStorage.getItem('taigi_gemini_model') as string;
      if (savedModel === 'gemini-3.7-flash' || savedModel === 'gemini-3.7-flash-lite') {
        return savedModel;
      }
      if (savedModel === 'gemini-2.5-flash-lite') return 'gemini-3.7-flash-lite';
    }
    return 'gemini-3.7-flash';
  });
  const [thinkingEffort, setThinkingEffort] = useState<GeminiThinkingEffort>(() => {
    if (typeof window !== 'undefined') {
      const savedEffort = localStorage.getItem('taigi_gemini_thinking_effort') as GeminiThinkingEffort;
      if (savedEffort === 'HIGH' || savedEffort === 'MEDIUM') {
        return savedEffort;
      }
    }
    return 'MEDIUM';
  });
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return getActiveGeminiApiKey() || localStorage.getItem('taigi_gemini_api_key') || '';
    }
    return '';
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(false);

  // Gemini Passcode Auth States
  const [isAiAuthenticated, setIsAiAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return isGeminiAuthenticated();
    return false;
  });
  const [isAuthCollapsed, setIsAuthCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return isGeminiAuthenticated();
    return false;
  });
  const [passcode, setPasscode] = useState<string>('');
  const [showPasscode, setShowPasscode] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [versePreviews, setVersePreviews] = useState<VersePreviewItem[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleModelChange = (model: GeminiModelChoice) => {
    setAiModel(model);
    if (typeof window !== 'undefined') {
      localStorage.setItem('taigi_gemini_model', model);
    }
  };

  const handleThinkingEffortChange = (effort: GeminiThinkingEffort) => {
    setThinkingEffort(effort);
    if (typeof window !== 'undefined') {
      localStorage.setItem('taigi_gemini_thinking_effort', effort);
    }
  };

  const handleApiKeyChange = (key: string) => {
    setCustomApiKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('taigi_gemini_api_key', key);
    }
  };

  // Passcode verification
  const handleVerifyPasscode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const result = verifyGeminiPasscode(passcode);
    if (result.success) {
      setIsAiAuthenticated(true);
      setAuthSuccess(result.message);
      setAiError(null);
      if (result.isApiKey) {
        setCustomApiKey(passcode.trim());
      }
      // Smoothly collapse the auth box upon verification
      setTimeout(() => {
        setIsAuthCollapsed(true);
      }, 500);
    } else {
      setAuthError(result.message);
    }
  };

  const handleRevokeAuth = () => {
    revokeGeminiAuth();
    setIsAiAuthenticated(false);
    setIsAuthCollapsed(false);
    setPasscode('');
    setCustomApiKey('');
    setAuthSuccess(null);
    setAuthError('Passcode authorization revoked and credentials cleared.');
  };

  if (!isOpen) return null;

  // Calculate total notes and verses available in song
  const totalNotesCount = song.measures.reduce((acc, m) => acc + m.notes.length, 0);
  const songVerses = groupSongIntoVerses(song);
  const totalPreviewTokensCount = versePreviews.reduce((acc, vp) => acc + vp.tokens.length, 0);

  // Handle preview generation with newline as verse splitter
  const handleGeneratePreview = async () => {
    setAiError(null);
    if (!inputText.trim()) return;

    // Split input text by newlines into non-empty lines (each line is a verse)
    const lines = inputText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    if (targetField === 'auto_ai') {
      // Check passcode authentication before calling Gemini
      if (!isAiAuthenticated) {
        setIsAuthCollapsed(false);
        setAuthError('Please enter and verify passcode first to unlock Gemini AI features.');
        setAiError('Passcode not verified. Cannot call Gemini API.');
        return;
      }

      setIsLoadingAi(true);
      try {
        let tokensByVerse: LyricSyllable[][] = [];
        const aiOptions = {
          model: aiModel,
          thinkingEffort,
        };

        if (lines.length > 1) {
          tokensByVerse = await convertTaigiLyricsByVersesWithAi(
            lines,
            customApiKey.trim() || undefined,
            aiOptions
          );
        } else {
          const singleTokens = await convertTaigiLyricsWithAi(
            lines[0],
            customApiKey.trim() || undefined,
            aiOptions
          );
          tokensByVerse = [singleTokens];
        }

        const previews: VersePreviewItem[] = lines.map((line, idx) => {
          const matchedVerse = songVerses[idx];
          const tokens = tokensByVerse[idx] || [];
          return {
            verseIndex: idx,
            verseTitle: matchedVerse
              ? `Verse ${idx + 1}${matchedVerse.section ? ` (${matchedVerse.section})` : ''}`
              : `Verse ${idx + 1} (Exceeds song verse count)`,
            section: matchedVerse?.section,
            measureRange: matchedVerse
              ? `Measures ${matchedVerse.startMeasureNumber}-${matchedVerse.endMeasureNumber}`
              : '',
            noteCount: matchedVerse ? matchedVerse.notes.length : 0,
            tokens,
          };
        });

        setVersePreviews(previews);
      } catch (err: unknown) {
        // Fallback to local rule-based tokenizer
        const previews: VersePreviewItem[] = lines.map((line, idx) => {
          const rawSyllables = splitTaigiLyricSyllables(line);
          const tokens: LyricSyllable[] = rawSyllables.map(s => ({
            hanji: s,
            poj: s,
            pij: s,
            custom: s,
          }));
          const matchedVerse = songVerses[idx];
          return {
            verseIndex: idx,
            verseTitle: matchedVerse
              ? `Verse ${idx + 1}${matchedVerse.section ? ` (${matchedVerse.section})` : ''}`
              : `Verse ${idx + 1} (Exceeds song verse count)`,
            section: matchedVerse?.section,
            measureRange: matchedVerse
              ? `Measures ${matchedVerse.startMeasureNumber}-${matchedVerse.endMeasureNumber}`
              : '',
            noteCount: matchedVerse ? matchedVerse.notes.length : 0,
            tokens,
          };
        });
        setVersePreviews(previews);
        setAiError('AI connection failed or key invalid. Switched to local rule-based tokenizer.');
      } finally {
        setIsLoadingAi(false);
      }
    } else {
      // Local splitting
      const previews: VersePreviewItem[] = lines.map((line, idx) => {
        const rawSyllables = splitTaigiLyricSyllables(line);
        const tokens: LyricSyllable[] = rawSyllables.map(s => {
          const item: LyricSyllable = {};
          item[targetField] = s;
          return item;
        });
        const matchedVerse = songVerses[idx];
        return {
          verseIndex: idx,
          verseTitle: matchedVerse
            ? `Verse ${idx + 1}${matchedVerse.section ? ` (${matchedVerse.section})` : ''}`
            : `Verse ${idx + 1} (Exceeds song verse count)`,
          section: matchedVerse?.section,
          measureRange: matchedVerse
            ? `Measures ${matchedVerse.startMeasureNumber}-${matchedVerse.endMeasureNumber}`
            : '',
          noteCount: matchedVerse ? matchedVerse.notes.length : 0,
          tokens,
        };
      });
      setVersePreviews(previews);
    }
  };

  const handleApply = () => {
    if (versePreviews.length === 0) return;

    // Deep clone measures
    const newMeasures = song.measures.map(m => ({
      ...m,
      notes: m.notes.map(note => ({
        ...note,
        lyric: { ...note.lyric },
      })),
    }));

    // If input has multiple lines or song has multiple verses:
    if (versePreviews.length > 1 || songVerses.length > 1) {
      versePreviews.forEach((vp, vIdx) => {
        const targetVerse = songVerses[vIdx];
        if (!targetVerse) return;

        let tokIdx = 0;
        for (let nIdx = 0; nIdx < targetVerse.notes.length; nIdx++) {
          if (tokIdx >= vp.tokens.length) break;
          const noteRef = targetVerse.notes[nIdx];
          const note = newMeasures[noteRef.measureIndex]?.notes[noteRef.noteIndex];
          if (!note) continue;

          // If note is an explicit non-notation break or spacer, don't overwrite with sung lyric unless token is also punctuation
          const isNoteNonNotation = isNonNotationItem(note);
          const tok = vp.tokens[tokIdx];
          const isTokenPunct = isPunctuationOrSpacer(tok.hanji || tok.custom || '');

          if (isNoteNonNotation && !isTokenPunct) {
            continue; // Skip non-notation note so syllable aligns with sung pitch
          }

          tokIdx++;
          note.lyric = {
            ...note.lyric,
            ...(tok.hanji !== undefined ? { hanji: tok.hanji } : {}),
            ...(tok.poj !== undefined ? { poj: tok.poj } : {}),
            ...(tok.pij !== undefined ? { pij: tok.pij } : {}),
            ...(tok.custom !== undefined ? { custom: tok.custom } : {}),
          };

          if (isTokenPunct) {
            note.pitch = 'empty';
            note.duration = 0 as NoteDuration;
          }
        }
      });
    } else {
      // Single continuous line across the whole song
      let tokenIdx = 0;
      const flatTokens = versePreviews[0]?.tokens || [];
      newMeasures.forEach(m => {
        m.notes.forEach(note => {
          if (tokenIdx < flatTokens.length) {
            const isNoteNonNotation = isNonNotationItem(note);
            const tok = flatTokens[tokenIdx];
            const isTokenPunct = isPunctuationOrSpacer(tok.hanji || tok.custom || '');

            if (isNoteNonNotation && !isTokenPunct) {
              return; // Skip non-notation note
            }

            tokenIdx++;
            note.lyric = {
              ...note.lyric,
              ...(tok.hanji !== undefined ? { hanji: tok.hanji } : {}),
              ...(tok.poj !== undefined ? { poj: tok.poj } : {}),
              ...(tok.pij !== undefined ? { pij: tok.pij } : {}),
              ...(tok.custom !== undefined ? { custom: tok.custom } : {}),
            };

            if (isTokenPunct) {
              note.pitch = 'empty';
              note.duration = 0 as NoteDuration;
            }
          }
        });
      });
    }

    onApplyLyrics(
      normalizeSongDurations({
        ...song,
        measures: newMeasures,
      })
    );

    onClose();
  };

  return (
    <div id="quick-aligner-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div id="quick-aligner-modal-card" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-lg">
            <AlignLeft className="w-5 h-5 text-amber-500" />
            <span>Taigi Lyric Syllable Aligner</span>
          </div>
          <button
            id="quick-aligner-close-btn"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="aligner-input-text" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Paste Lyrics Text (Hanji / POJ / PIJ / Han-lô)
              </label>
              <div className="flex items-center gap-2">
                {onOpenScanner && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenScanner();
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 hover:underline cursor-pointer"
                  >
                    <ScanLine className="w-3 h-3" />
                    <span>Extract Lyrics from Score Image (OCR)</span>
                  </button>
                )}
                <span className="hidden sm:inline text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  💡 Newlines split verses
                </span>
              </div>
            </div>
            <textarea
              id="aligner-input-text"
              rows={4}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={`Example:\nTo̍k iā bô phōaⁿ siú teng-ē\nChheng-hong tùi bīn chhoe\n\nKhuànn-tio̍h thâu-tsîng thinn tō beh kng`}
              className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 font-serif"
            />
          </div>

          {/* Target Field Mode Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Alignment Target Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <button
                id="align-mode-auto-ai"
                type="button"
                onClick={() => setTargetField('auto_ai')}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border font-medium transition-all cursor-pointer ${
                  targetField === 'auto_ai'
                    ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Auto (Hanji + POJ + PIJ)</span>
              </button>

              <button
                id="align-mode-hanji"
                type="button"
                onClick={() => setTargetField('hanji')}
                className={`p-2 rounded-xl border font-medium transition-all cursor-pointer ${
                  targetField === 'hanji'
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                Fill Hanji
              </button>

              <button
                id="align-mode-poj"
                type="button"
                onClick={() => setTargetField('poj')}
                className={`p-2 rounded-xl border font-medium transition-all cursor-pointer ${
                  targetField === 'poj'
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                Fill POJ
              </button>

              <button
                id="align-mode-pij"
                type="button"
                onClick={() => setTargetField('pij')}
                className={`p-2 rounded-xl border font-medium transition-all cursor-pointer ${
                  targetField === 'pij'
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                Fill PIJ
              </button>

              <button
                id="align-mode-custom"
                type="button"
                onClick={() => setTargetField('custom')}
                className={`p-2 rounded-xl border font-medium transition-all cursor-pointer ${
                  targetField === 'custom'
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                Fill Han-lô
              </button>
            </div>
          </div>

          {/* AI Passcode Auth & Model Configuration Panel */}
          {targetField === 'auto_ai' && (
            <div
              id="aligner-ai-config-panel"
              className="p-3.5 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300/60 dark:border-amber-700/60 rounded-xl flex flex-col gap-3 animate-in fade-in duration-150"
            >
              {/* Header Bar of AI Config Panel */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Gemini AI Configuration</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApiKeyInput(prev => !prev)}
                  className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline cursor-pointer"
                >
                  <Key className="w-3 h-3" />
                  <span>{showApiKeyInput ? 'Hide Custom API Key' : 'Custom API Key (Optional)'}</span>
                </button>
              </div>

              {/* PASSCODE AUTHENTICATION CARD (COLLAPSIBLE) */}
              {isAiAuthenticated && isAuthCollapsed ? (
                /* Collapsed Authenticated Badge */
                <div
                  id="aligner-auth-collapsed-bar"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 dark:bg-emerald-950/40 dark:border-emerald-800/60 text-xs animate-in fade-in duration-150"
                >
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Gemini API Passcode Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      id="aligner-auth-expand-toggle-btn"
                      type="button"
                      onClick={() => setIsAuthCollapsed(false)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 cursor-pointer hover:underline"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Change Passcode</span>
                    </button>
                    <button
                      id="aligner-auth-revoke-btn"
                      type="button"
                      onClick={handleRevokeAuth}
                      className="text-[11px] text-red-600 dark:text-red-400 hover:underline cursor-pointer ml-1"
                      title="Revoke Passcode Access"
                    >
                      <LogOut className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Expanded Passcode Auth Box */
                <div
                  id="aligner-auth-expanded-box"
                  className="p-3 bg-white dark:bg-zinc-800/90 border border-amber-300/80 dark:border-amber-700/80 rounded-xl flex flex-col gap-2.5 shadow-2xs animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span>Gemini API Passcode Authorization</span>
                    </div>
                    {isAiAuthenticated && (
                      <button
                        id="aligner-auth-collapse-toggle-btn"
                        type="button"
                        onClick={() => setIsAuthCollapsed(true)}
                        className="flex items-center gap-0.5 text-[11px] text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                      >
                        <ChevronUp className="w-3 h-3" />
                        <span>Collapse</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Enter the passcode to enable Gemini AI syllable analysis and tone tagging (Default hint: <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 rounded font-mono font-bold">taigi</code> or personal API Key).
                  </p>

                  <form onSubmit={handleVerifyPasscode} className="flex gap-2">
                    <div className="relative flex-1 flex items-center">
                      <input
                        id="aligner-passcode-input"
                        type={showPasscode ? 'text' : 'password'}
                        value={passcode}
                        onChange={e => setPasscode(e.target.value)}
                        placeholder="Enter passcode (e.g. taigi) or API Key"
                        className="w-full pl-3 pr-8 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasscode(!showPasscode)}
                        className="absolute right-2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        {showPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      id="aligner-verify-passcode-btn"
                      type="submit"
                      disabled={!passcode.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-xs rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Verify</span>
                    </button>
                  </form>

                  {authError && (
                    <div
                      id="aligner-auth-error-msg"
                      className="p-2 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {authSuccess && (
                    <div
                      id="aligner-auth-success-msg"
                      className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{authSuccess}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Model & Thinking Effort Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Gemini Model Selection Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="aligner-ai-model-select"
                    className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
                  >
                    <Cpu className="w-3.5 h-3.5 text-amber-500" />
                    <span>Gemini Model</span>
                  </label>
                  <select
                    id="aligner-ai-model-select"
                    value={aiModel}
                    onChange={e => handleModelChange(e.target.value as GeminiModelChoice)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                  >
                    <option value="gemini-3.7-flash">1. gemini-3.7-flash (Default · Deep Reasoning)</option>
                    <option value="gemini-3.7-flash-lite">2. gemini-3.7-flash-lite (Fast · Lightweight)</option>
                  </select>
                </div>

                {/* 2. Thinking Effort Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="aligner-thinking-effort-select"
                    className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
                  >
                    <BrainCircuit className="w-3.5 h-3.5 text-amber-500" />
                    <span>Thinking Effort</span>
                  </label>
                  <select
                    id="aligner-thinking-effort-select"
                    value={thinkingEffort}
                    onChange={e => handleThinkingEffortChange(e.target.value as GeminiThinkingEffort)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                  >
                    <option value="MEDIUM">MEDIUM (Default)</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>

              {showApiKeyInput && (
                <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/50 flex flex-col gap-1.5 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="aligner-custom-api-key"
                      className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400"
                    >
                      Gemini API Key (Custom Key)
                    </label>
                    <span className="text-[10px] text-zinc-500">
                      Default uses environment variable; private key optional
                    </span>
                  </div>
                  <input
                    id="aligner-custom-api-key"
                    type="password"
                    value={customApiKey}
                    onChange={e => handleApiKeyChange(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono shadow-2xs"
                  />
                </div>
              )}
            </div>
          )}

          {/* Action Trigger Button */}
          <button
            id="aligner-parse-btn"
            type="button"
            disabled={!inputText.trim() || isLoadingAi}
            onClick={handleGeneratePreview}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-semibold text-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isLoadingAi ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI analyzing syllables and tone marks...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  {targetField === 'auto_ai' && !isAiAuthenticated
                    ? 'Passcode Required'
                    : 'Parse Syllables & Preview Alignment'}
                </span>
              </>
            )}
          </button>

          {aiError && (
            <p id="aligner-error-msg" className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
              {aiError}
            </p>
          )}

          {/* Preview Tokens Grid Grouped by Verse */}
          {versePreviews.length > 0 && (
            <div id="aligner-preview-container" className="flex flex-col gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    Syllable Alignment Preview ({versePreviews.length} verses / {totalPreviewTokensCount} syllables / {totalNotesCount} notes total)
                  </span>
                </span>
                {versePreviews.length > songVerses.length && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">
                    (Notice: Lyrics lines exceed song verse count; extras will be ignored)
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
                {versePreviews.map((vp, vIdx) => {
                  const isOverflowVerse = vIdx >= songVerses.length;
                  const isSyllableOverflow = !isOverflowVerse && vp.tokens.length > vp.noteCount;
                  return (
                    <div
                      key={vIdx}
                      className={`p-2.5 rounded-xl border flex flex-col gap-2 ${
                        isOverflowVerse
                          ? 'bg-zinc-100/50 dark:bg-zinc-800/30 border-dashed border-zinc-300 dark:border-zinc-700 opacity-60'
                          : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                            {vp.verseTitle}
                          </span>
                          {vp.measureRange && (
                            <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                              ({vp.measureRange} · {vp.noteCount} notes)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {vp.tokens.length} syllables
                          {isSyllableOverflow && (
                            <span className="text-amber-600 dark:text-amber-400 ml-1">
                              ({vp.tokens.length - vp.noteCount} extra truncated)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {vp.tokens.map((tok, tokIdx) => {
                          const isExceedingNote = !isOverflowVerse && tokIdx >= vp.noteCount;
                          return (
                            <div
                              key={tokIdx}
                              className={`flex flex-col items-center px-2 py-1 border rounded-lg text-xs transition-all ${
                                isExceedingNote
                                  ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-300/50 text-zinc-400 dark:text-zinc-500 line-through'
                                  : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                              }`}
                              title={isExceedingNote ? 'Syllable exceeds note limit for this verse' : undefined}
                            >
                              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">#{tokIdx + 1}</span>
                              <span className="font-bold text-sm leading-tight">{tok.hanji || tok.custom || '—'}</span>
                              {(tok.poj || tok.pij) && (
                                <span className="font-serif italic text-emerald-600 dark:text-emerald-400 text-[10px] leading-tight">
                                  {tok.poj || tok.pij}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
          <button
            id="aligner-cancel-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="aligner-apply-btn"
            type="button"
            disabled={versePreviews.length === 0}
            onClick={handleApply}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Apply to Score</span>
          </button>
        </div>
      </div>
    </div>
  );
};
