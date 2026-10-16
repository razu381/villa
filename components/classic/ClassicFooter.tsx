"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/content";
import { CLASSIC, NAV, PARTNERS } from "@/lib/classic-content";
import { UI } from "@/lib/ui-copy";
import { PhidiasMark, Wordmark } from "../ui/Brand";
import { goTo } from "./ClassicHeader";
import { gsap, stillMode } from "./env";
import { ARCH_BOX } from "./Pic";

/**
 * The footer (the client: a fixed footer, with no logos but Vila Leku and
 * Phidias; partners as words). It waits underneath and the page lifts off it,
 * like a curtain; a spacer of its height keeps the page long enough. It rises
 * into place at half the page's pace, out of the page's shadow, so its top
 * arrives first and the change of colour never cuts. Taller than the window,
 * it simply follows the page.
 */
export function ClassicFooter() {
  const ref = useRef<HTMLElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  const [on, setOn] = useState(false);
  const [fits, setFits] = useState(true);

  useEffect(() => {
    const el = ref.current;
    const sp = spacer.current;
    if (!el || !sp) return;
    const measure = () => {
      setH(el.offsetHeight);
      setFits(el.offsetHeight < window.innerHeight - 40);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    // Shown only once its space scrolls in, so it never peeks through earlier.
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: "0px 0px 40px 0px" });
    io.observe(sp);
    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // The curtain lifts: scrubbed by the scroll across the spacer (Lenis smooths it).
  useEffect(() => {
    const el = ref.current;
    const sp = spacer.current;
    if (!el || !sp || !fits || stillMode()) return;
    const tl = gsap.timeline({ scrollTrigger: { trigger: sp, start: "top bottom", end: "bottom bottom", scrub: true, invalidateOnRefresh: true } });
    tl.fromTo(el, { y: () => el.offsetHeight * 0.5 }, { y: 0, ease: "none" }, 0).fromTo(veil.current, { opacity: 1 }, { opacity: 0, ease: "none" }, 0);
    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
      gsap.set([el, veil.current], { clearProps: "transform,opacity" });
    };
  }, [fits]);

  return (
    <>
      <div ref={spacer} className="vc-footer-spacer" style={{ height: fits ? h : 0 }} aria-hidden="true" />
      <footer ref={ref} className="vc-footer" data-on={on || !fits ? "1" : "0"} data-fixed={fits ? "1" : "0"}>
        <div className="vc-footer__top vc-wrap">
          <svg className="vc-footer__arches" viewBox="0 0 3.3 1" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
            {[0, 1.15, 2.3].map((x) => (
              <path key={x} d={ARCH_BOX} transform={`translate(${x} 0)`} />
            ))}
          </svg>
          <Wordmark className="vc-footer__mark" label={BRAND.name} />
          <div className="vc-footer__cols">
            <div className="vc-footer__about">
              <p>{CLASSIC.footer.line}</p>
              <p className="vc-footer__place">{CLASSIC.footer.place}</p>
            </div>
            <nav className="vc-footer__col" aria-label={CLASSIC.footer.explore}>
              <h3>{CLASSIC.footer.explore}</h3>
              <ul>
                {NAV.map((n) => (
                  <li key={n.id}>
                    <a
                      className="vl-link"
                      href={`#${n.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        goTo(n.id);
                      }}
                    >
                      {n.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="vc-footer__col">
              <h3>{CLASSIC.footer.contact}</h3>
              <ul>
                <li>
                  <a className="vl-link" href={`mailto:${CLASSIC.footer.email}`}>
                    {CLASSIC.footer.email}
                  </a>
                </li>
                <li>
                  <a className="vl-link" href="/">
                    {CLASSIC.immersive}
                  </a>
                </li>
              </ul>
              <a
                className="vl-btn vl-btn--solid vc-footer__visit"
                href="#visit"
                onClick={(e) => {
                  e.preventDefault();
                  goTo("visit", '#visit input[name="name"]');
                }}
              >
                {CLASSIC.visitCta}
              </a>
            </div>
          </div>
        </div>
        <div className="vc-footer__base vc-wrap">
          <ul className="vc-footer__partners" aria-label={CLASSIC.footer.company}>
            {PARTNERS.map((p) => (
              <li key={p.name}>
                <span>{p.role}</span>
                <b>{p.name}</b>
                <i>{p.note}</i>
              </li>
            ))}
          </ul>
          <div className="vc-footer__dev">
            <PhidiasMark className="vc-footer__phidias" />
            <span>{UI.footer.signature}</span>
          </div>
          <p className="vc-footer__legal">
            <span>{BRAND.disclaimer}</span>
            <span>{UI.footer.copyright}</span>
          </p>
        </div>
        <div ref={veil} className="vc-footer__veil" aria-hidden="true" />
      </footer>
    </>
  );
}
