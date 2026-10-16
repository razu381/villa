"use client";

import type { Tier } from "./store";

/**
 * Cheap device tiering without network calls or a probe context. `?tier=high|mid|low` overrides.
 * - low: no WebGL2, Save-Data, or very weak devices (≤ 2 cores or ≤ 2 GB) → minimal effects
 * - mid: phones and tablets (touch or small screen) → reduced DPR, lighter post
 * - high: laptops and desktops, including 4-core / 4 GB ones and integrated GPUs
 *   (3.3's adaptive quality keeps those smooth, not a blanket demotion)
 * No throwaway WebGL context: it cost tens of ms to seconds on every load and
 * used up one of iOS's few context slots. three needs WebGL2 anyway.
 */
export function detectTier(): Tier {
  if (typeof window === "undefined") return "high";
  const q = new URLSearchParams(window.location.search).get("tier");
  if (q === "high" || q === "mid" || q === "low") return q;
  if (typeof WebGL2RenderingContext === "undefined") return "low";
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return "low";
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 8;
  if (cores <= 2 || mem <= 2) return "low";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  if (coarse || small) return "mid";
  return "high";
}
