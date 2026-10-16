/**
 * Unit-height tree geometries (base at the origin, height 1) for instancing.
 * Indexed: each canopy blob is an indexed icosphere (42 vertices), so the
 * vertex shader runs ~5× less than on a triangle soup.
 *
 * Each vertex carries its "foam" twin — the same vertex projected onto a smooth
 * envelope — so the shader can morph a model-maker's foam form into clustered
 * foliage.
 *
 * Attributes: position, normal, aFoam (vec3), aFoamN (vec3),
 *   aTree = (ao, part, height01, hidden) — part: 0 foliage, 1 trunk. The AO is baked
 *   per vertex: facing into the crown, tucked against a neighbouring blob,
 *   and low in the crown are darker. `hidden` marks crown faces that only a
 *   section cut can reveal (inside a neighbouring blob, or facing into the crown).
 */
import { BufferAttribute, BufferGeometry, IcosahedronGeometry, Vector3 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "@/lib/noise";
import type { TreeKind } from "@/lib/village";

type V3 = [number, number, number];
interface Blob {
  c: V3;
  r: V3;
}

/** Indexed unit icosphere (detail 1): positions + triangle indices. */
const SPHERE = (() => {
  const src = new IcosahedronGeometry(1, 1);
  src.deleteAttribute("normal");
  src.deleteAttribute("uv");
  const g = mergeVertices(src, 1e-4);
  src.dispose();
  const p = g.attributes.position;
  const pos: number[] = [];
  for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
  const index = Array.from(g.index!.array);
  g.dispose();
  return { pos, index };
})();

class TreeBuilder {
  pos: number[] = [];
  nor: number[] = [];
  foam: number[] = [];
  foamN: number[] = [];
  tree: number[] = [];
  index: number[] = [];

  private get count() {
    return this.pos.length / 3;
  }

  /** A canopy blob; `others` are the tree's other blobs (for the cavity AO). */
  blob(b: Blob, env: Blob, others: Blob[], jitter: number, seed: number) {
    const base = this.count;
    // lumpy displacement keyed by direction (consistent across shared vertices)
    const lump = (x: number, y: number, z: number) =>
      1 +
      jitter *
        (0.55 * Math.sin(x * 4.1 + seed) + 0.45 * Math.sin(y * 5.3 + seed * 0.7) + 0.4 * Math.sin(z * 4.7 + seed * 1.3) + 0.3 * Math.sin((x + z) * 7.9 + seed * 2.1)) *
        0.6;
    const { pos } = SPHERE;
    for (let i = 0; i < pos.length; i += 3) {
      const ux = pos[i];
      const uy = pos[i + 1];
      const uz = pos[i + 2];
      const k = lump(ux, uy, uz);
      const px = b.c[0] + ux * b.r[0] * k;
      const py = b.c[1] + uy * b.r[1] * k;
      const pz = b.c[2] + uz * b.r[2] * k;
      // ellipsoid normal
      const n = new Vector3(ux / b.r[0], uy / b.r[1], uz / b.r[2]).normalize();
      // foam twin: project from the envelope centre onto the envelope
      const d = new Vector3((px - env.c[0]) / env.r[0], (py - env.c[1]) / env.r[1], (pz - env.c[2]) / env.r[2]);
      const dl = d.length() || 1;
      d.divideScalar(dl);
      const fx = env.c[0] + d.x * env.r[0];
      const fy = env.c[1] + d.y * env.r[1];
      const fz = env.c[2] + d.z * env.r[2];
      const fn = new Vector3(d.x / env.r[0], d.y / env.r[1], d.z / env.r[2]).normalize();
      // cavity AO: facing into the crown, tucked against another blob, low in the crown
      const out = new Vector3(px - env.c[0], (py - env.c[1]) * 0.6, pz - env.c[2]).normalize();
      const facing = n.dot(out); // -1 into the crown … 1 out of it
      let ao = 0.45 + 0.4 * Math.max(0, Math.min(1, facing * 0.6 + 0.45));
      let qMin = Infinity;
      for (const o of others) {
        const q = Math.hypot((px - o.c[0]) / o.r[0], (py - o.c[1]) / o.r[1], (pz - o.c[2]) / o.r[2]);
        if (q < 1.55) ao *= 1 - 0.42 * (1 - Math.max(0, (q - 0.95) / 0.6));
        qMin = Math.min(qMin, q);
      }
      const hidden = Math.max(1 - Math.max(0, Math.min(1, (qMin - 0.85) / 0.2)), Math.max(0, Math.min(1, (0.1 - facing) / 0.45)));
      const low = (py - (env.c[1] - env.r[1])) / (2 * env.r[1]);
      ao *= 0.72 + 0.28 * Math.max(0, Math.min(1, low * 1.3));
      ao += 0.12 * Math.max(0, n.y); // tops catch the sky
      this.pos.push(px, py, pz);
      this.nor.push(n.x, n.y, n.z);
      this.foam.push(fx, fy, fz);
      this.foamN.push(fn.x, fn.y, fn.z);
      this.tree.push(Math.max(0.2, Math.min(1, ao)), 0, py, hidden);
    }
    for (const i of SPHERE.index) this.index.push(base + i);
  }

  /** Tapered cylinder from a to b (unit space), indexed. */
  trunk(a: V3, b: V3, r0: number, r1: number, seg = 6) {
    const base = this.count;
    const A = new Vector3(...a);
    const B = new Vector3(...b);
    const axis = new Vector3().subVectors(B, A).normalize();
    const t1 = new Vector3(1, 0, 0);
    if (Math.abs(axis.dot(t1)) > 0.9) t1.set(0, 0, 1);
    const u = new Vector3().crossVectors(axis, t1).normalize();
    const v = new Vector3().crossVectors(axis, u).normalize();
    for (const [C, r] of [
      [A, r0],
      [B, r1],
    ] as const) {
      for (let i = 0; i < seg; i++) {
        const ang = (i / seg) * Math.PI * 2;
        const n = new Vector3().addScaledVector(u, Math.cos(ang)).addScaledVector(v, Math.sin(ang));
        const p = C.clone().addScaledVector(n, r);
        this.pos.push(p.x, p.y, p.z);
        this.nor.push(n.x, n.y, n.z);
        this.foam.push(p.x, p.y, p.z);
        this.foamN.push(n.x, n.y, n.z);
        this.tree.push(0.85, 1, p.y, 0);
      }
    }
    for (let i = 0; i < seg; i++) {
      const i1 = (i + 1) % seg;
      this.index.push(base + i, base + i1, base + seg + i1, base + i, base + seg + i1, base + seg + i);
    }
  }

  build() {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute("aFoam", new BufferAttribute(new Float32Array(this.foam), 3));
    g.setAttribute("aFoamN", new BufferAttribute(new Float32Array(this.foamN), 3));
    g.setAttribute("aTree", new BufferAttribute(new Float32Array(this.tree), 4));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Build the unit geometry for a tree kind. */
export function buildTreeGeometry(kind: TreeKind) {
  const b = new TreeBuilder();
  const rand = mulberry32(kind === "round" ? 11 : kind === "tall" ? 23 : 37);
  const blobs: Blob[] = [];
  let env: Blob;
  let jitter: number;
  if (kind === "round") {
    // holm oak / stone pine: a crown of clustered domes
    env = { c: [0, 0.62, 0], r: [0.38, 0.36, 0.38] };
    jitter = 0.11;
    b.trunk([0, -0.05, 0], [0.01, 0.46, 0.0], 0.025, 0.016, 6);
    b.trunk([0.0, 0.32, 0], [0.13, 0.56, 0.05], 0.013, 0.008, 5);
    blobs.push({ c: [0.02, 0.76, -0.01], r: [0.24, 0.2, 0.24] });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand() * 0.7;
      const rr = 0.19 + rand() * 0.05;
      const out = 0.18 + rand() * 0.05;
      blobs.push({ c: [Math.cos(a) * out, 0.52 + rand() * 0.16, Math.sin(a) * out], r: [rr, rr * 0.88, rr] });
    }
  } else if (kind === "tall") {
    // cypress: a slim flame of stacked lobes
    env = { c: [0, 0.55, 0], r: [0.115, 0.48, 0.115] };
    jitter = 0.07;
    b.trunk([0, -0.05, 0], [0, 0.18, 0], 0.022, 0.016, 5);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = 0.27 + t * 0.56;
      const rr = 0.11 * (1 - t * 0.5) * (0.92 + rand() * 0.12);
      blobs.push({ c: [(rand() - 0.5) * 0.025, y, (rand() - 0.5) * 0.025], r: [rr, rr * 2.15, rr] });
    }
  } else {
    // olive: wide, airy, silver — two leaning stems
    env = { c: [0, 0.62, 0], r: [0.47, 0.34, 0.47] };
    jitter = 0.13;
    b.trunk([0, -0.05, 0], [0.11, 0.42, 0.04], 0.036, 0.022, 6);
    b.trunk([0.02, 0.1, 0], [-0.13, 0.44, -0.06], 0.03, 0.02, 5);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand() * 0.8;
      const out = 0.23 + rand() * 0.08;
      const rr = 0.19 + rand() * 0.05;
      blobs.push({ c: [Math.cos(a) * out, 0.54 + rand() * 0.12, Math.sin(a) * out], r: [rr, rr * 0.82, rr] });
    }
    blobs.push({ c: [0.0, 0.74, 0.0], r: [0.24, 0.18, 0.24] });
  }
  blobs.forEach((bl, i) =>
    b.blob(
      bl,
      env,
      blobs.filter((_, j) => j !== i),
      jitter,
      (kind === "round" ? 100 : kind === "tall" ? 200 : 300) + i,
    ),
  );
  return b.build();
}
