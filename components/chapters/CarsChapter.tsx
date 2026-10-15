"use client";

import { useRef } from "react";
import { COPY } from "@/lib/content";
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
        <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} from={4.06} to={4.96} swapAt={4.38} swap={<Legend from={4.41} inline />} />
      ) : (
        <>
          <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} from={4.06} to={4.96} />
          <Legend from={4.3} />
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

function Legend({ from, inline = false }: { from: number; inline?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, { when: (s) => s.t >= from && s.t < 4.94, delay: inline ? 0.15 : 0.05 });
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
