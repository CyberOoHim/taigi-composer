'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LyricSyllable, Song } from '@/types/song';
import {
  compressAndPrepareImage,
  formatBytes,
  PreparedImage,
  validateImageFiles,
} from '@/lib/imageUtils';
import {
  AiScoreExtractionMode,
  AiScoreExtractionResult,
  extractScoreFromImagesWithAi,
  GeminiModelChoice,
  GeminiThinkingEffort,
} from '@/lib/geminiService';
import { useGeminiAuth } from '@/hooks/useGeminiAuth';
import { GeminiAuthCard } from '@/components/GeminiAuthCard';

import { exportSongToJson, exportSongToText } from '@/lib/songParser';
import { calculateMeasureBeats, getExpectedMeasureBeats } from '@/lib/taigiUtils';
import {
  AlertCircle,
  ArrowLeftRight,
  BrainCircuit,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns,
  Copy,
  Cpu,
  FileMusic,
  FilePlus,
  Image as ImageIcon,
  Key,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Maximize2,
  Music,
  Plus,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
  X,
  EyeOff,
  Eye,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface AiScoreScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song;
  onApply: (
    resultSong: Song,
    action: 'new' | 'replace' | 'append' | 'lyrics',
    lyricsVerses?: LyricSyllable[][]
  ) => void;
  onOpenGeminiAuth?: () => void;
}

