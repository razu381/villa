/**
 * Limestone landscape architecture as merged geometries:
 *   stone      — the bastion ring (with the garage portal and the street entrance),
 *                terrace walls, stairs and cheeks, copings, pool copings, portal frame
 *   recess     — the inside faces of the garage portal (jambs, soffit, light strip)
 *   recessBack — the portal's back face, its own mesh so the section/cars module
 *                can hide it (or replace it with the tunnel) while cars drive in
 *
 * Every stone piece is a closed solid (poché reads when cut). Vertex attributes:
 *   position, normal, aWall = (u along the face [m], v [m], kind),
 *   aBase = the pre-build ground under the vertex (the podium rises from it, build.ts)
 * kinds: 0 masonry face · 1 coping / paving slab · 2 dressed stone (stairs, frames)
 *        3 recess interior · 4 recess light strip
 */
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import { PATH_WIDTH, PODIUM, STREET, TERRACES } from "@/lib/village";
import { BASTION, ENTRANCE, PODIUM_FRAME, PORTAL, STEPS, TERRACE_WALL, baseHeight, existingHeight } from "../terrain/ground";
import { CROSSINGS, POOLS, STAIR } from "./layout";

export const KIND = { masonry: 0, coping: 1, dressed: 2, recess: 3, light: 4 } as const;
type V3 = [number, number, number];

export class Builder {
  pos: number[] = [];
  nor: number[] = [];
  wall: number[] = [];

  private push(p: V3, n: V3, u: number, v: number, k: number) {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.wall.push(u, v, k);
  }

