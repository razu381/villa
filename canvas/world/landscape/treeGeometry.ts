/**
 * Unit-height tree geometries (base at the origin, height 1) for instancing.
 * Each vertex carries its "foam" twin — the same vertex projected onto a smooth
 * envelope — so the shader can morph a model-maker's foam form into clustered
 * foliage.
 *
 * Attributes: position, normal, aFoam (vec3), aFoamN (vec3), aTree = (ao, part, height01)
 *   part: 0 foliage, 1 trunk
 */
import { BufferAttribute, BufferGeometry, IcosahedronGeometry, Vector3 } from "three";
import { mulberry32 } from "@/lib/noise";
import type { TreeKind } from "@/lib/village";

interface Blob {
  c: [number, number, number];
  r: [number, number, number];
}
interface Envelope {
  c: [number, number, number];
  r: [number, number, number];
}

const UNIT_SPHERE = (() => {
  const g = new IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const out: number[] = [];
  for (let i = 0; i < p.count; i++) out.push(p.getX(i), p.getY(i), p.getZ(i));
  g.dispose();
  return out; // non-indexed triangle list
})();
const LOW_SPHERE = (() => {
  const g = new IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const out: number[] = [];
  for (let i = 0; i < p.count; i++) out.push(p.getX(i), p.getY(i), p.getZ(i));
  g.dispose();
  return out;
})();

class TreeBuilder {
  pos: number[] = [];
  nor: number[] = [];
  foam: number[] = [];
  foamN: number[] = [];
  tree: number[] = [];

  blob(b: Blob, env: Envelope, sphere: number[], jitter: number, seed: number) {
    const rand = mulberry32(seed);
    // per-blob lumpy displacement keyed by direction (consistent across shared vertices)
    const lump = (x: number, y: number, z: number) =>
      1 + jitter * (0.55 * Math.sin(x * 4.1 + seed) + 0.45 * Math.sin(y * 5.3 + seed * 0.7) + 0.4 * Math.sin(z * 4.7 + seed * 1.3) + 0.3 * Math.sin((x + z) * 7.9 + seed * 2.1)) * 0.6;
    void rand;
    for (let i = 0; i < sphere.length; i += 3) {
      const ux = sphere[i];
      const uy = sphere[i + 1];
      const uz = sphere[i + 2];
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
      // AO: deeper inside the envelope and lower = darker
      const inner = Math.min(1, dl);
      const low = (py - (env.c[1] - env.r[1])) / (2 * env.r[1]);
      const ao = 0.5 + 0.3 * inner + 0.2 * Math.max(0, Math.min(1, low));
      this.pos.push(px, py, pz);
      this.nor.push(n.x, n.y, n.z);
      this.foam.push(fx, fy, fz);
      this.foamN.push(fn.x, fn.y, fn.z);
      this.tree.push(Math.min(1, ao), 0, py);
    }
  }

  /** Tapered cylinder from a to b (unit space). */
  trunk(a: [number, number, number], b: [number, number, number], r0: number, r1: number, seg = 6) {
    const A = new Vector3(...a);
    const B = new Vector3(...b);
    const axis = new Vector3().subVectors(B, A).normalize();
    const t1 = new Vector3(1, 0, 0);
    if (Math.abs(axis.dot(t1)) > 0.9) t1.set(0, 0, 1);
    const u = new Vector3().crossVectors(axis, t1).normalize();
    const v = new Vector3().crossVectors(axis, u).normalize();
    const ring = (C: Vector3, r: number, i: number) => {
      const a2 = (i / seg) * Math.PI * 2;
      const n = new Vector3().addScaledVector(u, Math.cos(a2)).addScaledVector(v, Math.sin(a2));
      return { p: C.clone().addScaledVector(n, r), n };
    };
    for (let i = 0; i < seg; i++) {
      const p0 = ring(A, r0, i);
      const p1 = ring(A, r0, i + 1);
      const p2 = ring(B, r1, i + 1);
      const p3 = ring(B, r1, i);
      for (const q of [p0, p1, p2, p0, p2, p3]) {
        this.pos.push(q.p.x, q.p.y, q.p.z);
        this.nor.push(q.n.x, q.n.y, q.n.z);
        this.foam.push(q.p.x, q.p.y, q.p.z);
        this.foamN.push(q.n.x, q.n.y, q.n.z);
        this.tree.push(0.85, 1, q.p.y);
      }
    }
  }

  build() {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute("aFoam", new BufferAttribute(new Float32Array(this.foam), 3));
    g.setAttribute("aFoamN", new BufferAttribute(new Float32Array(this.foamN), 3));
    g.setAttribute("aTree", new BufferAttribute(new Float32Array(this.tree), 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Build the unit geometry for a tree kind. */
export function buildTreeGeometry(kind: TreeKind) {
  const b = new TreeBuilder();
  const rand = mulberry32(kind === "round" ? 11 : kind === "tall" ? 23 : 37);
  if (kind === "round") {
    const env: Envelope = { c: [0, 0.62, 0], r: [0.37, 0.36, 0.37] };
    b.trunk([0, -0.05, 0], [0.01, 0.46, 0.0], 0.025, 0.016, 6);
    b.trunk([0.0, 0.32, 0], [0.13, 0.56, 0.05], 0.013, 0.008, 5);
    const blobs: Blob[] = [{ c: [0.02, 0.73, -0.01], r: [0.27, 0.24, 0.27] }];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand() * 0.7;
      const rr = 0.2 + rand() * 0.04;
      const out = 0.17 + rand() * 0.04;
      blobs.push({ c: [Math.cos(a) * out, 0.54 + rand() * 0.12, Math.sin(a) * out], r: [rr, rr * 0.9, rr] });
    }
    blobs.forEach((bl, i) => b.blob(bl, env, UNIT_SPHERE, 0.11, 100 + i));
  } else if (kind === "tall") {
    const env: Envelope = { c: [0, 0.55, 0], r: [0.115, 0.48, 0.115] };
    b.trunk([0, -0.05, 0], [0, 0.18, 0], 0.022, 0.016, 5);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = 0.27 + t * 0.56;
      const rr = 0.11 * (1 - t * 0.5) * (0.92 + rand() * 0.12);
      b.blob({ c: [(rand() - 0.5) * 0.025, y, (rand() - 0.5) * 0.025], r: [rr, rr * 2.15, rr] }, env, LOW_SPHERE, 0.07, 200 + i);
    }
  } else {
    // olive: wide, rounded, airy — two leaning stems
    const env: Envelope = { c: [0, 0.62, 0], r: [0.46, 0.34, 0.46] };
    b.trunk([0, -0.05, 0], [0.11, 0.42, 0.04], 0.036, 0.022, 6);
    b.trunk([0.02, 0.1, 0], [-0.13, 0.44, -0.06], 0.03, 0.02, 5);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand() * 0.8;
      const out = 0.22 + rand() * 0.08;
      const rr = 0.2 + rand() * 0.05;
      b.blob({ c: [Math.cos(a) * out, 0.55 + rand() * 0.1, Math.sin(a) * out], r: [rr, rr * 0.86, rr] }, env, UNIT_SPHERE, 0.13, 300 + i);
    }
    b.blob({ c: [0.0, 0.74, 0.0], r: [0.25, 0.2, 0.25] }, env, UNIT_SPHERE, 0.1, 399);
  }
  return b.build();
}
