"use client";

import { useRef, useState } from "react";
import { type GalleryCategory } from "@/lib/classic-content";
import { useCopy } from "@/lib/copy";
import { useInViewReveal } from "@/lib/ui-reveal";
import { AutoGallery } from "./AutoGallery";
import { Eyebrow } from "./Concept";
import { JoinVeil } from "./JoinVeil";
import { Lightbox } from "../ui/Lightbox";

/**
 * Gallery by categories (the client's note): pick one and its photo wipes up
 * onto the stage; step through it with the arrows, or open the viewer.
 */
export function Gallery() {
  const copy = useCopy();
  const [cat, setCat] = useState<GalleryCategory>(copy.GALLERY[0].id);
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const head = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useInViewReveal(head, undefined, [copy.locale]);
  useInViewReveal(stage, { delay: 0.15 });

  const group = copy.GALLERY.find((g) => g.id === cat) ?? copy.GALLERY[0];
  const item = group.items[index];
  const { lead, accent } = copy.CLASSIC.gallery;
  return (
    <section id="gallery" className="vc-gallery" aria-labelledby="vc-gallery-title">
      <JoinVeil />
      <div className="vc-gallery__inner vc-wrap">
        <div ref={head} className="vc-gallery__side" key={copy.locale}>
          <Eyebrow n="05">{copy.CLASSIC.gallery.eyebrow}</Eyebrow>
          <h2 id="vc-gallery-title" className="vc-title vc-gallery__title" data-r="lines">
            {lead} <em>{accent}</em>
          </h2>
          <ul className="vc-cats" data-r="fade" aria-label={copy.CLASSIC.gallery.eyebrow}>
            {copy.GALLERY.map((g) => (
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
              label={`${copy.CLASSIC.gallery.eyebrow}: ${group.label}`}
              onIndex={setIndex}
              onOpen={setViewer}
              captions={group.items}
              labels={{ ...copy.CLASSIC.villas, view: copy.CLASSIC.gallery.view }}
            />
          </div>
        </div>
      </div>
      {viewer != null && (
        <Lightbox
          items={group.items}
          start={viewer}
          labels={{ title: `${lead} ${accent}`, prev: copy.CLASSIC.villas.prev, next: copy.CLASSIC.villas.next, close: copy.CLASSIC.gallery.close }}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  );
}
