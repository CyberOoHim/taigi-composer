'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-zinc-100 font-sans">
        <div className="max-w-md w-full p-8 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-5">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-black mb-2">系統錯誤 (System Error)</h2>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            應用程式初始化時遇到問題，請點擊下方按鈕重試。
          </p>

          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>重新啟動應用程式 (Restart App)</span>
          </button>
        </div>
      </body>
    </html>
  );
}
