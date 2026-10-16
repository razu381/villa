"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SECTION_ANCHORS } from "@/lib/anchors";
import { COPY } from "@/lib/content";
import { useJourney } from "@/lib/store";
import { damp } from "@/lib/ui-time";
import { UI } from "@/lib/ui-copy";
import { useReveal } from "@/lib/ui-reveal";
import { useCompact } from "@/lib/ui-media";
import { Pin } from "../ui/Pin";
import { ChapterText } from "./ChapterText";

/**
 * Noon — the section cut. Cars below, life above, as a refined legend.
 * Compact screens: the legend takes the body's place under the title, so the
 * line the chapter exists for stays on screen while the cut is open.
 */
export function CarsChapter() {
  const c = COPY.cars;
  const compact = useCompact();
  return (
    <Pin>
      {compact ? (
        <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} from={4.06} to={4.9} swapAt={4.38} swap={<Legend from={4.41} inline />} />
      ) : (
        <>
          {/* Title and legend leave as the cut closes (4.82): the gardens and houses re-emerge under them. */}
          <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} from={4.06} to={4.8} />
          <Legend from={4.3} to={4.84} />
          <Leaders from={4.3} to={4.84} />
        </>
      )}
    </Pin>
  );
}

function Marker({ kind }: { kind: "dashed" | "line" | "circle" }) {
  return (
    <svg className="vl-legend__marker" viewBox="0 0 40 12" aria-hidden="true">
      {kind === "dashed" && <path d="M0 6 H40" strokeDasharray="3 3" />}
      {kind === "line" && <path d="M0 6 H40" />}
      {kind === "circle" && (
        <>
          <path d="M0 6 H28" />
          <circle cx="34" cy="6" r="4.5" />
        </>
      )}
    </svg>
  );
}

function Legend({ from, to = 4.9, inline = false }: { from: number; to?: number; inline?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, { when: (s) => s.t >= from && s.t < to, delay: inline ? 0.15 : 0.05 });
  return (
    <div ref={ref} className="vl-legend" data-inline={inline ? "1" : undefined}>
      {!inline && <div className="vl-haze vl-haze--right" data-r="scrim" aria-hidden="true" />}
      {!inline && (
        <p className="vl-eyebrow vl-legend__eyebrow" data-r="fade">
          <span className="vl-eyebrow__rule" aria-hidden="true" />
          in section
        </p>
      )}
      <ul className="vl-legend__list" aria-label="Section legend">
        {UI.cars.legend.map((item, i) => (
          <li key={item.title} className="vl-legend__item">
            <span data-r="rule" data-r-at={String(i * 0.2)} className="vl-legend__mk">
              <Marker kind={item.marker} />
            </span>
            <span className="vl-legend__title" data-r="fade" data-r-at={String(0.25 + i * 0.2)}>
              {item.title}
            </span>
            <span className="vl-legend__where" data-r="fade" data-r-at={String(0.4 + i * 0.2)}>
              {item.where}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The legend rows that point at something on screen while the legend is up (the playground only re-emerges after it). */
const LEADERS = [
  { key: "parking", dash: "3 3" },
  { key: "streets", dash: undefined },
] as const;

/**
 * Hairline leaders from the legend's markers to their places in the picture
 * (lib/anchors.ts, written by the 3D every frame). A fixed SVG on <body>, drawn
 * by a rAF loop only while the legend is up; each leader eases in once its
 * subject is on screen, in the marker's own dash.
 */
function Leaders({ from, to }: { from: number; to: number }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const groups = LEADERS.map((l) => svg.querySelector<SVGGElement>(`[data-k="${l.key}"]`)!);
    const k = LEADERS.map(() => 0);
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = useJourney.getState();
      const on = s.t >= from && s.t < to && s.mode === "journey";
      const marks = document.querySelectorAll<HTMLElement>(".vl-legend:not([data-inline]) .vl-legend__mk");
      let busy = on;
      LEADERS.forEach((l, i) => {
        const a = SECTION_ANCHORS[l.key];
        const mk = marks[i];
        const want = on && a.visible && mk ? 1 : 0;
        k[i] = s.snap || s.reducedMotion ? want : damp(k[i], want, 5, dt);
        if (k[i] < 0.002) k[i] = want;
        const g = groups[i];
        g.style.opacity = k[i].toFixed(3);
        if (k[i] > 0 && mk) {
          const r = mk.getBoundingClientRect();
          const line = g.firstElementChild as SVGLineElement;
          const dot = g.lastElementChild as SVGCircleElement;
          line.setAttribute("x1", (r.left - 10).toFixed(1));
          line.setAttribute("y1", (r.top + r.height / 2).toFixed(1));
          line.setAttribute("x2", a.x.toFixed(1));
          line.setAttribute("y2", a.y.toFixed(1));
          dot.setAttribute("cx", a.x.toFixed(1));
          dot.setAttribute("cy", a.y.toFixed(1));
          busy = true;
        }
      });
      raf = busy ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    kick();
    const unsub = useJourney.subscribe(kick);
    return () => {
      cancelAnimationFrame(raf);
      unsub();
    };
  }, [host, from, to]);
  if (!host) return null;
  return createPortal(
    <svg ref={svgRef} className="vl-leaders" aria-hidden="true">
      {LEADERS.map((l) => (
        <g key={l.key} data-k={l.key} style={{ opacity: 0 }}>
          <line strokeDasharray={l.dash} />
          <circle r={2.4} />
        </g>
      ))}
    </svg>,
    host,
  );
}
