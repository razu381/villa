"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SPOT_ANCHORS, SPOT_VIEW } from "@/lib/anchors";
import { SPOTS, spotIndex } from "@/lib/places";
import { useJourney } from "@/lib/store";
import { UI } from "@/lib/ui-copy";
import { damp } from "@/lib/ui-time";
import { openPhotos } from "./explore";

/** The spots that stand somewhere in the model (the rest are in the gallery only). */
const PINNED = SPOTS.filter((s) => s.at);

/** HTML a pin never sits under: the header, the way back, the sun arc, the panel. */
const KEEP_OUT = ".vl-header, .vl-back-wrap, .vl-arc, .vl-panel";

/**
 * The open place's photo pins (lib/places.ts): an architect's annotation on
 * the model, a small ring on the room, a hairline up to its name and, when it
 * holds more than one, how many photos. They fade in only while the camera is
 * still (lib/anchors.ts SPOT_VIEW: arrived, not turning, not gliding) and never
 * under the interface; a click opens the spot's photos. Fixed over the canvas,
 * above the journey's pointer layer, placed by a rAF loop that runs only while
 * a place is open or a pin is still fading.
 */
export function Spots() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const pins = PINNED.map((s) => root.querySelector<HTMLButtonElement>(`[data-spot="${s.key}"]`)!);
    const k = PINNED.map(() => 0);
    let keepOut: DOMRect[] = [];
    let measured = -1e9;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = useJourney.getState();
      const open = s.mode === "explore" ? s.home : null;
      if (now - measured > 400) {
        keepOut = Array.from(document.querySelectorAll(KEEP_OUT), (el) => el.getBoundingClientRect());
        measured = now;
      }
      let busy = open != null;
      PINNED.forEach((spot, i) => {
        const a = SPOT_ANCHORS[spot.key];
        // The pin rises ~60 px above its point and its name runs ~170 px to the right.
        const clear = !keepOut.some((r) => r.width > 0 && a.x > r.left - 180 && a.x < r.right + 16 && a.y > r.top - 16 && a.y < r.bottom + 70);
        const want = open === spot.place && a.visible && SPOT_VIEW.still && !s.viewer && clear ? 1 : 0;
        k[i] = s.snap || s.reducedMotion ? want : damp(k[i], want, 5, dt);
        if (Math.abs(k[i] - want) < 0.002) k[i] = want;
        const el = pins[i];
        el.style.opacity = k[i].toFixed(3);
        const on = k[i] > 0.5;
        if ((el.dataset.on === "1") !== on) {
          el.dataset.on = on ? "1" : "0";
          // Hidden pins leave the tab order (a focused one keeps its focus).
          el.tabIndex = on ? 0 : -1;
        }
        if (k[i] > 0) {
          el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
          if (k[i] !== want) busy = true;
        }
      });
      raf = busy ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    kick();
    const unsub = useJourney.subscribe(kick);
    return () => {
      cancelAnimationFrame(raf);
      unsub();
    };
  }, [host]);

  if (!host) return null;
  return createPortal(
    <div ref={ref} className="vl-spots">
      {PINNED.map((spot) => (
        <button
          key={spot.key}
          type="button"
          className="vl-spot"
          data-spot={spot.key}
          data-on="0"
          tabIndex={-1}
          style={{ opacity: 0 }}
          aria-label={`${spot.label}: ${UI.homes.openPhotos}`}
          onClick={() => openPhotos(spot.place, spotIndex(spot))}
        >
          <span className="vl-spot__ring" aria-hidden="true" />
          <span className="vl-spot__stem" aria-hidden="true" />
          <span className="vl-spot__name" aria-hidden="true">
            {spot.label}
            {spot.photos.length > 1 && <i>{String(spot.photos.length).padStart(2, "0")}</i>}
          </span>
        </button>
      ))}
    </div>,
    host,
  );
}
