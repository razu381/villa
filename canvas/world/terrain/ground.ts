/**
 * The rendered ground — `heightAt` from lib/village.ts, with the built edges
 * sharpened so real retaining walls can hide them:
 *   - the podium edge drops inside the bastion wall band (not over 1.6 m)
 *   - the terrace steps drop inside the terrace walls (not over 1.2 m)
 *   - the driveway runs level through the garage portal into a recess
 * Everywhere else it is identical to heightAt. Trees, planting and lights in
 * the landscape module sit on this surface.
 */
import { clamp01 } from "@/lib/timeline";
import { PODIUM, STREET, TERRACES, TUNNEL, naturalHeight, podiumDistance, terraceHeight } from "@/lib/village";

export const smoothstep = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/** Terrace steps (z of the drop, upper and lower level), derived from terraceHeight. */
export const STEPS: { z: number; upper: number; lower: number }[] = (() => {
  const out: { z: number; upper: number; lower: number }[] = [];
  for (let i = 0; i < TERRACES.length - 1; i++) {
    const mid = (TERRACES[i].y + TERRACES[i + 1].y) / 2;
    let a = PODIUM.minZ - 30;
    let b = PODIUM.maxZ + 30;
    for (let k = 0; k < 60; k++) {
      const m = (a + b) / 2;
      if (terraceHeight(m) > mid) a = m;
      else b = m;
    }
    out.push({ z: Math.round(((a + b) / 2) * 1000) / 1000, upper: TERRACES[i].y, lower: TERRACES[i + 1].y });
  }
  return out;
})();

/** The bastion: a limestone retaining wall around the podium (podium-distance units). */
export const BASTION = { inner: -0.2, outer: 0.9, parapet: 0.55, coping: 0.12, overhang: 0.07 } as const;
/**
 * Ground transition band (podium distance) — a narrow drop in the middle of the
 * 1.1 m bastion, so no terrain triangle (fine cell diagonal ≈ 0.42 m) can reach
 * past either face of the wall, even on the rounded corners.
 */
export const EDGE: [number, number] = [0.25, 0.4];
/** Terrace retaining walls between rows. */
export const TERRACE_WALL = { half: 0.3, parapet: 0.45 } as const;
export const STEP_BAND = 0.1;

/** Garage portal in the south bastion: opening, recess depth (into the podium). */
export const PORTAL = {
  minX: TUNNEL.minX,
  maxX: TUNNEL.maxX,
  cx: (TUNNEL.minX + TUNNEL.maxX) / 2,
  floor: STREET.y,
  top: TUNNEL.ceiling,
  /** Back face of the recess, in podium distance (negative = inside). */
  back: -3.2,
} as const;

/** Pedestrian entrance stair from the street up into the village (south bastion). */
export const ENTRANCE = { x: -12, width: 3.2, cheek: 0.32 } as const;

export const inPortalX = (x: number) => x > PORTAL.minX && x < PORTAL.maxX;

/** Sharp terrace height: the 1.4 m steps happen within ±STEP_BAND. */
export function terraceSharp(z: number) {
  let y: number = TERRACES[0].y;
  for (const s of STEPS) y += (s.lower - s.upper) * smoothstep(s.z - STEP_BAND, s.z + STEP_BAND, z);
  return y;
}

/**
 * The site before anything is built: the natural hill with the existing public
 * street. The plinth's top morphs from this to groundHeight as the podium rises
 * (see build.ts), so the drawing chapter opens on a blank, contoured hill.
 */
export function existingHeight(x: number, z: number) {
  const h = naturalHeight(x, z);
  const street = 1 - smoothstep(STREET.halfWidth, STREET.halfWidth + 5, Math.abs(z - STREET.z));
  return h + (STREET.y - h) * street;
}

/** Ground outside the podium: natural hill, flattened street and driveway (mirrors heightAt). */
export function baseHeight(x: number, z: number) {
  let h = naturalHeight(x, z);
  const street = 1 - smoothstep(STREET.halfWidth, STREET.halfWidth + 5, Math.abs(z - STREET.z));
  h += (STREET.y - h) * street;
  const drive =
    (1 - smoothstep(4, 7, Math.abs(x - PORTAL.cx))) *
    smoothstep(PODIUM.maxZ - 2, PODIUM.maxZ + 2, z) *
    (1 - smoothstep(STREET.z, STREET.z + 4, z));
  h += (STREET.y - h) * drive;
  // The rendered driveway is dead level from the street into the portal recess.
  // (The hard z-cut at the north end sits under the podium, where it never shows.)
  if (z > PODIUM.maxZ + PORTAL.back - 0.6 && z < STREET.z) {
    const level = 1 - smoothstep(4, 7, Math.abs(x - PORTAL.cx));
    h += (STREET.y - h) * level;
  }
  return h;
}

/** 1 on the podium, 0 outside — the drop sits inside the wall band. */
export function podiumWeight(x: number, z: number) {
  const d = podiumDistance(x, z);
  if (inPortalX(x) && z > PODIUM.maxZ - 8) return 1 - smoothstep(PORTAL.back - 0.45, PORTAL.back - 0.1, d);
  return 1 - smoothstep(EDGE[0], EDGE[1], d);
}

/** The rendered ground height. */
export function groundHeight(x: number, z: number) {
  const b = baseHeight(x, z);
  const m = podiumWeight(x, z);
  return b + (terraceSharp(z) - b) * m;
}

/**
 * The village heart — the origin of every outward reveal (contours, plan
 * lines). Mirrors the delay origin used for HOUSES in lib/village.ts.
 */
export const HEART = { x: -10, z: -6 } as const;

/** Rounded-rectangle perimeter of the podium offset by `d` (podium-distance units). */
export const PODIUM_FRAME = {
  cx: (PODIUM.minX + PODIUM.maxX) / 2,
  cz: (PODIUM.minZ + PODIUM.maxZ) / 2,
  hx: (PODIUM.maxX - PODIUM.minX) / 2,
  hz: (PODIUM.maxZ - PODIUM.minZ) / 2,
  r: PODIUM.radius,
} as const;
