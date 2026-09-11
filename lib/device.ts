/**
 * Device / browser capability helpers for iPad-first karaoke UX.
 * Keep UA checks in one place so WebKit vs Chromium branches stay consistent.
 */

export function isIosWebKit(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOsDesktopUa =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  return iOSDevice || iPadOsDesktopUa;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(media || iosStandalone);
}

export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
}

/** First-run layout: karaoke on iPad / standalone / coarse pointers to avoid split compositing. */
export function prefersKaraokeDefaultLayout(): boolean {
  return isIosWebKit() || isStandalonePwa() || isCoarsePointer();
}

export function supportsBatteryApi(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as Navigator & { getBattery?: unknown }).getBattery === 'function';
}

/** Fullscreen API is unreliable in iPadOS Safari; CSS stage mode is the real path. */
export function supportsNativeFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  if (isIosWebKit()) return false;
  return typeof document.documentElement.requestFullscreen === 'function';
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}
