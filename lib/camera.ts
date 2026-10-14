import { SECTION_KEYS } from "@/canvas/section/shots";
import { HOMES_KEYS } from "@/canvas/homes/shots";

export type Vec3 = [number, number, number];

/** A camera position on the journey path at journey time `t`. */
export interface CameraKey {
  t: number;
  pos: Vec3;
  target: Vec3;
  fov: number;
}

export interface CameraShot {
  pos: Vec3;
  target: Vec3;
  fov: number;
}

/**
 * The journey camera path. Long lenses (fov 26–34), slow cranes, never a cut.
 * Chapter-owned keys are merged in from their modules (section, homes).
 * Keys must stay sorted by t.
 */
const BASE_KEYS: CameraKey[] = [
  // Hero → match cut with the film's aerial (high, ~45° oblique, village centred).
  { t: 0.6, pos: [70, 190, 180], target: [-6, 0, -2], fov: 30 },
  // The drawing — almost a plan view, the hill's contours readable.
  { t: 1.2, pos: [40, 210, 140], target: [-6, 0, -4], fov: 30 },
  { t: 1.95, pos: [-20, 170, 150], target: [-8, 2, -4], fov: 30 },
  // The model rises — a crane down and around.
  { t: 2.4, pos: [-120, 95, 150], target: [-6, 4, -4], fov: 30 },
  { t: 2.95, pos: [-150, 70, 60], target: [-6, 4, -6], fov: 30 },
  // The making — the sweep travels east → west; we follow it from the south.
  { t: 3.25, pos: [120, 60, 130], target: [10, 4, -4], fov: 30 },
  { t: 3.9, pos: [-40, 48, 120], target: [-16, 4, -4], fov: 30 },
  ...SECTION_KEYS,
  ...HOMES_KEYS,
  // Night — pull back to see the whole village switch on.
  { t: 6.1, pos: [110, 70, 150], target: [-6, 2, -2], fov: 30 },
  { t: 6.8, pos: [150, 95, 210], target: [-6, 0, -4], fov: 30 },
];

export const CAMERA_KEYS: CameraKey[] = [...BASE_KEYS].sort((a, b) => a.t - b.t);

/** Catmull-Rom (non-uniform t) interpolation of the camera path at journey time t. */
export function sampleCamera(t: number, out: { pos: number[]; target: number[]; fov: number }) {
  const keys = CAMERA_KEYS;
  if (t <= keys[0].t) return copyKey(keys[0], out);
  if (t >= keys[keys.length - 1].t) return copyKey(keys[keys.length - 1], out);
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(keys.length - 1, i + 2)];
  const span = k2.t - k1.t;
  const u = (t - k1.t) / span;
  // Ease inside each segment so the camera settles near keys ("stop to read").
  const e = u * u * (3 - 2 * u);
  for (let a = 0; a < 3; a++) {
    out.pos[a] = hermite(k0.pos[a], k1.pos[a], k2.pos[a], k3.pos[a], k0.t, k1.t, k2.t, k3.t, e);
    out.target[a] = hermite(k0.target[a], k1.target[a], k2.target[a], k3.target[a], k0.t, k1.t, k2.t, k3.t, e);
  }
  out.fov = k1.fov + (k2.fov - k1.fov) * e;
  return out;
}

function copyKey(k: CameraKey, out: { pos: number[]; target: number[]; fov: number }) {
  for (let a = 0; a < 3; a++) {
    out.pos[a] = k.pos[a];
    out.target[a] = k.target[a];
  }
  out.fov = k.fov;
  return out;
}

/** Cubic Hermite with Catmull-Rom tangents scaled for non-uniform spacing. */
function hermite(p0: number, p1: number, p2: number, p3: number, t0: number, t1: number, t2: number, t3: number, u: number) {
  const span = t2 - t1;
  const m1 = t2 - t0 > 1e-6 ? ((p2 - p0) / (t2 - t0)) * span * 0.5 : 0;
  const m2 = t3 - t1 > 1e-6 ? ((p3 - p1) / (t3 - t1)) * span * 0.5 : 0;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
}
