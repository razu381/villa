"use client";

import { useEffect, useRef } from "react";
import { afterOpening } from "@/lib/opening";
import { gsap, stillMode } from "./env";

/**
 * The Visit→footer handover (the client's note, VS3 p. 6), lifted to other
 * section joins: the arriving section rises from beneath the one leaving, its
 * shadow veil lifting off as it comes up.
 * ponytail: a veil + scrubbed fade stands in for a full curtain-lift (the
 * footer's fixed-underneath pin); upgrade to a sticky overlap only if the
 * client wants the sections to physically cover each other.
 */
export function JoinVeil() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const section = el?.closest("section");
    if (!el || !section || stillMode()) return;
    let tw: gsap.core.Tween | null = null;
    const cancel = afterOpening(() => {
      tw = gsap.fromTo(
        el,
        { opacity: 1 },
        { opacity: 0, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "top 45%", scrub: true } },
      );
    });
    return () => {
      cancel();
      tw?.scrollTrigger?.kill();
      tw?.kill();
    };
  }, []);
  return <div ref={ref} className="vc-join" aria-hidden="true" />;
}
