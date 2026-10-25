"use client";

import { useEffect, useRef } from "react";
import { useJourney } from "@/lib/store";
import { clamp01 } from "@/lib/timeline";
import { damp } from "@/lib/ui-time";
import { UI } from "@/lib/ui-copy";
import { ARCH_PATH } from "../ui/Brand";
import { filmShownAt } from "../HeroMedia";

/** Seconds from navigation start: never shorter, so the arches draw instead of flashing. */
const MIN_S = 1.6;
/** Never longer: past this the page shows whatever it has (the poster, the still). */
const MAX_S = 9;

/**
 * Before the film: the three brand arches, small to large, on the film's dark
 * ground. Each traces itself in as the opening picture loads (store heroLoad,
 * from HeroMedia, with a slow creep so it never stands still), the third closes
 * once the film plays, and the layer fades off the opening. The hero's entrance
 * waits for it (store `loaded`). Painted with the first HTML; never in ?snap=1.
 * The scroll holds while it is up (at most MAX_S).
 */
export function Loader() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("is-live"); // JS is here: the CSS failsafe stands down
    const html = document.documentElement;
    const s0 = useJourney.getState();
    if (s0.snap) {
      el.hidden = true;
      s0.setLoaded(true);
      return;
    }
    html.classList.add("vl-loading");
    window.__lenis?.stop();

    const inks = Array.from(el.querySelectorAll<SVGPathElement>(".vl-loader__ink"));
    const ink = (k: number) => inks.forEach((p, i) => (p.style.strokeDashoffset = (1 - clamp01(k * 3 - i)).toFixed(4)));
    let shown = 0;
    let last = performance.now();
    let raf = 0;
    let timer = 0;
    let lifted = false;
    if (s0.reducedMotion) ink(1); // fades only: the arches stand drawn

    const release = () => {
      html.classList.remove("vl-loading");
      window.__lenis?.start();
    };
    const lift = () => {
      lifted = true;
      release();
      el.classList.add("is-done");
      useJourney.getState().setLoaded(true);
      timer = window.setTimeout(() => (el.hidden = true), 1600);
    };

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = useJourney.getState();
      const age = now / 1000;
      // The opening picture is up: the film plays (or the poster stands in), or,
      // deep in the journey, the 3D (or the still that replaces it) is.
      const settled = s.heroLoad >= 1 || (!filmShownAt(s.t) && (s.ready || s.canvas !== "live"));
      const done = (settled && age >= MIN_S) || age >= MAX_S;
      if (s.reducedMotion) {
        if (done) return lift();
      } else {
        const goal = done ? 1 : Math.min(0.9, Math.max(s.heroLoad * 0.9, 0.75 * (1 - Math.exp(-age / 3))));
        shown = damp(shown, goal, done ? 4.5 : 2.5, dt);
        ink(shown);
        if (done && shown > 0.995) return lift();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      if (!lifted) release();
    };
  }, []);

  return (
    <div ref={ref} className="vl-loader" role="status">
      <span className="sr-only">{UI.loader.label}</span>
      <div className="vl-loader__arches" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <svg key={n} className={`vl-loader__arch is-${n}`} viewBox="-4 -4 108 120">
            <path className="vl-loader__ghost" d={ARCH_PATH} />
            <path className="vl-loader__ink" d={ARCH_PATH} pathLength={1} />
          </svg>
        ))}
      </div>
      <p className="vl-loader__note" aria-hidden="true">
        {UI.loader.note}
      </p>
    </div>
  );
}
