"use client";

import { useEffect, useRef, useState } from "react";
import { ADVISOR, CLASSIC, PHOTOS, whatsappLink } from "@/lib/classic-content";
import type { VisitHome } from "@/lib/ui-copy";
import { useInViewReveal } from "@/lib/ui-reveal";
import { Invitation } from "../night/Invitation";
import { ARCH_PATH } from "../ui/Brand";
import { Eyebrow } from "./Concept";
import { Pic } from "../ui/Pic";

function Arch({ className = "", at }: { className?: string; at: number }) {
  return (
    <svg className={`vc-visit__arch ${className}`} viewBox="-4 -4 108 120" aria-hidden="true">
      <path d={ARCH_PATH} pathLength={1} data-r="draw" data-r-at={at} />
    </svg>
  );
}

/**
 * Private visit: the client's words, the advisor, the form. The three brand
 * arches build one after another, then the advisor's photo rises into the
 * last (the client's note: construction, evolution, then the photo), the name
 * just behind it. It starts as soon as the arches show, so a visitor passing
 * on to the footer still meets the advisor whole.
 */
export function Visit() {
  const text = useRef<HTMLDivElement>(null);
  const arches = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLDivElement>(null);
  const [preset, setPreset] = useState<{ home: VisitHome; at: number } | undefined>();
  useInViewReveal(text);
  useInViewReveal(arches, { margin: "0px" });
  useInViewReveal(form, { delay: 0.3 });

  useEffect(() => {
    const on = (e: Event) => setPreset({ home: (e as CustomEvent<VisitHome>).detail, at: Date.now() });
    window.addEventListener("vc:visit", on);
    return () => window.removeEventListener("vc:visit", on);
  }, []);

  const [lead, tail] = CLASSIC.visit.title.split(" Vila ");
  return (
    <section id="visit" className="vc-visit" aria-labelledby="vc-visit-title">
      <div className="vc-visit__inner vc-wrap">
        <div className="vc-visit__side">
          <div ref={text}>
            <Eyebrow n="06">{CLASSIC.visit.eyebrow}</Eyebrow>
            <h2 id="vc-visit-title" className="vc-title" data-r="lines">
              {lead} <em>Vila {tail}</em>
            </h2>
            {CLASSIC.visit.body.map((p) => (
              <p key={p} className="vc-body vc-visit__p" data-r="fade">
                {p}
              </p>
            ))}
          </div>

          <div ref={arches} className="vc-visit__advisor">
            <div className="vc-visit__build">
              <Arch className="is-1" at={0} />
              <Arch className="is-2" at={0.3} />
              <div className="vc-visit__portrait">
                <Arch className="is-3" at={0.6} />
                <div className="vc-visit__clip">
                  <div className="vc-visit__photo" data-r="rise" data-r-at="1">
                    <Pic photo={PHOTOS.advisor} sizes="(max-width: 820px) 50vw, 16vw" />
                  </div>
                </div>
              </div>
            </div>
            <div className="vc-visit__contact" data-r="fade" data-r-at="1.2">
              <p className="vc-visit__name">{ADVISOR.name}</p>
              <p className="vc-visit__role">{ADVISOR.role}</p>
              <ul>
                <li>
                  <a className="vl-link" href={`tel:${ADVISOR.phone.replace(/\s/g, "")}`}>
                    {ADVISOR.phone}
                  </a>
                </li>
                <li>
                  <a className="vl-link" href={`mailto:${ADVISOR.email}`}>
                    {ADVISOR.email}
                  </a>
                </li>
                <li>
                  <a className="vl-link" href={whatsappLink("homes")} target="_blank" rel="noopener noreferrer">
                    WhatsApp ↗
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div ref={form} className="vc-visit__form">
          <div data-r="fade">
            <Invitation preset={preset} />
          </div>
        </div>
      </div>
    </section>
  );
}
