"use client";

import { useEffect, useRef } from "react";
import { useJourney } from "@/lib/store";

/** A [data-cursor] target that is actually on screen (not hidden by its reveal). */
function liveTarget(el: Element | null): HTMLElement | null {
  const target = el?.closest?.("[data-cursor]") as HTMLElement | null;
  if (!target) return null;
  if (getComputedStyle(target).visibility === "hidden") return null;
  const root = target.closest("[data-reveal-root]") as HTMLElement | null;
  if (root && (getComputedStyle(root).visibility === "hidden" || parseFloat(getComputedStyle(root).opacity) < 0.5)) return null;
  return target;
}

/**
 * The only labelled cursor (Action layer): a small tracked word that follows the
 * pointer over elements with data-cursor ("open", "drag"). Fine pointers only,
 * never in reduced motion. Follows with a calm lag, no springs.
 *
 * It hides the moment its target is used (pointerdown), whenever the explore
 * state changes, and re-checks what is under the pointer after a scroll, so it
 * never floats over the scene once the card it named has gone.
 */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const label = labelRef.current;
    if (!el || !label) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let x = -100;
    let y = -100;
    let cx = x;
    let cy = y;
    let raf = 0;
    let shown = false;
    let hasPointer = false;
    /** After a press on a target, stay hidden until the pointer leaves it. */
    let suppressed: HTMLElement | null = null;

    const loop = () => {
      cx += (x - cx) * 0.28;
      cy += (y - cy) * 0.28;
      el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.3 ? requestAnimationFrame(loop) : 0;
    };
    const hide = () => {
      if (!shown) return;
      shown = false;
      el.dataset.on = "0";
    };
    const update = (target: HTMLElement | null) => {
      if (suppressed && target !== suppressed) suppressed = null;
      const word = target && !suppressed ? (target.dataset.cursor ?? "") : "";
      if (word) {
        if (label.textContent !== word) label.textContent = word;
        if (!shown) {
          cx = x;
          cy = y;
          shown = true;
          el.dataset.on = "1";
        }
      } else hide();
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || useJourney.getState().reducedMotion) return;
      hasPointer = true;
      x = e.clientX;
      y = e.clientY;
      update(liveTarget(e.target as Element | null));
    };
    const onDown = (e: PointerEvent) => {
      const target = (e.target as Element | null)?.closest?.("[data-cursor]") as HTMLElement | null;
      // "drag" stays with the hand while dragging; everything else is consumed.
      if (target && target.dataset.cursor !== "drag") {
        suppressed = target;
        hide();
      }
    };
    const recheck = () => {
      if (!hasPointer || useJourney.getState().reducedMotion) return;
      update(liveTarget(document.elementFromPoint(x, y)));
    };
    let scrollTimer = 0;
    const onScroll = () => {
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(recheck, 120);
    };
    const onLeave = () => {
      hasPointer = false;
      hide();
    };
    // The cards hide when exploring starts, the slider appears: re-check after the change settles.
    const unsub = useJourney.subscribe((s, p) => {
      if (s.mode !== p.mode || s.home !== p.home || s.place !== p.place) {
        hide();
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(recheck, 900);
      }
    });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true, capture: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      unsub();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown, { capture: true });
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.clearTimeout(scrollTimer);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="vl-cursor" data-on="0" aria-hidden="true">
      <span ref={labelRef} className="vl-cursor__label" />
    </div>
  );
}
