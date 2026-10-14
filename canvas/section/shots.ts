import type { CameraKey } from "@/lib/camera";

/**
 * Camera keys for the "Cars below. Life above." chapter (t ∈ [4, 5)).
 * Owned by the section module. Merged into the journey camera path by lib/camera.ts.
 */
export const SECTION_KEYS: CameraKey[] = [
  { t: 4.05, pos: [70, 40, 140], target: [-10, 2, 0], fov: 30 },
  { t: 4.4, pos: [-6, 10, 118], target: [-12, 0.5, 0], fov: 30 },
  { t: 4.75, pos: [-28, 8, 96], target: [-22, 0, -2], fov: 30 },
];
