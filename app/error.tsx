'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Download, RotateCcw, Home } from 'lucide-react';
import { getStoredCurrentSong } from '@/lib/storage';
import { exportSongToJson } from '@/lib/songParser';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    console.error('Unhandled Application Error:', error);
  }, [error]);

  const handleDownloadBackup = () => {
    try {
      const song = getStoredCurrentSong();
      const json = exportSongToJson(song);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.title || 'composer-backup'}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (err) {
      console.error('Backup download failed:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-5">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-black mb-2">發生非預期錯誤 (Unexpected Error)</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
          應用程式在運作或播放時遇到異常。您的樂譜資料已自動保存在本機，可透過下方按鈕立即備份下載。
        </p>

        {error.message && (
          <div className="w-full mb-6 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-left font-mono text-xs text-rose-500 dark:text-rose-400 overflow-x-auto max-h-32 border border-zinc-200 dark:border-zinc-700">
            {error.message}
          </div>
        )}

        <div className="w-full flex flex-col gap-3">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{downloaded ? '已成功下載備份 (Saved)' : '下載樂譜緊急備份 (Download Backup)'}</span>
          </button>

          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-zinc-500" />
            <span>重試並重新載入 (Try Again)</span>
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2 px-4 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>重新載入頁面 (Reload Page)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
