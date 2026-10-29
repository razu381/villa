"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useCopy } from "@/lib/copy";
import { useJourney } from "@/lib/store";
import type { VisitRequest } from "@/lib/ui-copy";
import { formatVisitDate } from "@/lib/ui-time";
import { ARCH_PATH, Wordmark } from "../ui/Brand";

/**
 * The confirmation, as a letterpress invitation on limestone paper:
 * a gold-foil crest of the three arches, debossed type, one large blind-embossed
 * arch behind the words, the wordmark and the place.
 */
export function InvitationCard({ data, ref: outerRef }: { data: VisitRequest; ref?: React.Ref<HTMLDivElement> }) {
  const copy = useCopy();
  const ref = useRef<HTMLDivElement>(null);
  const home = copy.HOMES.find((h) => h.id === data.home);
  const first = data.name.trim().split(/\s+/)[0] || data.name;
  const where = home ? `${copy.UI.card.the}${home.name}` : copy.UI.card.anyHome;
  const when = formatVisitDate(data.date, copy.locale);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = useJourney.getState();
    if (s.snap) return;
    const ctx = gsap.context(() => {
      if (s.reducedMotion) {
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "power2.out" });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.fromTo(el, { opacity: 0, y: 36, rotateX: 10, transformPerspective: 1400 }, { opacity: 1, y: 0, rotateX: 0, duration: 1.8 }, 0);
      tl.fromTo(el.querySelector(".vl-inv__emboss"), { opacity: 0 }, { opacity: 1, duration: 2.4, ease: "power2.inOut" }, 0.4);
      tl.fromTo(el.querySelectorAll("[data-c]"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1.3, stagger: 0.085 }, 0.5);
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div className="vl-inv-wrap">
      <div ref={mergeRefs(ref, outerRef)} className="vl-inv" tabIndex={-1} role="img" aria-label={`${copy.UI.card.title} ${copy.UI.card.for} ${data.name}: ${copy.UI.card.visit} ${where}, ${when}, ${copy.TIME_WORDS[data.time]}. Vila Leku, ${copy.UI.card.place}.`}>
        <div className="vl-inv__frame" aria-hidden="true" />
        <svg className="vl-inv__emboss" viewBox="-2 -2 104 116" preserveAspectRatio="none" aria-hidden="true">
          <path d={ARCH_PATH} transform="translate(0 0.45)" />
          <path d={ARCH_PATH} />
        </svg>
        <div className="vl-inv__content" aria-hidden="true">
          <span className="vl-inv__crest" data-c />
          <p className="vl-inv__title" data-c>
            {copy.UI.card.title}
          </p>
          <p className="vl-inv__for" data-c>
            {copy.UI.card.for} {data.name}
          </p>
          <span className="vl-inv__rule" data-c />
          <p className="vl-inv__visit" data-c>
            {copy.UI.card.visit} {where}
          </p>
          <p className="vl-inv__date" data-c>
            {when}
          </p>
          <p className="vl-inv__time" data-c>
            {copy.TIME_WORDS[data.time]}
          </p>
          <div className="vl-inv__sign" data-c>
            <Wordmark className="vl-inv__mark" label={null} />
            <span className="vl-inv__place">{copy.UI.card.place}</span>
          </div>
        </div>
      </div>
      <p className="vl-inv__note">
        {copy.UI.card.thanks}, {first}. {copy.UI.card.confirmBody}
      </p>
    </div>
  );
}

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const r of refs) {
      if (typeof r === "function") r(node);
      else if (r) (r as React.RefObject<T | null>).current = node;
    }
  };
}
