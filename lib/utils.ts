import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function scrollToCardElement(elementId: string, headerOffset = 80) {
  if (typeof window === 'undefined') return;
  const el = document.getElementById(elementId);
  if (!el) return;
  const elementTop = el.getBoundingClientRect().top;
  const targetTop = elementTop + (window.pageYOffset || document.documentElement.scrollTop) - headerOffset;
  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: 'smooth',
  });
}
