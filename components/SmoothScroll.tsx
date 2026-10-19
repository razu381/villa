"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { CHAPTERS, clamp01, dayFromT } from "@/lib/timeline";
import { useJourney, type HomeId } from "@/lib/store";
import { detectTier } from "@/lib/tier";

declare global {
  interface Window {
    __lenis?: Lenis | null;
  }
}

/**
 * Lenis (wheel smoothing only — touch stays native) on the GSAP ticker, and the
 * scroll → journey `t` mapping.
 *
 * Debug / screenshot params:
 *   ?t=3.4        jump to journey position 3.4
 *   ?snap=1       skip all damping (deterministic frames)
 *   ?home=v3|v4|heart  explore mode on a place   ?sun=0.0–1.0  hold the sun
 *   ?rm=1         force reduced motion       ?tier=high|mid|low
 *   ?invite=demo  the invitation card, pre-filled (components/night/Invitation)
 *   ?yaw=90&pitch=10  an open place turned (degrees, lib/orbit.ts)
 *   ?grain=0 / ?probe=1  for scripts/flicker.mjs (no film grain / probe hooks, canvas/Probe.tsx)
 *   ?photo=v4-pool  a spot's photos open once ready (lib/places.ts, components/homes/PlaceViewer)
 */
export function SmoothScroll() {
  useEffect(() => {
    const store = useJourney.getState();
    const params = new URLSearchParams(window.location.search);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.get("rm") === "1";
    store.setReducedMotion(reduced);
    store.setSnap(params.get("snap") === "1");
    store.setTier(detectTier());
    const home = params.get("home");
    if (home === "v3" || home === "v4") {
      store.setHome(home as HomeId);
      store.setMode("explore");
      store.setExplode(1);
    } else if (home === "heart") {
      store.setPlace("heart");
      store.setMode("explore");
    }
    const sun = params.get("sun");
    if (sun != null) store.setSunOverride(clamp01(parseFloat(sun)));

    const lenis = reduced ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: true, syncTouch: false });
    window.__lenis = lenis;
    const tick = (time: number) => lenis?.raf(time * 1000);
    if (lenis) {
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    let sections: { top: number; height: number }[] = [];
    // In ?t= debug mode the journey position is frozen at the requested value.
    let frozen = false;
    const measure = () => {
      sections = CHAPTERS.map((c) => {
        const el = document.querySelector<HTMLElement>(`[data-chapter="${c.id}"]`);
        if (!el) return { top: 0, height: 1 };
        const r = el.getBoundingClientRect();
        return { top: r.top + window.scrollY, height: Math.max(1, r.height) };
      });
    };
    const compute = () => {
      if (frozen) return;
      const y = window.scrollY;
      let i = 0;
      while (i < sections.length - 1 && y >= sections[i + 1].top) i++;
      const t = i + clamp01((y - sections[i].top) / sections[i].height);
      const s = useJourney.getState();
      s.setT(t);
      s.setJourneyDay(dayFromT(t));
    };
    const onResize = () => {
      measure();
      compute();
    };
    measure();
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => {
      measure();
      compute();
    });
    ro.observe(document.body);

    const tParam = params.get("t");
    let raf = 0;
    if (tParam != null) {
      const tv = Math.max(0, parseFloat(tParam));
      raf = requestAnimationFrame(() => {
        measure();
        const i = Math.min(CHAPTERS.length - 1, Math.floor(tv));
        const y = sections[i].top + (tv - i) * sections[i].height;
        if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo(0, y);
        compute();
        // Keep the requested t exact even if the page is shorter than the target.
        frozen = true;
        const s = useJourney.getState();
        s.setT(tv);
        s.setJourneyDay(dayFromT(tv));
      });
    }

    document.fonts?.ready.then(onResize).catch(() => {});

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      if (lenis) {
        gsap.ticker.remove(tick);
        lenis.destroy();
      }
      window.__lenis = null;
    };
  }, []);
  return null;
}
