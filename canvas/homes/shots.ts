import type { CameraKey, CameraShot } from "@/lib/camera";
import type { HomeId } from "@/lib/store";

/**
 * Camera keys for "Two ways to live" (t ∈ [5, 6)) while scrolling, and the
 * close-up shots used in explore mode. Owned by the homes module.
 *
 * Journey: a long lens from the south-south-west at golden hour, the two
 * featured homes in the middle band of the frame (clear of the header) (the title sits bottom-left,
 * the cards bottom-right): the townhouse behind on the left, the villa in
 * front on the right, the low sun raking in from the west across their faces
 * and throwing the shadows east. A slow lateral drift across the chapter.
 */
export const HOMES_KEYS: CameraKey[] = [
  { t: 5.08, pos: [-19.5, 45, 101], target: [-4.5, 8.5, 24], fov: 26 },
  { t: 5.9, pos: [-10.2, 41.7, 101.5], target: [-3.5, 8.5, 24.5], fov: 26 },
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
  v4: { pos: [-5.75, 41.1, 76.8], target: [11.5, 12, 29.8], fov: 30 },
};
const PORTRAIT: Record<HomeId, CameraShot> = {
  v3: { pos: [-14.23, 26.72, 33.58], target: [-18.4, 5, 9.4], fov: 30 },
  v4: { pos: [-5.47, 25.86, 56.65], target: [3.2, 3.6, 33.0], fov: 30 },
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
