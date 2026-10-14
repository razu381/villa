"use client";

import { useEffect, useRef } from "react";
import { useJourney } from "@/lib/store";
import { stagesFromT } from "@/lib/timeline";

/**
 * PLACEHOLDER (DOM module will refine): the hero film loop, fixed above the
 * canvas, fading out as the 3D world takes over (stages.heroFade).
 */
export function HeroVideo() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      useJourney.subscribe((s) => {
        const k = stagesFromT(s.t).heroFade;
        if (ref.current) {
          ref.current.style.opacity = String(1 - k);
          ref.current.style.visibility = k >= 0.999 ? "hidden" : "visible";
        }
      }),
    [],
  );
  return (
    <div ref={ref} style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "#1c1e17" }} aria-hidden="true">
      <video autoPlay muted loop playsInline poster="/media/hero-poster.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }}>
        <source src="/media/hero-loop.webm" type="video/webm" />
        <source src="/media/hero-loop.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
