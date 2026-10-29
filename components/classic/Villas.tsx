"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { FLOOR_PHOTOS, PHOTOS, VILLA_NAMES, VILLA_PHOTOS, whatsappLink } from "@/lib/classic-content";
import { useCopy } from "@/lib/copy";
import { useInViewReveal } from "@/lib/ui-reveal";
import { AutoGallery } from "./AutoGallery";
import { goTo } from "./ClassicHeader";
import { Eyebrow } from "./Concept";
import { JoinVeil } from "./JoinVeil";
import { Pic } from "../ui/Pic";

type HomeId = "v3" | "v4";

/** Open the visit form with a home already chosen (components/classic/Visit listens). */
export function requestVisit(home: HomeId) {
  window.dispatchEvent(new CustomEvent<HomeId>("vc:visit", { detail: home }));
  goTo("visit", '#visit input[name="name"]');
}

/**
 * Villas: V3 / V4 behind one switch. V3, on sale now, is a gallery that turns
 * on its own and can be driven by hand (the client's note); its "Request a
 * private visit" opens WhatsApp. V4 (2028) takes an expression of interest
 * through the form. Then the three floors every home shares.
 */
export function Villas() {
  const copy = useCopy();
  const [home, setHome] = useState<HomeId>("v3");
  const head = useRef<HTMLDivElement>(null);
  const floors = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  useInViewReveal(head, undefined, [copy.locale]);
  useInViewReveal(floors);

  // The underline glides to the chosen tab.
  useLayoutEffect(() => {
    const place = () => {
      const t = tabs.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!t || !line.current) return;
      line.current.style.transform = `translateX(${t.offsetLeft}px)`;
      line.current.style.width = `${t.offsetWidth}px`;
    };
    place();
    window.addEventListener("resize", place);
    document.fonts?.ready.then(place).catch(() => {});
    return () => window.removeEventListener("resize", place);
  }, [home, copy.locale]);

  const pick = (id: HomeId) => setHome(id);

  return (
    <section id="villas" className="vc-villas" aria-labelledby="vc-villas-title">
      <JoinVeil />
      <div ref={head} className="vc-villas__head vc-wrap" key={copy.locale}>
        <Eyebrow n="03">{copy.CLASSIC.villas.eyebrow}</Eyebrow>
        <h2 id="vc-villas-title" className="vc-title" data-r="lines">
          {copy.CLASSIC.villas.lead} <em>{copy.CLASSIC.villas.accent}</em>
        </h2>
        <div
          ref={tabs}
          className="vc-tabs"
          role="tablist"
          aria-label={copy.CLASSIC.villas.eyebrow}
          data-r="fade"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              const next = home === "v3" ? "v4" : "v3";
              pick(next);
              requestAnimationFrame(() => document.getElementById(`vc-tab-${next}`)?.focus());
            }
          }}
        >
          {copy.HOMES.map((h) => (
            <button
              key={h.id}
              id={`vc-tab-${h.id}`}
              type="button"
              role="tab"
              aria-selected={home === h.id}
              aria-controls={`vc-panel-${h.id}`}
              tabIndex={home === h.id ? 0 : -1}
              onClick={() => pick(h.id)}
            >
              {VILLA_NAMES[h.id]}
              <small>{h.status}</small>
            </button>
          ))}
          <span ref={line} className="vc-tabs__line" aria-hidden="true" />
        </div>
      </div>

      {copy.HOMES.map((h) => (
        <div
          key={h.id}
          id={`vc-panel-${h.id}`}
          className="vc-villa vc-wrap"
          role="tabpanel"
          aria-labelledby={`vc-tab-${h.id}`}
          hidden={home !== h.id}
        >
          <div className="vc-villa__media">
            {h.id === "v3" ? (
              <AutoGallery
                photos={VILLA_PHOTOS.v3}
                sizes="(max-width: 820px) 100vw, 40vw"
                label={`${VILLA_NAMES.v3}: photos`}
                auto
                labels={{ ...copy.CLASSIC.villas, view: copy.CLASSIC.gallery.view }}
              />
            ) : (
              <figure className="vc-villa__still">
                <Pic photo={PHOTOS.villaPoolTall} sizes="(max-width: 820px) 100vw, 40vw" />
              </figure>
            )}
          </div>
          <div className="vc-villa__info">
            <p className="vc-villa__status" data-soon={h.id === "v4" ? "1" : undefined}>
              <span aria-hidden="true" />
              {h.status}
            </p>
            <h3 className="vc-villa__name">{VILLA_NAMES[h.id]}</h3>
            <p className="vc-villa__area">{h.area}</p>
            <ul className="vc-villa__specs">
              {h.specs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <div className="vc-villa__cta">
              {h.id === "v3" ? (
                <>
                  <a className="vl-btn vl-btn--solid vc-btn" href={whatsappLink(VILLA_NAMES.v3)} target="_blank" rel="noopener noreferrer">
                    {copy.CLASSIC.villas.whatsapp}
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M5 11 11 5M6 5h5v5" />
                    </svg>
                  </a>
                  <span className="vc-villa__note">WhatsApp</span>
                </>
              ) : (
                <button type="button" className="vl-btn vl-btn--solid vc-btn" onClick={() => requestVisit("v4")}>
                  {copy.CLASSIC.villas.interest}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      <div ref={floors} className="vc-floors vc-wrap">
        <p className="vc-eyebrow" data-r="fade">
          <span>—</span>
          {copy.CLASSIC.villas.floors}
        </p>
        <ol className="vc-floors__list">
          {copy.VILLA_FLOORS.map((f, i) => (
            <li key={f.title}>
              <div className="vc-floors__img" data-r="rise">
                <Pic photo={FLOOR_PHOTOS[i]} sizes="(max-width: 820px) 100vw, 30vw" />
              </div>
              <span className="vc-floors__n" data-r="fade">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="vc-floors__title" data-r="fade">
                {f.title}
              </h3>
              <p className="vc-floors__text" data-r="fade">
                {f.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
