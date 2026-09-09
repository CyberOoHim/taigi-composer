'use client';

import React, { useState } from 'react';
import { InstrumentType, Song } from '@/types/song';
import { PRESET_SONGS } from '@/lib/presets';
import {
  exportSongToJson,
  exportSongToText,
  importSongFromJson,
  importSongFromText,
} from '@/lib/songParser';
import {
  downloadMidiFile,
  getSongMidiLyricsSummary,
  MidiLyricMode,
} from '@/lib/midiExport';
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
  RotateCcw,
  Music,
} from 'lucide-react';
import {
  getCustomSongsFromDB,
  saveSongToDB,
  deleteSongFromDB,
} from '@/lib/indexedDb';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song;
  onLoadSong: (song: Song) => void;
  onOpenScanner?: () => void;
  onStartFreshSong?: () => void;
  modifiedPresetIds?: Set<string>;
  onResetPreset?: (presetId: string) => void;
  initialTab?: 'presets' | 'custom' | 'export' | 'import' | 'ai_scan';
  initialExportFormat?: 'json' | 'text' | 'midi';
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  currentSong,
  onLoadSong,
  onOpenScanner,
  onStartFreshSong,
  modifiedPresetIds = new Set(),
  onResetPreset,
  initialTab,
  initialExportFormat,
}) => {
  const { hasApiKey } = useGeminiAuth();
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'export' | 'import' | 'ai_scan'>(
    () => initialTab || 'presets'
  );
  const [exportFormat, setExportFormat] = useState<'json' | 'text' | 'midi'>(
    () => initialExportFormat || 'json'
  );
  const [midiAccompaniment, setMidiAccompaniment] = useState(true);
  const [midiLyricType, setMidiLyricType] = useState<MidiLyricMode>('hanlo');
  const [midiInstrument, setMidiInstrument] = useState<InstrumentType>('piano');
  const [midiFormat, setMidiFormat] = useState<'mid' | 'kar'>('mid');
  const [midiKaraokeTrack, setMidiKaraokeTrack] = useState(true);
  const [midiMelodyLyrics, setMidiMelodyLyrics] = useState(true);
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Refresh custom songs when opening modal or performing actions
  const [customSongs, setCustomSongs] = useState<Song[]>(() => {
    if (typeof window !== 'undefined') return getStoredCustomLibrary();
    return [];
  });

  React.useEffect(() => {
    if (isOpen) {
      void getCustomSongsFromDB()
        .then(songs => {
          setCustomSongs(songs);
        })
        .catch(() => {
          setCustomSongs(getStoredCustomLibrary());
        });
    }
  }, [isOpen]);

  const handleSaveToCustomLibrary = async () => {
    try {
      await saveSongToDB(currentSong);
      saveSongToCustomLibrary(currentSong);
      const updated = await getCustomSongsFromDB();
      setCustomSongs(updated);
      setSaveError(null);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('[ImportExportModal] Save to IndexedDB failed, fallback to storage:', err);
      const res = saveSongToCustomLibraryWithResult(currentSong);
      setCustomSongs(res.library);
      if (res.success) {
        setSaveError(null);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      } else {
        setSaveError(res.error || 'Failed to save to local library.');
        setTimeout(() => setSaveError(null), 5000);
      }
    }
  };

  const handleDeleteFromCustomLibrary = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    try {
      await deleteSongFromDB(songId);
      deleteSongFromCustomLibrary(songId);
      const updated = await getCustomSongsFromDB();
      setCustomSongs(updated);
    } catch (err) {
      console.error('[ImportExportModal] Delete from IndexedDB failed:', err);
      const updated = deleteSongFromCustomLibrary(songId);
      setCustomSongs(updated);
    }
  };

  // Import states
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Compute export previews before any conditional early returns
  const currentExportString =
    exportFormat === 'json'
      ? exportSongToJson(currentSong)
      : exportFormat === 'text'
      ? exportSongToText(currentSong)
      : '';

  const midiLyricsSummary = React.useMemo(() => {
    return getSongMidiLyricsSummary(currentSong, midiLyricType);
  }, [currentSong, midiLyricType]);

  if (!isOpen) return null;

  const handleCopyExport = () => {
    if (exportFormat === 'midi') {
      const lyricDesc =
        midiLyricType === 'none'
          ? 'None (Instrumental only)'
          : `${midiLyricType.toUpperCase()} (${midiLyricsSummary.totalSyllables} syllables, ${midiLyricsSummary.measuresWithLyrics} measures)`;

      const summary = `MIDI Export Specification for ${currentSong.title}
Key: 1=${currentSong.key} | Meter: ${currentSong.timeSignature} | BPM: ${currentSong.bpm}
Total Measures: ${currentSong.measures.length} | Division: 480 Ticks/Beat (PPQ)
Tracks:
  - Track 0: Conductor (Tempo, Time Signature, Key Signature)
${midiKaraokeTrack && midiLyricType !== 'none' ? '  - Track 1: Words / Karaoke (Tune 1000 @KMIDI standard lyrics)\n' : ''}  - Track ${midiKaraokeTrack && midiLyricType !== 'none' ? '2' : '1'}: Melody / Vocal (${midiInstrument}, note-level 0xFF 0x05 lyrics)
${midiAccompaniment ? `  - Track ${midiKaraokeTrack && midiLyricType !== 'none' ? '3' : '2'}: Accompaniment (Acoustic Piano Chords)\n` : ''}Lyrics Mode: ${lyricDesc}
Synchronized Syllables:
${midiLyricsSummary.previewLines.map(l => `  [M${l.measureNumber}${l.section ? ` · ${l.section}` : ''}] ${l.text}`).join('\n') || '  (No lyrics)'}`;

      navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    navigator.clipboard.writeText(currentExportString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMidi = (format: 'mid' | 'kar') => {
    downloadMidiFile(currentSong, {
      includeAccompaniment: midiAccompaniment,
      lyricType: midiLyricType,
      instrument: midiInstrument,
      format,
      includeKaraokeTrack: midiKaraokeTrack,
      includeMelodyLyrics: midiMelodyLyrics,
    });
  };

  const handleDownloadFile = () => {
    if (exportFormat === 'midi') {
      handleDownloadMidi(midiFormat);
      return;
    }
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

  const handleImportSubmit = async () => {
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
      try {
        await saveSongToDB(loadedSong);
      } catch (err) {
        console.warn('[ImportExportModal] IndexedDB save on import fallback:', err);
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
                {PRESET_SONGS.map(preset => {
                  const isModified = modifiedPresetIds.has(preset.id);
                  return (
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                              {preset.title}
                            </h4>
                            {isModified && (
                              <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/50">
                                已儲存修改
                              </span>
                            )}
                          </div>
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
                        <div className="flex items-center gap-2">
                          {isModified && onResetPreset && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`確定要將《${preset.title}》恢復為原曲預設嗎？這將會清除您在此曲上的個人修改。`)) {
                                  onResetPreset(preset.id);
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer text-xs font-semibold"
                              title="重設為原曲預設"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>重設為原曲</span>
                            </button>
                          )}
                          <span className="font-medium text-amber-600 dark:text-amber-400 group-hover:underline">
                            {isModified ? '載入修改版 →' : '載入原曲 →'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mr-1">Format:</span>
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
                    Plain Text (.txt)
                  </button>
                  <button
                    id="export-format-midi-btn"
                    onClick={() => setExportFormat('midi')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      exportFormat === 'midi'
                        ? 'bg-amber-500 text-zinc-950 shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5 inline mr-1" />
                    MIDI (.mid)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="export-copy-btn"
                    onClick={handleCopyExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : exportFormat === 'midi' ? 'Copy Info' : 'Copy'}</span>
                  </button>
                  <button
                    id="export-download-btn"
                    onClick={handleDownloadFile}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download {exportFormat === 'midi' ? (midiFormat === 'kar' ? '.kar' : '.mid') : 'File'}</span>
                  </button>
                </div>
              </div>

              {exportFormat === 'midi' ? (
                <div id="midi-export-config" className="flex flex-col gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
                  {/* Song Metadata Strip */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                      Standard MIDI Format 1 (480 PPQ)
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                      Key: 1={currentSong.key}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                      Meter: {currentSong.timeSignature}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                      Tempo: {currentSong.bpm} BPM
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {currentSong.measures.length} Measures
                    </span>
                  </div>

                  {/* Format & File Extension Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div>
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Export File Type (輸出檔案格式)
                      </span>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Choose between standard DAW MIDI (.mid) or player-ready MIDI Karaoke (.kar).
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setMidiFormat('mid')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          midiFormat === 'mid'
                            ? 'bg-amber-500 text-zinc-950 shadow-xs'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        .MID (Standard)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMidiFormat('kar')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          midiFormat === 'kar'
                            ? 'bg-amber-500 text-zinc-950 shadow-xs'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        .KAR (Karaoke)
                      </button>
                    </div>
                  </div>

                  {/* Settings Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Lyric Sync Mode */}
                    <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          Synchronized Lyrics (同步歌詞)
                        </label>
                        {midiLyricsSummary.totalSyllables > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {midiLyricsSummary.totalSyllables} syllables
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setMidiLyricType('hanlo')}
                          className={`px-2 py-1.5 rounded-md font-medium text-center transition-all cursor-pointer ${
                            midiLyricType === 'hanlo'
                              ? 'bg-amber-500 text-zinc-950 font-bold'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          漢羅 (Hanlo)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMidiLyricType('poj')}
                          className={`px-2 py-1.5 rounded-md font-medium text-center transition-all cursor-pointer ${
                            midiLyricType === 'poj'
                              ? 'bg-amber-500 text-zinc-950 font-bold'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          POJ (羅馬字)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMidiLyricType('both')}
                          className={`px-2 py-1.5 rounded-md font-medium text-center transition-all cursor-pointer ${
                            midiLyricType === 'both'
                              ? 'bg-amber-500 text-zinc-950 font-bold'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          雙語 (Both)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMidiLyricType('none')}
                          className={`px-2 py-1.5 rounded-md font-medium text-center transition-all cursor-pointer ${
                            midiLyricType === 'none'
                              ? 'bg-amber-500 text-zinc-950 font-bold'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          None (純音)
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                        Embeds UTF-8 lyric events synchronized with each note onset and syllable duration.
                      </p>
                    </div>

                    {/* Instrument Patch */}
                    <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col gap-2">
                      <label htmlFor="midi-instrument-select" className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Melody Sound Patch (主旋律音色)
                      </label>
                      <select
                        id="midi-instrument-select"
                        value={midiInstrument}
                        onChange={e => setMidiInstrument(e.target.value as InstrumentType)}
                        className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="piano">Acoustic Grand Piano (GM #1)</option>
                        <option value="flute">Bamboo Flute / Flute (GM #74)</option>
                        <option value="whistle">Whistle (GM #79)</option>
                        <option value="guitar">Acoustic Guitar Nylon (GM #25)</option>
                        <option value="synth">Lead 1 Square Synth (GM #81)</option>
                        <option value="bell">Glockenspiel / Bell (GM #10)</option>
                        <option value="cello">Cello (GM #43)</option>
                      </select>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                        General MIDI program change assigned to Melody / Vocal track.
                      </p>
                    </div>
                  </div>

                  {/* Track Inclusion Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Dedicated Words / Karaoke Track */}
                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hover:border-amber-400/60 transition-colors">
                      <input
                        type="checkbox"
                        checked={midiKaraokeTrack}
                        disabled={midiLyricType === 'none'}
                        onChange={e => setMidiKaraokeTrack(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-amber-500 focus:ring-amber-500 focus:ring-offset-0 border-zinc-300 dark:border-zinc-700 cursor-pointer disabled:opacity-50"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          Dedicated Karaoke Track (Track 1 &quot;Words&quot;)
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Tune 1000 standard tags (@KMIDI, @V, @T) with verse (\) and line (/) markers.
                        </span>
                      </div>
                    </label>

                    {/* Note-Level Lyrics */}
                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hover:border-amber-400/60 transition-colors">
                      <input
                        type="checkbox"
                        checked={midiMelodyLyrics}
                        disabled={midiLyricType === 'none'}
                        onChange={e => setMidiMelodyLyrics(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-amber-500 focus:ring-amber-500 focus:ring-offset-0 border-zinc-300 dark:border-zinc-700 cursor-pointer disabled:opacity-50"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          Note-Level Lyric Events (0xFF 0x05)
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Attaches lyrics directly to note onsets for DAWs, Synthesizer V, and MuseScore.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Chord Accompaniment Toggle */}
                  <label className="flex items-center gap-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hover:border-amber-400/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={midiAccompaniment}
                      onChange={e => setMidiAccompaniment(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 focus:ring-offset-0 border-zinc-300 dark:border-zinc-700 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Include Chord Accompaniment Track (Channel 2 和弦伴奏音軌)
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Generates acoustic grand piano harmonies from score chords across each measure.
                      </span>
                    </div>
                  </label>

                  {/* Live Synchronized Lyrics Preview Section */}
                  <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-amber-500" />
                        Synchronized Lyric Syllables in MIDI ({midiLyricType.toUpperCase()})
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {midiLyricsSummary.measuresWithLyrics} of {currentSong.measures.length} measures with lyrics
                      </span>
                    </div>

                    {midiLyricType === 'none' ? (
                      <div className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 text-xs text-center">
                        Lyric synchronization disabled. MIDI will be exported as pure instrumental tracks.
                      </div>
                    ) : midiLyricsSummary.totalSyllables === 0 ? (
                      <div className="p-3 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs text-center border border-amber-500/20">
                        No lyrics detected in this score yet. You can type Hanlo or POJ in the score editor.
                      </div>
                    ) : (
                      <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 font-mono text-xs">
                        {midiLyricsSummary.previewLines.map((line, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0 w-12">
                              M{line.measureNumber}
                            </span>
                            {line.section && (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                                {line.section}
                              </span>
                            )}
                            <span className="text-zinc-800 dark:text-zinc-200 break-all font-sans text-xs">
                              {line.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dual Action Download Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <button
                      id="midi-download-mid-btn"
                      type="button"
                      onClick={() => handleDownloadMidi('mid')}
                      className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download .MID (Standard MIDI)</span>
                    </button>
                    <button
                      id="midi-download-kar-btn"
                      type="button"
                      onClick={() => handleDownloadMidi('kar')}
                      className="py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download .KAR (Karaoke MIDI)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <textarea
                  id="export-preview-textarea"
                  readOnly
                  rows={12}
                  value={currentExportString}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-800 dark:text-zinc-200 select-all focus:outline-hidden"
                />
              )}
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
