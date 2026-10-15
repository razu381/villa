/**
 * The plinth: a closed solid (heightfield top + four vertical sides + bottom),
 * so the section poché reads when it is cut.
 *
 * The top grid is non-uniform: grid lines are forced onto the built edges
 * (bastion band, terrace steps, portal jambs) so those drops are crisp and sit
 * exactly inside the retaining walls, and the grid is refined around the
 * podium's rounded corners.
 *
 * Attributes: position, normal,
 *   aTerr  = (pre-build height, side flag, final top height)
 *   aMorph = (pre-build normal xyz, 1 on the top surface and the sides' top row)
 * The vertex shader lerps the top from the pre-build hill to the built ground
 * with uPodRise (build.ts).
 */
import { BufferAttribute, BufferGeometry } from "three";
import { PLINTH, PODIUM } from "@/lib/village";
import { EDGE, PORTAL, STEPS, STEP_BAND, existingHeight, groundHeight } from "./ground";

const BASE_STEP = 1.4;
const FINE_STEP = 0.3;

function buildAxis(min: number, max: number, refine: [number, number][], forced: number[]) {
  const stepAt = (v: number) => (refine.some(([a, b]) => v >= a && v <= b) ? FINE_STEP : BASE_STEP);
  let pts: number[] = [];
  for (let v = min; v < max - 1e-6; v += stepAt(v)) pts.push(v);
  pts.push(max);
  for (const fv of forced) {
    if (fv <= min || fv >= max) continue;
    pts = pts.filter((p) => Math.abs(p - fv) > 0.11 || p === min || p === max);
  }
  pts.push(...forced.filter((fv) => fv > min && fv < max));
  pts.sort((a, b) => a - b);
  // de-duplicate exact repeats
  return pts.filter((p, i) => i === 0 || p - pts[i - 1] > 1e-4);
}

