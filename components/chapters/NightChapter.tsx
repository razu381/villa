"use client";

import { useRef } from "react";
import { COPY } from "@/lib/content";
import { useCompact } from "@/lib/ui-media";
import { useReveal } from "@/lib/ui-reveal";
import { Pin } from "../ui/Pin";
import { ChapterText } from "./ChapterText";
import { Invitation } from "../night/Invitation";
import { SiteFooter } from "../night/SiteFooter";

/**
 * Night — the village switches on, then the invitation.
 * Wide screens: everything composed in one pinned frame (text, form, footer).
 * Compact screens: the text is pinned; the form and footer follow in the flow
 * after the journey (NightTail), so the form can scroll.
 */
export function NightChapter() {
  const c = COPY.night;
  const compact = useCompact();
  return (
    <Pin className="vl-night">
      <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} from={6.14} to={compact ? 6.62 : 99} id="visit-title" place={compact ? "bottom" : "top"} />
      {!compact && <NightAction />}
    </Pin>
  );
}

function NightAction() {
  const formRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  useReveal(formRef, { when: (s) => s.t >= 6.24, delay: 0.5, interactive: true });
  useReveal(footRef, { when: (s) => s.t >= 6.3, delay: 0.9 });
  return (
    <>
      <div ref={formRef} className="vl-night__action" id="visit">
        <div data-r="fade">
          <Invitation />
        </div>
      </div>
      <div ref={footRef} className="vl-night__foot">
        <div data-r="fade">
          <SiteFooter />
        </div>
      </div>
    </>
  );
}

/** After the journey: on compact screens, the form and footer in normal flow; otherwise a short runway. */
export function NightTail() {
  const compact = useCompact();
  return compact ? <TailContent /> : <div className="vl-runway" aria-hidden="true" />;
}

function TailContent() {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, { when: (s) => s.t >= 6.5, delay: 0.1, interactive: true });
  return (
    <div className="vl-tail" id="visit">
      <div ref={ref} className="vl-tail__inner">
        <div data-r="fade">
          <Invitation />
        </div>
        <div data-r="fade">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
