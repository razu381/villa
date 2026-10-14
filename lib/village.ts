/**
 * The village — an artistic interpretation, composed for beauty (not to scale).
 *
 * Units are metres. +X east, -Z north, +Z south (towards the river view and
 * the street). The village sits on a raised limestone podium — the
 * "contemporary stronghold" — stepping down in four terraces towards the south.
 * Cars live underneath: a tunnel from the street leads into a garage below
 * terraces B and C.
 *
 * This file is the shared layout contract. Every 3D module reads positions and
 * heights from here so terrain, houses, trees, section cut and cars agree.
 */

import { fbm, mulberry32 } from "./noise";
import { clamp01 } from "./timeline";

/* -------------------------------------------------------------- the plinth */

/** The architectural-model base: a block of terrain with vertical sides. */
export const PLINTH = { minX: -110, maxX: 110, minZ: -80, maxZ: 80, bottom: -14 } as const;
/** The table the model stands on (infinite plane, fades into fog). */
export const TABLE_Y = -14.05;

/* ------------------------------------------------------------ the podium */

/** Raised village podium (rounded rectangle). */
export const PODIUM = { minX: -74, maxX: 60, minZ: -46, maxZ: 42, radius: 9 } as const;

/** Terrace levels, north (A) to south (D). Steps sit at `stepZ` between rows. */
export const TERRACES = [
  { id: "A", y: 7.8 },
  { id: "B", y: 6.4 },
  { id: "C", y: 5.0 },
  { id: "D", y: 3.6 },
] as const;
const STEP_Z = [-26.2, -6.7, 13.6]; // A|B, B|C, C|D

/** The street along the south edge (outside the podium). */
export const STREET = { z: 56, halfWidth: 4.5, y: -2.2, minX: PLINTH.minX, maxX: PLINTH.maxX } as const;

/* ------------------------------------------------------------- the garage */

/** Underground garage below terraces B and C. */
export const GARAGE = { minX: -64, maxX: 36, minZ: -22, maxZ: 14, floor: -2.0, ceiling: 1.5 } as const;
/** Tunnel from the podium's south wall to the garage. */
export const TUNNEL = { minX: -63, maxX: -55, minZ: 14, maxZ: 42, floor: -2.1, ceiling: 1.4 } as const;
/** Car route: street → portal → tunnel → garage aisle. (x, z) pairs; y = floor. */
export const CAR_ROUTE: [number, number][] = [
  [-108, 57.5],
  [-70, 57.5],
  [-61, 54],
  [-59, 46],
  [-59, 30],
  [-59, 10],
  [-54, -2],
  [-40, -4],
  [0, -4],
  [30, -4],
];
/** Parking bays along the garage aisle (centre x, z, rotation). */
export const PARKING_BAYS: { x: number; z: number; rotY: number }[] = (() => {
  const bays: { x: number; z: number; rotY: number }[] = [];
  for (let x = -46; x <= 30; x += 3.0) {
    bays.push({ x, z: -10.5, rotY: 0 });
    bays.push({ x, z: 2.5, rotY: Math.PI });
  }
  return bays;
})();

/* ---------------------------------------------------------- section cut */

/** The section plane is z = SECTION_Z; everything south of it (z > SECTION_Z) is cut away. */
export const SECTION_Z = 6.0;

/* -------------------------------------------------------- material sweep */

/** The material sweep travels east → west, like sunlight. */
export const SWEEP_FROM: [number, number, number] = [112, 0, 0];
export const SWEEP_TO: [number, number, number] = [-112, 0, 0];

/* ---------------------------------------------------------------- terrain */

const smoothstep = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/** Natural hillside, before the podium is built. */
export function naturalHeight(x: number, z: number) {
  const slope = 1.0 - 0.055 * z;
  const rolling = 1.6 * fbm(x / 70 + 3.1, z / 70 - 1.7, 4);
  const northHill = 4.5 * smoothstep(-38, -80, z) * (0.65 + 0.35 * fbm(x / 40, z / 40, 3));
  const eastHill = 2.2 * smoothstep(55, 110, x) * (0.6 + 0.4 * fbm(x / 35 + 7, z / 35, 3));
  return slope + rolling + northHill + eastHill;
}

