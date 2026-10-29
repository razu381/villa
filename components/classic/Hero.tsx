"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/content";
import { CLASSIC } from "@/lib/classic-content";
import { openUp } from "@/lib/opening";
import { Wordmark } from "../ui/Brand";
import { stillMode } from "./env";

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * The film loops without sound; once it plays, it fades in over the poster, the
 * wordmark fades in slowly, then "Living in harmony" (the client's notes).
 * Scrolling away, the wordmark glides up into the header and docks there.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLParagraphElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  const [phase, setPhase] = useState(0);

  // The film starts; the wordmark, then the tagline, follow; then the rest of
  // the page may set itself up (lib/opening).
  useEffect(() => {
    const s = stillMode();
    setStill(s);
    if (s) {
      // No film (the poster stands): stop the download the HTML has started,
      // which removing the element would only pause.
      const v = videoRef.current;
      if (v) {
        v.pause();
        v.querySelectorAll("source").forEach((el) => el.remove());
        v.load();
      }
      setPhase(2);
      return;
    }
    const timers: number[] = [];
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      timers.push(window.setTimeout(() => setPhase(1), 500));
      timers.push(window.setTimeout(() => setPhase(2), 1500));
      // Once both fades (classic.css: 2.4 s from 0.5 s, 1.8 s from 1.5 s) are done.
      timers.push(window.setTimeout(openUp, 3400));
    };
    const v = videoRef.current;
    const filmIn = () => {
      v?.classList.add("is-playing");
      start();
    };
    // The film autoplays from the HTML, so it is often playing before this runs.
    if (v && !v.paused && v.readyState >= 3) filmIn();
    else v?.addEventListener("playing", filmIn, { once: true });
    // Autoplay refused or slow: don't keep the name waiting.
    timers.push(window.setTimeout(start, 2000));
    return () => {
      v?.removeEventListener("playing", filmIn);
      timers.forEach(window.clearTimeout);
    };
  }, []);

  // Docking: the fixed wordmark travels to the header's slot as the hero scrolls away.
  useEffect(() => {
    const hero = ref.current;
    const mark = markRef.current;
    const header = document.querySelector<HTMLElement>(".vc-header");
    const slot = document.querySelector<HTMLElement>(".vc-header__wordmark");
    if (!hero || !mark || !header || !slot) return;
    const s = stillMode();
    const root = hero.closest<HTMLElement>(".vc");
    // Both ends are fixed to the screen, so the path is measured once (and on
    // resize, and when the fonts settle the header), never per scroll frame.
    let end = 1;
    let dx = 0;
    let dy = 0;
    let k = 1;
    let lastP = -1;
    const measure = () => {
      end = hero.offsetHeight * 0.82;
      lastP = -1;
      if (s) return;
      mark.style.transform = "";
      const from = mark.getBoundingClientRect();
      const to = slot.getBoundingClientRect();
      k = to.width / from.width;
      dx = to.left + to.width / 2 - (from.left + from.width / 2);
      dy = to.top + to.height / 2 - (from.top + from.height / 2);
    };
    let raf = 0;
    const update = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / end));
      // The architect's grid draws itself as the paper first shows.
      if (root && root.dataset.grid !== "1" && (s || p > 0.3)) root.dataset.grid = "1";
      const docked = p >= 1 ? "1" : "0";
      if (header.dataset.mark !== docked) header.dataset.mark = docked;
      // The client's note: as the wordmark rises to the menu, the tagline goes
      // with it (the CSS's slow fade-in stays untouched until the dock begins).
      const tag = tagRef.current;
      if (tag) {
        if (p > 0.001) {
          tag.style.transitionDuration = "0.15s";
          tag.style.opacity = String(Math.max(0, 1 - p / 0.35));
        } else if (tag.style.opacity) {
          tag.style.opacity = "";
          tag.style.transitionDuration = "";
        }
      }
      if (s || p === lastP) return;
      lastP = p;
      const e = easeInOut(p);
      mark.style.transform = `translate3d(${(dx * e).toFixed(2)}px, ${(dy * e).toFixed(2)}px, 0) scale(${(1 + (k - 1) * e).toFixed(4)})`;
      mark.style.visibility = p >= 1 ? "hidden" : "";
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    update();
    document.fonts?.ready.then(onResize).catch(() => {});
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <section ref={ref} id="top" className="vc-hero" aria-label={`${BRAND.name}: ${BRAND.tagline}`} data-phase={phase}>
      <div className="vc-hero__media">
        <picture>
          <source srcSet="/media/hero-poster.avif" type="image/avif" />
          <source srcSet="/media/hero-poster.webp" type="image/webp" />
          <img src="/media/hero-poster.jpg" alt="" fetchPriority="high" />
        </picture>
        {!still && (
          <video ref={videoRef} autoPlay muted loop playsInline preload="auto" aria-hidden="true">
            {/* Phones take the lighter cut (as the 3D does), chosen once as the page loads.
                Desktop first: a browser that ignores `media` keeps the full film. */}
            <source src="/media/hero-loop.webm" type="video/webm" media="(min-width: 821px)" />
            <source src="/media/hero-loop.mp4" type="video/mp4" media="(min-width: 821px)" />
            <source src="/media/hero-loop-mobile.webm" type="video/webm" />
            <source src="/media/hero-loop-mobile.mp4" type="video/mp4" />
          </video>
        )}
      </div>
      <div className="vc-hero__fade" aria-hidden="true" />
      <div className={`vc-hero__brand${still ? " is-still" : ""}`}>
        <div ref={markRef} className="vc-hero__mark">
          <Wordmark className="vc-hero__wordmark" label={BRAND.name} />
        </div>
      </div>
      <p ref={tagRef} className="vc-hero__tagline">
        {BRAND.tagline}
      </p>
      <p className="vc-hero__cue" aria-hidden="true">
        <span />
        {CLASSIC.scroll}
      </p>
    </section>
  );
}
