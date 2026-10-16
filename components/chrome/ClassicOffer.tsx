"use client";

import { useEffect, useState } from "react";
import { useJourney, type JourneyState } from "@/lib/store";
import { UI } from "@/lib/ui-copy";

const KEY = "vl-classic-offer";

/**
 * On a device that can't run the 3D well (tier low: no WebGL2, Save-Data or a
 * very weak machine; or a canvas that is gone for good), a quiet card offers
 * the classic site after a moment. Nobody is moved without choosing; "Stay
 * here" holds for the session. Never in screenshots (?snap=1).
 */
export function ClassicOffer() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(KEY) === "stay") return;
    } catch {
      // Storage blocked: just offer it.
    }
    let timer = 0;
    const check = (s: JourneyState) => {
      if (s.snap || timer) return;
      if (s.tier === "low" || s.canvas === "gone") timer = window.setTimeout(() => setShow(true), 2000);
    };
    check(useJourney.getState());
    const unsub = useJourney.subscribe(check);
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);

  if (!show) return null;
  return (
    <aside className="vl-offer" aria-label={UI.nav.classic}>
      <p>{UI.offer.text}</p>
      <div className="vl-offer__actions">
        <a href="/classic" className="vl-btn vl-btn--solid">
          {UI.offer.open}
        </a>
        <button
          type="button"
          className="vl-link"
          onClick={() => {
            setShow(false);
            try {
              window.sessionStorage.setItem(KEY, "stay");
            } catch {
              // Storage blocked: it simply may ask again on the next visit.
            }
          }}
        >
          {UI.offer.stay}
        </button>
      </div>
    </aside>
  );
}
