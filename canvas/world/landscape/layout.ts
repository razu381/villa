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
  type TreeSpec,
} from "@/lib/village";
import { BASTION, ENTRANCE, PODIUM_FRAME, PORTAL, STEPS, TERRACE_WALL, groundHeight, smoothstep } from "../terrain/ground";

/* ------------------------------------------------------------ groves */

/**
 * Low-frequency groves (0 = open dry clearing, 1 = dense maquis), ~70 m
 * features, denser to the north and east like the aerial. Baked into the AO
 * texture's alpha for the ground shader; used here to thin the hillside trees.
 */
export function groveMask(x: number, z: number) {
  const n = fbm(x / 68 + 4.3, z / 68 - 2.1, 3);
  const bias = 0.24 * smoothstep(-25, -72, z) + 0.2 * smoothstep(45, 100, x) - 0.12;
  return smoothstep(-0.1, 0.26, n + bias);
}

/** Street entrance stair and garage-portal apron: nothing grows there. */
export function inKeepOut(x: number, z: number, m = 0) {
  if (z < PODIUM.maxZ - m || z > STREET.z + m) return false;
  return Math.abs(x - ENTRANCE.x) < ENTRANCE.width / 2 + ENTRANCE.cheek + 1.5 + m || Math.abs(x - PORTAL.cx) < 7 + m;
}

export interface LandscapeTree extends TreeSpec {
  /** Grove amount at the tree (1 inside the podium). */
  grove: number;
}

/**
 * The trees the landscape renders: lib/village TREES minus the keep-out zones,
 * with the hillside thinned outside the groves (about a third fewer) and the
 * grove trees a touch larger, so the hillside reads as masses and clearings
 * rather than an even scatter.
 */
export const LANDSCAPE_TREES: LandscapeTree[] = (() => {
  const rand = mulberry32(404);
  const out: LandscapeTree[] = [];
  for (const t of TREES) {
    if (inKeepOut(t.x, t.z)) continue;
    if (podiumDistance(t.x, t.z) < 0) {
      out.push({ ...t, grove: 1 });
      continue;
    }
    const g = groveMask(t.x, t.z);
    const keep = 0.22 + 0.78 * smoothstep(0.12, 0.62, g);
    if (rand() > keep) continue;
    out.push({ ...t, height: t.height * (0.94 + 0.16 * g), grove: g });
  }
  return out;
})();

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

/** Path lights: small bollards along the lanes, alternating sides; (nx, nz) points onto the lane. */
export const PATH_LIGHTS: { x: number; z: number; y: number; delay: number; nx: number; nz: number }[] = (() => {
  const out: { x: number; z: number; y: number; delay: number; nx: number; nz: number }[] = [];
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
        out.push({ x, z, y: groundHeight(x, z), delay: rand(), nx: dz * side, nz: -dx * side });
      }
      acc += len;
    }
  });
  // Light the entrance stair foot and the portal.
  out.push({ x: ENTRANCE.x - ENTRANCE.width / 2 - 0.9, z: STREET.z - 4.0, y: STREET.y, delay: 0.1, nx: 0.6, nz: 0.8 });
  out.push({ x: ENTRANCE.x + ENTRANCE.width / 2 + 0.9, z: STREET.z - 4.0, y: STREET.y, delay: 0.15, nx: -0.6, nz: 0.8 });
  out.push({ x: PORTAL.minX - 1.4, z: STREET.z - 4.0, y: STREET.y, delay: 0.2, nx: 0.6, nz: 0.8 });
  out.push({ x: PORTAL.maxX + 1.4, z: STREET.z - 4.0, y: STREET.y, delay: 0.25, nx: -0.6, nz: 0.8 });
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
          const L = 2.2 + rand() * 1.0;
          const cx = ax + dx * (s + L / 2);
          const cz = az + dz * (s + L / 2);
          s += L * 0.78;
          // a slow noise decides which stretches are planted: long bands, short gaps
          const drift = fbm(cx / 14 + side * 3.1, cz / 14, 2);
          if (drift < -0.3) continue;
          const o = PATH_WIDTH / 2 + 0.62 + rand() * 0.25;
          const x = cx - dz * o * side;
          const z = cz + dx * o * side;
          if (!ok(x, z) || !ok(x + dx * L * 0.45, z + dz * L * 0.45) || !ok(x - dx * L * 0.45, z - dz * L * 0.45)) continue;
          const t = { x, z, y: groundHeight(x, z), s: 0.85 + rand() * 0.3, rot: rot + (rand() - 0.5) * 0.15, delay: rand(), tone: rand(), len: L / 1.0 };
          if (drift > -0.12 || rand() < 0.7) lavender.push(t);
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
  const outside = LANDSCAPE_TREES.filter((t) => podiumDistance(t.x, t.z) > 4);
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
    if (inKeepOut(x, z, 0.5)) continue;
    if (LANDSCAPE_TREES.some((q) => Math.abs(q.x - x) < 1.4 && Math.abs(q.z - z) < 1.4)) continue;
    out.push({ x, z, y: groundHeight(x, z), s: 0.75 + rand() * 0.9, rot: rand() * Math.PI * 2, delay: rand(), tone: rand() });
  }
  return out;
})();

