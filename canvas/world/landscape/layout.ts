/**
 * Landscape layout derived from lib/village.ts: stair crossings, path-light
 * positions, planting. Deterministic (seeded) so every load composes the same.
 */
import { mulberry32, fbm } from "@/lib/noise";
import {
  HOUSES,
  PATHS,
  PATH_WIDTH,
  PLAYGROUND,
  PODIUM,
  TREES,
  VILLAGE_HEART,
  VILLA_POOLS,
  nearPolyline,
  podiumDistance,
  STREET,
} from "@/lib/village";
import { ENTRANCE, PORTAL, STEPS, groundHeight } from "../terrain/ground";

export interface Crossing {
  x: number;
  stepZ: number;
  upper: number;
  lower: number;
}

/** Where north–south paths cross a terrace step → a flight of stairs. */
export const CROSSINGS: Crossing[] = (() => {
  const out: Crossing[] = [];
  for (const p of PATHS) {
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i];
      const [bx, bz] = p[i + 1];
      if (Math.abs(ax - bx) > 1e-6) continue;
      const z0 = Math.min(az, bz);
      const z1 = Math.max(az, bz);
      for (const s of STEPS) if (s.z > z0 + 0.5 && s.z < z1 - 0.5) out.push({ x: ax, stepZ: s.z, upper: s.upper, lower: s.lower });
    }
  }
  return out;
})();

export const STAIR = { rise: 0.175, tread: 0.32, cheek: 0.3 } as const;

/** Pools: communal + villas, (cx, cz, hx, hz, deck y). */
export const POOLS = [
  { x: VILLAGE_HEART.pool.x, z: VILLAGE_HEART.pool.z, hx: VILLAGE_HEART.pool.width / 2, hz: VILLAGE_HEART.pool.depth / 2, y: VILLAGE_HEART.pool.y, depth: 1.5 },
  ...VILLA_POOLS.map((p) => ({ x: p.x, z: p.z, hx: p.width / 2, hz: p.depth / 2, y: p.y, depth: 1.35 })),
];

const inHouse = (x: number, z: number, m: number) =>
  HOUSES.some((h) => Math.abs(x - h.x) < h.width / 2 + m && Math.abs(z - h.z) < h.depth / 2 + m);
const inPool = (x: number, z: number, m: number) => POOLS.some((p) => Math.abs(x - p.x) < p.hx + m && Math.abs(z - p.z) < p.hz + m);
const pav = VILLAGE_HEART.pavilion;
const inPavilion = (x: number, z: number, m: number) => Math.abs(x - pav.x) < pav.width / 2 + m && Math.abs(z - pav.z) < pav.depth / 2 + m;
const nearStep = (z: number, m: number) => STEPS.some((s) => Math.abs(z - s.z) < m);
const nearStair = (x: number, z: number, m: number) =>
  CROSSINGS.some((c) => Math.abs(x - c.x) < PATH_WIDTH / 2 + STAIR.cheek + m && z > c.stepZ - 0.5 - m && z < c.stepZ + 3.0 + m);
const onPath = (x: number, z: number, r: number) => PATHS.some((p) => nearPolyline(p, x, z, r));
const inPlayground = (x: number, z: number, m: number) =>
  x > PLAYGROUND.minX - m && x < PLAYGROUND.maxX + m && z > PLAYGROUND.minZ - m && z < PLAYGROUND.maxZ + m;

/** Path lights: small bollards along the lanes, alternating sides. */
export const PATH_LIGHTS: { x: number; z: number; y: number; delay: number }[] = (() => {
  const out: { x: number; z: number; y: number; delay: number }[] = [];
  const rand = mulberry32(31);
  const spacing = 8.5;
  const off = PATH_WIDTH / 2 + 0.35;
  PATHS.forEach((p, pi) => {
    let acc = 0;
    let sideFlip = pi % 2;
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i];
      const [bx, bz] = p[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      for (let s = spacing / 2 - (acc % spacing); s < len; s += spacing) {
        if (s < 0) continue;
        const side = sideFlip++ % 2 === 0 ? 1 : -1;
        const x = ax + dx * s - dz * off * side;
        const z = az + dz * s + dx * off * side;
        if (podiumDistance(x, z) > -1.2) continue;
        if (inHouse(x, z, 0.4) || inPool(x, z, 0.6) || inPavilion(x, z, 0.5) || nearStep(z, 0.6) || nearStair(x, z, 0.4)) continue;
        if (onPath(x, z, PATH_WIDTH / 2 + 0.1)) continue;
        out.push({ x, z, y: groundHeight(x, z), delay: rand() });
      }
      acc += len;
    }
  });
  // Light the entrance stair foot and the portal.
  out.push({ x: ENTRANCE.x - ENTRANCE.width / 2 - 0.9, z: STREET.z - 4.0, y: STREET.y, delay: 0.1 });
  out.push({ x: ENTRANCE.x + ENTRANCE.width / 2 + 0.9, z: STREET.z - 4.0, y: STREET.y, delay: 0.15 });
  out.push({ x: PORTAL.minX - 1.4, z: STREET.z - 4.0, y: STREET.y, delay: 0.2 });
  out.push({ x: PORTAL.maxX + 1.4, z: STREET.z - 4.0, y: STREET.y, delay: 0.25 });
  return out;
})();

