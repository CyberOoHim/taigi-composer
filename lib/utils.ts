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
  headerOffsetOrOptions: number | ScrollToCardOptions = 80
) {
  if (typeof window === 'undefined') return;

  const options: ScrollToCardOptions =
    typeof headerOffsetOrOptions === 'number'
      ? { headerOffset: headerOffsetOrOptions }
      : (headerOffsetOrOptions || {});

  const baseHeaderOffset = options.headerOffset ?? 80;
  const bottomPadding = options.bottomPadding ?? 24;
  const topPadding = options.topPadding ?? 16;
  const behavior = options.behavior ?? 'smooth';
  const align = options.align ?? 'auto';

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
    const effectiveHeaderOffset = Math.max(headerHeight + topPadding, baseHeaderOffset);

    const viewportHeight = window.innerHeight;
    const availableHeight = viewportHeight - effectiveHeaderOffset - bottomPadding;

    let targetScroll: number;

    if (align === 'bottom') {
      targetScroll = docBottom - (viewportHeight - bottomPadding);
    } else if (align === 'top') {
      targetScroll = docTop - effectiveHeaderOffset;
    } else if (align === 'center') {
      const remainingSpace = availableHeight - cardHeight;
      targetScroll = docTop - (effectiveHeaderOffset + remainingSpace / 2);
    } else {
      // 'auto' mode:
      // Always ensure the bottom of the card is visible so editing controls and HUD are never cut off.
      // If the card fits within the viewport, position top comfortably below the header.
      const remainingSpace = availableHeight - cardHeight;
      if (remainingSpace >= 0) {
        // Card fits! Keep top comfortably below header while ensuring bottom is completely above (viewportHeight - bottomPadding)
        const topMargin = effectiveHeaderOffset + Math.min(32, remainingSpace / 2);
        targetScroll = docTop - topMargin;
      } else {
        // Card is taller than available viewport:
        // Prioritize showing the bottom of the card so NoteEditorHud and batch inputs are clearly seen!
        targetScroll = docBottom - (viewportHeight - bottomPadding);
      }
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

  let resizeObserver: ResizeObserver | null = null;
  const attachObserverIfNeeded = (targetEl: HTMLElement) => {
    if (resizeObserver || typeof ResizeObserver === 'undefined') return;
    let lastHeight = 0;
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (Math.abs(height - lastHeight) > 4) {
          lastHeight = height;
          computeAndScroll('smooth');
        }
      }
    });

    resizeObserver.observe(targetEl);
    if (targetEl.parentElement) {
      resizeObserver.observe(targetEl.parentElement);
    }
  };

  // Immediate attempt
  computeAndScroll(behavior);

  // Milestones: after React commits (~40ms), mid-transition (~100ms),
  // post-transition-200 (~230ms), and final settlement (~360ms)
  const milestones = [40, 100, 230, 360];
  const timeoutIds: ReturnType<typeof setTimeout>[] = [];

  milestones.forEach(ms => {
    const tid = setTimeout(() => {
      computeAndScroll('smooth');
    }, ms);
    timeoutIds.push(tid);
  });

  // Cleanup after transition period (600ms)
  setTimeout(() => {
    resizeObserver?.disconnect();
    timeoutIds.forEach(tid => clearTimeout(tid));
  }, 600);
}