export const AiScoreScannerModal: React.FC<AiScoreScannerModalProps> = ({
  isOpen,
  onClose,
  currentSong,
  onApply,
  onOpenGeminiAuth,
}) => {
  // Synchronized Gemini AI Auth & Configuration
  const {
    isAuthenticated: isAiAuthenticated,
    activeModel: aiModel,
    thinkingEffort,
    apiKey: customApiKey,
  } = useGeminiAuth();

  // Page Images deck (1-3 images)
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Extraction Settings
  const [mode, setMode] = useState<AiScoreExtractionMode>('full_score');

  // Recognition / Processing States
  const [isScanning, setIsScanning] = useState(false);
  const [scanStepMessage, setScanStepMessage] = useState<string>('');
  const [scanResult, setScanResult] = useState<AiScoreExtractionResult | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'split' | 'score' | 'images' | 'lyrics'>('split');
  const [splitImageZoom, setSplitImageZoom] = useState<number>(1.0);
  const [highlightedMeasureIdx, setHighlightedMeasureIdx] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  const [copiedText, setCopiedText] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle files selected or dropped
  const handleFilesAdded = async (incomingFiles: FileList | File[]) => {
    setUploadError(null);
    const fileArray = Array.from(incomingFiles);
    if (fileArray.length === 0) return;

    const { validFiles, error } = validateImageFiles(fileArray, images.length, 3);
    if (error) {
      setUploadError(error);
    }
    if (validFiles.length === 0) return;

    setIsCompressing(true);
    try {
      const preparedList: PreparedImage[] = [];
      for (const file of validFiles) {
        const prepared = await compressAndPrepareImage(file, 2048, 0.88);
        preparedList.push(prepared);
      }
      setImages(prev => [...prev, ...preparedList].slice(0, 3));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Image processing failed';
      setUploadError(msg);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (selectedImageIndex >= next.length) {
        setSelectedImageIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const handleMoveImage = (index: number, direction: 'left' | 'right') => {
    setImages(prev => {
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  // Trigger Gemini Multimodal Score Scan
  const handleStartScan = async () => {
    setUploadError(null);
    if (images.length === 0) {
      setUploadError('Please upload 1 to 3 score images first');
      return;
    }

    if (!isAiAuthenticated) {
      setUploadError('Please enter and verify Gemini passcode first (default: taigi)');
      if (onOpenGeminiAuth) {
        onOpenGeminiAuth();
      }
      return;
    }


    setIsScanning(true);
    setScanResult(null);
    setScanStepMessage('Preparing image payloads...');

    try {
      setScanStepMessage(`Sending ${images.length} score image(s) to Gemini 3.7 multimodal model...`);
      const imagePayloads = images.map(img => ({
        data: img.base64,
        mimeType: img.mimeType,
        name: img.name,
      }));

      const result = await extractScoreFromImagesWithAi(
        imagePayloads,
        mode,
        customApiKey.trim() || undefined,
        {
          model: aiModel,
          thinkingEffort,
        }
      );

      setScanResult(result);
      if (result.success) {
        setActivePreviewTab(mode === 'lyrics_only' ? 'lyrics' : (images.length > 0 ? 'split' : 'score'));
      } else if (result.error) {
        setUploadError(result.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred during score recognition';
      setUploadError(msg);
    } finally {
      setIsScanning(false);
      setScanStepMessage('');
    }
  };

  // Apply Handlers
  const handleApplyResult = (action: 'new' | 'replace' | 'append' | 'lyrics') => {
    if (!scanResult?.song && !scanResult?.lyricsVerses) return;

    if (action === 'lyrics' && scanResult.lyricsVerses) {
      // Apply lyrics verses onto current song
      const newMeasures = currentSong.measures.map(m => ({
        ...m,
        notes: m.notes.map(n => ({ ...n, lyric: { ...n.lyric } })),
      }));

      let totalTokenIndex = 0;
      const flatTokens = scanResult.lyricsVerses.flat();

      newMeasures.forEach(m => {
        m.notes.forEach(note => {
          if (totalTokenIndex < flatTokens.length) {
            const tok = flatTokens[totalTokenIndex++];
            note.lyric = {
              ...note.lyric,
              ...(tok.hanji ? { hanji: tok.hanji } : {}),
              ...(tok.poj ? { poj: tok.poj } : {}),
              ...(tok.pij ? { pij: tok.pij } : {}),
              ...(tok.custom ? { custom: tok.custom } : {}),
            };
          }
        });
      });

      onApply({ ...currentSong, measures: newMeasures }, 'lyrics', scanResult.lyricsVerses);
      onClose();
      return;
    }

    if (!scanResult.song) return;

    if (action === 'append') {
      const startMeasureNum = currentSong.measures.length + 1;
      const appendedMeasures = scanResult.song.measures.map((m, idx) => ({
        ...m,
        id: `m-appended-${startMeasureNum + idx}-${Date.now().toString(36)}`,
        measureNumber: startMeasureNum + idx,
        notes: m.notes.map((n, nIdx) => ({
          ...n,
          id: `n-appended-${startMeasureNum + idx}-${nIdx + 1}-${Math.random().toString(36).substring(2, 6)}`,
        })),
      }));

      const updatedSong: Song = {
        ...currentSong,
        measures: [...currentSong.measures, ...appendedMeasures],
      };
      onApply(updatedSong, 'append', scanResult.lyricsVerses);
      onClose();
      return;
    }

    // 'new' or 'replace'
    onApply(scanResult.song, action, scanResult.lyricsVerses);
    onClose();
  };

  const handleCopyNotationText = () => {
    if (!scanResult?.song) return;
    const text = exportSongToText(scanResult.song);
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const totalExtractedNotes = scanResult?.song
    ? scanResult.song.measures.reduce((acc, m) => acc + m.notes.length, 0)
    : 0;

  return (
    <div
      id="ai-score-scanner-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="ai-score-scanner-card"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-zinc-950 flex items-center justify-center shadow-xs">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>AI Score & Lyrics OCR</span>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-mono font-bold border border-amber-300/60 dark:border-amber-700/60">
                  Up to 3 Pages
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Supports numbered musical notation (1-7), keys, chords, time signatures, and Taigi lyrics (Hanji / POJ / TL) with multi-page stitching.
              </p>
            </div>
          </div>

          <button
            id="scanner-modal-close-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {/* 1. THREE-PAGE UPLOAD & ORDERING DECK */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>Score Pages ({images.length}/3 Pages)</span>
              </label>
              <span className="text-[11px] text-zinc-500">
                Supports JPG, PNG, WebP · Auto-optimized thumbnails & contrast
              </span>
            </div>

            {/* Page Slots Deck */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map(pageIdx => {
                const img = images[pageIdx];
                return (
                  <div
                    key={pageIdx}
                    className={`relative rounded-xl border-2 flex flex-col overflow-hidden transition-all min-h-[160px] ${
                      img
                        ? 'border-amber-400/80 dark:border-amber-600/80 bg-zinc-50 dark:bg-zinc-850 shadow-xs'
                        : 'border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-amber-400'
                    }`}
                  >
                    {/* Page Header Badge */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200/80 dark:border-zinc-700 text-xs font-bold">
                      <span className="text-amber-700 dark:text-amber-400 font-mono">
                        Page {pageIdx + 1}
                      </span>
                      {img && (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {formatBytes(img.size)}
                        </span>
                      )}
                    </div>

                    {/* Slot Content */}
                    {img ? (
                      <div className="relative flex-1 flex flex-col p-2 group">
                        <div className="relative flex-1 rounded-lg overflow-hidden bg-zinc-950 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.previewUrl}
                            alt={`Page ${pageIdx + 1}`}
                            className="max-h-28 w-auto object-contain"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                            {pageIdx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleMoveImage(pageIdx, 'left')}
                                title="Move to previous page"
                                className="p-1.5 rounded-lg bg-white/90 text-zinc-900 hover:bg-white shadow-xs cursor-pointer"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                            )}
                            {pageIdx < images.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleMoveImage(pageIdx, 'right')}
                                title="Move to next page"
                                className="p-1.5 rounded-lg bg-white/90 text-zinc-900 hover:bg-white shadow-xs cursor-pointer"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(pageIdx)}
                              title="Delete this page"
                              className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500 shadow-xs cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-500 truncate mt-1 text-center font-mono">
                          {img.name} ({img.width}x{img.height})
                        </span>
                      </div>
                    ) : (
                      <label
                        htmlFor={`slot-file-input-${pageIdx}`}
                        className="flex-1 flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-amber-50/20 dark:hover:bg-amber-950/10 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 mb-1.5">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          Add Page {pageIdx + 1}
                        </span>
                        <span className="text-[10px] text-zinc-400 mt-0.5">Click or drag image</span>
                        <input
                          id={`slot-file-input-${pageIdx}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files) handleFilesAdded(e.target.files);
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Upload Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  id="scanner-batch-file-input"
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) handleFilesAdded(e.target.files);
                  }}
                />
                <button
                  type="button"
                  disabled={images.length >= 3 || isCompressing}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-500" />
                  <span>Choose Images (Up to 3)</span>
                </button>

                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setImages([])}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Pages</span>
                  </button>
                )}
              </div>

              {isCompressing && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compressing and preparing high-resolution images...</span>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          {/* 2. EXTRACTION MODE SELECTOR */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Extraction Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode('full_score')}
                className={`p-3 rounded-xl border font-bold flex flex-col gap-1 text-left transition-all cursor-pointer ${
                  mode === 'full_score'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500'
                    : 'bg-zinc-50 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-700 hover:border-amber-400 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-extrabold text-sm">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Full Score & Lyrics
                  </span>
                  {mode === 'full_score' && <Check className="w-4 h-4 text-amber-600" />}
                </div>
                <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                  Transcribes key, time signature, BPM, notes, chords, and aligned Taigi Hanji/POJ/TL lyrics.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('score_only')}
                className={`p-3 rounded-xl border font-bold flex flex-col gap-1 text-left transition-all cursor-pointer ${
                  mode === 'score_only'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500'
                    : 'bg-zinc-50 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-700 hover:border-amber-400 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-extrabold text-sm">
                    <Music className="w-4 h-4 text-amber-500" />
                    Notation & Measures Only
                  </span>
                  {mode === 'score_only' && <Check className="w-4 h-4 text-amber-600" />}
                </div>
                <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                  Focuses on 1-7 pitches, rhythms, dots, octaves, rests, and chords without lyrics.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('lyrics_only')}
                className={`p-3 rounded-xl border font-bold flex flex-col gap-1 text-left transition-all cursor-pointer ${
                  mode === 'lyrics_only'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500'
                    : 'bg-zinc-50 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-700 hover:border-amber-400 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-extrabold text-sm">
                    <Layers className="w-4 h-4 text-amber-500" />
                    Lyrics & Syllables Only
                  </span>
                  {mode === 'lyrics_only' && <Check className="w-4 h-4 text-amber-600" />}
                </div>
                <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                  Extracts Taigi lyrics from songbook images and splits into syllables with tone annotations.
                </p>
              </button>
            </div>
          </div>

          {/* 3. GEMINI AUTH & AI CONFIGURATION */}
          <GeminiAuthCard
            title="Gemini Multimodal AI OCR Settings"
            description="Enter the passcode to enable Gemini 3.7 multimodal OCR (Default hint: taigi or personal API Key)."
            onOpenFullSettings={onOpenGeminiAuth}
            idPrefix="scanner-auth"
          />


          {/* 4. SCAN ACTION TRIGGER BUTTON */}
          <button
            id="scanner-start-scan-btn"
            type="button"
            disabled={images.length === 0 || isScanning || !isAiAuthenticated}
            onClick={handleStartScan}
            className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-sm shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{scanStepMessage || 'Gemini analyzing score images...'}</span>
              </>
            ) : (
              <>
                <ScanLine className="w-5 h-5" />
                <span>
                  {!isAiAuthenticated
                    ? 'Passcode Verification Required'
                    : `Start AI Score Recognition (${images.length} Pages)`}
                </span>
              </>
            )}
          </button>

          {/* 5. EXTRACTION REVIEW & PREVIEW PANEL */}
          {scanResult && scanResult.success && (
            <div
              id="scanner-review-panel"
              className="flex flex-col gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 animate-in fade-in duration-200"
            >
              {/* Result Summary Bar */}
              {scanResult.song && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-700/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-zinc-950 flex items-center justify-center font-bold">
                      <Music className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <span>{scanResult.song.title}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-mono font-bold">
                          1={scanResult.song.key} {scanResult.song.timeSignature} {scanResult.song.bpm} BPM
                        </span>
                      </h4>
                      <p className="text-xs text-zinc-500">
                        {scanResult.song.composer ? `Music: ${scanResult.song.composer} · ` : ''}
                        {scanResult.song.lyricist ? `Lyrics: ${scanResult.song.lyricist} · ` : ''}
                        {scanResult.song.measures.length} Measures · {totalExtractedNotes} Notes
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyNotationText}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 cursor-pointer shadow-2xs"
                    >
                      {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText ? 'Copied' : 'Copy Score Text'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-1 text-xs font-bold">
                {scanResult.song && images.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('split')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activePreviewTab === 'split'
                        ? 'bg-amber-500 text-zinc-950 font-bold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>Split Inspector</span>
                  </button>
                )}

                {scanResult.song && (
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('score')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activePreviewTab === 'score'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <FileMusic className="w-3.5 h-3.5" />
                    <span>Measures Preview ({scanResult.song.measures.length} Measures)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActivePreviewTab('images')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activePreviewTab === 'images'
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Compare Images</span>
                </button>

                {scanResult.lyricsVerses && scanResult.lyricsVerses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('lyrics')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activePreviewTab === 'lyrics'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Lyrics Preview ({scanResult.lyricsVerses.length} Verses)</span>
                  </button>
                )}
              </div>

              {/* TAB 0: SIDE-BY-SIDE OCR SPLIT INSPECTOR */}
              {activePreviewTab === 'split' && scanResult.song && images.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in duration-150">
                  {/* Left Column: Pinned Original Score Image */}
                  <div className="flex flex-col gap-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          Source Score Image
                        </span>
                      </div>

                      {/* Image Zoom Toolbar */}
                      <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-lg text-xs">
                        <button
                          type="button"
                          onClick={() => setSplitImageZoom(z => Math.max(0.6, z - 0.2))}
                          className="p-1 text-zinc-600 dark:text-zinc-300 hover:text-amber-500 cursor-pointer"
                          title="Zoom Out"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-[11px] font-bold text-zinc-600 dark:text-zinc-300 px-1">
                          {Math.round(splitImageZoom * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setSplitImageZoom(z => Math.min(3.0, z + 0.2))}
                          className="p-1 text-zinc-600 dark:text-zinc-300 hover:text-amber-500 cursor-pointer"
                          title="Zoom In"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSplitImageZoom(1.0)}
                          className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
                          title="Reset Zoom"
                        >
                          100%
                        </button>
                      </div>
                    </div>

                    {/* Multi-page switcher tabs */}
                    {images.length > 1 && (
                      <div className="flex items-center gap-1.5 pb-1">
                        {images.map((img, i) => (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => setSelectedImageIndex(i)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              selectedImageIndex === i
                                ? 'bg-amber-500 text-zinc-950 shadow-2xs'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            Page {i + 1}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Pannable/Scrollable Image Viewport */}
                    <div className="h-80 sm:h-96 overflow-auto rounded-lg bg-zinc-950 flex items-start justify-center p-2 border border-zinc-800/80">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={images[selectedImageIndex]?.previewUrl}
                        alt={`Source Score Page ${selectedImageIndex + 1}`}
                        style={{ transform: `scale(${splitImageZoom})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
                        className="max-w-none w-full object-contain rounded shadow-lg"
                      />
                    </div>
                  </div>

                  {/* Right Column: Extracted Jianpu Measures */}
                  <div className="flex flex-col gap-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                      <div className="flex items-center gap-2">
                        <FileMusic className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          Extracted Measures Comparison ({scanResult.song.measures.length} Measures)
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        1={scanResult.song.key} · {scanResult.song.timeSignature}
                      </span>
                    </div>

                    {/* Scrollable list of measures */}
                    <div className="h-80 sm:h-96 overflow-y-auto pr-1 flex flex-col gap-2">
                      {scanResult.song.measures.map((m, mIdx) => {
                        const beats = calculateMeasureBeats(m.notes);
                        const expected = getExpectedMeasureBeats(m.timeSignature || scanResult.song?.timeSignature || '4/4');
                        const isBeatsMatched = Math.abs(beats - expected) < 0.01;
                        const isHighlighted = highlightedMeasureIdx === mIdx;

                        return (
                          <div
                            key={m.id || mIdx}
                            onClick={() => setHighlightedMeasureIdx(mIdx)}
                            className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                              isHighlighted
                                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                                : 'bg-zinc-50/70 dark:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-700/60 hover:border-amber-400/80'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs pb-1 mb-1 border-b border-zinc-200/50 dark:border-zinc-700/40">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                  #{m.measureNumber}
                                </span>
                                {m.section && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                                    {m.section}
                                  </span>
                                )}
                                {m.chord && (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                                    {m.chord}
                                  </span>
                                )}
                              </div>

                              {/* Smart Beat Badge */}
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  isBeatsMatched
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                {beats}/{expected} Beats {isBeatsMatched ? '✓' : '⚠️'}
                              </span>
                            </div>

                            {/* Note chips row */}
                            <div className="flex flex-wrap gap-1.5 items-end">
                              {m.notes.map((n, nIdx) => (
                                <div
                                  key={n.id || nIdx}
                                  className="flex flex-col items-center px-1.5 py-1 rounded bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-700/70 text-xs min-w-[28px] shadow-2xs"
                                >
                                  {n.octave > 0 && (
                                    <span className="text-amber-500 font-black leading-none text-[10px]">
                                      {n.octave === 2 ? '••' : '•'}
                                    </span>
                                  )}
                                  <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100">
                                    {n.accidental}
                                    {n.pitch === 'empty' ? '—' : n.pitch}
                                    {n.isDotted ? '·' : ''}
                                  </span>
                                  {n.octave < 0 && (
                                    <span className="text-amber-500 font-black leading-none text-[10px]">
                                      {n.octave === -2 ? '••' : '•'}
                                    </span>
                                  )}
                                  {n.lyric.hanji && (
                                    <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                                      {n.lyric.hanji}
                                    </span>
                                  )}
                                  {(n.lyric.poj || n.lyric.pij) && (
                                    <span className="text-[9px] font-serif italic text-emerald-600 dark:text-emerald-400">
                                      {n.lyric.poj || n.lyric.pij}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1: MEASURES PREVIEW */}
              {activePreviewTab === 'score' && scanResult.song && (
                <div className="max-h-64 overflow-y-auto p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {scanResult.song.measures.map((m, mIdx) => (
                      <div
                        key={m.id || mIdx}
                        className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-xs border-b border-zinc-100 dark:border-zinc-800 pb-1">
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            Measure #{m.measureNumber} {m.section ? `(${m.section})` : ''}
                          </span>
                          {m.chord && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-bold font-mono text-zinc-700 dark:text-zinc-300">
                              {m.chord}
                            </span>
                          )}
                        </div>

                        {/* Notes flow */}
                        <div className="flex flex-wrap gap-1.5 items-end">
                          {m.notes.map((n, nIdx) => (
                            <div
                              key={n.id || nIdx}
                              className="flex flex-col items-center px-1.5 py-1 rounded bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-xs min-w-[28px]"
                            >
                              {/* Octave dot above */}
                              {n.octave > 0 && (
                                <span className="text-amber-500 font-black leading-none text-[10px]">
                                  {n.octave === 2 ? '••' : '•'}
                                </span>
                              )}
                              <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                {n.accidental}
                                {n.pitch === 'empty' ? '—' : n.pitch}
                                {n.isDotted ? '·' : ''}
                              </span>
                              {/* Octave dot below */}
                              {n.octave < 0 && (
                                <span className="text-amber-500 font-black leading-none text-[10px]">
                                  {n.octave === -2 ? '••' : '•'}
                                </span>
                              )}
                              {/* Lyric */}
                              {n.lyric.hanji && (
                                <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                                  {n.lyric.hanji}
                                </span>
                              )}
                              {(n.lyric.poj || n.lyric.pij) && (
                                <span className="text-[9px] font-serif italic text-emerald-600 dark:text-emerald-400">
                                  {n.lyric.poj || n.lyric.pij}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: ORIGINAL IMAGES COMPARISON */}
              {activePreviewTab === 'images' && images.length > 0 && (
                <div className="flex flex-col gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    {images.map((img, i) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setSelectedImageIndex(i)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedImageIndex === i
                            ? 'bg-amber-500 text-zinc-950'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        Page {i + 1} ({img.name})
                      </button>
                    ))}
                  </div>

                  <div className="max-h-72 overflow-auto rounded-lg bg-zinc-950 flex items-center justify-center p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={images[selectedImageIndex]?.previewUrl}
                      alt={`Original Page ${selectedImageIndex + 1}`}
                      className="max-h-64 w-auto object-contain rounded"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: LYRICS VERSES PREVIEW */}
              {activePreviewTab === 'lyrics' && scanResult.lyricsVerses && (
                <div className="max-h-64 overflow-y-auto p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
                  {scanResult.lyricsVerses.map((verse, vIdx) => (
                    <div
                      key={vIdx}
                      className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-1.5"
                    >
                      <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                        Verse {vIdx + 1} ({verse.length} syllables)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {verse.map((syl, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex flex-col items-center px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 text-xs"
                          >
                            <span className="font-bold text-sm">{syl.hanji || syl.custom || '—'}</span>
                            {(syl.poj || syl.pij) && (
                              <span className="font-serif italic text-emerald-600 dark:text-emerald-400 text-[10px]">
                                {syl.poj || syl.pij}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>

          {scanResult && scanResult.success && (
            <div className="flex flex-wrap items-center gap-2">
              {scanResult.song && (
                <>
                  <button
                    id="scanner-apply-new-btn"
                    type="button"
                    onClick={() => handleApplyResult('new')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-zinc-950 font-black text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>Import as New Song</span>
                  </button>

                  <button
                    id="scanner-apply-replace-btn"
                    type="button"
                    onClick={() => handleApplyResult('replace')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs shadow-2xs transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                    <span>Replace Current Song</span>
                  </button>

                  <button
                    id="scanner-apply-append-btn"
                    type="button"
                    onClick={() => handleApplyResult('append')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs shadow-2xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-500" />
                    <span>Append Measures to End</span>
                  </button>
                </>
              )}

              {(scanResult.song || (scanResult.lyricsVerses && scanResult.lyricsVerses.length > 0)) && (
                <button
                  id="scanner-apply-lyrics-btn"
                  type="button"
                  onClick={() => handleApplyResult('lyrics')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold text-xs shadow-2xs transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Apply Lyrics Only</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
