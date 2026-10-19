"use client";

import { useEffect, useState } from "react";
import { PLACE_PHOTOS, SPOTS, spotIndex } from "@/lib/places";
import { useJourney } from "@/lib/store";
import { UI } from "@/lib/ui-copy";
import { Lightbox } from "../ui/Lightbox";
import { closePhotos, openPhotos } from "./explore";

/**
 * The open place's photos, full screen over the 3D (store.viewer, lib/places.ts):
 * the first rises through the brand arch. Closing hands back to the 3D at once
 * (it starts rendering again under the fade).
 *
 * Debug: `?photo=<spot>` (lib/places.ts keys, e.g. v4-pool) opens that spot's
 * photos once the 3D is ready (it rests while they cover it).
 */
export function PlaceViewer() {
  const want = useJourney((s) => s.viewer);
  useEffect(() => {
    const spot = SPOTS.find((x) => x.key === new URLSearchParams(window.location.search).get("photo"));
    if (!spot) return;
    const show = () => openPhotos(spot.place, spotIndex(spot));
    if (useJourney.getState().ready) return void show();
    const off = useJourney.subscribe((s, p) => {
      if (s.ready && !p.ready) {
        off();
        show();
      }
    });
    return off;
  }, []);
  // Keep the viewer on screen through its fade out (n: each opening is a new viewer,
  // even one that reopens the same photo while the last still fades).
  const [shown, setShown] = useState<(NonNullable<typeof want> & { n: number }) | null>(null);
  useEffect(() => {
    if (want) setShown((s) => ({ ...want, n: (s?.n ?? 0) + 1 }));
  }, [want]);
  if (!shown) return null;
  const n = shown.n;
  return (
    <Lightbox
      key={shown.n}
      items={PLACE_PHOTOS[shown.place]}
      start={shown.index}
      labels={UI.viewer}
      note={UI.viewer.note}
      arch
      onClosing={closePhotos}
      onClose={() => setShown((s) => (s?.n === n ? null : s))}
    />
  );
}
