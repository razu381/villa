"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useJourney } from "@/lib/store";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
  // Before any section's effect runs: the shared pieces (reveals, the form, the
  // invitation card) read motion settings from the store.
  const params = new URLSearchParams(window.location.search);
  const store = useJourney.getState();
  store.setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.get("rm") === "1");
  store.setSnap(params.get("snap") === "1");
}

/** Reduced motion or deterministic screenshots (?snap=1): no smooth scroll, pins, film or auto-advance. */
export const stillMode = () => {
  const s = useJourney.getState();
  return s.reducedMotion || s.snap;
};

export { gsap, ScrollTrigger };
