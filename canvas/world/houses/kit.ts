/**
 * Low-level geometry kit for the houses: an indexed mesh builder that emits
 * correctly-oriented quads and boxes, facades with punched window openings
 * (outer wall partitioned around the holes + reveals + pane, all sharing
 * edges so every volume stays a closed shell for the section poché), and
 * a line-segment collector for the architect's line drawing.
 *
 * Every vertex carries the same attribute set so parts merge freely:
 *   position (3) · normal (3) · uv (2) · aHouse (4) · aWin (2)
 *   aHouse = (base y, rise delay, light delay, house random)
 *   aWin   = (window random 0..1 or -1, role)  — see ROLE
 */

import { BufferGeometry, Float32BufferAttribute, type Matrix4, Uint32BufferAttribute, Vector3 } from "three";

/** aWin.y — what a surface is, for the night lighting. */
export const ROLE = {
  wall: 0,
  /** A punched window pane. */
  pane: 1,
  /** Large living-room glazing (more likely lit, brighter). */
  glazing: 2,
  /** Skylight glass (seen from above at night). */
  skylight: 3,
  /** Door leaf. */
  door: 5,
  /** Interior room surfaces (inside the shell; seen only through the section cut). */
  interior: 6,
  /* Reveals store the NEGATED role of their window (aWin.y < 0) so they catch its warm spill. */
} as const;

export type Vec3 = [number, number, number];

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _n = new Vector3();

export class MeshBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  house: number[] = [];
  win: number[] = [];
  idx: number[] = [];
  /** Current per-vertex attributes (set before emitting). */
  houseAttr: [number, number, number, number] = [0, 0, 0, 0];
  winAttr: [number, number] = [-1, ROLE.wall];

  get vertexCount() {
    return this.pos.length / 3;
  }

  private vert(p: Vec3, n: Vec3, uv: [number, number]) {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.uv.push(uv[0], uv[1]);
    this.house.push(...this.houseAttr);
    this.win.push(this.winAttr[0], this.winAttr[1]);
  }

  /**
   * A planar quad a→b→c→d (any winding), oriented so its front face points
   * along `n`. uv defaults to metric coordinates along a→b and a→d.
   */
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, n: Vec3, uvs?: [number, number][]) {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    _c.crossVectors(_a, _b);
    const flip = _c.x * n[0] + _c.y * n[1] + _c.z * n[2] < 0;
    let uv = uvs;
    if (!uv) {
      const lu = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const lv = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
      uv = [
        [0, 0],
        [lu, 0],
        [lu, lv],
        [0, lv],
      ];
    }
    const i = this.vertexCount;
    this.vert(a, n, uv[0]);
    this.vert(b, n, uv[1]);
    this.vert(c, n, uv[2]);
    this.vert(d, n, uv[3]);
    if (flip) this.idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
    else this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** Axis-aligned closed box. `skip` omits faces (e.g. "ny" when it sits on something). */
  box(min: Vec3, max: Vec3, skip: Face[] = []) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    if (!skip.includes("px")) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    if (!skip.includes("nx")) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    if (!skip.includes("py")) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    if (!skip.includes("ny")) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    if (!skip.includes("pz")) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    if (!skip.includes("nz")) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
  }

  /** A closed box in an arbitrary orthonormal frame (corner o, axes u, v, w, extents). */
  frameBox(o: Vec3, u: Vec3, v: Vec3, w: Vec3, lu: number, lv: number, lw: number) {
    const P = (a: number, b: number, c: number): Vec3 => [
      o[0] + u[0] * a + v[0] * b + w[0] * c,
      o[1] + u[1] * a + v[1] * b + w[1] * c,
      o[2] + u[2] * a + v[2] * b + w[2] * c,
    ];
    const neg = (x: Vec3): Vec3 => [-x[0], -x[1], -x[2]];
    this.quad(P(0, 0, 0), P(lu, 0, 0), P(lu, lv, 0), P(0, lv, 0), neg(w));
    this.quad(P(0, 0, lw), P(lu, 0, lw), P(lu, lv, lw), P(0, lv, lw), w);
    this.quad(P(0, 0, 0), P(lu, 0, 0), P(lu, 0, lw), P(0, 0, lw), neg(v));
    this.quad(P(0, lv, 0), P(lu, lv, 0), P(lu, lv, lw), P(0, lv, lw), v);
    this.quad(P(0, 0, 0), P(0, lv, 0), P(0, lv, lw), P(0, 0, lw), neg(u));
    this.quad(P(lu, 0, 0), P(lu, lv, 0), P(lu, lv, lw), P(lu, 0, lw), u);
  }

  /**
   * A room cavity: an axis-aligned box whose faces point INWARDS. Nested in a
   * closed volume it turns the section cut into walls/slabs (poché) around a
   * lit room.
   */
  innerBox(min: Vec3, max: Vec3) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [-1, 0, 0]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [1, 0, 0]);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, -1, 0]);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, 1, 0]);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, -1]);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, 1]);
  }

  isEmpty() {
    return this.idx.length === 0;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new Float32BufferAttribute(this.uv, 2));
    g.setAttribute("aHouse", new Float32BufferAttribute(this.house, 4));
    g.setAttribute("aWin", new Float32BufferAttribute(this.win, 2));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