export function buildPlinthGeometry() {
  const r = PODIUM.radius;
  const xs = buildAxis(
    PLINTH.minX,
    PLINTH.maxX,
    [
      [PODIUM.minX - 1.5, PODIUM.minX + r + 1],
      [PODIUM.maxX - r - 1, PODIUM.maxX + 1.5],
    ],
    [
      PODIUM.minX - EDGE[1],
      PODIUM.minX - EDGE[0],
      PODIUM.maxX + EDGE[0],
      PODIUM.maxX + EDGE[1],
      PORTAL.minX - 0.05,
      PORTAL.minX + 0.05,
      PORTAL.maxX - 0.05,
      PORTAL.maxX + 0.05,
    ],
  );
  const zs = buildAxis(
    PLINTH.minZ,
    PLINTH.maxZ,
    [
      [PODIUM.minZ - 1.5, PODIUM.minZ + r + 1],
      [PODIUM.maxZ - r - 1, PODIUM.maxZ + 1.5],
    ],
    [
      PODIUM.minZ - EDGE[1],
      PODIUM.minZ - EDGE[0],
      PODIUM.maxZ + EDGE[0],
      PODIUM.maxZ + EDGE[1],
      PODIUM.maxZ + PORTAL.back - 0.45,
      PODIUM.maxZ + PORTAL.back - 0.1,
      ...STEPS.flatMap((s) => [s.z - STEP_BAND, s.z + STEP_BAND]),
    ],
  );

  const nx = xs.length;
  const nz = zs.length;
  const H = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = groundHeight(xs[i], zs[j]);

  const sideCount = 2 * nx * 2 + 2 * nz * 2;
  const vCount = nx * nz + sideCount + 4;
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const terr = new Float32Array(vCount * 3);
  const morph = new Float32Array(vCount * 4);
  const idx: number[] = [];
  /** Normal of the pre-build hill (central differences). */
  const exNormal = (x: number, z: number): [number, number, number] => {
    const e = 0.6;
    const dx = (existingHeight(x + e, z) - existingHeight(x - e, z)) / (2 * e);
    const dz = (existingHeight(x, z + e) - existingHeight(x, z - e)) / (2 * e);
    const l = Math.hypot(dx, 1, dz);
    return [-dx / l, 1 / l, -dz / l];
  };

  // minmod slope limiter: crisp normals at the built drops, smooth elsewhere.
  const minmod = (a: number, b: number) => (a * b <= 0 ? 0 : Math.abs(a) < Math.abs(b) ? a : b);

  let v = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = xs[i];
      const z = zs[j];
      const h = H[j * nx + i];
      const gl = i > 0 ? (h - H[j * nx + i - 1]) / (x - xs[i - 1]) : null;
      const gr = i < nx - 1 ? (H[j * nx + i + 1] - h) / (xs[i + 1] - x) : null;
      const gu = j > 0 ? (h - H[(j - 1) * nx + i]) / (z - zs[j - 1]) : null;
      const gd = j < nz - 1 ? (H[(j + 1) * nx + i] - h) / (zs[j + 1] - z) : null;
      const dx = gl == null ? gr! : gr == null ? gl : minmod(gl, gr);
      const dz = gu == null ? gd! : gd == null ? gu : minmod(gu, gd);
      const len = Math.hypot(dx, 1, dz);
      pos.set([x, h, z], v * 3);
      nor.set([-dx / len, 1 / len, -dz / len], v * 3);
      terr.set([existingHeight(x, z), 0, h], v * 3);
      morph.set([...exNormal(x, z), 1], v * 4);
      v++;
    }
  }
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = (j + 1) * nx + i;
      const c = j * nx + i + 1;
      const d = (j + 1) * nx + i + 1;
      idx.push(a, b, c, c, b, d);
    }
  }

  // Sides: top follows the ground, bottom at PLINTH.bottom.
  const side = (pts: [number, number][], n: [number, number, number], flip: boolean) => {
    const start = v;
    for (const [x, z] of pts) {
      const h = groundHeight(x, z);
      const ex = existingHeight(x, z);
      pos.set([x, h, z], v * 3);
      nor.set(n, v * 3);
      terr.set([ex, 1, h], v * 3);
      morph.set([...n, 1], v * 4);
      v++;
      pos.set([x, PLINTH.bottom, z], v * 3);
      nor.set(n, v * 3);
      terr.set([ex, 1, h], v * 3);
      morph.set([...n, 0], v * 4);
      v++;
    }
    for (let k = 0; k < pts.length - 1; k++) {
      const t0 = start + k * 2;
      const b0 = t0 + 1;
      const t1 = t0 + 2;
      const b1 = t0 + 3;
      if (!flip) idx.push(b0, t0, b1, b1, t0, t1);
      else idx.push(b0, b1, t0, b1, t1, t0);
    }
  };
  side(xs.map((x) => [x, PLINTH.minZ]), [0, 0, -1], false); // north faces -Z
  side(xs.map((x) => [x, PLINTH.maxZ]), [0, 0, 1], true); // south faces +Z
  side(zs.map((z) => [PLINTH.minX, z]), [-1, 0, 0], true); // west faces -X
  side(zs.map((z) => [PLINTH.maxX, z]), [1, 0, 0], false); // east faces +X

  // Bottom.
  const b0 = v;
  for (const [x, z] of [
    [PLINTH.minX, PLINTH.minZ],
    [PLINTH.maxX, PLINTH.minZ],
    [PLINTH.minX, PLINTH.maxZ],
    [PLINTH.maxX, PLINTH.maxZ],
  ]) {
    pos.set([x, PLINTH.bottom, z], v * 3);
    nor.set([0, -1, 0], v * 3);
    terr.set([PLINTH.bottom, 1, PLINTH.bottom], v * 3);
    morph.set([0, -1, 0, 0], v * 4);
    v++;
  }
  idx.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2);

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos.subarray(0, v * 3), 3));
  g.setAttribute("normal", new BufferAttribute(nor.subarray(0, v * 3), 3));
  g.setAttribute("aTerr", new BufferAttribute(terr.subarray(0, v * 3), 3));
  g.setAttribute("aMorph", new BufferAttribute(morph.subarray(0, v * 4), 4));
  g.setIndex(idx);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
