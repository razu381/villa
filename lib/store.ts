"use client";

import { create } from "zustand";

export type HomeId = "v3" | "v4";
export type Tier = "high" | "mid" | "low";
export type Mode = "journey" | "explore";
/** The 3D canvas: live, its WebGL context lost (waiting / warming up again), or gone for the session. */
export type CanvasState = "live" | "lost" | "gone";

export interface JourneyState {
  /** Journey position, 0 → T_MAX (see lib/timeline.ts). Written by SmoothScroll. */
  t: number;
  /** Day progress from the journey (monotonic). */
  journeyDay: number;
  /**
   * "Hold the sun" override, 0 → 1 (dawn → night). null = follow the journey.
   * Written by the SunArc handle in the homes chapter.
   */
  sunOverride: number | null;
  /** journey = scroll drives everything; explore = interactive moment, day paused. */
  mode: Mode;
  /** Selected home in "Two ways to live". */
  home: HomeId | null;
  /** Exploded-view amount target for the selected home, 0 → 1. */
  explode: number;
  soundOn: boolean;
  tier: Tier;
  reducedMotion: boolean;
  /** 3D scene has rendered its first frames. */
  ready: boolean;
  /** Not "live": the aerial still stands in for the canvas (canvas/Experience.tsx watchContext). */
  canvas: CanvasState;
  /**
   * Debug / screenshot mode: jump straight to values instead of damping.
   * Set by `?snap=1` (scripts/shot.mjs) — consumers should skip easing when true.
   */
  snap: boolean;

  setT: (t: number) => void;
  setJourneyDay: (d: number) => void;
  setSunOverride: (v: number | null) => void;
  setMode: (m: Mode) => void;
  setHome: (h: HomeId | null) => void;
  setExplode: (v: number) => void;
  setSoundOn: (v: boolean) => void;
  setTier: (t: Tier) => void;
  setReducedMotion: (v: boolean) => void;
  setReady: (v: boolean) => void;
  setCanvas: (v: CanvasState) => void;
  setSnap: (v: boolean) => void;
}

export const useJourney = create<JourneyState>((set) => ({
  t: 0,
  journeyDay: 0,
  sunOverride: null,
  mode: "journey",
  home: null,
  explode: 0,
  soundOn: false,
  tier: "high",
  reducedMotion: false,
  ready: false,
  canvas: "live",
  snap: false,

  setT: (t) => set({ t }),
  setJourneyDay: (journeyDay) => set({ journeyDay }),
  setSunOverride: (sunOverride) => set({ sunOverride }),
  setMode: (mode) => set({ mode }),
  setHome: (home) => set({ home }),
  setExplode: (explode) => set({ explode }),
  setSoundOn: (soundOn) => set({ soundOn }),
  setTier: (tier) => set({ tier }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setReady: (ready) => set({ ready }),
  setCanvas: (canvas) => set({ canvas }),
  setSnap: (snap) => set({ snap }),
}));

/** Effective day progress: the held sun wins, otherwise the journey. */
export const effectiveDay = (s: Pick<JourneyState, "journeyDay" | "sunOverride">) =>
  s.sunOverride ?? s.journeyDay;
