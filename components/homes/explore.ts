"use client";

import { spotFocus } from "@/lib/orbit";
import { spotIndex, type Spot } from "@/lib/places";
import { openPlace, useJourney, type Place } from "@/lib/store";

/**
 * Focus intent for the Action layer: set by a visitor's own choice, consumed once
 * the panel has actually appeared (a debug ?home= load never steals focus).
 */
export const focusIntent = { panel: false };

/** Enter the interactive moment: the camera cranes in, the home (or the village heart) opens, the day pauses. */
export function enterExplore(id: Place, opts: { focusPanel?: boolean } = {}) {
  if (opts.focusPanel) focusIntent.panel = true;
  endGlide();
  // Settle any scroll still gliding: from here on, scrolling means "let the home go".
  window.__lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
  const s = useJourney.getState();
  s.setHome(id === "heart" ? null : id);
  s.setPlace(id === "heart" ? "heart" : null);
  s.setExplode(id === "heart" ? 0 : 1);
  s.setMode("explore");
}

/** Back to the village: the day resumes from the journey. */
export function exitExplore() {
  const s = useJourney.getState();
  if (s.mode === "journey" && s.home == null && s.place == null && s.sunOverride == null && s.explode === 0) return;
  focusIntent.panel = false;
  endGlide();
  s.setViewer(null);
  s.setMode("journey");
  s.setHome(null);
  s.setPlace(null);
  s.setExplode(0);
  s.setSunOverride(null);
}

/** Open a place's photos at one of them (the panel's render, a pin, `?photo=`). */
export function openPhotos(place: Place, index: number) {
  useJourney.getState().setViewer({ place, index });
}

/** The viewer starts to close: the 3D comes back at once, under its fade (and a pin's view eases back). */
export function closePhotos() {
  endGlide();
  useJourney.getState().setViewer(null);
}

/** The camera's glide to a pin; then the photos open (CameraRig's GLIDE_RATE gets ~90 % there by then). */
const GLIDE_MS = 900;
let glideTimer = 0;

/** A pin: the camera glides toward its spot, then the spot's photos open. Reduced motion: at once. */
export function showSpot(spot: Spot) {
  const s = useJourney.getState();
  const open = () => openPhotos(spot.place, spotIndex(spot));
  if (s.reducedMotion || s.snap) return open();
  endGlide();
  spotFocus.key = spot.key;
  glideTimer = window.setTimeout(() => {
    glideTimer = 0;
    if (spotFocus.key === spot.key) open();
  }, GLIDE_MS);
}

function endGlide() {
  window.clearTimeout(glideTimer);
  glideTimer = 0;
  spotFocus.key = null;
}

/** Run after the reveal timelines have rendered their first frame (two animation frames). */
export function afterReveal(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/** Leave explore from the Back control or Escape, returning focus to what opened it (a home's card, the heart's link). */
export function backToVillage() {
  const id = openPlace(useJourney.getState());
  exitExplore();
  if (!id) return;
  afterReveal(() => document.querySelector<HTMLButtonElement>(`[data-place="${id}"]`)?.focus({ preventScroll: true }));
}

export const inHomes = (t: number) => t >= 5 && t < 6;

/** Scrolling this far (journey t, ~180 px) either way from where a home was opened closes it. */
export const EXPLORE_RELEASE = 0.06;
