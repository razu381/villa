"use client";

import { useRef, useState } from "react";
import { CLASSIC, GALLERY, type GalleryCategory } from "@/lib/classic-content";
import { useInViewReveal } from "@/lib/ui-reveal";
import { AutoGallery } from "./AutoGallery";
import { Eyebrow } from "./Concept";
import { Lightbox } from "./Lightbox";

/**
 * Gallery by categories (the client's note): pick one and its photo wipes up
 * onto the stage; step through it with the arrows, or open the viewer.
 */
export function Gallery() {
  const [cat, setCat] = useState<GalleryCategory>(GALLERY[0].id);
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const head = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useInViewReveal(head);
  useInViewReveal(stage, { delay: 0.15 });

  const group = GALLERY.find((g) => g.id === cat) ?? GALLERY[0];
  const item = group.items[index];
  const [lead, tail] = CLASSIC.gallery.title.split(" Vila ");
  return (
    <section id="gallery" className="vc-gallery" aria-labelledby="vc-gallery-title">
      <div className="vc-gallery__inner vc-wrap">
        <div ref={head} className="vc-gallery__side">
          <Eyebrow n="05">{CLASSIC.gallery.eyebrow}</Eyebrow>
          <h2 id="vc-gallery-title" className="vc-title vc-gallery__title" data-r="lines">
            {lead} <em>Vila {tail}</em>
          </h2>
          <ul className="vc-cats" data-r="fade" aria-label={CLASSIC.gallery.eyebrow}>
            {GALLERY.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  aria-pressed={g.id === cat}
                  onClick={() => {
                    setCat(g.id);
                    setIndex(0);
                  }}
                >
                  <span className="vc-cats__dot" aria-hidden="true" />
                  {g.label}
                  <small>{String(g.items.length).padStart(2, "0")}</small>
                </button>
              </li>
            ))}
          </ul>
          <p key={`${cat}-${index}`} className="vc-gallery__cap" aria-live="polite">
            <b>{item.title}</b>
            {item.line && <span>{item.line}</span>}
          </p>
        </div>
        <div ref={stage} className="vc-gallery__stage">
          <div data-r="rise" className="vc-gallery__rise">
            <AutoGallery
              key={cat}
              photos={group.items.map((i) => i.photo)}
              sizes="(max-width: 820px) 100vw, 70vw"
              label={`${CLASSIC.gallery.eyebrow}: ${group.label}`}
              onIndex={setIndex}
              onOpen={setViewer}
              labels={{ ...CLASSIC.villas, view: CLASSIC.gallery.view }}
            />
          </div>
        </div>
      </div>
      {viewer != null && <Lightbox items={group.items} start={viewer} onClose={() => setViewer(null)} />}
    </section>
  );
}
