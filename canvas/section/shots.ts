import type { CameraKey } from "@/lib/camera";

/**
 * Camera keys for the "Cars below. Life above." chapter (t ∈ [4, 5)).
 * Owned by the section module. Merged into the journey camera path by lib/camera.ts.
 *
 *   (a) 4.00 → 4.18  the south bastion: cars turn off the street into the portal
 *   (b) 4.42 → 4.64  the iconic frame — a long-lens elevation of the cut face:
 *                    strata, the lit hall with its cars, the gardens and houses, sky
 *   (c) 4.66 → 4.82  a slow rise over the cut: the hall below, the car-free
 *                    gardens above, lanes lit, people walking — then on east
 *                    towards the homes as the cut closes
 *
 * Neighbours: 3.9 [-40,48,120]→[-16,4,-4] (making) · 5.1 [90,55,120]→[-8,5,14] (homes).
 */
const DESKTOP: CameraKey[] = [
  { t: 4.02, pos: [-60, 46, 122], target: [-65, -2, 54], fov: 24 },
  { t: 4.2, pos: [-58, 40, 114], target: [-63, -2, 51], fov: 24 },
  { t: 4.44, pos: [-18, 6.5, 138], target: [-18, -1.2, 0], fov: 18 },
  { t: 4.66, pos: [-17, 7.5, 128], target: [-18, -1.0, 0], fov: 18 },
  { t: 4.82, pos: [-12, 39, 92], target: [-14, -1.6, 0], fov: 24 },
  { t: 4.97, pos: [18, 54, 104], target: [-14, 3, 8], fov: 28 },
];

/**
 * Portrait screens. The rig keeps a key's horizontal extent on narrow screens
 * (wider lens, dollied back), which turns the long elevation into a thin strip
 * in a tall empty sky. Here the camera comes closer to the cut instead (a
 * narrower slice, twice the size) and the frame is lowered, so the section
 * sits in the upper half and the text below rests on the earth and the table.
 * Decided once at load (portrait phones rarely rotate mid-story).
 */
const PORTRAIT_FIT: Record<string, { k: number; dy: number }> = {
  "4.02": { k: 0.78, dy: 0 },
  "4.2": { k: 0.74, dy: 0 },
  "4.44": { k: 0.46, dy: -5.0 },
  "4.66": { k: 0.44, dy: -5.0 },
  "4.82": { k: 0.62, dy: -4.0 },
  "4.97": { k: 0.85, dy: 0 },
};

function fitPortrait(key: CameraKey): CameraKey {
  const fit = PORTRAIT_FIT[String(key.t)];
  if (!fit) return key;
  const [tx, ty, tz] = key.target;
  const pos: CameraKey["pos"] = [tx + (key.pos[0] - tx) * fit.k, ty + (key.pos[1] - ty) * fit.k + fit.dy, tz + (key.pos[2] - tz) * fit.k];
  return { ...key, pos, target: [tx, ty + fit.dy, tz] };
}

const PORTRAIT = typeof window !== "undefined" && window.innerWidth < window.innerHeight * 0.85;

export const SECTION_KEYS: CameraKey[] = PORTRAIT ? DESKTOP.map(fitPortrait) : DESKTOP;
