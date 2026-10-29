"use client";

import { useEffect, useRef } from "react";
import { afterOpening } from "@/lib/opening";
import { gsap, stillMode } from "./env";

/** The incoming content rises beneath the outgoing section, like the footer. */
export function JoinVeil() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const section = el?.closest("section");
    if (!el || !section || stillMode()) return;
    let tl: gsap.core.Timeline | null = null;
    const cancel = afterOpening(() => {
      section.dataset.join = "1";
      tl = gsap.timeline({
        scrollTrigger: { trigger: section, start: "top bottom", end: "top top", scrub: true, invalidateOnRefresh: true, refreshPriority: -1 },
      });
      // Move the contents independently of the section's existing pin/sticky layout.
      tl.fromTo(section, { "--vc-join-y": () => `${-Math.min(window.innerHeight, section.offsetHeight) * 0.5}px` }, { "--vc-join-y": "0px", ease: "none" }, 0)
        .fromTo(el, { opacity: 1 }, { opacity: 0, ease: "none" }, 0);
    });
    return () => {
      cancel();
      tl?.scrollTrigger?.kill();
      tl?.kill();
      section.style.removeProperty("--vc-join-y");
      delete section.dataset.join;
      gsap.set(el, { clearProps: "opacity" });
    };
  }, []);
  return <div ref={ref} className="vc-join" aria-hidden="true" />;
}