export interface Tuft {
  x: number;
  z: number;
  y: number;
  s: number;
  rot: number;
  delay: number;
  tone: number;
  /** Elongation along the local x axis (drifts). */
  len?: number;
}

/** Lavender and ornamental grass beds along the lanes and in the gardens. */
export const PLANTING: { lavender: Tuft[]; grass: Tuft[] } = (() => {
  const rand = mulberry32(77);
  const lavender: Tuft[] = [];
  const grass: Tuft[] = [];
  const ok = (x: number, z: number) =>
    podiumDistance(x, z) < -1.4 &&
    !inHouse(x, z, 0.6) &&
    !inPool(x, z, 1.4) &&
    !inPavilion(x, z, 1.4) &&
    !nearStep(z, 0.55) &&
    !nearStair(x, z, 0.5) &&
    !onPath(x, z, PATH_WIDTH / 2 + 0.25) &&
    !inPlayground(x, z, 0.5) &&
    !(Math.abs(x - PORTAL.cx) < 6 && z > PODIUM.maxZ - 5);
  // Drifts lining both sides of every lane (like the film: lavender along the path).
  for (const p of PATHS) {
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i];
      const [bx, bz] = p[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      const rot = Math.atan2(-dz, dx);
      for (const side of [-1, 1]) {
        let s = 0.4;
        while (s < len) {
          const L = 1.5 + rand() * 1.1;
          const cx = ax + dx * (s + L / 2);
          const cz = az + dz * (s + L / 2);
          s += L * 0.7;
          // a slow noise decides which stretches are planted
          const drift = fbm(cx / 11 + side * 3.1, cz / 11, 2);
          if (drift < -0.18) continue;
          const o = PATH_WIDTH / 2 + 0.62 + rand() * 0.25;
          const x = cx - dz * o * side;
          const z = cz + dx * o * side;
          if (!ok(x, z) || !ok(x + dx * L * 0.45, z + dz * L * 0.45) || !ok(x - dx * L * 0.45, z - dz * L * 0.45)) continue;
          const t = { x, z, y: groundHeight(x, z), s: 0.85 + rand() * 0.3, rot: rot + (rand() - 0.5) * 0.15, delay: rand(), tone: rand(), len: L / 1.0 };
          if (drift > -0.02 || rand() < 0.6) lavender.push(t);
          else grass.push({ ...t, len: undefined, s: 0.75 + rand() * 0.3, rot: rand() * Math.PI * 2 });
        }
      }
    }
  }
  return { lavender, grass };
})();

/** Hillside shrubs (maquis) — dark rounded bushes scattered between the trees. */
export const SHRUBS: Tuft[] = (() => {
  const rand = mulberry32(99);
  const out: Tuft[] = [];
  const outside = TREES.filter((t) => podiumDistance(t.x, t.z) > 4);
  let tries = 0;
  while (out.length < 400 && tries < 40000) {
    tries++;
    // understorey: gather around trees, like the maquis at the wood's edge
    const t = outside[Math.floor(rand() * outside.length)];
    const a = rand() * Math.PI * 2;
    const r = 2.2 + rand() * 4.5;
    const x = t.x + Math.cos(a) * r;
    const z = t.z + Math.sin(a) * r;
    if (x < -108 || x > 108 || z < -78 || z > 78) continue;
    if (podiumDistance(x, z) < 2.5) continue;
    if (Math.abs(z - STREET.z) < STREET.halfWidth + 1.5) continue;
    if (Math.abs(x - PORTAL.cx) < 7 && z > PODIUM.maxZ && z < STREET.z) continue;
    if (Math.abs(x - ENTRANCE.x) < 4 && z > PODIUM.maxZ && z < STREET.z) continue;
    if (TREES.some((q) => Math.abs(q.x - x) < 1.4 && Math.abs(q.z - z) < 1.4)) continue;
    out.push({ x, z, y: groundHeight(x, z), s: 0.75 + rand() * 0.9, rot: rand() * Math.PI * 2, delay: rand(), tone: rand() });
  }
  return out;
})();
