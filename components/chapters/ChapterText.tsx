"use client";

import { useRef } from "react";
import type { JourneyState } from "@/lib/store";
import { useReveal } from "@/lib/ui-reveal";

export interface ChapterTextProps {
  eyebrow: string;
  title: string;
  body?: string;
  /** Journey window [from, to) in which the text is on screen. */
  from: number;
  to: number;
  /** Extra condition (e.g. hide while exploring a home). */
  also?: (s: JourneyState) => boolean;
  /** Where the block sits in the frame. */
  place?: "bottom" | "top";
  id?: string;
  /**
   * Compact screens, one idea at a time under one title: from `swapAt` the body
   * gives its place to `swap` (the chapter's notes or legend), while the eyebrow
   * and title stay. Both share one grid cell, so the title never moves.
   */
  swap?: React.ReactNode;
  swapAt?: number;
  children?: React.ReactNode;
}

/**
 * The chapter text block: wide-tracked eyebrow (time of day), display title,
 * short body. Left-aligned, generous space, a soft scrim only behind itself.
 * Lines rise through masks while the journey is inside [from, to).
 */
export function ChapterText({ eyebrow, title, body, from, to, also, place = "bottom", id, swap, swapAt, children }: ChapterTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, { when: (s) => s.t >= from && s.t < to && (also ? also(s) : true) });
  const swapping = swap != null && swapAt != null;
  return (
    <div ref={ref} className="vl-text" data-place={place}>
      <div className="vl-text__scrim" data-r="scrim" aria-hidden="true" />
      <p className="vl-eyebrow">
        <span className="vl-eyebrow__rule" data-r="rule" aria-hidden="true" />
        <span data-r="fade" data-r-at="0.1">
          {eyebrow}
        </span>
      </p>
      <h2 className="vl-title" id={id} data-r="lines" data-r-at="0.15">
        {title}
      </h2>
      {body && !swapping && (
        <p className="vl-body" data-r="lines">
          {body}
        </p>
      )}
      {swapping && (
        <div className="vl-text__swap">
          {body && <SwapBody text={body} from={from} to={swapAt} also={also} />}
          {swap}
        </div>
      )}
      {children}
    </div>
  );
}

function SwapBody({ text, from, to, also }: { text: string; from: number; to: number; also?: (s: JourneyState) => boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // Starts with the title's lines; leaves before the swapped content arrives.
  useReveal(ref, { when: (s) => s.t >= from && s.t < to && (also ? also(s) : true), delay: 0.42, reverseSpeed: 2.2 });
  return (
    <div ref={ref} className="vl-text__body">
      <p className="vl-body" data-r="lines">
        {text}
      </p>
    </div>
  );
}
