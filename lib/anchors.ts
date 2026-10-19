/**
 * Screen positions (CSS px from the canvas's top-left) of what the HTML layer
 * points at in the 3D, rewritten every frame by the 3D: the section chapter's
 * legend subjects (canvas/section/anchors.ts → the leader lines in
 * components/chapters/CarsChapter.tsx) and the open place's photo spots
 * (canvas/homes/Spots.tsx → the pins in components/homes/Spots.tsx).
 * Plain objects with no three.js import, so the HTML layer can read them
 * without pulling the 3D into its bundle.
 */
import { SPOTS } from "./places";

export interface SectionAnchor {
  /** CSS px from the canvas's left edge. */
  x: number;
  /** CSS px from the canvas's top edge. */
  y: number;
  visible: boolean;
}

export const SECTION_ANCHORS: { parking: SectionAnchor; streets: SectionAnchor; playground: SectionAnchor } = {
  parking: { x: 0, y: 0, visible: false },
  streets: { x: 0, y: 0, visible: false },
  playground: { x: 0, y: 0, visible: false },
};

/** Where a photo spot (lib/places.ts) is this frame: on screen, and in the world (the camera's glide aims at it). */
export interface SpotAnchor extends SectionAnchor {
  wx: number;
  wy: number;
  wz: number;
}

/**
 * The photo pins of the open place, by spot key, rewritten every frame by
 * canvas/homes/Spots.tsx and read by components/homes/Spots.tsx. `visible`:
 * in front of the camera, on screen, its floor open (rooms) and not behind
 * the house (outside points).
 */
export const SPOT_ANCHORS: Record<string, SpotAnchor> = Object.fromEntries(
  SPOTS.map((s) => [s.key, { x: 0, y: 0, visible: false, wx: 0, wy: 0, wz: 0 }]),
);

/** The explore camera this frame: `still` once it has arrived and stopped (no ease, turn or glide). */
export const SPOT_VIEW = { still: false };
