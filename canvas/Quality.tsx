"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useJourney, type JourneyState, type Tier } from "@/lib/store";
import { stagesFromT } from "@/lib/timeline";

/** One rung of the quality ladder: canvas pixel ratio, tilt-shift, sun shadow map size. */
export interface QualityStep {
  dpr: number;
  tilt: boolean;
  shadow: number;
}

/**
 * The starting pixel ratio: the device's, at most 2, and at most ~4.5 MP of
 * canvas (a 4K or 5K screen would otherwise render 8–15 MP a frame).
 */
export function baseDpr() {
  return Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4.5e6 / (window.innerWidth * window.innerHeight)));
}

/**
 * Lighter and lighter, sharpness last: tilt-shift fades out first (a blur
 * itself, and one full-screen pass less), then the shadow map halves, and only
 * then the pixel ratio steps down (2 → 1.5 → 1.25 → 1), never below 80 % of
 * the start or below 1: a soft frame reads cheap.
 */
export function qualitySteps(tier: Tier, base: number): QualityStep[] {
  if (tier === "low") return [{ dpr: 1, tilt: false, shadow: 1024 }];
  const top = tier === "high" ? base : Math.min(base, 1.5);
  const floor = Math.max(1, top * 0.8);
  const dprs = [top, ...[1.5, 1.25, 1].filter((d) => d < top - 0.01 && d >= floor - 1e-3)];
  if (dprs[dprs.length - 1] - floor > 0.05) dprs.push(floor);
  if (tier === "mid") return dprs.map((dpr) => ({ dpr, tilt: false, shadow: 2048 }));
  return [
    { dpr: top, tilt: true, shadow: 4096 },
    { dpr: top, tilt: false, shadow: 4096 },
    ...dprs.map((dpr) => ({ dpr, tilt: false, shadow: 2048 })),
  ];
}

/** `?quality=N` pins a rung (shots, comparisons); `?snap=1` pins the top one. */
export function pinnedQuality(): number | null {
  const q = new URLSearchParams(window.location.search).get("quality");
  return q != null && Number.isFinite(parseInt(q, 10)) ? Math.max(0, parseInt(q, 10)) : null;
}

/**
 * Steps down the ladder when the frame rate can't hold, back up when it has
 * room to spare. Measures only once the scene is ready and on screen (the
 * warm-up and the paused hero would read as slow). After 3 flip-flops it
 * settles on the lightest rung it needed.
 */
export function Quality({ steps, level, setLevel }: { steps: number; level: number; setLevel: (l: number) => void }) {
  const ready = useJourney((s) => s.ready);
  const snap = useJourney((s) => s.snap);
  const worst = useRef(level);
  if (!ready || snap || steps < 2 || pinnedQuality() != null) return null;
  const go = (l: number) => {
    const next = Math.min(steps - 1, Math.max(0, l));
    worst.current = Math.max(worst.current, next);
    setLevel(next);
  };
  return (
    <PerformanceMonitor
      flipflops={3}
      // 60 Hz: step down below ~52 fps, up at a solid 59+. 120 Hz+: the drei defaults.
      bounds={(hz) => (hz > 100 ? [60, 100] : [52, 59])}
      onDecline={() => go(level + 1)}
      onIncline={() => go(level - 1)}
      onFallback={() => go(worst.current)}
    />
  );
}

/**
 * Stops the render loop while the hero film and the still aerial cover the
 * canvas: the GPU is left to the video. Restarts as the dissolve begins, well
 * before the 3D shows through (the aerial covers it to heroFade ≈ 0.7).
 * Also stopped for good once the canvas is gone (a lost context that never came back),
 * and while the photo viewer covers it (store.viewer): from the end of its fade in
 * (the camera's glide to a pin has settled by then) until it starts to close.
 */
export function FrameGate() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const clock = useThree((s) => s.clock);
  useEffect(() => {
    let paused = false;
    let covered = false;
    let timer = 0;
    const apply = (s: JourneyState) => {
      if (!s.viewer) {
        window.clearTimeout(timer);
        timer = 0;
        covered = false;
      } else if (!covered && !timer) {
        timer = window.setTimeout(() => {
          timer = 0;
          covered = true;
          apply(useJourney.getState());
        }, VIEWER_FADE_MS);
      }
      const hide = s.canvas === "gone" || (s.ready && stagesFromT(s.t).heroFade < 0.02) || (covered && s.viewer != null);
      if (hide === paused) return;
      paused = hide;
      // setFrameloop restarts the clock at 0: keep time continuous (stars, shimmer).
      const e = clock.elapsedTime;
      setFrameloop(hide ? "never" : "always");
      clock.elapsedTime = e;
    };
    apply(useJourney.getState());
    const unsub = useJourney.subscribe(apply);
    return () => {
      unsub();
      window.clearTimeout(timer);
      if (paused) setFrameloop("always");
    };
  }, [setFrameloop, clock]);
  return null;
}

/** The viewer's fade in (.vl-viewer, globals.css), plus a frame or two. */
const VIEWER_FADE_MS = 560;
