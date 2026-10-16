"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { useJourney } from "@/lib/store";
import { gsap, ScrollTrigger, stillMode } from "./env";
import { ClassicHeader } from "./ClassicHeader";
import { GridLines } from "./GridLines";
import { Hero } from "./Hero";
import { Concept } from "./Concept";

/**
 * The classic site: the client's own layout (concept, village heart, villas,
 * location, gallery, private visit) without the 3D, on Lenis like the journey.
 */
export default function Classic() {
  useEffect(() => {
    document.documentElement.dataset.rm = useJourney.getState().reducedMotion ? "1" : "0";
    if (stillMode()) return;
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: true, syncTouch: false });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // Late images and fonts change section heights: keep the pins measured.
    let timer = 0;
    let lastH = document.body.offsetHeight;
    const ro = new ResizeObserver(() => {
      if (Math.abs(document.body.offsetHeight - lastH) < 2) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        ScrollTrigger.refresh();
        lastH = document.body.offsetHeight;
      }, 200);
    });
    ro.observe(document.body);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
      gsap.ticker.remove(tick);
      lenis.destroy();
      window.__lenis = null;
    };
  }, []);

  return (
    <div className="vc">
      <a href="#villas" className="vl-skip">
        Skip to the villas
      </a>
      <GridLines />
      <ClassicHeader />
      <main id="main" className="vc-main">
        <Hero />
        <Concept />
      </main>
    </div>
  );
}
