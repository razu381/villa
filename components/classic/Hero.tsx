"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/content";
import { CLASSIC } from "@/lib/classic-content";
import { Wordmark } from "../ui/Brand";
import { stillMode } from "./env";

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * The film loops without sound; once it plays, the wordmark fades in slowly,
 * then "Living in harmony" (the client's notes). Scrolling away, the wordmark
 * glides up into the header and docks there.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  const [phase, setPhase] = useState(0);

  // The film starts; the wordmark, then the tagline, follow.
  useEffect(() => {
    const s = stillMode();
    setStill(s);
    if (s) {
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
    };
    const v = videoRef.current;
    v?.addEventListener("playing", start, { once: true });
    // Autoplay refused or slow: don't keep the name waiting.
    timers.push(window.setTimeout(start, 1600));
    return () => {
      v?.removeEventListener("playing", start);
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
    let raf = 0;
    const update = () => {
      raf = 0;
      const end = hero.offsetHeight * 0.82;
      const p = Math.min(1, Math.max(0, window.scrollY / end));
      // The architect's grid draws itself as the paper first shows.
      if (root && root.dataset.grid !== "1" && (s || p > 0.3)) root.dataset.grid = "1";
      if (s) {
        header.dataset.mark = p >= 1 ? "1" : "0";
        return;
      }
      mark.style.transform = "";
      const from = mark.getBoundingClientRect();
      const to = slot.getBoundingClientRect();
      const e = easeInOut(p);
      const k = to.width / from.width;
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      mark.style.transform = `translate3d(${(dx * e).toFixed(2)}px, ${(dy * e).toFixed(2)}px, 0) scale(${(1 + (k - 1) * e).toFixed(4)})`;
      const docked = p >= 1;
      mark.style.visibility = docked ? "hidden" : "";
      header.dataset.mark = docked ? "1" : "0";
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
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
            <source src="/media/hero-loop.webm" type="video/webm" />
            <source src="/media/hero-loop.mp4" type="video/mp4" />
          </video>
        )}
      </div>
      <div className="vc-hero__fade" aria-hidden="true" />
      <div className={`vc-hero__brand${still ? " is-still" : ""}`}>
        <div ref={markRef} className="vc-hero__mark">
          <Wordmark className="vc-hero__wordmark" label={BRAND.name} />
        </div>
      </div>
      <p className="vc-hero__tagline">{BRAND.tagline}</p>
      <p className="vc-hero__cue" aria-hidden="true">
        <span />
        {CLASSIC.scroll}
      </p>
    </section>
  );
}
