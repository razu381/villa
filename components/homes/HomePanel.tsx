"use client";

import { useEffect, useRef, useState } from "react";
import { COPY, HEART, HOMES, type PlaceContent } from "@/lib/content";
import { turnHome } from "@/lib/orbit";
import { PLACE_PHOTOS, photoIndex } from "@/lib/places";
import { openPlace, useJourney, type Place } from "@/lib/store";
import { UI } from "@/lib/ui-copy";
import { useReveal } from "@/lib/ui-reveal";
import { afterReveal, backToVillage, enterExplore, focusIntent, openPhotos } from "./explore";

/** The places the panel switches between, in order. */
const PLACES: PlaceContent[] = [...HOMES, HEART];

/** The switch's short names (the homes by type, the heart in words). */
const SWITCH: Record<Place, string> = { v3: "V3", v4: "V4", heart: "Village heart" };

/**
 * The spec panel while exploring a home (or the village heart). No box: the
 * words sit in a soft corner light, the render framed in the brand arch is the
 * hero of the panel, the specs run beneath it in two hairline columns. A switch
 * between the places and "Back to the village". (Compact screens: a sheet above
 * the sun arc.)
 */
export function HomePanel() {
  const place = useJourney(openPlace);
  // Keep the last place on screen while the panel reverses out.
  const [shown, setShown] = useState<Place>("v3");
  useEffect(() => {
    if (place) setShown(place);
  }, [place]);
  const active = place != null;

  return (
    <div className="vl-explore" data-active={active ? "1" : "0"}>
      <BackControl />
      <PanelBody key={shown} id={shown} />
    </div>
  );
}

function BackControl() {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, { when: (s) => openPlace(s) != null, delay: 0.3, interactive: true });
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

function PanelBody({ id }: { id: Place }) {
  const ref = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Compact screens keep the home in view: the spec list folds away behind a toggle.
  const [open, setOpen] = useState(false);
  const h = PLACES.find((x) => x.id === id) ?? PLACES[0];
  useReveal(ref, {
    when: (s) => openPlace(s) === id,
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
        {PLACES.map((x) => (
          <button key={x.id} type="button" aria-pressed={x.id === id} onClick={() => x.id !== id && enterExplore(x.id, { focusPanel: true })}>
            {SWITCH[x.id]}
          </button>
        ))}
      </div>
      <ViewControls floors={id !== "heart"} />
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
        {/* The render opens the home's photos, on itself. */}
        <button type="button" className="vl-arch-img__open" data-cursor="view" onClick={() => openPhotos(id, photoIndex(id, h.image))}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={h.image} alt={`${h.name} — architectural render`} loading="lazy" decoding="async" />
          <span className="vl-arch-img__count">
            <span className="sr-only">{UI.homes.openPhotos}: </span>
            {UI.homes.photos} · {String(PLACE_PHOTOS[id].length).padStart(2, "0")}
          </span>
        </button>
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

/**
 * The open place's view: for a home, the whole house or its open floors
 * (store.explode); and the 360° look (lib/orbit.ts): the scene itself is
 * dragged, these buttons and ← / → turn it a step for keyboards.
 */
function ViewControls({ floors }: { floors: boolean }) {
  const explode = useJourney((s) => s.explode);
  const setExplode = useJourney((s) => s.setExplode);
  const open = explode >= 0.5;
  return (
    <div className="vl-panel__view" data-r="fade">
      {floors ? (
        <div className="vl-panel__opts" role="group" aria-label={UI.homes.view}>
          <button type="button" aria-pressed={!open} onClick={() => setExplode(0)}>
            {UI.homes.whole}
          </button>
          <button type="button" aria-pressed={open} onClick={() => setExplode(1)}>
            {UI.homes.floors}
          </button>
        </div>
      ) : null}
      <div className="vl-turn" role="group" aria-label={UI.homes.turn}>
        {/* Left of the pair: once it fades, the buttons stay where the hand is. */}
        <span className="vl-turn__hint">{UI.homes.drag}</span>
        <button type="button" aria-label={UI.homes.turnLeft} onClick={() => turnHome(-1)}>
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M6.5 1.5 L3 5 L6.5 8.5" />
          </svg>
        </button>
        <button type="button" aria-label={UI.homes.turnRight} onClick={() => turnHome(1)}>
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M3.5 1.5 L7 5 L3.5 8.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
