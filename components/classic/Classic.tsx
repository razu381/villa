"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { initLang } from "@/lib/lang";
import { afterOpening, openingNow, openUp } from "@/lib/opening";
import { useJourney } from "@/lib/store";
import { gsap, ScrollTrigger, stillMode } from "./env";
import { ClassicHeader } from "./ClassicHeader";
import { GridLines } from "./GridLines";
import { Hero } from "./Hero";
import { Concept } from "./Concept";
import { VillageHeart } from "./VillageHeart";
import { Villas } from "./Villas";
import { Location } from "./Location";
import { Gallery } from "./Gallery";
import { Visit } from "./Visit";
import { ClassicFooter } from "./ClassicFooter";

/**
 * The classic site: the client's own layout (concept, village heart, villas,
 * location, gallery, private visit) without the 3D, on Lenis like the journey.
 */
export default function Classic() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.rm = useJourney.getState().reducedMotion ? "1" : "0";
    initLang(); // the saved choice, else the browser's language (lib/lang)
    // Until the opening is over, the sections under the hero skip layout
    // (classic.css), so the first paint is the hero's alone. They are laid out
    // first thing after, before any scroll animation measures them.
    const cancelLayout = afterOpening(
      () => {
        if (ref.current) ref.current.dataset.opened = "1";
      },
      { first: true },
    );
    if (stillMode()) {
      openingNow();
      return cancelLayout;
    }
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: true, syncTouch: false });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // The sections build their scroll animations after the opening (lib/opening;
    // this runs last, after theirs): measure them all once then, and again
    // whenever late fonts or images change the page's height.
    let timer = 0;
    let lastH = 0;
    const ro = new ResizeObserver(() => {
      if (Math.abs(document.body.offsetHeight - lastH) < 2) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        ScrollTrigger.refresh();
        lastH = document.body.offsetHeight;
      }, 200);
    });
    const cancel = afterOpening(() => {
      ScrollTrigger.refresh();
      lastH = document.body.offsetHeight;
      ro.observe(document.body);
    });
    // The opening is over once the visitor reaches for the page (keys at once:
    // a skip link or a page key measures the page next), or after a while.
    const soon = () => openUp();
    const now = () => openingNow();
    const reach: [string, () => void][] = [
      ["wheel", soon],
      ["touchstart", soon],
      ["pointerdown", soon],
      ["scroll", soon],
      ["keydown", now],
    ];
    reach.forEach(([type, fn]) => window.addEventListener(type, fn, { passive: true, once: true }));
    const late = window.setTimeout(openUp, 6000);
    // Already down the page (a reload, a #link): no opening to protect. A #link
    // is jumped to again, now that the sections have their real heights.
    const hash = window.location.hash.slice(1);
    if (hash) {
      openingNow();
      document.getElementById(decodeURIComponent(hash))?.scrollIntoView();
    } else if (window.scrollY > 0) openingNow();
    return () => {
      cancelLayout();
      cancel();
      reach.forEach(([type, fn]) => window.removeEventListener(type, fn));
      window.clearTimeout(late);
      ro.disconnect();
      window.clearTimeout(timer);
      gsap.ticker.remove(tick);
      lenis.destroy();
      window.__lenis = null;
    };
  }, []);

  return (
    <div ref={ref} className="vc">
      <a href="#villas" className="vl-skip">
        Skip to the villas
      </a>
      <GridLines />
      <ClassicHeader />
      <main id="main" className="vc-main">
        <Hero />
        <Concept />
        <VillageHeart />
        <Villas />
        <Location />
        <Gallery />
        <Visit />
      </main>
      <ClassicFooter />
    </div>
  );
}