  /**
   * Quad a-b-c-d (in order around it). Winding is fixed so the geometric normal
   * agrees with `hint`. Per-vertex normals: `ns` (smooth) or the flat normal.
   */
  quad(p: [V3, V3, V3, V3], hint: V3, uv: [number, number][], kind: number, ns?: [V3, V3, V3, V3]) {
    const a = new Vector3(...p[0]);
    const b = new Vector3(...p[1]);
    const c = new Vector3(...p[2]);
    const d = new Vector3(...p[3]);
    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-12) n.subVectors(c, a).cross(new Vector3().subVectors(d, a));
    if (n.lengthSq() < 1e-12) return; // degenerate
    n.normalize();
    const flip = n.dot(new Vector3(...hint)) < 0;
    if (flip) n.negate();
    const fn: V3 = [n.x, n.y, n.z];
    const order = flip ? [0, 3, 2, 0, 2, 1] : [0, 1, 2, 0, 2, 3];
    for (const i of order) this.push(p[i], ns ? ns[i] : fn, uv[i][0], uv[i][1], kind);
  }

  /** Axis-aligned box; `u` runs along the face's horizontal axis in world metres. */
  box(min: V3, max: V3, kind: number, topKind = kind) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    // +Z / -Z faces: u = x, v = y
    this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], kind);
    this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], kind);
    // +X / -X faces: u = z, v = y
    this.quad([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]], kind);
    this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]], kind);
    // top / bottom: u = long axis, v = short axis
    const lx = x1 - x0 >= z1 - z0;
    const tuv = (x: number, z: number): [number, number] => (lx ? [x, z] : [z, x]);
    this.quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], [tuv(x0, z0), tuv(x1, z0), tuv(x1, z1), tuv(x0, z1)], topKind);
    this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [tuv(x0, z0), tuv(x1, z0), tuv(x1, z1), tuv(x0, z1)], kind);
  }

  /**
   * Hexahedron spanning x0..x1 along X with per-end z range and sloped top:
   * used for stair cheeks (top falls from yTopN at zN to yTopS at zS).
   */
  cheek(x0: number, x1: number, zN: number, zS: number, yBot: number, yTopN: number, yTopS: number, kind: number) {
    const P = (x: number, y: number, z: number): V3 => [x, y, z];
    // sides (±X)
    for (const [x, s] of [
      [x0, -1],
      [x1, 1],
    ] as const) {
      this.quad([P(x, yBot, zN), P(x, yBot, zS), P(x, yTopS, zS), P(x, yTopN, zN)], [s, 0, 0], [[zN, yBot], [zS, yBot], [zS, yTopS], [zN, yTopN]], kind);
    }
    // ends (±Z)
    this.quad([P(x0, yBot, zS), P(x1, yBot, zS), P(x1, yTopS, zS), P(x0, yTopS, zS)], [0, 0, 1], [[x0, yBot], [x1, yBot], [x1, yTopS], [x0, yTopS]], kind);
    this.quad([P(x0, yBot, zN), P(x1, yBot, zN), P(x1, yTopN, zN), P(x0, yTopN, zN)], [0, 0, -1], [[x0, yBot], [x1, yBot], [x1, yTopN], [x0, yTopN]], kind);
    // sloped top + bottom
    this.quad([P(x0, yTopN, zN), P(x1, yTopN, zN), P(x1, yTopS, zS), P(x0, yTopS, zS)], [0, 1, 0], [[zN, x0], [zN, x1], [zS, x1], [zS, x0]], KIND.coping);
    this.quad([P(x0, yBot, zN), P(x1, yBot, zN), P(x1, yBot, zS), P(x0, yBot, zS)], [0, -1, 0], [[zN, x0], [zN, x1], [zS, x1], [zS, x0]], kind);
  }

  build() {
    const g = new BufferGeometry();
    const base = new Float32Array(this.pos.length / 3);
    const cache = new Map<string, number>();
    for (let i = 0; i < base.length; i++) {
      const x = this.pos[i * 3];
      const z = this.pos[i * 3 + 2];
      const key = `${x.toFixed(3)},${z.toFixed(3)}`;
      let b = cache.get(key);
      if (b === undefined) {
        b = existingHeight(x, z) - 0.02;
        cache.set(key, b);
      }
      base[i] = b;
    }
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute("aWall", new BufferAttribute(new Float32Array(this.wall), 3));
    g.setAttribute("aBase", new BufferAttribute(base, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** Terrace level at z with hard steps. */
function terraceAt(z: number) {
  let y: number = TERRACES[0].y;
  for (const s of STEPS) if (z > s.z) y = s.lower;
  return y;
}

/* ------------------------------------------------------------ the ring */

interface RingSample {
  x: number;
  z: number;
  nx: number;
  nz: number;
  s: number;
}

/** Samples around the podium's rounded rectangle, starting on the south edge at x = xStart, going east. */
function ringSamples(xStart: number, xEnd: number, forcedX: number[], forcedZ: number[]): RingSample[] {
  const { cx, cz, hx, hz, r } = PODIUM_FRAME;
  const ex = hx - r;
  const ez = hz - r;
  const pts: { x: number; z: number; nx: number; nz: number }[] = [];
  const line = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number, forced: number[], alongX: boolean) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ts = new Set<number>();
    const n = Math.max(1, Math.ceil(len / 1.0));
    for (let i = 0; i < n; i++) ts.add(i / n);
    for (const fv of forced) {
      const t = alongX ? (fv - x0) / (x1 - x0) : (fv - z0) / (z1 - z0);
      if (t > 1e-4 && t < 1 - 1e-4) ts.add(t);
    }
    [...ts].sort((a, b) => a - b).forEach((t) => pts.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx, nz }));
  };
  const arc = (ccx: number, ccz: number, a0: number, a1: number) => {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push({ x: ccx + Math.cos(a) * r, z: ccz + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) });
    }
  };
  // south edge (start at xStart) → east
  line(xStart, cz + hz, cx + ex, cz + hz, 0, 1, forcedX, true);
  arc(cx + ex, cz + ez, Math.PI / 2, 0);
  line(cx + hx, cz + ez, cx + hx, cz - ez, 1, 0, forcedZ, false);
  arc(cx + ex, cz - ez, 0, -Math.PI / 2);
  line(cx + ex, cz - hz, cx - ex, cz - hz, 0, -1, [], true);
  arc(cx - ex, cz - ez, -Math.PI / 2, -Math.PI);
  line(cx - hx, cz - ez, cx - hx, cz + ez, -1, 0, forcedZ, false);
  arc(cx - ex, cz + ez, Math.PI, Math.PI / 2);
  line(cx - ex, cz + hz, xEnd, cz + hz, 0, 1, forcedX, true);
  pts.push({ x: xEnd, z: cz + hz, nx: 0, nz: 1 });
  let s = 0;
  return pts.map((p, i) => {
    if (i > 0) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    return { ...p, s };
  });
}

