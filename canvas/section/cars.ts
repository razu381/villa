/**
 * Model cars — the architectural-model kind: one soft extruded body, a smoked
 * glass cabin, four graphite wheels with pale hubs and slim lamp bars front
 * and back. One merged geometry (attribute aPart picks the surface), drawn
 * instanced for every car in one call.
 *
 * Local frame: footprint centred on the origin, wheels on y = 0, nose at -Z
 * (a car with rotation.y = 0 faces north).
 *
 * Arrivals: each arriving car follows a smooth Catmull-Rom path — street,
 * driveway, portal, tunnel, aisle, bay — timed by the journey position t with a
 * monotone (never reversing) time warp that slows into the bay.
 */
import { BoxGeometry, BufferAttribute, BufferGeometry, CatmullRomCurve3, CylinderGeometry, ExtrudeGeometry, Shape, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STREET } from "@/lib/village";
import { AISLE_Z, ARRIVALS, BAY_ROWS, CAR, HALL, PORTAL_MOUTH_Z, PORTAL_Z, ROUTE_IN, tubeFloorY } from "./layout";

export const PART = { body: 0, glass: 1, tyre: 2, hub: 3, head: 4, tail: 5 } as const;

function tag(g: BufferGeometry, part: number) {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  ng.deleteAttribute("uv");
  const n = ng.attributes.position.count;
  ng.setAttribute("aPart", new BufferAttribute(new Float32Array(n).fill(part), 1));
  return ng;
}

/** Extrude a side profile (u forward, v up) across the car's width, nose to -Z. */
function profile(shape: Shape, width: number, bevel: number, segs = 10) {
  const g = new ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: segs,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(Math.PI / 2); // shape x (forward) → -Z, extrusion → X
  return g;
}

export function buildCarGeometry() {
  const L = CAR.length / 2 - 0.07;
  const W = CAR.width;
  const wheelR = 0.34;
  const wheelU = 1.4;
  const archR = 0.47;

  // body: a soft wedge — rounded nose, long shoulder, clipped tail, wheel arches
  const body = new Shape();
  body.moveTo(L - 0.16, 0.24);
  body.quadraticCurveTo(L, 0.25, L, 0.44);
  body.lineTo(L - 0.02, 0.6);
  body.quadraticCurveTo(L - 0.05, 0.78, L - 0.38, 0.81);
  body.lineTo(0.95, 0.89);
  body.lineTo(-L + 0.42, 0.93);
  body.quadraticCurveTo(-L + 0.04, 0.93, -L, 0.72);
  body.lineTo(-L, 0.42);
  body.quadraticCurveTo(-L + 0.02, 0.25, -L + 0.2, 0.24);
  body.lineTo(-wheelU - archR, 0.24);
  body.absarc(-wheelU, 0.33, archR, Math.PI, 0, true);
  body.lineTo(wheelU - archR, 0.24);
  body.absarc(wheelU, 0.33, archR, Math.PI, 0, true);
  body.lineTo(L - 0.16, 0.24);
  const bodyG = profile(body, W, 0.07, 10);

  // cabin: smoked glass, a gentle teardrop
  const cab = new Shape();
  cab.moveTo(-L + 0.55, 0.88);
  cab.lineTo(0.98, 0.88);
  cab.quadraticCurveTo(0.6, 1.16, 0.12, 1.33);
  cab.lineTo(-0.98, 1.35);
  cab.quadraticCurveTo(-1.42, 1.32, -L + 0.55, 0.88);
  const cabG = profile(cab, W - 0.3, 0.08, 10);

  const parts: BufferGeometry[] = [tag(bodyG, PART.body), tag(cabG, PART.glass)];

  // wheels and hubs
  for (const su of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const tyre = new CylinderGeometry(wheelR, wheelR, 0.24, 20, 1);
      tyre.rotateZ(Math.PI / 2);
      tyre.translate(sx * (W / 2 - 0.16), wheelR, -su * wheelU);
      parts.push(tag(tyre, PART.tyre));
      const hub = new CylinderGeometry(0.19, 0.19, 0.245, 16, 1);
      hub.rotateZ(Math.PI / 2);
      hub.translate(sx * (W / 2 - 0.16), wheelR, -su * wheelU);
      parts.push(tag(hub, PART.hub));
    }
  }

  // slim lamp bars: warm white at the nose, red across the tail
  const head = new BoxGeometry(W - 0.42, 0.055, 0.06);
  head.translate(0, 0.66, -(L + 0.035));
  parts.push(tag(head, PART.head));
  const tail = new BoxGeometry(W - 0.34, 0.065, 0.06);
  tail.translate(0, 0.76, L + 0.045);
  parts.push(tag(tail, PART.tail));

  const merged = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** Contact-shadow quad under a car (local frame, just above the floor). */
