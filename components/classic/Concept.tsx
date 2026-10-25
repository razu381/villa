"use client";

import { useEffect, useRef } from "react";
import { CONCEPT } from "@/lib/content";
import { CLASSIC, PHOTOS, PILLAR_PHOTOS } from "@/lib/classic-content";
import { afterOpening } from "@/lib/opening";
import { useInViewReveal } from "@/lib/ui-reveal";
import { ARCH_PATH } from "../ui/Brand";
import { gsap, stillMode } from "./env";
import { ArchClip, Pic } from "../ui/Pic";

/** Section label: a number and a name, as in the client's layout. */
export function Eyebrow({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="vc-eyebrow" data-r="fade">
      <span>{n}</span>
      {children}
    </p>
  );
}

/** Words that ink in from pale to full as the paragraph scrolls through the screen. */
function InkText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || stillMode()) return;
    let tw: gsap.core.Tween | null = null;
    const cancel = afterOpening(() => {
      tw = gsap.fromTo(
        el.querySelectorAll(".vc-ink__w"),
        { opacity: 0.16 },
        { opacity: 1, ease: "none", stagger: 0.5, scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 48%", scrub: 0.6 } },
      );
    });
    return () => {
      cancel();
      tw?.scrollTrigger?.kill();
      tw?.kill();
    };
  }, []);
  return (
    <p ref={ref} className="vc-ink" aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="vc-ink__w" aria-hidden="true">
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

/** The brand arch as a hairline that draws itself while the section scrolls by. */
function ArchLine({ className }: { className: string }) {
  const ref = useRef<SVGPathElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stillMode()) {
      el.style.strokeDashoffset = "0";
      return;
    }
    let tw: gsap.core.Tween | null = null;
    const cancel = afterOpening(() => {
      tw = gsap.fromTo(
        el,
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: el.closest("section"), start: "top 75%", end: "center 35%", scrub: 1 } },
      );
    });
    return () => {
      cancel();
      tw?.scrollTrigger?.kill();
      tw?.kill();
    };
  }, []);
  return (
    <svg className={className} viewBox="-1 -1 102 114" preserveAspectRatio="none" aria-hidden="true">
      <path ref={ref} d={ARCH_PATH} pathLength={1} />
    </svg>
  );
}

/**
 * Concept: the client's "modern Castro" (replacing "A contemporary stronghold"),
 * then the four pillars on the stone band, each with the photo that shows it
 * (after Anuc Home's numbered services): children's shadows on a stone wall,
 * the limestone walls, the solar roofs, cork and limestone up close.
 */
export function Concept() {
  const intro = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const pillars = useRef<HTMLDivElement>(null);
  useInViewReveal(intro);
  useInViewReveal(frame, { delay: 0.2 });
  useInViewReveal(pillars, { margin: "-18%" });

  const [lead, ...rest] = CONCEPT.title.split(": ");
  return (
    <section id="concept" className="vc-concept" aria-labelledby="vc-concept-title">
      <ArchClip />
      <div className="vc-concept__intro vc-wrap">
        <div ref={intro} className="vc-concept__text">
          <Eyebrow n="01">Concept</Eyebrow>
          <h2 id="vc-concept-title" className="vc-title" data-r="lines">
            {lead}: <em>{rest.join(": ")}</em>
          </h2>
          <InkText text={CONCEPT.intro} />
        </div>
        <div className="vc-concept__visual">
          <ArchLine className="vc-concept__archline" />
          <div ref={frame} className="vc-concept__frame">
            <div className="vc-arch-frame" data-r="rise">
              <Pic photo={PHOTOS.terraceTall} sizes="(max-width: 820px) 80vw, 30vw" />
            </div>
          </div>
        </div>
      </div>

      <div ref={pillars} className="vc-pillars">
        <p className="vc-eyebrow vc-wrap" data-r="fade">
          <span>—</span>
          {CLASSIC.pillars}
        </p>
        <ol className="vc-pillars__list vc-wrap">
          {CONCEPT.pillars.map((p, i) => (
            <li key={p.title} className="vc-pillar" style={{ "--pos": PILLAR_PHOTOS[i].pos } as React.CSSProperties}>
              <div className="vc-pillar__img" data-r="rise">
                <span className="vc-pillar__zoom">
                  <Pic photo={PILLAR_PHOTOS[i].photo} sizes="(max-width: 820px) 100vw, 24vw" />
                </span>
              </div>
              <span className="vc-pillar__n" data-r="fade">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="vc-pillar__title" data-r="fade">
                {p.title}
              </h3>
              <p className="vc-pillar__text" data-r="fade">
                {p.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

