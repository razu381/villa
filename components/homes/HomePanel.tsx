"use client";

import { useEffect, useRef, useState } from "react";
import { COPY, HOMES } from "@/lib/content";
import { useJourney, type HomeId } from "@/lib/store";
import { UI } from "@/lib/ui-copy";
import { useReveal } from "@/lib/ui-reveal";
import { afterReveal, backToVillage, enterExplore, focusIntent } from "./explore";

/**
 * The spec panel while exploring a home. No box: the words sit in a soft corner
 * light, the render framed in the brand arch is the hero of the panel, the specs
 * run beneath it in two hairline columns. A switch between the two homes and
 * "Back to the village". (Compact screens: a sheet above the sun arc.)
 */
export function HomePanel() {
  const home = useJourney((s) => s.home);
  const mode = useJourney((s) => s.mode);
  // Keep the last home on screen while the panel reverses out.
  const [shown, setShown] = useState<HomeId>("v3");
  useEffect(() => {
    if (home) setShown(home);
  }, [home]);
  const active = mode === "explore" && home != null;

  return (
    <div className="vl-explore" data-active={active ? "1" : "0"}>
      <BackControl />
      <PanelBody key={shown} id={shown} />
    </div>
  );
}

function BackControl() {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, { when: (s) => s.mode === "explore" && s.home != null, delay: 0.3, interactive: true });
  return (
    <div ref={ref} className="vl-back-wrap">
      <button type="button" className="vl-back" onClick={backToVillage} data-r="fade">
        <svg viewBox="0 0 22 10" aria-hidden="true">
          <path d="M22 5 H2 M6 1.5 L2 5 L6 8.5" />
        </svg>
        {COPY.homes.back}
      </button>
    </div>
  );
}

function PanelBody({ id }: { id: HomeId }) {
  const ref = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Compact screens keep the home in view: the spec list folds away behind a toggle.
  const [open, setOpen] = useState(false);
  const h = HOMES.find((x) => x.id === id) ?? HOMES[0];
  useReveal(ref, {
    when: (s) => s.mode === "explore" && s.home === id,
    delay: 0.2,
    interactive: true,
    // Focus follows the visitor's choice once the panel is really on screen.
    onToggle: (inside) => {
      if (!inside || !focusIntent.panel) return;
      focusIntent.panel = false;
      afterReveal(() => titleRef.current?.focus({ preventScroll: true }));
    },
  });
  return (
    <section ref={ref} className="vl-panel" aria-labelledby="vl-panel-title">
      <div className="vl-haze vl-haze--panel" data-r="scrim" aria-hidden="true" />
      <div className="vl-panel__switch" role="group" aria-label={UI.homes.choose} data-r="fade">
        {HOMES.map((x) => (
          <button key={x.id} type="button" aria-pressed={x.id === id} onClick={() => x.id !== id && enterExplore(x.id, { focusPanel: true })}>
            {x.id.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="vl-panel__head">
        <p className="vl-eyebrow" data-r="fade">
          <span className="vl-eyebrow__rule" aria-hidden="true" />
          {h.kind.toLowerCase()}
        </p>
        <h3 ref={titleRef} id="vl-panel-title" className="vl-panel__title" tabIndex={-1} data-r="lines">
          {h.name}
        </h3>
        <p className="vl-panel__meta" data-r="fade">
          <span>{h.status}</span>
          <span className="vl-panel__dot" aria-hidden="true" />
          <span>{h.area}</span>
        </p>
      </div>
      <figure className="vl-arch-img" data-r="rise" data-r-at="0.3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={h.image} alt={`${h.name} — architectural render`} loading="lazy" decoding="async" />
      </figure>
      <button type="button" className="vl-panel__more" aria-expanded={open} aria-controls={`vl-specs-${id}`} onClick={() => setOpen((o) => !o)} data-r="fade">
        {UI.homes.specs}
        <span aria-hidden="true" className="vl-panel__plus" />
      </button>
      <h4 className="sr-only">{UI.homes.specs}</h4>
      <ul className="vl-specs" id={`vl-specs-${id}`} data-open={open ? "1" : "0"}>
        {h.specs.map((sp, i) => (
          <li key={sp} data-r="fade" data-r-at={String(0.75 + i * 0.06)}>
            {sp}
          </li>
        ))}
      </ul>
    </section>
  );
}
