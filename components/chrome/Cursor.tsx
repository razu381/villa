"use client";

import { useEffect, useRef } from "react";
import { useJourney } from "@/lib/store";

/**
 * The only labelled cursor (Action layer): a small tracked word that follows the
 * pointer over elements with data-cursor ("open", "drag"). Fine pointers only,
 * never in reduced motion. Follows with a calm lag, no springs.
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
    const loop = () => {
      cx += (x - cx) * 0.28;
      cy += (y - cy) * 0.28;
      el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.3 ? requestAnimationFrame(loop) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || useJourney.getState().reducedMotion) return;
      x = e.clientX;
      y = e.clientY;
      const target = (e.target as Element | null)?.closest?.("[data-cursor]") as HTMLElement | null;
      const word = target?.dataset.cursor ?? "";
      if (word) {
        if (label.textContent !== word) label.textContent = word;
        if (!shown) {
          cx = x;
          cy = y;
          shown = true;
          el.dataset.on = "1";
        }
      } else if (shown) {
        shown = false;
        el.dataset.on = "0";
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onLeave = () => {
      shown = false;
      el.dataset.on = "0";
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="vl-cursor" data-on="0" aria-hidden="true">
      <span ref={labelRef} className="vl-cursor__label" />
    </div>
  );
}
