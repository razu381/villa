"use client";

import { CHAPTERS, chapterIndex, type ChapterId } from "./timeline";
import { useJourney } from "./store";

/** Scroll position (px) for a journey position t — the inverse of SmoothScroll's mapping. */
export function yForT(t: number): number {
  const i = Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(t)));
  const el = document.querySelector<HTMLElement>(`[data-chapter="${CHAPTERS[i].id}"]`);
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const top = r.top + window.scrollY;
  return top + (t - i) * r.height;
}

const easeInOutQuart = (k: number) => (k < 0.5 ? 8 * k * k * k * k : 1 - Math.pow(-2 * k + 2, 4) / 2);

/** Calm, long scroll to a y position. Lenis when present, native otherwise (instant in reduced motion). */
export function scrollToY(y: number, onComplete?: () => void) {
  const reduced = useJourney.getState().reducedMotion;
  const lenis = window.__lenis;
  const dy = Math.abs(y - window.scrollY) / Math.max(1, window.innerHeight);
  if (lenis && !reduced) {
    const duration = Math.min(3.6, 1.1 + dy * 0.16);
    lenis.scrollTo(y, { duration, easing: easeInOutQuart, onComplete: () => onComplete?.() });
    return;
  }
  window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
  if (onComplete) {
    if (reduced) requestAnimationFrame(() => onComplete());
    else window.setTimeout(onComplete, Math.min(2400, 500 + dy * 120));
  }
}

export function scrollToT(t: number, onComplete?: () => void) {
  scrollToY(yForT(t), onComplete);
}

/** Where each chapter is entered from the index / nav: past the start so its text is revealed. */
export const CHAPTER_ENTRY: Record<ChapterId, number> = {
  hero: 0,
  drawing: 1.3,
  model: 2.45,
  making: 3.45,
  cars: 4.5,
  homes: 5.3,
  night: 6.5,
};

export function scrollToChapter(id: ChapterId, onComplete?: () => void) {
  const i = chapterIndex(id);
  if (i < 0) return;
  scrollToT(CHAPTER_ENTRY[id], onComplete);
}
