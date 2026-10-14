"use client";

import type { Tier } from "./store";

/**
 * Cheap device tiering without network calls. `?tier=high|mid|low` overrides.
 * - low: no WebGL2, Save-Data, or very weak devices → minimal effects
 * - mid: phones / small screens / few cores → reduced DPR, lighter post
 * - high: everything else
 */
export function detectTier(): Tier {
  if (typeof window === "undefined") return "high";
  const q = new URLSearchParams(window.location.search).get("tier");
  if (q === "high" || q === "mid" || q === "low") return q;
  try {
    const c = document.createElement("canvas");
    if (!c.getContext("webgl2")) return "low";
  } catch {
    return "low";
  }
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return "low";
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 8;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  if (cores <= 2 || mem <= 2) return "low";
  if (coarse || small || cores <= 4 || mem <= 4) return "mid";
  return "high";
}
