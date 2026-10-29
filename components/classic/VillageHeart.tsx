"use client";

import { useEffect, useRef, useState } from "react";
import { AMENITY_PHOTOS } from "@/lib/classic-content";
import { useCopy } from "@/lib/copy";
import { afterOpening, openingNow } from "@/lib/opening";
import { useInViewReveal } from "@/lib/ui-reveal";
import { scrollToY } from "@/lib/ui-scroll";
import { Eyebrow } from "./Concept";
import { JoinVeil } from "./JoinVeil";
import { gsap, ScrollTrigger, stillMode } from "./env";
import { Pic } from "../ui/Pic";

const HOLD = 0.45;
const STEP = 1 + HOLD;
/** Scroll (in screen heights) per photo change: unhurried, so each change reads. */
const PER = 1.15;
/** Amenity count (same in both languages; the photos' order). */
const N = 4;

/**
 * Village Heart: the four amenities as a pinned gallery (after Focal Glow's
 * "How we work"). While it holds the screen, scrolling wipes each photo up
 * from the bottom over the last (the client's note) and the list beside it
 * follows. Plain scrolling throughout; the list jumps to an amenity. In
 * reduced motion the four simply stack.
 *
 * Smoothness: each photo is its own layer, so its settle (scale) is the
 * graphics card's work, never a repaint of a large photo; the wipe is a plain
 * rectangle clip; the texts crossfade in one fixed slot (no layout while
 * scrolling); the photos are decoded before the section arrives; each change
 * gets more scroll and a gentler ease. Measured (wheel scroll, integrated GPU,
 * 1.4x): the fewest slow frames of the variants tried. A feathered edge (moving
 * gradient mask) and a transform-only wipe (three layers per photo) both
 * dropped more frames there, so neither is used.
 *
 * On a phone (the client's mobile layout) each amenity fills the screen, the
 * title over the photo and its words on a card below. The same scroll drives
 * it, but the screen is held by CSS (sticky, the browser's own scrolling)
 * rather than a pin, which lags a touch scroll by a frame.
 */
export function VillageHeart() {
  const copy = useCopy();
  const ref = useRef<HTMLElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [still, setStill] = useState(false);
  const st = useRef<ScrollTrigger | null>(null);
  useInViewReveal(head, undefined, [copy.locale]);

  // Decode the photos ahead, so none is decoded mid-change.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        el.querySelectorAll("img").forEach((img) => {
          const go = () => img.decode().catch(() => {});
          if (img.complete) go();
          else img.addEventListener("load", go, { once: true });
        });
      },
      { rootMargin: "200% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const s = stillMode();
    setStill(s);
    const el = ref.current;
    if (!el || s) return;
    // Built after the opening (lib/opening), off the film's first seconds.
    // Rebuilt (and its styles undone) when the window crosses the phone width.
    const mm = gsap.matchMedia();
    const cancel = afterOpening(() => mm.add({ phone: "(max-width: 820px)", wide: "(min-width: 821px)" }, (ctx) => {
      const phone = !!ctx.conditions?.phone;
      const slides = el.querySelectorAll<HTMLElement>(".vc-heart__slide");
      const n = slides.length;
      const tl = gsap.timeline({ defaults: { ease: "none" } });
      slides.forEach((slide, i) => {
        if (i === 0) return;
        const at = HOLD + (i - 1) * STEP;
        tl.fromTo(slide, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "sine.inOut" }, at);
        const img = slide.querySelector("img");
        if (img) tl.fromTo(img, { scale: 1.08 }, { scale: 1, duration: 1.3, ease: "power1.out" }, at);
      });
      tl.to({}, { duration: HOLD }, HOLD + (n - 1) * STEP - 0.001);
      const total = tl.duration();
      st.current = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        // Phone: the section is as tall as the changes (--steps in classic.css).
        end: phone ? "bottom bottom" : () => `+=${Math.round((n - 1) * window.innerHeight * PER)}`,
        pin: !phone,
        anticipatePin: phone ? 0 : 1,
        scrub: 0.5,
        animation: tl,
        onUpdate: (self) => {
          const time = self.progress * total;
          // An amenity is "current" once its photo has wiped past halfway.
          let a = 0;
          for (let i = 1; i < n; i++) if (time >= HOLD + (i - 1) * STEP + 0.5) a = i;
          setActive(a);
        },
      });
      return () => {
        st.current = null;
      };
    }));
    return () => {
      cancel();
      mm.revert();
    };
  }, []);

  /** Scroll to where amenity i is fully shown. */
  const show = (i: number) => {
    openingNow();
    const t = st.current;
    if (!t) return;
    const n = N;
    const total = HOLD + (n - 1) * STEP + HOLD;
    const time = i === 0 ? 0 : HOLD + (i - 1) * STEP + 1.05;
    scrollToY(t.start + (t.end - t.start) * (time / total));
  };

  const { lead, accent } = copy.CLASSIC.villageHeart;
  return (
    <section
      ref={ref}
      id="village-heart"
      className={`vc-heart${still ? " is-still" : ""}`}
      aria-labelledby="vc-heart-title"
      style={{ "--steps": (N - 1) * PER } as React.CSSProperties}
    >
      <JoinVeil />
      <div className="vc-heart__inner vc-wrap">
        <div ref={head} className="vc-heart__side" key={copy.locale}>
          <Eyebrow n="02">{copy.CLASSIC.villageHeart.eyebrow}</Eyebrow>
          <h2 id="vc-heart-title" className="vc-title vc-heart__title" data-r="lines">
            {lead} <em>{accent}</em>
          </h2>
          <div data-r="fade">
            <ol className="vc-heart__list">
              {copy.AMENITIES.map((a, i) => (
                <li key={a.id} data-active={i === active ? "1" : "0"}>
                  <button type="button" onClick={() => show(i)} aria-current={i === active ? "true" : undefined}>
                    <span className="vc-heart__dot" aria-hidden="true" />
                    <span className="vc-heart__n">{String(i + 1).padStart(2, "0")}</span>
                    <span className="vc-heart__name">{a.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="vc-heart__detail" aria-live="polite">
              {copy.AMENITIES.map((a, i) => (
                <p key={a.id} data-active={i === active ? "1" : "0"} aria-hidden={i !== active}>
                  {a.text}
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="vc-heart__stage">
          {AMENITY_PHOTOS.map((p, i) => (
            <figure key={p.src} className="vc-heart__slide" style={{ zIndex: i + 1 }}>
              <Pic photo={p} sizes="(max-width: 820px) 100vw, 64vw" />
              <figcaption className="vc-heart__cap">
                <span>{String(i + 1).padStart(2, "0")}</span> / {String(AMENITY_PHOTOS.length).padStart(2, "0")}
                <b>{copy.AMENITIES[i].title}</b>
                <i>{copy.AMENITIES[i].text}</i>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