/**
 * Extrude a solid strip along ring samples between podium distances dIn..dOut.
 * yBot / yTop are evaluated per sample (duplicated samples make jambs and risers).
 */
function ringStrip(
  b: Builder,
  samples: { x: number; z: number; nx: number; nz: number; s: number; bot: number; top: number }[],
  dIn: number,
  dOut: number,
  sideKind: number,
  topKind: number,
) {
  const P = (q: (typeof samples)[number], d: number, y: number): V3 => [q.x + q.nx * d, y, q.z + q.nz * d];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const c = samples[i + 1];
    const tx = c.x - a.x;
    const tz = c.z - a.z;
    const tl = Math.hypot(tx, tz);
    const tan: V3 = tl > 1e-6 ? [tx / tl, 0, tz / tl] : [a.nz, 0, -a.nx];
    const nA: V3 = [a.nx, 0, a.nz];
    const nC: V3 = [c.nx, 0, c.nz];
    if (tl > 1e-6) {
      // outer and inner faces (smooth horizontal normals)
      b.quad([P(a, dOut, a.bot), P(c, dOut, c.bot), P(c, dOut, c.top), P(a, dOut, a.top)], nA, [[a.s, a.bot], [c.s, c.bot], [c.s, c.top], [a.s, a.top]], sideKind, [nA, nC, nC, nA]);
      const iA: V3 = [-a.nx, 0, -a.nz];
      const iC: V3 = [-c.nx, 0, -c.nz];
      b.quad([P(a, dIn, a.bot), P(c, dIn, c.bot), P(c, dIn, c.top), P(a, dIn, a.top)], iA, [[a.s, a.bot], [c.s, c.bot], [c.s, c.top], [a.s, a.top]], sideKind, [iA, iC, iC, iA]);
    }
    // top: horizontal, or a riser where the top steps down between duplicated samples
    const topHint: V3 = tl > 1e-6 ? [0, 1, 0] : (tan.map((t) => t * Math.sign(a.top - c.top)) as V3);
    b.quad([P(a, dIn, a.top), P(a, dOut, a.top), P(c, dOut, c.top), P(c, dIn, c.top)], topHint, [[a.s, dIn], [a.s, dOut], [c.s, dOut], [c.s, dIn]], tl > 1e-6 ? topKind : sideKind);
    // bottom: horizontal, or a jamb where the bottom jumps (portal)
    const botHint: V3 = tl > 1e-6 ? [0, -1, 0] : (tan.map((t) => t * Math.sign(c.bot - a.bot)) as V3);
    b.quad([P(a, dIn, a.bot), P(a, dOut, a.bot), P(c, dOut, c.bot), P(c, dIn, c.bot)], botHint, [[a.s, dIn], [a.s, dOut], [c.s, dOut], [c.s, dIn]], tl > 1e-6 ? sideKind : KIND.dressed);
  }
  // end caps
  const capAt = (q: (typeof samples)[number], dir: number) => {
    const hint: V3 = [q.nz * dir, 0, -q.nx * dir];
    b.quad([P(q, dIn, q.bot), P(q, dOut, q.bot), P(q, dOut, q.top), P(q, dIn, q.top)], hint, [[dIn, q.bot], [dOut, q.bot], [dOut, q.top], [dIn, q.top]], KIND.dressed);
  };
  // walking tangent is (nz, 0, -nx): the start cap faces back, the end cap forward
  capAt(samples[0], -1);
  capAt(samples[samples.length - 1], 1);
}

