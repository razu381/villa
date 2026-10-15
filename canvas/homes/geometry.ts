/**
 * Small geometry helpers for the featured homes: a vertex-coloured block
 * builder for interiors (one merged mesh per level), additive light-pool
 * quads, and a triangle splitter that shares attributes between parts.
 */

import { BufferGeometry, Color, Float32BufferAttribute, Uint32BufferAttribute } from "three";

const tmp = new Color();

/** Linear-space RGB of an sRGB hex (three's colour management converts on set). */
export function rgb(hex: string): [number, number, number] {
  tmp.set(hex);
  return [tmp.r, tmp.g, tmp.b];
}

/**
 * Axis-aligned blocks, cylinders and spheres with flat vertex colours, built
 * straight into typed arrays (no per-piece BufferGeometry).
 */
export class BlockBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  private v(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: [number, number, number]) {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.col.push(c[0], c[1], c[2]);
    return this.pos.length / 3 - 1;
  }

  /** A quad a→b→c→d, counter-clockwise seen from its normal. */
  quad(a: number[], b: number[], c: number[], d: number[], n: number[], col: [number, number, number]) {
    const i = this.v(a[0], a[1], a[2], n[0], n[1], n[2], col);
    this.v(b[0], b[1], b[2], n[0], n[1], n[2], col);
    this.v(c[0], c[1], c[2], n[0], n[1], n[2], col);
    this.v(d[0], d[1], d[2], n[0], n[1], n[2], col);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** Closed axis-aligned box. `noBottom` skips the underside (sits on a floor). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: [number, number, number], noBottom = true) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], col);
    if (!noBottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], col);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], col);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], col);
  }

  /** Vertical cylinder (capped top, open bottom unless asked). */
  cyl(cx: number, y0: number, cz: number, r: number, h: number, col: [number, number, number], seg = 18, bottom = false, rTop = r) {
    const y1 = y0 + h;
    const slope = (r - rTop) / h;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);
      const nl0 = Math.hypot(1, slope);
      const base = this.v(cx + c0 * r, y0, cz + s0 * r, c0 / nl0, slope / nl0, s0 / nl0, col);
      this.v(cx + c1 * r, y0, cz + s1 * r, c1 / nl0, slope / nl0, s1 / nl0, col);
      this.v(cx + c1 * rTop, y1, cz + s1 * rTop, c1 / nl0, slope / nl0, s1 / nl0, col);
      this.v(cx + c0 * rTop, y1, cz + s0 * rTop, c0 / nl0, slope / nl0, s0 / nl0, col);
      this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    const capTop = (y: number, rr: number, up: boolean) => {
      const c = this.v(cx, y, cz, 0, up ? 1 : -1, 0, col);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        this.v(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr, 0, up ? 1 : -1, 0, col);
      }
      for (let i = 0; i < seg; i++) {
        if (up) this.idx.push(c, c + 2 + i, c + 1 + i);
        else this.idx.push(c, c + 1 + i, c + 2 + i);
      }
    };
    capTop(y1, rTop, true);
    if (bottom) capTop(y0, r, false);
  }

  /** UV sphere. */
  sphere(cx: number, cy: number, cz: number, r: number, col: [number, number, number], seg = 16, rings = 10, sy = 1) {
    const start = this.pos.length / 3;
    for (let j = 0; j <= rings; j++) {
      const t = (j / rings) * Math.PI;
      for (let i = 0; i <= seg; i++) {
        const p = (i / seg) * Math.PI * 2;
        const nx = Math.sin(t) * Math.cos(p);
        const ny = Math.cos(t);
        const nz = Math.sin(t) * Math.sin(p);
        this.v(cx + nx * r, cy + ny * r * sy, cz + nz * r, nx, ny, nz, col);
      }
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < seg; i++) {
        const a = start + j * (seg + 1) + i;
        const b = a + seg + 1;
        this.idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }

  isEmpty() {
    return this.idx.length === 0;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.col, 3));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Soft light pools: horizontal quads (uv 0..1 across, aPool = strength) for an
 * additive radial falloff. Each lamp drops one on the floor (and smaller ones
 * on the table top it lights).
 */
export class PoolBuilder {
  pos: number[] = [];
  uv: number[] = [];
  pool: number[] = [];
  idx: number[] = [];

  /** Elliptical pool centred (x, z) at height y; radii rx, rz; strength k. */
  add(x: number, y: number, z: number, rx: number, rz: number, k: number) {
    const i = this.pos.length / 3;
    this.pos.push(x - rx, y, z - rz, x + rx, y, z - rz, x + rx, y, z + rz, x - rx, y, z + rz);
    this.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    this.pool.push(k, k, k, k);
    this.idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
  }

  isEmpty() {
    return this.idx.length === 0;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new Float32BufferAttribute(this.uv, 2));
    g.setAttribute("aPool", new Float32BufferAttribute(this.pool, 1));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Split an indexed geometry by triangle: returns [match, rest], sharing the
 * attribute buffers (only the index differs). Either may be null if empty.
 */
export function splitTriangles(g: BufferGeometry, keep: (ax: number, ay: number, az: number, maxY: number, minY: number) => boolean): [BufferGeometry | null, BufferGeometry | null] {
  const index = g.index;
  const pos = g.getAttribute("position");
  if (!index) return [g, null];
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const i0 = index.getX(i);
    const i1 = index.getX(i + 1);
    const i2 = index.getX(i + 2);
    const cx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
    const cy = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;
    const cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
    const maxY = Math.max(pos.getY(i0), pos.getY(i1), pos.getY(i2));
    const minY = Math.min(pos.getY(i0), pos.getY(i1), pos.getY(i2));
    (keep(cx, cy, cz, maxY, minY) ? a : b).push(i0, i1, i2);
  }
  const make = (list: number[]) => {
    if (!list.length) return null;
    const out = new BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) out.setAttribute(name, attr);
    out.setIndex(new Uint32BufferAttribute(list, 1));
    out.computeBoundingBox();
    out.computeBoundingSphere();
    return out;
  };
  return [make(a), make(b)];
}