export type Face = "px" | "nx" | "py" | "ny" | "pz" | "nz";

/* ------------------------------------------------------------ face frames */

/** A vertical facade plane: origin at its bottom-left seen from outside, u → right, v ↑, n outward. */
export interface FaceFrame {
  o: Vec3;
  u: Vec3;
  v: Vec3;
  n: Vec3;
  /** Width (along u) and height (along v). */
  w: number;
  h: number;
}

/** The facade frame of one side of an axis-aligned box. */
export function faceOf(min: Vec3, max: Vec3, face: Exclude<Face, "py" | "ny">): FaceFrame {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const h = y1 - y0;
  switch (face) {
    case "pz":
      return { o: [x0, y0, z1], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], w: x1 - x0, h };
    case "nz":
      return { o: [x1, y0, z0], u: [-1, 0, 0], v: [0, 1, 0], n: [0, 0, -1], w: x1 - x0, h };
    case "px":
      return { o: [x1, y0, z1], u: [0, 0, -1], v: [0, 1, 0], n: [1, 0, 0], w: z1 - z0, h };
    case "nx":
      return { o: [x0, y0, z0], u: [0, 0, 1], v: [0, 1, 0], n: [-1, 0, 0], w: z1 - z0, h };
  }
}

/** Point on a face frame at (u, v), pushed `d` metres inward (against n). */
export function onFace(f: FaceFrame, u: number, v: number, d = 0): Vec3 {
  return [
    f.o[0] + f.u[0] * u + f.v[0] * v - f.n[0] * d,
    f.o[1] + f.u[1] * u + f.v[1] * v - f.n[1] * d,
    f.o[2] + f.u[2] * u + f.v[2] * v - f.n[2] * d,
  ];
}

const neg3 = (x: Vec3): Vec3 => [-x[0], -x[1], -x[2]];

/* ---------------------------------------------------------------- openings */

export interface Opening {
  /** Rectangle on the face, in face coordinates (metres from bottom-left). */
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  /** Reveal depth. */
  depth: number;
  /** What closes the opening at the back of the reveal. */
  fill: "pane" | "glazing" | "door";
  /** Vertical mullions (0 = single pane). */
  mullions?: number;
  /** Horizontal transom height from the bottom of the opening (metres), optional. */
  transom?: number;
  /** Per-window random (night lighting). */
  rand: number;
}

export interface FacadeTargets {
  /** Wall + reveals. */
  wall: MeshBuilder;
  /** Window glass. */
  pane: MeshBuilder;
  /** Frames and mullions. */
  frame: MeshBuilder;
  /** Door leaves. */
  door: MeshBuilder;
  /** Optional line collector for the drawing (window outlines). */
  lines?: LineCollector;
}

/**
 * A facade with punched openings. The outer wall is partitioned into
 * rectangles around the holes (greedy row runs), then every hole gets four
 * reveal quads and a pane at the back — sharing exact edges, so the parent
 * volume stays closed.
 */
