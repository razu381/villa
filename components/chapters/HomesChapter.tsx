"use client";

import { useEffect, useRef } from "react";
import { COPY, HOMES } from "@/lib/content";
import { useJourney, type HomeId } from "@/lib/store";
import { UI } from "@/lib/ui-copy";
import { useReveal } from "@/lib/ui-reveal";
import { Pin } from "../ui/Pin";
import { ChapterText } from "./ChapterText";
import { HomePanel } from "../homes/HomePanel";
import { enterExplore, exitExplore, inHomes } from "../homes/explore";

/**
 * Golden hour — two ways to live. The Action layer: two selectable cards;
 * choosing one opens the home (store: explore / home / explode) and the spec panel.
 */
export function HomesChapter() {
  const c = COPY.homes;
  useExploreGuard();
  return (
    <Pin className="vl-homes">
      <ChapterText eyebrow={c.eyebrow} title={c.title} from={5.06} to={5.97} also={(s) => s.mode === "journey"} id="homes-title" />
      <HomeCards />
      <HomePanel />
    </Pin>
  );
}

/** Scrolling out of the chapter, or Escape, leaves explore mode. */
function useExploreGuard() {
  useEffect(() => {
    const unsub = useJourney.subscribe((s, p) => {
      if (s.mode === "explore" && inHomes(p.t) && !inHomes(s.t)) exitExplore();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useJourney.getState().mode === "explore") {
        exitExplore();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unsub();
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}

function HomeCards() {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, { when: (s) => s.t >= 5.1 && s.t < 5.97 && s.mode === "journey", delay: 0.45, interactive: true });
  const select = (id: HomeId) => {
    enterExplore(id);
    // Focus moves to the panel title once it mounts.
    requestAnimationFrame(() => document.getElementById("vl-panel-title")?.focus({ preventScroll: true }));
  };
  return (
    <div ref={ref} className="vl-cards" role="group" aria-label={UI.homes.choose}>
      <div className="vl-haze vl-haze--right" data-r="scrim" aria-hidden="true" />
      {HOMES.map((h, i) => (
        <button key={h.id} type="button" className="vl-card" data-home={h.id} data-cursor="open" onClick={() => select(h.id)} data-r="fade" data-r-at={String(i * 0.14)}>
          <span className="vl-card__media" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={h.image} alt="" loading="lazy" decoding="async" />
          </span>
          <span className="vl-card__body">
            <span className="vl-card__kind">{h.kind}</span>
            <span className="vl-card__name">{h.name}</span>
            <span className="vl-card__meta">
              <span className="vl-card__area">{h.area}</span>
              <span className="vl-card__status">{h.status}</span>
            </span>
          </span>
          <span className="vl-card__cta">
            {UI.homes.open}
            <svg viewBox="0 0 22 10" aria-hidden="true">
              <path d="M0 5 H20 M16 1.5 L20 5 L16 8.5" />
            </svg>
          </span>
        </button>
      ))}
    </div>
  );
}
