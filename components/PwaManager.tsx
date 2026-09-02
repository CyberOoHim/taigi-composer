'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

export const PwaManager: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });
  const [showBanner, setShowBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !navigator.onLine;
  });

  // Register Service Worker & online/offline listeners
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
                  console.log('New content available; reloading may be needed.');
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('Service Worker registration skipped or failed:', err);
        });
    }

    // Check online/offline status via event listener
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent automatic mini-infobar
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);

      // Check if user previously dismissed in this session
      const dismissed = sessionStorage.getItem('pwa_prompt_dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setShowBanner(false);
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
    setShowBanner(false);
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  return (
    <>
      {/* Offline Status Pill Notification */}
      {isOffline && (
        <div
          id="pwa-offline-indicator"
          className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 text-amber-400 border border-amber-500/30 text-xs font-semibold shadow-lg backdrop-blur-md animate-in fade-in duration-200"
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>離線模式：簡譜編輯與卡拉OK仍可正常運作</span>
        </div>
      )}

      {/* PWA Install Notification Card */}
      {showBanner && isInstallable && !isInstalled && (
        <aside
          id="pwa-install-banner"
          aria-label="PWA 安裝提示"
          className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] p-4 rounded-2xl bg-zinc-900/95 text-white border border-amber-500/40 shadow-2xl backdrop-blur-lg animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-zinc-950 font-bold shadow-md shadow-amber-500/20 shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  <span>安裝台語簡譜 App</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded-full font-mono">
                    PWA
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  安裝至桌面或手機，支援離線簡譜創作與即時卡拉OK演奏！
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
              title="關閉提示"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-zinc-800">
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium transition-colors cursor-pointer"
            >
              稍後再說
            </button>
            <button
              id="pwa-install-confirm-btn"
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>立即安裝 (Install)</span>
            </button>
          </div>
        </aside>
      )}
    </>
  );
};
