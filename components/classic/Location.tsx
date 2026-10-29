"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/content";
import { CLASSIC, MAP_MARKER, MAPS_LINK, PHOTOS } from "@/lib/classic-content";
import { useCopy } from "@/lib/copy";
import { afterOpening } from "@/lib/opening";
import { useInViewReveal } from "@/lib/ui-reveal";
import { Wordmark } from "../ui/Brand";
import { Eyebrow } from "./Concept";
import { gsap, stillMode } from "./env";
import { Pic } from "../ui/Pic";

/** The few places the card names, by the client's own drive times: [group, place] into LOCATION.groups (names differ by language). */
const CARD_PLACES: [number, number][] = [
  [3, 0], // Lisbon city centre
  [3, 1], // Cascais
  [0, 0], // Taguspark
  [2, 2], // Beaches
];

/**
 * Location: the view first (the aerial render), then the client's illustrated
 * map (mapa12). Its own VilaLeku pill is the marker and opens a card about the
 * place; the artwork's POI labels make the drive-time list plain text.
 */
export function Location() {
  const copy = useCopy();
  const text = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const bandImg = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const markerBtn = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useInViewReveal(text, undefined, [copy.locale]);
  useInViewReveal(mapRef, { delay: 0.15 });

  // The band's photo settles as it comes into view.
  useEffect(() => {
    const el = bandImg.current;
    if (!el || stillMode()) return;
    let tw: gsap.core.Tween | null = null;
    const cancel = afterOpening(() => {
      tw = gsap.fromTo(el, { scale: 1.12 }, { scale: 1, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom 40%", scrub: true } });
    });
    return () => {
      cancel();
      tw?.scrollTrigger?.kill();
      tw?.kill();
    };
  }, []);

  // The card closes on Escape or a click elsewhere, and hands focus back.
  useEffect(() => {
    if (!open) return;
    card.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        markerBtn.current?.focus({ preventScroll: true });
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!card.current?.contains(t) && !markerBtn.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const { lead, accent } = copy.LOCATION;
  return (
    <section id="location" className="vc-location" aria-labelledby="vc-location-title">
      <div className="vc-location__band">
        <div ref={bandImg} className="vc-location__band-img">
          <Pic photo={PHOTOS.aerialRender} sizes="100vw" className="vc-cover" />
        </div>
        <p className="vc-location__band-cap">
          <b>{copy.CLASSIC.location.band.title}</b>
          <span>{copy.CLASSIC.location.band.line}</span>
        </p>
      </div>

      <div className="vc-location__panel vc-wrap">
        <div ref={text} className="vc-location__text" key={copy.locale}>
          <Eyebrow n="04">{copy.CLASSIC.location.eyebrow}</Eyebrow>
          <h2 id="vc-location-title" className="vc-title vc-location__title" data-r="lines">
            {lead} <em>{accent}</em>
          </h2>
          <p className="vc-body" data-r="fade">
            {copy.LOCATION.body}
          </p>
          <div className="vc-times" data-r="fade">
            {copy.LOCATION.groups.map((g) => (
              <div key={g.title} className="vc-times__group">
                <h3>{g.title}</h3>
                <ul>
                  {g.places.map((p) => (
                    <li key={p.name}>
                      <span>{p.name}</span>
                      <i aria-hidden="true" />
                      <b>{p.min} min</b>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <a className="vl-link vc-location__maps" href={MAPS_LINK} target="_blank" rel="noopener noreferrer" data-r="fade">
            {copy.CLASSIC.location.openMap} ↗
          </a>
        </div>

        <div ref={mapRef} className="vc-map">
          <div className="vc-map__frame" data-r="rise">
            <Pic photo={PHOTOS.map} sizes="(max-width: 820px) 100vw, 60vw" />
            <button
              ref={markerBtn}
              type="button"
              className="vc-map__marker"
              style={{
                left: `${MAP_MARKER.box.l}%`,
                top: `${MAP_MARKER.box.t}%`,
                width: `${MAP_MARKER.box.r - MAP_MARKER.box.l}%`,
                height: `${MAP_MARKER.y - MAP_MARKER.box.t + 1.5}%`,
              }}
              aria-expanded={open}
              aria-controls="vc-map-card"
              onClick={() => setOpen((o) => !o)}
            >
              <span className="vc-map__halo" aria-hidden="true" />
              <span className="vc-map__hint">{copy.CLASSIC.location.marker}</span>
            </button>
          </div>
          <div
            ref={card}
            id="vc-map-card"
            className="vc-map__card"
            role="dialog"
            aria-label={copy.CLASSIC.location.marker}
            tabIndex={-1}
            data-open={open ? "1" : "0"}
            // Beside the marker, high enough that the whole card stays on the map
            // (a phone opens it under the map instead).
            style={{ "--x": `${MAP_MARKER.box.r + 1.5}%`, "--y": "5%" } as React.CSSProperties}
          >
            <Wordmark className="vc-map__card-mark" label={BRAND.name} />
            <p className="vc-map__card-place">{BRAND.place}</p>
            <p className="vc-map__card-text">{copy.LOCATION.body.split(". ")[0]}.</p>
            <p className="vc-map__card-text">{copy.CONCEPT.intro.split(",")[0]}.</p>
            <ul className="vc-map__card-times">
              {CARD_PLACES.map(([g, p]) => {
                const place = copy.LOCATION.groups[g]?.places[p];
                if (!place) return null;
                return (
                  <li key={place.name}>
                    <span>{place.name}</span>
                    <b>{place.min} min</b>
                  </li>
                );
              })}
            </ul>
            <a className="vl-link" href={MAPS_LINK} target="_blank" rel="noopener noreferrer">
              {copy.CLASSIC.location.openMap} ↗
            </a>
            <button type="button" className="vc-map__close" onClick={() => setOpen(false)} aria-label={copy.CLASSIC.location.close}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
