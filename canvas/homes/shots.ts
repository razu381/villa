import type { CameraKey, CameraShot } from "@/lib/camera";
import type { HomeId } from "@/lib/store";

/**
 * Camera keys for "Two ways to live" (t ∈ [5, 6)) while scrolling, and the
 * close-up shots used in explore mode. Owned by the homes module.
 */
export const HOMES_KEYS: CameraKey[] = [
  { t: 5.1, pos: [90, 55, 120], target: [-8, 5, 14], fov: 30 },
  { t: 5.85, pos: [60, 38, 105], target: [-6, 6, 16], fov: 30 },
];

/** Explore-mode close-ups per home (exploded view framing). */
export const HOME_SHOTS: Record<HomeId, CameraShot> = {
  v3: { pos: [10, 28, 48], target: [-19, 11, 5], fov: 32 },
  v4: { pos: [36, 26, 66], target: [6, 9, 27], fov: 32 },
};