export function buildWalls() {
  const stone = new Builder();
  const recess = new Builder();
  const recessBack = new Builder();

  /* ------------------------------------------------------------ bastion */
  const gapW = ENTRANCE.width / 2 + ENTRANCE.cheek;
  const gapE = ENTRANCE.x + gapW;
  const gapWest = ENTRANCE.x - gapW;
  const forcedX = [PORTAL.minX, PORTAL.maxX];
  const forcedZ = STEPS.map((s) => s.z);
  const raw = ringSamples(gapE, gapWest, forcedX, forcedZ);
  const outerGround = (x: number, z: number, nx: number, nz: number) =>
    Math.min(baseHeight(x + nx * (BASTION.outer + 0.4), z + nz * (BASTION.outer + 0.4)), baseHeight(x + nx * BASTION.outer, z + nz * BASTION.outer));
  // expand samples: duplicate at steps (top changes) and portal jambs (bottom changes)
  const ring: { x: number; z: number; nx: number; nz: number; s: number; bot: number; top: number }[] = [];
  const onSouth = (q: RingSample) => q.nz > 0.99;
  const onSide = (q: RingSample) => Math.abs(q.nx) > 0.99;
  for (const q of raw) {
    const level = (z: number) => terraceAt(z) + BASTION.parapet;
    const groundBot = Math.min(outerGround(q.x, q.z, q.nx, q.nz), terraceAt(q.z)) - 0.9;
    const inPortal = onSouth(q) && q.x > PORTAL.minX + 1e-4 && q.x < PORTAL.maxX - 1e-4;
    const bot = inPortal ? PORTAL.top : groundBot;
    const stepHere = onSide(q) && STEPS.find((s) => Math.abs(q.z - s.z) < 1e-4);
    const portalEdge = onSouth(q) && (Math.abs(q.x - PORTAL.minX) < 1e-4 || Math.abs(q.x - PORTAL.maxX) < 1e-4);
    if (stepHere) {
      // walking the east side we go north (z decreasing), the west side south (z increasing)
      const goingNorth = q.nx > 0;
      const first = goingNorth ? stepHere.lower : stepHere.upper;
      const second = goingNorth ? stepHere.upper : stepHere.lower;
      ring.push({ ...q, bot, top: first + BASTION.parapet });
      ring.push({ ...q, bot, top: second + BASTION.parapet });
    } else if (portalEdge) {
      const entering = Math.abs(q.x - PORTAL.minX) < 1e-4; // going east: enter at minX
      ring.push({ ...q, bot: entering ? groundBot : PORTAL.top, top: level(q.z) });
      ring.push({ ...q, bot: entering ? PORTAL.top : groundBot, top: level(q.z) });
    } else {
      ring.push({ ...q, bot, top: level(q.z) });
    }
  }
  ringStrip(stone, ring, BASTION.inner, BASTION.outer, KIND.masonry, KIND.coping);
  // coping: a thin dressed cap, slightly proud on both sides
  const coping = ring.map((q) => ({ ...q, bot: q.top - 0.02, top: q.top + BASTION.coping }));
  ringStrip(stone, coping, BASTION.inner - BASTION.overhang, BASTION.outer + BASTION.overhang, KIND.dressed, KIND.coping);

  /* ---------------------------------------------------- garage portal */
  const zWall = PODIUM.maxZ + BASTION.outer;
  const zBack = PODIUM.maxZ + PORTAL.back;
  const yF = PORTAL.floor;
  const yT = PORTAL.top;
  const terraceD = TERRACES[TERRACES.length - 1].y;
  // lintel slab over the recess (its top is a small paved landing in the garden)
  stone.box([PORTAL.minX - 0.35, yT, zBack - 0.55], [PORTAL.maxX + 0.35, terraceD + 0.02, PODIUM.maxZ + BASTION.inner + 0.05], KIND.masonry, KIND.coping);
  // dressed limestone frame, proud of the wall
  const fw = 0.55;
  const fd = 0.14;
  stone.box([PORTAL.minX - fw, yF - 0.2, zWall - 0.05], [PORTAL.minX, yT + fw, zWall + fd], KIND.dressed);
  stone.box([PORTAL.maxX, yF - 0.2, zWall - 0.05], [PORTAL.maxX + fw, yT + fw, zWall + fd], KIND.dressed);
  stone.box([PORTAL.minX, yT, zWall - 0.05], [PORTAL.maxX, yT + fw, zWall + fd], KIND.dressed);
  // recess interior (single faces looking in), set just inside the opening so
  // nothing is coplanar with the jambs, the lintel or the terrain step
  const R = recess;
  const zIn = PODIUM.maxZ + BASTION.inner;
  const rx0 = PORTAL.minX + 0.08;
  const rx1 = PORTAL.maxX - 0.08;
  const rT = yT - 0.012;
  R.quad([[rx0, yF, zBack], [rx0, yF, zIn], [rx0, rT, zIn], [rx0, rT, zBack]], [1, 0, 0], [[zBack, yF], [zIn, yF], [zIn, rT], [zBack, rT]], KIND.recess);
  R.quad([[rx1, yF, zBack], [rx1, yF, zIn], [rx1, rT, zIn], [rx1, rT, zBack]], [-1, 0, 0], [[zBack, yF], [zIn, yF], [zIn, rT], [zBack, rT]], KIND.recess);
  recessBack.quad([[rx0, yF, zBack], [rx1, yF, zBack], [rx1, rT, zBack], [rx0, rT, zBack]], [0, 0, 1], [[rx0, yF], [rx1, yF], [rx1, rT], [rx0, rT]], KIND.recess);
  R.quad([[rx0, rT, zBack], [rx1, rT, zBack], [rx1, rT, zIn], [rx0, rT, zIn]], [0, -1, 0], [[rx0, zBack], [rx1, zBack], [rx1, zIn], [rx0, zIn]], KIND.recess);
  // a warm light strip in the soffit (glows at night)
  R.quad([[rx0 + 0.6, rT - 0.02, zBack + 0.5], [rx1 - 0.6, rT - 0.02, zBack + 0.5], [rx1 - 0.6, rT - 0.02, zBack + 0.8], [rx0 + 0.6, rT - 0.02, zBack + 0.8]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], KIND.light);

  /* ------------------------------------------------------ terrace walls */
  // Run each wall on through the bastion (to just inside its outer face): where the
  // bastion's top steps down at the terrace step, a wall stopping at its inner face
  // left a narrow slot whose inside faces read as dark poché on the white model.
  const xIn0 = PODIUM.minX - BASTION.outer + 0.05;
  const xIn1 = PODIUM.maxX + BASTION.outer - 0.05;
  for (const s of STEPS) {
    const gaps = CROSSINGS.filter((c) => Math.abs(c.stepZ - s.z) < 1e-3)
      .map((c) => [c.x - PATH_WIDTH / 2, c.x + PATH_WIDTH / 2] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    let x = xIn0;
    const top = s.upper + TERRACE_WALL.parapet;
    const segs: [number, number][] = [];
    for (const [g0, g1] of gaps) {
      segs.push([x, g0]);
      x = g1;
    }
    segs.push([x, xIn1]);
    for (const [a, c] of segs) {
      if (c - a < 0.05) continue;
      stone.box([a, s.lower - 0.6, s.z - TERRACE_WALL.half], [c, top, s.z + TERRACE_WALL.half], KIND.masonry, KIND.coping);
      stone.box([a - 0.0, top - 0.02, s.z - TERRACE_WALL.half - 0.05], [c + 0.0, top + 0.1, s.z + TERRACE_WALL.half + 0.05], KIND.dressed, KIND.coping);
    }
  }

  /* --------------------------------------------------------------- stairs */
  for (const c of CROSSINGS) {
    const n = Math.max(2, Math.round((c.upper - c.lower) / STAIR.rise));
    const rise = (c.upper - c.lower) / n;
    const z0 = c.stepZ - TERRACE_WALL.half;
    const zTop = c.stepZ + TERRACE_WALL.half;
    const x0 = c.x - PATH_WIDTH / 2;
    const x1 = c.x + PATH_WIDTH / 2;
    for (let j = 1; j <= n; j++) {
      const top = c.lower + j * rise + (j === n ? 0.015 : 0);
      stone.box([x0, c.lower - 0.3, z0], [x1, top, zTop + (n - j) * STAIR.tread], KIND.dressed, KIND.coping);
    }
    const zFoot = zTop + (n - 1) * STAIR.tread;
    const yTopN = c.upper + TERRACE_WALL.parapet + 0.1;
    stone.cheek(x0 - STAIR.cheek, x0, z0 - 0.05, zFoot, c.lower - 0.3, yTopN, c.lower + 0.35, KIND.masonry);
    stone.cheek(x1, x1 + STAIR.cheek, z0 - 0.05, zFoot, c.lower - 0.3, yTopN, c.lower + 0.35, KIND.masonry);
  }

  /* ------------------------------------------------- the street entrance */
  {
    const yUp = terraceD;
    const yLow = STREET.y;
    const n = Math.round((yUp - yLow) / 0.176);
    const rise = (yUp - yLow) / n;
    const tread = 0.28;
    const zN = PODIUM.maxZ + BASTION.inner;
    const zL = PODIUM.maxZ + BASTION.outer;
    const x0 = ENTRANCE.x - ENTRANCE.width / 2;
    const x1 = ENTRANCE.x + ENTRANCE.width / 2;
    const bottom = yLow - 1.2;
    for (let j = 1; j <= n; j++) {
      const top = yLow + j * rise + (j === n ? 0.015 : 0);
      stone.box([x0, bottom, zN], [x1, top, zL + (n - j) * tread], KIND.dressed, KIND.coping);
    }
    const zFoot = zL + (n - 1) * tread;
    const yTopN = yUp + BASTION.parapet + BASTION.coping;
    stone.cheek(x0 - ENTRANCE.cheek, x0, zN, zFoot + 0.3, bottom, yTopN, yLow + 0.5, KIND.masonry);
    stone.cheek(x1, x1 + ENTRANCE.cheek, zN, zFoot + 0.3, bottom, yTopN, yLow + 0.5, KIND.masonry);
  }

  /* ---------------------------------------------------------- pool copings */
  for (const p of POOLS) {
    const w = 0.42;
    const yT2 = p.y + 0.06;
    const yB = p.y - 0.25;
    stone.box([p.x - p.hx - w, yB, p.z - p.hz - w], [p.x + p.hx + w, yT2, p.z - p.hz], KIND.dressed, KIND.coping);
    stone.box([p.x - p.hx - w, yB, p.z + p.hz], [p.x + p.hx + w, yT2, p.z + p.hz + w], KIND.dressed, KIND.coping);
    stone.box([p.x - p.hx - w, yB, p.z - p.hz], [p.x - p.hx, yT2, p.z + p.hz], KIND.dressed, KIND.coping);
    stone.box([p.x + p.hx, yB, p.z - p.hz], [p.x + p.hx + w, yT2, p.z + p.hz], KIND.dressed, KIND.coping);
  }

  return { stone: stone.build(), recess: recess.build(), recessBack: recessBack.build() };
}
