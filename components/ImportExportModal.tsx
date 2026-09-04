'use client';

import React, { useState } from 'react';
import { Song } from '@/types/song';
import { PRESET_SONGS } from '@/lib/presets';
import {
  exportSongToJson,
  exportSongToText,
  importSongFromJson,
  importSongFromText,
} from '@/lib/songParser';
import {
  getStoredCustomLibrary,
  saveSongToCustomLibrary,
  saveSongToCustomLibraryWithResult,
  deleteSongFromCustomLibrary,
} from '@/lib/storage';
import { useGeminiAuth } from '@/hooks/useGeminiAuth';
import {
  Download,
  Upload,
  Copy,
  Check,
  FileText,
  Code2,
  Library,
  X,
  AlertCircle,
  Sparkles,
  ScanLine,
  BookmarkPlus,
  Trash2,
  FolderHeart,
  FilePlus2,
} from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song;
  onLoadSong: (song: Song) => void;
  onOpenScanner?: () => void;
  onStartFreshSong?: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  currentSong,
  onLoadSong,
  onOpenScanner,
  onStartFreshSong,
}) => {
  const { hasApiKey } = useGeminiAuth();
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'export' | 'import' | 'ai_scan'>('presets');
  const [exportFormat, setExportFormat] = useState<'json' | 'text'>('json');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Refresh custom songs when opening modal or performing actions
  const [customSongs, setCustomSongs] = useState<Song[]>(() => {
    if (typeof window !== 'undefined') return getStoredCustomLibrary();
    return [];
  });

  const handleSaveToCustomLibrary = () => {
    const res = saveSongToCustomLibraryWithResult(currentSong);
    setCustomSongs(res.library);
    if (res.success) {
      setSaveError(null);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } else {
      setSaveError(res.error || 'Failed to save to local library (Quota exceeded).');
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  const handleDeleteFromCustomLibrary = (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    const updated = deleteSongFromCustomLibrary(songId);
    setCustomSongs(updated);
  };

  // Import states
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentExportString =
    exportFormat === 'json' ? exportSongToJson(currentSong) : exportSongToText(currentSong);

  const handleCopyExport = () => {
    navigator.clipboard.writeText(currentExportString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const extension = exportFormat === 'json' ? 'taigi.json' : 'txt';
    const mimeType = exportFormat === 'json' ? 'application/json' : 'text/plain';
    const blob = new Blob([currentExportString], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentSong.title.replace(/\s+/g, '_')}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    setImportError(null);
    if (!importText.trim()) {
      setImportError('Please enter JSON or text notation data.');
      return;
    }

    try {
      let loadedSong: Song;
      if (importText.trim().startsWith('{')) {
        // JSON
        loadedSong = importSongFromJson(importText.trim());
      } else {
        // Text format
        loadedSong = importSongFromText(importText.trim());
      }
      saveSongToCustomLibrary(loadedSong);
      onLoadSong(loadedSong);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse song format.';
      setImportError(msg);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      setImportText(content);
    };
    reader.readAsText(file);
  };

  return (
    <div id="import-export-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div id="import-export-modal-card" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-lg">
            <Library className="w-5 h-5 text-amber-500" />
            <span>Song Library & Import / Export</span>
          </div>
          <button
            id="modal-close-btn"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div id="modal-tab-bar" className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-950/60 px-6 pt-2 text-sm font-semibold overflow-x-auto">
          <button
            id="tab-presets-btn"
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'presets'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Presets</span>
          </button>

          <button
            id="tab-custom-btn"
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'custom'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <FolderHeart className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Custom Library ({customSongs.length})</span>
          </button>

          <button
            id="tab-export-btn"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'export'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Export Score</span>
          </button>

          <button
            id="tab-import-btn"
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'import'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Import Score</span>
          </button>

          <button
            id="tab-ai-scan-btn"
            onClick={() => setActiveTab('ai_scan')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'ai_scan'
                ? hasApiKey
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                  : 'border-zinc-400 text-zinc-500 dark:text-zinc-400 font-bold'
                : hasApiKey
                ? 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                : 'border-transparent text-zinc-400 dark:text-zinc-500 opacity-60'
            }`}
            title={hasApiKey ? 'AI Score OCR' : 'AI Score OCR is muted (Gemini API Key not available)'}
          >
            <ScanLine className={`w-4 h-4 shrink-0 ${hasApiKey ? 'text-amber-500' : 'text-zinc-400 dark:text-zinc-500'}`} />
            <span>{hasApiKey ? 'AI Score OCR' : 'AI Score OCR (Muted)'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {/* TAB 1: PRESET SONGS */}
          {activeTab === 'presets' && (
            <div id="presets-panel" className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select a song to load complete Numbered Notation score, chords, and aligned lyrics:
                </p>
                <div className="flex items-center gap-2">
                  {onStartFreshSong && (
                    <button
                      id="modal-presets-new-song-btn"
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartFreshSong();
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700 text-xs font-bold transition-all cursor-pointer"
                      title="Create New Blank Song"
                    >
                      <FilePlus2 className="w-3.5 h-3.5 text-amber-500" />
                      <span>New Blank Song</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveToCustomLibrary}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 text-xs font-bold transition-all cursor-pointer"
                    title="Save current song to custom library"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-amber-500" />
                    <span>{savedSuccess ? 'Saved to Library!' : 'Save Current to Library'}</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_SONGS.map(preset => (
                  <div
                    id={`preset-card-${preset.id}`}
                    key={preset.id}
                    onClick={() => {
                      onLoadSong(preset);
                      onClose();
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                      preset.id === currentSong.id
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-500'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 hover:border-amber-400 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          {preset.title}
                        </h4>
                        <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          1={preset.key} {preset.timeSignature}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                        {preset.description || preset.subtitle}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <span>{preset.measures.length} Measures</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400 group-hover:underline">
                        Load →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM SONG LIBRARY */}
          {activeTab === 'custom' && (
            <div id="custom-library-panel" className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Songs stored in local browser storage ({customSongs.length} total):
                </p>
                <div className="flex items-center gap-2">
                  {onStartFreshSong && (
                    <button
                      id="modal-custom-new-song-btn"
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartFreshSong();
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700 text-xs font-bold transition-all cursor-pointer"
                      title="Create New Blank Song"
                    >
                      <FilePlus2 className="w-3.5 h-3.5 text-amber-500" />
                      <span>New Blank Song</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveToCustomLibrary}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold transition-all shadow-xs hover:bg-amber-400 cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>{savedSuccess ? 'Saved!' : 'Save Current'}</span>
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium">
                  {saveError}
                </div>
              )}

              {customSongs.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center gap-3">
                  <FolderHeart className="w-10 h-10 text-zinc-400" />
                  <h4 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">No Custom Songs Saved</h4>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    Click &ldquo;Save Current&rdquo; to store your in-progress composition here, or start a new song.
                  </p>
                  {onStartFreshSong && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartFreshSong();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      <FilePlus2 className="w-4 h-4" />
                      <span>Start New Blank Song</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customSongs.map(cSong => (
                    <div
                      id={`custom-card-${cSong.id}`}
                      key={cSong.id}
                      onClick={() => {
                        onLoadSong(cSong);
                        onClose();
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                        cSong.id === currentSong.id
                          ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-500'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 hover:border-amber-400 hover:shadow-md'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                            {cSong.title}
                          </h4>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                              1={cSong.key} {cSong.timeSignature}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteFromCustomLibrary(e, cSong.id)}
                              className="p-1 text-zinc-400 hover:text-rose-500 rounded transition-colors"
                              title="Delete from custom library"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                          {cSong.description || cSong.subtitle || 'Custom Numbered Notation score'}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <span>{cSong.measures.length} Measures</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400 group-hover:underline">
                          Load →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EXPORT */}
          {activeTab === 'export' && (
            <div id="export-panel" className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Format:</span>
                  <button
                    id="export-format-json-btn"
                    onClick={() => setExportFormat('json')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      exportFormat === 'json'
                        ? 'bg-amber-500 text-zinc-950 shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5 inline mr-1" />
                    JSON (.taigi.json)
                  </button>
                  <button
                    id="export-format-text-btn"
                    onClick={() => setExportFormat('text')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      exportFormat === 'text'
                        ? 'bg-amber-500 text-zinc-950 shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 inline mr-1" />
                    Plain Text Notation (.txt)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="export-copy-btn"
                    onClick={handleCopyExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <button
                    id="export-download-btn"
                    onClick={handleDownloadFile}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                </div>
              </div>

              <textarea
                id="export-preview-textarea"
                readOnly
                rows={12}
                value={currentExportString}
                className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-800 dark:text-zinc-200 select-all focus:outline-hidden"
              />
            </div>
          )}

          {/* TAB 3: IMPORT */}
          {activeTab === 'import' && (
            <div id="import-panel" className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Paste JSON or plain text Numbered Notation format, or upload a score file:
                </p>

                <label htmlFor="import-file-input" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".json,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {importError && (
                <div id="import-error-banner" className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              <textarea
                id="import-text-textarea"
                rows={10}
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder="Paste JSON string or plain text Numbered Notation (e.g. Title: ..., Key: F, [Measure 1] ...)"
                className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />

              <div className="flex justify-end">
                <button
                  id="import-submit-btn"
                  type="button"
                  onClick={handleImportSubmit}
                  disabled={!importText.trim()}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Import</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: AI IMAGE SCORE SCAN */}
          {activeTab === 'ai_scan' && (
            <div id="ai-scan-panel" className="flex flex-col gap-4">
              {!hasApiKey && (
                <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Gemini API key is not configured in the environment. AI Score OCR scanning is currently muted.</span>
                </div>
              )}

              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/70 dark:border-amber-700/70 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                    <ScanLine className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-base flex items-center gap-2">
                      <span>Gemini AI Multimodal Score OCR</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-mono font-bold">
                        1~3 Pages
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Upload physical sheet music or lyrics photos. AI automatically recognizes melodies, rhythms, octaves, chords, and Taigi lyrics!
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-zinc-600 dark:text-zinc-400 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                  <div className="flex flex-col gap-1 p-2 rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">1. Upload 1~3 Images</span>
                    <span className="text-[11px] text-zinc-500">Supports phone photos and scans with automatic optimization.</span>
                  </div>
                  <div className="flex flex-col gap-1 p-2 rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">2. Gemini AI Analysis</span>
                    <span className="text-[11px] text-zinc-500">Deep music theory thinking with seamless multi-page stitching.</span>
                  </div>
                  <div className="flex flex-col gap-1 p-2 rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">3. Preview & Import</span>
                    <span className="text-[11px] text-zinc-500">Inspect against source images. Import as new song or append.</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    id="launch-ai-scanner-btn"
                    type="button"
                    disabled={!hasApiKey}
                    onClick={() => {
                      if (!hasApiKey) return;
                      onClose();
                      if (onOpenScanner) onOpenScanner();
                    }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-md transition-all ${
                      hasApiKey
                        ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 active:scale-98 cursor-pointer'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed opacity-60'
                    }`}
                    title={hasApiKey ? 'Open AI Score Scanner' : 'AI Score Scanner is muted (Gemini API key not configured in environment)'}
                  >
                    <ScanLine className="w-4 h-4" />
                    <span>{hasApiKey ? 'Open AI Score Scanner →' : 'AI Scanner Muted (No Environment Key)'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
