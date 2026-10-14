"use client";

import { useRef } from "react";
import { COPY } from "@/lib/content";
import { UI } from "@/lib/ui-copy";
import { useReveal } from "@/lib/ui-reveal";
import { useCompact } from "@/lib/ui-media";
import { Pin } from "../ui/Pin";
import { ChapterText } from "./ChapterText";

/** Late morning — the sun sweep leaves cork and limestone behind. Two quiet notes. */
export function MakingChapter() {
  const c = COPY.making;
  // Compact screens: one idea per screen — the notes follow the text instead of sharing it.
  const compact = useCompact();
  return (
    <Pin>
      <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} from={3.06} to={compact ? 3.44 : 3.95} />
      <Notes from={compact ? 3.47 : 3.3} />
    </Pin>
  );
}

function Notes({ from }: { from: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, { when: (s) => s.t >= from && s.t < 3.95, delay: 0.1 });
  return (
    <div ref={ref} className="vl-notes" role="list" aria-label="Principles">
      <div className="vl-haze vl-haze--right" data-r="scrim" aria-hidden="true" />
      {UI.making.notes.map((n, i) => (
        <div key={n.title} className="vl-note" role="listitem">
          <span className="vl-note__rule" data-r="rule" data-r-at={String(i * 0.22)} aria-hidden="true" />
          <h3 className="vl-note__title" data-r="lines" data-r-at={String(0.2 + i * 0.22)}>
            {n.title}
          </h3>
          <p className="vl-note__text" data-r="fade" data-r-at={String(0.45 + i * 0.22)}>
            {n.text}
          </p>
        </div>
      ))}
    </div>
  );
}
