import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ScrollToCardOptions {
  headerOffset?: number;
  bottomPadding?: number;
  topPadding?: number;
  behavior?: ScrollBehavior;
  align?: 'auto' | 'bottom' | 'top' | 'center';
}

export function scrollToCardElement(
  elementId: string,
  headerOffsetOrOptions: number | ScrollToCardOptions = { align: 'top', headerOffset: 0 }
) {
  if (typeof window === 'undefined') return;

  const options: ScrollToCardOptions =
    typeof headerOffsetOrOptions === 'number'
      ? { headerOffset: headerOffsetOrOptions }
      : (headerOffsetOrOptions || {});

  const bottomPadding = options.bottomPadding ?? 24;
  const topPadding = options.topPadding ?? 16;
  const behavior = options.behavior ?? 'smooth';
  const align = options.align ?? 'top';

  const computeAndScroll = (currentBehavior: ScrollBehavior = behavior): boolean => {
    const el = document.getElementById(elementId);
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    const docTop = rect.top + currentScrollY;
    const docBottom = rect.bottom + currentScrollY;
    const cardHeight = rect.height;

    // Detect actual sticky header height if present in DOM
    const headerEl = document.querySelector('header');
    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 64;
    // For 'top' alignment (default for editing cards), default to 0 so the top edge of the card
    // is flush with the top of the viewport, eliminating any lingering banner or extra gap.
    const effectiveHeaderOffset =
      options.headerOffset !== undefined
        ? options.headerOffset
        : (align === 'top' ? 0 : Math.max(headerHeight + topPadding, 80));

    const viewportHeight = window.innerHeight;
    const availableHeight = viewportHeight - effectiveHeaderOffset - bottomPadding;

    let targetScroll: number;

    if (align === 'bottom') {
      targetScroll = docBottom - (viewportHeight - bottomPadding);
    } else if (align === 'center') {
      const remainingSpace = availableHeight - cardHeight;
      targetScroll = docTop - (effectiveHeaderOffset + remainingSpace / 2);
    } else {
      // 'top' or 'auto' mode:
      // Always ensure the top of the card is displayed starting from the very top, comfortably below the sticky header.
      targetScroll = docTop - effectiveHeaderOffset;
    }

    targetScroll = Math.max(0, targetScroll);

    // Only scroll if difference is significant to avoid jitter
    if (Math.abs(currentScrollY - targetScroll) > 3) {
      window.scrollTo({
        top: targetScroll,
        behavior: currentBehavior,
      });
    }

    attachObserverIfNeeded(el);
    return true;
  };

  // Clean up any previously active scroll session
  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }
  activeTimeouts.forEach(id => clearTimeout(id));
  activeTimeouts = [];

  const attachObserverIfNeeded = (targetEl: HTMLElement) => {
    if (activeObserver || typeof ResizeObserver === 'undefined') return;
    let lastHeight = 0;
    activeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (Math.abs(height - lastHeight) > 6) {
          lastHeight = height;
          computeAndScroll('smooth');
        }
      }
    });

    activeObserver.observe(targetEl);
    if (targetEl.parentElement) {
      activeObserver.observe(targetEl.parentElement);
    }
  };

  // Immediate attempt
  computeAndScroll(behavior);

  // Throttled milestones for layout shifts
  const milestones = [60, 150, 300, 500];
  milestones.forEach(ms => {
    const tid = setTimeout(() => {
      computeAndScroll('smooth');
    }, ms);
    activeTimeouts.push(tid);
  });

  // Cleanup after transition period (650ms)
  const cleanupId = setTimeout(() => {
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }
    activeTimeouts = [];
  }, 650);
  activeTimeouts.push(cleanupId);
}

let activeObserver: ResizeObserver | null = null;
let activeTimeouts: ReturnType<typeof setTimeout>[] = [];
