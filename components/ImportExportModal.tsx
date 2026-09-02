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
  deleteSongFromCustomLibrary,
} from '@/lib/storage';
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
} from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song;
  onLoadSong: (song: Song) => void;
  onOpenScanner?: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  currentSong,
  onLoadSong,
  onOpenScanner,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'export' | 'import' | 'ai_scan'>('presets');
  const [exportFormat, setExportFormat] = useState<'json' | 'text'>('json');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  // Refresh custom songs when opening modal or performing actions
  const [customSongs, setCustomSongs] = useState<Song[]>(() => {
    if (typeof window !== 'undefined') return getStoredCustomLibrary();
    return [];
  });

  const handleSaveToCustomLibrary = () => {
    const updated = saveSongToCustomLibrary(currentSong);
    setCustomSongs(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
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
            <span>樂曲庫與匯入/匯出 (Song Library & Import / Export)</span>
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
            <span>精選名曲 (Presets)</span>
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
            <span>自訂曲庫 ({customSongs.length})</span>
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
            <span>匯出樂譜</span>
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
            <span>匯入樂譜</span>
          </button>

          <button
            id="tab-ai-scan-btn"
            onClick={() => setActiveTab('ai_scan')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'ai_scan'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <ScanLine className="w-4 h-4 text-amber-500 shrink-0" />
            <span>AI 圖片識譜</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {/* TAB 1: PRESET SONGS */}
          {activeTab === 'presets' && (
            <div id="presets-panel" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  點擊即可載入完整台語簡譜、和弦與漢字/白話字/臺羅對齊歌詞：
                </p>
                <button
                  type="button"
                  onClick={handleSaveToCustomLibrary}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 text-xs font-bold transition-all cursor-pointer"
                  title="將目前正在編寫的樂曲儲存至自訂曲庫"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-amber-500" />
                  <span>{savedSuccess ? '已儲存至自訂曲庫！' : '儲存當前曲目至自訂曲庫'}</span>
                </button>
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
                      <span>{preset.measures.length} 小節 (Bars)</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400 group-hover:underline">
                        載入 (Load) →
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
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  保存在瀏覽器 LocalStorage 中的自訂創作曲庫（共 {customSongs.length} 首）：
                </p>
                <button
                  type="button"
                  onClick={handleSaveToCustomLibrary}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold transition-all shadow-xs hover:bg-amber-400 cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>{savedSuccess ? '已儲存！' : '儲存當前曲目'}</span>
                </button>
              </div>

              {customSongs.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center gap-2">
                  <FolderHeart className="w-10 h-10 text-zinc-400" />
                  <h4 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">目前尚無自訂樂曲</h4>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    點擊「儲存當前曲目」即可將正在創作的樂曲保存在此處，或從「匯入樂譜」貼上外部樂譜。
                  </p>
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
                              title="從自訂曲庫移除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                          {cSong.description || cSong.subtitle || '自訂創作簡譜'}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <span>{cSong.measures.length} 小節 (Bars)</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400 group-hover:underline">
                          載入 (Load) →
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
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">格式 (Format):</span>
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
                    純文字簡譜對齊 (.txt)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="export-copy-btn"
                    onClick={handleCopyExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? '已複製 (Copied)' : '複製 (Copy)'}</span>
                  </button>
                  <button
                    id="export-download-btn"
                    onClick={handleDownloadFile}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>下載檔案 (Download)</span>
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
                  貼上 JSON 或是文字簡譜格式，或上傳檔案：
                </p>

                <label htmlFor="import-file-input" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>選擇檔案 (Upload File)</span>
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
                placeholder="貼上 JSON 字串 或 純文字簡譜 (e.g. Title: 望春風, Key: F, [Measure 1] ...)"
                className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />

              <div className="flex justify-end">
                <button
                  id="import-submit-btn"
                  type="button"
                  onClick={handleImportSubmit}
                  disabled={!importText.trim()}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-sm shadow-md transition-all disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>確認匯入 (Confirm Import)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: AI IMAGE SCORE SCAN */}
          {activeTab === 'ai_scan' && (
            <div id="ai-scan-panel" className="flex flex-col gap-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/70 dark:border-amber-700/70 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                    <ScanLine className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-base flex items-center gap-2">
                      <span>Gemini AI 多模態圖片識譜</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-mono font-bold">
                        1~3 頁
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      上傳實體歌本、簡譜或歌詞照片，AI 自動辨識旋律、節奏、八度、和弦與台語音節聲調！
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-zinc-600 dark:text-zinc-400 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                  <div className="flex flex-col gap-1 p-2 rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">1. 上傳 1~3 頁圖片</span>
                    <span className="text-[11px] text-zinc-500">支援手機拍照或掃描檔，自動壓縮與最佳化。</span>
                  </div>
                  <div className="flex flex-col gap-1 p-2 rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">2. Gemini AI 解析</span>
                    <span className="text-[11px] text-zinc-500">深度樂理思考，多頁小節自動無縫拼接。</span>
                  </div>
                  <div className="flex flex-col gap-1 p-2 rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">3. 預覽並一鍵匯入</span>
                    <span className="text-[11px] text-zinc-500">對照原圖檢查，可匯入新曲或追加小節。</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    id="launch-ai-scanner-btn"
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenScanner) onOpenScanner();
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-extrabold text-sm shadow-md transition-all active:scale-98 cursor-pointer"
                  >
                    <ScanLine className="w-4 h-4" />
                    <span>開啟 AI 圖片識譜工具 (Open AI Scanner) →</span>
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
