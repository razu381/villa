import { SECTION_KEYS } from "@/canvas/section/shots";
import { HOMES_KEYS } from "@/canvas/homes/shots";

export type Vec3 = [number, number, number];

/** A camera position on the journey path at journey time `t`. */
export interface CameraKey {
  t: number;
  pos: Vec3;
  target: Vec3;
  fov: number;
  /**
   * Portrait phones only: [zoom, lift, slide?]. The rig keeps a key's width on
   * narrow screens (dollied back), which leaves a tall empty sky; `zoom` (< 1)
   * comes closer than that and `lift` shifts the lens so the subject sits higher
   * (ndc units: 0.4 puts the target ~30 % from the top), above the text.
   * `slide` shifts it sideways (ndc, + = target right) for keys whose
   * landscape target is off the subject to leave room for text or a form.
   * Omitted = [1, 0] (the section and homes keys carry their own portrait fit).
   */
  portrait?: [number, number, number?];
}

export interface CameraSample {
  pos: number[];
  target: number[];
  fov: number;
  zoom: number;
  lift: number;
  slide: number;
}

export interface CameraShot {
  pos: Vec3;
  target: Vec3;
  fov: number;
}

/** Portrait fits: the whole model, filling the width, above the text. */
const P_MODEL: [number, number] = [0.82, 0.38];
const P_DRAW: [number, number] = [0.84, 0.32];

/**
 * The journey camera path. Long lenses (fov 26–34), slow cranes, never a cut.
 * Chapter-owned keys are merged in from their modules (section, homes).
 * Keys must stay sorted by t.
 */
const BASE_KEYS: CameraKey[] = [
  // Hero → match cut with the film's aerial (high, ~45° oblique, village centred):
  // the whole model on its table, a blank hill waiting for its first line.
  { t: 0.6, pos: [99, 262, 250], target: [-6, 0, -2], fov: 30, portrait: [0.9, 0.28] },
  // The drawing — steeper, nearly a plan, the hill's contours readable; the
  // model sits up and right of the text. A slow push-in as the plan is drawn
  // and the podium rises, landing close enough to read the houses' lines.
  { t: 1.25, pos: [52, 300, 190], target: [-16, 0, 10], fov: 30, portrait: P_DRAW },
  { t: 1.7, pos: [16, 230, 200], target: [-26, 0, 14], fov: 30, portrait: P_DRAW },
  { t: 1.98, pos: [-20, 170, 150], target: [-8, 2, -4], fov: 30, portrait: P_DRAW },
  // The model rises — a crane down and around, south-west → south: the
  // stronghold's bastion faces us as the trees arrive.
  { t: 2.4, pos: [-110, 100, 160], target: [-10, 4, -6], fov: 30, portrait: P_MODEL },
  { t: 2.95, pos: [10, 78, 190], target: [-4, 2, -8], fov: 30, portrait: P_MODEL },
  // The making — the sweep travels east → west; we follow it from the south.
  { t: 3.25, pos: [120, 60, 130], target: [10, 4, -4], fov: 30, portrait: P_MODEL },
  { t: 3.9, pos: [-40, 48, 124], target: [-18, 2, 6], fov: 30, portrait: [0.78, 0.36] },
  ...SECTION_KEYS,
  ...HOMES_KEYS,
  // Night — pull back to see the whole village switch on; as the invitation
  // arrives (title top-left, the form on the right) the village settles low
  // and left, between them.
  { t: 6.1, pos: [110, 70, 150], target: [-6, 2, -2], fov: 30, portrait: [0.72, 0.4] },
  { t: 6.3, pos: [203, 110, 166], target: [16, 0, -88], fov: 30, portrait: [0.6, 0.38, 0.84] },
  { t: 6.8, pos: [208, 112, 164], target: [18, 0, -92], fov: 30, portrait: [0.58, 0.4, 0.84] },
];

export const CAMERA_KEYS: CameraKey[] = [...BASE_KEYS].sort((a, b) => a.t - b.t);

/** Catmull-Rom (non-uniform t) interpolation of the camera path at journey time t. */
export function sampleCamera(t: number, out: CameraSample) {
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
  const p1 = k1.portrait ?? NO_FIT;
  const p2 = k2.portrait ?? NO_FIT;
  out.zoom = p1[0] + (p2[0] - p1[0]) * e;
  out.lift = p1[1] + (p2[1] - p1[1]) * e;
  out.slide = (p1[2] ?? 0) + ((p2[2] ?? 0) - (p1[2] ?? 0)) * e;
  return out;
}

const NO_FIT: [number, number, number?] = [1, 0];

function copyKey(k: CameraKey, out: CameraSample) {
  for (let a = 0; a < 3; a++) {
    out.pos[a] = k.pos[a];
    out.target[a] = k.target[a];
  }
  out.fov = k.fov;
  out.zoom = (k.portrait ?? NO_FIT)[0];
  out.lift = (k.portrait ?? NO_FIT)[1];
  out.slide = (k.portrait ?? NO_FIT)[2] ?? 0;
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