export function facade(f: FaceFrame, openings: Opening[], t: FacadeTargets) {
  t.wall.winAttr = [-1, ROLE.wall];
  wallWithHoles(f, openings, t.wall);

  for (const o of openings) {
    const d = o.depth;
    // Reveals (face into the opening).
    const role = o.fill === "door" ? ROLE.door : o.fill === "glazing" ? ROLE.glazing : ROLE.pane;
    // Reveals carry their window's random and (negated) role → warm spill when it is lit.
    t.wall.winAttr = o.fill === "door" ? [-1, -ROLE.door] : [o.rand, -role];
    t.wall.quad(onFace(f, o.u0, o.v0), onFace(f, o.u1, o.v0), onFace(f, o.u1, o.v0, d), onFace(f, o.u0, o.v0, d), f.v);
    t.wall.quad(onFace(f, o.u0, o.v1), onFace(f, o.u1, o.v1), onFace(f, o.u1, o.v1, d), onFace(f, o.u0, o.v1, d), neg3(f.v));
    t.wall.quad(onFace(f, o.u0, o.v0), onFace(f, o.u0, o.v1), onFace(f, o.u0, o.v1, d), onFace(f, o.u0, o.v0, d), f.u);
    t.wall.quad(onFace(f, o.u1, o.v0), onFace(f, o.u1, o.v1), onFace(f, o.u1, o.v1, d), onFace(f, o.u1, o.v0, d), neg3(f.u));
    t.wall.winAttr = [-1, ROLE.wall];

    // The pane (or door leaf) closing the hole; uv 0..1 across the opening.
    const target = o.fill === "door" ? t.door : t.pane;
    target.winAttr = [o.rand, role];
    target.quad(onFace(f, o.u0, o.v0, d), onFace(f, o.u1, o.v0, d), onFace(f, o.u1, o.v1, d), onFace(f, o.u0, o.v1, d), f.n, [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    target.winAttr = [-1, ROLE.wall];

    // Slim frame + mullions standing just proud of the glass.
    if (o.fill !== "door") {
      const fw = o.fill === "glazing" ? 0.07 : 0.06;
      const fd = 0.07;
      const W = o.u1 - o.u0;
      const H = o.v1 - o.v0;
      const back = d - 0.012; // a hair proud of the glass (never coplanar with the pane)
      const frameBar = (u0: number, v0: number, lu: number, lv: number) =>
        t.frame.frameBox(onFace(f, o.u0 + u0, o.v0 + v0, back), f.u, f.v, f.n, lu, lv, fd);
      frameBar(0, 0, W, fw);
      frameBar(0, H - fw, W, fw);
      frameBar(0, fw, fw, H - 2 * fw);
      frameBar(W - fw, fw, fw, H - 2 * fw);
      const m = o.mullions ?? 0;
      for (let k = 1; k <= m; k++) {
        const u = (W * k) / (m + 1) - fw * 0.4;
        frameBar(u, fw, fw * 0.8, H - 2 * fw);
      }
      if (o.transom) frameBar(fw, o.transom, W - 2 * fw, fw * 0.8);
      // A slim bronze sill lip under punched windows (a fine shadow line from afar).
      if (o.fill === "pane" && o.v0 > 0.3) {
        t.frame.frameBox(onFace(f, o.u0 - 0.03, o.v0 - 0.04, 0), f.u, f.v, f.n, W + 0.06, 0.04, 0.05);
      }
    } else {
      // A slim bronze handle bar on the door leaf.
      const W = o.u1 - o.u0;
      const H = o.v1 - o.v0;
      t.frame.frameBox(onFace(f, o.u0 + W * 0.82, o.v0 + H * 0.3, d), f.u, f.v, f.n, 0.04, H * 0.4, 0.06);
    }

    if (t.lines) {
      const L = t.lines;
      const lift = -0.012; // a hair proud of the facade
      const a = onFace(f, o.u0, o.v0, lift);
      const b = onFace(f, o.u1, o.v0, lift);
      const c = onFace(f, o.u1, o.v1, lift);
      const e = onFace(f, o.u0, o.v1, lift);
      L.seg(a, b, 0.72);
      L.seg(a, e, 0.72);
      L.seg(b, c, 0.74);
      L.seg(e, c, 0.76);
    }
  }
}

export interface Rect {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/**
 * Partition a face rectangle into quads around rectangular holes (greedy row
 * runs). Quads face `n` (default: the frame's outward normal).
 */
export function wallWithHoles(f: FaceFrame, holes: Rect[], b: MeshBuilder, n: Vec3 = f.n) {
  const us = uniqSorted([0, f.w, ...holes.flatMap((o) => [o.u0, o.u1])]);
  const vs = uniqSorted([0, f.h, ...holes.flatMap((o) => [o.v0, o.v1])]);
  const inHole = (u: number, v: number) => holes.some((o) => u > o.u0 && u < o.u1 && v > o.v0 && v < o.v1);
  for (let j = 0; j < vs.length - 1; j++) {
    const v0 = vs[j];
    const v1 = vs[j + 1];
    const vm = (v0 + v1) / 2;
    let i = 0;
    while (i < us.length - 1) {
      if (inHole((us[i] + us[i + 1]) / 2, vm)) {
        i++;
        continue;
      }
      let k = i + 1;
      while (k < us.length - 1 && !inHole((us[k] + us[k + 1]) / 2, vm)) k++;
      b.quad(onFace(f, us[i], v0), onFace(f, us[k], v0), onFace(f, us[k], v1), onFace(f, us[i], v1), n);
      i = k;
    }
  }
}

function uniqSorted(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const out: number[] = [];
  for (const x of s) if (!out.length || Math.abs(x - out[out.length - 1]) > 1e-5) out.push(x);
  return out;
}

/* --------------------------------------------------------------- the mask */

/**
 * Depth-only envelope boxes for hidden-line removal in the line drawing.
 * aMask = (box bottom y, box top y, house delay, house pad y): the shader
 * shrinks each box from the bottom as its house rises, so mask + risen
 * house always fill the final envelope (hidden edges stay hidden).
 */
export class MaskBuilder {
  pos: number[] = [];
  mask: number[] = [];
  delay = 0;

  box(min: Vec3, max: Vec3) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const c: Vec3[] = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ];
    // Winding is irrelevant (double-sided, depth only).
    const tris = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
    for (const i of tris) {
      this.pos.push(...c[i]);
      this.mask.push(y0, y1, this.delay, 0);
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("aMask", new Float32BufferAttribute(this.mask, 4));
    g.computeBoundingSphere();
    return g;
  }
}

/* -------------------------------------------------------------- the lines */

/**
 * Line segments for the architect's drawing. Each segment stores its draw
 * phase (0 = plan, ~0.3 verticals, ~0.55 tops, ~0.75 openings) — the shader
 * traces it from its first to its second point.
 */
export class LineCollector {
  pos: number[] = [];
  /** aLine = (house delay, endpoint 0|1, phase, duration) */
  line: number[] = [];
  delay = 0;

  seg(a: Vec3, b: Vec3, phase: number, duration = 0.22) {
    this.pos.push(...a, ...b);
    this.line.push(this.delay, 0, phase, duration, this.delay, 1, phase, duration);
  }

  /** The 12 edges of a box, phased like a pen drawing it: plan, verticals (upwards), tops. */
  box(min: Vec3, max: Vec3, phaseOffset = 0) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const p = phaseOffset;
    // plan
    this.seg([x0, y0, z0], [x1, y0, z0], p + 0.0);
    this.seg([x1, y0, z0], [x1, y0, z1], p + 0.04);
    this.seg([x1, y0, z1], [x0, y0, z1], p + 0.08);
    this.seg([x0, y0, z1], [x0, y0, z0], p + 0.12);
    // verticals, drawn upwards
    this.seg([x0, y0, z0], [x0, y1, z0], p + 0.3);
    this.seg([x1, y0, z0], [x1, y1, z0], p + 0.33);
    this.seg([x1, y0, z1], [x1, y1, z1], p + 0.36);
    this.seg([x0, y0, z1], [x0, y1, z1], p + 0.39);
    // tops
    this.seg([x0, y1, z0], [x1, y1, z0], p + 0.52);
    this.seg([x1, y1, z0], [x1, y1, z1], p + 0.55);
    this.seg([x1, y1, z1], [x0, y1, z1], p + 0.58);
    this.seg([x0, y1, z1], [x0, y1, z0], p + 0.61);
  }

  /** A horizontal rectangle outline at height y (roof outlines, terraces). */
  rect(x0: number, z0: number, x1: number, z1: number, y: number, phase: number) {
    this.seg([x0, y, z0], [x1, y, z0], phase);
    this.seg([x1, y, z0], [x1, y, z1], phase + 0.02);
    this.seg([x1, y, z1], [x0, y, z1], phase + 0.04);
    this.seg([x0, y, z1], [x0, y, z0], phase + 0.06);
  }

  /**
   * Screen-space hairline quads: 4 vertices per segment (position = this end,
   * aOther = the other end, aSide = ±1, aLine as above). `matrix` places the
   * drawing (e.g. house → world) before building.
   */
  build(matrix?: Matrix4): BufferGeometry {
    const n = this.pos.length / 6;
    const pos = new Float32Array(n * 12);
    const other = new Float32Array(n * 12);
    const side = new Float32Array(n * 4);
    const line = new Float32Array(n * 16);
    const idx = new Uint32Array(n * 6);
    const a = new Vector3();
    const b = new Vector3();
    for (let i = 0; i < n; i++) {
      a.fromArray(this.pos, i * 6);
      b.fromArray(this.pos, i * 6 + 3);
      if (matrix) {
        a.applyMatrix4(matrix);
        b.applyMatrix4(matrix);
      }
      const ends = [a, a, b, b];
      const others = [b, b, a, a];
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        ends[k].toArray(pos, v * 3);
        others[k].toArray(other, v * 3);
        side[v] = k % 2 === 0 ? -1 : 1;
        const src = i * 8 + (k < 2 ? 0 : 4);
        line[v * 4] = this.line[src];
        line[v * 4 + 1] = this.line[src + 1];
        line[v * 4 + 2] = this.line[src + 2];
        line[v * 4 + 3] = this.line[src + 3];
      }
      const v0 = i * 4;
      idx.set([v0, v0 + 1, v0 + 3, v0, v0 + 3, v0 + 2], i * 6);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("aOther", new Float32BufferAttribute(other, 3));
    g.setAttribute("aSide", new Float32BufferAttribute(side, 1));
    g.setAttribute("aLine", new Float32BufferAttribute(line, 4));
    g.setIndex(new Uint32BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}