/** Signed distance to the podium's rounded rectangle (negative inside). */
export function podiumDistance(x: number, z: number) {
  const cx = (PODIUM.minX + PODIUM.maxX) / 2;
  const cz = (PODIUM.minZ + PODIUM.maxZ) / 2;
  const hx = (PODIUM.maxX - PODIUM.minX) / 2 - PODIUM.radius;
  const hz = (PODIUM.maxZ - PODIUM.minZ) / 2 - PODIUM.radius;
  const qx = Math.abs(x - cx) - hx;
  const qz = Math.abs(z - cz) - hz;
  const ox = Math.max(qx, 0);
  const oz = Math.max(qz, 0);
  return Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0) - PODIUM.radius;
}

/** Podium terrace height at z (A → D, smooth 1.2 m steps). */
export function terraceHeight(z: number) {
  let y: number = TERRACES[0].y;
  for (let i = 0; i < STEP_Z.length; i++) {
    y += (TERRACES[i + 1].y - TERRACES[i].y) * smoothstep(STEP_Z[i] - 0.6, STEP_Z[i] + 0.6, z);
  }
  return y;
}

/** 1 inside the podium, 0 outside (a steep ~1.6 m bastion edge). */
export function podiumMask(x: number, z: number) {
  return 1 - smoothstep(-0.3, 1.3, podiumDistance(x, z));
}

/** Final ground height — use this everywhere. */
export function heightAt(x: number, z: number) {
  let h = naturalHeight(x, z);
  // Street: a flat band along the south.
  const street = 1 - smoothstep(STREET.halfWidth, STREET.halfWidth + 5, Math.abs(z - STREET.z));
  h += (STREET.y - h) * street;
  // Driveway from the street up to the garage portal (flat, at street level).
  const drive = (1 - smoothstep(4, 7, Math.abs(x - -59))) * smoothstep(PODIUM.maxZ - 2, PODIUM.maxZ + 2, z) * (1 - smoothstep(STREET.z, STREET.z + 4, z));
  h += (STREET.y - h) * drive;
  // The podium.
  const m = podiumMask(x, z);
  h += (terraceHeight(z) - h) * m;
  return h;
}

/* ----------------------------------------------------------------- houses */

export type HouseType = "v3" | "v4";

export interface HouseSpec {
  id: string;
  type: HouseType;
  /** Footprint centre. Facades face south (+Z) unless rotY says otherwise. */
  x: number;
  z: number;
  /** Ground level (the terrace pad). */
  y: number;
  rotY: number;
  width: number;
  depth: number;
  /** Floor-to-floor heights, ground first. */
  floors: number[];
  /** Upper-floor volume shift along z (stacked-box offset), metres. */
  upperShift: number;
  row: "A" | "B" | "C" | "D";
  block: number;
  /** 0 → 1: when this house rises in the build sequence (outward from the heart). */
  delay: number;
  /** 0 → 1: stagger for windows switching on at night. */
  lightDelay: number;
  /** Seed for per-house variation. */
  seed: number;
  /** Featured homes are rendered by canvas/homes (exploded view), not canvas/world/Houses. */
  featured: boolean;
}

export const TOWNHOUSE = { width: 7.2, depth: 11, floors: [3.2, 3.0] } as const;
export const VILLA = { width: 15, depth: 12, floors: [3.4, 3.2] } as const;

const ROW_LAYOUT: { row: "A" | "B" | "C"; z: number; blocks: { x: number; units: number }[] }[] = [
  { row: "A", z: -34, blocks: [{ x: -58, units: 3 }, { x: -28, units: 3 }, { x: 6, units: 3 }] },
  { row: "B", z: -14, blocks: [{ x: -50, units: 3 }, { x: -18, units: 2 }, { x: 8, units: 3 }] },
  { row: "C", z: 5, blocks: [{ x: -56, units: 2 }, { x: -30, units: 3 }] },
];

