"use client";

import { useJourney, type HomeId, type Place } from "@/lib/store";

/**
 * Focus intent for the Action layer: set by a visitor's own choice, consumed once
 * the panel has actually appeared (a debug ?home= load never steals focus).
 */
export const focusIntent = { panel: false };

/** Enter the interactive moment: the camera cranes in, the home opens, the day pauses. */
export function enterExplore(id: HomeId, opts: { focusPanel?: boolean } = {}) {
  if (opts.focusPanel) focusIntent.panel = true;
  // Settle any scroll still gliding: from here on, scrolling means "let the home go".
  window.__lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
  const s = useJourney.getState();
  s.setHome(id);
  s.setExplode(1);
  s.setMode("explore");
}

/** Back to the village: the day resumes from the journey. */
export function exitExplore() {
  const s = useJourney.getState();
  if (s.mode === "journey" && s.home == null && s.sunOverride == null && s.explode === 0) return;
  focusIntent.panel = false;
  s.setViewer(null);
  s.setMode("journey");
  s.setHome(null);
  s.setExplode(0);
  s.setSunOverride(null);
}

/** Open a place's photos at one of them (the panel's render, a pin, `?photo=`). */
export function openPhotos(place: Place, index: number) {
  useJourney.getState().setViewer({ place, index });
}

/** The viewer starts to close: the 3D comes back at once, under its fade. */
export function closePhotos() {
  useJourney.getState().setViewer(null);
}

/** Run after the reveal timelines have rendered their first frame (two animation frames). */
export function afterReveal(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/** Leave explore from the Back control or Escape, returning focus to the home's card. */
export function backToVillage() {
  const id = useJourney.getState().home;
  exitExplore();
  if (!id) return;
  afterReveal(() => document.querySelector<HTMLButtonElement>(`.vl-card[data-home="${id}"]`)?.focus({ preventScroll: true }));
}

export const inHomes = (t: number) => t >= 5 && t < 6;

/** Scrolling this far (journey t, ~180 px) either way from where a home was opened closes it. */
export const EXPLORE_RELEASE = 0.06;
