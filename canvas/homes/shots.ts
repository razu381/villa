import type { CameraKey, CameraShot } from "@/lib/camera";
import type { HomeId } from "@/lib/store";

/**
 * Camera keys for "Two ways to live" (t ∈ [5, 6)) while scrolling, and the
 * close-up shots used in explore mode. Owned by the homes module.
 *
 * Journey: a long lens from the south at golden hour, both featured homes in
 * the upper-middle of the frame (title bottom-left, cards bottom-right) on a
 * diagonal — the townhouse behind, the villa in front — the sun raking in
 * from the west; a slow lateral drift across the chapter.
 */
export const HOMES_KEYS: CameraKey[] = [
  { t: 5.08, pos: [9.4, 52, 106], target: [-2.6, 3, 26], fov: 26 },
  { t: 5.9, pos: [-3, 49, 107], target: [-5, 3, 25], fov: 26 },
];

/*
 * Explore: each exploded stack looked down on at ~30° so the open floors read
 * in plan, the low sun crossing the gaps from the left.
 *  - Landscape: the stack left of centre (the spec panel sits on the right).
 *  - Portrait (phones): centred, in the upper half above the bottom sheet.
 *    CameraRig dollies portrait screens back by √(1.6 / aspect) about the
 *    target; these shots are authored for that (≈ ×1.86 on a 390×844 phone).
 */
const LANDSCAPE: Record<HomeId, CameraShot> = {
  v3: { pos: [-6.3, 40.5, 50.1], target: [-14.3, 12.5, 4.14], fov: 30 },
  v4: { pos: [-4.45, 40.1, 76.8], target: [12.8, 11, 29.8], fov: 30 },
};
const PORTRAIT: Record<HomeId, CameraShot> = {
  v3: { pos: [-14.5, 25.3, 32.0], target: [-18.4, 5, 9.4], fov: 30 },
  v4: { pos: [-4.9, 24.4, 55.1], target: [3.2, 3.6, 33.0], fov: 30 },
};

const portrait = () => typeof window !== "undefined" && window.innerWidth / Math.max(1, window.innerHeight) < 0.9;

/** Explore-mode close-ups per home (exploded view framing), aspect-aware. */
export const HOME_SHOTS: Record<HomeId, CameraShot> = {
  get v3() {
    return portrait() ? PORTRAIT.v3 : LANDSCAPE.v3;
  },
  get v4() {
    return portrait() ? PORTRAIT.v4 : LANDSCAPE.v4;
  },
};