/** Featured townhouse: row C, block 2, middle unit. Featured villa: the east villa. */
const FEATURED_V3 = "C-1-1";
const FEATURED_V4 = "D-1";

export const HOUSES: HouseSpec[] = (() => {
  const rand = mulberry32(20261014);
  const out: HouseSpec[] = [];
  const heart = { x: -10, z: -6 };
  const maxR = 75;
  for (const r of ROW_LAYOUT) {
    const y = TERRACES.find((t) => t.id === r.row)!.y;
    r.blocks.forEach((b, bi) => {
      for (let u = 0; u < b.units; u++) {
        const x = b.x + TOWNHOUSE.width * (u + 0.5);
        const id = `${r.row}-${bi}-${u}`;
        const dist = Math.hypot(x - heart.x, r.z - heart.z) / maxR;
        out.push({
          id,
          type: "v3",
          x,
          z: r.z,
          y,
          rotY: 0,
          width: TOWNHOUSE.width,
          depth: TOWNHOUSE.depth,
          floors: [...TOWNHOUSE.floors],
          upperShift: (u + bi) % 2 === 0 ? 1.4 : -1.2,
          row: r.row,
          block: bi,
          delay: clamp01(dist * 0.85 + rand() * 0.15),
          lightDelay: rand(),
          seed: Math.floor(rand() * 1e6),
          featured: id === FEATURED_V3,
        });
      }
    });
  }
  const villaY = TERRACES[3].y;
  [
    { x: -28, z: 27 },
    { x: 6, z: 27 },
  ].forEach((v, i) => {
    const id = `D-${i}`;
    const dist = Math.hypot(v.x - heart.x, v.z - heart.z) / maxR;
    out.push({
      id,
      type: "v4",
      x: v.x,
      z: v.z,
      y: villaY,
      rotY: 0,
      width: VILLA.width,
      depth: VILLA.depth,
      floors: [...VILLA.floors],
      upperShift: i === 0 ? -1.5 : 1.8,
      row: "D",
      block: i,
      delay: clamp01(dist * 0.85 + rand() * 0.15),
      lightDelay: rand(),
      seed: Math.floor(rand() * 1e6),
      featured: id === FEATURED_V4,
    });
  });
  return out;
})();

export const FEATURED = {
  v3: HOUSES.find((h) => h.id === FEATURED_V3)!,
  v4: HOUSES.find((h) => h.id === FEATURED_V4)!,
};

/** Each villa has a private pool in its south garden (centre, size). */
export const VILLA_POOLS = HOUSES.filter((h) => h.type === "v4").map((h) => ({
  houseId: h.id,
  x: h.x + 1.5,
  z: h.z + h.depth / 2 + 4.2,
  y: h.y,
  width: 9,
  depth: 3.6,
}));

/* ----------------------------------------------------------- shared spaces */

/** The village heart: pavilion (fitness + cowork) and the long communal pool. */
export const VILLAGE_HEART = {
  pavilion: { x: 15, z: 4, y: TERRACES[2].y, width: 14, depth: 8, height: 3.4 },
  pool: { x: 37, z: 5, y: TERRACES[2].y, width: 24, depth: 4.2 },
};

/** Botanical playground garden (row D, west). */
export const PLAYGROUND = { minX: -68, maxX: -44, minZ: 19, maxZ: 38, y: TERRACES[3].y };

/** Pedestrian lanes (polylines, x/z) — car-free streets. */
export const PATHS: [number, number][][] = [
  // East–west lanes in front of rows A, B, C.
  [[-70, -24.2], [56, -24.2]],
  [[-70, -4.6], [56, -4.6]],
  [[-70, 15.8], [56, 15.8]],
  // North–south links (meandering between blocks).
  [[-32.2, -42], [-32.2, -24.2], [-23.2, -24.2], [-23.2, -4.6], [-12, -4.6], [-12, 15.8], [-12, 40]],
  [[-0.2, -42], [-0.2, -24.2], [2.2, -24.2], [2.2, -4.6]],
  [[33, -24.2], [33, 15.8], [33, 40]],
];
export const PATH_WIDTH = 3.2;

