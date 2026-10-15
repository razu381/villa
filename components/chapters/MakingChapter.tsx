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
  // Compact screens: one idea at a time — the notes take the body's place under the title.
  const compact = useCompact();
  return (
    <Pin>
      {compact ? (
        <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} from={3.06} to={3.95} swapAt={3.42} swap={<Notes from={3.45} inline />} />
      ) : (
        <>
          <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} from={3.06} to={3.95} />
          <Notes from={3.3} />
        </>
      )}
    </Pin>
  );
}

function Notes({ from, inline = false }: { from: number; inline?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, { when: (s) => s.t >= from && s.t < 3.95, delay: inline ? 0.15 : 0.1 });
  return (
    <div ref={ref} className="vl-notes" role="list" aria-label="Principles" data-inline={inline ? "1" : undefined}>
      {!inline && <div className="vl-haze vl-haze--right" data-r="scrim" aria-hidden="true" />}
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