export function buildCarShadowGeometry() {
  const g = new BoxGeometry(CAR.width + 0.7, 0.001, CAR.length + 0.9);
  const flat = new BufferGeometry();
  // top face only, as a plane with uv
  const pos = g.attributes.position.array as Float32Array;
  const uv = g.attributes.uv.array as Float32Array;
  const idx = g.index!.array;
  const top: number[] = [];
  const tuv: number[] = [];
  // BoxGeometry groups: +x, -x, +y, -y, +z, -z (6 indices per face); +y is the third
  for (let i = 12; i < 18; i++) {
    const v = idx[i];
    top.push(pos[v * 3], 0.018, pos[v * 3 + 2]);
    tuv.push(uv[v * 2], uv[v * 2 + 1]);
  }
  g.dispose();
  flat.setAttribute("position", new BufferAttribute(new Float32Array(top), 3));
  flat.setAttribute("uv", new BufferAttribute(new Float32Array(tuv), 2));
  return flat;
}

/* --------------------------------------------------------------- the route */

/** Road height along the route: street, driveway, tunnel ramp, hall floor. */
export function roadY(z: number) {
  if (z >= PORTAL_Z) return STREET.y;
  if (z > HALL.z1) return tubeFloorY(z);
  return HALL.y0;
}

export interface Arrival {
  curve: CatmullRomCurve3;
  length: number;
  /** Journey keys (t, arc length s): street start, portal mouth, inside the hall, parked. */
  keys: [number, number][];
  slopes: number[];
  paint: number;
}

const pt = (x: number, z: number) => new Vector3(x, roadY(z), z);

/** Arc length at which the curve first crosses z (moving north). */
function arcAtZ(curve: CatmullRomCurve3, length: number, z: number) {
  const n = 600;
  const p = new Vector3();
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(i / n, p);
    if (p.z <= z) return (i / n) * length;
  }
  return length;
}

/** Fritsch–Carlson monotone slopes, with the last slope 0 (eases to a stop). */
function monotoneSlopes(keys: [number, number][]) {
  const n = keys.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  const h = (i: number) => keys[i + 1][0] - keys[i][0];
  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m.push(0);
      continue;
    }
    const w1 = 2 * h(i) + h(i - 1);
    const w2 = h(i) + 2 * h(i - 1);
    m.push((w1 + w2) / (w1 / d[i - 1] + w2 / d[i]));
  }
  m.push(0);
  // keep inside the monotone region
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const q = a * a + b * b;
    if (q > 9) {
      const s = 3 / Math.sqrt(q);
      m[i] = s * a * d[i];
      m[i + 1] = s * b * d[i];
    }
  }
  return m;
}

export function buildArrivals(): Arrival[] {
  return ARRIVALS.map((a, i) => {
    const south = a.row === "south";
    const rowZ = south ? BAY_ROWS.south : BAY_ROWS.north;
    const dir = south ? 1 : -1;
    const pts = [
      ...ROUTE_IN.map(([x, z]) => pt(x, z)),
      pt(a.bayX - 8.5, AISLE_Z - dir * 0.15),
      pt(a.bayX - 4.4, AISLE_Z + dir * 0.35),
      pt(a.bayX - 1.1, AISLE_Z + dir * 2.6),
      pt(a.bayX - 0.05, rowZ - dir * 0.6),
      pt(a.bayX, rowZ + dir * 0.25),
    ];
    const curve = new CatmullRomCurve3(pts, false, "centripetal");
    curve.arcLengthDivisions = 2000;
    const length = curve.getLength();
    const sMouth = arcAtZ(curve, length, PORTAL_MOUTH_Z + 0.5);
    const sHall = arcAtZ(curve, length, 3.5);
    const t0 = 3.86 + 0.05 * i;
    const t1 = t0 + 0.185;
    const t2 = t1 + 0.115;
    const t3 = 4.66 + 0.058 * i;
    const keys: [number, number][] = [
      [t0, 0],
      [t1, sMouth],
      [t2, sHall],
      [t3, length],
    ];
    return { curve, length, keys, slopes: monotoneSlopes(keys), paint: a.paint };
  });
}

/** Arc length along an arrival at journey time t (−1 before it appears). */
export function arrivalS(a: Arrival, t: number) {
  const k = a.keys;
  if (t < k[0][0]) return -1;
  if (t >= k[k.length - 1][0]) return a.length;
  let i = 0;
  while (i < k.length - 2 && t >= k[i + 1][0]) i++;
  const h = k[i + 1][0] - k[i][0];
  const u = (t - k[i][0]) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * k[i][1] +
    (u3 - 2 * u2 + u) * h * a.slopes[i] +
    (-2 * u3 + 3 * u2) * k[i + 1][1] +
    (u3 - u2) * h * a.slopes[i + 1]
  );
}