/* ------------------------------------------------------------------ trees */

export type TreeKind = "round" | "tall" | "olive";
export interface TreeSpec {
  x: number;
  z: number;
  y: number;
  /** Overall height, metres. */
  height: number;
  kind: TreeKind;
  /** 0 → 1 appearance stagger. */
  delay: number;
  seed: number;
}

function insideAnyHouse(x: number, z: number, margin: number) {
  return HOUSES.some((h) => Math.abs(x - h.x) < h.width / 2 + margin && Math.abs(z - h.z) < h.depth / 2 + margin);
}

export const TREES: TreeSpec[] = (() => {
  const rand = mulberry32(7);
  const out: TreeSpec[] = [];
  // Woodland outside the podium — denser to the north and east, like the aerial.
  let tries = 0;
  while (out.length < 420 && tries < 20000) {
    tries++;
    const x = PLINTH.minX + 4 + rand() * (PLINTH.maxX - PLINTH.minX - 8);
    const z = PLINTH.minZ + 4 + rand() * (PLINTH.maxZ - PLINTH.minZ - 8);
    if (podiumDistance(x, z) < 5) continue;
    if (Math.abs(z - STREET.z) < STREET.halfWidth + 3) continue;
    if (Math.abs(x - -59) < 8 && z > PODIUM.maxZ - 2 && z < STREET.z) continue; // driveway
    const density = 0.25 + 0.75 * Math.max(smoothstep(-30, -75, z), smoothstep(50, 100, x), 0.35 * (fbm(x / 30, z / 30, 3) * 0.5 + 0.5));
    if (rand() > density) continue;
    const kind: TreeKind = rand() < 0.22 ? "tall" : rand() < 0.3 ? "olive" : "round";
    out.push({ x, z, y: heightAt(x, z), height: kind === "tall" ? 9 + rand() * 6 : 4.5 + rand() * 4, kind, delay: rand(), seed: Math.floor(rand() * 1e6) });
  }
  // Garden trees inside the village.
  tries = 0;
  let inside = 0;
  while (inside < 46 && tries < 8000) {
    tries++;
    const x = PODIUM.minX + 4 + rand() * (PODIUM.maxX - PODIUM.minX - 8);
    const z = PODIUM.minZ + 4 + rand() * (PODIUM.maxZ - PODIUM.minZ - 8);
    if (podiumDistance(x, z) > -3) continue;
    if (insideAnyHouse(x, z, 2.5)) continue;
    if (PATHS.some((p) => nearPolyline(p, x, z, PATH_WIDTH / 2 + 1.2))) continue;
    const hp = VILLAGE_HEART.pool;
    if (Math.abs(x - hp.x) < hp.width / 2 + 2 && Math.abs(z - hp.z) < hp.depth / 2 + 2) continue;
    const pv = VILLAGE_HEART.pavilion;
    if (Math.abs(x - pv.x) < pv.width / 2 + 2 && Math.abs(z - pv.z) < pv.depth / 2 + 2) continue;
    if (VILLA_POOLS.some((p) => Math.abs(x - p.x) < p.width / 2 + 1.5 && Math.abs(z - p.z) < p.depth / 2 + 1.5)) continue;
    const kind: TreeKind = rand() < 0.45 ? "olive" : "round";
    out.push({ x, z, y: heightAt(x, z), height: 3.5 + rand() * 3, kind, delay: rand(), seed: Math.floor(rand() * 1e6) });
    inside++;
  }
  return out;
})();

export function nearPolyline(poly: [number, number][], x: number, z: number, r: number) {
  for (let i = 0; i < poly.length - 1; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const k = clamp01(((x - ax) * dx + (z - az) * dz) / len2);
    if (Math.hypot(x - (ax + dx * k), z - (az + dz * k)) < r) return true;
  }
  return false;
}
