"use client";

import { useEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { useJourney, type JourneyState } from "./store";

if (typeof window !== "undefined") gsap.registerPlugin(SplitText);

/**
 * Store-driven reveals. A block is "inside" while `when(state)` is true: its
 * timeline plays forward (line-by-line masked rise, ~1.2 s expo-out) and
 * reverses gracefully when it is not. Deterministic in snap mode (?snap=1).
 *
 * Children opt in with data attributes, in document order:
 *   data-r="lines"  SplitText lines rising through masks
 *   data-r="fade"   opacity + a small lift
 *   data-r="rule"   hairline drawing in from the left
 *   data-r="mask"   horizontal wipe (wordmark)
 *   data-r="rise"   vertical wipe from the bottom (arch images)
 *   data-r="scrim"  soft background, fades with the block
 *   data-r-at="0.4" explicit start (s, after the block delay); otherwise sequential
 */
export interface RevealOptions {
  when: (s: JourneyState) => boolean;
  /** Seconds before the first element moves. */
  delay?: number;
  /** Interactive blocks are fully hidden (visibility) when out, so they can't take focus. */
  interactive?: boolean;
  /** Reverse speed multiplier — leaving is quicker than arriving. */
  reverseSpeed?: number;
  /** Called once per direction change. */
  onToggle?: (inside: boolean) => void;
}

export function useReveal(ref: RefObject<HTMLElement | null>, opts: RevealOptions) {
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.setAttribute("data-reveal-root", "");
    let tl: gsap.core.Timeline | null = null;
    let splits: SplitText[] = [];
    let inside = false;
    let disposed = false;
    let lastW = window.innerWidth;

    const build = () => {
      if (disposed) return;
      const prevProgress = tl ? tl.progress() : null;
      const prevReversed = tl ? tl.reversed() : false;
      tl?.kill();
      splits.forEach((s) => s.revert());
      splits = [];

      const { delay = 0, interactive = false } = optsRef.current;
      const reduced = useJourney.getState().reducedMotion;
      const t = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
      t.fromTo(root, interactive ? { autoAlpha: 0 } : { opacity: 0 }, { ...(interactive ? { autoAlpha: 1 } : { opacity: 1 }), duration: 0.01, ease: "none" }, 0);

      let at = delay;
      root.querySelectorAll<HTMLElement>("[data-r]").forEach((el) => {
        // Nested reveal blocks animate themselves.
        if (el.closest("[data-reveal-root]") !== root) return;
        const kind = el.dataset.r;
        const pos = el.dataset.rAt != null ? delay + parseFloat(el.dataset.rAt) : at;
        if (kind === "scrim") {
          t.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 1.3, ease: "power2.out" }, delay);
          return;
        }
        if (reduced) {
          t.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "power2.out" }, pos);
          at = pos + 0.08;
          return;
        }
        switch (kind) {
          case "lines": {
            const sp = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "vl-line", aria: "auto" });
            splits.push(sp);
            t.fromTo(sp.lines, { yPercent: 112 }, { yPercent: 0, duration: 1.25, stagger: 0.09 }, pos);
            at = pos + 0.12 + sp.lines.length * 0.09;
            break;
          }
          case "rule":
            t.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "expo.inOut", transformOrigin: "0% 50%" }, pos);
            at = pos + 0.1;
            break;
          case "mask":
            t.fromTo(el, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.8, ease: "expo.inOut" }, pos);
            at = pos + 0.45;
            break;
          case "rise":
            t.fromTo(el, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.inOut" }, pos);
            {
              const img = el.querySelector("img");
              if (img) t.fromTo(img, { scale: 1.12 }, { scale: 1, duration: 2.0, ease: "expo.out" }, pos);
            }
            at = pos + 0.2;
            break;
          default:
            t.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.1, ease: "quart.out" }, pos);
            at = pos + 0.08;
        }
      });
      tl = t;
      root.dataset.revealReady = "1";

      if (prevProgress != null) {
        t.progress(prevProgress);
        if (prevReversed) t.reverse();
        else if (inside && prevProgress < 1) t.play();
      } else {
        inside = false;
        apply();
      }
    };

    const apply = () => {
      const s = useJourney.getState();
      const now = optsRef.current.when(s);
      if (!tl) return;
      if (now === inside) return;
      inside = now;
      optsRef.current.onToggle?.(now);
      if (s.snap) {
        tl.pause();
        tl.progress(now ? 1 : 0);
        return;
      }
      if (now) tl.timeScale(1).play();
      else tl.timeScale(optsRef.current.reverseSpeed ?? 1.7).reverse();
    };

    const unsub = useJourney.subscribe(apply);
    let resizeTimer = 0;
    const onResize = () => {
      if (Math.abs(window.innerWidth - lastW) < 2) return;
      lastW = window.innerWidth;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(build, 180);
    };
    window.addEventListener("resize", onResize);

    const fonts = document.fonts?.ready ?? Promise.resolve();
    fonts.then(() => requestAnimationFrame(build)).catch(build);

    return () => {
      disposed = true;
      unsub();
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      tl?.kill();
      splits.forEach((s) => s.revert());
    };
  }, [ref]);
}
