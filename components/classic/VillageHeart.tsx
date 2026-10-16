"use client";

import { useEffect, useRef, useState } from "react";
import { AMENITIES } from "@/lib/content";
import { AMENITY_PHOTOS, CLASSIC } from "@/lib/classic-content";
import { useInViewReveal } from "@/lib/ui-reveal";
import { scrollToY } from "@/lib/ui-scroll";
import { Eyebrow } from "./Concept";
import { gsap, ScrollTrigger, stillMode } from "./env";
import { Pic } from "./Pic";

const HOLD = 0.4;
const STEP = 1 + HOLD;

/**
 * Village Heart: the four amenities as a pinned gallery (after Focal Glow's
 * "How we work"). While it holds the screen, scrolling wipes each photo up
 * from the bottom over the last (the client's note) and the list beside it
 * follows. Plain scrolling throughout; the list jumps to an amenity. In
 * reduced motion the four simply stack.
 */
export function VillageHeart() {
  const ref = useRef<HTMLElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [still, setStill] = useState(false);
  const st = useRef<ScrollTrigger | null>(null);
  useInViewReveal(head);

  useEffect(() => {
    const s = stillMode();
    setStill(s);
    const el = ref.current;
    if (!el || s) return;
    const slides = el.querySelectorAll<HTMLElement>(".vc-heart__slide");
    const n = slides.length;
    const tl = gsap.timeline({ defaults: { ease: "none" } });
    slides.forEach((slide, i) => {
      if (i === 0) return;
      const at = HOLD + (i - 1) * STEP;
      tl.fromTo(slide, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "power2.inOut" }, at);
      const img = slide.querySelector("img");
      if (img) tl.fromTo(img, { scale: 1.14, yPercent: 4 }, { scale: 1, yPercent: 0, duration: 1.2, ease: "power2.out" }, at);
    });
    tl.to({}, { duration: HOLD }, HOLD + (n - 1) * STEP - 0.001);
    const total = tl.duration();
    st.current = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: () => `+=${Math.round((n - 1) * window.innerHeight * 0.95)}`,
      pin: true,
      scrub: 0.8,
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
      st.current?.kill();
      st.current = null;
      tl.kill();
    };
  }, []);

  /** Scroll to where amenity i is fully shown. */
  const show = (i: number) => {
    const t = st.current;
    if (!t) return;
    const n = AMENITIES.length;
    const total = HOLD + (n - 1) * STEP + HOLD;
    const time = i === 0 ? 0 : HOLD + (i - 1) * STEP + 1.05;
    scrollToY(t.start + (t.end - t.start) * (time / total));
  };

  const [lead, tail] = CLASSIC.villageHeart.title.split(" around ");
  return (
    <section ref={ref} id="village-heart" className={`vc-heart${still ? " is-still" : ""}`} aria-labelledby="vc-heart-title">
      <div className="vc-heart__inner vc-wrap">
        <div ref={head} className="vc-heart__side">
          <Eyebrow n="02">{CLASSIC.villageHeart.eyebrow}</Eyebrow>
          <h2 id="vc-heart-title" className="vc-title vc-heart__title" data-r="lines">
            {lead} <em>around {tail}</em>
          </h2>
          <ol className="vc-heart__list" data-r="fade">
            {AMENITIES.map((a, i) => (
              <li key={a.id} data-active={i === active ? "1" : "0"}>
                <button type="button" onClick={() => show(i)} aria-current={i === active ? "true" : undefined}>
                  <span className="vc-heart__dot" aria-hidden="true" />
                  <span className="vc-heart__n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="vc-heart__name">{a.title}</span>
                </button>
                <p className="vc-heart__text">{a.text}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="vc-heart__stage">
          {AMENITY_PHOTOS.map((p, i) => (
            <figure key={p.src} className="vc-heart__slide" style={{ zIndex: i + 1 }}>
              <Pic photo={p} sizes="(max-width: 820px) 100vw, 64vw" />
              <figcaption className="vc-heart__cap">
                <span>{String(i + 1).padStart(2, "0")}</span> / {String(AMENITY_PHOTOS.length).padStart(2, "0")}
                <b>{AMENITIES[i].title}</b>
                <i>{AMENITIES[i].text}</i>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
