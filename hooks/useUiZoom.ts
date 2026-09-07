'use client';

import { useSyncExternalStore, useEffect, useCallback } from 'react';
import { getStoredUiZoom, setStoredUiZoom } from '@/lib/storage';

export const UI_ZOOM_LEVELS = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5] as const;
export const UI_ZOOM_MIN = 0.8;
export const UI_ZOOM_MAX = 1.5;
export const UI_ZOOM_DEFAULT = 1.0;

let memoryZoom: number = UI_ZOOM_DEFAULT;
let hasInitialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(listener => {
    try {
      listener();
    } catch (err) {
      console.error('[useUiZoom] Listener error:', err);
    }
  });
}

/**
 * Apply the current UI zoom factor to the document root element.
 * Scales standard rem typography and sets CSS variables for arbitrary pixel classes.
 */
export function applyUiZoomToDOM(zoom: number) {
  if (typeof document === 'undefined') return;
  const roundedPercent = Math.round(zoom * 100);
  document.documentElement.style.fontSize = `${roundedPercent}%`;
  document.documentElement.style.setProperty('--ui-text-zoom', String(zoom));
  document.documentElement.setAttribute('data-ui-zoom', String(roundedPercent));
}

function initMemoryZoom() {
  if (hasInitialized || typeof window === 'undefined') return;
  hasInitialized = true;
  const stored = getStoredUiZoom(UI_ZOOM_DEFAULT);
  memoryZoom = stored;
  applyUiZoomToDOM(memoryZoom);
}

/**
 * Global setter for UI Zoom that syncs DOM, localStorage, and all subscribed components.
 */
export function setUiZoomGlobal(newZoom: number) {
  const clamped = Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, Math.round(newZoom * 10) / 10));
  if (memoryZoom === clamped) return;
  memoryZoom = clamped;
  setStoredUiZoom(clamped);
  applyUiZoomToDOM(clamped);
  notify();
}

function subscribe(callback: () => void) {
  initMemoryZoom();
  listeners.add(callback);

  // Sync across browser tabs
  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'taigi_composer_ui_text_zoom' && e.newValue) {
      const val = parseFloat(e.newValue);
      if (!isNaN(val) && val >= UI_ZOOM_MIN && val <= UI_ZOOM_MAX) {
        const clamped = Math.round(val * 10) / 10;
        if (memoryZoom !== clamped) {
          memoryZoom = clamped;
          applyUiZoomToDOM(clamped);
          notify();
        }
      }
    }
  };

  window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

function getSnapshot(): number {
  initMemoryZoom();
  return memoryZoom;
}

function getServerSnapshot(): number {
  return UI_ZOOM_DEFAULT;
}

export function useUiZoom() {
  const zoom = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const zoomIn = useCallback(() => {
    const current = Math.round(zoom * 10) / 10;
    const next = Math.min(UI_ZOOM_MAX, Math.round((current + 0.1) * 10) / 10);
    setUiZoomGlobal(next);
  }, [zoom]);

  const zoomOut = useCallback(() => {
    const current = Math.round(zoom * 10) / 10;
    const prev = Math.max(UI_ZOOM_MIN, Math.round((current - 0.1) * 10) / 10);
    setUiZoomGlobal(prev);
  }, [zoom]);

  const resetZoom = useCallback(() => {
    setUiZoomGlobal(UI_ZOOM_DEFAULT);
  }, []);

  const setZoom = useCallback((val: number) => {
    setUiZoomGlobal(val);
  }, []);

  // Keyboard shortcut listener: Alt + = (+), Alt + -, Alt + 0
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Require Alt key (or Option on Mac)
      if (!e.altKey) return;

      if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0' || e.code === 'Numpad0') {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  return {
    zoom,
    zoomPercent: Math.round(zoom * 100),
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
    canZoomIn: zoom < UI_ZOOM_MAX - 0.01,
    canZoomOut: zoom > UI_ZOOM_MIN + 0.01,
  };
}
