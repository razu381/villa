import { FEATURED, type HouseSpec } from "./village";

/**
 * Clearing the plot. While a featured home is open (explore), what stands
 * within PLOT_CLEAR metres of its footprint sinks away — houses back into
 * their plans, trees and planting to their bases: the build played backwards —
 * so the home can be turned all round and nothing shows through it.
 *
 * Membership is decided once, here, and baked per vertex / instance as
 * aIso = (cleared for v3, cleared for v4). The shaders scale the rise / growth
 * by 1 − dot(aIso, (uIsoV3, uIsoV4)) (lib/uniforms.ts, written by canvas/Driver.tsx).
 * Terrain, walls, paths and pools stay.
 */
export const PLOT_CLEAR = 15;

const HOMES = [FEATURED.v3, FEATURED.v4];

type Foot = Pick<HouseSpec, "x" | "z" | "rotY" | "width" | "depth" | "upperShift">;

/** Distance (m) from a point to a footprint rectangle (0 inside). */
function footprintDistance(h: Foot, x: number, z: number) {
  // World → the house's frame (three's rotation.y: x' = x cos + z sin, z' = −x sin + z cos).
  const c = Math.cos(h.rotY);
  const s = Math.sin(h.rotY);
  const dx = x - h.x;
  const dz = z - h.z;
  const lx = c * dx - s * dz;
  const lz = s * dx + c * dz;
  const ex = Math.max(Math.abs(lx) - h.width / 2, 0);
  const ez = Math.max(Math.abs(lz) - (h.depth / 2 + Math.abs(h.upperShift)), 0);
  return Math.hypot(ex, ez);
}

/** The footprint's corners in world space. */
function corners(h: Foot): [number, number][] {
  const c = Math.cos(h.rotY);
  const s = Math.sin(h.rotY);
  const hw = h.width / 2;
  const hd = h.depth / 2 + Math.abs(h.upperShift);
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([lx, lz]) => [h.x + c * lx + s * lz, h.z - s * lx + c * lz]);
}

/** aIso for something round at (x, z) with radius r (a tree's crown, a shrub). */
export function plotClear(x: number, z: number, r = 0): [number, number] {
  return [0, 1].map((i) => (footprintDistance(HOMES[i], x, z) - r < PLOT_CLEAR ? 1 : 0)) as [number, number];
}

/**
 * aIso for a whole house: cleared when any part of its footprint is within
 * PLOT_CLEAR of the home's (two convex footprints are closest at a corner of one).
 * A featured home never clears itself.
 */
export function plotClearHouse(h: HouseSpec): [number, number] {
  return [0, 1].map((i) => {
    const f = HOMES[i];
    if (h.id === f.id) return 0;
    let d = Infinity;
    for (const [x, z] of corners(h)) d = Math.min(d, footprintDistance(f, x, z));
    for (const [x, z] of corners(f)) d = Math.min(d, footprintDistance(h, x, z));
    return d < PLOT_CLEAR ? 1 : 0;
  }) as [number, number];
}

/** GLSL: the sink factor (1 = standing, 0 = cleared away). Needs `attribute vec2 aIso`. */
export const PLOT_GLSL = /* glsl */ `
uniform float uIsoV3;
uniform float uIsoV4;
float vl_plotKeep(vec2 iso) { return 1.0 - clamp(dot(iso, vec2(uIsoV3, uIsoV4)), 0.0, 1.0); }
`;