/* ------------------------------------------------------- garden planting */

/**
 * Planting beds on top of the terrace walls and inside the bastion parapet —
 * the greenery that spills over the limestone in the film. Rounded shrubs of
 * mixed size, laid as a continuous band (instanced with the hillside shrubs).
 */
export const BEDS: Tuft[] = (() => {
  const rand = mulberry32(123);
  const out: Tuft[] = [];
  const ok = (x: number, z: number) =>
    !inHouse(x, z, 0.5) &&
    !inPool(x, z, 1.2) &&
    !inPavilion(x, z, 1.6) &&
    !nearStair(x, z, 0.6) &&
    !onPath(x, z, PATH_WIDTH / 2 + 0.35) &&
    !inPlayground(x, z, 0.3) &&
    !inKeepOut(x, z, 1.0) &&
    !(Math.abs(x - PORTAL.cx) < (PORTAL.maxX - PORTAL.minX) / 2 + 1.5 && z > PODIUM.maxZ + PORTAL.back - 1.5) &&
    !LANDSCAPE_TREES.some((t) => Math.abs(t.x - x) < 1.0 && Math.abs(t.z - z) < 1.0);
  const lay = (x: number, z: number, rot: number, depth: number) => {
    if (!ok(x, z)) return;
    const big = rand() < 0.22;
    const s = big ? 0.95 + rand() * 0.35 : 0.5 + rand() * 0.4;
    out.push({ x, z, y: groundHeight(x, z), s, rot: rot + rand() * 6.3, delay: rand(), tone: rand() * 0.85 + depth * 0.15 });
  };
  // the upper side of every terrace wall
  for (const st of STEPS) {
    const z0 = st.z - TERRACE_WALL.half - 0.55;
    for (let x = PODIUM.minX + 1.4; x < PODIUM.maxX - 1.4; x += 0.85 + rand() * 0.45) {
      lay(x, z0 + (rand() - 0.5) * 0.3, 0, 0);
      if (rand() < 0.35) lay(x + 0.45, z0 - 0.65 - rand() * 0.3, 0, 1);
    }
  }
  // inside the bastion parapet, all round
  const { cx, cz, hx, hz, r } = PODIUM_FRAME;
  const off = -BASTION.inner + 0.6; // inward from the podium edge
  const R = r - off;
  const ex = hx - r;
  const ez = hz - r;
  const ring: [number, number][] = [];
  const line = (x0: number, z0: number, x1: number, z1: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    for (let s = 0; s < L; s += 0.85 + rand() * 0.45) ring.push([x0 + ((x1 - x0) * s) / L, z0 + ((z1 - z0) * s) / L]);
  };
  const arc = (ccx: number, ccz: number, a0: number) => {
    for (let a = 0; a < Math.PI / 2; a += 1.1 / R) ring.push([ccx + Math.cos(a0 + a) * R, ccz + Math.sin(a0 + a) * R]);
  };
  line(cx - ex, cz - hz + off, cx + ex, cz - hz + off);
  arc(cx + ex, cz - ez, -Math.PI / 2);
  line(cx + hx - off, cz - ez, cx + hx - off, cz + ez);
  arc(cx + ex, cz + ez, 0);
  line(cx + ex, cz + hz - off, cx - ex, cz + hz - off);
  arc(cx - ex, cz + ez, Math.PI / 2);
  line(cx - hx + off, cz + ez, cx - hx + off, cz - ez);
  arc(cx - ex, cz - ez, Math.PI);
  for (const [x, z] of ring) {
    lay(x, z, 0, 0);
    if (rand() < 0.35) {
      const d = podiumDistance(x, z);
      const gx = (podiumDistance(x + 0.1, z) - d) / 0.1;
      const gz = (podiumDistance(x, z + 0.1) - d) / 0.1;
      lay(x - gx * 0.65, z - gz * 0.65, 0, 1);
    }
  }
  return out;
})();

/** Clipped hedges framing the villa gardens (x, z, length along z, height). */
export const HEDGES: { x: number; z: number; y: number; len: number; w: number; h: number; delay: number }[] = (() => {
  const rand = mulberry32(55);
  const out: { x: number; z: number; y: number; len: number; w: number; h: number; delay: number }[] = [];
  for (const h of HOUSES.filter((hh) => hh.type === "v4")) {
    const z0 = h.z + h.depth / 2 + 0.8;
    const z1 = PODIUM.maxZ + BASTION.inner - 1.4;
    for (const side of [-1, 1]) {
      const x = h.x + side * (h.width / 2 + 2.6);
      if (onPath(x, (z0 + z1) / 2, PATH_WIDTH / 2 + 0.6)) continue;
      out.push({ x, z: (z0 + z1) / 2, y: groundHeight(x, (z0 + z1) / 2), len: z1 - z0, w: 0.62, h: 0.9, delay: rand() });
    }
  }
  return out;
})();
