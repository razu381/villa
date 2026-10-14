"use client";

import { useRef } from "react";
import { COPY, BRAND } from "@/lib/content";
import { smooth } from "@/lib/timeline";
import { useJourneyEffect } from "@/lib/ui-media";
import { useReveal } from "@/lib/ui-reveal";
import { Wordmark } from "../ui/Brand";
import { Pin } from "../ui/Pin";

/**
 * Chapter 0 — first light. The film plays behind (HeroMedia); over it the
 * wordmark in limestone, the place, one line and the signature. As the day
 * begins (t 0.1 → 0.42) the type drifts up and away; then the match cut.
 */
export function HeroChapter() {
  const exitRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);

  useReveal(blockRef, { when: (s) => s.t < 0.5, delay: 0.35, reverseSpeed: 1 });
  useReveal(cueRef, { when: (s) => s.t < 0.12, delay: 1.6 });

  useJourneyEffect((s) => {
    const el = exitRef.current;
    if (!el) return;
    const k = smooth(0.08, 0.42, s.t);
    el.style.opacity = String(1 - k);
    el.style.transform = s.reducedMotion ? "" : `translate3d(0, ${(-k * 6).toFixed(3)}vh, 0)`;
    el.style.visibility = k >= 0.999 ? "hidden" : "visible";
  });

  return (
    <Pin className="vl-hero">
      <div ref={exitRef} className="vl-hero__exit">
        <div ref={blockRef} className="vl-hero__block">
          <p className="vl-eyebrow vl-hero__eyebrow" data-r="fade">
            <span className="vl-eyebrow__rule" aria-hidden="true" />
            {COPY.hero.eyebrow}
          </p>
          <h1 className="vl-hero__title" data-r="mask" data-r-at="0.15">
            <Wordmark className="vl-hero__wordmark" label={null} />
            <span className="sr-only">{BRAND.name}</span>
          </h1>
          <div className="vl-hero__row">
            <p className="vl-hero__line" data-r="lines" data-r-at="0.9">
              {COPY.hero.line}
            </p>
            <p className="vl-hero__sig" data-r="fade" data-r-at="1.25" lang="en">
              {BRAND.tagline}
            </p>
          </div>
        </div>
      </div>
      <div ref={cueRef} className="vl-cue" aria-hidden="true">
        <span className="vl-cue__label" data-r="fade">
          {COPY.hero.cue}
        </span>
        <span className="vl-cue__line" data-r="fade">
          <span className="vl-cue__run" />
        </span>
      </div>
    </Pin>
  );
}
