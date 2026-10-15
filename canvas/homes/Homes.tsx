"use client";

/**
 * "Two ways to live" — the two featured homes (FEATURED.v3 townhouse in row C,
 * FEATURED.v4 villa in row D). See FeaturedHome for the journey / jewel /
 * exploded-view behaviour. Hovering or focusing a home's HTML card
 * (`.vl-card[data-home]`) lights the matching home in 3D.
 */

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { HomeId } from "@/lib/store";
import { FeaturedHome } from "./FeaturedHome";
import { homesState } from "./state";
import { Veil } from "./Veil";

/** Debug: `?homes=off` leaves the featured homes out (isolating issues). */
const disabled = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("homes") === "off";

const cardHome = (t: EventTarget | null): HomeId | null => {
  const el = (t as Element | null)?.closest?.(".vl-card[data-home]") as HTMLElement | null;
  const h = el?.dataset.home;
  return h === "v3" || h === "v4" ? h : null;
};

export function Homes() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    // Dev aid (scripts / console): the scene graph, for isolating render issues.
    (window as unknown as { __VL_SCENE?: unknown }).__VL_SCENE = scene;
  }, [scene]);
  useEffect(() => {
    const over = (e: Event) => {
      homesState.cardHover = cardHome(e.target);
    };
    const out = (e: Event) => {
      const next = cardHome((e as PointerEvent | FocusEvent).relatedTarget);
      homesState.cardHover = next;
    };
    document.addEventListener("pointerover", over, { passive: true });
    document.addEventListener("pointerout", out, { passive: true });
    document.addEventListener("focusin", over);
    document.addEventListener("focusout", out);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", over);
      document.removeEventListener("focusout", out);
      homesState.cardHover = null;
      homesState.hover = null;
    };
  }, []);

  if (disabled()) return null;
  return (
    <group name="homes">
      <FeaturedHome id="v3" />
      <FeaturedHome id="v4" />
      <Veil />
    </group>
  );
}
