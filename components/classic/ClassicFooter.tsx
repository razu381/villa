"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/content";
import { COMPLAINTS_URL } from "@/lib/classic-content";
import { useCopy } from "@/lib/copy";
import { afterOpening } from "@/lib/opening";
import { PhidiasTagline, Wordmark } from "../ui/Brand";
import { goTo } from "./ClassicHeader";
import { gsap, stillMode } from "./env";

/**
 * The footer (the client: a fixed footer, with no logos but Vila Leku and
 * Phidias; partners as words). It waits underneath and the page lifts off it,
 * like a curtain; a spacer of its height keeps the page long enough. It rises
 * into place at half the page's pace, out of the page's shadow, so its top
 * arrives first and the change of colour never cuts. Taller than the window,
 * it simply follows the page.
 */
export function ClassicFooter() {
  const copy = useCopy();
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
    let tl: gsap.core.Timeline | null = null;
    const cancel = afterOpening(() => {
      tl = gsap.timeline({ scrollTrigger: { trigger: sp, start: "top bottom", end: "bottom bottom", scrub: true, invalidateOnRefresh: true } });
      tl.fromTo(el, { y: () => el.offsetHeight * 0.5 }, { y: 0, ease: "none" }, 0).fromTo(veil.current, { opacity: 1 }, { opacity: 0, ease: "none" }, 0);
    });
    return () => {
      cancel();
      if (!tl) return;
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
          <Wordmark className="vc-footer__mark" label={BRAND.name} />
          <div className="vc-footer__cols">
            <div className="vc-footer__about">
              <p>{copy.CLASSIC.footer.line}</p>
              <p className="vc-footer__place">{copy.CLASSIC.footer.place}</p>
            </div>
            <nav className="vc-footer__col" aria-label={copy.CLASSIC.footer.explore}>
              <h3>{copy.CLASSIC.footer.explore}</h3>
              <ul>
                {copy.NAV.map((n) => (
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
              <h3>{copy.CLASSIC.footer.contact}</h3>
              <ul>
                <li>
                  <a className="vl-link" href={`mailto:${copy.CLASSIC.footer.email}`}>
                    {copy.CLASSIC.footer.email}
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
                {copy.CLASSIC.visitCta}
              </a>
            </div>
          </div>
        </div>
        <div className="vc-footer__base vc-wrap">
          <ul className="vc-footer__partners" aria-label={copy.CLASSIC.footer.company}>
            {copy.PARTNERS.map((p) => (
              <li key={p.name}>
                <span>{p.role}</span>
                <b>
                  <a className="vl-link" href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.name}
                  </a>
                </b>
                <i>{p.note}</i>
              </li>
            ))}
          </ul>
          <div className="vc-footer__dev">
            <PhidiasTagline className="vc-footer__phidias" />
          </div>
          <p className="vc-footer__legal">
            <span className="vc-footer__legal-links">
              <a className="vl-link" href="/privacy/">
                {copy.CLASSIC.footer.privacy}
              </a>
              <a className="vl-link" href={COMPLAINTS_URL} target="_blank" rel="noopener noreferrer">
                {copy.CLASSIC.footer.complaints}
              </a>
            </span>
            <span>{copy.UI.footer.copyright}</span>
          </p>
        </div>
        <div ref={veil} className="vc-footer__veil" aria-hidden="true" />
      </footer>
    </>
  );
}
