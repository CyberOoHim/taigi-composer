'use client';

import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Download, X, WifiOff, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const emptySubscribe = () => () => {};

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getIsOfflineSnapshot(): boolean {
  return typeof navigator !== 'undefined' ? !navigator.onLine : false;
}

function getIsOfflineServerSnapshot(): boolean {
  return false;
}

export const PwaManager: React.FC = () => {
  const hasMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const isOffline = useSyncExternalStore(subscribeOnline, getIsOfflineSnapshot, getIsOfflineServerSnapshot);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);

  // Register Service Worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Use relative or basePath for SW registration
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const swUrl = `${basePath}/sw.js`;

      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => {
          // Check for SW updates
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setHasUpdate(true);
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('Service Worker registration skipped or failed:', err);
        });
    }
  }, []);

  // Listen for beforeinstallprompt and appinstalled events
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent automatic mini-infobar
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsDismissed(true);
      console.log('Taigi Composer PWA was installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;

    // Show the native browser install prompt
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
    setIsDismissed(true);
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try { sessionStorage.setItem('pwa_prompt_dismissed', 'true'); } catch { /* storage blocked */ }
  };

  if (!hasMounted) {
    return null;
  }

  const isStandalone = Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let sessionDismissed = false;
  try { sessionDismissed = sessionStorage.getItem('pwa_prompt_dismissed') === 'true'; } catch { /* storage blocked */ }

  const isIosPrompt = Boolean(isIos && !isStandalone && !sessionDismissed && !isDismissed);
  const showBanner = !isDismissed && !sessionDismissed && !isInstalled && !isStandalone && (isInstallable || isIosPrompt);

  return (
    <>
      {/* Service Worker Update Toast */}
      {hasUpdate && (
        <div
          id="pwa-update-indicator"
          className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-2 rounded-2xl bg-amber-500 text-zinc-950 text-xs font-bold shadow-xl border border-amber-400 animate-in fade-in duration-200"
        >
          <span>發現新版本更新！</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-2.5 py-1 rounded-lg bg-zinc-950 text-amber-400 text-xs font-black hover:bg-zinc-900 transition-all cursor-pointer"
          >
            立即重新載入
          </button>
        </div>
      )}

      {/* Offline Status Pill Notification */}
      {isOffline && (
        <div
          id="pwa-offline-indicator"
          className="fixed bottom-[max(5rem,calc(env(safe-area-inset-bottom,0px)+4.5rem))] left-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 text-amber-400 border border-amber-500/30 text-xs font-semibold shadow-lg backdrop-blur-md animate-in fade-in duration-200"
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline mode: Score editing and Karaoke playback work seamlessly offline</span>
        </div>
      )}

      {/* PWA Install Notification Card (Android / Desktop or iOS/iPad) */}
      {showBanner && !isInstalled && (isInstallable || isIosPrompt) && (
        <aside
          id="pwa-install-banner"
          aria-label="PWA Install Prompt"
          className="fixed bottom-[max(5rem,calc(env(safe-area-inset-bottom,0px)+4.5rem))] right-4 z-40 max-w-sm w-[calc(100vw-2rem)] p-4 rounded-2xl bg-zinc-900/95 text-white border border-amber-500/40 shadow-2xl backdrop-blur-lg animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-zinc-950 font-bold shadow-md shadow-amber-500/20 shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  <span>安裝 Taigi Composer</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded-full font-mono">
                    iPad / PWA
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isIosPrompt
                    ? '點擊 Safari 分享按鈕 ⎋ 並選擇「加入主畫面」，即可享受全螢幕專業琴鍵與離線練習！'
                    : '安裝至本機即可在離線狀態下順暢編輯簡譜與卡拉OK伴奏！'}
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
              title="Dismiss prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-zinc-800">
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium transition-colors cursor-pointer"
            >
              稍後 (Later)
            </button>
            {!isIosPrompt && (
              <button
                id="pwa-install-confirm-btn"
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>立即安裝</span>
              </button>
            )}
          </div>
        </aside>
      )}
    </>
  );
};
