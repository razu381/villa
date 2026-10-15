import type { CameraKey } from "@/lib/camera";

/**
 * Camera keys for the "Cars below. Life above." chapter (t ∈ [4, 5)).
 * Owned by the section module. Merged into the journey camera path by lib/camera.ts.
 *
 *   (a) 4.00 → 4.18  the south bastion: cars turn off the street into the portal
 *   (b) 4.42 → 4.64  the iconic frame — a long-lens elevation of the cut face:
 *                    strata, the lit hall with its cars, the gardens and houses, sky
 *   (c) 4.80 → 4.95  a slow rise to the car-free gardens, paths and people
 *
 * Neighbours: 3.9 [-40,48,120]→[-16,4,-4] (making) · 5.1 [90,55,120]→[-8,5,14] (homes).
 */
export const SECTION_KEYS: CameraKey[] = [
  { t: 4.02, pos: [-60, 46, 122], target: [-65, -2, 54], fov: 24 },
  { t: 4.2, pos: [-58, 40, 114], target: [-63, -2, 51], fov: 24 },
  { t: 4.44, pos: [-18, 6.5, 138], target: [-18, -1.2, 0], fov: 18 },
  { t: 4.64, pos: [-17, 7.5, 128], target: [-18, -1.0, 0], fov: 18 },
  { t: 4.86, pos: [-31, 62, 88], target: [-30, 2, 6], fov: 28 },
  { t: 4.97, pos: [-12, 63, 100], target: [-22, 3, 8], fov: 29 },
];
